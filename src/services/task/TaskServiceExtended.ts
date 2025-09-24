// src/services/task/TaskServiceExtended.ts
import { TaskService } from './TaskService';
import { TaskServiceAnalytics } from './TaskServiceAnalytics';
import { TaskServiceAdmin } from './TaskServiceAdmin';
import { UserService } from '../user';
import { TransactionService } from '../transaction';
import { NotificationService } from '../notification';
import { TelegramService } from '../telegram';

/**
 * Расширенный TaskService с аналитикой и административными функциями
 */
export class TaskServiceExtended extends TaskService {
  public analytics: TaskServiceAnalytics;
  public admin: TaskServiceAdmin;

  constructor(
    userService: UserService,
    transactionService: TransactionService,
    notificationService: NotificationService,
    telegramService: TelegramService
  ) {
    super(userService, transactionService, notificationService, telegramService);
    
    this.analytics = new TaskServiceAnalytics();
    this.admin = new TaskServiceAdmin();
  }

  /**
   * Получение задания по ID с дополнительной информацией
   */
  async getTaskById(
    taskId: number, 
    includeAnalytics: boolean = false
  ): Promise<{
    task: any;
    analytics?: any;
  }> {
    const task = await Task.findByPk(taskId, {
      include: [{ model: User, as: 'author' }]
    });

    if (!task) {
      throw new AppError('Task not found', 404);
    }

    const result: any = { task };

    if (includeAnalytics) {
      result.analytics = await this.analytics.getTaskAnalytics(taskId);
    }

    return result;
  }

  /**
   * Получение заданий пользователя с аналитикой
   */
  async getUserTasks(
    userId: number,
    includeStats: boolean = false
  ): Promise<{
    tasks: any[];
    stats?: any;
  }> {
    const tasks = await Task.findAll({
      where: { authorId: userId },
      order: [['createdAt', 'DESC']]
    });

    const result: any = { tasks };

    if (includeStats) {
      result.stats = await this.analytics.getUserTaskStats(userId);
    }

    return result;
  }

  /**
   * Получение выполнений пользователя с аналитикой
   */
  async getUserExecutions(
    userId: number,
    includeStats: boolean = false
  ): Promise<{
    executions: any[];
    stats?: any;
  }> {
    const executions = await TaskExecution.findAll({
      where: { userId },
      include: [{ model: Task, as: 'task' }],
      order: [['createdAt', 'DESC']]
    });

    const result: any = { executions };

    if (includeStats) {
      result.stats = await this.analytics.getUserExecutionStats(userId);
    }

    return result;
  }

  /**
   * Очистка истекших заданий
   */
  async cleanupExpiredTasks(): Promise<{
    expiredTasks: number;
    refundedAmount: number;
  }> {
    const expiredTasks = await Task.findAll({
      where: {
        status: 'active',
        expiresAt: { [Op.lte]: new Date() }
      }
    });

    let refundedAmount = 0;

    for (const task of expiredTasks) {
      if (task.frozenAmount > 0) {
        await this.userService.updateBalance(
          task.authorId,
          task.frozenAmount,
          -task.frozenAmount
        );
        refundedAmount += task.frozenAmount;
      }

      await task.update({
        status: 'expired',
        frozenAmount: 0
      });
    }

    logger.info(`Cleaned up ${expiredTasks.length} expired tasks, refunded ${refundedAmount} GRAM`);

    return {
      expiredTasks: expiredTasks.length,
      refundedAmount
    };
  }

  /**
   * Поиск заданий
   */
  async searchTasks(query: {
    text?: string;
    type?: TaskType;
    minReward?: number;
    maxReward?: number;
    authorId?: number;
    status?: TaskStatus;
    limit?: number;
    offset?: number;
  }): Promise<{
    tasks: any[];
    total: number;
    hasMore: boolean;
  }> {
    const whereConditions: any = {};
    const {
      text,
      type,
      minReward,
      maxReward,
      authorId,
      status,
      limit = 20,
      offset = 0
    } = query;

    if (text) {
      whereConditions[Op.or] = [
        { title: { [Op.iLike]: `%${text}%` } },
        { description: { [Op.iLike]: `%${text}%` } }
      ];
    }

    if (type) whereConditions.type = type;
    if (status) whereConditions.status = status;
    if (authorId) whereConditions.authorId = authorId;

    if (minReward || maxReward) {
      whereConditions.reward = {};
      if (minReward) whereConditions.reward[Op.gte] = minReward;
      if (maxReward) whereConditions.reward[Op.lte] = maxReward;
    }

    const { count, rows } = await Task.findAndCountAll({
      where: whereConditions,
      include: [{ model: User, as: 'author' }],
      limit,
      offset,
      order: [['createdAt', 'DESC']]
    });

    return {
      tasks: rows,
      total: count,
      hasMore: offset + limit < count
    };
  }

  /**
   * Отмена задания пользователем
   */
  async cancelTask(
    taskId: number,
    userId: number,
    reason?: string
  ): Promise<Task> {
    const task = await Task.findOne({
      where: {
        id: taskId,
        authorId: userId,
        status: { [Op.in]: ['active', 'paused'] }
      }
    });

    if (!task) {
      throw new AppError('Task not found or cannot be cancelled', 404);
    }

    // Возвращаем 90% средств (10% комиссия за отмену)
    const refundAmount = Math.floor(task.frozenAmount * 0.9);
    const cancellationFee = task.frozenAmount - refundAmount;

    await this.userService.updateBalance(
      userId,
      refundAmount,
      -task.frozenAmount
    );

    await task.update({
      status: 'cancelled',
      frozenAmount: 0
    });

    // Записываем транзакции
    await this.transactionService.createTransaction({
      userId,
      type: 'task_refund',
      amount: refundAmount,
      relatedTaskId: taskId,
      description: `Task cancellation refund (90%): ${task.title}`
    });

    await this.transactionService.createTransaction({
      userId,
      type: 'cancellation_fee',
      amount: -cancellationFee,
      relatedTaskId: taskId,
      description: `Task cancellation fee (10%): ${task.title}`
    });

    logger.info(`Task cancelled by user: ${taskId} by user ${userId}, refunded ${refundAmount} GRAM`);

    return task;
  }

  /**
   * Получение рекомендаций для пользователя
   */
  async getRecommendedTasks(
    userId: number,
    limit: number = 10
  ): Promise<Task[]> {
    const user = await this.userService.getById(userId);
    if (!user) {
      throw new AppError('User not found', 404);
    }

    // Получаем историю выполнений пользователя
    const userExecutions = await TaskExecution.findAll({
      where: { userId },
      include: [{ model: Task, as: 'task' }],
      limit: 50,
      order: [['createdAt', 'DESC']]
    });

    // Анализируем предпочтения по типам заданий
    const typePreferences = new Map();
    userExecutions.forEach(execution => {
      const taskType = execution.task!.type;
      typePreferences.set(
        taskType, 
        (typePreferences.get(taskType) || 0) + 1
      );
    });

    // Сортируем типы по предпочтениям
    const sortedTypes = Array.from(typePreferences.entries())
      .sort(([,a], [,b]) => b - a)
      .map(([type]) => type);

    // Получаем рекомендуемые задания
    const recommendations = await Task.findAll({
      where: {
        status: 'active',
        authorId: { [Op.ne]: userId },
        expiresAt: { [Op.gt]: new Date() },
        remainingExecutions: { [Op.gt]: 0 },
        ...(sortedTypes.length > 0 && {
          type: { [Op.in]: sortedTypes.slice(0, 3) }
        })
      },
      include: [{ model: User, as: 'author' }],
      limit: limit * 2, // Получаем больше для фильтрации
      order: [
        ['priority', 'DESC'],
        ['reward', 'DESC']
      ]
    });

    // Исключаем уже выполненные
    const executedTaskIds = new Set(
      userExecutions.map(e => e.taskId)
    );

    const filtered = recommendations
      .filter(task => !executedTaskIds.has(task.id))
      .slice(0, limit);

    return filtered;
  }

  /**
   * Расширенная статистика для дашборда
   */
  async getDashboardStats(userId: number): Promise<{
    user: {
      tasksCreated: number;
      tasksCompleted: number;
      totalEarned: number;
      totalSpent: number;
      level: string;
      nextLevelRequirement?: number;
    };
    recent: {
      recentTasks: Task[];
      recentExecutions: TaskExecution[];
    };
    trends: {
      dailyEarnings: Array<{ date: string; amount: number }>;
      taskTypeStats: Record<TaskType, number>;
    };
  }> {
    const [user, recentTasks, recentExecutions, userStats, executionStats] = await Promise.all([
      this.userService.getById(userId),
      Task.findAll({
        where: { authorId: userId },
        limit: 5,
        order: [['createdAt', 'DESC']]
      }),
      TaskExecution.findAll({
        where: { userId },
        include: [{ model: Task, as: 'task' }],
        limit: 5,
        order: [['createdAt', 'DESC']]
      }),
      this.analytics.getUserTaskStats(userId),
      this.analytics.getUserExecutionStats(userId)
    ]);

    if (!user) {
      throw new AppError('User not found', 404);
    }

    // Требования для следующего уровня
    const levelRequirements = {
      bronze: 10000,
      silver: 50000,
      gold: 100000,
      premium: null
    };

    const nextLevelRequirement = levelRequirements[user.level as keyof typeof levelRequirements];

    // Заработок за последние 30 дней по дням
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentTransactions = await this.transactionService.getTransactions({
      userId,
      type: 'task_reward',
      dateFrom: thirtyDaysAgo
    });

    const dailyEarnings = Array.from({ length: 30 }, (_, i) => {
      const date = new Date(thirtyDaysAgo);
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];
      
      const dayEarnings = recentTransactions
        .filter(t => t.createdAt.toISOString().split('T')[0] === dateStr)
        .reduce((sum, t) => sum + t.amount, 0);
      
      return { date: dateStr, amount: dayEarnings };
    });

    // Статистика по типам заданий
    const taskTypeStats = recentExecutions.reduce((acc, execution) => {
      const taskType = execution.task!.type as TaskType;
      acc[taskType] = (acc[taskType] || 0) + 1;
      return acc;
    }, {} as Record<TaskType, number>);

    return {
      user: {
        tasksCreated: userStats.totalTasks,
        tasksCompleted: executionStats.completedExecutions,
        totalEarned: user.totalEarned,
        totalSpent: user.totalSpent,
        level: user.level,
        nextLevelRequirement
      },
      recent: {
        recentTasks,
        recentExecutions
      },
      trends: {
        dailyEarnings,
        taskTypeStats
      }
    };
  }
}

// Импорты для использования в методах
import { Task, TaskExecution, User } from '../../database/models';
import { Op } from 'sequelize';
import { AppError } from '../../utils/errors';
import { logger } from '../../utils/logger';
import { TaskType, TaskStatus } from './types';