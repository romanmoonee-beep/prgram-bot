// src/jobs/queues/index.ts
import Queue from 'bull';
import { logger } from '../../utils/logger';
import { config } from '../../config';
import { TaskExecution, User, Task } from '../../database/models';
<<<<<<< HEAD
import { telegramService } from '../../services/telegram';
=======
import { telegramService } from '../../services/telegram/TelegramService';
>>>>>>> 9cc5691 (5-commit)

// Создание очередей
const taskCheckQueue = new Queue('task check', config.redis.url);
const notificationQueue = new Queue('notifications', config.redis.url);
const cleanupQueue = new Queue('cleanup', config.redis.url);

export class QueueManager {
  
  // Добавить задачу на проверку выполнения задания
  static async addTaskCheck(data: {
    taskExecutionId: number;
    userId: number;
    taskId: number;
    checkType: 'subscription' | 'membership' | 'reaction' | 'view';
    targetUrl: string;
  }, delay: number = 0) {
    return await taskCheckQueue.add('check-task-execution', data, {
      delay,
      attempts: 3,
      backoff: 'exponential'
    });
  }

  // Добавить задачу на отправку уведомления
  static async addNotification(data: {
    userId: number;
    message: string;
    type: 'info' | 'success' | 'warning' | 'error';
  }, delay: number = 0) {
    return await notificationQueue.add('send-notification', data, {
      delay,
      attempts: 2,
      backoff: 'fixed'
    });
  }

  // Добавить задачу на очистку данных
  static async addCleanupTask(data: {
    type: 'expired_tasks' | 'old_notifications' | 'inactive_checks';
  }) {
    return await cleanupQueue.add('cleanup-data', data, {
      attempts: 1
    });
  }

  // Инициализация обработчиков очередей
  static initialize() {
    this.setupTaskCheckProcessor();
    this.setupNotificationProcessor();
    this.setupCleanupProcessor();
    this.setupErrorHandlers();
    
    logger.info('✅ Queue Manager initialized');
  }

  private static setupTaskCheckProcessor() {
    taskCheckQueue.process('check-task-execution', async (job) => {
      const { taskExecutionId, userId, taskId, checkType, targetUrl } = job.data;
      
      try {
        logger.info(`Processing task check for execution ${taskExecutionId}`);

        const execution = await TaskExecution.findByPk(taskExecutionId, {
          include: [
            { model: Task, as: 'task' },
            { model: User, as: 'user' }
          ]
        });

        if (!execution) {
          throw new Error('Task execution not found');
        }

        if (!execution.canBeAutoChecked()) {
          logger.warn(`Task execution ${taskExecutionId} cannot be auto-checked`);
          return { success: false, reason: 'Cannot be auto-checked' };
        }

        // Увеличиваем счетчик попыток
        await execution.incrementAutoCheckAttempts();

        let checkResult = false;
        let resultDetails: any = {};

        // Выполняем проверку в зависимости от типа
        switch (checkType) {
          case 'subscription':
            checkResult = await telegramService.checkUserSubscription(userId, targetUrl);
            resultDetails = { type: 'subscription', targetUrl };
            break;
            
          case 'membership':
            checkResult = await telegramService.checkUserMembership(userId, targetUrl);
            resultDetails = { type: 'membership', targetUrl };
            break;
            
          case 'reaction':
            checkResult = await telegramService.checkUserReaction(userId, targetUrl);
            resultDetails = { type: 'reaction', targetUrl };
            break;
            
          case 'view':
            // Для просмотров считаем что задание выполнено (проверить реально нельзя)
            checkResult = true;
            resultDetails = { type: 'view', assumed: true };
            break;
        }

        // Сохраняем результат проверки
        execution.autoCheckResult = {
          ...resultDetails,
          timestamp: new Date().toISOString(),
          success: checkResult
        };

        if (checkResult) {
          // Задание выполнено успешно
          await execution.autoApprove();

          if (execution.user) {
            // Начисляем награду
            await execution.user.updateBalance(execution.rewardAmount, 'add');
            
            // Создаем транзакцию
            const { Transaction } = await import('../../database/models');
            await Transaction.createTaskReward(
              execution.user.id,
              execution.task!.id,
              execution.rewardAmount,
              (execution.user.balance || 0) - execution.rewardAmount
            );

            // Обновляем статистику
            await execution.task!.incrementConversions();
            execution.user.tasksCompleted = (execution.user.tasksCompleted || 0) + 1;
            await execution.user.save();

            // Помечаем как оплаченное
            await execution.markRewardPaid();

            // Добавляем уведомление в очередь
            await QueueManager.addNotification({
              userId: execution.user.id,
              message: `✅ Задание "${execution.task!.title}" выполнено! Получено ${execution.rewardAmount} GRAM`,
              type: 'success'
            });
          }

          logger.info(`Task execution ${taskExecutionId} auto-approved`);
          return { success: true, approved: true };

        } else {
          // Проверка не прошла
          if ((execution.autoCheckAttempts || 0) >= 3) {
            // Максимум попыток исчерпан - отклоняем
            await execution.reject('Автоматическая проверка не прошла после 3 попыток');
            
            if (execution.user) {
              await QueueManager.addNotification({
                userId: execution.user.id,
                message: `❌ Задание "${execution.task!.title}" отклонено: не прошло автоматическую проверку`,
                type: 'error'
              });
            }

            logger.warn(`Task execution ${taskExecutionId} rejected after max attempts`);
            return { success: true, rejected: true };
          } else {
            // Запланируем повторную проверку через 30 секунд
            await QueueManager.addTaskCheck(job.data, 30000);
            
            logger.info(`Task execution ${taskExecutionId} will be rechecked`);
            return { success: true, retrying: true };
          }
        }

      } catch (error) {
        logger.error(`Task check job failed for execution ${taskExecutionId}:`, error);
        throw error;
      }
    });
  }

  private static setupNotificationProcessor() {
    notificationQueue.process('send-notification', async (job) => {
      const { userId, message, type } = job.data;
      
      try {
        const user = await User.findByPk(userId);
        if (!user) {
          throw new Error('User not found');
        }

        // Отправляем уведомление через Telegram (если пользователь разрешил)
        const settings = user.notificationSettings as any || {};
        if (settings.systemMessages !== false) {
          // Здесь должна быть отправка через Telegram API
          // Пока просто логируем
          logger.info(`Notification sent to user ${userId}: ${message}`);
        }

        return { success: true };
      } catch (error) {
        logger.error(`Notification job failed for user ${userId}:`, error);
        throw error;
      }
    });
  }

  private static setupCleanupProcessor() {
    cleanupQueue.process('cleanup-data', async (job) => {
      const { type } = job.data;
      
      try {
        const { cleanupOldData } = await import('../../database/models');
        
        switch (type) {
          case 'expired_tasks':
            // Помечаем истекшие задания как expired
            await Task.update(
              { status: 'expired' },
              { where: { expiresAt: { [Op.lt]: new Date() }, status: 'active' } }
            );
            break;
            
          case 'old_notifications':
            await cleanupOldData();
            break;
            
          case 'inactive_checks':
            // Деактивируем старые неиспользуемые чеки
            const { Check } = await import('../../database/models');
            await Check.update(
              { isActive: false },
              { 
                where: { 
                  expiresAt: { [Op.lt]: new Date() },
                  isActive: true,
                  currentActivations: 0
                }
              }
            );
            break;
        }

        return { success: true, type };
      } catch (error) {
        logger.error(`Cleanup job failed for type ${type}:`, error);
        throw error;
      }
    });
  }

  private static setupErrorHandlers() {
    // Обработка ошибок для всех очередей
    [taskCheckQueue, notificationQueue, cleanupQueue].forEach(queue => {
      queue.on('error', (error) => {
        logger.error(`Queue ${queue.name} error:`, error);
      });

      queue.on('failed', (job, err) => {
        logger.error(`Queue ${queue.name} job ${job.id} failed:`, err);
      });

      queue.on('stalled', (job) => {
        logger.warn(`Queue ${queue.name} job ${job.id} stalled`);
      });
    });

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      logger.info('Shutting down queues gracefully...');
      await Promise.all([
        taskCheckQueue.close(),
        notificationQueue.close(),
        cleanupQueue.close()
      ]);
      logger.info('Queues shut down successfully');
    });
  }

  // Получить статистику очередей
  static async getQueueStats() {
    const stats = await Promise.all([
      taskCheckQueue.getJobCounts(),
      notificationQueue.getJobCounts(),
      cleanupQueue.getJobCounts()
    ]);

    return {
      taskCheck: stats[0],
      notification: stats[1],
      cleanup: stats[2]
    };
  }

  // Очистить завершенные задачи
  static async cleanCompletedJobs() {
    await Promise.all([
      taskCheckQueue.clean(24 * 60 * 60 * 1000, 'completed'), // 24 часа
      notificationQueue.clean(24 * 60 * 60 * 1000, 'completed'),
      cleanupQueue.clean(24 * 60 * 60 * 1000, 'completed')
    ]);
  }
}

// Экспорт для использования в других частях приложения
export { taskCheckQueue, notificationQueue, cleanupQueue };
<<<<<<< HEAD
export default QueueManager;
=======
export default QueueManager;
>>>>>>> 9cc5691 (5-commit)
