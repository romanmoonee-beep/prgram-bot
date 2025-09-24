// src/services/check/CheckServiceExtended.ts
import { Transaction, Op } from 'sequelize';
import { CheckService } from './CheckService';
import { CheckServiceAnalytics } from './CheckServiceAnalytics';
import { UserService } from '../user';
import { TransactionService } from '../transaction';
import { NotificationService } from '../notification';
import { TelegramService } from '../telegram';
import { Check, CheckActivation, User } from '../../database/models';
import { 
  BulkCheckCreationData, 
  BulkCheckResult, 
  CheckDetails,
  CheckTemplate,
  CheckServiceConfig
} from './types';
import { AppError } from '../../utils/errors';
import { logger } from '../../utils/logger';
import { generateQRCode } from '../../utils/helpers';

export class CheckServiceExtended extends CheckService {
  public analytics: CheckServiceAnalytics;
  private config: CheckServiceConfig;

  constructor(
    userService: UserService,
    transactionService: TransactionService,
    notificationService: NotificationService,
    telegramService: TelegramService,
    config?: Partial<CheckServiceConfig>
  ) {
    super(userService, transactionService, notificationService, telegramService);
    
    this.analytics = new CheckServiceAnalytics();
    this.config = {
      limits: {
        minAmount: 10,
        maxAmount: 100000,
        maxActiveChecksPerUser: 50,
        maxActivationsPerMultiCheck: 1000,
        maxExpiryDays: 30
      },
      features: {
        allowPasswordProtection: true,
        allowSubscriptionRequirement: true,
        allowImageAttachment: true,
        allowBulkCreation: true
      },
      fees: {
        creationFeePercent: 0,
        minCreationFee: 0,
        maxCreationFee: 100
      },
      security: {
        maxActivationsPerUserPerDay: 100,
        suspiciousActivityThreshold: 50,
        requireCaptchaForLargeAmounts: true,
        largeAmountThreshold: 5000
      },
      ...config
    };
  }

  /**
   * Создание нескольких чеков сразу
   */
  async createBulkChecks(
    creatorId: number,
    bulkData: BulkCheckCreationData,
    transaction?: Transaction
  ): Promise<BulkCheckResult> {
    if (!this.config.features.allowBulkCreation) {
      throw new AppError('Bulk check creation is disabled', 403);
    }

    return await this.executeInTransaction(transaction, async (t) => {
      const successful: Array<{ check: any; code: string }> = [];
      const failed: Array<{ index: number; error: string; data: any }> = [];
      let totalAmount = 0;

      // Рассчитываем общую сумму
      const totalCost = bulkData.checks.reduce((sum, checkData) => sum + checkData.amount, 0);
      
      // Проверяем баланс создателя
      const creator = await this.userService.getById(creatorId, t);
      if (!creator || creator.balance < totalCost) {
        throw new AppError('Insufficient balance for bulk creation', 400);
      }

      // Создаем чеки один за другим
      for (let i = 0; i < bulkData.checks.length; i++) {
        const checkData = bulkData.checks[i];
        
        try {
          const fullCheckData = {
            ...bulkData.commonSettings,
            totalAmount: checkData.amount,
            comment: checkData.comment,
            targetUserId: checkData.targetUserId
          };

          const check = await super.createCheck(creatorId, fullCheckData, t);
          successful.push({ check, code: check.code });
          totalAmount += checkData.amount;

        } catch (error) {
          failed.push({
            index: i,
            error: error instanceof Error ? error.message : 'Unknown error',
            data: checkData
          });
        }
      }

      logger.info(`Bulk check creation completed: ${successful.length} successful, ${failed.length} failed`);

      return {
        successful,
        failed,
        summary: {
          total: bulkData.checks.length,
          successful: successful.length,
          failed: failed.length,
          totalAmount
        }
      };
    });
  }

  /**
   * Получение детальной информации о чеке
   */
  async getCheckDetails(checkId: number): Promise<CheckDetails> {
    const check = await Check.findByPk(checkId, {
      include: [
        { 
          model: User, 
          as: 'creator',
          attributes: ['id', 'username', 'level']
        },
        {
          model: CheckActivation,
          as: 'activations',
          include: [{ 
            model: User, 
            as: 'user',
            attributes: ['id', 'username']
          }],
          order: [['activatedAt', 'DESC']]
        }
      ]
    });

    if (!check) {
      throw new AppError('Check not found', 404);
    }

    // Статистика активаций
    const activations = check.activations || [];
    const totalActivations = activations.length;
    const uniqueActivators = new Set(activations.map(a => a.userId)).size;
    
    const activationTimes = activations
      .filter(a => a.activatedAt)
      .map(a => a.activatedAt.getTime() - check.createdAt.getTime());
    
    const averageTimeToActivation = activationTimes.length > 0
      ? activationTimes.reduce((sum, time) => sum + time, 0) / activationTimes.length / 1000 / 60 // в минутах
      : undefined;

    const fastestActivation = activationTimes.length > 0
      ? Math.min(...activationTimes) / 1000 / 60
      : undefined;

    const slowestActivation = activationTimes.length > 0
      ? Math.max(...activationTimes) / 1000 / 60
      : undefined;

    // Временная линия событий
    const timeline = [
      {
        type: 'created' as const,
        timestamp: check.createdAt,
        userId: check.creatorId,
        username: check.creator?.username
      },
      ...activations.map(activation => ({
        type: 'activated' as const,
        timestamp: activation.activatedAt,
        userId: activation.userId,
        username: activation.user?.username,
        amount: activation.amount
      }))
    ];

    if (!check.isActive && check.expiresAt && check.expiresAt <= new Date()) {
      timeline.push({
        type: 'expired' as const,
        timestamp: check.expiresAt
      });
    }

    timeline.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    return {
      check,
      creator: {
        id: check.creator!.id,
        username: check.creator?.username,
        level: check.creator!.level
      },
      activations: activations.map(a => ({
        id: a.id,
        userId: a.userId,
        username: a.user?.username,
        amount: a.amount,
        activatedAt: a.activatedAt
      })),
      stats: {
        activationRate: check.maxActivations > 0 ? (totalActivations / check.maxActivations) * 100 : 0,
        averageTimeToActivation: averageTimeToActivation ? Math.round(averageTimeToActivation) : undefined,
        fastestActivation: fastestActivation ? Math.round(fastestActivation) : undefined,
        slowestActivation: slowestActivation ? Math.round(slowestActivation) : undefined,
        uniqueActivators
      },
      timeline
    };
  }

  /**
   * Создание чека с QR кодом
   */
  async createCheckWithQR(
    creatorId: number,
    checkData: any,
    transaction?: Transaction
  ): Promise<{
    check: any;
    qrCode: string;
    shareUrl: string;
  }> {
    const check = await super.createCheck(creatorId, checkData, transaction);
    
    // Генерируем QR код
    const shareUrl = `https://t.me/prgram_bot?start=check_${check.code}`;
    const qrCode = await generateQRCode(shareUrl);

    return {
      check,
      qrCode,
      shareUrl
    };
  }

  /**
   * Получение популярных шаблонов чеков
   */
  async getCheckTemplates(): Promise<CheckTemplate[]> {
    // В реальной реализации шаблоны будут браться из БД
    return [
      {
        id: 'giveaway_small',
        name: 'Small Giveaway',
        description: 'Perfect for small community rewards',
        type: 'multi' as const,
        defaultAmount: 500,
        defaultMaxActivations: 10,
        requiresPassword: false,
        requiresSubscription: true,
        category: 'giveaway',
        isPopular: true
      },
      {
        id: 'personal_gift',
        name: 'Personal Gift',
        description: 'Send GRAM to specific person',
        type: 'personal' as const,
        defaultAmount: 100,
        requiresPassword: false,
        requiresSubscription: false,
        category: 'payment',
        isPopular: true
      },
      {
        id: 'large_promotion',
        name: 'Large Promotion',
        description: 'Big promotional campaign',
        type: 'multi' as const,
        defaultAmount: 5000,
        defaultMaxActivations: 100,
        requiresPassword: true,
        requiresSubscription: true,
        category: 'giveaway',
        isPopular: false
      }
    ];
  }

  /**
   * Поиск чеков
   */
  async searchChecks(query: {
    text?: string;
    creatorId?: number;
    amountFrom?: number;
    amountTo?: number;
    type?: 'personal' | 'multi';
    isActive?: boolean;
    hasActivations?: boolean;
    dateFrom?: Date;
    dateTo?: Date;
    limit?: number;
    offset?: number;
  }): Promise<{
    checks: any[];
    total: number;
    hasMore: boolean;
  }> {
    const {
      text,
      creatorId,
      amountFrom,
      amountTo,
      type,
      isActive,
      hasActivations,
      dateFrom,
      dateTo,
      limit = 20,
      offset = 0
    } = query;

    const whereConditions: any = {};

    if (text) {
      whereConditions.comment = { [Op.iLike]: `%${text}%` };
    }

    if (creatorId) whereConditions.creatorId = creatorId;
    if (type) whereConditions.type = type;
    if (isActive !== undefined) whereConditions.isActive = isActive;

    if (amountFrom || amountTo) {
      whereConditions.totalAmount = {};
      if (amountFrom) whereConditions.totalAmount[Op.gte] = amountFrom;
      if (amountTo) whereConditions.totalAmount[Op.lte] = amountTo;
    }

    if (hasActivations !== undefined) {
      whereConditions.currentActivations = hasActivations 
        ? { [Op.gt]: 0 } 
        : { [Op.eq]: 0 };
    }

    if (dateFrom || dateTo) {
      whereConditions.createdAt = {};
      if (dateFrom) whereConditions.createdAt[Op.gte] = dateFrom;
      if (dateTo) whereConditions.createdAt[Op.lte] = dateTo;
    }

    const { count, rows } = await Check.findAndCountAll({
      where: whereConditions,
      include: [{ 
        model: User, 
        as: 'creator',
        attributes: ['username', 'level']
      }],
      limit,
      offset,
      order: [['createdAt', 'DESC']]
    });

    return {
      checks: rows,
      total: count,
      hasMore: offset + limit < count
    };
  }

  /**
   * Административная блокировка чека
   */
  async adminBlockCheck(
    checkId: number,
    adminId: number,
    reason: string,
    transaction?: Transaction
  ): Promise<void> {
    return await this.executeInTransaction(transaction, async (t) => {
      const check = await Check.findByPk(checkId, { transaction: t });
      
      if (!check) {
        throw new AppError('Check not found', 404);
      }

      // Возвращаем неиспользованные средства
      const remainingAmount = (check.maxActivations - check.currentActivations) * check.amountPerActivation;
      
      if (remainingAmount > 0) {
        await this.userService.updateBalance(check.creatorId, remainingAmount, 0, t);
      }

      await check.update({ 
        isActive: false,
        // В реальной реализации добавить поля для блокировки админом
      }, { transaction: t });

      // Уведомляем создателя
      await this.notificationService.createNotification({
        userId: check.creatorId,
        type: 'check_blocked',
        title: 'Check Blocked',
        message: `Your check has been blocked by administration. Reason: ${reason}`,
        data: { checkId, reason, refundAmount: remainingAmount },
        priority: 3
      }, t);

      logger.warn(`Check blocked by admin: ${checkId} by admin ${adminId}, reason: ${reason}`);
    });
  }

  /**
   * Получение статистики за период
   */
  async getPeriodStats(period: { from: Date; to: Date }): Promise<{
    checks: {
      created: number;
      activated: number;
      totalVolume: number;
      averageAmount: number;
    };
    users: {
      creators: number;
      activators: number;
      newUsers: number;
    };
    trends: {
      daily: Array<{
        date: string;
        checksCreated: number;
        activations: number;
        volume: number;
      }>;
    };
  }> {
    const checksCreated = await Check.count({
      where: {
        createdAt: {
          [Op.gte]: period.from,
          [Op.lte]: period.to
        }
      }
    });

    const activations = await CheckActivation.findAll({
      where: {
        activatedAt: {
          [Op.gte]: period.from,
          [Op.lte]: period.to
        }
      },
      attributes: ['amount', 'userId', 'activatedAt']
    });

    const checksWithVolume = await Check.findAll({
      where: {
        createdAt: {
          [Op.gte]: period.from,
          [Op.lte]: period.to
        }
      },
      attributes: ['totalAmount', 'creatorId']
    });

    const totalVolume = checksWithVolume.reduce((sum, c) => sum + c.totalAmount, 0);
    const uniqueCreators = new Set(checksWithVolume.map(c => c.creatorId)).size;
    const uniqueActivators = new Set(activations.map(a => a.userId)).size;

    // Подсчет новых пользователей (тех, кто активировал чек впервые в этом периоде)
    const newUsersCount = await this.countNewUsersInPeriod(period);

    // Дневные тренды
    const dailyTrends = await this.getDailyTrends(period);

    return {
      checks: {
        created: checksCreated,
        activated: activations.length,
        totalVolume,
        averageAmount: checksCreated > 0 ? Math.round(totalVolume / checksCreated) : 0
      },
      users: {
        creators: uniqueCreators,
        activators: uniqueActivators,
        newUsers: newUsersCount
      },
      trends: {
        daily: dailyTrends
      }
    };
  }

  /**
   * Валидация лимитов пользователя
   */
  async validateUserLimits(userId: number, checkData: any): Promise<{
    canCreate: boolean;
    violations: string[];
    limits: {
      dailyChecks: { current: number; limit: number };
      activeChecks: { current: number; limit: number };
      dailyActivations: { current: number; limit: number };
    };
  }> {
    const violations: string[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Проверяем дневные лимиты создания чеков
    const dailyChecks = await Check.count({
      where: {
        creatorId: userId,
        createdAt: { [Op.gte]: today }
      }
    });

    const dailyLimit = 10; // Можно настроить по уровням пользователя
    if (dailyChecks >= dailyLimit) {
      violations.push(`Daily check creation limit reached (${dailyLimit})`);
    }

    // Проверяем активные чеки
    const activeChecks = await Check.count({
      where: {
        creatorId: userId,
        isActive: true
      }
    });

    if (activeChecks >= this.config.limits.maxActiveChecksPerUser) {
      violations.push(`Too many active checks (${this.config.limits.maxActiveChecksPerUser} max)`);
    }

    // Проверяем дневные активации
    const dailyActivations = await CheckActivation.count({
      where: {
        userId,
        activatedAt: { [Op.gte]: today }
      }
    });

    if (dailyActivations >= this.config.security.maxActivationsPerUserPerDay) {
      violations.push(`Daily activation limit reached (${this.config.security.maxActivationsPerUserPerDay})`);
    }

    return {
      canCreate: violations.length === 0,
      violations,
      limits: {
        dailyChecks: { current: dailyChecks, limit: dailyLimit },
        activeChecks: { current: activeChecks, limit: this.config.limits.maxActiveChecksPerUser },
        dailyActivations: { current: dailyActivations, limit: this.config.security.maxActivationsPerUserPerDay }
      }
    };
  }

  /**
   * Подсчет новых пользователей за период
   */
  private async countNewUsersInPeriod(period: { from: Date; to: Date }): Promise<number> {
    // Находим пользователей, которые активировали свой первый чек в этом периоде
    const firstActivations = await CheckActivation.findAll({
      where: {
        activatedAt: {
          [Op.gte]: period.from,
          [Op.lte]: period.to
        }
      },
      attributes: ['userId'],
      group: ['userId'],
      having: {
        [Op.eq]: [
          { [Op.fn]: 'MIN', [Op.col]: 'activated_at' },
          { [Op.col]: 'activated_at' }
        ]
      }
    });

    return firstActivations.length;
  }

  /**
   * Получение дневных трендов
   */
  private async getDailyTrends(period: { from: Date; to: Date }): Promise<Array<{
    date: string;
    checksCreated: number;
    activations: number;
    volume: number;
  }>> {
    const trends: Array<{
      date: string;
      checksCreated: number;
      activations: number;
      volume: number;
    }> = [];

    // Генерируем даты в периоде
    for (let d = new Date(period.from); d <= period.to; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      const nextDay = new Date(d);
      nextDay.setDate(nextDay.getDate() + 1);

      // Чеки созданные в этот день
      const checksCreated = await Check.count({
        where: {
          createdAt: {
            [Op.gte]: d,
            [Op.lt]: nextDay
          }
        }
      });

      // Активации в этот день
      const activations = await CheckActivation.count({
        where: {
          activatedAt: {
            [Op.gte]: d,
            [Op.lt]: nextDay
          }
        }
      });

      // Объем чеков созданных в этот день
      const checksVolume = await Check.sum('totalAmount', {
        where: {
          createdAt: {
            [Op.gte]: d,
            [Op.lt]: nextDay
          }
        }
      });

      trends.push({
        date: dateStr,
        checksCreated,
        activations,
        volume: checksVolume || 0
      });
    }

    return trends;
  }

  /**
   * Экспорт данных пользователя (для GDPR)
   */
  async exportUserData(userId: number): Promise<{
    checks: any[];
    activations: any[];
    stats: any;
  }> {
    const [checks, activations, stats] = await Promise.all([
      Check.findAll({
        where: { creatorId: userId },
        include: [{ 
          model: CheckActivation, 
          as: 'activations',
          include: [{ model: User, as: 'user', attributes: ['username'] }]
        }]
      }),
      CheckActivation.findAll({
        where: { userId },
        include: [{ 
          model: Check, 
          as: 'check',
          include: [{ model: User, as: 'creator', attributes: ['username'] }]
        }]
      }),
      this.analytics.getUserCheckStats(userId)
    ]);

    return {
      checks: checks.map(check => ({
        id: check.id,
        code: check.code,
        type: check.type,
        totalAmount: check.totalAmount,
        currentActivations: check.currentActivations,
        maxActivations: check.maxActivations,
        comment: check.comment,
        isActive: check.isActive,
        createdAt: check.createdAt,
        expiresAt: check.expiresAt,
        activations: check.activations?.map(a => ({
          userId: a.userId,
          username: a.user?.username,
          amount: a.amount,
          activatedAt: a.activatedAt
        }))
      })),
      activations: activations.map(activation => ({
        id: activation.id,
        amount: activation.amount,
        activatedAt: activation.activatedAt,
        check: {
          id: activation.check!.id,
          code: activation.check!.code,
          creatorUsername: activation.check!.creator?.username,
          comment: activation.check!.comment
        }
      })),
      stats
    };
  }

  /**
   * Удаление данных пользователя (для GDPR)
   */
  async deleteUserData(
    userId: number, 
    transaction?: Transaction
  ): Promise<{
    deletedChecks: number;
    deletedActivations: number;
    refundAmount: number;
  }> {
    return await this.executeInTransaction(transaction, async (t) => {
      // Получаем активные чеки пользователя
      const activeChecks = await Check.findAll({
        where: { 
          creatorId: userId, 
          isActive: true 
        },
        transaction: t
      });

      let refundAmount = 0;

      // Деактивируем чеки и возвращаем средства
      for (const check of activeChecks) {
        const remainingAmount = (check.maxActivations - check.currentActivations) * check.amountPerActivation;
        if (remainingAmount > 0) {
          refundAmount += remainingAmount;
        }
        await check.update({ isActive: false }, { transaction: t });
      }

      // Удаляем активации пользователя
      const deletedActivations = await CheckActivation.destroy({
        where: { userId },
        transaction: t
      });

      // Удаляем чеки пользователя
      const deletedChecks = await Check.destroy({
        where: { creatorId: userId },
        transaction: t
      });

      logger.info(`User data deleted: ${userId}, checks: ${deletedChecks}, activations: ${deletedActivations}, refund: ${refundAmount}`);

      return {
        deletedChecks,
        deletedActivations,
        refundAmount
      };
    });
  }

  /**
   * Получение конфигурации сервиса
   */
  getConfig(): CheckServiceConfig {
    return { ...this.config };
  }

  /**
   * Обновление конфигурации сервиса
   */
  updateConfig(newConfig: Partial<CheckServiceConfig>): void {
    this.config = {
      ...this.config,
      ...newConfig,
      limits: { ...this.config.limits, ...newConfig.limits },
      features: { ...this.config.features, ...newConfig.features },
      fees: { ...this.config.fees, ...newConfig.fees },
      security: { ...this.config.security, ...newConfig.security }
    };
    
    logger.info('Check service configuration updated', newConfig);
  }
}