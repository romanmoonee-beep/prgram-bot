// src/services/referral/ReferralService.ts
import { Transaction, Op } from 'sequelize';
import { User, Transaction as TransactionModel, TaskExecution } from '../../database/models';
import { UserService } from '../user';
import { TransactionService } from '../transaction';
import { NotificationService } from '../notification';
import { 
  ReferralReward,
  ReferralStats,
  ReferralFilters,
  ReferralLevel,
  UserLevel
} from './types';
import { 
  REFERRAL_REWARDS, 
  REFERRAL_BONUS_PERCENTAGE,
  REFERRAL_LEVELS 
} from '../../utils/constants';
import { AppError } from '../../utils/errors';
import { logger } from '../../utils/logger';

export class ReferralService {
  constructor(
    private userService: UserService,
    private transactionService: TransactionService,
    private notificationService: NotificationService
  ) {}

  /**
   * Обработка регистрации реферала
   */
  async processReferralRegistration(
    newUserId: number,
    referrerCode?: string,
    transaction?: Transaction
  ): Promise<{
    referrer: User | null;
    reward: number;
    bonusApplied: boolean;
  }> {
    if (!referrerCode) {
      return { referrer: null, reward: 0, bonusApplied: false };
    }

    return await this.executeInTransaction(transaction, async (t) => {
      // Находим реферера по коду
      const referrer = await User.findOne({
        where: { referralCode: referrerCode },
        transaction: t
      });

      if (!referrer) {
        logger.warn(`Invalid referral code used: ${referrerCode}`);
        return { referrer: null, reward: 0, bonusApplied: false };
      }

      // Проверяем, что пользователь не пытается зарегистрироваться по своему коду
      if (referrer.id === newUserId) {
        logger.warn(`User tried to use own referral code: ${newUserId}`);
        return { referrer: null, reward: 0, bonusApplied: false };
      }

      // Обновляем реферальную связь
      await this.userService.updateReferrer(newUserId, referrer.id, t);

      // Рассчитываем награду
      const reward = this.calculateRegistrationReward(referrer.level as UserLevel);

      // Начисляем награду рефереру
      await this.userService.updateBalance(referrer.id, reward, 0, t);

      // Обновляем счетчики рефералов
      await this.updateReferralCounters(referrer.id, false, t);

      // Создаем транзакцию награды
      await this.transactionService.createTransaction({
        userId: referrer.id,
        type: 'referral_reward',
        amount: reward,
        relatedUserId: newUserId,
        description: `Referral registration reward from @${await this.getUsernameById(newUserId)}`,
        metadata: { referralType: 'registration', referredUserId: newUserId }
      }, t);

      // Уведомляем реферера
      await this.notificationService.createNotification({
        userId: referrer.id,
        type: 'referral_registered',
        title: 'New Referral!',
        message: `You earned ${reward} GRAM for inviting a new user`,
        data: { reward, referredUserId: newUserId },
        priority: 2
      }, t);

      logger.info(`Referral registration processed: referrer ${referrer.id}, new user ${newUserId}, reward ${reward}`);

      return { referrer, reward, bonusApplied: true };
    });
  }

  /**
   * Обработка перехода реферала на Premium
   */
  async processReferralPremiumUpgrade(
    userId: number,
    transaction?: Transaction
  ): Promise<void> {
    return await this.executeInTransaction(transaction, async (t) => {
      const user = await User.findByPk(userId, { transaction: t });
      
      if (!user || !user.referrerId) {
        return; // Нет реферера или пользователь не найден
      }

      const referrer = await User.findByPk(user.referrerId, { transaction: t });
      if (!referrer) {
        return;
      }

      // Проверяем, не был ли уже начислен Premium бонус
      const existingPremiumReward = await TransactionModel.findOne({
        where: {
          userId: referrer.id,
          relatedUserId: userId,
          type: 'referral_premium_bonus'
        },
        transaction: t
      });

      if (existingPremiumReward) {
        return; // Бонус уже начислен
      }

      // Рассчитываем дополнительную награду за Premium
      const premiumBonus = this.calculatePremiumBonus(referrer.level as UserLevel);

      // Начисляем бонус
      await this.userService.updateBalance(referrer.id, premiumBonus, 0, t);

      // Обновляем счетчик Premium рефералов
      await this.updateReferralCounters(referrer.id, true, t);

      // Создаем транзакцию бонуса
      await this.transactionService.createTransaction({
        userId: referrer.id,
        type: 'referral_premium_bonus',
        amount: premiumBonus,
        relatedUserId: userId,
        description: `Premium upgrade bonus from referral`,
        metadata: { referralType: 'premium_upgrade', referredUserId: userId }
      }, t);

      // Уведомляем реферера
      await this.notificationService.createNotification({
        userId: referrer.id,
        type: 'referral_premium_upgrade',
        title: 'Referral Went Premium!',
        message: `Your referral upgraded to Premium! You earned ${premiumBonus} GRAM bonus`,
        data: { bonus: premiumBonus, referredUserId: userId },
        priority: 2
      }, t);

      logger.info(`Referral premium upgrade processed: referrer ${referrer.id}, user ${userId}, bonus ${premiumBonus}`);
    });
  }

  /**
   * Обработка активности реферала (выполнение заданий, пополнения)
   */
  async processReferralActivity(
    userId: number,
    activityType: 'task_completion' | 'balance_topup',
    amount: number,
    transaction?: Transaction
  ): Promise<void> {
    return await this.executeInTransaction(transaction, async (t) => {
      const user = await User.findByPk(userId, { transaction: t });
      
      if (!user || !user.referrerId) {
        return; // Нет реферера
      }

      const referrer = await User.findByPk(user.referrerId, { transaction: t });
      if (!referrer) {
        return;
      }

      // Рассчитываем процент от активности
      const percentage = this.getActivityPercentage(activityType, referrer.level as UserLevel);
      const reward = Math.floor(amount * percentage / 100);

      if (reward <= 0) {
        return; // Слишком маленькая награда
      }

      // Проверяем дневные лимиты активности
      const dailyLimit = this.getDailyActivityLimit(referrer.level as UserLevel);
      const todayEarned = await this.getTodayReferralEarnings(referrer.id, activityType, t);

      if (todayEarned + reward > dailyLimit) {
        const cappedReward = Math.max(0, dailyLimit - todayEarned);
        if (cappedReward <= 0) return;
        
        // Начисляем ограниченную награду
        await this.processActivityReward(referrer.id, userId, cappedReward, activityType, t);
        return;
      }

      // Начисляем полную награду
      await this.processActivityReward(referrer.id, userId, reward, activityType, t);
    });
  }

  /**
   * Получение реферальной статистики пользователя
   */
  async getReferralStats(
    userId: number,
    period?: { from: Date; to: Date }
  ): Promise<ReferralStats> {
    // Получаем всех рефералов пользователя
    const referrals = await User.findAll({
      where: { referrerId: userId },
      attributes: ['id', 'username', 'level', 'isPremium', 'registeredAt', 'lastActiveAt'],
      order: [['registeredAt', 'DESC']]
    });

    // Фильтрация по периоду если указан
    const filteredReferrals = period 
      ? referrals.filter(ref => ref.registeredAt >= period.from && ref.registeredAt <= period.to)
      : referrals;

    // Подсчет базовой статистики
    const totalReferrals = filteredReferrals.length;
    const activeReferrals = filteredReferrals.filter(ref => {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      return ref.lastActiveAt && ref.lastActiveAt >= thirtyDaysAgo;
    }).length;
    const premiumReferrals = filteredReferrals.filter(ref => ref.isPremium).length;

    // Получаем заработок от рефералов
    const whereConditions: any = {
      userId,
      type: { [Op.in]: ['referral_reward', 'referral_premium_bonus', 'referral_activity'] }
    };

    if (period) {
      whereConditions.createdAt = {
        [Op.gte]: period.from,
        [Op.lte]: period.to
      };
    }

    const referralTransactions = await TransactionModel.findAll({
      where: whereConditions,
      attributes: ['amount', 'type', 'createdAt', 'metadata']
    });

    const totalEarned = referralTransactions.reduce((sum, tx) => sum + tx.amount, 0);
    const registrationRewards = referralTransactions
      .filter(tx => tx.type === 'referral_reward')
      .reduce((sum, tx) => sum + tx.amount, 0);
    const premiumBonuses = referralTransactions
      .filter(tx => tx.type === 'referral_premium_bonus')
      .reduce((sum, tx) => sum + tx.amount, 0);
    const activityRewards = referralTransactions
      .filter(tx => tx.type === 'referral_activity')
      .reduce((sum, tx) => sum + tx.amount, 0);

    // Статистика по уровням рефералов
    const levelStats = filteredReferrals.reduce((acc, ref) => {
      const level = ref.level as UserLevel;
      acc[level] = (acc[level] || 0) + 1;
      return acc;
    }, {} as Record<UserLevel, number>);

    // Конверсия в Premium
    const conversionRate = totalReferrals > 0 ? (premiumReferrals / totalReferrals) * 100 : 0;

    return {
      totalReferrals,
      activeReferrals,
      premiumReferrals,
      totalEarned,
      breakdown: {
        registrationRewards,
        premiumBonuses,
        activityRewards
      },
      levelDistribution: levelStats,
      conversionRate,
      averageEarningPerReferral: totalReferrals > 0 ? totalEarned / totalReferrals : 0,
      referrals: filteredReferrals.map(ref => ({
        id: ref.id,
        username: ref.username,
        level: ref.level,
        isPremium: ref.isPremium,
        registeredAt: ref.registeredAt,
        lastActiveAt: ref.lastActiveAt,
        isActive: ref.lastActiveAt && ref.lastActiveAt >= new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      }))
    };
  }

  /**
   * Получение списка рефералов с фильтрацией
   */
  async getReferrals(
    userId: number,
    filters: ReferralFilters = {}
  ): Promise<{
    referrals: any[];
    total: number;
    hasMore: boolean;
  }> {
    const {
      level,
      isPremium,
      isActive,
      dateFrom,
      dateTo,
      limit = 20,
      offset = 0,
      sortBy = 'registered_at',
      sortOrder = 'DESC'
    } = filters;

    const whereConditions: any = { referrerId: userId };

    if (level) whereConditions.level = level;
    if (isPremium !== undefined) whereConditions.isPremium = isPremium;

    if (dateFrom || dateTo) {
      whereConditions.registeredAt = {};
      if (dateFrom) whereConditions.registeredAt[Op.gte] = dateFrom;
      if (dateTo) whereConditions.registeredAt[Op.lte] = dateTo;
    }

    if (isActive !== undefined) {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      if (isActive) {
        whereConditions.lastActiveAt = { [Op.gte]: thirtyDaysAgo };
      } else {
        whereConditions[Op.or] = [
          { lastActiveAt: null },
          { lastActiveAt: { [Op.lt]: thirtyDaysAgo } }
        ];
      }
    }

    const { count, rows } = await User.findAndCountAll({
      where: whereConditions,
      attributes: [
        'id', 'username', 'level', 'isPremium', 'registeredAt', 
        'lastActiveAt', 'totalEarned', 'totalSpent'
      ],
      limit,
      offset,
      order: [[sortBy, sortOrder]]
    });

    // Получаем заработок с каждого реферала
    const referralsWithEarnings = await Promise.all(
      rows.map(async (referral) => {
        const earnings = await this.getReferralEarnings(userId, referral.id);
        return {
          ...referral.toJSON(),
          earnings,
          isActive: referral.lastActiveAt && 
            referral.lastActiveAt >= new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        };
      })
    );

    return {
      referrals: referralsWithEarnings,
      total: count,
      hasMore: offset + limit < count
    };
  }

  /**
   * Получение реферального дерева (многоуровневая структура)
   */
  async getReferralTree(
    userId: number,
    maxDepth: number = 3
  ): Promise<{
    tree: any[];
    totalLevels: number;
    totalReferrals: number;
    totalEarnings: number;
  }> {
    const buildTree = async (parentId: number, depth: number): Promise<any[]> => {
      if (depth >= maxDepth) return [];

      const directReferrals = await User.findAll({
        where: { referrerId: parentId },
        attributes: ['id', 'username', 'level', 'isPremium', 'registeredAt'],
        order: [['registeredAt', 'DESC']]
      });

      const tree = await Promise.all(
        directReferrals.map(async (referral) => {
          const children = await buildTree(referral.id, depth + 1);
          const earnings = await this.getReferralEarnings(parentId, referral.id);
          
          return {
            ...referral.toJSON(),
            level: depth + 1,
            earnings,
            children
          };
        })
      );

      return tree;
    };

    const tree = await buildTree(userId, 0);
    
    // Подсчитываем общую статистику
    const countStats = (nodes: any[], stats = { count: 0, earnings: 0, maxLevel: 0 }): any => {
      nodes.forEach(node => {
        stats.count++;
        stats.earnings += node.earnings;
        stats.maxLevel = Math.max(stats.maxLevel, node.level);
        
        if (node.children && node.children.length > 0) {
          countStats(node.children, stats);
        }
      });
      return stats;
    };

    const stats = countStats(tree);

    return {
      tree,
      totalLevels: stats.maxLevel,
      totalReferrals: stats.count,
      totalEarnings: stats.earnings
    };
  }

  /**
   * Получение топ рефереров платформы
   */
  async getTopReferrers(
    period?: { from: Date; to: Date },
    limit: number = 10
  ): Promise<Array<{
    user: any;
    referralsCount: number;
    totalEarned: number;
    premiumReferrals: number;
    conversionRate: number;
  }>> {
    const whereConditions: any = {};
    
    if (period) {
      whereConditions.registeredAt = {
        [Op.gte]: period.from,
        [Op.lte]: period.to
      };
    }

    // Получаем пользователей с рефералами
    const usersWithReferrals = await User.findAll({
      where: { referralsCount: { [Op.gt]: 0 } },
      attributes: ['id', 'username', 'level', 'referralsCount', 'premiumReferralsCount'],
      order: [['referralsCount', 'DESC']],
      limit: limit * 2 // Берем больше для фильтрации
    });

    // Получаем детальную статистику для каждого
    const detailedStats = await Promise.all(
      usersWithReferrals.map(async (user) => {
        const stats = await this.getReferralStats(user.id, period);
        return {
          user: user.toJSON(),
          referralsCount: stats.totalReferrals,
          totalEarned: stats.totalEarned,
          premiumReferrals: stats.premiumReferrals,
          conversionRate: stats.conversionRate
        };
      })
    );

    // Фильтруем и сортируем
    return detailedStats
      .filter(stat => stat.referralsCount > 0)
      .sort((a, b) => b.totalEarned - a.totalEarned)
      .slice(0, limit);
  }

  /**
   * Расчет награды за регистрацию реферала
   */
  private calculateRegistrationReward(referrerLevel: UserLevel): number {
    return REFERRAL_REWARDS[referrerLevel] || REFERRAL_REWARDS.bronze;
  }

  /**
   * Расчет бонуса за переход реферала в Premium
   */
  private calculatePremiumBonus(referrerLevel: UserLevel): number {
    const baseReward = this.calculateRegistrationReward(referrerLevel);
    return Math.floor(baseReward * 2); // Удваиваем базовую награду
  }

  /**
   * Получение процента от активности реферала
   */
  private getActivityPercentage(
    activityType: 'task_completion' | 'balance_topup',
    referrerLevel: UserLevel
  ): number {
    const percentages = REFERRAL_BONUS_PERCENTAGE[referrerLevel];
    return percentages ? percentages[activityType] || 0 : 0;
  }

  /**
   * Получение дневного лимита заработка с активности
   */
  private getDailyActivityLimit(referrerLevel: UserLevel): number {
    const limits = {
      bronze: 500,
      silver: 1000,
      gold: 2000,
      premium: 5000
    };
    return limits[referrerLevel] || limits.bronze;
  }

  /**
   * Получение заработка за сегодня по типу активности
   */
  private async getTodayReferralEarnings(
    referrerId: number,
    activityType: string,
    transaction: Transaction
  ): Promise<number> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const transactions = await TransactionModel.findAll({
      where: {
        userId: referrerId,
        type: 'referral_activity',
        createdAt: {
          [Op.gte]: today,
          [Op.lt]: tomorrow
        },
        metadata: {
          activityType
        }
      },
      attributes: ['amount'],
      transaction
    });

    return transactions.reduce((sum, tx) => sum + tx.amount, 0);
  }

  /**
   * Обработка награды за активность
   */
  private async processActivityReward(
    referrerId: number,
    referralId: number,
    reward: number,
    activityType: string,
    transaction: Transaction
  ): Promise<void> {
    // Начисляем награду
    await this.userService.updateBalance(referrerId, reward, 0, transaction);

    // Создаем транзакцию
    await this.transactionService.createTransaction({
      userId: referrerId,
      type: 'referral_activity',
      amount: reward,
      relatedUserId: referralId,
      description: `Referral ${activityType} bonus`,
      metadata: { 
        referralType: 'activity', 
        activityType,
        referredUserId: referralId 
      }
    }, transaction);

    logger.info(`Referral activity reward: ${referrerId} earned ${reward} from ${referralId} (${activityType})`);
  }

  /**
   * Обновление счетчиков рефералов
   */
  private async updateReferralCounters(
    referrerId: number,
    isPremium: boolean,
    transaction: Transaction
  ): Promise<void> {
    const increments: any = { referralsCount: 1 };
    if (isPremium) {
      increments.premiumReferralsCount = 1;
    }

    await User.increment(increments, {
      where: { id: referrerId },
      transaction
    });
  }

  /**
   * Получение заработка с конкретного реферала
   */
  private async getReferralEarnings(
    referrerId: number,
    referralId: number
  ): Promise<number> {
    const transactions = await TransactionModel.findAll({
      where: {
        userId: referrerId,
        relatedUserId: referralId,
        type: { [Op.in]: ['referral_reward', 'referral_premium_bonus', 'referral_activity'] }
      },
      attributes: ['amount']
    });

    return transactions.reduce((sum, tx) => sum + tx.amount, 0);
  }

  /**
   * Получение username по ID
   */
  private async getUsernameById(userId: number): Promise<string> {
    const user = await User.findByPk(userId, { attributes: ['username'] });
    return user?.username || 'Unknown';
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

    const { sequelize } = User;
    return await sequelize.transaction(operation);
  }
}