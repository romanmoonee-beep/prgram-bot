// src/jobs/workers/index.ts
import { Bot } from 'grammy';
import { logger } from '../../utils/logger';
import { taskCheckWorker } from './taskCheckWorker';
import NotificationWorker from './notificationWorker';
import TelegramApiWorker from './telegramApiWorker';
import AnalyticsWorker from './analyticsWorker';
import CleanupWorker from './cleanupWorker';

// Интерфейс для worker с методом stop
interface Worker {
  stop?: () => Promise<void>;
}

// Класс для управления всеми workers
export class WorkerManager {
  private notificationWorker!: NotificationWorker;
  private telegramApiWorker!: TelegramApiWorker;
  private analyticsWorker!: AnalyticsWorker;
  private cleanupWorker!: CleanupWorker;
  private workers: Worker[] = [];

  constructor(bot: Bot) {
    this.initializeWorkers(bot);
  }

  private initializeWorkers(bot: Bot) {
    try {
      // Инициализируем все workers
      this.notificationWorker = new NotificationWorker(bot);
      this.telegramApiWorker = new TelegramApiWorker(bot);
      this.analyticsWorker = new AnalyticsWorker();
      this.cleanupWorker = new CleanupWorker();

      // Сохраняем ссылки на всех workers
      this.workers = [
        taskCheckWorker,
        this.notificationWorker,
        this.telegramApiWorker,
        this.analyticsWorker,
        this.cleanupWorker
      ];

      logger.info('✅ All workers initialized successfully');
    } catch (error) {
      logger.error('❌ Failed to initialize workers:', error);
      throw error;
    }
  }

  // Метод для graceful shutdown всех workers
  async stopAllWorkers() {
    logger.info('🛑 Stopping all workers...');

    const stopPromises = this.workers.map(async (worker) => {
      try {
        if (worker && typeof worker.stop === 'function') {
          await worker.stop();
        }
      } catch (error) {
        logger.error('Error stopping worker:', error);
      }
    });

    await Promise.all(stopPromises);
    logger.info('✅ All workers stopped');
  }

  // Получить статус всех workers
  getWorkersStatus() {
    return {
      taskCheck: !!taskCheckWorker,
      notification: !!this.notificationWorker,
      telegramApi: !!this.telegramApiWorker,
      analytics: !!this.analyticsWorker,
      cleanup: !!this.cleanupWorker
    };
  }

  // Методы для доступа к конкретным workers
  getNotificationWorker(): NotificationWorker {
    return this.notificationWorker;
  }

  getTelegramApiWorker(): TelegramApiWorker {
    return this.telegramApiWorker;
  }

  getAnalyticsWorker(): AnalyticsWorker {
    return this.analyticsWorker;
  }

  getCleanupWorker(): CleanupWorker {
    return this.cleanupWorker;
  }

  getTaskCheckWorker() {
    return taskCheckWorker;
  }
}

// Экспортируем также отдельные классы workers
export { taskCheckWorker, NotificationWorker, TelegramApiWorker, AnalyticsWorker, CleanupWorker };

export default WorkerManager;