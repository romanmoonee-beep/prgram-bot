// src/services/user/UserServiceAnalytics.ts
import { Op, QueryTypes } from 'sequelize';
import { User, Transaction as TransactionModel, TaskExecution } from '../../database/models';
import { sequelize } from '../../database/config';
import { 
  UserAnalytics, 
  UserLevel, 
  BalanceHistory,
  AdminUserAction,
  UserReport,
  SecurityEvent
} from './types';
import { logger } from '../../utils/logger';

export class UserServiceAnalytics {
  /**
   * Получение общей аналитики пользователей
   */
  async getUserAnalytics(period?: { from: Date; to: Date }): Promise<UserAnalytics> {
    const whereConditions: any = {};
    if (period) {
      whereConditions.registeredAt = {
        [Op.gte]: period.from,
        [Op.lte]: period.to
      };
    }

    // Демографические данные
    const [totalUsers, activeUsers, premiumUsers, bannedUsers] = await Promise.all([
      User.count(period ? { where: whereConditions } : {}),
      User.count({ where: { isActive: true, ...whereConditions } }),
      User.count({ where: { isPremium: true, ...whereConditions } }),
      User.count({ where: { isBanned: true, ...whereConditions } })
    ]);

    // Распределение по уровням
    const levelDistribution = await this.getLevelDistribution(period);

    // Тренды регистрации
    const registrationTrends = await this.getRegistrationTrends(period);

    // Активность пользователей
    const engagement = await this.getEngagementMetrics();

    // Экономические показатели
    const economics = await this.getEconomicMetrics(period);

    return {
      demographics: {
        totalUsers,
        activeUsers,
        premiumUsers,
        bannedUsers,
        levelDistribution,
        registrationTrends
      },
      engagement,
      economics
    };
  }

  /**
   * Получение истории баланса пользователя
   */
  async getUserBalanceHistory(
    userId: number,
    period?: { from: Date; to: Date },
    limit: number = 100
  ): Promise<BalanceHistory> {
    const whereConditions: any = { userId };
    
    if (period) {
      whereConditions.createdAt = {
        [Op.gte]: period.from,
        [Op.lte]: period.to
      };
    }

    const operations = await TransactionModel.findAll({
      where: whereConditions,
      order: [['createdAt', 'DESC']],
      limit,
      attributes: [
        'id', 'type', 'amount', 'balanceBefore', 'balanceAfter', 
        'description', 'createdAt', 'metadata'
      ]
    });

    // Статистика
    const totalCredits = operations
      .filter(op => op.amount > 0)
      .reduce((sum, op) => sum + op.amount, 0);

    const totalDebits = Math.abs(operations
      .filter(op => op.amount < 0)
      .reduce((sum, op) => sum + op.amount, 0));

    return {
      operations: operations.map(op => ({
        id: op.id,
        type: op.type,
        amount: op.amount,
        balanceBefore: op.balanceBefore,
        balanceAfter: op.balanceAfter,
        description: op.description,
        createdAt: op.createdAt,
        metadata: op.metadata
      })),
      summary: {
        totalCredits,
        totalDebits,
        totalOperations: operations.length,
        periodStart: period?.from || operations[operations.length - 1]?.createdAt || new Date(),
        periodEnd: period?.to || operations[0]?.createdAt || new Date()
      }
    };
  }

  /**
   * Создание отчета о пользователе
   */
  async createUserReport(reportData: Omit<UserReport, 'reportId' | 'status' | 'createdAt' | 'updatedAt'>): Promise<UserReport> {
    const reportId = `report_${Date.now()}_${reportData.reportedUserId}`;
    
    const report: UserReport = {
      ...reportData,
      reportId,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Сохраняем в БД
    await sequelize.query(`
      INSERT INTO user_reports (
        report_id, reported_user_id, reporter_id, category, description, 
        evidence, status, created_at, updated_at
      ) VALUES (
        :reportId, :reportedUserId, :reporterId, :category, :description,
        :evidence, :status, NOW(), NOW()
      )
    `, {
      replacements: {
        reportId: report.reportId,
        reportedUserId: report.reportedUserId,
        reporterId: report.reporterId,
        category: report.category,
        description: report.description,
        evidence: JSON.stringify(report.evidence || {}),
        status: report.status
      },
      type: QueryTypes.INSERT
    });

    logger.info(`User report created: ${reportId} against user ${reportData.reportedUserId}`);
    return report;
  }

  /**
   * Получение отчетов о пользователях
   */
  async getUserReports(
    filters: {
      status?: UserReport['status'];
      category?: UserReport['category'];
      reportedUserId?: number;
      reporterId?: number;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{ reports: UserReport[]; total: number }> {
    const {
      status,
      category,
      reportedUserId,
      reporterId,
      limit = 20,
      offset = 0
    } = filters;

    let whereClause = 'WHERE 1=1';
    const replacements: any = { limit, offset };

    if (status) {
      whereClause += ' AND status = :status';
      replacements.status = status;
    }
    if (category) {
      whereClause += ' AND category = :category';
      replacements.category = category;
    }
    if (reportedUserId) {
      whereClause += ' AND reported_user_id = :reportedUserId';
      replacements.reportedUserId = reportedUserId;
    }
    if (reporterId) {
      whereClause += ' AND reporter_id = :reporterId';
      replacements.reporterId = reporterId;
    }

    const [reports, countResult] = await Promise.all([
      sequelize.query(`
        SELECT ur.*, 
               ru.username as reported_username,
               r.username as reporter_username
        FROM user_reports ur
        LEFT JOIN users ru ON ur.reported_user_id = ru.id
        LEFT JOIN users r ON ur.reporter_id = r.id
        ${whereClause}
        ORDER BY ur.created_at DESC
        LIMIT :limit OFFSET :offset
      `, {
        replacements,
        type: QueryTypes.SELECT
      }),
      sequelize.query(`
        SELECT COUNT(*) as total
        FROM user_reports ur
        ${whereClause}
      `, {
        replacements,
        type: QueryTypes.SELECT
      })
    ]) as [any[], any[]];

    return {
      reports: reports.map(row => ({
        reportId: row.report_id,
        reportedUserId: row.reported_user_id,
        reporterId: row.reporter_id,
        category: row.category,
        description: row.description,
        evidence: JSON.parse(row.evidence || '{}'),
        status: row.status,
        assignedTo: row.assigned_to,
        resolution: row.resolution,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at)
      })),
      total: parseInt((countResult[0] as any).total)
    };
  }

  /**
   * Обработка отчета о пользователе
   */
  async resolveUserReport(
    reportId: string,
    resolution: string,
    adminId: number,
    action?: 'ban' | 'warn' | 'dismiss'
  ): Promise<void> {
    await sequelize.transaction(async (t) => {
      // Обновляем статус отчета
      await sequelize.query(`
        UPDATE user_reports 
        SET status = 'resolved', resolution = :resolution, assigned_to = :adminId, updated_at = NOW()
        WHERE report_id = :reportId
      `, {
        replacements: { reportId, resolution, adminId },
        type: QueryTypes.UPDATE,
        transaction: t
      });

      // Если требуется действие, выполняем его
      if (action === 'ban') {
        const report = await this.getReportById(reportId);
        if (report) {
          await this.executeAdminAction({
            type: 'ban',
            userId: report.reportedUserId,
            adminId,
            reason: `Report resolved: ${resolution}`,
            timestamp: new Date()
          }, t);
        }
      }

      logger.info(`User report resolved: ${reportId} by admin ${adminId}, action: ${action || 'none'}`);
    });
  }

  /**
   * Создание события безопасности
   */
  async createSecurityEvent(
    userId: number,
    type: SecurityEvent['type'],
    severity: SecurityEvent['severity'],
    details: Record<string, any>,
    metadata?: { ip?: string; userAgent?: string }
  ): Promise<SecurityEvent> {
    const event: SecurityEvent = {
      id: `sec_${Date.now()}_${userId}`,
      userId,
      type,
      severity,
      details,
      ip: metadata?.ip,
      userAgent: metadata?.userAgent,
      createdAt: new Date()
    };

    await sequelize.query(`
      INSERT INTO security_events (
        id, user_id, type, severity, details, ip, user_agent, created_at
      ) VALUES (
        :id, :userId, :type, :severity, :details, :ip, :userAgent, NOW()
      )
    `, {
      replacements: {
        id: event.id,
        userId,
        type,
        severity,
        details: JSON.stringify(details),
        ip: event.ip,
        userAgent: event.userAgent
      },
      type: QueryTypes.INSERT
    });

    logger.info(`Security event created: ${event.id} for user ${userId}`);
    return event;
  }

  /**
   * Получение подозрительных пользователей
   */
  async getSuspiciousUsers(): Promise<Array<{
    user: User;
    suspicionReasons: string[];
    riskScore: number;
  }>> {
    // Пользователи с подозрительной активностью
    const suspiciousActivity = await sequelize.query(`
      SELECT u.*, 
             COUNT(te.id) as tasks_today,
             COUNT(t.id) as transactions_today,
             AVG(EXTRACT(EPOCH FROM (te.completed_at - te.started_at))/60) as avg_completion_time
      FROM users u
      LEFT JOIN task_executions te ON u.id = te.user_id 
        AND te.created_at >= CURRENT_DATE
      LEFT JOIN transactions t ON u.id = t.user_id 
        AND t.created_at >= CURRENT_DATE
        AND t.type = 'task_reward'
      WHERE u.is_active = true AND u.is_banned = false
      GROUP BY u.id
      HAVING COUNT(te.id) > 50 
         OR COUNT(t.id) > 100
         OR AVG(EXTRACT(EPOCH FROM (te.completed_at - te.started_at))/60) < 0.5
      ORDER BY COUNT(te.id) DESC
      LIMIT 50
    `, {
      type: QueryTypes.SELECT
    }) as any[];

    return suspiciousActivity.map(row => {
      const reasons: string[] = [];
      let riskScore = 0;

      if (row.tasks_today > 50) {
        reasons.push(`Too many tasks completed today: ${row.tasks_today}`);
        riskScore += 30;
      }

      if (row.transactions_today > 100) {
        reasons.push(`Too many transactions today: ${row.transactions_today}`);
        riskScore += 25;
      }

      if (row.avg_completion_time < 0.5) {
        reasons.push(`Suspiciously fast task completion: ${row.avg_completion_time} min`);
        riskScore += 40;
      }

      return {
        user: {
          id: row.id,
          username: row.username,
          level: row.level,
          registeredAt: new Date(row.registered_at),
          totalEarned: row.total_earned
        } as User,
        suspicionReasons: reasons,
        riskScore: Math.min(riskScore, 100)
      };
    });
  }

  /**
   * Выполнение административного действия
   */
  async executeAdminAction(
    action: AdminUserAction,
    transaction?: any
  ): Promise<void> {
    // Записываем действие в лог
    await sequelize.query(`
      INSERT INTO admin_actions (
        type, user_id, admin_id, reason, metadata, timestamp
      ) VALUES (
        :type, :userId, :adminId, :reason, :metadata, NOW()
      )
    `, {
      replacements: {
        type: action.type,
        userId: action.userId,
        adminId: action.adminId,
        reason: action.reason,
        metadata: JSON.stringify(action.metadata || {})
      },
      type: QueryTypes.INSERT,
      transaction
    });

    logger.info(`Admin action executed: ${action.type} on user ${action.userId} by admin ${action.adminId}`);
  }

  /**
   * Получение распределения по уровням
   */
  private async getLevelDistribution(period?: { from: Date; to: Date }): Promise<Record<UserLevel, number>> {
    const whereConditions: any = {};
    if (period) {
      whereConditions.registeredAt = {
        [Op.gte]: period.from,
        [Op.lte]: period.to
      };
    }

    const distribution = await User.findAll({
      where: whereConditions,
      attributes: [
        'level',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      group: ['level'],
      raw: true
    }) as any[];

    const result: Record<UserLevel, number> = {
      bronze: 0,
      silver: 0,
      gold: 0,
      premium: 0
    };

    distribution.forEach(row => {
      result[row.level as UserLevel] = parseInt(row.count);
    });

    return result;
  }

  /**
   * Получение трендов регистрации
   */
  private async getRegistrationTrends(period?: { from: Date; to: Date }): Promise<Array<{
    date: string;
    registrations: number;
    activations: number;
  }>> {
    const fromDate = period?.from || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const toDate = period?.to || new Date();

    const trends = await sequelize.query(`
      SELECT 
        DATE(registered_at) as date,
        COUNT(*) as registrations,
        COUNT(CASE WHEN last_active_at IS NOT NULL THEN 1 END) as activations
      FROM users
      WHERE registered_at >= :fromDate AND registered_at <= :toDate
      GROUP BY DATE(registered_at)
      ORDER BY DATE(registered_at)
    `, {
      replacements: { fromDate, toDate },
      type: QueryTypes.SELECT
    }) as any[];

    return trends.map(row => ({
      date: row.date,
      registrations: parseInt(row.registrations),
      activations: parseInt(row.activations)
    }));
  }

  /**
   * Получение метрик вовлеченности
   */
  private async getEngagementMetrics(): Promise<UserAnalytics['engagement']> {
  /**
   * Получение метрик вовлеченности
   */
  private async getEngagementMetrics(): Promise<UserAnalytics['engagement']> {
    const now = new Date();
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [dailyActive, weeklyActive, monthlyActive] = await Promise.all([
      User.count({ where: { lastActiveAt: { [Op.gte]: dayAgo } } }),
      User.count({ where: { lastActiveAt: { [Op.gte]: weekAgo } } }),
      User.count({ where: { lastActiveAt: { [Op.gte]: monthAgo } } })
    ]);

    // Ретенция пользователей
    const retentionRates = await this.calculateRetentionRates();

    return {
      dailyActiveUsers: dailyActive,
      weeklyActiveUsers: weeklyActive,
      monthlyActiveUsers: monthlyActive,
      averageSessionDuration: 0, // Потребует дополнительного трекинга
      retentionRates
    };
  }

  /**
   * Получение экономических метрик
   */
  private async getEconomicMetrics(period?: { from: Date; to: Date }): Promise<UserAnalytics['economics']> {
    const whereConditions: any = {};
    if (period) {
      whereConditions.registeredAt = {
        [Op.gte]: period.from,
        [Op.lte]: period.to
      };
    }

    const [totalBalance, totalEarnings, totalSpent, averageBalance, topEarners] = await Promise.all([
      User.sum('balance', period ? { where: whereConditions } : {}) || 0,
      User.sum('totalEarned', period ? { where: whereConditions } : {}) || 0,
      User.sum('totalSpent', period ? { where: whereConditions } : {}) || 0,
      User.findOne({
        attributes: [[sequelize.fn('AVG', sequelize.col('balance')), 'avgBalance']],
        where: whereConditions,
        raw: true
      }).then(result => Math.round((result as any)?.avgBalance || 0)),
      User.findAll({
        where: whereConditions,
        attributes: ['id', 'username', 'totalEarned'],
        order: [['totalEarned', 'DESC']],
        limit: 10
      }).then(users => users.map(u => ({
        userId: u.id,
        username: u.username,
        totalEarned: u.totalEarned
      })))
    ]);

    return {
      totalBalance,
      totalEarnings,
      totalSpent,
      averageBalance,
      topEarners
    };
  }

  /**
   * Расчет ретенции пользователей
   */
  private async calculateRetentionRates(): Promise<{
    day1: number;
    day7: number;
    day30: number;
  }> {
    const now = new Date();
    
    // Пользователи, зарегистрированные 1, 7 и 30 дней назад
    const day1Cohort = await User.findAll({
      where: {
        registeredAt: {
          [Op.gte]: new Date(now.getTime() - 25 * 60 * 60 * 1000), // 25 часов назад
          [Op.lte]: new Date(now.getTime() - 23 * 60 * 60 * 1000)  // 23 часа назад
        }
      },
      attributes: ['id', 'lastActiveAt']
    });

    const day7Cohort = await User.findAll({
      where: {
        registeredAt: {
          [Op.gte]: new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000),
          [Op.lte]: new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000)
        }
      },
      attributes: ['id', 'lastActiveAt']
    });

    const day30Cohort = await User.findAll({
      where: {
        registeredAt: {
          [Op.gte]: new Date(now.getTime() - 31 * 24 * 60 * 60 * 1000),
          [Op.lte]: new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000)
        }
      },
      attributes: ['id', 'lastActiveAt']
    });

    const calculateRetention = (cohort: any[], daysAgo: number) => {
      if (cohort.length === 0) return 0;
      
      const cutoffDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
      const activeUsers = cohort.filter(user => 
        user.lastActiveAt && user.lastActiveAt >= cutoffDate
      ).length;
      
      return Math.round((activeUsers / cohort.length) * 100);
    };

    return {
      day1: calculateRetention(day1Cohort, 1),
      day7: calculateRetention(day7Cohort, 7),
      day30: calculateRetention(day30Cohort, 30)
    };
  }

  /**
   * Получение отчета по ID
   */
  private async getReportById(reportId: string): Promise<UserReport | null> {
    const reports = await this.getUserReports({ limit: 1 });
    return reports.reports.find(r => r.reportId === reportId) || null;
  }
}