// src/services/notification/NotificationService.ts
import { Transaction as DBTransaction, Op } from 'sequelize';
import { Notification, User } from '../../database/models';
import { logger } from '../../utils/logger';

export class NotificationService {
  /**
   * Создание уведомления
   */
  async createNotification(data: {
    userId: number;
    type: string;
    title: string;
    message: string;
    data?: any;
    priority?: number;
  }, transaction?: DBTransaction): Promise<Notification> {
    return await Notification.create({
      userId: data.userId,
      type: data.type,
      title: data.title,
      message: data.message,
      data: data.data,
      priority: data.priority || 1,
      isRead: false
    }, { transaction });
  }

  /**
   * Создание уведомления о присоединении реферала
   */
  async createReferralJoined(
    userId: number,
    referralName: string,
    bonusAmount: number,
    transaction?: DBTransaction
  ): Promise<Notification> {
    return await this.createNotification({
      userId,
      type: 'referral_joined',
      title: 'Новый реферал!',
      message: `${referralName} присоединился по вашей ссылке. Вы получили ${bonusAmount} GRAM`,
      data: { referralName, bonusAmount },
      priority: 2
    }, transaction);
  }

  /**
   * Создание уведомления о завершении задания
   */
  async createTaskCompleted(
    userId: number,
    taskTitle: string,
    reward: number,
    transaction?: DBTransaction
  ): Promise<Notification> {
    return await this.createNotification({
      userId,
      type: 'task_completed',
      title: 'Задание выполнено!',
      message: `Вы получили ${reward} GRAM за "${taskTitle}"`,
      data: { taskTitle, reward },
      priority: 2
    }, transaction);
  }

  /**
   * Создание уведомления об активации чека
   */
  async createCheckActivated(
    userId: number,
    amount: number,
    activatorName: string,
    transaction?: DBTransaction
  ): Promise<Notification> {
    return await this.createNotification({
      userId,
      type: 'check_activated',
      title: 'Ваш чек активирован!',
      message: `${activatorName} активировал ваш чек на ${amount} GRAM`,
      data: { amount, activatorName },
      priority: 2
    }, transaction);
  }

  /**
   * Отметка уведомления как прочитанного
   */
  async markAsRead(notificationId: number): Promise<void> {
    await Notification.update(
      { isRead: true },
      { where: { id: notificationId } }
    );
  }

  /**
   * Отметка всех уведомлений пользователя как прочитанных
   */
  async markAllAsRead(userId: number): Promise<number> {
    const [updatedCount] = await Notification.update(
      { isRead: true },
      { where: { userId, isRead: false } }
    );
    return updatedCount;
  }

  /**
   * Получение уведомлений пользователя
   */
  async getNotifications(
    userId: number,
    limit: number = 20,
    offset: number = 0
  ): Promise<{ rows: Notification[]; count: number }> {
    return await Notification.findAndCountAll({
      where: { userId },
      order: [['createdAt', 'DESC']],
      limit,
      offset
    });
  }

  /**
   * Удаление старых уведомлений
   */
  async deleteOldNotifications(daysOld: number = 30): Promise<number> {
    const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);
    
    const deletedCount = await Notification.destroy({
      where: {
        createdAt: { [Op.lt]: cutoffDate },
        isRead: true
      }
    });

    logger.info(`Deleted ${deletedCount} old notifications`);
    return deletedCount;
  }
}