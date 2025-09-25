// src/jobs/workers/taskCheckWorker.ts
import { Job } from 'bull';
import { taskCheckQueue, TaskCheckJob } from '../queues';
import { TaskExecution, Task, User } from '../../database/models';
import { logger } from '../../utils/logger';
import { getTelegramService } from '../../services/telegram';
import { EXECUTION_STATUSES } from '../../utils/constants';

// Worker для проверки выполнения заданий
class TaskCheckWorker {
  constructor() {
    this.setupProcessor();
  }

  public setupProcessor() {
    // Настраиваем обработчик очереди
    taskCheckQueue.process('check-task-execution', 5, this.processTaskCheck.bind(this));
    
    logger.info('✅ Task check worker initialized');
  }

  public async processTaskCheck(job: Job<TaskCheckJob>) {
    const { taskExecutionId, userId, taskId, checkType, targetUrl } = job.data;
    
    try {
      // Получаем выполнение задания
      const execution = await TaskExecution.findByPk(taskExecutionId, {
        include: [
          {
            model: Task,
            as: 'task'
          },
          {
            model: User,
            as: 'user'
          }
        ]
      });

      if (!execution) {
        throw new Error(`Task execution ${taskExecutionId} not found`);
      }

      if (execution.status !== EXECUTION_STATUSES.PENDING) {
        logger.warn(`Task execution ${taskExecutionId} is not pending, skipping check`);
        return { success: false, reason: 'Not pending' };
      }

      // Выполняем проверку в зависимости от типа
      const checkResult = await this.performCheck(checkType, userId, targetUrl);
      
      // Обновляем количество попыток автопроверки
      await execution.incrementAutoCheckAttempts();
      
      if (checkResult.success) {
        // Автоматически принимаем задание
        await execution.autoApprove();
        
        // Начисляем награду
        if (execution.user) {
          await execution.user.updateBalance(execution.rewardAmount, 'add');
          await execution.markRewardPaid();
        }

        // Обновляем статистику задания
        if (execution.task) {
          await execution.task.incrementConversions();
        }

        logger.info(`Task execution ${taskExecutionId} auto-approved after successful check`);
        return { success: true, autoApproved: true };
        
      } else {
        // Если проверка не прошла, но это не последняя попытка
        if ((execution.autoCheckAttempts || 0) < 3) {
          // Откладываем повторную проверку на 30 минут
          const delay = 30 * 60 * 1000; // 30 минут
          await taskCheckQueue.add('check-task-execution', job.data, { delay });
          
          logger.info(`Task execution ${taskExecutionId} check failed, scheduled retry`);
          return { success: false, retry: true, reason: checkResult.error };
        } else {
          // Отправляем на ручную проверку
          execution.status = EXECUTION_STATUSES.IN_REVIEW;
          execution.autoCheckResult = {
            success: false,
            error: checkResult.error,
            attempts: execution.autoCheckAttempts,
            lastCheck: new Date()
          };
          await execution.save();
          
          logger.info(`Task execution ${taskExecutionId} sent for manual review after failed auto-checks`);
          return { success: false, manualReview: true, reason: checkResult.error };
        }
      }

    } catch (error) {
      logger.error(`Task check worker error for execution ${taskExecutionId}:`, error);
      throw error;
    }
  }

  public async performCheck(checkType: string, userId: number, targetUrl: string) {
    try {
      switch (checkType) {
        case 'subscription':
          return await this.checkSubscription(userId, targetUrl);
        case 'membership':
          return await this.checkMembership(userId, targetUrl);
        case 'reaction':
          return await this.checkReaction(userId, targetUrl);
        case 'view':
          return await this.checkView(userId, targetUrl);
        default:
          return { success: false, error: 'Unknown check type' };
      }
    } catch (error: any) {
      logger.error(`Check ${checkType} failed for user ${userId}:`, error);
      return { success: false, error: error.message };
    }
  }

  public async checkSubscription(userId: number, channelUrl: string) {
    try {
      // Извлекаем username из URL
      const username = this.extractUsername(channelUrl);
      if (!username) {
        return { success: false, error: 'Invalid channel URL' };
      }

      // Проверяем подписку через Telegram API
      const isSubscribed = await getTelegramService().checkUserSubscription(userId, username);
      
      return {
        success: isSubscribed,
        error: isSubscribed ? null : 'User is not subscribed to the channel'
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  public async checkMembership(userId: number, groupUrl: string) {
    try {
      // Извлекаем username из URL
      const username = this.extractUsername(groupUrl);
      if (!username) {
        return { success: false, error: 'Invalid group URL' };
      }

      // Проверяем членство в группе через Telegram API
      const isMember = await getTelegramService().checkUserMembership(userId, username);
      
      return {
        success: isMember,
        error: isMember ? null : 'User is not a member of the group'
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  public async checkReaction(userId: number, postUrl: string) {
    try {
      // Для проверки реакций нужны более сложные методы
      // Пока что считаем, что пользователь поставил реакцию
      // В реальности нужно использовать MTProto для получения реакций
      
      // Задержка для имитации проверки
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      return {
        success: true,
        error: null
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  public async checkView(userId: number, postUrl: string) {
    try {
      // Для проверки просмотров также нужны специальные методы
      // Пока что считаем задание выполненным
      
      // Задержка для имитации проверки
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      return {
        success: true,
        error: null
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  public extractUsername(url: string): string | null {
    const match = url.match(/t\.me\/([a-zA-Z0-9_]+)/);
    return match ? match[1] : null;
  }

  // Метод для остановки worker
  public async stop() {
    await taskCheckQueue.close();
    logger.info('Task check worker stopped');
  }
}

// Экспортируем инстанс worker
export const taskCheckWorker = new TaskCheckWorker();

export default taskCheckWorker;