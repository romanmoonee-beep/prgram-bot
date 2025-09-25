// src/jobs/workers/notificationWorker.ts
import { Job } from 'bull';
import { Bot } from 'grammy';
import { notificationQueue, NotificationJob } from '../queues';
import { User, Notification } from '../../database/models';
import { logger } from '../../utils/logger';
import { formatNotification } from '../../utils/formatters/init';

// Worker для отправки уведомлений
class NotificationWorker {
  public bot: Bot;

  constructor(bot: Bot) {
    this.bot = bot;
    this.setupProcessor();
  }

  public setupProcessor() {
    // Настраиваем обработчик очереди с приоритетами
    notificationQueue.process('send-notification', 10, this.processNotification.bind(this));
    
    logger.info('✅ Notification worker initialized');
  }

  private async processNotification(job: Job<NotificationJob>) {
    const { userId, type, title, message, data, priority } = job.data;
    
    try {
      // Получаем пользователя
      const user = await User.findByPk(userId);
      if (!user) {
        throw new Error(`User ${userId} not found`);
      }

      // Проверяем, активен ли пользователь и не заблокирован ли
      if (!user.isActive || user.isBanned) {
        logger.warn(`Skipping notification for inactive/banned user ${userId}`);
        return { success: false, reason: 'User inactive or banned' };
      }

      // Проверяем настройки уведомлений пользователя
      if (!this.shouldSendNotification(user, type)) {
        logger.debug(`Notification ${type} disabled for user ${userId}`);
        return { success: false, reason: 'Notifications disabled' };
      }

      // Создаем запись в базе данных
      const notification = await Notification.create({
        userId,
        type,
        title,
        message,
        data,
        priority: priority || 1
      });

      // Форматируем сообщение для отправки
      const formattedMessage = formatNotification(type, title, message, data);

      // Отправляем уведомление через Telegram
      const success = await this.sendTelegramNotification(user.telegramId, formattedMessage, data);

      if (success) {
        logger.info(`Notification sent to user ${userId}: ${title}`);
        return { success: true, notificationId: notification.id };
      } else {
        logger.warn(`Failed to send Telegram notification to user ${userId}`);
        return { success: false, reason: 'Telegram send failed' };
      }

    } catch (error) {
      logger.error(`Notification worker error for user ${userId}:`, error);
      throw error;
    }
  }

  public async sendTelegramNotification(telegramId: number, message: string, data?: any): Promise<boolean> {
    try {
      const options: any = {
        parse_mode: 'Markdown',
        disable_web_page_preview: true
      };

      // Добавляем кнопки, если есть URL действия
      if (data?.actionUrl) {
        options.reply_markup = {
          inline_keyboard: [[
            { text: '🔗 Перейти', url: data.actionUrl }
          ]]
        };
      }

      await this.bot.api.sendMessage(telegramId, message, options);
      return true;
    } catch (error: any) {
      // Проверяем, заблокирован ли бот пользователем
      if (error.error_code === 403) {
        logger.warn(`Bot blocked by user ${telegramId}`);
        // Можно деактивировать пользователя или пометить, что бот заблокирован
      } else {
        logger.error(`Telegram API error for user ${telegramId}:`, error);
      }
      return false;
    }
  }

  public shouldSendNotification(user: User, type: string): boolean {
    const settings = user.notificationSettings as any;
    
    if (!settings || typeof settings !== 'object') {
      return true; // По умолчанию отправляем все уведомления
    }

    // Маппинг типов уведомлений к настройкам
    const settingsMap: { [key: string]: string } = {
      'task_completed': 'taskCompleted',
      'task_created': 'taskCreated',
      'referral_joined': 'referralJoined',
      'balance_low': 'balanceUpdates',
      'level_up': 'balanceUpdates',
      'check_received': 'balanceUpdates',
      'system': 'systemMessages'
    };

    const settingKey = settingsMap[type];
    if (!settingKey) {
      return true; // Если тип неизвестен, отправляем
    }

    return settings[settingKey] !== false;
  }

  // Статические методы для быстрого добавления уведомлений
  static async sendTaskCompleted(userId: number, taskTitle: string, reward: number) {
    await notificationQueue.add('send-notification', {
      userId,
      type: 'task_completed',
      title: 'Задание выполнено!',
      message: `Задание "${taskTitle}" выполнено успешно.`,
      data: { reward },
      priority: 2
    });
  }

  static async sendReferralJoined(userId: number, referralName: string, bonus: number) {
    await notificationQueue.add('send-notification', {
      userId,
      type: 'referral_joined',
      title: 'Новый реферал!',
      message: `${referralName} присоединился по вашей ссылке.`,
      data: { bonus },
      priority: 2
    });
  }

  static async sendLevelUp(userId: number, newLevel: string) {
    const levelNames: { [key: string]: string } = {
      'bronze': 'Бронза',
      'silver': 'Серебро',
      'gold': 'Золото',
      'premium': 'Премиум'
    };

    await notificationQueue.add('send-notification', {
      userId,
      type: 'level_up',
      title: 'Повышение уровня!',
      message: `Поздравляем! Вы достигли уровня ${levelNames[newLevel] || newLevel}.`,
      data: { newLevel },
      priority: 2
    });
  }

  static async sendBalanceLow(userId: number, currentBalance: number) {
    await notificationQueue.add('send-notification', {
      userId,
      type: 'balance_low',
      title: 'Низкий баланс',
      message: `Ваш баланс составляет ${currentBalance} GRAM. Рекомендуем пополнить для продолжения работы.`,
      priority: 3
    });
  }

  static async sendSystemMessage(userId: number, title: string, message: string, priority: number = 1) {
    await notificationQueue.add('send-notification', {
      userId,
      type: 'system',
      title,
      message,
      priority
    });
  }

  static async sendCheckReceived(userId: number, amount: number, checkCode: string) {
    await notificationQueue.add('send-notification', {
      userId,
      type: 'check_received',
      title: 'Чек получен!',
      message: `Вы получили чек на ${amount} GRAM.`,
      data: { amount, checkCode },
      priority: 2
    });
  }

  // Массовая отправка уведомлений
  static async sendBulkNotification(userIds: number[], title: string, message: string, priority: number = 1) {
    const jobs = userIds.map(userId => ({
      userId,
      type: 'system',
      title,
      message,
      priority
    }));

    await notificationQueue.addBulk(
      jobs.map(job => ({
        name: 'send-notification',
        data: job,
        opts: { priority: priority * 10 }
      }))
    );

    logger.info(`Bulk notification scheduled for ${userIds.length} users`);
  }

  // Метод для остановки worker
  public async stop() {
    await notificationQueue.close();
    logger.info('Notification worker stopped');
  }
}

// Экспорт класса для инициализации с ботом
export default NotificationWorker;