// src/jobs/cron/index.ts
import { CronJob } from 'cron';
import { logger } from '../../utils/logger';
import { cleanupOldData } from '../../database/models';
import { TaskExecution, Task, User, Notification } from '../../database/models';
import { EXECUTION_STATUSES, TASK_STATUSES, TIME } from '../../utils/constants';

// Автоматическое принятие заданий через 24 часа
export const autoApproveTasksJob = new CronJob(
  '0 */10 * * * *', // Каждые 10 минут
  async () => {
    try {
      const twentyFourHoursAgo = new Date(Date.now() - TIME.TASK_AUTO_APPROVE);
      
      // Найти все выполнения заданий, которые ожидают проверки более 24 часов
      const executionsToApprove = await TaskExecution.findAll({
        where: {
          status: EXECUTION_STATUSES.IN_REVIEW,
          createdAt: {
            [require('sequelize').Op.lt]: twentyFourHoursAgo
          }
        },
        include: [
          {
            model: Task,
            as: 'task',
            include: [
              {
                model: User,
                as: 'author'
              }
            ]
          },
          {
            model: User,
            as: 'user'
          }
        ]
      });

      for (const execution of executionsToApprove) {
        await execution.autoApprove();
        
        // Начисляем награду пользователю
        if (execution.user) {
          await execution.user.updateBalance(execution.rewardAmount, 'add');
          await execution.markRewardPaid();
          
          // Создаем уведомление
          await Notification.createTaskCompleted(
            execution.userId,
            execution.task?.title || 'Задание',
            execution.rewardAmount
          );
        }

        // Обновляем статистику задания
        if (execution.task) {
          await execution.task.incrementConversions();
        }

        logger.info(`Auto-approved task execution ${execution.id} after 24h timeout`);
      }

      if (executionsToApprove.length > 0) {
        logger.info(`Auto-approved ${executionsToApprove.length} task executions`);
      }

    } catch (error) {
      logger.error('Auto-approve tasks job failed:', error);
    }
  },
  null,
  false,
  'Europe/Moscow'
);

// Деактивация истекших заданий
export const deactivateExpiredTasksJob = new CronJob(
  '0 0 * * * *', // Каждый час
  async () => {
    try {
      const now = new Date();
      
      const [updatedCount] = await Task.update(
        { status: TASK_STATUSES.EXPIRED },
        {
          where: {
            expiresAt: {
              [require('sequelize').Op.lt]: now
            },
            status: TASK_STATUSES.ACTIVE
          }
        }
      );

      if (updatedCount > 0) {
        logger.info(`Deactivated ${updatedCount} expired tasks`);
      }

    } catch (error) {
      logger.error('Deactivate expired tasks job failed:', error);
    }
  },
  null,
  false,
  'Europe/Moscow'
);

// Очистка старых данных
export const cleanupOldDataJob = new CronJob(
  '0 0 2 * * *', // Каждый день в 2:00
  async () => {
    try {
      logger.info('Starting daily cleanup...');
      
      const result = await cleanupOldData();
      
      logger.info('Daily cleanup completed:', result);
    } catch (error) {
      logger.error('Cleanup job failed:', error);
    }
  },
  null,
  false,
  'Europe/Moscow'
);

// Массив всех cron задач
export const cronJobs = [
  { name: 'autoApproveTasksJob', job: autoApproveTasksJob },
  { name: 'deactivateExpiredTasksJob', job: deactivateExpiredTasksJob },
  { name: 'cleanupOldDataJob', job: cleanupOldDataJob }
];

// Функция для запуска всех cron задач
export function startCronJobs() {
  try {
    cronJobs.forEach(({ name, job }) => {
      job.start();
      logger.info(`✅ Started cron job: ${name}`);
    });
    
    logger.info(`🕐 All ${cronJobs.length} cron jobs started successfully`);
  } catch (error) {
    logger.error('❌ Failed to start cron jobs:', error);
  }
}

// Функция для остановки всех cron задач
export function stopCronJobs() {
  try {
    cronJobs.forEach(({ name, job }) => {
      job.stop();
      logger.info(`🛑 Stopped cron job: ${name}`);
    });
    
    logger.info(`🕐 All ${cronJobs.length} cron jobs stopped successfully`);
  } catch (error) {
    logger.error('❌ Failed to stop cron jobs:', error);
  }
}

export default {
  startCronJobs,
  stopCronJobs,
  cronJobs
};