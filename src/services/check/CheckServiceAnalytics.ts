// src/services/check/CheckServiceAnalytics.ts
import { Op } from 'sequelize';
import { Check, CheckActivation, User } from '../../database/models';
import { 
  UserCheckStats, 
  ActivationAnalytics, 
  CheckRecommendations,
  SecurityAlert,
  FraudDetectionResult,
  CheckType
} from './types';
import { logger } from '../../utils/logger';

export class CheckServiceAnalytics {
  /**
   * Получение детальной статистики пользователя по чекам
   */
  async getUserCheckStats(
    userId: number, 
    period?: { from: Date; to: Date }
  ): Promise<UserCheckStats> {
    const whereConditions: any = {};
    const activationWhere: any = {};
    
    if (period) {
      whereConditions.createdAt = {
        [Op.gte]: period.from,
        [Op.lte]: period.to
      };
      activationWhere.activatedAt = {
        [Op.gte]: period.from,
        [Op.lte]: period.to
      };
    }
    
    // Статистика созданных чеков
    const createdChecks = await Check.findAll({
      where: { creatorId: userId, ...whereConditions },
      attributes: ['totalAmount', 'currentActivations', 'maxActivations', 'isActive', 'createdAt']
    });

    // Статистика полученных активаций
    const receivedActivations = await CheckActivation.findAll({
      where: { userId, ...activationWhere },
      attributes: ['amount', 'activatedAt']
    });

    const totalCreatedAmount = createdChecks.reduce((sum, c) => sum + c.totalAmount, 0);
    const totalCreatedActivated = createdChecks.reduce((sum, c) => sum + c.currentActivations, 0);
    const averageCreatedActivationRate =
      createdChecks.length > 0
        ? createdChecks.reduce((sum, c) => sum + (c.currentActivations / c.maxActivations), 0) / createdChecks.length
        : 0;

    const created = {
      total: createdChecks.length,
      active: createdChecks.filter(c => c.isActive).length,
      totalAmount: totalCreatedAmount,
      totalActivated: totalCreatedActivated,
      averageActivationRate: averageCreatedActivationRate
    };

    const totalAmount = receivedActivations.reduce((sum, a) => sum + a.amount, 0);
    const averageAmount = receivedActivations.length > 0
      ? totalAmount / receivedActivations.length
      : 0;

    // === Агрегаты для receivedActivations ===
    const totalReceivedAmount = receivedActivations.reduce((sum, a) => sum + a.amount, 0);
    const averageReceivedAmount =
      receivedActivations.length > 0 ? totalReceivedAmount / receivedActivations.length : 0;
    const lastActivation =
      receivedActivations.length > 0
        ? Math.max(...receivedActivations.map(a => a.activatedAt.getTime()))
        : undefined;

    const received = {
      total: receivedActivations.length,
      totalAmount: totalReceivedAmount,
      averageAmount: averageReceivedAmount,
      lastActivation
    };

    // Тренды по месяцам (последние 12 месяцев)
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    const monthlyCreated = await this.getMonthlyTrends(
      'Check', 
      { creatorId: userId, createdAt: { [Op.gte]: twelveMonthsAgo } }
    );

    const monthlyReceived = await this.getMonthlyTrends(
      'CheckActivation',
      { userId, activatedAt: { [Op.gte]: twelveMonthsAgo } }
    );

    return {
      created,
      received: {
        ...received,
        lastActivation: received.lastActivation ? new Date(received.lastActivation) : undefined
      },
      trends: {
        createdByMonth: monthlyCreated,
        receivedByMonth: monthlyReceived
      }
    };
  }

  /**
   * Аналитика активаций по времени и поведению
   */
  async getActivationAnalytics(
    period?: { from: Date; to: Date }
  ): Promise<ActivationAnalytics> {
    const whereConditions: any = {};
    
    if (period) {
      whereConditions.activatedAt = {
        [Op.gte]: period.from,
        [Op.lte]: period.to
      };
    }

    const activations = await CheckActivation.findAll({
      where: whereConditions,
      include: [{ 
        model: Check, 
        as: 'check',
        include: [{ model: User, as: 'creator' }]
      }],
      order: [['activatedAt', 'ASC']]
    });

    // Распределение по времени
    const hourlyStats = Array.from({ length: 24 }, (_, hour) => ({
      hour,
      count: 0,
      amount: 0
    }));

    const dailyStats = new Map<string, { count: number; amount: number }>();
    const weeklyStats = new Map<string, { count: number; amount: number }>();
    const monthlyStats = new Map<string, { count: number; amount: number }>();

    // Анализ поведения пользователей
    const userActivations = new Map<number, {
      count: number;
      totalAmount: number;
      firstActivation: Date;
      lastActivation: Date;
      averageTime: number;
    }>();

    activations.forEach(activation => {
      const date = activation.activatedAt;
      const hour = date.getHours();
      const dayKey = date.toISOString().split('T')[0];
      const weekKey = `${date.getFullYear()}-W${Math.ceil(date.getDate() / 7)}`;
      const monthKey = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;

      // Почасовая статистика
      hourlyStats[hour].count++;
      hourlyStats[hour].amount += activation.amount;

      // Дневная статистика
      if (!dailyStats.has(dayKey)) {
        dailyStats.set(dayKey, { count: 0, amount: 0 });
      }
      const dayData = dailyStats.get(dayKey)!;
      dayData.count++;
      dayData.amount += activation.amount;

      // Недельная и месячная статистика
      if (!weeklyStats.has(weekKey)) {
        weeklyStats.set(weekKey, { count: 0, amount: 0 });
      }
      if (!monthlyStats.has(monthKey)) {
        monthlyStats.set(monthKey, { count: 0, amount: 0 });
      }
      
      weeklyStats.get(weekKey)!.count++;
      weeklyStats.get(weekKey)!.amount += activation.amount;
      monthlyStats.get(monthKey)!.count++;
      monthlyStats.get(monthKey)!.amount += activation.amount;

      // Статистика пользователей
      const userId = activation.userId;
      if (!userActivations.has(userId)) {
        userActivations.set(userId, {
          count: 0,
          totalAmount: 0,
          firstActivation: date,
          lastActivation: date,
          averageTime: 0
        });
      }

      const userData = userActivations.get(userId)!;
      userData.count++;
      userData.totalAmount += activation.amount;
      if (date < userData.firstActivation) userData.firstActivation = date;
      if (date > userData.lastActivation) userData.lastActivation = date;
    });

    // Определение новых vs возвращающихся пользователей
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const newUsers = new Set<number>();
    const returningUsers = new Set<number>();

    for (const [userId, data] of userActivations) {
      if (data.firstActivation >= thirtyDaysAgo) {
        newUsers.add(userId);
      } else {
        returningUsers.add(userId);
      }
    }

    const newUserAmount = Array.from(newUsers).reduce((sum, userId) => {
      return sum + (userActivations.get(userId)?.totalAmount || 0);
    }, 0);

    const returningUserAmount = Array.from(returningUsers).reduce((sum, userId) => {
      return sum + (userActivations.get(userId)?.totalAmount || 0);
    }, 0);

    // Топ быстрые пользователи
    const fastestUsers = Array.from(userActivations.entries())
      .filter(([, data]) => data.count >= 3) // Минимум 3 активации для статистики
      .map(([userId, data]) => {
        const timeSpan = data.lastActivation.getTime() - data.firstActivation.getTime();
        const averageTime = data.count > 1 ? timeSpan / (data.count - 1) / 1000 / 60 : 0; // в минутах
        
        return {
          userId,
          username: undefined, // Нужно будет подгружать отдельно
          averageTime: Math.round(averageTime),
          activationsCount: data.count
        };
      })
      .sort((a, b) => a.averageTime - b.averageTime)
      .slice(0, 10);

    return {
      timeDistribution: {
        hourly: hourlyStats,
        daily: Array.from(dailyStats.entries()).map(([date, data]) => ({
          date,
          count: data.count,
          amount: data.amount
        })),
        weekly: Array.from(weeklyStats.entries()).map(([week, data]) => ({
          week,
          count: data.count,
          amount: data.amount
        })),
        monthly: Array.from(monthlyStats.entries()).map(([month, data]) => ({
          month,
          count: data.count,
          amount: data.amount
        }))
      },
      userBehavior: {
        newVsReturning: {
          newUsers: newUsers.size,
          returningUsers: returningUsers.size,
          newUserAmount,
          returningUserAmount
        },
        averageActivationTime: this.calculateAverageActivationTime(activations),
        fastestUsers
      }
    };
  }

  /**
   * Генерация рекомендаций для создания чека
   */
  async getCheckRecommendations(userId: number): Promise<CheckRecommendations> {
    // Анализ истории пользователя
    const userHistory = await this.getUserCheckStats(userId);
    
    // Анализ общих трендов платформы
    const platformStats = await this.getPlatformTrends();

    // Анализ успешных чеков пользователя
    const successfulChecks = await Check.findAll({
      where: {
        creatorId: userId,
        currentActivations: { [Op.gt]: 0 }
      },
      attributes: ['totalAmount', 'currentActivations', 'maxActivations', 'type']
    });

    // Рекомендуемая сумма
    let suggestedAmount = 100; // Базовое значение
    let amountReason = 'Platform average';
    let basedOn: 'user_history' | 'platform_average' | 'trend_analysis' = 'platform_average';

    if (successfulChecks.length > 0) {
      const avgSuccessful = successfulChecks.reduce((sum, c) => sum + c.totalAmount, 0) / successfulChecks.length;
      suggestedAmount = Math.round(avgSuccessful * 1.1); // На 10% больше среднего успешного
      amountReason = 'Based on your successful checks history';
      basedOn = 'user_history';
    } else if (platformStats.averageSuccessfulAmount > 0) {
      suggestedAmount = platformStats.averageSuccessfulAmount;
      amountReason = 'Based on platform trends';
      basedOn = 'trend_analysis';
    }

    // Лучшее время для создания  
    const bestTime = await this.getBestCreationTime();

    // Рекомендации по функциям
    const passwordRecommendation = suggestedAmount > 500; // Для больших сумм
    const subscriptionRecommendation = userHistory.created.averageActivationRate < 50; // Если низкая активность

    const estimatedActivationRate = await this.estimateActivationRate(suggestedAmount, userId);

    return {
      optimalAmount: {
        suggested: suggestedAmount,
        reason: amountReason,
        basedOn
      },
      bestTimeToCreate: bestTime,
      targetAudience: {
        recommendedLevels: this.getRecommendedLevels(suggestedAmount),
        estimatedActivationRate
      },
      features: {
        usePassword: passwordRecommendation,
        useSubscriptionRequirement: subscriptionRecommendation,
        reasons: [
          passwordRecommendation ? 'Large amount - password recommended' : 'Small amount - password not needed',
          subscriptionRecommendation ? 'Low activation rate - try subscription requirement' : 'Good activation rate - no subscription needed'
        ]
      }
    };
  }

  /**
   * Обнаружение мошеннической активности
   */
  async detectFraud(
    userId: number, 
    checkData?: any, 
    activationData?: any
  ): Promise<FraudDetectionResult> {
    const flags: Array<{
      type: string;
      severity: 'low' | 'medium' | 'high';
      description: string;
      confidence: number;
    }> = [];

    let riskScore = 0;

    // Анализ активности пользователя за последние 24 часа
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const recentActivations = await CheckActivation.count({
      where: {
        userId,
        activatedAt: { [Op.gte]: oneDayAgo }
      }
    });

    const recentChecksCreated = await Check.count({
      where: {
        creatorId: userId,
        createdAt: { [Op.gte]: oneDayAgo }
      }
    });

    // Флаг: Слишком много активаций
    if (recentActivations > 50) {
      flags.push({
        type: 'rapid_activations',
        severity: 'high',
        description: `${recentActivations} activations in 24 hours`,
        confidence: 90
      });
      riskScore += 30;
    } else if (recentActivations > 20) {
      flags.push({
        type: 'many_activations',
        severity: 'medium',
        description: `${recentActivations} activations in 24 hours`,
        confidence: 70
      });
      riskScore += 15;
    }

    // Флаг: Слишком много созданных чеков
    if (recentChecksCreated > 10) {
      flags.push({
        type: 'rapid_creation',
        severity: 'high',
        description: `${recentChecksCreated} checks created in 24 hours`,
        confidence: 85
      });
      riskScore += 25;
    }

    // Анализ паттернов времени
    const userActivations = await CheckActivation.findAll({
      where: { 
        userId,
        activatedAt: { [Op.gte]: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
      },
      attributes: ['activatedAt']
    });

    if (userActivations.length > 10) {
      const timePattern = this.analyzeTimePattern(userActivations.map(a => a.activatedAt));
      if (timePattern.isSuspicious) {
        flags.push({
          type: 'suspicious_pattern',
          severity: 'medium',
          description: 'Suspicious time pattern detected',
          confidence: timePattern.confidence
        });
        riskScore += 20;
      }
    }

    // Анализ создаваемого чека (если есть данные)
    if (checkData) {
      if (checkData.totalAmount > 10000) {
        flags.push({
          type: 'large_amount',
          severity: 'medium',
          description: `Large check amount: ${checkData.totalAmount} GRAM`,
          confidence: 60
        });
        riskScore += 10;
      }

      // Проверка на подозрительные паттерны в комментариях
      if (checkData.comment && this.containsSuspiciousContent(checkData.comment)) {
        flags.push({
          type: 'suspicious_content',
          severity: 'high',
          description: 'Suspicious content in check comment',
          confidence: 80
        });
        riskScore += 25;
      }
    }

    // Определение рекомендуемого действия
    let recommendedAction: 'allow' | 'review' | 'block' | 'restrict';
    let explanation: string;

    if (riskScore >= 70) {
      recommendedAction = 'block';
      explanation = 'High risk activity detected - immediate blocking recommended';
    } else if (riskScore >= 40) {
      recommendedAction = 'review';
      explanation = 'Moderate risk - manual review recommended';
    } else if (riskScore >= 20) {
      recommendedAction = 'restrict';
      explanation = 'Low-moderate risk - apply restrictions and monitoring';
    } else {
      recommendedAction = 'allow';
      explanation = 'Low risk - allow with normal monitoring';
    }

    return {
      isSuspicious: riskScore > 20,
      riskScore,
      flags,
      recommendedAction,
      explanation
    };
  }

  /**
   * Создание алерта безопасности
   */
  async createSecurityAlert(
    userId: number,
    type: SecurityAlert['type'],
    severity: SecurityAlert['severity'],
    details: any,
    checkId?: number
  ): Promise<SecurityAlert> {
    const alert: SecurityAlert = {
      id: `alert_${Date.now()}_${userId}`,
      type,
      severity,
      userId,
      checkId,
      details: {
        description: details.description || 'Suspicious activity detected',
        evidence: details.evidence || {},
        riskScore: details.riskScore || 0,
        automatedAction: details.automatedAction
      },
      status: 'pending',
      createdAt: new Date()
    };

    // Здесь должна быть логика сохранения в БД
    // await SecurityAlert.create(alert);

    logger.warn(`Security alert created: ${alert.id}`, {
      userId,
      type,
      severity,
      riskScore: details.riskScore
    });

    return alert;
  }

  /**
   * Очистка истекших чеков
   */
  async cleanupExpiredChecks(): Promise<{
    cleanedCount: number;
    totalRefunded: number;
  }> {
    const expiredChecks = await Check.findAll({
      where: {
        isActive: true,
        expiresAt: { [Op.lte]: new Date() }
      },
      include: [{ model: User, as: 'creator' }]
    });

    let totalRefunded = 0;
    let cleanedCount = 0;

    for (const check of expiredChecks) {
      const remainingAmount = (check.maxActivations - check.currentActivations) * check.amountPerActivation;
      
      if (remainingAmount > 0) {
        // Возвращаем средства создателю
        // await this.userService.updateBalance(check.creatorId, remainingAmount, 0);
        totalRefunded += remainingAmount;
      }

      await check.update({ isActive: false });
      cleanedCount++;
    }

    logger.info(`Cleaned up ${cleanedCount} expired checks, refunded ${totalRefunded} GRAM`);

    return {
      cleanedCount,
      totalRefunded
    };
  }

  /**
   * Получение трендов платформы
   */
  private async getPlatformTrends(): Promise<{
    averageSuccessfulAmount: number;
    popularTypes: CheckType[];
    bestPerformingHours: number[];
  }> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    const successfulChecks = await Check.findAll({
      where: {
        createdAt: { [Op.gte]: thirtyDaysAgo },
        currentActivations: { [Op.gt]: 0 }
      },
      attributes: ['totalAmount', 'type']
    });

    const averageSuccessfulAmount = successfulChecks.length > 0
      ? successfulChecks.reduce((sum, c) => sum + c.totalAmount, 0) / successfulChecks.length
      : 100;

    const typeCount = successfulChecks.reduce((acc, check) => {
      acc[check.type] = (acc[check.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const popularTypes = Object.entries(typeCount)
      .sort(([,a], [,b]) => b - a)
      .map(([type]) => type as CheckType);

    // Анализ активности по часам
    const activations = await CheckActivation.findAll({
      where: {
        activatedAt: { [Op.gte]: thirtyDaysAgo }
      },
      attributes: ['activatedAt']
    });

    const hourlyActivity = Array.from({ length: 24 }, () => 0);
    activations.forEach(activation => {
      hourlyActivity[activation.activatedAt.getHours()]++;
    });

    const bestPerformingHours = hourlyActivity
      .map((count, hour) => ({ hour, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6)
      .map(item => item.hour);

    return {
      averageSuccessfulAmount: Math.round(averageSuccessfulAmount),
      popularTypes,
      bestPerformingHours
    };
  }

  /**
   * Получение лучшего времени для создания чека
   */
  private async getBestCreationTime(): Promise<{
    hour: number;
    dayOfWeek: number;
    reason: string;
  }> {
    const trends = await this.getPlatformTrends();
    
    return {
      hour: trends.bestPerformingHours[0] || 14, // По умолчанию 14:00
      dayOfWeek: 1, // Понедельник (нужна более сложная логика)
      reason: 'Based on platform activity analysis'
    };
  }

  /**
   * Получение рекомендуемых уровней пользователей
   */
  private getRecommendedLevels(amount: number): string[] {
    if (amount <= 100) {
      return ['bronze', 'silver', 'gold', 'premium'];
    } else if (amount <= 500) {
      return ['silver', 'gold', 'premium'];
    } else if (amount <= 1000) {
      return ['gold', 'premium'];
    } else {
      return ['premium'];
    }
  }

  /**
   * Оценка вероятности активации
   */
  private async estimateActivationRate(amount: number, userId: number): Promise<number> {
    // Базовая логика оценки - можно расширить
    const baseRate = 70; // Базовая вероятность 70%
    
    if (amount > 1000) return baseRate - 20;
    if (amount > 500) return baseRate - 10;
    if (amount > 100) return baseRate;
    
    return baseRate + 10; // Маленькие суммы активируются чаще
  }

  /**
   * Расчет среднего времени активации
   */
  private calculateAverageActivationTime(activations: any[]): number {
    if (activations.length < 2) return 0;

    const times = activations.map(a => a.activatedAt.getTime());
    const intervals = [];
    
    for (let i = 1; i < times.length; i++) {
      intervals.push(times[i] - times[i-1]);
    }

    const averageMs = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
    return Math.round(averageMs / 1000 / 60); // В минутах
  }

  /**
   * Анализ временных паттернов активности
   */
  private analyzeTimePattern(timestamps: Date[]): {
    isSuspicious: boolean;
    confidence: number;
    pattern: string;
  } {
    if (timestamps.length < 5) {
      return { isSuspicious: false, confidence: 0, pattern: 'insufficient_data' };
    }

    const intervals = [];
    for (let i = 1; i < timestamps.length; i++) {
      intervals.push(timestamps[i].getTime() - timestamps[i-1].getTime());
    }

    // Проверка на слишком регулярные интервалы (ботоподобное поведение)
    const averageInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
    const variance = intervals.reduce((sum, interval) => sum + Math.pow(interval - averageInterval, 2), 0) / intervals.length;
    const standardDeviation = Math.sqrt(variance);
    const coefficientOfVariation = standardDeviation / averageInterval;

    // Если коэффициент вариации слишком мал, это подозрительно
    if (coefficientOfVariation < 0.1 && averageInterval < 60000) { // Менее 10% вариации и интервал < 1 минуты
      return {
        isSuspicious: true,
        confidence: 85,
        pattern: 'too_regular'
      };
    }

    // Проверка на слишком быстрые активации
    const fastActivations = intervals.filter(interval => interval < 5000).length; // < 5 секунд
    if (fastActivations > intervals.length * 0.5) {
      return {
        isSuspicious: true,
        confidence: 90,
        pattern: 'too_fast'
      };
    }

    return { isSuspicious: false, confidence: 0, pattern: 'normal' };
  }

  /**
   * Проверка подозрительного содержимого
   */
  private containsSuspiciousContent(text: string): boolean {
    const suspiciousPatterns = [
      /bot|автобот|накрутк/i,
      /мошен|обман|развод/i,
      /взлом|hack|fraud/i,
      /продам|куплю|обмен/i // Коммерческая активность
    ];

    return suspiciousPatterns.some(pattern => pattern.test(text));
  }

  /**
   * Получение месячных трендов
   */
  private async getMonthlyTrends(
    modelName: string, 
    whereConditions: any
  ): Promise<Array<{ month: string; count: number; amount: number }>> {
    // Заглушка - в реальной реализации нужно выполнить SQL запрос
    // для группировки по месяцам
    return [];
  }
}