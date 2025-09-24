// src/jobs/queues/index.ts
import Queue from 'bull';
import Redis from 'ioredis';
import { logger } from '../../utils/logger';
import { config } from '../../config';

// Создание Redis подключения для очередей
const redis = new Redis(config.redis.url, {
  retryDelayOnFailover: 100,
  maxRetriesPerRequest: 3,
  lazyConnect: true
});

// Конфигурация очередей
const queueConfig = {
  redis: {
    port: redis.options.port,
    host: redis.options.host,
    password: redis.options.password,
    db: redis.options.db || 0
  },
  defaultJobOptions: {
    removeOnComplete: 50, // Оставлять последние 50 завершенных заданий
    removeOnFail: 100,    // Оставлять последние 100 неудачных заданий
    attempts: 3,          // Количество попыток
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
  },
  settings: {
    stalledInterval: 30 * 1000,    // 30 секунд
    maxStalledCount: 1,
    retryProcessDelay: 5 * 1000,   // 5 секунд
  }
};

// Создание очередей
export const taskCheckQueue = new Queue('task-check', queueConfig);
export const notificationQueue = new Queue('notifications', queueConfig);
export const telegramApiQueue = new Queue('telegram-api', queueConfig);
export const analyticsQueue = new Queue('analytics', queueConfig);
export const cleanupQueue = new Queue('cleanup', queueConfig);
export const emailQueue = new Queue('email', queueConfig);

// Типы заданий для очередей
export interface TaskCheckJob {
  taskExecutionId: number;
  userId: number;
  taskId: number;
  checkType: 'subscription' | 'membership' | 'reaction' | 'view';
  targetUrl: string;
}

export interface NotificationJob {
  userId: number;
  type: string;
  title: string;
  message: string;
  data?: Record<string, any>;
  priority?: number;
}

export interface TelegramApiJob {
  action: 'send_message' | 'check_subscription' | 'get_chat_member' | 'get_chat';
  data: Record<string, any>;
  userId?: number;
  chatId?: number;
}

export interface AnalyticsJob {
  type: 'user_action' | 'task_stats' | 'system_stats';
  data: Record<string, any>;
  userId?: number;
}

export interface CleanupJob {
  type: 'old_data' | 'temp_files' | 'expired_sessions';
  olderThan?: Date;
}

// Добавление заданий в очереди
export class QueueManager {
  // Добавить задание на проверку выполнения
  static async addTaskCheck(job: TaskCheckJob, delay?: number) {
    return await taskCheckQueue.add('check-task-execution', job, {
      delay,
      priority: 5,
      attempts: 3
    });
  }

  // Добавить уведомление
  static async addNotification(job: NotificationJob, delay?: number) {
    const priority = job.priority || 1;
    return await notificationQueue.add('send-notification', job, {
      delay,
      priority: priority * 10, // Bull использует более высокие числа для высокого приоритета
      attempts: 2
    });
  }

  // Добавить Telegram API запрос
  static async addTelegramApi(job: TelegramApiJob, delay?: number) {
    return await telegramApiQueue.add('telegram-request', job, {
      delay,
      priority: 8,
      attempts: 5,
      backoff: {
        type: 'exponential',
        delay: 1000,
      }
    });
  }

  // Добавить аналитику
  static async addAnalytics(job: AnalyticsJob, delay?: number) {
    return await analyticsQueue.add('process-analytics', job, {
      delay,
      priority: 1,
      attempts: 2
    });
  }

  // Добавить задание очистки
  static async addCleanup(job: CleanupJob, delay?: number) {
    return await cleanupQueue.add('cleanup-data', job, {
      delay,
      priority: 2,
      attempts: 1
    });
  }

  // Получить статистику очередей
  static async getQueueStats() {
    const queues = [
      { name: 'task-check', queue: taskCheckQueue },
      { name: 'notifications', queue: notificationQueue },
      { name: 'telegram-api', queue: telegramApiQueue },
      { name: 'analytics', queue: analyticsQueue },
      { name: 'cleanup', queue: cleanupQueue }
    ];

    const stats = await Promise.all(
      queues.map(async ({ name, queue }) => {
        const [waiting, active, completed, failed, delayed] = await Promise.all([
          queue.getWaiting(),
          queue.getActive(),
          queue.getCompleted(),
          queue.getFailed(),
          queue.getDelayed()
        ]);

        return {
          name,
          waiting: waiting.length,
          active: active.length,
          completed: completed.length,
          failed: failed.length,
          delayed: delayed.length
        };
      })
    );

    return stats;
  }

  // Очистить все очереди
  static async clearAllQueues() {
    const queues = [taskCheckQueue, notificationQueue, telegramApiQueue, analyticsQueue, cleanupQueue];
    
    await Promise.all(
      queues.map(async (queue) => {
        await queue.empty();
        await queue.clean(0, 'completed');
        await queue.clean(0, 'failed');
      })
    );
    
    logger.info('All queues cleared');
  }

  // Остановить все очереди
  static async closeAllQueues() {
    const queues = [taskCheckQueue, notificationQueue, telegramApiQueue, analyticsQueue, cleanupQueue];
    
    await Promise.all(
      queues.map(queue => queue.close())
    );
    
    await redis.quit();
    logger.info('All queues closed');
  }
}

// Настройка обработчиков событий для мониторинга
function setupQueueEventHandlers(queue: Queue.Queue, name: string) {
  queue.on('completed', (job, result) => {
    logger.debug(`Queue ${name}: Job ${job.id} completed`, { result });
  });

  queue.on('failed', (job, err) => {
    logger.error(`Queue ${name}: Job ${job.id} failed`, { error: err.message, jobData: job.data });
  });

  queue.on('stalled', (job) => {
    logger.warn(`Queue ${name}: Job ${job.id} stalled`);
  });

  queue.on('error', (error) => {
    logger.error(`Queue ${name} error:`, error);
  });
}

// Настройка обработчиков событий для всех очередей
setupQueueEventHandlers(taskCheckQueue, 'task-check');
setupQueueEventHandlers(notificationQueue, 'notifications');
setupQueueEventHandlers(telegramApiQueue, 'telegram-api');
setupQueueEventHandlers(analyticsQueue, 'analytics');
setupQueueEventHandlers(cleanupQueue, 'cleanup');

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('Gracefully closing queues...');
  await QueueManager.closeAllQueues();
});

process.on('SIGINT', async () => {
  logger.info('Gracefully closing queues...');
  await QueueManager.closeAllQueues();
});

export default QueueManager;