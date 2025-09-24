// src/services/user/UserServiceExtended.ts
import { Transaction, Op, QueryTypes } from 'sequelize';
import { UserService } from './UserService';
import { UserServiceAnalytics } from './UserServiceAnalytics';
import { User, Transaction as TransactionModel } from '../../database/models';
import { sequelize } from '../../database/config';
import { 
  UserProfile, 
  UserPreferences, 
  UserDataExport,
  UserSession,
  AdminUserAction
} from './types';
import { AppError } from '../../utils/errors';
import { logger } from '../../utils/logger';
import { encryptSensitiveData, decryptSensitiveData } from '../../utils/encryption';

export class UserServiceExtended extends UserService {
  public analytics: UserServiceAnalytics;

  constructor() {
    super();
    this.analytics = new UserServiceAnalytics();
  }

  /**
   * Получение полного профиля пользователя
   */
  async getUserProfile(userId: number): Promise<UserProfile> {
    const user = await User.findByPk(userId, {
      attributes: { exclude: ['telegramId'] } // Исключаем чувствительные данные
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    // Получаем статистику
    const stats = await this.getUserStats(userId);

    // Получаем достижения пользователя
    const achievements = await this.getUserAchievements(userId);

    // Информация о рефереле
    const referrer = user.referrerId ? await User.findByPk(user.referrerId, {
      attributes: ['id', 'username', 'level']
    }) : null;

    // Заработок с рефералов
    const referralEarnings = await TransactionModel.sum('amount', {
      where: {
        userId,
        type: { [Op.in]: ['referral_reward', 'referral_premium_bonus', 'referral_activity'] }
      }
    }) || 0;

    return {
      user: {
        id: user.id,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        level: user.level,
        isPremium: user.isPremium,
        premiumExpiresAt: user.premiumExpiresAt,
        registeredAt: user.registeredAt,
        lastActiveAt: user.lastActiveAt
      },
      stats,
      achievements,
      referralInfo: {
        referralCode: user.referralCode,
        referrer: referrer ? {
          id: referrer.id,
          username: referrer.username,
          level: referrer.level
        } : undefined,
        directReferrals: user.referralsCount,
        totalReferralEarnings: referralEarnings
      }
    };
  }

  /**
   * Обновление предпочтений пользователя
   */
  async updateUserPreferences(
    userId: number,
    preferences: Partial<UserPreferences>,
    transaction?: Transaction
  ): Promise<void> {
    return await this.executeInTransaction(transaction, async (t) => {
      const user = await User.findByPk(userId, { transaction: t });
      
      if (!user) {
        throw new AppError('User not found', 404);
      }

      // Объединяем с существующими настройками
      const currentSettings = user.notificationSettings || {};
      const updatedSettings = {
        ...currentSettings,
        ...preferences.notifications
      };

      await user.update({
        languageCode: preferences.language || user.languageCode,
        notificationSettings: updatedSettings
      }, { transaction: t });

      // Сохраняем расширенные предпочтения в отдельной таблице
      if (preferences.timezone || preferences.theme || preferences.privacy || preferences.display) {
        await sequelize.query(`
          INSERT INTO user_preferences (user_id, timezone, theme, privacy_settings, display_settings, updated_at)
          VALUES (:userId, :timezone, :theme, :privacy, :display, NOW())
          ON CONFLICT (user_id) DO UPDATE SET
            timezone = COALESCE(:timezone, user_preferences.timezone),
            theme = COALESCE(:theme, user_preferences.theme),
            privacy_settings = COALESCE(:privacy, user_preferences.privacy_settings),
            display_settings = COALESCE(:display, user_preferences.display_settings),
            updated_at = NOW()
        `, {
          replacements: {
            userId,
            timezone: preferences.timezone || null,
            theme: preferences.theme || null,
            privacy: JSON.stringify(preferences.privacy || {}),
            display: JSON.stringify(preferences.display || {})
          },
          type: QueryTypes.INSERT,
          transaction: t
        });
      }

      logger.info(`User preferences updated: ${userId}`);
    });
  }

  /**
   * Создание сессии пользователя
   */
  async createUserSession(
    userId: number,
    deviceInfo: UserSession['deviceInfo']
  ): Promise<UserSession> {
    const sessionId = `session_${Date.now()}_${userId}`;
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 дней

    const session: UserSession = {
      id: sessionId,
      userId,
      deviceInfo,
      isActive: true,
      lastActivity: new Date(),
      createdAt: new Date(),
      expiresAt
    };

    await sequelize.query(`
      INSERT INTO user_sessions (
        id, user_id, device_platform, device_version, ip, user_agent,
        is_active, last_activity, created_at, expires_at
      ) VALUES (
        :id, :userId, :platform, :version, :ip, :userAgent,
        :isActive, NOW(), NOW(), :expiresAt
      )
    `, {
      replacements: {
        id: sessionId,
        userId,
        platform: deviceInfo.platform,
        version: deviceInfo.version,
        ip: deviceInfo.ip,
        userAgent: deviceInfo.userAgent,
        isActive: true,
        expiresAt
      },
      type: QueryTypes.INSERT
    });

    // Обновляем время последней активности пользователя
    await this.updateLastActive(userId);

    logger.info(`User session created: ${sessionId} for user ${userId}`);
    return session;
  }

  /**
   * Массовое обновление пользователей (админ функция)
   */
  async bulkUpdateUsers(
    userIds: number[],
    updates: {
      level?: string;
      isPremium?: boolean;
      isBanned?: boolean;
      balance?: number;
    },
    adminId: number
  ): Promise<{
    successful: number[];
    failed: Array<{ userId: number; error: string }>;
  }> {
    const successful: number[] = [];
    const failed: Array<{ userId: number; error: string }> = [];

    await sequelize.transaction(async (t) => {
      for (const userId of userIds) {
        try {
          const user = await User.findByPk(userId, { transaction: t });
          
          if (!user) {
            failed.push({ userId, error: 'User not found' });
            continue;
          }

          // Применяем обновления
          const updateData: any = {};
          if (updates.level) updateData.level = updates.level;
          if (updates.isPremium !== undefined) updateData.isPremium = updates.isPremium;
          if (updates.isBanned !== undefined) updateData.isBanned = updates.isBanned;

          await user.update(updateData, { transaction: t });

          // Если обновляем баланс
          if (updates.balance !== undefined) {
            const balanceDiff = updates.balance - user.balance;
            await this.updateBalance(userId, balanceDiff, 0, t);
          }

          // Записываем админское действие
          await this.analytics.executeAdminAction({
            type: 'bulk_update',
            userId,
            adminId,
            reason: `Bulk update: ${Object.keys(updates).join(', ')}`,
            metadata: updates,
            timestamp: new Date()
          }, t);

          successful.push(userId);
        } catch (error) {
          failed.push({
            userId,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }
    });

    logger.info(`Bulk user update by admin ${adminId}: ${successful.length} successful, ${failed.length} failed`);
    return { successful, failed };
  }

  /**
   * Экспорт данных пользователя (GDPR)
   */
  async exportUserData(userId: number): Promise<UserDataExport> {
    const [profile, transactions, tasks, referrals, checks, securityEvents] = await Promise.all([
      this.getUserProfile(userId),
      this.getUserTransactionHistory(userId),
      this.getUserTaskHistory(userId),
      this.getUserReferralHistory(userId),
      this.getUserCheckHistory(userId),
      this.getUserSecurityEvents(userId)
    ]);

    return {
      profile,
      transactions,
      tasks,
      referrals,
      checks,
      securityEvents
    };
  }

  /**
   * Удаление данных пользователя (GDPR)
   */
  async deleteUserData(
    userId: number,
    keepAnonymizedData: boolean = true
  ): Promise<{
    deletedRecords: Record<string, number>;
    anonymizedRecords: Record<string, number>;
  }> {
    const deletedRecords: Record<string, number> = {};
    const anonymizedRecords: Record<string, number> = {};

    await sequelize.transaction(async (t) => {
      if (keepAnonymizedData) {
        // Анонимизируем пользователя
        await User.update({
          username: null,
          firstName: 'Deleted',
          lastName: 'User',
          telegramId: 0, // Заменяем на фиктивный ID
          isActive: false,
          isBanned: true
        }, {
          where: { id: userId },
          transaction: t
        });
        anonymizedRecords.users = 1;

        // Анонимизируем транзакции (оставляем для статистики)
        const transactionCount = await TransactionModel.count({
          where: { userId },
          transaction: t
        });
        await TransactionModel.update({
          description: 'Anonymized transaction'
        }, {
          where: { userId },
          transaction: t
        });
        anonymizedRecords.transactions = transactionCount;
      } else {
        // Полное удаление
        deletedRecords.transactions = await TransactionModel.destroy({
          where: { userId },
          transaction: t
        });

        deletedRecords.sessions = await sequelize.query(
          'DELETE FROM user_sessions WHERE user_id = :userId',
          {
            replacements: { userId },
            type: QueryTypes.DELETE,
            transaction: t
          }
        ) as any;

        deletedRecords.preferences = await sequelize.query(
          'DELETE FROM user_preferences WHERE user_id = :userId',
          {
            replacements: { userId },
            type: QueryTypes.DELETE,
            transaction: t
          }
        ) as any;

        deletedRecords.users = await User.destroy({
          where: { id: userId },
          transaction: t
        });
      }
    });

    logger.info(`User data ${keepAnonymizedData ? 'anonymized' : 'deleted'}: ${userId}`);
    return { deletedRecords, anonymizedRecords };
  }

  /**
   * Поиск пользователей с расширенными критериями
   */
  async searchUsers(query: {
    text?: string;
    level?: string;
    isPremium?: boolean;
    registeredAfter?: Date;
    registeredBefore?: Date;
    lastActiveAfter?: Date;
    lastActiveBefore?: Date;
    minBalance?: number;
    maxBalance?: number;
    minTotalEarned?: number;
    hasReferrals?: boolean;
    isSuspicious?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<{
    users: Array<{
      id: number;
      username?: string;
      firstName?: string;
      level: string;
      balance: number;
      totalEarned: number;
      registeredAt: Date;
      lastActiveAt?: Date;
      flags: string[];
    }>;
    total: number;
  }> {
    const {
      text,
      level,
      isPremium,
      registeredAfter,
      registeredBefore,
      lastActiveAfter,
      lastActiveBefore,
      minBalance,
      maxBalance,
      minTotalEarned,
      hasReferrals,
      isSuspicious,
      limit = 50,
      offset = 0
    } = query;

    let whereClause = 'WHERE u.is_active = true';
    const replacements: any = { limit, offset };

    if (text) {
      whereClause += ' AND (u.username ILIKE :text OR u.first_name ILIKE :text OR u.last_name ILIKE :text)';
      replacements.text = `%${text}%`;
    }

    if (level) {
      whereClause += ' AND u.level = :level';
      replacements.level = level;
    }

    if (isPremium !== undefined) {
      whereClause += ' AND u.is_premium = :isPremium';
      replacements.isPremium = isPremium;
    }

    if (registeredAfter) {
      whereClause += ' AND u.registered_at >= :registeredAfter';
      replacements.registeredAfter = registeredAfter;
    }

    if (registeredBefore) {
      whereClause += ' AND u.registered_at <= :registeredBefore';
      replacements.registeredBefore = registeredBefore;
    }

    if (lastActiveAfter) {
      whereClause += ' AND u.last_active_at >= :lastActiveAfter';
      replacements.lastActiveAfter = lastActiveAfter;
    }

    if (lastActiveBefore) {
      whereClause += ' AND u.last_active_at <= :lastActiveBefore';
      replacements.lastActiveBefore = lastActiveBefore;
    }

    if (minBalance !== undefined) {
      whereClause += ' AND u.balance >= :minBalance';
      replacements.minBalance = minBalance;
    }

    if (maxBalance !== undefined) {
      whereClause += ' AND u.balance <= :maxBalance';
      replacements.maxBalance = maxBalance;
    }

    if (minTotalEarned !== undefined) {
      whereClause += ' AND u.total_earned >= :minTotalEarned';
      replacements.minTotalEarned = minTotalEarned;
    }

    if (hasReferrals !== undefined) {
      whereClause += hasReferrals 
        ? ' AND u.referrals_count > 0'
        : ' AND u.referrals_count = 0';
    }

    // Подозрительная активность
    if (isSuspicious) {
      whereClause += ` AND (
        u.total_earned > u.total_spent * 10 OR
        u.tasks_completed > 1000 OR
        EXISTS (SELECT 1 FROM security_events WHERE user_id = u.id AND severity IN ('high', 'medium'))
      )`;
    }

    const [users, countResult] = await Promise.all([
      sequelize.query(`
        SELECT 
          u.id, u.username, u.first_name, u.level, u.balance, u.total_earned,
          u.registered_at, u.last_active_at, u.tasks_completed, u.referrals_count,
          CASE WHEN u.total_earned > u.total_spent * 5 THEN 'high_earner' END as flag1,
          CASE WHEN u.tasks_completed > 500 THEN 'high_activity' END as flag2,
          CASE WHEN u.referrals_count > 50 THEN 'super_referrer' END as flag3
        FROM users u
        ${whereClause}
        ORDER BY u.total_earned DESC
        LIMIT :limit OFFSET :offset
      `, {
        replacements,
        type: QueryTypes.SELECT
      }),
      sequelize.query(`
        SELECT COUNT(*) as total
        FROM users u
        ${whereClause}
      `, {
        replacements,
        type: QueryTypes.SELECT
      })
    ]) as [any[], any[]];

    return {
      users: users.map(row => ({
        id: row.id,
        username: row.username,
        firstName: row.first_name,
        level: row.level,
        balance: row.balance,
        totalEarned: row.total_earned,
        registeredAt: new Date(row.registered_at),
        lastActiveAt: row.last_active_at ? new Date(row.last_active_at) : undefined,
        flags: [row.flag1, row.flag2, row.flag3].filter(Boolean)
      })),
      total: parseInt((countResult[0] as any).total)
    };
  }

  /**
   * Получение достижений пользователя
   */
  private async getUserAchievements(userId: number): Promise<UserProfile['achievements']> {
    const achievements = await sequelize.query(`
      SELECT ua.achievement_id, ua.earned_at, a.name, a.description, a.category, a.rarity
      FROM user_achievements ua
      JOIN achievements a ON ua.achievement_id = a.id
      WHERE ua.user_id = :userId
      ORDER BY ua.earned_at DESC
    `, {
      replacements: { userId },
      type: QueryTypes.SELECT
    }) as any[];

    return achievements.map(row => ({
      id: row.achievement_id,
      name: row.name,
      description: row.description,
      earnedAt: new Date(row.earned_at),
      category: row.category,
      rarity: row.rarity
    }));
  }

  /**
   * Получение истории транзакций пользователя
   */
  private async getUserTransactionHistory(userId: number): Promise<UserDataExport['transactions']> {
    const transactions = await TransactionModel.findAll({
      where: { userId },
      order: [['createdAt', 'DESC']],
      limit: 1000, // Ограничиваем для GDPR экспорта
      attributes: ['id', 'type', 'amount', 'description', 'createdAt']
    });

    return transactions.map(tx => ({
      id: tx.id,
      type: tx.type,
      amount: tx.amount,
      description: tx.description,
      createdAt: tx.createdAt
    }));
  }

  /**
   * Получение истории заданий пользователя
   */
  private async getUserTaskHistory(userId: number): Promise<UserDataExport['tasks']> {
    // Созданные задания
    const createdTasks = await sequelize.query(`
      SELECT id, title, reward, completed_executions, created_at
      FROM tasks
      WHERE author_id = :userId
      ORDER BY created_at DESC
      LIMIT 500
    `, {
      replacements: { userId },
      type: QueryTypes.SELECT
    }) as any[];

    // Выполненные задания
    const completedTasks = await sequelize.query(`
      SELECT te.task_id, t.title, te.reward_amount, te.completed_at
      FROM task_executions te
      JOIN tasks t ON te.task_id = t.id
      WHERE te.user_id = :userId AND te.status = 'completed'
      ORDER BY te.completed_at DESC
      LIMIT 500
    `, {
      replacements: { userId },
      type: QueryTypes.SELECT
    }) as any[];

    return {
      created: createdTasks.map(row => ({
        id: row.id,
        title: row.title,
        reward: row.reward,
        completions: row.completed_executions,
        createdAt: new Date(row.created_at)
      })),
      completed: completedTasks.map(row => ({
        taskId: row.task_id,
        taskTitle: row.title,
        reward: row.reward_amount,
        completedAt: new Date(row.completed_at)
      }))
    };
  }

  /**
   * Получение истории рефералов
   */
  private async getUserReferralHistory(userId: number): Promise<UserDataExport['referrals']> {
    const referrals = await sequelize.query(`
      SELECT 
        u.id as referred_user_id,
        u.registered_at,
        COALESCE(SUM(t.amount), 0) as earnings
      FROM users u
      LEFT JOIN transactions t ON t.user_id = :userId 
        AND t.related_user_id = u.id 
        AND t.type LIKE 'referral_%'
      WHERE u.referrer_id = :userId
      GROUP BY u.id, u.registered_at
      ORDER BY u.registered_at DESC
    `, {
      replacements: { userId },
      type: QueryTypes.SELECT
    }) as any[];

    return referrals.map(row => ({
      referredUserId: row.referred_user_id,
      registeredAt: new Date(row.registered_at),
      earnings: parseInt(row.earnings)
    }));
  }

  /**
   * Получение истории чеков
   */
  private async getUserCheckHistory(userId: number): Promise<UserDataExport['checks']> {
    // Созданные чеки
    const createdChecks = await sequelize.query(`
      SELECT id, total_amount, current_activations, created_at
      FROM checks
      WHERE creator_id = :userId
      ORDER BY created_at DESC
    `, {
      replacements: { userId },
      type: QueryTypes.SELECT
    }) as any[];

    // Активированные чеки
    const activatedChecks = await sequelize.query(`
      SELECT ca.check_id, ca.amount, ca.activated_at
      FROM check_activations ca
      WHERE ca.user_id = :userId
      ORDER BY ca.activated_at DESC
    `, {
      replacements: { userId },
      type: QueryTypes.SELECT
    }) as any[];

    return {
      created: createdChecks.map(row => ({
        checkId: row.id,
        amount: row.total_amount,
        activations: row.current_activations,
        createdAt: new Date(row.created_at)
      })),
      activated: activatedChecks.map(row => ({
        checkId: row.check_id,
        amount: row.amount,
        activatedAt: new Date(row.activated_at)
      }))
    };
  }

  /**
   * Получение событий безопасности пользователя
   */
  private async getUserSecurityEvents(userId: number): Promise<UserDataExport['securityEvents']> {
    const events = await sequelize.query(`
      SELECT id, type, severity, details, ip, user_agent, created_at
      FROM security_events
      WHERE user_id = :userId
      ORDER BY created_at DESC
      LIMIT 100
    `, {
      replacements: { userId },
      type: QueryTypes.SELECT
    }) as any[];

    return events.map(row => ({
      id: row.id,
      userId,
      type: row.type,
      severity: row.severity,
      details: JSON.parse(row.details || '{}'),
      ip: row.ip,
      userAgent: row.user_agent,
      createdAt: new Date(row.created_at)
    }));
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

    return await sequelize.transaction(operation);
  }
}