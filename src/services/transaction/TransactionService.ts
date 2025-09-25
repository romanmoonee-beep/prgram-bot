// src/services/transaction/TransactionService.ts
import { Transaction as DBTransaction, Op } from 'sequelize';
import { Transaction, User } from '../../database/models';
import { logger } from '../../utils/logger';

export class TransactionService {
  /**
   * Создание транзакции
   */
  async createTransaction(data: {
    userId: number;
    type: string;
    amount: number;
    relatedTaskId?: number;
    relatedCheckId?: number;
    description?: string;
    metadata?: any;
  }, transaction?: DBTransaction): Promise<Transaction> {
    return await Transaction.create({
      userId: data.userId,
      type: data.type,
      amount: data.amount,
      relatedTaskId: data.relatedTaskId,
      relatedCheckId: data.relatedCheckId,
      description: data.description,
      metadata: data.metadata,
      status: 'completed',
      balanceBefore: 0,
      balanceAfter: 0
    }, { transaction });
  }

  /**
   * Создание транзакции депозита
   */
  async createDeposit(
    userId: number,
    amount: number,
    balanceBefore: number,
    paymentId: string,
    paymentMethod: string,
    transaction?: DBTransaction
  ): Promise<Transaction> {
    return await this.createTransaction({
      userId,
      type: 'deposit',
      amount,
      description: `Deposit via ${paymentMethod}`,
      metadata: { paymentId, paymentMethod, balanceBefore }
    }, transaction);
  }

  /**
   * Создание транзакции награды за задание
   */
  async createTaskReward(
    userId: number,
    taskId: number,
    amount: number,
    balanceBefore: number,
    transaction?: DBTransaction
  ): Promise<Transaction> {
    return await this.createTransaction({
      userId,
      type: 'task_reward',
      amount,
      relatedTaskId: taskId,
      description: 'Task completion reward',
      metadata: { balanceBefore }
    }, transaction);
  }

  /**
   * Создание транзакции чека
   */
  async createCheckTransaction(
    userId: number,
    amount: number,
    balanceBefore: number,
    checkId: number,
    isCreation: boolean,
    transaction?: DBTransaction
  ): Promise<Transaction> {
    return await this.createTransaction({
      userId,
      type: isCreation ? 'check_creation' : 'check_activation',
      amount: isCreation ? -Math.abs(amount) : Math.abs(amount),
      relatedCheckId: checkId,
      description: isCreation ? 'Check creation' : 'Check activation',
      metadata: { balanceBefore, checkId }
    }, transaction);
  }

  /**
   * Создание реферального бонуса
   */
  async createReferralBonus(
    userId: number,
    referredUserId: number,
    amount: number,
    balanceBefore: number,
    transaction?: DBTransaction
  ): Promise<Transaction> {
    return await this.createTransaction({
      userId,
      type: 'referral_bonus',
      amount,
      description: 'Referral bonus',
      metadata: { balanceBefore, referredUserId }
    }, transaction);
  }

  /**
   * Получение транзакций пользователя
   */
  async getTransactions(filters: {
    userId?: number;
    type?: string;
    dateFrom?: Date;
    dateTo?: Date;
    limit?: number;
    offset?: number;
  }): Promise<Transaction[]> {
    const whereConditions: any = {};
    
    if (filters.userId) whereConditions.userId = filters.userId;
    if (filters.type) whereConditions.type = filters.type;
    
    if (filters.dateFrom || filters.dateTo) {
      whereConditions.createdAt = {};
      if (filters.dateFrom) whereConditions.createdAt[Op.gte] = filters.dateFrom;
      if (filters.dateTo) whereConditions.createdAt[Op.lte] = filters.dateTo;
    }

    return await Transaction.findAll({
      where: whereConditions,
      order: [['createdAt', 'DESC']],
      limit: filters.limit || 50,
      offset: filters.offset || 0,
      include: [{ model: User, as: 'user', attributes: ['username', 'firstName'] }]
    });
  }

  /**
   * Получение суммы транзакций
   */
  async getTransactionSum(filters: {
    userId?: number;
    type?: string;
    dateFrom?: Date;
    dateTo?: Date;
  }): Promise<number> {
    const whereConditions: any = {};
    
    if (filters.userId) whereConditions.userId = filters.userId;
    if (filters.type) whereConditions.type = filters.type;
    
    if (filters.dateFrom || filters.dateTo) {
      whereConditions.createdAt = {};
      if (filters.dateFrom) whereConditions.createdAt[Op.gte] = filters.dateFrom;
      if (filters.dateTo) whereConditions.createdAt[Op.lte] = filters.dateTo;
    }

    return await Transaction.sum('amount', { where: whereConditions }) || 0;
  }
}