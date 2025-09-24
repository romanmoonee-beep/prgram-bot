// src/jobs/workers/analyticsWorker.ts
import { Job } from 'bull';
import { analyticsQueue, AnalyticsJob } from '../queues';
import { User, Task, TaskExecution, Transaction } from '../../database/models';
import { logger } from '../../utils/logger';
import { redis } from '../queues/index';

// Worker для обработки аналитических данных
class AnalyticsWorker {
  private statsCache = new Map<string, any>();

  constructor() {
    this.setupProcessor();
  }

  private setupProcessor() {
    // Настраиваем обработчик очереди
    analyticsQueue.process('process-analytics', 5, this.processAnalytics.bind(this));
    
    logger.info('✅ Analytics worker initialized');
  }

  private async processAnalytics(job: Job<AnalyticsJob>) {
    const { type, data, userId } = job.data;
    
    try {
      switch (type) {
        case 'user_action':
          return await this.processUserAction(data, userId);
          
        case 'task_stats':
          return await this.processTaskStats(data);
          
        case 'system_stats':
          return await this.processSystemStats();
          
        default:
          throw new Error(`Unknown analytics type: ${type}`);
      }
    } catch (error) {
      logger.error(`Analytics worker error for type ${type}:`, error);
      throw error;
    }
  }

  private async processUserAction(data: any, userId?: number) {
    const { action, metadata = {} } = data;
    
    // Обновляем счетчики действий пользователей в Redis
    const redisKey = `analytics:user_actions:${new Date().toISOString().split('T')[0]}`;
    
    await redis.hincrby(redisKey, `total:${action}`, 1);
    if (userId) {
      await redis.hincrby(redisKey, `user:${userId}:${action}`, 1);
    }
    
    // Устанавливаем TTL на 30 дней
    await redis.expire(redisKey, 30 * 24 * 60 * 60);
    
    logger.debug(`User action recorded: ${action}`, { userId, metadata });
    
    return { success: true, action, userId };
  }

  private async processTaskStats(data: any) {
    const { taskId, event, value = 1 } = data;
    
    if (!taskId || !event) {
      throw new Error('Task ID and event are required for task stats');
    }
    
    // Обновляем статистику задания в Redis
    const redisKey = `analytics:task:${taskId}:${new Date().toISOString().split('T')[0]}`;
    
    await redis.hincrby(redisKey, event, value);
    await redis.expire(redisKey, 30 * 24 * 60 * 60); // 30 дней
    
    // Также обновляем общую статистику
    const generalKey = `analytics:tasks:${new Date().toISOString().split('T')[0]}`;
    await redis.hincrby(generalKey, event, value);
    await redis.expire(generalKey, 30 * 24 * 60 * 60);
    
    logger.debug(`Task stats updated: ${event} for task ${taskId}`, { value });
    
    return { success: true, taskId, event, value };
  }

  private async processSystemStats() {
    try {
      // Собираем системную статистику
      const stats = await this.collectSystemStats();
      
      // Сохраняем в Redis с временной меткой
      const timestamp = new Date().toISOString();
      const redisKey = `analytics:system_stats:${timestamp.split('T')[0]}`;
      
      await redis.hset(redisKey, timestamp, JSON.stringify(stats));
      await redis.expire(redisKey, 30 * 24 * 60 * 60); // 30 дней
      
      // Кэшируем последнюю статистику
      this.statsCache.set('latest_system_stats', { stats, timestamp });
      
      logger.debug('System stats collected and cached');
      
      return { success: true, stats, timestamp };
      
    } catch (error) {
      logger.error('Failed to collect system stats:', error);
      throw error;
    }
  }

  private async collectSystemStats() {
    const [
      totalUsers,
      activeUsers,
      totalTasks,
      activeTasks,
      totalExecutions,
      completedExecutions,
      totalTransactions,
      totalBalance
    ] = await Promise.all([
      User.count(),
      User.count({ where: { isActive: true, isBanned: false } }),
      Task.count(),
      Task.count({ where: { status: 'active' } }),
      TaskExecution.count(),
      TaskExecution.count({ where: { status: ['completed', 'auto_approved'] } }),
      Transaction.count({ where: { status: 'completed' } }),
      User.sum('balance')
    ]);

    return {
      users: {
        total: totalUsers,
        active: activeUsers,
        inactive: totalUsers - activeUsers
      },
      tasks: {
        total: totalTasks,
        active: activeTasks,
        completed: totalTasks - activeTasks
      },
      executions: {
        total: totalExecutions,
        completed: completedExecutions,
        pending: totalExecutions - completedExecutions
      },
      transactions: {
        total: totalTransactions
      },
      economy: {
        totalBalance: totalBalance || 0,
        averageBalance: totalUsers > 0 ? Math.round((totalBalance || 0) / totalUsers) : 0
      }
    };
  }

  // Статические методы для добавления аналитических событий
  static async recordUserAction(userId: number, action: string, metadata?: any) {
    return await analyticsQueue.add('process-analytics', {
      type: 'user_action',
      data: { action, metadata },
      userId
    }, { priority: 1 });
  }

  static async recordTaskEvent(taskId: number, event: string, value: number = 1) {
    return await analyticsQueue.add('process-analytics', {
      type: 'task_stats',
      data: { taskId, event, value }
    }, { priority: 2 });
  }

  static async collectSystemStats() {
    return await analyticsQueue.add('process-analytics', {
      type: 'system_stats',
      data: {}
    }, { priority: 3 });
  }

  // Методы для получения статистики
  async getUserActionStats(date: string) {
    const redisKey = `analytics:user_actions:${date}`;
    const stats = await redis.hgetall(redisKey);
    
    const result: any = { total: {}, users: {} };
    
    for (const [key, value] of Object.entries(stats)) {
      const count = parseInt(value as string, 10);
      
      if (key.startsWith('total:')) {
        const action = key.replace('total:', '');
        result.total[action] = count;
      } else if (key.startsWith('user:')) {
        const [, userId, action] = key.split(':');
        if (!result.users[userId]) {
          result.users[userId] = {};
        }
        result.users[userId][action] = count;
      }
    }
    
    return result;
  }

  async getTaskStats(taskId: number, date: string) {
    const redisKey = `analytics:task:${taskId}:${date}`;
    const stats = await redis.hgetall(redisKey);
    
    const result: any = {};
    for (const [event, value] of Object.entries(stats)) {
      result[event] = parseInt(value as string, 10);
    }
    
    return result;
  }

  getLatestSystemStats() {
    return this.statsCache.get('latest_system_stats');
  }

  // Метод для остановки worker
  public async stop() {
    await analyticsQueue.close();
    logger.info('Analytics worker stopped');
  }
}

export default AnalyticsWorker;