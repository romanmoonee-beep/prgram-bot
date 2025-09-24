// src/services/referral/ReferralServiceExtended.ts
import { Transaction, Op, QueryTypes } from 'sequelize';
import { ReferralService } from './ReferralService';
import { ReferralServiceAnalytics } from './ReferralServiceAnalytics';
import { UserService } from '../user';
import { TransactionService } from '../transaction';
import { NotificationService } from '../notification';
import { User, Transaction as TransactionModel } from '../../database/models';
import { sequelize } from '../../database/config';
import { 
  ReferralCampaign,
  ReferralAchievement,
  UserReferralAchievements,
  ReferralConfig
} from './types';
import { AppError } from '../../utils/errors';
import { logger } from '../../utils/logger';

export class ReferralServiceExtended extends ReferralService {
  public analytics: ReferralServiceAnalytics;
  private config: ReferralConfig;

  constructor(
    userService: UserService,
    transactionService: TransactionService,
    notificationService: NotificationService,
    config?: Partial<ReferralConfig>
  ) {
    super(userService, transactionService, notificationService);
    
    this.analytics = new ReferralServiceAnalytics();
    this.config = {
      rewards: {
        registration: {
          bronze: 1000,
          silver: 1500,
          gold: 2000,
          premium: 3000
        },
        premiumBonus: {
          bronze: 2000,
          silver: 3000,
          gold: 4000,
          premium: 6000
        },
        activityPercentage: {
          bronze: { task_completion: 5, balance_topup: 10 },
          silver: { task_completion: 7, balance_topup: 12 },
          gold: { task_completion: 10, balance_topup: 15 },
          premium: { task_completion: 15, balance_topup: 20 }
        }
      },
      limits: {
        maxReferralsPerDay: 10,
        maxActivityRewardPerDay: {
          bronze: 500,
          silver: 1000,
          gold: 2000,
          premium: 5000
        },
        maxTreeDepth: 5,
        minActivityAmountForReward: 10
      },
      features: {
        enableMultiLevel: true,
        enableActivityRewards: true,
        enablePremiumBonuses: true,
        enableLeaderboards: true
      },
      campaigns: {
        bonusMultipliers: {},
        specialRewards: {}
      },
      ...config
    };
  }

  /**
   * Создание реферальной кампании
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

    // Сохраняем кампанию в БД
    await sequelize.query(`
      INSERT INTO referral_campaigns (
        id, name, description, start_date, end_date, is_active,
        registration_multiplier, premium_bonus_multiplier, activity_reward_multiplier,
        min_referrals, target_level, requires_premium,
        milestone_rewards, special_badges, created_at
      ) VALUES (
        :id, :name, :description, :startDate, :endDate, :isActive,
        :regMultiplier, :premiumMultiplier, :activityMultiplier,
        :minReferrals, :targetLevel, :requiresPremium,
        :milestoneRewards, :specialBadges, NOW()
      )
    `, {
      replacements: {
        id: campaign.id,
        name: campaign.name,
        description: campaign.description,
        startDate: campaign.startDate,
        endDate: campaign.endDate,
        isActive: campaign.isActive,
        regMultiplier: campaign.multipliers.registration,
        premiumMultiplier: campaign.multipliers.premiumBonus,
        activityMultiplier: campaign.multipliers.activityReward,
        minReferrals: campaign.conditions.minReferrals || null,
        targetLevel: campaign.conditions.targetLevel || null,
        requiresPremium: campaign.conditions.requiresPremium || false,
        milestoneRewards: JSON.stringify(campaign.rewards.milestoneRewards),
        specialBadges: JSON.stringify(campaign.rewards.specialBadges)
      },
      type: QueryTypes.INSERT
    });

    logger.info(`Referral campaign created: ${campaign.id} - ${campaign.name}`);
    return campaign;
  }

  /**
   * Получение активных кампаний
   */
  async getActiveCampaigns(): Promise<ReferralCampaign[]> {
    const now = new Date();
    
    const campaigns = await sequelize.query(`
      SELECT 
        id, name, description, start_date, end_date, is_active,
        registration_multiplier, premium_bonus_multiplier, activity_reward_multiplier,
        min_referrals, target_level, requires_premium,
        milestone_rewards, special_badges,
        (SELECT COUNT(*) FROM referral_campaign_participants WHERE campaign_id = rc.id) as participants,
        (SELECT COUNT(*) FROM users WHERE referrer_id IS NOT NULL 
         AND registered_at >= rc.start_date AND registered_at <= COALESCE(rc.end_date, NOW())) as total_referrals,
        (SELECT COALESCE(SUM(amount), 0) FROM transactions 
         WHERE type LIKE 'referral_%' 
         AND created_at >= rc.start_date AND created_at <= COALESCE(rc.end_date, NOW())) as rewards_distributed
      FROM referral_campaigns rc
      WHERE is_active = true 
        AND start_date <= :now 
        AND (end_date IS NULL OR end_date >= :now)
    `, {
      replacements: { now },
      type: QueryTypes.SELECT
    }) as any[];

    return campaigns.map(row => ({
      id: row.id,
      name: row.name,
      description: row.description,
      startDate: new Date(row.start_date),
      endDate: row.end_date ? new Date(row.end_date) : new Date(),
      isActive: row.is_active,
      multipliers: {
        registration: row.registration_multiplier,
        premiumBonus: row.premium_bonus_multiplier,
        activityReward: row.activity_reward_multiplier
      },
      conditions: {
        minReferrals: row.min_referrals,
        targetLevel: row.target_level,
        requiresPremium: row.requires_premium
      },
      rewards: {
        milestoneRewards: JSON.parse(row.milestone_rewards || '[]'),
        specialBadges: JSON.parse(row.special_badges || '[]')
      },
      stats: {
        participants: parseInt(row.participants),
        totalReferrals: parseInt(row.total_referrals),
        rewardsDistributed: parseInt(row.rewards_distributed)
      }
    }));
  }

  /**
   * Участие в кампании
   */
  async joinCampaign(
    userId: number,
    campaignId: string,
    transaction?: Transaction
  ): Promise<void> {
    return await this.executeInTransaction(transaction, async (t) => {
      // Проверяем существование кампании
      const campaign = await this.getCampaignById(campaignId);
      if (!campaign || !campaign.isActive) {
        throw new AppError('Campaign not found or not active', 404);
      }

      // Проверяем условия участия
      const user = await User.findByPk(userId, { transaction: t });
      if (!user) {
        throw new AppError('User not found', 404);
      }

      if (campaign.conditions.requiresPremium && !user.isPremium) {
        throw new AppError('Premium status required for this campaign', 403);
      }

      if (campaign.conditions.targetLevel) {
        const levelOrder = ['bronze', 'silver', 'gold', 'premium'];
        const userLevelIndex = levelOrder.indexOf(user.level);
        const requiredLevelIndex = levelOrder.indexOf(campaign.conditions.targetLevel);
        
        if (userLevelIndex < requiredLevelIndex) {
          throw new AppError(`Minimum level required: ${campaign.conditions.targetLevel}`, 403);
        }
      }

      if (campaign.conditions.minReferrals && user.referralsCount < campaign.conditions.minReferrals) {
        throw new AppError(`Minimum ${campaign.conditions.minReferrals} referrals required`, 403);
      }

      // Проверяем, не участвует ли уже
      const existing = await sequelize.query(
        'SELECT id FROM referral_campaign_participants WHERE user_id = :userId AND campaign_id = :campaignId',
        {
          replacements: { userId, campaignId },
          type: QueryTypes.SELECT,
          transaction: t
        }
      );

      if (existing.length > 0) {
        throw new AppError('Already participating in this campaign', 400);
      }

      // Добавляем участника
      await sequelize.query(`
        INSERT INTO referral_campaign_participants (user_id, campaign_id, joined_at)
        VALUES (:userId, :campaignId, NOW())
      `, {
        replacements: { userId, campaignId },
        type: QueryTypes.INSERT,
        transaction: t
      });

      logger.info(`User ${userId} joined campaign ${campaignId}`);
    });
  }

  /**
   * Проверка достижений пользователя
   */
  async checkAchievements(
    userId: number,
    transaction?: Transaction
  ): Promise<ReferralAchievement[]> {
    return await this.executeInTransaction(transaction, async (t) => {
      const userStats = await this.getUserStatsForAchievements(userId, t);
      const allAchievements = await this.getAllAchievements();
      const earnedAchievements = await this.getEarnedAchievements(userId, t);
      const earnedIds = new Set(earnedAchievements.map(a => a.achievementId));
      
      const newlyEarned: ReferralAchievement[] = [];

      for (const achievement of allAchievements) {
        if (earnedIds.has(achievement.id)) continue;

        if (this.isAchievementCompleted(achievement, userStats)) {
          // Отмечаем достижение как заработанное
          await sequelize.query(`
            INSERT INTO user_referral_achievements (user_id, achievement_id, earned_at)
            VALUES (:userId, :achievementId, NOW())
          `, {
            replacements: { userId, achievementId: achievement.id },
            type: QueryTypes.INSERT,
            transaction: t
          });

          // Начисляем награду если есть
          if (achievement.rewards.gram) {
            await this.userService.updateBalance(userId, achievement.rewards.gram, 0, t);
            
            await this.transactionService.createTransaction({
              userId,
              type: 'achievement_reward',
              amount: achievement.rewards.gram,
              description: `Achievement reward: ${achievement.name}`,
              metadata: { achievementId: achievement.id }
            }, t);
          }

          // Отправляем уведомление
          await this.notificationService.createNotification({
            userId,
            type: 'achievement_earned',
            title: 'Achievement Unlocked!',
            message: `You've earned the "${achievement.name}" achievement!`,
            data: { 
              achievementId: achievement.id,
              reward: achievement.rewards.gram 
            },
            priority: 2
          }, t);

          newlyEarned.push(achievement);
          logger.info(`Achievement earned: ${achievement.id} by user ${userId}`);
        }
      }

      return newlyEarned;
    });
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
    user: { id: number; username?: string; level: string };
    value: number;
    change?: number;
  }>> {
    let periodCondition = '';
    const now = new Date();
    
    switch (period) {
      case 'week':
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        periodCondition = `AND u2.registered_at >= '${weekAgo.toISOString()}'`;
        break;
      case 'month':
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        periodCondition = `AND u2.registered_at >= '${monthAgo.toISOString()}'`;
        break;
    }

    let query = '';
    switch (category) {
      case 'referrals':
        query = `
          SELECT 
            u.id, u.username, u.level,
            COUNT(u2.id) as value
          FROM users u
          LEFT JOIN users u2 ON u.id = u2.referrer_id ${periodCondition}
          WHERE u.referrals_count > 0
          GROUP BY u.id, u.username, u.level
          HAVING COUNT(u2.id) > 0
          ORDER BY value DESC
          LIMIT :limit
        `;
        break;

      case 'earnings':
        query = `
          SELECT 
            u.id, u.username, u.level,
            COALESCE(SUM(t.amount), 0) as value
          FROM users u
          LEFT JOIN transactions t ON t.user_id = u.id 
            AND t.type IN ('referral_reward', 'referral_premium_bonus', 'referral_activity')
            ${period !== 'all_time' ? `AND t.created_at >= '${period === 'week' ? new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString() : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()}'` : ''}
          WHERE u.referrals_count > 0
          GROUP BY u.id, u.username, u.level
          HAVING SUM(t.amount) > 0
          ORDER BY value DESC
          LIMIT :limit
        `;
        break;

      case 'conversion':
        query = `
          SELECT 
            u.id, u.username, u.level,
            ROUND(
              (COUNT(CASE WHEN u2.is_premium = true THEN 1 END)::decimal / COUNT(u2.id)) * 100,
              1
            ) as value
          FROM users u
          LEFT JOIN users u2 ON u.id = u2.referrer_id ${periodCondition}
          WHERE u.referrals_count > 0
          GROUP BY u.id, u.username, u.level
          HAVING COUNT(u2.id) >= 5
          ORDER BY value DESC
          LIMIT :limit
        `;
        break;
    }

    const results = await sequelize.query(query, {
      replacements: { limit },
      type: QueryTypes.SELECT
    }) as any[];

    return results.map((row, index) => ({
      rank: index + 1,
      user: {
        id: row.id,
        username: row.username,
        level: row.level
      },
      value: parseFloat(row.value) || 0
    }));
  }

  /**
   * Массовое начисление бонусов (административная функция)
   */
  async distributeBonuses(
    userIds: number[],
    amount: number,
    reason: string,
    adminId: number,
    transaction?: Transaction
  ): Promise<{
    successful: number[];
    failed: Array<{ userId: number; error: string }>;
  }> {
    return await this.executeInTransaction(transaction, async (t) => {
      const successful: number[] = [];
      const failed: Array<{ userId: number; error: string }> = [];

      for (const userId of userIds) {
        try {
          await this.userService.updateBalance(userId, amount, 0, t);
          
          await this.transactionService.createTransaction({
            userId,
            type: 'admin_bonus',
            amount,
            description: `Admin bonus: ${reason}`,
            metadata: { adminId, reason }
          }, t);

          await this.notificationService.createNotification({
            userId,
            type: 'bonus_received',
            title: 'Bonus Received!',
            message: `You received ${amount} GRAM bonus: ${reason}`,
            data: { amount, reason },
            priority: 2
          }, t);

          successful.push(userId);
        } catch (error) {
          failed.push({
            userId,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      logger.info(`Bonus distribution by admin ${adminId}: ${successful.length} successful, ${failed.length} failed`);
      return { successful, failed };
    });
  }

  /**
   * Анализ эффективности реферальной программы
   */
  async getReferralEfficiencyReport(): Promise<{
    overview: {
      totalInvestment: number;
      totalReturn: number;
      roi: number;
      paybackPeriod: number; // В днях
    };
    cohortAnalysis: Array<{
      period: string;
      newReferrers: number;
      avgReferralsPerUser: number;
      avgEarningsPerReferrer: number;
      retentionRate: number;
    }>;
    recommendations: string[];
  }> {
    // Получаем общие данные за последние 6 месяцев
    const sixMonthsAgo = new Date(Date.now() - 6 * 30 * 24 * 60 * 60 * 1000);
    
    const totalInvestment = await TransactionModel.sum('amount', {
      where: {
        type: { [Op.in]: ['referral_reward', 'referral_premium_bonus', 'referral_activity'] },
        createdAt: { [Op.gte]: sixMonthsAgo }
      }
    }) || 0;

    // Примерный расчет возврата (активность рефералов)
    const referralActivity = await sequelize.query(`
      SELECT COALESCE(SUM(te.reward_amount), 0) as total_activity
      FROM task_executions te
      JOIN users u ON te.user_id = u.id
      WHERE u.referrer_id IS NOT NULL 
        AND te.created_at >= :sixMonthsAgo
        AND te.status = 'completed'
    `, {
      replacements: { sixMonthsAgo },
      type: QueryTypes.SELECT
    }) as any[];

    const totalReturn = referralActivity[0]?.total_activity || 0;
    const roi = totalInvestment > 0 ? ((totalReturn - totalInvestment) / totalInvestment) * 100 : 0;

    // Когортный анализ
    const cohortData = await sequelize.query(`
      SELECT 
        TO_CHAR(DATE_TRUNC('month', u.registered_at), 'YYYY-MM') as period,
        COUNT(DISTINCT u.referrer_id) as new_referrers,
        ROUND(COUNT(u.id)::decimal / COUNT(DISTINCT u.referrer_id), 1) as avg_referrals_per_user,
        ROUND(COALESCE(AVG(t.earnings), 0), 0) as avg_earnings_per_referrer
      FROM users u
      LEFT JOIN (
        SELECT 
          user_id,
          SUM(amount) as earnings
        FROM transactions 
        WHERE type IN ('referral_reward', 'referral_premium_bonus', 'referral_activity')
        GROUP BY user_id
      ) t ON t.user_id = u.referrer_id
      WHERE u.referrer_id IS NOT NULL
        AND u.registered_at >= :sixMonthsAgo
      GROUP BY DATE_TRUNC('month', u.registered_at)
      ORDER BY period
    `, {
      replacements: { sixMonthsAgo },
      type: QueryTypes.SELECT
    }) as any[];

    const cohortAnalysis = cohortData.map(row => ({
      period: row.period,
      newReferrers: parseInt(row.new_referrers),
      avgReferralsPerUser: parseFloat(row.avg_referrals_per_user),
      avgEarningsPerReferrer: parseFloat(row.avg_earnings_per_referrer),
      retentionRate: 0 // Потребует дополнительного расчета
    }));

    // Рекомендации на основе анализа
    const recommendations: string[] = [];
    if (roi < 50) {
      recommendations.push('Consider reducing referral rewards to improve ROI');
    }
    if (cohortAnalysis.length > 0 && cohortAnalysis[cohortAnalysis.length - 1].avgReferralsPerUser < 2) {
      recommendations.push('Focus on increasing referrals per user through campaigns');
    }
    if (totalInvestment > totalReturn) {
      recommendations.push('Monitor user retention and engagement to improve long-term value');
    }

    return {
      overview: {
        totalInvestment,
        totalReturn,
        roi: Math.round(roi * 10) / 10,
        paybackPeriod: roi > 0 ? Math.round(365 / (roi / 100)) : 0
      },
      cohortAnalysis,
      recommendations
    };
  }

  /**
   * Получение кампании по ID
   */
  private async getCampaignById(campaignId: string): Promise<ReferralCampaign | null> {
    const campaigns = await this.getActiveCampaigns();
    return campaigns.find(c => c.id === campaignId) || null;
  }

  /**
   * Получение статистики пользователя для достижений
   */
  private async getUserStatsForAchievements(
    userId: number,
    transaction: Transaction
  ): Promise<{
    totalReferrals: number;
    totalEarned: number;
    conversionRate: number;
  }> {
    const user = await User.findByPk(userId, {
      attributes: ['referralsCount', 'premiumReferralsCount'],
      transaction
    });

    if (!user) {
      return { totalReferrals: 0, totalEarned: 0, conversionRate: 0 };
    }

    const totalEarned = await TransactionModel.sum('amount', {
      where: {
        userId,
        type: { [Op.in]: ['referral_reward', 'referral_premium_bonus', 'referral_activity'] }
      },
      transaction
    }) || 0;

    const conversionRate = user.referralsCount > 0 
      ? (user.premiumReferralsCount / user.referralsCount) * 100 
      : 0;

    return {
      totalReferrals: user.referralsCount,
      totalEarned,
      conversionRate
    };
  }

  /**
   * Получение всех достижений
   */
  private async getAllAchievements(): Promise<ReferralAchievement[]> {
    const achievements = await sequelize.query(`
      SELECT id, name, description, icon, category, requirements_type, requirements_value, 
             rewards_gram, rewards_title, rewards_multiplier_bonus, rarity, is_hidden
      FROM referral_achievements
      WHERE is_active = true
    `, { type: QueryTypes.SELECT }) as any[];

    return achievements.map(row => ({
      id: row.id,
      name: row.name,
      description: row.description,
      icon: row.icon,
      category: row.category,
      requirements: {
        type: row.requirements_type,
        value: row.requirements_value
      },
      rewards: {
        gram: row.rewards_gram,
        title: row.rewards_title,
        multiplierBonus: row.rewards_multiplier_bonus
      },
      rarity: row.rarity,
      isHidden: row.is_hidden
    }));
  }

  /**
   * Получение заработанных достижений пользователя
   */
  private async getEarnedAchievements(
    userId: number,
    transaction: Transaction
  ): Promise<Array<{ achievementId: string; earnedAt: Date }>> {
    const earned = await sequelize.query(`
      SELECT achievement_id, earned_at
      FROM user_referral_achievements
      WHERE user_id = :userId
    `, {
      replacements: { userId },
      type: QueryTypes.SELECT,
      transaction
    }) as any[];

    return earned.map(row => ({
      achievementId: row.achievement_id,
      earnedAt: new Date(row.earned_at)
    }));
  }

  /**
   * Проверка выполнения достижения
   */
  private isAchievementCompleted(
    achievement: ReferralAchievement,
    userStats: any
  ): boolean {
    const { type, value } = achievement.requirements;
    
    switch (type) {
      case 'referrals_count':
        return userStats.totalReferrals >= value;
      case 'total_earned':
        return userStats.totalEarned >= value;
      case 'conversion_rate':
        return userStats.conversionRate >= value;
      default:
        return false;
    }
  }

  /**
   * Получение конфигурации
   */
  getConfig(): ReferralConfig {
    return { ...this.config };
  }

  /**
   * Обновление конфигурации
   */
  updateConfig(newConfig: Partial<ReferralConfig>): void {
    this.config = {
      ...this.config,
      ...newConfig,
      rewards: { ...this.config.rewards, ...newConfig.rewards },
      limits: { ...this.config.limits, ...newConfig.limits },
      features: { ...this.config.features, ...newConfig.features },
      campaigns: { ...this.config.campaigns, ...newConfig.campaigns }
    };
    
    logger.info('Referral service configuration updated', newConfig);
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