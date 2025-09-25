// src/services/check/CheckService.ts - ИСПРАВЛЕННАЯ ВЕРСИЯ
import { Transaction as DBTransaction, Op } from 'sequelize';
import { Check, CheckActivation, User } from '../../database/models';
import { TransactionService } from '../transaction/TransactionService';
import { NotificationService } from '../notification/NotificationService';
import { generateCheckCode, validatePasswordHash, hashPassword } from '../../utils/helpers/init';
import { AppError } from '../../utils/errors';
import { logger } from '../../utils/logger';
import { sequelize } from '../../database/config/database';

export class CheckService {
  constructor(
    protected transactionService: TransactionService,
    protected notificationService: NotificationService
  ) {}

  /**
   * Создание чека
   */




  async createCheck(data: {
    creatorId: number;
    type: 'personal' | 'multi';
    totalAmount: number;
    maxActivations: number;   
    targetUserId?: number;
    password?: string;
    comment?: string;
    expiresAt?: Date;
    requiredSubscription?: string;
  }, transaction?: DBTransaction): Promise<Check> {
    return await this.executeInTransaction(transaction, async (t) => {
      const creator = await User.findByPk(data.creatorId, { transaction: t });
      if (!creator) {
        throw new AppError('Creator not found', 404);
      }

      // Проверяем баланс
      if (creator.balance < data.totalAmount) {
        throw new AppError('Insufficient balance', 400);
      }

      // Списываем средства с баланса создателя
      await creator.updateBalance(data.totalAmount, 'subtract');

      // Создаем чек
      const check = await Check.create({
        creatorId: data.creatorId,
        code: generateCheckCode(),
        type: data.type,
        totalAmount: data.totalAmount,
        amountPerActivation: Math.floor(data.totalAmount / data.maxActivations),
        maxActivations: data.maxActivations,
        currentActivations: 0,
        targetUserId: data.targetUserId,
        password: data.password ? hashPassword(data.password) : undefined,
        comment: data.comment,
        expiresAt: data.expiresAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        requiredSubscription: data.requiredSubscription,
        isActive: true
      }, { transaction: t });

      // Создаем транзакцию
      await this.transactionService.createCheckTransaction(
        data.creatorId,
        data.totalAmount,
        creator.balance + data.totalAmount,
        check.id,
        true,
        t
      );

      logger.info(`Check created: ${check.id} by user ${data.creatorId}`);
      return check;
    });
  }

  /**
   * Активация чека
   */
  async activateCheck(data: {
    userId: number;
    code: string;
    password?: string;
  }, transaction?: DBTransaction): Promise<{
    success: boolean;
    amount?: number;
    message: string;
  }> {
    return await this.executeInTransaction(transaction, async (t) => {
      const check = await Check.findOne({
        where: { code: data.code.toUpperCase() },
        include: [
          { model: User, as: 'creator' },
          { model: User, as: 'targetUser' }
        ],
        transaction: t
      });

      if (!check) {
        return { success: false, message: 'Чек не найден' };
      }

      // Проверяем активность чека
      if (!check.isActive) {
        return { success: false, message: 'Чек неактивен' };
      }

      // Проверяем срок действия
      if (check.expiresAt && check.expiresAt < new Date()) {
        return { success: false, message: 'Срок действия чека истек' };
      }

      // Проверяем оставшиеся активации
      if (check.currentActivations >= check.maxActivations) {
        return { success: false, message: 'Чек уже полностью активирован' };
      }

      // Проверяем целевого пользователя
      if (check.targetUserId && check.targetUserId !== data.userId) {
        return { success: false, message: 'Чек предназначен для другого пользователя' };
      }

      // Проверяем, не активировал ли уже пользователь этот чек
      const existingActivation = await CheckActivation.findOne({
        where: { checkId: check.id, userId: data.userId },
        transaction: t
      });

      if (existingActivation) {
        return { success: false, message: 'Вы уже активировали этот чек' };
      }

      // Проверяем пароль
      if (check.password) {
        if (!data.password) {
          return { success: false, message: 'Требуется пароль для активации чека' };
        }
        
        const isPasswordValid = validatePasswordHash(data.password, check.password);
        if (!isPasswordValid) {
          return { success: false, message: 'Неверный пароль' };
        }
      }

      // Активируем чек
      const user = await User.findByPk(data.userId, { transaction: t });
      if (!user) {
        return { success: false, message: 'Пользователь не найден' };
      }

      // Создаем активацию
      await CheckActivation.create({
        checkId: check.id,
        userId: data.userId,
        amount: check.amountPerActivation
      }, { transaction: t });

      // Начисляем средства пользователю
      await user.updateBalance(check.amountPerActivation, 'add');

      // Обновляем счетчик активаций
      await check.update({
        currentActivations: check.currentActivations + 1
      }, { transaction: t });

      // Если чек полностью активирован, деактивируем его
      if (check.currentActivations + 1 >= check.maxActivations) {
        await check.update({ isActive: false }, { transaction: t });
      }

      // Создаем транзакцию
      await this.transactionService.createCheckTransaction(
        data.userId,
        check.amountPerActivation,
        user.balance - check.amountPerActivation,
        check.id,
        false,
        t
      );

      // Уведомляем создателя
      if (check.creator) {
        await this.notificationService.createCheckActivated(
          check.creator.id,
          check.amountPerActivation,
          user.getDisplayName(),
          t
        );
      }

      logger.info(`Check activated: ${check.id} by user ${data.userId}`);
      
      return {
        success: true,
        amount: check.amountPerActivation,
        message: `Чек успешно активирован! Получено ${check.amountPerActivation} GRAM`
      };
    });
  }

  /**
   * Получение чеков пользователя
   */
  async getUserChecks(
    userId: number,
    filters?: {
      isActive?: boolean;
      type?: 'personal' | 'multi';
      limit?: number;
      offset?: number;
    }
  ): Promise<{ rows: Check[]; count: number }> {
    const whereConditions: any = { creatorId: userId };
    
    if (filters?.isActive !== undefined) {
      whereConditions.isActive = filters.isActive;
    }
    
    if (filters?.type) {
      whereConditions.type = filters.type;
    }

    return await Check.findAndCountAll({
      where: whereConditions,
      order: [['createdAt', 'DESC']],
      limit: filters?.limit || 20,
      offset: filters?.offset || 0
    });
  }

  /**
   * Получение активаций пользователя
   */
  async getUserActivations(
    userId: number,
    limit: number = 20,
    offset: number = 0
  ): Promise<{ rows: CheckActivation[]; count: number }> {
    return await CheckActivation.findAndCountAll({
      where: { userId },
      include: [{ model: Check, as: 'check' }],
      order: [['createdAt', 'DESC']],
      limit,
      offset
    });
  }

  /**
   * Получение статистики чеков
   */
  async getCheckStats(): Promise<{
    totalChecks: number;
    activeChecks: number;
    totalVolume: number;
    totalActivations: number;
    totalDistributed: number;
    averageCheckAmount: number;
    activationRate: number;
  }> {
    const [
      totalChecks,
      activeChecks,
      totalVolume,
      totalActivations,
      totalDistributed
    ] = await Promise.all([
      Check.count(),
      Check.count({ where: { isActive: true } }),
      Check.sum('totalAmount') || 0,
      CheckActivation.count(),
      CheckActivation.sum('amount') || 0
    ]);

    return {
      totalChecks,
      activeChecks,
      totalVolume,
      totalActivations,
      totalDistributed,
      averageCheckAmount: totalChecks > 0 ? totalVolume / totalChecks : 0,
      activationRate: totalChecks > 0 ? (totalActivations / totalChecks) * 100 : 0
    };
  }

  /**
   * Деактивация чека
   */
  async deactivateCheck(
    checkId: number,
    userId: number,
    transaction?: DBTransaction
  ): Promise<Check> {
    return await this.executeInTransaction(transaction, async (t) => {
      const check = await Check.findOne({
        where: { id: checkId, creatorId: userId },
        transaction: t
      });

      if (!check) {
        throw new AppError('Check not found or access denied', 404);
      }

      if (!check.isActive) {
        throw new AppError('Check is already inactive', 400);
      }

      await check.update({ isActive: false }, { transaction: t });

      logger.info(`Check deactivated: ${checkId} by user ${userId}`);
      return check;
    });
  }

  /**
   * Очистка истекших чеков
   */
  async cleanupExpiredChecks(): Promise<number> {
    const expiredChecks = await Check.findAll({
      where: {
        isActive: true,
        expiresAt: { [Op.lte]: new Date() }
      }
    });

    let refundedAmount = 0;

    for (const check of expiredChecks) {
      const remainingAmount = (check.maxActivations - check.currentActivations) * check.amountPerActivation;
      
      if (remainingAmount > 0) {
        // Возвращаем оставшиеся средства создателю
        const creator = await User.findByPk(check.creatorId);
        if (creator) {
          await creator.updateBalance(remainingAmount, 'add');
          
          await this.transactionService.createTransaction({
            userId: creator.id,
            type: 'check_refund',
            amount: remainingAmount,
            relatedCheckId: check.id,
            description: 'Check expiration refund'
          });

          refundedAmount += remainingAmount;
        }
      }

      await check.update({ isActive: false });
    }

    logger.info(`Cleaned up ${expiredChecks.length} expired checks, refunded ${refundedAmount} GRAM`);
    return expiredChecks.length;
  }

  /**
   * Выполнение операции в транзакции
   */
    public async executeInTransaction<T>(
      transaction: DBTransaction | undefined,
      operation: (t: DBTransaction) => Promise<T>
    ): Promise<T> {
      if (transaction) {
        return await operation(transaction);
      }

      return await sequelize.transaction(operation);
    }
}