// src/services/referral/ReferralServiceAnalytics.ts
import { Op } from 'sequelize';
import { User, Transaction as TransactionModel } from '../../database/models';
import { 
  ReferralAnalytics, 
  ReferralCampaign, 
  ReferralAchievement, 
  UserReferralAchievements,
  ReferralReport,
  UserLevel
} from './types';
import { logger } from '../../utils/logger';

export class ReferralServiceAnalytics {
// src/services/referral/ReferralServiceAnalytics.ts
import { Op, QueryTypes } from 'sequelize';
import { User, Transaction as TransactionModel } from '../../database/models';
import { sequelize } from '../../database/config';
import { 
  ReferralAnalytics, 
  ReferralCampaign, 
  ReferralAchievement, 
  UserReferralAchievements,
  ReferralReport,
  UserLevel
} from './types';
import { logger } from '../../utils/logger';

export class ReferralServiceAnalytics {
  /**
   * Получение общей аналитики реферальной системы
   */
  async getReferralAnalytics(
    period?: { from: Date; to: Date }
  ): Promise<ReferralAnalytics> {
    const whereConditions: any = {};
    const transactionWhere: any = {
      type: { [Op.in]: ['referral_reward', 'referral_premium_bonus', 'referral_activity'] }
    };
    
    if (period) {
      whereConditions.registeredAt = {
        [Op.gte]: period.from,
        [Op.lte]: period.to
      };
      transactionWhere.createdAt = {
        [Op.gte]: period.from,
        [Op.lte]: period.to
      };
    }

    // Основная статистика
    const [totalReferrers, totalReferrals, referralTransactions] = await Promise.all([
      User.count({ where: { referralsCount: { [Op.gt]: 0 } } }),
      User.count({ where: { referrerId: { [Op.not]: null }, ...whereConditions } }),
      TransactionModel.findAll({
        where: transactionWhere,
        attributes: ['amount', 'type', 'createdAt', 'userId']
      })
    ]);

    const totalRewardsDistributed = referralTransactions.reduce((sum, tx) => sum + tx.amount, 0);
    const averageRewardsPerReferrer = totalReferrers > 0 ? totalRewardsDistributed / totalReferrers : 0;

    // Конверсия в Premium
    const premiumReferrals = await User.count({
      where: { 
        referrerId: { [Op.not]: null }, 
        isPremium: true,
        ...whereConditions
      }
    });
    const conversionToPremium = totalReferrals > 0 ? (premiumReferrals / totalReferrals) * 100 : 0;

    // Ретенция 30 дней
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const referralsOlderThan30Days = await User.count({
      where: {
        referrerId: { [Op.not]: null },
        registeredAt: { [Op.lte]: thirtyDaysAgo }
      }
    });

    const activeReferralsLast30Days = await User.count({
      where: {
        referrerId: { [Op.not]: null },
        registeredAt: { [Op.lte]: thirtyDaysAgo },
        lastActiveAt: { [Op.gte]: thirtyDaysAgo }
      }
    });

    const retentionRate30Days = referralsOlderThan30Days > 0 
      ? (activeReferralsLast30Days / referralsOlderThan30Days) * 100 
      : 0;

    // Тренды
    const dailyTrends = await this.getDailyTrends(period);
    const monthlyTrends = await this.getMonthlyTrends(period);

    // Топ исполнители
    const topPerformers = await this.getTopPerformers(period);

    // Демография
    const demographics = await this.getDemographics(period);

    return {
      overview: {
        totalReferrers,
        totalReferrals,
        totalRewardsDistributed,
        averageRewardsPerReferrer: Math.round(averageRewardsPerReferrer),
        conversionToPremium: Math.round(conversionToPremium * 10) / 10,
        retentionRate30Days: Math.round(retentionRate30Days * 10) / 10
      },
      trends: {
        daily: dailyTrends,
        monthly: monthlyTrends
      },
      topPerformers,
      demographics
    };
  }

  /**
   * Получение дневных трендов
   */
  private async getDailyTrends(period?: { from: Date; to: Date }): Promise<Array<{
    date: string;
    newReferrals: number;
    rewardsDistributed: number;
    premiumUpgrades: number;
  }>> {
    const fromDate = period?.from || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const toDate = period?.to || new Date();

    const query = `
      SELECT 
        DATE(registered_at) as date,
        COUNT(*) as new_referrals,
        COALESCE(rewards.total_rewards, 0) as rewards_distributed,
        COUNT(CASE WHEN is_premium = true THEN 1 END) as premium_upgrades
      FROM users u
      LEFT JOIN (
        SELECT 
          DATE(created_at) as date,
          SUM(amount) as total_rewards
        FROM transactions 
        WHERE type IN ('referral_reward', 'referral_premium_bonus', 'referral_activity')
          AND created_at >= :fromDate
          AND created_at <= :toDate
        GROUP BY DATE(created_at)
      ) rewards ON DATE(u.registered_at) = rewards.date
      WHERE u.referrer_id IS NOT NULL
        AND u.registered_at >= :fromDate
        AND u.registered_at <= :toDate
      GROUP BY DATE(u.registered_at), rewards.total_rewards
      ORDER BY DATE(u.registered_at)
    `;

    const results = await sequelize.query(query, {
      replacements: { fromDate, toDate },
      type: QueryTypes.SELECT
    }) as any[];

    return results.map(row => ({
      date: row.date,
      newReferrals: parseInt(row.new_referrals),
      rewardsDistributed: parseInt(row.rewards_distributed || 0),
      premiumUpgrades: parseInt(row.premium_upgrades)
    }));
  }

  /**
   * Получение месячных трендов
   */
  private async getMonthlyTrends(period?: { from: Date; to: Date }): Promise<Array<{
    month: string;
    referrals: number;
    rewards: number;
    conversionRate: number;
  }>> {
    const fromDate = period?.from || new Date(Date.now() - 12 * 30 * 24 * 60 * 60 * 1000);
    const toDate = period?.to || new Date();

    const query = `
      SELECT 
        TO_CHAR(registered_at, 'YYYY-MM') as month,
        COUNT(*) as referrals,
        COALESCE(rewards.total_rewards, 0) as rewards,
        ROUND(
          (COUNT(CASE WHEN is_premium = true THEN 1 END)::decimal / COUNT(*)) * 100, 
          1
        ) as conversion_rate
      FROM users u
      LEFT JOIN (
        SELECT 
          TO_CHAR(created_at, 'YYYY-MM') as month,
          SUM(amount) as total_rewards
        FROM transactions 
        WHERE type IN ('referral_reward', 'referral_premium_bonus', 'referral_activity')
          AND created_at >= :fromDate
          AND created_at <= :toDate
        GROUP BY TO_CHAR(created_at, 'YYYY-MM')
      ) rewards ON TO_CHAR(u.registered_at, 'YYYY-MM') = rewards.month
      WHERE u.referrer_id IS NOT NULL
        AND u.registered_at >= :fromDate
        AND u.registered_at <= :toDate
      GROUP BY TO_CHAR(u.registered_at, 'YYYY-MM'), rewards.total_rewards
      ORDER BY TO_CHAR(u.registered_at, 'YYYY-MM')
    `;

    const results = await sequelize.query(query, {
      replacements: { fromDate, toDate },
      type: QueryTypes.SELECT
    }) as any[];

    return results.map(row => ({
      month: row.month,
      referrals: parseInt(row.referrals),
      rewards: parseInt(row.rewards || 0),
      conversionRate: parseFloat(row.conversion_rate || 0)
    }));
  }

  /**
   * Получение топ исполнителей
   */
  private async getTopPerformers(period?: { from: Date; to: Date }): Promise<{
    byReferrals: Array<{ user: any; referralsCount: number; totalEarned: number }>;
    byEarnings: Array<{ user: any; referralsCount: number; totalEarned: number }>;
    byConversion: Array<{ user: any; conversionRate: number; referralsCount: number }>;
  }> {
    const periodCondition = period 
      ? `AND u2.registered_at >= '${period.from.toISOString()}' AND u2.registered_at <= '${period.to.toISOString()}'`
      : '';

    // Топ по количеству рефералов
    const topByReferrals = await sequelize.query(`
      SELECT 
        u.id, u.username, u.level,
        COUNT(u2.id) as referrals_count,
        COALESCE(SUM(t.amount), 0) as total_earned
      FROM users u
      LEFT JOIN users u2 ON u.id = u2.referrer_id ${periodCondition}
      LEFT JOIN transactions t ON t.user_id = u.id 
        AND t.type IN ('referral_reward', 'referral_premium_bonus', 'referral_activity')
        AND t.related_user_id = u2.id
      WHERE u.referrals_count > 0
      GROUP BY u.id, u.username, u.level
      HAVING COUNT(u2.id) > 0
      ORDER BY referrals_count DESC
      LIMIT 10
    `, { type: QueryTypes.SELECT }) as any[];

    // Топ по заработку
    const topByEarnings = await sequelize.query(`
      SELECT 
        u.id, u.username, u.level,
        COUNT(u2.id) as referrals_count,
        COALESCE(SUM(t.amount), 0) as total_earned
      FROM users u
      LEFT JOIN users u2 ON u.id = u2.referrer_id ${periodCondition}
      LEFT JOIN transactions t ON t.user_id = u.id 
        AND t.type IN ('referral_reward', 'referral_premium_bonus', 'referral_activity')
        AND t.related_user_id = u2.id
      WHERE u.referrals_count > 0
      GROUP BY u.id, u.username, u.level
      HAVING SUM(t.amount) > 0
      ORDER BY total_earned DESC
      LIMIT 10
    `, { type: QueryTypes.SELECT }) as any[];

    // Топ по конверсии
    const topByConversion = await sequelize.query(`
      SELECT 
        u.id, u.username, u.level,
        COUNT(u2.id) as referrals_count,
        ROUND(
          (COUNT(CASE WHEN u2.is_premium = true THEN 1 END)::decimal / COUNT(u2.id)) * 100,
          1
        ) as conversion_rate
      FROM users u
      LEFT JOIN users u2 ON u.id = u2.referrer_id ${periodCondition}
      WHERE u.referrals_count > 0
      GROUP BY u.id, u.username, u.level
      HAVING COUNT(u2.id) >= 5
      ORDER BY conversion_rate DESC
      LIMIT 10
    `, { type: QueryTypes.SELECT }) as any[];

    return {
      byReferrals: topByReferrals.map(row => ({
        user: { id: row.id, username: row.username, level: row.level },
        referralsCount: parseInt(row.referrals_count),
        totalEarned: parseInt(row.total_earned)
      })),
      byEarnings: topByEarnings.map(row => ({
        user: { id: row.id, username: row.username, level: row.level },
        referralsCount: parseInt(row.referrals_count),
        totalEarned: parseInt(row.total_earned)
      })),
      byConversion: topByConversion.map(row => ({
        user: { id: row.id, username: row.username, level: row.level },
        conversionRate: parseFloat(row.conversion_rate),
        referralsCount: parseInt(row.referrals_count)
      }))
    };
  }

  /**
   * Получение демографических данных
   */
  private async getDemographics(period?: { from: Date; to: Date }): Promise<{
    levelDistribution: Record<UserLevel, number>;
    activityPatterns: Array<{ hour: number; registrations: number; activity: number }>;
  }> {
    const whereConditions = period ? {
      registeredAt: {
        [Op.gte]: period.from,
        [Op.lte]: period.to
      }
    } : {};

    // Распределение по уровням
    const levelDistributionQuery = await User.findAll({
      where: { 
        referrerId: { [Op.not]: null },
        ...whereConditions
      },
      attributes: [
        'level',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      group: ['level'],
      raw: true
    }) as any[];

    const levelDistribution = levelDistributionQuery.reduce((acc, row) => {
      acc[row.level as UserLevel] = parseInt(row.count);
      return acc;
    }, {} as Record<UserLevel, number>);

    // Паттерны активности по часам
    const activityPatternsQuery = await sequelize.query(`
      SELECT 
        EXTRACT(hour FROM registered_at) as hour,
        COUNT(*) as registrations,
        COUNT(CASE WHEN last_active_at >= (NOW() - INTERVAL '30 days') THEN 1 END) as activity
      FROM users
      WHERE referrer_id IS NOT NULL
        ${period ? `AND registered_at >= '${period.from.toISOString()}' AND registered_at <= '${period.to.toISOString()}'` : ''}
      GROUP BY EXTRACT(hour FROM registered_at)
      ORDER BY hour
    `, { type: QueryTypes.SELECT }) as any[];

    const activityPatterns = Array.from({ length: 24 }, (_, hour) => {
      const data = activityPatternsQuery.find(row => parseInt(row.hour) === hour);
      return {
        hour,
        registrations: data ? parseInt(data.registrations) : 0,
        activity: data ? parseInt(data.activity) : 0
      };
    });

    return {
      levelDistribution,
      activityPatterns
    };
  }

  /**
   * Создание отчета по рефералам пользователя
   */
  async generateUserReferralReport(
    userId: number,
    period: { from: Date; to: Date }
  ): Promise<ReferralReport> {
    // Получаем рефералов пользователя в периоде
    const referrals = await User.findAll({
      where: {
        referrerId: userId,
        registeredAt: {
          [Op.gte]: period.from,
          [Op.lte]: period.to
        }
      },
      attributes: ['id', 'username', 'level', 'isPremium', 'registeredAt', 'totalEarned', 'lastActiveAt']
    });

    // Получаем заработок с рефералов в периоде
    const referralTransactions = await TransactionModel.findAll({
      where: {
        userId,
        type: { [Op.in]: ['referral_reward', 'referral_premium_bonus', 'referral_activity'] },
        createdAt: {
          [Op.gte]: period.from,
          [Op.lte]: period.to
        }
      },
      attributes: ['amount', 'type', 'createdAt', 'relatedUserId', 'metadata']
    });

    const totalEarnings = referralTransactions.reduce((sum, tx) => sum + tx.amount, 0);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const activeReferrals = referrals.filter(ref => 
      ref.lastActiveAt && ref.lastActiveAt >= thirtyDaysAgo
    ).length;
    const premiumConversions = referrals.filter(ref => ref.isPremium).length;

    // Разбивка по уровням
    const byLevel = referrals.reduce((acc, ref) => {
      const level = ref.level as UserLevel;
      if (!acc[level]) acc[level] = { count: 0, earnings: 0 };
      acc[level].count++;
      
      // Находим заработок с этого реферала
      const earnings = referralTransactions
        .filter(tx => tx.relatedUserId === ref.id)
        .reduce((sum, tx) => sum + tx.amount, 0);
      acc[level].earnings += earnings;
      
      return acc;
    }, {} as Record<UserLevel, { count: number; earnings: number }>);

    // Разбивка по неделям
    const byWeek = this.getWeeklyBreakdown(referrals, referralTransactions, period);

    // Разбивка по активности
    const taskCompletionRewards = referralTransactions.filter(tx => 
      tx.type === 'referral_activity' && 
      tx.metadata?.activityType === 'task_completion'
    );
    const topupRewards = referralTransactions.filter(tx => 
      tx.type === 'referral_activity' && 
      tx.metadata?.activityType === 'balance_topup'
    );

    const byActivity = {
      taskCompletions: {
        count: taskCompletionRewards.length,
        earnings: taskCompletionRewards.reduce((sum, tx) => sum + tx.amount, 0)
      },
      balanceTopups: {
        count: topupRewards.length,
        earnings: topupRewards.reduce((sum, tx) => sum + tx.amount, 0)
      }
    };

    // Топ рефералы
    const topReferrals = referrals
      .map(ref => {
        const earnings = referralTransactions
          .filter(tx => tx.relatedUserId === ref.id)
          .reduce((sum, tx) => sum + tx.amount, 0);
        const activities = referralTransactions
          .filter(tx => tx.relatedUserId === ref.id && tx.type === 'referral_activity')
          .length;
        
        return {
          id: ref.id,
          username: ref.username,
          earnings,
          activities
        };
      })
      .sort((a, b) => b.earnings - a.earnings)
      .slice(0, 10);

    return {
      period,
      summary: {
        newReferrals: referrals.length,
        totalEarnings,
        activeReferrals,
        premiumConversions
      },
      breakdown: {
        byLevel,
        byWeek,
        byActivity
      },
      topReferrals
    };
  }

  /**
   * Получение статистики пользователя для расчета достижений
   */
  private async getUserReferralStats(userId: number): Promise<{
    totalReferrals: number;
    totalEarned: number;
    premiumReferrals: number;
    conversionRate: number;
  }> {
    const user = await User.findByPk(userId, {
      attributes: ['referralsCount', 'premiumReferralsCount']
    });

    if (!user) {
      return { totalReferrals: 0, totalEarned: 0, premiumReferrals: 0, conversionRate: 0 };
    }

    const totalEarned = await TransactionModel.sum('amount', {
      where: {
        userId,
        type: { [Op.in]: ['referral_reward', 'referral_premium_bonus', 'referral_activity'] }
      }
    }) || 0;

    const conversionRate = user.referralsCount > 0 
      ? (user.premiumReferralsCount / user.referralsCount) * 100 
      : 0;

    return {
      totalReferrals: user.referralsCount,
      totalEarned,
      premiumReferrals: user.premiumReferralsCount,
      conversionRate
    };
  }

  /**
   * Получение всех достижений
   */
  private async getAllAchievements(): Promise<ReferralAchievement[]> {
    // В реальной реализации это будет запрос к таблице achievements
    return [
      {
        id: 'first_referral',
        name: 'First Steps',
        description: 'Invite your first referral',
        icon: '👶',
        category: 'referrals',
        requirements: {
          type: 'referrals_count',
          value: 1
        },
        rewards: { gram: 100 },
        rarity: 'common',
        isHidden: false
      },
      {
        id: 'referral_master',
        name: 'Referral Master',
        description: 'Invite 100 referrals',
        icon: '👑',
        category: 'referrals',
        requirements: {
          type: 'referrals_count',
          value: 100
        },
        rewards: { gram: 10000, title: 'Referral Master' },
        rarity: 'legendary',
        isHidden: false
      },
      {
        id: 'first_thousand',
        name: 'First Thousand',
        description: 'Earn 1000 GRAM from referrals',
        icon: '💰',
        category: 'earnings',
        requirements: {
          type: 'total_earned',
          value: 1000
        },
        rewards: { gram: 500 },
        rarity: 'rare',
        isHidden: false
      }
    ];
  }

  /**
   * Расчет прогресса достижения
   */
  private calculateAchievementProgress(
    achievement: ReferralAchievement,
    userStats: any
  ): {
    isCompleted: boolean;
    currentValue: number;
    targetValue: number;
    completedAt?: Date;
  } {
    let currentValue = 0;
    const targetValue = achievement.requirements.value;

    switch (achievement.requirements.type) {
      case 'referrals_count':
        currentValue = userStats.totalReferrals;
        break;
      case 'total_earned':
        currentValue = userStats.totalEarned;
        break;
      case 'conversion_rate':
        currentValue = userStats.conversionRate;
        break;
    }

    return {
      isCompleted: currentValue >= targetValue,
      currentValue,
      targetValue,
      completedAt: currentValue >= targetValue ? new Date() : undefined
    };
  }

  /**
   * Получение недельной разбивки
   */
  private getWeeklyBreakdown(
    referrals: any[],
    transactions: any[],
    period: { from: Date; to: Date }
  ): Array<{ week: string; referrals: number; earnings: number }> {
    const weeks: Record<string, { referrals: number; earnings: number }> = {};
    
    // Инициализируем недели в периоде
    for (let d = new Date(period.from); d <= period.to; d.setDate(d.getDate() + 7)) {
      const weekStart = new Date(d);
      const weekKey = `${weekStart.getFullYear()}-W${Math.ceil(weekStart.getDate() / 7)}`;
      weeks[weekKey] = { referrals: 0, earnings: 0 };
    }

    // Заполняем данными
    referrals.forEach(ref => {
      const weekKey = `${ref.registeredAt.getFullYear()}-W${Math.ceil(ref.registeredAt.getDate() / 7)}`;
      if (weeks[weekKey]) {
        weeks[weekKey].referrals++;
      }
    });

    transactions.forEach(tx => {
      const weekKey = `${tx.createdAt.getFullYear()}-W${Math.ceil(tx.createdAt.getDate() / 7)}`;
      if (weeks[weekKey]) {
        weeks[weekKey].earnings += tx.amount;
      }
    });

    return Object.entries(weeks).map(([week, data]) => ({
      week,
      referrals: data.referrals,
      earnings: data.earnings
    }));
  }
}
 общей аналитики реферальной системы
   */
  async getReferralAnalytics(
    period?: { from: Date; to: Date }
  ): Promise<ReferralAnalytics> {
    const whereConditions: any = {};
    const transactionWhere: any = {
      type: { [Op.in]: ['referral_reward', 'referral_premium_bonus', 'referral_activity'] }
    };
    
    if (period) {
      whereConditions.registeredAt = {
        [Op.gte]: period.from,
        [Op.lte]: period.to
      };
      transactionWhere.createdAt = {
        [Op.gte]: period.from,
        [Op.lte]: period.to
      };
    }

    // Основная статистика
    const [totalReferrers, totalReferrals, referralTransactions] = await Promise.all([
      User.count({ where: { referralsCount: { [Op.gt]: 0 } } }),
      User.count({ where: { referrerId: { [Op.not]: null }, ...whereConditions } }),
      TransactionModel.findAll({
        where: transactionWhere,
        attributes: ['amount', 'type', 'createdAt', 'userId']
      })
    ]);

    const totalRewardsDistributed = referralTransactions.reduce((sum, tx) => sum + tx.amount, 0);
    const averageRewardsPerReferrer = totalReferrers > 0 ? totalRewardsDistributed / totalReferrers : 0;

    // Конверсия в Premium
    const premiumReferrals = await User.count({
      where: { 
        referrerId: { [Op.not]: null }, 
        isPremium: true,
        ...whereConditions
      }
    });
    const conversionToPremium = totalReferrals > 0 ? (premiumReferrals / totalReferrals) * 100 : 0;

    // Ретенция 30 дней
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const referralsOlderThan30Days = await User.count({
      where: {
        referrerId: { [Op.not]: null },
        registeredAt: { [Op.lte]: thirtyDaysAgo }
      }
    });

    const activeReferralsLast30Days = await User.count({
      where: {
        referrerId: { [Op.not]: null },
        registeredAt: { [Op.lte]: thirtyDaysAgo },
        lastActiveAt: { [Op.gte]: thirtyDaysAgo }
      }
    });

    const retentionRate30Days = referralsOlderThan30Days > 0 
      ? (activeReferralsLast30Days / referralsOlderThan30Days) * 100 
      : 0;

    // Тренды
    const dailyTrends = await this.getDailyTrends(period);
    const monthlyTrends = await this.getMonthlyTrends(period);

    // Топ исполнители
    const topPerformers = await this.getTopPerformers(period);

    // Демография
    const demographics = await this.getDemographics(period);

    return {
      overview: {
        totalReferrers,
        totalReferrals,
        totalRewardsDistributed,
        averageRewardsPerReferrer: Math.round(averageRewardsPerReferrer),
        conversionToPremium: Math.round(conversionToPremium * 10) / 10,
        retentionRate30Days: Math.round(retentionRate30Days * 10) / 10
      },
      trends: {
        daily: dailyTrends,
        monthly: monthlyTrends
      },
      topPerformers,
      demographics
    };
  }

  /**
   * Создание отчета по рефералам пользователя
   */
  async generateUserReferralReport(
    userId: number,
    period: { from: Date; to: Date }
  ): Promise<ReferralReport> {
    // Получаем рефералов пользователя в периоде
    const referrals = await User.findAll({
      where: {
        referrerId: userId,
        registeredAt: {
          [Op.gte]: period.from,
          [Op.lte]: period.to
        }
      },
      attributes: ['id', 'username', 'level', 'isPremium', 'registeredAt', 'totalEarned']
    });

    // Получаем заработок с рефералов в периоде
    const referralTransactions = await TransactionModel.findAll({
      where: {
        userId,
        type: { [Op.in]: ['referral_reward', 'referral_premium_bonus', 'referral_activity'] },
        createdAt: {
          [Op.gte]: period.from,
          [Op.lte]: period.to
        }
      },
      attributes: ['amount', 'type', 'createdAt', 'relatedUserId', 'metadata']
    });

    const totalEarnings = referralTransactions.reduce((sum, tx) => sum + tx.amount, 0);
    const activeReferrals = referrals.filter(ref => {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      return ref.registeredAt >= thirtyDaysAgo;
    }).length;

    const premiumConversions = referrals.filter(ref => ref.isPremium).length;

    // Разбивка по уровням
    const byLevel = referrals.reduce((acc, ref) => {
      const level = ref.level as UserLevel;
      if (!acc[level]) acc[level] = { count: 0, earnings: 0 };
      acc[level].count++;
      
      // Находим заработок с этого реферала
      const earnings = referralTransactions
        .filter(tx => tx.relatedUserId === ref.id)
        .reduce((sum, tx) => sum + tx.amount, 0);
      acc[level].earnings += earnings;
      
      return acc;
    }, {} as Record<UserLevel, { count: number; earnings: number }>);

    // Разбивка по неделям
    const byWeek = this.getWeeklyBreakdown(referrals, referralTransactions, period);

    // Разбивка по активности
    const taskCompletionRewards = referralTransactions.filter(tx => 
      tx.type === 'referral_activity' && 
      tx.metadata?.activityType === 'task_completion'
    );
    const topupRewards = referralTransactions.filter(tx => 
      tx.type === 'referral_activity' && 
      tx.metadata?.activityType === 'balance_topup'
    );

    const byActivity = {
      taskCompletions: {
        count: taskCompletionRewards.length,
        earnings: taskCompletionRewards.reduce((sum, tx) => sum + tx.amount, 0)
      },
      balanceTopups: {
        count: topupRewards.length,
        earnings: topupRewards.reduce((sum, tx) => sum + tx.amount, 0)
      }
    };

    // Топ рефералы
    const topReferrals = referrals
      .map(ref => {
        const earnings = referralTransactions
          .filter(tx => tx.relatedUserId === ref.id)
          .reduce((sum, tx) => sum + tx.amount, 0);
        const activities = referralTransactions
          .filter(tx => tx.relatedUserId === ref.id && tx.type === 'referral_activity')
          .length;
        
        return {
          id: ref.id,
          username: ref.username,
          earnings,
          activities
        };
      })
      .sort((a, b) => b.earnings - a.earnings)
      .slice(0, 10);

    return {
      period,
      summary: {
        newReferrals: referrals.length,
        totalEarnings,
        activeReferrals,
        premiumConversions
      },
      breakdown: {
        byLevel,
        byWeek,
        byActivity
      },
      topReferrals
    };
  }

  /**
   * Получение достижений пользователя
   */
  async getUserAchievements(userId: number): Promise<UserReferralAchievements> {
    const userStats = await this.getUserReferralStats(userId);
    const allAchievements = await this.getAllAchievements();

    const earned: UserReferralAchievements['earned'] = [];
    const inProgress: UserReferralAchievements['inProgress'] = [];
    const available: ReferralAchievement[] = [];

    for (const achievement of allAchievements) {
      const progress = this.calculateAchievementProgress(achievement, userStats);
      
      if (progress.isCompleted) {
        earned.push({
          achievement,
          earnedAt: progress.completedAt || new Date(),
          progress: progress.currentValue
        });
      } else if (progress.currentValue > 0) {
        inProgress.push({
          achievement,
          currentProgress: progress.currentValue,
          targetProgress: progress.targetValue,
          progressPercentage: (progress.currentValue / progress.targetValue) * 100
        });
      } else if (!achievement.isHidden) {
        available.push(achievement);
      }
    }

    return { earned, inProgress, available };
  }

  /**
   * Создание кампании
   */
  async createCampaign(campaignData: Omit<ReferralCampaign, 'id' | 'stats'>): Promise<ReferralCampaign> {
    const campaign: ReferralCampaign = {
      ...campaignData,
      id: `campaign_${Date.now()}`,
      stats: {
        participants: 0,
        totalReferrals: 0,
        rewardsDistributed: 0
      }
    };

    // В реальной реализации здесь будет сохранение в БД
    // await Campaign.create(campaign);

    logger.info(`Referral campaign created: ${campaign.id} - ${campaign.name}`);
    return campaign;
  }

  /**
   * Получение активных кампаний
   */
  async getActiveCampaigns(): Promise<ReferralCampaign[]> {
    const now = new Date();
    
    // В реальной реализации будет запрос к БД
    // const campaigns = await Campaign.findAll({
    //   where: {
    //     isActive: true,
    //     startDate: { [Op.lte]: now },
    //     endDate: { [Op.gte]: now }
    //   }
    // });

    // Заглушка для примера
    return [];
  }

  /**
   * Получение лидерборда
   */
  async getLeaderboard(
    period: 'week' | 'month' | 'all_time',
    category: 'referrals' | 'earnings' | 'conversion',
    limit: number = 10
  ): Promise<Array<{
    rank: number;
    user: { id: number; username?: string; level: UserLevel };
    value: number;
    change?: number; // Изменение позиции
  }>> {
    let dateFilter = {};
    const now = new Date();
    
    switch (period) {
      case 'week':
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        dateFilter = { registeredAt: { [Op.gte]: weekAgo } };
        break;
      case 'month':
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        dateFilter = { registeredAt: { [Op.gte]: monthAgo } };
        break;
    }

    let orderField: string;
    switch (category) {
      case 'referrals':
        orderField = 'referralsCount';
        break;
      case 'earnings':
        orderField = 'totalEarned'; // Потребует JOIN с транзакциями
        break;
      case 'conversion':
        orderField = 'conversionRate'; // Потребует вычисления
        break;
      default:
        orderField = 'referralsCount';
    }

    const users = await User.findAll({
      where: { referralsCount: { [Op.gt]: 0 } },
      attributes: ['id', 'username', 'level', 'referralsCount', 'premiumReferralsCount'],
      order: [[orderField, 'DESC']],
      limit
    });

    return users.map((user, index) => {
      let value: number;
      switch (category) {
        case 'referrals':
          value = user.referralsCount;
          break;
        case 'conversion':
          value = user.referralsCount > 0 
            ? (user.premiumReferralsCount / user.referralsCount) * 100 
            : 0;
          break;
        default:
          value = 0; // Для earnings потребуется дополнительный запрос
      }

      return {
        rank: index + 1,
        user: {
          id: user.id,
          username: user.username,
          level: user.level as UserLevel
        },
        value: Math.round(value * 10) / 10
      };
    });
  }

  /**
   * Получ