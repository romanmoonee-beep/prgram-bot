// src/jobs/workers/cleanupWorker.ts
import { Job } from 'bull';
import { cleanupQueue, CleanupJob } from '../queues';
import { Notification, Task, Check } from '../../database/models';
import { logger } from '../../utils/logger';
import { redis } from '../../bot/middlewares/rateLimit';
import { Op } from 'sequelize';
import fs from 'fs/promises';
import path from 'path';

// Worker для очистки старых данных и файлов
export default class CleanupWorker {
  constructor() {
    this.setupProcessor();
  }

  public setupProcessor() {
    // Настраиваем обработчик очереди
    cleanupQueue.process('cleanup-data', 2, this.processCleanup.bind(this));
    
    logger.info('✅ Cleanup worker initialized');
  }

  public async processCleanup(job: Job<CleanupJob>) {
    const { type, olderThan } = job.data;
    
    try {
      switch (type) {
        case 'old_data':
          return await this.cleanupOldData(olderThan);
          
        case 'temp_files':
          return await this.cleanupTempFiles();
          
        case 'expired_sessions':
          return await this.cleanupExpiredSessions();
          
        default:
          throw new Error(`Unknown cleanup type: ${type}`);
      }
    } catch (error) {
      logger.error(`Cleanup worker error for type ${type}:`, error);
      throw error;
    }
  }

  public async cleanupOldData(olderThan?: Date) {
    const cutoffDate = olderThan || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 дней назад
    
    let totalCleaned = 0;
    
    // Удаление старых прочитанных уведомлений
    const deletedNotifications = await Notification.destroy({
      where: {
        createdAt: {
          [require('sequelize').Op.lt]: cutoffDate
        },
        isRead: true
      }
    });
    
    totalCleaned += deletedNotifications;
    logger.info(`Deleted ${deletedNotifications} old notifications`);
    
    // Удаление истекших неактивных чеков
    const now = new Date();
    const deletedChecks = await Check.destroy({
      where: {
        expiresAt: {
          [require('sequelize').Op.lt]: now
        },
        isActive: false
      }
    });
    
    totalCleaned += deletedChecks;
    logger.info(`Deleted ${deletedChecks} expired inactive checks`);
    
    // Обновление статуса истекших заданий
    const [expiredTasks] = await Task.update(
      { status: 'expired' },
      {
        where: {
          expiresAt: {
            [require('sequelize').Op.lt]: now
          },
          status: 'active'
        }
      }
    );
    
    logger.info(`Expired ${expiredTasks} tasks`);
    
    // Очистка старых аналитических данных из Redis
    const cleanedRedisKeys = await this.cleanupOldRedisData(cutoffDate);
    
    return {
      success: true,
      deletedNotifications,
      deletedChecks,
      expiredTasks,
      cleanedRedisKeys,
      total: totalCleaned
    };
  }

  public async cleanupTempFiles() {
    const tempDirs = [
      path.join(process.cwd(), 'storage', 'temp'),
      path.join(process.cwd(), 'storage', 'uploads', 'temp'),
      path.join(process.cwd(), 'logs', 'temp')
    ];
    
    let totalFiles = 0;
    let totalSize = 0;
    
    for (const tempDir of tempDirs) {
      try {
        const { files, size } = await this.cleanupDirectory(tempDir, 24 * 60 * 60 * 1000); // 24 часа
        totalFiles += files;
        totalSize += size;
      } catch (error: any) {
        // Директория может не существовать
        if (error.code !== 'ENOENT') {
          logger.warn(`Failed to cleanup directory ${tempDir}:`, error);
        }
      }
    }
    
    // Очистка старых логов (старше 30 дней)
    try {
      const logsDir = path.join(process.cwd(), 'logs');
      const { files: logFiles, size: logSize } = await this.cleanupDirectory(
        logsDir, 
        30 * 24 * 60 * 60 * 1000, // 30 дней
        /\.log$/
      );
      totalFiles += logFiles;
      totalSize += logSize;
    } catch (error: any) {
      logger.warn('Failed to cleanup old logs:', error);
    }
    
    logger.info(`Cleaned up ${totalFiles} temp files, freed ${Math.round(totalSize / 1024 / 1024)} MB`);
    
    return {
      success: true,
      filesDeleted: totalFiles,
      sizeFreed: totalSize
    };
  }

  public async cleanupDirectory(dirPath: string, maxAge: number, fileFilter?: RegExp): Promise<{ files: number, size: number }> {
    const files = await fs.readdir(dirPath);
    let deletedFiles = 0;
    let freedSize = 0;
    
    const cutoffTime = Date.now() - maxAge;
    
    for (const file of files) {
      const filePath = path.join(dirPath, file);
      
      try {
        const stats = await fs.stat(filePath);
        
        // Проверяем возраст файла
        if (stats.mtime.getTime() < cutoffTime) {
          // Проверяем фильтр файлов, если задан
          if (!fileFilter || fileFilter.test(file)) {
            await fs.unlink(filePath);
            deletedFiles++;
            freedSize += stats.size;
          }
        }
      } catch (error: any) {
        logger.warn(`Failed to process file ${filePath}:`, error);
      }
    }
    
    return { files: deletedFiles, size: freedSize };
  }

  public async cleanupExpiredSessions() {
    // Очистка просроченных сессий в Redis
    const pattern = 'session:*';
    let cursor = '0';
    let deletedSessions = 0;
    
    const rateLimitPattern = 'rl:*'; cursor = '0';
    let deletedRateLimits = 0;

    do {
      const [newCursor, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = newCursor;
      
      for (const key of keys) {
        const ttl = await redis.ttl(key);
        if (ttl === -2) {
          deletedRateLimits++;
        }
      }
    } while (cursor !== '0');
    
    logger.info(`Cleaned up ${deletedSessions} expired sessions and ${deletedRateLimits} rate limit entries`);
    
    return {
      success: true,
      deletedSessions,
      deletedRateLimits
    };
  }

  public async cleanupOldRedisData(cutoffDate: Date) {
    const cutoffDateStr = cutoffDate.toISOString().split('T')[0];
    let deletedKeys = 0;
    
    // Очистка старых аналитических данных
    const analyticsPatterns = [
      'analytics:user_actions:*',
      'analytics:task:*',
      'analytics:system_stats:*'
    ];
    
    for (const pattern of analyticsPatterns) {
      let cursor = '0';
      
      do {
        const [newCursor, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
        cursor = newCursor;
        
        for (const key of keys) {
          // Извлекаем дату из ключа
          const dateMatch = key.match(/(\d{4}-\d{2}-\d{2})/);
          if (dateMatch && dateMatch[1] < cutoffDateStr) {
            await redis.del(key);
            deletedKeys++;
          }
        }
      } while (cursor !== '0');
    }
    
    return deletedKeys;
  }

  // Статические методы для добавления задач очистки
  static async scheduleOldDataCleanup(olderThan?: Date, delay?: number) {
    return await cleanupQueue.add('cleanup-data', {
      type: 'old_data',
      olderThan
    }, { 
      delay,
      priority: 1,
      attempts: 1
    });
  }

  static async scheduleTempFilesCleanup(delay?: number) {
    return await cleanupQueue.add('cleanup-data', {
      type: 'temp_files'
    }, { 
      delay,
      priority: 2,
      attempts: 1
    });
  }

  static async scheduleExpiredSessionsCleanup(delay?: number) {
    return await cleanupQueue.add('cleanup-data', {
      type: 'expired_sessions'
    }, { 
      delay,
      priority: 3,
      attempts: 1
    });
  }

  // Запланировать полную очистку (все типы)
  static async scheduleFullCleanup(delay?: number) {
    const jobs = [
      { type: 'old_data' as const },
      { type: 'temp_files' as const },
      { type: 'expired_sessions' as const }
    ];

    const promises = jobs.map(job => 
      cleanupQueue.add('cleanup-data', job, {
        delay,
        priority: 1,
        attempts: 1
      })
    );

    return await Promise.all(promises);
  }

  // Получить статистику очистки
  async getCleanupStats() {
    const [waiting, active, completed, failed] = await Promise.all([
      cleanupQueue.getWaiting(),
      cleanupQueue.getActive(),
      cleanupQueue.getCompleted(),
      cleanupQueue.getFailed()
    ]);

    return {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length
    };
  }

  // Метод для остановки worker
  public async stop() {
    await cleanupQueue.close();
    logger.info('Cleanup worker stopped');
  }
}