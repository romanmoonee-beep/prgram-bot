// src/services/check/CheckService.ts
import { Transaction, Op } from 'sequelize';
import { Check, CheckActivation, User } from '../../database/models';
import { UserService } from '../user';
import { TransactionService } from '../transaction';
import { NotificationService } from '../notification';
import { TelegramService } from '../telegram';
import { 
  CheckType, 
  CheckStatus,
  CheckCreateData, 
  CheckActivateData,
  CheckFilters,
  CheckStats
} from './types';
import { AppError } from '../../utils/errors';
import { logger } from '../../utils/logger';
import { generateCheckCode, validatePassword, hashPassword } from '../../utils/helpers';

export class CheckService {
  constructor(
    private userService: UserService,
    private transactionService: TransactionService,
    private notificationService: NotificationService,
    private telegramService: TelegramService
  ) {}

  /**
   * Создание нового чека
   */
  async createCheck(
    creatorId: number,
    checkData: CheckCreateData,
    transaction?: Transaction
  ): Promise<Check> {
    return await this.executeInTransaction(transaction, async (t) => {
      // Получаем создателя чека
      const creator = await this.userService.getById(creatorId, t);
      if (!creator) {
        throw new AppError('Creator not found', 404);
      }

      // Валидируем данные чека
      await this.validateCheckData(checkData, creator);

      // Проверяем баланс создателя
      if (creator.balance < checkData.totalAmount) {
        throw new AppError('Insufficient balance', 400);
      }

      // Рассчитываем сумму на одну активацию
      const amountPerActivation = checkData.type === 'personal' 
        ? checkData.totalAmount 
        : Math.floor(checkData.totalAmount / checkData.maxActivations!);

      // Генерируем уникальный код чека
      const code = await this.generateUniqueCheckCode();

      // Хешируем пароль если есть
      const hashedPassword = checkData.password 
        ? await hashPassword(checkData.password) 
        : null;

      // Списываем средства с баланса создателя
      await this.userService.updateBalance(creatorId, -checkData.totalAmount, 0, t);

      // Создаем чек
      const check = await Check.create({
        creatorId,
        code,
        type: checkData.type,
        totalAmount: checkData.totalAmount,
        amountPerActivation,
        maxActivations: checkData.maxActivations || 1,
        currentActivations: 0,
        password: hashedPassword,
        requiredSubscription: checkData.requiredSubscription,
        targetUserId: checkData.targetUserId,
        comment: checkData.comment,
        imageUrl: checkData.imageUrl,
        isActive: true,
        expiresAt: checkData.expiresAt
      }, { transaction: t });

      // Создаем транзакцию
      await this.transactionService.createTransaction({
        userId: creatorId,
        type: 'check_creation',
        amount: -checkData.totalAmount,
        relatedCheckId: check.id,
        description: `Check creation: ${checkData.totalAmount} GRAM`,
        metadata: { checkCode: code, checkType: checkData.type }
      }, t);

      // Отправляем уведомление создателю
      await this.notificationService.createNotification({
        userId: creatorId,
        type: 'check_created',
        title: 'Check Created Successfully',
        message: `Your check for ${checkData.totalAmount} GRAM has been created`,
        data: { 
          checkId: check.id, 
          code, 
          amount: checkData.totalAmount 
        },
        priority: 2
      }, t);

      logger.info(`Check created: ${check.id} by user ${creatorId}, amount: ${checkData.totalAmount}`);
      return check;
    });
  }

  /**
   * Активация чека пользователем
   */
  async activateCheck(
    userId: number,
    activateData: CheckActivateData,
    transaction?: Transaction
  ): Promise<{
    success: boolean;
    amount: number;
    check: Check;
    message: string;
  }> {
    return await this.executeInTransaction(transaction, async (t) => {
      // Находим чек по коду
      const check = await Check.findOne({
        where: { code: activateData.code },
        include: [{ model: User, as: 'creator' }],
        transaction: t
      });

      if (!check) {
        throw new AppError('Check not found', 404);
      }

      // Проверяем возможность активации
      await this.validateCheckActivation(check, userId, activateData, t);

      // Проверяем пароль если есть
      if (check.password && activateData.password) {
        const isPasswordValid = await validatePassword(activateData.password, check.password);
        if (!isPasswordValid) {
          throw new AppError('Invalid password', 400);
        }
      }

      // Проверяем подписку если требуется
      if (check.requiredSubscription) {
        const isSubscribed = await this.telegramService.checkSubscription(
          userId, 
          check.requiredSubscription
        );
        if (!isSubscribed) {
          throw new AppError('Required subscription not found', 400);
        }
      }

      // Начисляем средства пользователю
      await this.userService.updateBalance(userId, check.amountPerActivation, 0, t);

      // Создаем запись об активации
      const activation = await CheckActivation.create({
        checkId: check.id,
        userId,
        amount: check.amountPerActivation,
        activatedAt: new Date()
      }, { transaction: t });

      // Обновляем статистику чека
      await check.update({
        currentActivations: check.currentActivations + 1
      }, { transaction: t });

      // Если чек исчерпан, деактивируем его
      if (check.currentActivations + 1 >= check.maxActivations) {
        await check.update({ isActive: false }, { transaction: t });
      }

      // Создаем транзакцию получения
      await this.transactionService.createTransaction({
        userId,
        type: 'check_activation',
        amount: check.amountPerActivation,
        relatedCheckId: check.id,
        description: `Check activation: ${check.amountPerActivation} GRAM`,
        metadata: { checkCode: check.code, activationId: activation.id }
      }, t);

      // Уведомляем получателя
      await this.notificationService.createNotification({
        userId,
        type: 'check_activated',
        title: 'Check Activated!',
        message: `You received ${check.amountPerActivation} GRAM from check`,
        data: { 
          checkId: check.id, 
          amount: check.amountPerActivation,
          comment: check.comment 
        },
        priority: 2
      }, t);

      // Уведомляем создателя о активации
      await this.notificationService.createNotification({
        userId: check.creatorId,
        type: 'check_used',
        title: 'Your Check Was Activated',
        message: `Someone activated your check for ${check.amountPerActivation} GRAM`,
        data: { 
          checkId: check.id, 
          amount: check.amountPerActivation,
          remainingActivations: check.maxActivations - (check.currentActivations + 1)
        },
        priority: 1
      }, t);

      logger.info(`Check activated: ${check.id} by user ${userId}, amount: ${check.amountPerActivation}`);

      return {
        success: true,
        amount: check.amountPerActivation,
        check,
        message: check.comment || `You received ${check.amountPerActivation} GRAM!`
      };
    });
  }

  /**
   * Получение информации о чеке по коду
   */
  async getCheckInfo(
    code: string,
    userId?: number
  ): Promise<{
    check: Check;
    canActivate: boolean;
    requiresPassword: boolean;
    requiresSubscription: boolean;
    remainingActivations: number;
    creator: {
      username?: string;
      level: string;
    };
  }> {
    const check = await Check.findOne({
      where: { code },
      include: [{ model: User, as: 'creator', attributes: ['username', 'level'] }]
    });

    if (!check) {
      throw new AppError('Check not found', 404);
    }

    const remainingActivations = check.maxActivations - check.currentActivations;
    let canActivate = true;

    if (userId) {
      // Проверяем, может ли пользователь активировать чек
      try {
        await this.validateCheckActivation(check, userId, { code });
      } catch (error) {
        canActivate = false;
      }
    }

    return {
      check,
      canActivate,
      requiresPassword: !!check.password,
      requiresSubscription: !!check.requiredSubscription,
      remainingActivations,
      creator: {
        username: check.creator?.username,
        level: check.creator?.level || 'bronze'
      }
    };
  }

  /**
   * Получение чеков пользователя
   */
  async getUserChecks(
    userId: number,
    filters: CheckFilters = {}
  ): Promise<{
    checks: Check[];
    total: number;
    stats: {
      totalCreated: number;
      totalAmount: number;
      totalActivated: number;
      activeChecks: number;
    };
  }> {
    const {
      type,
      status,
      limit = 20,
      offset = 0,
      sortBy = 'created_at',
      sortOrder = 'DESC'
    } = filters;

    const whereConditions: any = { creatorId: userId };

    if (type) {
      whereConditions.type = type;
    }

    if (status === 'active') {
      whereConditions.isActive = true;
      whereConditions.expiresAt = { [Op.or]: [null, { [Op.gt]: new Date() }] };
    } else if (status === 'inactive') {
      whereConditions[Op.or] = [
        { isActive: false },
        { expiresAt: { [Op.lte]: new Date() } }
      ];
    }

    const { count, rows } = await Check.findAndCountAll({
      where: whereConditions,
      include: [{ 
        model: CheckActivation, 
        as: 'activations',
        include: [{ model: User, as: 'user', attributes: ['username'] }]
      }],
      limit,
      offset,
      order: [[sortBy, sortOrder]]
    });

    // Статистика пользователя
    const allUserChecks = await Check.findAll({
      where: { creatorId: userId },
      attributes: ['totalAmount', 'isActive', 'currentActivations']
    });

    const stats = {
      totalCreated: allUserChecks.length,
      totalAmount: allUserChecks.reduce((sum, check) => sum + check.totalAmount, 0),
      totalActivated: allUserChecks.reduce((sum, check) => sum + check.currentActivations, 0),
      activeChecks: allUserChecks.filter(check => check.isActive).length
    };

    return {
      checks: rows,
      total: count,
      stats
    };
  }

  /**
   * Получение активаций пользователя
   */
  async getUserActivations(
    userId: number,
    filters: {
      limit?: number;
      offset?: number;
      dateFrom?: Date;
      dateTo?: Date;
    } = {}
  ): Promise<{
    activations: CheckActivation[];
    total: number;
    totalEarned: number;
  }> {
    const {
      limit = 20,
      offset = 0,
      dateFrom,
      dateTo
    } = filters;

    const whereConditions: any = { userId };

    if (dateFrom || dateTo) {
      whereConditions.activatedAt = {};
      if (dateFrom) whereConditions.activatedAt[Op.gte] = dateFrom;
      if (dateTo) whereConditions.activatedAt[Op.lte] = dateTo;
    }

    const { count, rows } = await CheckActivation.findAndCountAll({
      where: whereConditions,
      include: [{
        model: Check,
        as: 'check',
        include: [{ model: User, as: 'creator', attributes: ['username'] }]
      }],
      limit,
      offset,
      order: [['activatedAt', 'DESC']]
    });

    const totalEarned = rows.reduce((sum, activation) => sum + activation.amount, 0);

    return {
      activations: rows,
      total: count,
      totalEarned
    };
  }

  /**
   * Деактивация чека создателем
   */
  async deactivateCheck(
    checkId: number,
    creatorId: number,
    transaction?: Transaction
  ): Promise<Check> {
    return await this.executeInTransaction(transaction, async (t) => {
      const check = await Check.findOne({
        where: { 
          id: checkId, 
          creatorId,
          isActive: true 
        },
        transaction: t
      });

      if (!check) {
        throw new AppError('Active check not found', 404);
      }

      // Рассчитываем неиспользованную сумму
      const remainingAmount = (check.maxActivations - check.currentActivations) * check.amountPerActivation;

      if (remainingAmount > 0) {
        // Возвращаем неиспользованные средства
        await this.userService.updateBalance(creatorId, remainingAmount, 0, t);

        // Создаем транзакцию возврата
        await this.transactionService.createTransaction({
          userId: creatorId,
          type: 'check_refund',
          amount: remainingAmount,
          relatedCheckId: checkId,
          description: `Check deactivation refund: ${remainingAmount} GRAM`,
          metadata: { checkCode: check.code }
        }, t);
      }

      await check.update({ isActive: false }, { transaction: t });

      logger.info(`Check deactivated: ${checkId} by creator ${creatorId}, refunded: ${remainingAmount}`);
      return check;
    });
  }

  /**
   * Получение статистики чеков платформы
   */
  async getPlatformStats(period?: { from: Date; to: Date }): Promise<CheckStats> {
    const whereConditions: any = {};
    
    if (period) {
      whereConditions.createdAt = {
        [Op.gte]: period.from,
        [Op.lte]: period.to
      };
    }

    const [checks, activations] = await Promise.all([
      Check.findAll({
        where: whereConditions,
        attributes: ['type', 'totalAmount', 'currentActivations', 'isActive']
      }),
      CheckActivation.findAll({
        where: period ? {
          activatedAt: {
            [Op.gte]: period.from,
            [Op.lte]: period.to
          }
        } : {},
        attributes: ['amount']
      })
    ]);

    const totalChecks = checks.length;
    const activeChecks = checks.filter(c => c.isActive).length;
    const totalVolume = checks.reduce((sum, c) => sum + c.totalAmount, 0);
    const totalActivations = activations.length;
    const totalDistributed = activations.reduce((sum, a) => sum + a.amount, 0);

    const checksByType = checks.reduce((acc, check) => {
      acc[check.type] = (acc[check.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalChecks,
      activeChecks,
      totalVolume,
      totalActivations,
      totalDistributed,
      averageCheckAmount: totalChecks > 0 ? totalVolume / totalChecks : 0,
      activationRate: totalChecks > 0 ? (totalActivations / totalChecks) * 100 : 0,
      checksByType
    };
  }

  /**
   * Валидация данных чека
   */
  private async validateCheckData(checkData: CheckCreateData, creator: User): Promise<void> {
    // Проверяем тип чека
    if (!Object.values(CheckType).includes(checkData.type)) {
      throw new AppError('Invalid check type', 400);
    }

    // Проверяем сумму
    if (checkData.totalAmount <= 0) {
      throw new AppError('Amount must be positive', 400);
    }

    const minAmount = 10;
    const maxAmount = 1000000;
    if (checkData.totalAmount < minAmount || checkData.totalAmount > maxAmount) {
      throw new AppError(`Amount must be between ${minAmount} and ${maxAmount} GRAM`, 400);
    }

    // Для мульти-чека проверяем количество активаций
    if (checkData.type === 'multi') {
      if (!checkData.maxActivations || checkData.maxActivations < 2 || checkData.maxActivations > 1000) {
        throw new AppError('Multi-check must have 2-1000 activations', 400);
      }

      if (checkData.totalAmount < checkData.maxActivations) {
        throw new AppError('Total amount must be at least equal to max activations', 400);
      }
    }

    // Для персонального чека проверяем целевого пользователя
    if (checkData.type === 'personal' && checkData.targetUserId) {
      const targetUser = await this.userService.getById(checkData.targetUserId);
      if (!targetUser) {
        throw new AppError('Target user not found', 404);
      }
    }

    // Проверяем срок действия
    if (checkData.expiresAt && checkData.expiresAt <= new Date()) {
      throw new AppError('Expiry date must be in the future', 400);
    }

    // Проверяем длину комментария
    if (checkData.comment && checkData.comment.length > 200) {
      throw new AppError('Comment cannot exceed 200 characters', 400);
    }
  }

  /**
   * Валидация возможности активации чека
   */
  private async validateCheckActivation(
    check: Check,
    userId: number,
    activateData: CheckActivateData,
    transaction?: Transaction
  ): Promise<void> {
    // Проверяем, активен ли чек
    if (!check.isActive) {
      throw new AppError('Check is not active', 400);
    }

    // Проверяем срок действия
    if (check.expiresAt && check.expiresAt <= new Date()) {
      throw new AppError('Check has expired', 400);
    }

    // Проверяем оставшиеся активации
    if (check.currentActivations >= check.maxActivations) {
      throw new AppError('No activations remaining', 400);
    }

    // Проверяем, не создатель ли пытается активировать свой чек
    if (check.creatorId === userId) {
      throw new AppError('Cannot activate your own check', 400);
    }

    // Для персонального чека проверяем целевого пользователя
    if (check.type === 'personal' && check.targetUserId && check.targetUserId !== userId) {
      throw new AppError('This check is not for you', 400);
    }

    // Проверяем, не активировал ли уже этот чек
    const existingActivation = await CheckActivation.findOne({
      where: {
        checkId: check.id,
        userId
      },
      transaction
    });

    if (existingActivation) {
      throw new AppError('Check already activated by this user', 400);
    }

    // Проверяем пароль
    if (check.password && !activateData.password) {
      throw new AppError('Password required', 400);
    }
  }

  /**
   * Генерация уникального кода чека
   */
  private async generateUniqueCheckCode(): Promise<string> {
    let attempts = 0;
    const maxAttempts = 10;

    while (attempts < maxAttempts) {
      const code = generateCheckCode();
      const existingCheck = await Check.findOne({ where: { code } });
      
      if (!existingCheck) {
        return code;
      }
      
      attempts++;
    }

    throw new AppError('Failed to generate unique check code', 500);
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

    const { sequelize } = Check;
    return await sequelize.transaction(operation);
  }
}