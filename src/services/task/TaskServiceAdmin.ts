// src/services/task/TaskServiceAdmin.ts
import { Transaction, Op } from 'sequelize';
import { Task, TaskExecution, User } from '../../database/models';
import { ExecutionStatus, TaskStatus, TaskExecutionFilters } from './types';
import { AppError } from '../../utils/errors';
import { logger } from '../../utils/logger';

export class TaskServiceAdmin {
  /**
   * Получение заданий на модерацию
   */
  async getTasksForModeration(
    filters: {
      status?: ExecutionStatus[];
      limit?: number;
      offset?: number;
      sortBy?: 'created_at' | 'updated_at';
      sortOrder?: 'ASC' | 'DESC';
    } = {}
  ): Promise<{
    executions: TaskExecution[];
    total: number;
    hasMore: boolean;
  }> {
    const {
      status = ['in_review'],
      limit = 20,
      offset = 0,
      sortBy = 'created_at',
      sortOrder = 'ASC'
    } = filters;

    const whereConditions = {
      status: { [Op.in]: status }
    };

    const { count, rows } = await TaskExecution.findAndCountAll({
      where: whereConditions,
      include: [
        {
          model: Task,
          as: 'task',
          include: [{ model: User, as: 'author' }]
        },
        { model: User, as: 'user' }
      ],
      limit,
      offset,
      order: [[sortBy, sortOrder]],
      distinct: true
    });

    return {
      executions: rows,
      total: count,
      hasMore: offset + limit < count
    };
  }

  /**
   * Принятие выполнения задания (админ)
   */
  async approveExecution(
    executionId: number,
    adminId: number,
    transaction?: Transaction
  ): Promise<TaskExecution> {
    return await this.executeInTransaction(transaction, async (t) => {
      const execution = await TaskExecution.findByPk(executionId, {
        include: [{
          model: Task,
          as: 'task',
          include: [{ model: User, as: 'author' }]
        }],
        transaction: t
      });

      if (!execution) {
        throw new AppError('Execution not found', 404);
      }

      if (execution.status !== 'in_review') {
        throw new AppError('Execution not in review status', 400);
      }

      await execution.update({
        status: 'completed',
        checkedAt: new Date(),
        checkedById: adminId,
        rewardPaid: true,
        rewardPaidAt: new Date()
      }, { transaction: t });

      // Логика завершения выполнения (начисления, уведомления и т.д.)
      await this.completeTaskExecution(execution, t);

      logger.info(`Execution approved by admin: ${executionId} by admin ${adminId}`);
      return execution;
    });
  }

  /**
   * Отклонение выполнения задания (админ)
   */
  async rejectExecution(
    executionId: number,
    adminId: number,
    reason: string,
    transaction?: Transaction
  ): Promise<TaskExecution> {
    return await this.executeInTransaction(transaction, async (t) => {
      const execution = await TaskExecution.findByPk(executionId, {
        include: [{ model: Task, as: 'task' }],
        transaction: t
      });

      if (!execution) {
        throw new AppError('Execution not found', 404);
      }

      if (execution.status !== 'in_review') {
        throw new AppError('Execution not in review status', 400);
      }

      await execution.update({
        status: 'rejected',
        checkedAt: new Date(),
        checkedById: adminId,
        rejectionReason: reason
      }, { transaction: t });

      // Отправляем уведомление пользователю
      // await this.notificationService.createNotification(...);

      logger.info(`Execution rejected by admin: ${executionId} by admin ${adminId}, reason: ${reason}`);
      return execution;
    });
  }

  /**
   * Массовое действие с выполнениями
   */
  async bulkActionExecutions(
    executionIds: number[],
    action: 'approve' | 'reject',
    adminId: number,
    reason?: string,
    transaction?: Transaction
  ): Promise<{
    successful: number[];
    failed: Array<{ id: number; error: string }>;
  }> {
    return await this.executeInTransaction(transaction, async (t) => {
      const successful: number[] = [];
      const failed: Array<{ id: number; error: string }> = [];

      for (const executionId of executionIds) {
        try {
          if (action === 'approve') {
            await this.approveExecution(executionId, adminId, t);
          } else {
            await this.rejectExecution(executionId, adminId, reason || 'Bulk rejection', t);
          }
          successful.push(executionId);
        } catch (error) {
          failed.push({
            id: executionId,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      logger.info(`Bulk action ${action} completed: ${successful.length} successful, ${failed.length} failed`);
      return { successful, failed };
    });
  }

  /**
   * Приостановка задания
   */
  async pauseTask(
    taskId: number,
    adminId: number,
    reason: string,
    transaction?: Transaction
  ): Promise<Task> {
    return await this.executeInTransaction(transaction, async (t) => {
      const task = await Task.findByPk(taskId, { transaction: t });
      
      if (!task) {
        throw new AppError('Task not found', 404);
      }

      if (task.status !== 'active') {
        throw new AppError('Only active tasks can be paused', 400);
      }

      await task.update({
        status: 'paused',
        pausedAt: new Date(),
        pausedReason: reason
      }, { transaction: t });

      // Уведомляем автора
      // await this.notificationService.createNotification(...);

      logger.info(`Task paused by admin: ${taskId} by admin ${adminId}, reason: ${reason}`);
      return task;
    });
  }

  /**
   * Возобновление задания
   */
  async resumeTask(
    taskId: number,
    adminId: number,
    transaction?: Transaction
  ): Promise<Task> {
    return await this.executeInTransaction(transaction, async (t) => {
      const task = await Task.findByPk(taskId, { transaction: t });
      
      if (!task) {
        throw new AppError('Task not found', 404);
      }

      if (task.status !== 'paused') {
        throw new AppError('Only paused tasks can be resumed', 400);
      }

      await task.update({
        status: 'active',
        pausedAt: null,
        pausedReason: null
      }, { transaction: t });

      // Уведомляем автора
      // await this.notificationService.createNotification(...);

      logger.info(`Task resumed by admin: ${taskId} by admin ${adminId}`);
      return task;
    });
  }

  /**
   * Принудительное завершение задания
   */
  async forceCompleteTask(
    taskId: number,
    adminId: number,
    reason: string,
    transaction?: Transaction
  ): Promise<Task> {
    return await this.executeInTransaction(transaction, async (t) => {
      const task = await Task.findByPk(taskId, { transaction: t });
      
      if (!task) {
        throw new AppError('Task not found', 404);
      }

      if (!['active', 'paused'].includes(task.status)) {
        throw new AppError('Task cannot be force completed', 400);
      }

      await task.update({
        status: 'completed',
        completedExecutions: task.totalExecutions,
        remainingExecutions: 0
      }, { transaction: t });

      // Возвращаем оставшиеся замороженные средства
      if (task.frozenAmount > 0) {
        // await this.userService.updateBalance(task.authorId, task.frozenAmount, -task.frozenAmount, t);
        await task.update({ frozenAmount: 0 }, { transaction: t });
      }

      logger.info(`Task force completed by admin: ${taskId} by admin ${adminId}, reason: ${reason}`);
      return task;
    });
  }

  /**
   * Получение подозрительной активности
   */
  async getSuspiciousActivity(): Promise<{
    suspiciousUsers: Array<{
      user: User;
      reasons: string[];
      metrics: {
        tasksPerDay: number;
        averageExecutionTime: number;
        successRate: number;
      };
    }>;
    suspiciousExecutions: Array<{
      execution: TaskExecution;
      reasons: string[];
    }>;
  }> {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // Подозрительные пользователи
    const recentExecutions = await TaskExecution.findAll({
      where: {
        createdAt: { [Op.gte]: sevenDaysAgo }
      },
      include: [{ model: User, as: 'user' }],
      order: [['userId'], ['createdAt', 'ASC']]
    });

    const userStats = new Map();
    recentExecutions.forEach(execution => {
      const userId = execution.userId;
      if (!userStats.has(userId)) {
        userStats.set(userId, {
          user: execution.user,
          executions: [],
          totalExecutions: 0,
          completedExecutions: 0
        });
      }
      
      const stats = userStats.get(userId);
      stats.executions.push(execution);
      stats.totalExecutions++;
      if (execution.status === 'completed') {
        stats.completedExecutions++;
      }
    });

    const suspiciousUsers = Array.from(userStats.values())
      .map(stats => {
        const reasons: string[] = [];
        const tasksPerDay = stats.totalExecutions / 7;
        const successRate = (stats.completedExecutions / stats.totalExecutions) * 100;
        
        // Вычисляем среднее время выполнения
        const completedWithTime = stats.executions.filter((e: TaskExecution) => 
          e.status === 'completed' && e.startedAt && e.completedAt
        );
        
        const averageExecutionTime = completedWithTime.length > 0 
          ? completedWithTime.reduce((sum: number, e: TaskExecution) => {
              const timeMs = e.completedAt!.getTime() - e.startedAt!.getTime();
              return sum + (timeMs / 1000 / 60); // В минутах
            }, 0) / completedWithTime.length
          : 0;

        // Проверяем подозрительные паттерны
        if (tasksPerDay > 50) {
          reasons.push('Слишком много заданий в день');
        }
        
        if (averageExecutionTime < 0.5 && averageExecutionTime > 0) {
          reasons.push('Слишком быстрое выполнение заданий');
        }
        
        if (successRate === 100 && stats.totalExecutions > 10) {
          reasons.push('100% успешность выполнения');
        }

        if (reasons.length > 0) {
          return {
            user: stats.user,
            reasons,
            metrics: {
              tasksPerDay: Math.round(tasksPerDay * 10) / 10,
              averageExecutionTime: Math.round(averageExecutionTime * 10) / 10,
              successRate: Math.round(successRate * 10) / 10
            }
          };
        }
        return null;
      })
      .filter(Boolean) as any[];

    // Подозрительные выполнения
    const suspiciousExecutions = await TaskExecution.findAll({
      where: {
        createdAt: { [Op.gte]: oneDayAgo },
        [Op.or]: [
          { 
            // Слишком быстрое выполнение
            startedAt: { [Op.not]: null },
            completedAt: { [Op.not]: null }
          }
        ]
      },
      include: [
        { model: Task, as: 'task' },
        { model: User, as: 'user' }
      ]
    });

    const suspiciousExecutionsList = suspiciousExecutions
      .map(execution => {
        const reasons: string[] = [];
        
        if (execution.startedAt && execution.completedAt) {
          const timeMs = execution.completedAt.getTime() - execution.startedAt.getTime();
          const timeMinutes = timeMs / 1000 / 60;
          
          if (timeMinutes < 0.5) {
            reasons.push('Слишком быстрое выполнение (< 30 секунд)');
          }
        }

        if (reasons.length > 0) {
          return { execution, reasons };
        }
        return null;
      })
      .filter(Boolean) as any[];

    return {
      suspiciousUsers,
      suspiciousExecutions: suspiciousExecutionsList
    };
  }

  /**
   * Получение детальной информации о выполнении
   */
  async getExecutionDetails(executionId: number): Promise<{
    execution: TaskExecution;
    relatedExecutions: TaskExecution[];
    userHistory: {
      totalExecutions: number;
      successRate: number;
      averageTime: number;
      recentActivity: TaskExecution[];
    };
  }> {
    const execution = await TaskExecution.findByPk(executionId, {
      include: [
        {
          model: Task,
          as: 'task',
          include: [{ model: User, as: 'author' }]
        },
        { model: User, as: 'user' }
      ]
    });

    if (!execution) {
      throw new AppError('Execution not found', 404);
    }

    // Связанные выполнения того же задания
    const relatedExecutions = await TaskExecution.findAll({
      where: {
        taskId: execution.taskId,
        id: { [Op.ne]: executionId }
      },
      include: [{ model: User, as: 'user' }],
      order: [['createdAt', 'DESC']],
      limit: 10
    });

    // История пользователя
    const userExecutions = await TaskExecution.findAll({
      where: { userId: execution.userId },
      order: [['createdAt', 'DESC']],
      limit: 50
    });

    const totalExecutions = userExecutions.length;
    const completedExecutions = userExecutions.filter(e => e.status === 'completed').length;
    const successRate = totalExecutions > 0 ? (completedExecutions / totalExecutions) * 100 : 0;

    const completedWithTime = userExecutions.filter(e => 
      e.status === 'completed' && e.startedAt && e.completedAt
    );
    
    const averageTime = completedWithTime.length > 0 
      ? completedWithTime.reduce((sum, e) => {
          const timeMs = e.completedAt!.getTime() - e.startedAt!.getTime();
          return sum + (timeMs / 1000 / 60); // В минутах
        }, 0) / completedWithTime.length
      : 0;

    return {
      execution,
      relatedExecutions,
      userHistory: {
        totalExecutions,
        successRate: Math.round(successRate * 10) / 10,
        averageTime: Math.round(averageTime * 10) / 10,
        recentActivity: userExecutions.slice(0, 10)
      }
    };
  }

  /**
   * Обновление статуса задания админом
   */
  async updateTaskStatus(
    taskId: number,
    status: TaskStatus,
    adminId: number,
    reason?: string,
    transaction?: Transaction
  ): Promise<Task> {
    return await this.executeInTransaction(transaction, async (t) => {
      const task = await Task.findByPk(taskId, { transaction: t });
      
      if (!task) {
        throw new AppError('Task not found', 404);
      }

      const oldStatus = task.status;
      await task.update({
        status,
        ...(reason && { pausedReason: reason })
      }, { transaction: t });

      logger.info(`Task status updated by admin: ${taskId} from ${oldStatus} to ${status} by admin ${adminId}`);
      return task;
    });
  }

  /**
   * Получение статистики модерации
   */
  async getModerationStats(period?: { from: Date; to: Date }): Promise<{
    pendingReviews: number;
    reviewsProcessed: number;
    averageReviewTime: number;
    approvalRate: number;
    topModerators: Array<{
      adminId: number;
      reviewsProcessed: number;
      approvalRate: number;
    }>;
  }> {
    const whereConditions: any = {};
    
    if (period) {
      whereConditions.createdAt = {
        [Op.gte]: period.from,
        [Op.lte]: period.to
      };
    }

    const pendingReviews = await TaskExecution.count({
      where: { status: 'in_review' }
    });

    const reviewedExecutions = await TaskExecution.findAll({
      where: {
        ...whereConditions,
        status: { [Op.in]: ['completed', 'rejected'] },
        checkedById: { [Op.not]: null }
      },
      attributes: ['status', 'checkedById', 'createdAt', 'checkedAt']
    });

    const reviewsProcessed = reviewedExecutions.length;
    const approvedReviews = reviewedExecutions.filter(e => e.status === 'completed').length;
    const approvalRate = reviewsProcessed > 0 ? (approvedReviews / reviewsProcessed) * 100 : 0;

    // Среднее время проверки
    const reviewsWithTime = reviewedExecutions.filter(e => e.checkedAt && e.createdAt);
    const averageReviewTime = reviewsWithTime.length > 0
      ? reviewsWithTime.reduce((sum, e) => {
          const timeMs = e.checkedAt!.getTime() - e.createdAt.getTime();
          return sum + (timeMs / 1000 / 60 / 60); // В часах
        }, 0) / reviewsWithTime.length
      : 0;

    // Топ модераторы
    const moderatorStats = new Map();
    reviewedExecutions.forEach(execution => {
      const adminId = execution.checkedById!;
      if (!moderatorStats.has(adminId)) {
        moderatorStats.set(adminId, { total: 0, approved: 0 });
      }
      const stats = moderatorStats.get(adminId);
      stats.total++;
      if (execution.status === 'completed') {
        stats.approved++;
      }
    });

    const topModerators = Array.from(moderatorStats.entries())
      .map(([adminId, stats]) => ({
        adminId,
        reviewsProcessed: stats.total,
        approvalRate: Math.round((stats.approved / stats.total) * 100 * 10) / 10
      }))
      .sort((a, b) => b.reviewsProcessed - a.reviewsProcessed)
      .slice(0, 10);

    return {
      pendingReviews,
      reviewsProcessed,
      averageReviewTime: Math.round(averageReviewTime * 10) / 10,
      approvalRate: Math.round(approvalRate * 10) / 10,
      topModerators
    };
  }

  /**
   * Автоматическое принятие просроченных заданий
   */
  async autoApproveExpiredExecutions(
    hoursThreshold: number = 24,
    transaction?: Transaction
  ): Promise<{
    processed: number;
    approved: number;
    errors: Array<{ executionId: number; error: string }>;
  }> {
    return await this.executeInTransaction(transaction, async (t) => {
      const expiredThreshold = new Date(Date.now() - hoursThreshold * 60 * 60 * 1000);
      
      const expiredExecutions = await TaskExecution.findAll({
        where: {
          status: 'in_review',
          createdAt: { [Op.lte]: expiredThreshold }
        },
        include: [{ model: Task, as: 'task' }],
        transaction: t
      });

      const processed = expiredExecutions.length;
      let approved = 0;
      const errors: Array<{ executionId: number; error: string }> = [];

      for (const execution of expiredExecutions) {
        try {
          await execution.update({
            status: 'auto_approved',
            checkedAt: new Date(),
            rewardPaid: true,
            rewardPaidAt: new Date()
          }, { transaction: t });

          await this.completeTaskExecution(execution, t);
          approved++;
          
          logger.info(`Auto-approved expired execution: ${execution.id}`);
        } catch (error) {
          errors.push({
            executionId: execution.id,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
          
          logger.error(`Failed to auto-approve execution ${execution.id}:`, error);
        }
      }

      return { processed, approved, errors };
    });
  }

  /**
   * Служебный метод для завершения выполнения задания
   */
  private async completeTaskExecution(
    execution: TaskExecution,
    transaction: Transaction
  ): Promise<void> {
    // Здесь должна быть логика завершения задания
    // Пока оставляем заглушку - в полной реализации нужно будет
    // подключить UserService, TransactionService и NotificationService
    logger.info(`Completing task execution: ${execution.id}`);
  }

  /**
   * Выполнение операции в транзакции
   */
  private async executeInTransaction<T>(
    transaction: Transaction | undefined,
    operation: (t: Transaction) => Promise<T>
  ): Promise<T> {
    if (transaction) {
      return await operation(transaction);
    }

    const { sequelize } = Task;
    return await sequelize.transaction(operation);
  }
}