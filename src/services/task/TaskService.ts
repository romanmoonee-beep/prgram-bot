// src/services/task/TaskService.ts
import { Transaction, Op } from 'sequelize';
import { Task, User, TaskExecution } from '../../database/models';
import { UserService } from '../user';
import { TransactionService } from '../transaction';
import { NotificationService } from '../notification';
import { TelegramService } from '../telegram';
import { 
  TaskType, 
  TaskStatus, 
  UserLevel, 
  TaskCreateData, 
  TaskUpdateData,
  TaskFilters,
  ExecutionStatus
} from '../../types';
import { 
  TASK_LIMITS, 
  TASK_REWARDS, 
  COMMISSION_RATES, 
  TASK_PRIORITIES 
} from '../../utils/constants';
import { AppError } from '../../utils/errors';
import { logger } from '../../utils/logger';

export class TaskService {
  constructor(
    private userService: UserService,
    private transactionService: TransactionService,
    private notificationService: NotificationService,
    private telegramService: TelegramService
  ) {}

  /**
   * Создание нового задания
   */
  async createTask(
    authorId: number, 
    taskData: TaskCreateData, 
    transaction?: Transaction
  ): Promise<Task> {
    return await this.executeInTransaction(transaction, async (t) => {
      // Получаем автора задания
      const author = await this.userService.getById(authorId, t);
      if (!author) {
        throw new AppError('Author not found', 404);
      }

      // Валидируем данные задания
      await this.validateTaskData(taskData, author);

      // Проверяем лимиты создания заданий
      await this.checkTaskCreationLimits(author, t);

      // Рассчитываем стоимость
      const costCalculation = this.calculateTaskCost(taskData, author.level as UserLevel);
      
      // Проверяем достаточность баланса
      if (author.balance < costCalculation.totalCost) {
        throw new AppError('Insufficient balance', 400);
      }

      // Замораживаем средства
      await this.userService.updateBalance(
        authorId, 
        -costCalculation.totalCost, 
        costCalculation.totalCost, 
        t
      );

      // Создаем задание
      const task = await Task.create({
        authorId,
        type: taskData.type,
        title: taskData.title,
        description: taskData.description,
        targetUrl: taskData.targetUrl,
        reward: taskData.reward,
        totalExecutions: taskData.totalExecutions,
        completedExecutions: 0,
        remainingExecutions: taskData.totalExecutions,
        autoCheck: taskData.autoCheck ?? this.getDefaultAutoCheck(taskData.type),
        requireScreenshot: taskData.requireScreenshot ?? this.getDefaultScreenshotRequirement(taskData.type),
        priority: this.calculatePriority(author.level as UserLevel, taskData.isTopPromoted),
        isTopPromoted: taskData.isTopPromoted ?? false,
        conditions: taskData.conditions || {},
        requiredSubscriptions: taskData.requiredSubscriptions || [],
        minAccountAge: taskData.minAccountAge || 0,
        minLevel: taskData.minLevel || 'bronze',
        status: 'active',
        expiresAt: taskData.expiresAt || this.getDefaultExpiryDate(),
        totalCost: costCalculation.totalCost,
        spentAmount: 0,
        frozenAmount: costCalculation.totalCost,
        views: 0,
        clicks: 0,
        conversions: 0
      }, { transaction: t });

      // Записываем транзакцию
      await this.transactionService.createTransaction({
        userId: authorId,
        type: 'task_creation',
        amount: -costCalculation.totalCost,
        relatedTaskId: task.id,
        description: `Task creation: ${task.title}`,
        metadata: { costBreakdown: costCalculation }
      }, t);

      // Отправляем уведомление
      await this.notificationService.createNotification({
        userId: authorId,
        type: 'task_created',
        title: 'Task Created Successfully',
        message: `Your task "${task.title}" has been created and is now active`,
        data: { taskId: task.id },
        priority: 2
      }, t);

      logger.info(`Task created: ${task.id} by user ${authorId}`);
      return task;
    });
  }

  /**
   * Получение заданий с фильтрами
   */
  async getTasks(filters: TaskFilters = {}, userId?: number): Promise<{
    tasks: Task[];
    total: number;
    hasMore: boolean;
  }> {
    const {
      type,
      minReward,
      maxReward,
      userLevel = 'bronze',
      excludeCompleted = true,
      excludeAuthor = true,
      limit = 20,
      offset = 0,
      sortBy = 'priority',
      sortOrder = 'DESC'
    } = filters;

    const whereConditions: any = {
      status: 'active',
      expiresAt: { [Op.gt]: new Date() },
      remainingExecutions: { [Op.gt]: 0 }
    };

    // Фильтры
    if (type) {
      whereConditions.type = type;
    }

    if (minReward || maxReward) {
      whereConditions.reward = {};
      if (minReward) whereConditions.reward[Op.gte] = minReward;
      if (maxReward) whereConditions.reward[Op.lte] = maxReward;
    }

    // Исключаем задания автора
    if (excludeAuthor && userId) {
      whereConditions.authorId = { [Op.ne]: userId };
    }

    // Проверяем минимальный уровень
    const levelOrder = ['bronze', 'silver', 'gold', 'premium'];
    const userLevelIndex = levelOrder.indexOf(userLevel);
    const allowedLevels = levelOrder.slice(0, userLevelIndex + 1);
    whereConditions.minLevel = { [Op.in]: allowedLevels };

    // Исключаем уже выполненные пользователем задания
    if (excludeCompleted && userId) {
      const completedTaskIds = await TaskExecution.findAll({
        where: {
          userId,
          status: { [Op.in]: ['completed', 'in_review'] }
        },
        attributes: ['taskId'],
        raw: true
      });

      if (completedTaskIds.length > 0) {
        whereConditions.id = { 
          [Op.notIn]: completedTaskIds.map(t => t.taskId) 
        };
      }
    }

    const { count, rows } = await Task.findAndCountAll({
      where: whereConditions,
      include: [{
        model: User,
        as: 'author',
        attributes: ['id', 'username', 'level']
      }],
      limit,
      offset,
      order: [[sortBy, sortOrder]],
      distinct: true
    });

    return {
      tasks: rows,
      total: count,
      hasMore: offset + limit < count
    };
  }

  /**
   * Начало выполнения задания
   */
  async startTaskExecution(
    taskId: number, 
    userId: number,
    transaction?: Transaction
  ): Promise<TaskExecution> {
    return await this.executeInTransaction(transaction, async (t) => {
      const task = await Task.findByPk(taskId, {
        include: [{ model: User, as: 'author' }],
        transaction: t
      });

      if (!task) {
        throw new AppError('Task not found', 404);
      }

      // Валидация возможности выполнения
      await this.validateTaskExecution(task, userId, t);

      // Создаем выполнение
      const execution = await TaskExecution.create({
        taskId,
        userId,
        status: 'pending',
        rewardAmount: this.calculateUserReward(task.reward, userId),
        startedAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 часа
      }, { transaction: t });

      // Увеличиваем счетчик кликов
      await task.increment('clicks', { transaction: t });

      logger.info(`Task execution started: ${execution.id} for task ${taskId} by user ${userId}`);
      return execution;
    });
  }

  /**
   * Проверка выполнения задания
   */
  async checkTaskExecution(
    executionId: number,
    screenshotUrl?: string,
    comment?: string,
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

      if (execution.status !== 'pending') {
        throw new AppError('Execution already processed', 400);
      }

      const task = execution.task!;

      // Обновляем execution с данными
      await execution.update({
        screenshotUrl,
        comment,
        updatedAt: new Date()
      }, { transaction: t });

      // Автопроверка или отправка на ручную проверку
      if (task.autoCheck) {
        return await this.performAutoCheck(execution, t);
      } else {
        return await this.sendForManualReview(execution, t);
      }
    });
  }

  /**
   * Автоматическая проверка задания
   */
  private async performAutoCheck(
    execution: TaskExecution,
    transaction: Transaction
  ): Promise<TaskExecution> {
    try {
      const task = execution.task!;
      let checkResult = false;

      // Проверяем в зависимости от типа задания
      switch (task.type) {
        case 'subscribe':
          checkResult = await this.telegramService.checkSubscription(
            execution.userId,
            task.targetUrl
          );
          break;

        case 'join':
          checkResult = await this.telegramService.checkGroupMembership(
            execution.userId,
            task.targetUrl
          );
          break;

        case 'view':
          checkResult = true; // Просмотр поста считается выполненным автоматически
          break;

        case 'react':
          checkResult = await this.telegramService.checkReaction(
            execution.userId,
            task.targetUrl
          );
          break;

        default:
          // Для типа 'bot' всегда требуется ручная проверка
          return await this.sendForManualReview(execution, transaction);
      }

      await execution.update({
        status: checkResult ? 'completed' : 'rejected',
        checkedAt: new Date(),
        autoCheckAttempts: (execution.autoCheckAttempts || 0) + 1,
        autoCheckResult: { success: checkResult, checkedAt: new Date() }
      }, { transaction });

      if (checkResult) {
        await this.completeTaskExecution(execution, transaction);
      } else {
        await this.rejectTaskExecution(execution, 'Auto-check failed', transaction);
      }

      return execution;
    } catch (error) {
      logger.error('Auto-check error:', error);
      // При ошибке автопроверки отправляем на ручную проверку
      return await this.sendForManualReview(execution, transaction);
    }
  }

  /**
   * Отправка на ручную проверку
   */
  private async sendForManualReview(
    execution: TaskExecution,
    transaction: Transaction
  ): Promise<TaskExecution> {
    await execution.update({
      status: 'in_review',
      checkedAt: new Date()
    }, { transaction });

    const task = execution.task!;
    const author = task.author!;

    // Уведомляем автора о необходимости проверки
    await this.notificationService.createNotification({
      userId: author.id,
      type: 'task_review_required',
      title: 'Task Review Required',
      message: `Task "${task.title}" requires your review`,
      data: { 
        taskId: task.id, 
        executionId: execution.id 
      },
      priority: 3
    }, transaction);

    return execution;
  }

  /**
   * Завершение выполнения задания
   */
  private async completeTaskExecution(
    execution: TaskExecution,
    transaction: Transaction
  ): Promise<void> {
    const task = execution.task!;
    const rewardAmount = execution.rewardAmount;

    // Начисляем награду исполнителю
    await this.userService.updateBalance(execution.userId, rewardAmount, 0, transaction);

    // Уменьшаем замороженную сумму у автора
    const author = task.author!;
    await this.userService.updateBalance(author.id, 0, -rewardAmount, transaction);

    // Обновляем статистику задания
    await task.update({
      completedExecutions: task.completedExecutions + 1,
      remainingExecutions: task.remainingExecutions - 1,
      spentAmount: task.spentAmount + rewardAmount,
      frozenAmount: task.frozenAmount - rewardAmount,
      conversions: task.conversions + 1
    }, { transaction });

    // Записываем транзакции
    await this.transactionService.createTransaction({
      userId: execution.userId,
      type: 'task_reward',
      amount: rewardAmount,
      relatedTaskId: task.id,
      description: `Task completion reward: ${task.title}`
    }, transaction);

    await this.transactionService.createTransaction({
      userId: author.id,
      type: 'task_payment',
      amount: -rewardAmount,
      relatedTaskId: task.id,
      description: `Payment for task completion: ${task.title}`
    }, transaction);

    // Обновляем статистику пользователей
    await this.userService.incrementTasksCompleted(execution.userId, transaction);

    // Уведомляем исполнителя
    await this.notificationService.createNotification({
      userId: execution.userId,
      type: 'task_completed',
      title: 'Task Completed!',
      message: `You earned ${rewardAmount} GRAM for "${task.title}"`,
      data: { taskId: task.id, reward: rewardAmount },
      priority: 2
    }, transaction);

    // Проверяем, завершилось ли задание полностью
    if (task.remainingExecutions <= 0) {
      await this.completeTask(task, transaction);
    }
  }

  /**
   * Отклонение выполнения задания
   */
  private async rejectTaskExecution(
    execution: TaskExecution,
    reason: string,
    transaction: Transaction
  ): Promise<void> {
    await execution.update({
      rejectionReason: reason
    }, { transaction });

    // Уведомляем исполнителя
    await this.notificationService.createNotification({
      userId: execution.userId,
      type: 'task_rejected',
      title: 'Task Rejected',
      message: `Your submission was rejected: ${reason}`,
      data: { taskId: execution.taskId },
      priority: 2
    }, transaction);
  }

  /**
   * Завершение задания
   */
  private async completeTask(task: Task, transaction: Transaction): Promise<void> {
    await task.update({
      status: 'completed'
    }, { transaction });

    // Возвращаем оставшиеся замороженные средства
    if (task.frozenAmount > 0) {
      await this.userService.updateBalance(
        task.authorId, 
        task.frozenAmount, 
        -task.frozenAmount, 
        transaction
      );

      await this.transactionService.createTransaction({
        userId: task.authorId,
        type: 'task_refund',
        amount: task.frozenAmount,
        relatedTaskId: task.id,
        description: `Refund for completed task: ${task.title}`
      }, transaction);
    }

    // Уведомляем автора
    await this.notificationService.createNotification({
      userId: task.authorId,
      type: 'task_finished',
      title: 'Task Completed!',
      message: `Your task "${task.title}" has been fully completed`,
      data: { taskId: task.id },
      priority: 2
    }, transaction);
  }

  /**
   * Валидация данных задания
   */
  private async validateTaskData(taskData: TaskCreateData, author: User): Promise<void> {
    // Проверяем тип задания
    if (!Object.values(TaskType).includes(taskData.type)) {
      throw new AppError('Invalid task type', 400);
    }

    // Проверяем награду
    const rewardLimits = TASK_REWARDS[taskData.type];
    if (taskData.reward < rewardLimits.min || taskData.reward > rewardLimits.max) {
      throw new AppError(
        `Reward must be between ${rewardLimits.min} and ${rewardLimits.max} GRAM`,
        400
      );
    }

    // Проверяем количество выполнений
    const limits = TASK_LIMITS[author.level as UserLevel];
    if (taskData.totalExecutions < 10 || taskData.totalExecutions > 1000) {
      throw new AppError('Total executions must be between 10 and 1000', 400);
    }

    // Валидируем URL
    if (!this.validateTargetUrl(taskData.targetUrl, taskData.type)) {
      throw new AppError('Invalid target URL for this task type', 400);
    }
  }

  /**
   * Проверка лимитов создания заданий
   */
  private async checkTaskCreationLimits(
    author: User, 
    transaction: Transaction
  ): Promise<void> {
    const limits = TASK_LIMITS[author.level as UserLevel];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tasksToday = await Task.count({
      where: {
        authorId: author.id,
        createdAt: { [Op.gte]: today }
      },
      transaction
    });

    if (tasksToday >= limits.dailyTasks) {
      throw new AppError(
        `Daily task creation limit reached (${limits.dailyTasks})`,
        400
      );
    }
  }

  /**
   * Расчет стоимости задания
   */
  private calculateTaskCost(taskData: TaskCreateData, userLevel: UserLevel): {
    rewardsCost: number;
    commission: number;
    topPromotion: number;
    totalCost: number;
  } {
    const rewardsCost = taskData.reward * taskData.totalExecutions;
    const commissionRate = COMMISSION_RATES[userLevel];
    const commission = Math.ceil(rewardsCost * commissionRate);
    const topPromotion = taskData.isTopPromoted ? 50 : 0;
    
    return {
      rewardsCost,
      commission,
      topPromotion,
      totalCost: rewardsCost + commission + topPromotion
    };
  }

  /**
   * Расчет приоритета задания
   */
  private calculatePriority(userLevel: UserLevel, isTopPromoted: boolean): number {
    const basePriority = TASK_PRIORITIES[userLevel];
    return isTopPromoted ? basePriority + 10 : basePriority;
  }

  /**
   * Расчет награды для пользователя с учетом его уровня
   */
  private calculateUserReward(baseReward: number, userId: number): number {
    // Здесь можно добавить логику множителей по уровням
    // Пока возвращаем базовую награду
    return baseReward;
  }

  /**
   * Валидация URL для типа задания
   */
  private validateTargetUrl(url: string, taskType: TaskType): boolean {
    const telegramUrlRegex = /^https:\/\/t\.me\/(.+)$/;
    return telegramUrlRegex.test(url);
  }

  /**
   * Получение настроек автопроверки по умолчанию
   */
  private getDefaultAutoCheck(taskType: TaskType): boolean {
    return ['subscribe', 'join', 'view', 'react'].includes(taskType);
  }

  /**
   * Получение требования скриншота по умолчанию
   */
  private getDefaultScreenshotRequirement(taskType: TaskType): boolean {
    return taskType === 'bot';
  }

  /**
   * Получение даты истечения по умолчанию
   */
  private getDefaultExpiryDate(): Date {
    return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 дней
  }

  /**
   * Валидация возможности выполнения задания
   */
  private async validateTaskExecution(
    task: Task, 
    userId: number, 
    transaction: Transaction
  ): Promise<void> {
    // Проверяем статус задания
    if (task.status !== 'active') {
      throw new AppError('Task is not active', 400);
    }

    // Проверяем срок действия
    if (task.expiresAt && task.expiresAt < new Date()) {
      throw new AppError('Task has expired', 400);
    }

    // Проверяем оставшиеся выполнения
    if (task.remainingExecutions <= 0) {
      throw new AppError('No executions remaining', 400);
    }

    // Проверяем, не автор ли пытается выполнить свое задание
    if (task.authorId === userId) {
      throw new AppError('Cannot execute your own task', 400);
    }

    // Проверяем, не выполнял ли уже это задание
    const existingExecution = await TaskExecution.findOne({
      where: {
        taskId: task.id,
        userId,
        status: { [Op.in]: ['completed', 'in_review'] }
      },
      transaction
    });

    if (existingExecution) {
      throw new AppError('Task already executed by this user', 400);
    }

    // Проверяем минимальный возраст аккаунта
    if (task.minAccountAge > 0) {
      const user = await this.userService.getById(userId, transaction);
      if (!user) throw new AppError('User not found', 404);

      const accountAge = Math.floor(
        (Date.now() - user.registeredAt.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (accountAge < task.minAccountAge) {
        throw new AppError(
          `Account must be at least ${task.minAccountAge} days old`,
          400
        );
      }
    }

    // Проверяем минимальный уровень
    const user = await this.userService.getById(userId, transaction);
    if (!user) throw new AppError('User not found', 404);

    const levelOrder = ['bronze', 'silver', 'gold', 'premium'];
    const userLevelIndex = levelOrder.indexOf(user.level);
    const requiredLevelIndex = levelOrder.indexOf(task.minLevel);

    if (userLevelIndex < requiredLevelIndex) {
      throw new AppError(
        `Minimum level required: ${task.minLevel}`,
        400
      );
    }
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