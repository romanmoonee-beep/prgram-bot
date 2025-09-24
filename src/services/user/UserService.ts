// src/services/user/UserService.ts
import { Transaction, Op, QueryTypes } from 'sequelize';
import { User, Transaction as TransactionModel } from '../../database/models';
import { sequelize } from '../../database/config';
import { 
  UserLevel,
  UserCreateData,
  UserUpdateData,
  UserFilters,
  UserStats,
  BalanceOperation
} from './types';
import { 
  LEVEL_REQUIREMENTS,
  LEVEL_BENEFITS,
  REFERRAL_CODE_LENGTH
} from '../../utils/constants';
import { AppError } from '../../utils/errors';
import { logger } from '../../utils/logger';
import { generateReferralCode, hashPassword, validatePassword } from '../../utils/helpers';

export class UserService {
  /**
   * Создание нового пользователя
   */
  async createUser(
    userData: UserCreateData,
    transaction?: Transaction
  ): Promise<User> {
    return await this.executeInTransaction(transaction, async (t) => {
      // Проверяем, не существует ли уже пользователь с таким telegram_id
      const existingUser = await User.findOne({
        where: { telegramId: userData.telegramId },
        transaction: t
      });

      if (existingUser) {
        throw new AppError('User already exists', 409);
      }

      // Генерируем уникальный реферальный код
      const referralCode = await this.generateUniqueReferralCode(t);

      // Создаем пользователя
      const user = await User.create({
        telegramId: userData.telegramId,
        username: userData.username,
        firstName: userData.firstName,
        lastName: userData.lastName,
        languageCode: userData.languageCode || 'en',
        balance: 0,
        frozenBalance: 0,
        level: 'bronze',
        totalEarned: 0,
        totalSpent: 0,
        tasksCompleted: 0,
        tasksCreated: 0,
        referralsCount: 0,
        premiumReferralsCount: 0,
        referrerId: userData.referrerId || null,
        referralCode,
        isActive: true,
        isBanned: false,
        isPremium: false,
        premiumExpiresAt: null,
        notificationSettings: {
          tasks: true,
          referrals: true,
          system: true,
          marketing: false
        },
        lastActiveAt: new Date(),
        registeredAt: new Date()
      }, { transaction: t });

      logger.info(`User created: ${user.id} (${userData.telegramId})`);
      return user;
    });
  }

  /**
   * Получение пользователя по ID
   */
  async getById(userId: number, transaction?: Transaction): Promise<User | null> {
    return await User.findByPk(userId, { transaction });
  }

  /**
   * Получение пользователя по Telegram ID
   */
  async getByTelegramId(telegramId: number, transaction?: Transaction): Promise<User | null> {
    return await User.findOne({
      where: { telegramId },
      transaction
    });
  }

  /**
   * Получение пользователя по реферальному коду
   */
  async getByReferralCode(referralCode: string, transaction?: Transaction): Promise<User | null> {
    return await User.findOne({
      where: { referralCode },
      transaction
    });
  }

  /**
   * Обновление данных пользователя
   */
  async updateUser(
    userId: number,
    updateData: UserUpdateData,
    transaction?: Transaction
  ): Promise<User> {
    return await this.executeInTransaction(transaction, async (t) => {
      const user = await User.findByPk(userId, { transaction: t });
      
      if (!user) {
        throw new AppError('User not found', 404);
      }

      // Обновляем поля
      const updatedUser = await user.update({
        ...updateData,
        updatedAt: new Date()
      }, { transaction: t });

      logger.info(`User updated: ${userId}`);
      return updatedUser;
    });
  }

  /**
   * Обновление баланса пользователя
   */
  async updateBalance(
    userId: number,
    amount: number,
    frozenAmount: number = 0,
    transaction?: Transaction
  ): Promise<User> {
    return await this.executeInTransaction(transaction, async (t) => {
      const user = await User.findByPk(userId, { transaction: t });
      
      if (!user) {
        throw new AppError('User not found', 404);
      }

      const newBalance = user.balance + amount;
      const newFrozenBalance = user.frozenBalance + frozenAmount;

      // Проверяем, что баланс не станет отрицательным
      if (newBalance < 0) {
        throw new AppError('Insufficient balance', 400);
      }

      if (newFrozenBalance < 0) {
        throw new AppError('Invalid frozen balance operation', 400);
      }

      // Обновляем баланс
      const updatedUser = await user.update({
        balance: newBalance,
        frozenBalance: newFrozenBalance,
        totalEarned: amount > 0 ? user.totalEarned + amount : user.totalEarned,
        totalSpent: amount < 0 ? user.totalSpent + Math.abs(amount) : user.totalSpent,
        updatedAt: new Date()
      }, { transaction: t });

      // Проверяем изменение уровня
      await this.checkLevelUp(user, t);

      logger.debug(`Balance updated for user ${userId}: ${amount} GRAM, frozen: ${frozenAmount} GRAM`);
      return updatedUser;
    });
  }

  /**
   * Установка реферера
   */
  async updateReferrer(
    userId: number,
    referrerId: number,
    transaction?: Transaction
  ): Promise<User> {
    return await this.executeInTransaction(transaction, async (t) => {
      const user = await User.findByPk(userId, { transaction: t });
      
      if (!user) {
        throw new AppError('User not found', 404);
      }

      if (user.referrerId) {
        throw new AppError('User already has a referrer', 400);
      }

      if (userId === referrerId) {
        throw new AppError('User cannot refer themselves', 400);
      }

      const updatedUser = await user.update({
        referrerId,
        updatedAt: new Date()
      }, { transaction: t });

      logger.info(`Referrer set for user ${userId}: ${referrerId}`);
      return updatedUser;
    });
  }

  /**
   * Активация Premium
   */
  async activatePremium(
    userId: number,
    durationDays: number = 30,
    transaction?: Transaction
  ): Promise<User> {
    return await this.executeInTransaction(transaction, async (t) => {
      const user = await User.findByPk(userId, { transaction: t });
      
      if (!user) {
        throw new AppError('User not found', 404);
      }

      const now = new Date();
      const expiresAt = user.premiumExpiresAt && user.premiumExpiresAt > now
        ? new Date(user.premiumExpiresAt.getTime() + durationDays * 24 * 60 * 60 * 1000)
        : new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);

      const updatedUser = await user.update({
        isPremium: true,
        premiumExpiresAt: expiresAt,
        level: 'premium',
        updatedAt: new Date()
      }, { transaction: t });

      logger.info(`Premium activated for user ${userId} until ${expiresAt.toISOString()}`);
      return updatedUser;
    });
  }

  /**
   * Деактивация Premium
   */
  async deactivatePremium(
    userId: number,
    transaction?: Transaction
  ): Promise<User> {
    return await this.executeInTransaction(transaction, async (t) => {
      const user = await User.findByPk(userId, { transaction: t });
      
      if (!user) {
        throw new AppError('User not found', 404);
      }

      // Определяем новый уровень на основе общего заработка
      const newLevel = this.calculateLevelByEarnings(user.totalEarned);

      const updatedUser = await user.update({
        isPremium: false,
        premiumExpiresAt: null,
        level: newLevel,
        updatedAt: new Date()
      }, { transaction: t });

      logger.info(`Premium deactivated for user ${userId}, new level: ${newLevel}`);
      return updatedUser;
    });
  }

  /**
   * Бан пользователя
   */
  async banUser(
    userId: number,
    reason: string,
    adminId?: number,
    transaction?: Transaction
  ): Promise<User> {
    return await this.executeInTransaction(transaction, async (t) => {
      const user = await User.findByPk(userId, { transaction: t });
      
      if (!user) {
        throw new AppError('User not found', 404);
      }

      const updatedUser = await user.update({
        isBanned: true,
        isActive: false,
        updatedAt: new Date()
      }, { transaction: t });

      // Записываем информацию о бане
      await sequelize.query(`
        INSERT INTO user_bans (user_id, reason, banned_by, banned_at)
        VALUES (:userId, :reason, :adminId, NOW())
      `, {
        replacements: { userId, reason, adminId },
        type: QueryTypes.INSERT,
        transaction: t
      });

      logger.warn(`User banned: ${userId}, reason: ${reason}, by: ${adminId || 'system'}`);
      return updatedUser;
    });
  }

  /**
   * Разбан пользователя
   */
  async unbanUser(
    userId: number,
    adminId?: number,
    transaction?: Transaction
  ): Promise<User> {
    return await this.executeInTransaction(transaction, async (t) => {
      const user = await User.findByPk(userId, { transaction: t });
      
      if (!user) {
        throw new AppError('User not found', 404);
      }

      const updatedUser = await user.update({
        isBanned: false,
        isActive: true,
        updatedAt: new Date()
      }, { transaction: t });

      // Записываем информацию о разбане
      await sequelize.query(`
        UPDATE user_bans 
        SET unbanned_at = NOW(), unbanned_by = :adminId 
        WHERE user_id = :userId AND unbanned_at IS NULL
      `, {
        replacements: { userId, adminId },
        type: QueryTypes.UPDATE,
        transaction: t
      });

      logger.info(`User unbanned: ${userId}, by: ${adminId || 'system'}`);
      return updatedUser;
    });
  }

  /**
   * Обновление времени последней активности
   */
  async updateLastActive(
    userId: number,
    transaction?: Transaction
  ): Promise<void> {
    await this.executeInTransaction(transaction, async (t) => {
      await User.update(
        { lastActiveAt: new Date() },
        { where: { id: userId }, transaction: t }
      );
    });
  }

  /**
   * Увеличение счетчика выполненных заданий
   */
  async incrementTasksCompleted(
    userId: number,
    transaction?: Transaction
  ): Promise<void> {
    await this.executeInTransaction(transaction, async (t) => {
      await User.increment('tasksCompleted', {
        where: { id: userId },
        transaction: t
      });
    });
  }

  /**
   * Увеличение счетчика созданных заданий
   */
  async incrementTasksCreated(
    userId: number,
    transaction?: Transaction
  ): Promise<void> {
    await this.executeInTransaction(transaction, async (t) => {
      await User.increment('tasksCreated', {
        where: { id: userId },
        transaction: t
      });
    });
  }

  /**
   * Получение списка пользователей с фильтрацией
   */
  async getUsers(
    filters: UserFilters = {}
  ): Promise<{
    users: User[];
    total: number;
    hasMore: boolean;
  }> {
    const {
      level,
      isPremium,
      isBanned,
      isActive,
      hasReferrer,
      registeredFrom,
      registeredTo,
      lastActiveFrom,
      lastActiveTo,
      search,
      sortBy = 'registered_at',
      sortOrder = 'DESC',
      limit = 50,
      offset = 0
    } = filters;

    const whereConditions: any = {};

    if (level) whereConditions.level = level;
    if (isPremium !== undefined) whereConditions.isPremium = isPremium;
    if (isBanned !== undefined) whereConditions.isBanned = isBanned;
    if (isActive !== undefined) whereConditions.isActive = isActive;
    if (hasReferrer !== undefined) {
      whereConditions.referrerId = hasReferrer 
        ? { [Op.not]: null } 
        : { [Op.is]: null };
    }

    if (registeredFrom || registeredTo) {
      whereConditions.registeredAt = {};
      if (registeredFrom) whereConditions.registeredAt[Op.gte] = registeredFrom;
      if (registeredTo) whereConditions.registeredAt[Op.lte] = registeredTo;
    }

    if (lastActiveFrom || lastActiveTo) {
      whereConditions.lastActiveAt = {};
      if (lastActiveFrom) whereConditions.lastActiveAt[Op.gte] = lastActiveFrom;
      if (lastActiveTo) whereConditions.lastActiveAt[Op.lte] = lastActiveTo;
    }

    if (search) {
      whereConditions[Op.or] = [
        { username: { [Op.iLike]: `%${search}%` } },
        { firstName: { [Op.iLike]: `%${search}%` } },
        { lastName: { [Op.iLike]: `%${search}%` } }
      ];
    }

    const { count, rows } = await User.findAndCountAll({
      where: whereConditions,
      limit,
      offset,
      order: [[sortBy, sortOrder]],
      attributes: { exclude: ['telegramId'] } // Исключаем чувствительные данные
    });

    return {
      users: rows,
      total: count,
      hasMore: offset + limit < count
    };
  }

  /**
   * Получение статистики пользователя
   */
  async getUserStats(userId: number): Promise<UserStats> {
    const user = await User.findByPk(userId, {
      attributes: [
        'balance', 'frozenBalance', 'totalEarned', 'totalSpent',
        'tasksCompleted', 'tasksCreated', 'referralsCount', 
        'premiumReferralsCount', 'level', 'registeredAt'
      ]
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    // Получаем дополнительную статистику из БД
    const [earningsData, tasksData] = await Promise.all([
      this.getUserEarningsStats(userId),
      this.getUserTasksStats(userId)
    ]);

    return {
      balance: {
        current: user.balance,
        frozen: user.frozenBalance,
        total: user.balance + user.frozenBalance,
        totalEarned: user.totalEarned,
        totalSpent: user.totalSpent,
        netWorth: user.totalEarned - user.totalSpent
      },
      tasks: {
        completed: user.tasksCompleted,
        created: user.tasksCreated,
        successRate: tasksData.successRate,
        averageReward: tasksData.averageReward,
        totalRewards: tasksData.totalRewards
      },
      referrals: {
        total: user.referralsCount,
        premium: user.premiumReferralsCount,
        conversionRate: user.referralsCount > 0 
          ? (user.premiumReferralsCount / user.referralsCount) * 100 
          : 0,
        totalEarnings: earningsData.referralEarnings
      },
      level: {
        current: user.level as UserLevel,
        benefits: LEVEL_BENEFITS[user.level as UserLevel],
        nextLevel: this.getNextLevel(user.level as UserLevel),
        progress: this.getLevelProgress(user.totalEarned, user.level as UserLevel)
      },
      activity: {
        registeredAt: user.registeredAt,
        daysSinceRegistration: Math.floor(
          (Date.now() - user.registeredAt.getTime()) / (1000 * 60 * 60 * 24)
        ),
        averageDailyActivity: earningsData.averageDailyEarnings
      }
    };
  }

  /**
   * Получение топ пользователей
   */
  async getTopUsers(
    category: 'earnings' | 'referrals' | 'tasks',
    limit: number = 10,
    period?: { from: Date; to: Date }
  ): Promise<Array<{
    user: Partial<User>;
    value: number;
    rank: number;
  }>> {
    let query = '';
    let orderField = '';

    switch (category) {
      case 'earnings':
        orderField = 'total_earned';
        query = `
          SELECT id, username, level, total_earned as value,
                 ROW_NUMBER() OVER (ORDER BY total_earned DESC) as rank
          FROM users 
          WHERE is_active = true AND is_banned = false
          ORDER BY total_earned DESC 
          LIMIT :limit
        `;
        break;

      case 'referrals':
        orderField = 'referrals_count';
        query = `
          SELECT id, username, level, referrals_count as value,
                 ROW_NUMBER() OVER (ORDER BY referrals_count DESC) as rank
          FROM users 
          WHERE is_active = true AND is_banned = false
          ORDER BY referrals_count DESC 
          LIMIT :limit
        `;
        break;

      case 'tasks':
        orderField = 'tasks_completed';
        query = `
          SELECT id, username, level, tasks_completed as value,
                 ROW_NUMBER() OVER (ORDER BY tasks_completed DESC) as rank
          FROM users 
          WHERE is_active = true AND is_banned = false
          ORDER BY tasks_completed DESC 
          LIMIT :limit
        `;
        break;
    }

    const results = await sequelize.query(query, {
      replacements: { limit },
      type: QueryTypes.SELECT
    }) as any[];

    return results.map(row => ({
      user: {
        id: row.id,
        username: row.username,
        level: row.level
      },
      value: parseInt(row.value) || 0,
      rank: parseInt(row.rank)
    }));
  }

  /**
   * Очистка истекших Premium подписок
   */
  async cleanupExpiredPremium(): Promise<number> {
    const expiredUsers = await User.findAll({
      where: {
        isPremium: true,
        premiumExpiresAt: { [Op.lt]: new Date() }
      },
      attributes: ['id', 'totalEarned']
    });

    let cleanedCount = 0;

    for (const user of expiredUsers) {
      const newLevel = this.calculateLevelByEarnings(user.totalEarned);
      
      await user.update({
        isPremium: false,
        premiumExpiresAt: null,
        level: newLevel
      });

      cleanedCount++;
    }

    if (cleanedCount > 0) {
      logger.info(`Cleaned up ${cleanedCount} expired Premium subscriptions`);
    }

    return cleanedCount;
  }

  /**
   * Проверка повышения уровня пользователя
   */
  private async checkLevelUp(user: User, transaction: Transaction): Promise<void> {
    if (user.isPremium) return; // Premium пользователи не повышают уровень по балансу

    const currentLevel = user.level as UserLevel;
    const newLevel = this.calculateLevelByEarnings(user.totalEarned);

    if (newLevel !== currentLevel) {
      await user.update({
        level: newLevel,
        updatedAt: new Date()
      }, { transaction });

      logger.info(`User ${user.id} level up: ${currentLevel} -> ${newLevel}`);
    }
  }

  /**
   * Расчет уровня по общему заработку
   */
  private calculateLevelByEarnings(totalEarned: number): UserLevel {
    if (totalEarned >= LEVEL_REQUIREMENTS.gold) return 'gold';
    if (totalEarned >= LEVEL_REQUIREMENTS.silver) return 'silver';
    return 'bronze';
  }

  /**
   * Получение следующего уровня
   */
  private getNextLevel(currentLevel: UserLevel): UserLevel | null {
    const levels: UserLevel[] = ['bronze', 'silver', 'gold', 'premium'];
    const currentIndex = levels.indexOf(currentLevel);
    return currentIndex < levels.length - 1 ? levels[currentIndex + 1] : null;
  }

  /**
   * Получение прогресса до следующего уровня
   */
  private getLevelProgress(totalEarned: number, currentLevel: UserLevel): {
    current: number;
    required: number;
    percentage: number;
  } {
    const nextLevel = this.getNextLevel(currentLevel);
    if (!nextLevel || nextLevel === 'premium') {
      return { current: totalEarned, required: totalEarned, percentage: 100 };
    }

    const required = LEVEL_REQUIREMENTS[nextLevel];
    const percentage = Math.min((totalEarned / required) * 100, 100);

    return {
      current: totalEarned,
      required,
      percentage: Math.round(percentage)
    };
  }

  /**
   * Генерация уникального реферального кода
   */
  private async generateUniqueReferralCode(transaction: Transaction): Promise<string> {
    let attempts = 0;
    const maxAttempts = 10;

    while (attempts < maxAttempts) {
      const code = generateReferralCode(REFERRAL_CODE_LENGTH);
      
      const existing = await User.findOne({
        where: { referralCode: code },
        transaction
      });

      if (!existing) {
        return code;
      }

      attempts++;
    }

    throw new AppError('Failed to generate unique referral code', 500);
  }

  /**
   * Получение статистики заработка пользователя
   */
  private async getUserEarningsStats(userId: number): Promise<{
    referralEarnings: number;
    averageDailyEarnings: number;
  }> {
    const referralEarnings = await TransactionModel.sum('amount', {
      where: {
        userId,
        type: { [Op.in]: ['referral_reward', 'referral_premium_bonus', 'referral_activity'] }
      }
    }) || 0;

    const user = await User.findByPk(userId, {
      attributes: ['totalEarned', 'registeredAt']
    });

    const daysSinceRegistration = user 
      ? Math.max(1, Math.floor((Date.now() - user.registeredAt.getTime()) / (1000 * 60 * 60 * 24)))
      : 1;

    const averageDailyEarnings = user 
      ? Math.round(user.totalEarned / daysSinceRegistration)
      : 0;

    return {
      referralEarnings,
      averageDailyEarnings
    };
  }

  /**
   * Получение статистики заданий пользователя
   */
  private async getUserTasksStats(userId: number): Promise<{
    successRate: number;
    averageReward: number;
    totalRewards: number;
  }> {
    const taskStats = await sequelize.query(`
      SELECT 
        COUNT(*) as total_executions,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_executions,
        COALESCE(AVG(CASE WHEN status = 'completed' THEN reward_amount END), 0) as average_reward,
        COALESCE(SUM(CASE WHEN status = 'completed' THEN reward_amount END), 0) as total_rewards
      FROM task_executions 
      WHERE user_id = :userId
    `, {
      replacements: { userId },
      type: QueryTypes.SELECT
    }) as any[];

    const stats = taskStats[0] || {};
    const totalExecutions = parseInt(stats.total_executions) || 0;
    const completedExecutions = parseInt(stats.completed_executions) || 0;
    
    return {
      successRate: totalExecutions > 0 ? Math.round((completedExecutions / totalExecutions) * 100) : 0,
      averageReward: Math.round(parseFloat(stats.average_reward) || 0),
      totalRewards: parseInt(stats.total_rewards) || 0
    };
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