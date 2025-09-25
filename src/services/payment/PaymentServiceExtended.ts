// src/services/payment/PaymentServiceExtended.ts
import { Transaction, Op, QueryTypes } from 'sequelize';
import { PaymentService } from './PaymentService';
import { UserService } from '../user';
import { TransactionService } from '../transaction/TransactionService';
import { NotificationService } from '../notification/NotificationService';
import { User, Transaction as TransactionModel } from '../../database/models';
import { sequelize } from '../../database/config/database';
import { 
  PaymentAnalytics,
  PaymentReport,
  PaymentProviderConfig,
  WebhookProcessResult,
  TelegramStarsWebhook,
  CryptoWebhook,
  RefundRequest,
  Subscription,
  PromoCode,
  PromoCodeUsage,
  FraudDetectionResult,
  PaymentSecurityEvent,
  ExchangeRate,
  PaymentMethod,
  PaymentStatus,
  Currency,
  PaymentType
} from './types';
import { AppError } from '../../utils/errors';
import { logger } from '../../utils/logger';

export class PaymentServiceExtended extends PaymentService {
  protected providerConfig: PaymentProviderConfig;
  protected exchangeRates: Map<string, ExchangeRate> = new Map();
  protected fraudThreshold: number = 80; // Risk score threshold

  constructor(
    userService: UserService,
    notificationService: NotificationService,
    providerConfig?: PaymentProviderConfig
  ) {
    super(userService, notificationService);
    
    this.providerConfig = providerConfig || {
      telegram: {
        enabled: true,
        testMode: process.env.NODE_ENV !== 'production',
        supportedCurrencies: ['XTR'] // Telegram Stars
      },
      crypto: {
        enabled: false,
        networks: [],
        walletAddress: ''
      },
      cards: {
        enabled: false,
        providers: []
      }
    };

    this.loadExchangeRates();
  }

  /**
   * Обработка Telegram Stars webhook
   */
  async processTelegramStarsWebhook(
    webhook: TelegramStarsWebhook,
    transaction?: Transaction
  ): Promise<WebhookProcessResult> {
    try {
      if (webhook.pre_checkout_query) {
        return await this.handlePreCheckoutQuery(webhook.pre_checkout_query, transaction);
      }

      if (webhook.successful_payment) {
        return await this.handleSuccessfulStarsPayment(webhook.successful_payment, transaction);
      }

      return {
        success: false,
        error: 'Unknown webhook type'
      };
    } catch (error) {
      logger.error('Telegram Stars webhook processing error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        shouldRetry: true,
        retryAfter: 60
      };
    }
  }

  /**
   * Обработка криптовалютного webhook
   */
  async processCryptoWebhook(
    webhook: CryptoWebhook,
    transaction?: Transaction
  ): Promise<WebhookProcessResult> {
    return await this.executeInTransaction(transaction, async (t) => {
      try {
        // Находим платеж по внешнему ID
        const payment = await TransactionModel.findOne({
          where: { 
            externalId: webhook.transaction_id,
            paymentProvider: 'crypto'
          },
          transaction: t
        });

        if (!payment) {
          return {
            success: false,
            error: 'Payment not found'
          };
        }

        if (payment.status !== 'pending') {
          return {
            success: true,
            message: 'Payment already processed'
          };
        }

        if (webhook.status === 'confirmed' && webhook.confirmations >= 3) {
          await this.processSuccessfulPayment(webhook.transaction_id, {
            transactionHash: webhook.transaction_id,
            network: webhook.network,
            confirmations: webhook.confirmations
          }, t);

          return {
            success: true,
            paymentId: payment.id,
            status: PaymentStatus.COMPLETED,
            amount: payment.amount
          };
        }

        if (webhook.status === 'failed') {
          await this.processFailedPayment(
            webhook.transaction_id,
            'Crypto transaction failed',
            webhook,
            t
          );

          return {
            success: true,
            paymentId: payment.id,
            status: PaymentStatus.FAILED,
            message: 'Payment marked as failed'
          };
        }

        // Обновляем метаданные для отслеживания
        await payment.update({
          metadata: {
            ...payment.metadata,
            confirmations: webhook.confirmations,
            lastUpdate: new Date().toISOString()
          }
        }, { transaction: t });

        return {
          success: true,
          message: 'Webhook processed, awaiting confirmations'
        };
      } catch (error) {
        logger.error('Crypto webhook processing error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          shouldRetry: true
        };
      }
    });
  }

  /**
   * Создание подписки
   */
  async createSubscription(
    userId: number,
    packageId: string,
    frequency: Subscription['frequency'] = 'monthly',
    transaction?: Transaction
  ): Promise<Subscription> {
    return await this.executeInTransaction(transaction, async (t) => {
      const package_ = this.getStarPackageById(packageId);
      if (!package_) {
        throw new AppError('Package not found', 404);
      }

      const subscriptionId = `sub_${Date.now()}_${userId}`;
      const nextBillingDate = this.calculateNextBillingDate(frequency);

      const subscription: Subscription = {
        id: subscriptionId,
        userId,
        packageId,
        status: 'active',
        amount: package_.gramAmount,
        frequency,
        nextBillingDate,
        createdAt: new Date()
      };

      // Сохраняем в БД
      await sequelize.query(`
        INSERT INTO subscriptions (
          id, user_id, package_id, status, amount, frequency, 
          next_billing_date, created_at
        ) VALUES (
          :id, :userId, :packageId, :status, :amount, :frequency,
          :nextBillingDate, NOW()
        )
      `, {
        replacements: {
          id: subscriptionId,
          userId,
          packageId,
          status: 'active',
          amount: subscription.amount,
          frequency,
          nextBillingDate
        },
        type: QueryTypes.INSERT,
        transaction: t
      });

      // Создаем первый платеж
      await this.createPayment(userId, {
        method: PaymentMethod.TELEGRAM_STARS,
        type: PaymentType.SUBSCRIPTION,
        amount: package_.gramAmount,
        packageId,
        description: `Subscription payment for ${package_.name}`
      }, t);

      logger.info(`Subscription created: ${subscriptionId} for user ${userId}`);
      return subscription;
    });
  }

  /**
   * Создание промокода
   */
  async createPromoCode(
    code: string,
    type: PromoCode['type'],
    value: number,
    createdBy: number,
    options?: {
      minAmount?: number;
      maxDiscount?: number;
      usageLimit?: number;
      validUntil?: Date;
      applicablePackages?: string[];
    }
  ): Promise<PromoCode> {
    const promoCode: PromoCode = {
      id: `promo_${Date.now()}`,
      code: code.toUpperCase(),
      type,
      value,
      minAmount: options?.minAmount,
      maxDiscount: options?.maxDiscount,
      usageLimit: options?.usageLimit,
      usageCount: 0,
      validFrom: new Date(),
      validUntil: options?.validUntil,
      applicablePackages: options?.applicablePackages,
      isActive: true,
      createdBy,
      createdAt: new Date()
    };

    await sequelize.query(`
      INSERT INTO promo_codes (
        id, code, type, value, min_amount, max_discount, usage_limit,
        usage_count, valid_from, valid_until, applicable_packages, 
        is_active, created_by, created_at
      ) VALUES (
        :id, :code, :type, :value, :minAmount, :maxDiscount, :usageLimit,
        0, NOW(), :validUntil, :applicablePackages, :isActive, :createdBy, NOW()
      )
    `, {
      replacements: {
        id: promoCode.id,
        code: promoCode.code,
        type,
        value,
        minAmount: promoCode.minAmount,
        maxDiscount: promoCode.maxDiscount,
        usageLimit: promoCode.usageLimit,
        validUntil: promoCode.validUntil,
        applicablePackages: JSON.stringify(promoCode.applicablePackages || []),
        isActive: true,
        createdBy
      },
      type: QueryTypes.INSERT
    });

    logger.info(`Promo code created: ${code} by user ${createdBy}`);
    return promoCode;
  }

  /**
   * Применение промокода
   */
  async applyPromoCode(
    userId: number,
    code: string,
    paymentAmount: number,
    packageId?: string
  ): Promise<{
    isValid: boolean;
    discount: number;
    finalAmount: number;
    promoCode?: PromoCode;
    error?: string;
  }> {
    try {
      const promoCode = await this.getPromoCodeByCode(code);
      
      if (!promoCode) {
        return { isValid: false, discount: 0, finalAmount: paymentAmount, error: 'Promo code not found' };
      }

      // Валидация промокода
      const validation = this.validatePromoCode(promoCode, userId, paymentAmount, packageId);
      if (!validation.isValid) {
        return { 
          isValid: false, 
          discount: 0, 
          finalAmount: paymentAmount, 
          error: validation.error 
        };
      }

      // Расчет скидки
      let discount = 0;
      if (promoCode.type === 'fixed') {
        discount = Math.min(promoCode.value, paymentAmount);
      } else {
        discount = Math.floor((paymentAmount * promoCode.value) / 100);
        if (promoCode.maxDiscount) {
          discount = Math.min(discount, promoCode.maxDiscount);
        }
      }

      const finalAmount = Math.max(0, paymentAmount - discount);

      return {
        isValid: true,
        discount,
        finalAmount,
        promoCode
      };
    } catch (error) {
      logger.error('Error applying promo code:', error);
      return {
        isValid: false,
        discount: 0,
        finalAmount: paymentAmount,
        error: 'Failed to apply promo code'
      };
    }
  }

  /**
   * Обнаружение мошенничества
   */
  async detectFraud(
    userId: number,
    paymentData: any
  ): Promise<FraudDetectionResult> {
    const flags: FraudDetectionResult['reasons'] = [];
    let riskScore = 0;

    try {
      // Проверка частоты платежей
      const recentPayments = await TransactionModel.count({
        where: {
          userId,
          type: { [Op.in]: ['deposit', 'purchase'] },
          createdAt: { [Op.gte]: new Date(Date.now() - 24 * 60 * 60 * 1000) }
        }
      });

      if (recentPayments > 10) {
        flags.push({
          type: 'high_frequency',
          severity: 'high',
          description: `${recentPayments} payments in last 24 hours`
        });
        riskScore += 40;
      }

      // Проверка крупных сумм
      if (paymentData.amount > 10000) {
        flags.push({
          type: 'large_amount',
          severity: 'medium',
          description: `Large payment amount: ${paymentData.amount} GRAM`
        });
        riskScore += 20;
      }

      // Проверка нового пользователя
      const user = await User.findByPk(userId);
      if (user) {
        const accountAge = Date.now() - user.registeredAt.getTime();
        const daysSinceRegistration = accountAge / (1000 * 60 * 60 * 24);
        
        if (daysSinceRegistration < 1 && paymentData.amount > 1000) {
          flags.push({
            type: 'new_user_large_payment',
            severity: 'high',
            description: 'Large payment from new user'
          });
          riskScore += 35;
        }
      }

      // Проверка подозрительных паттернов
      const recentAmounts = await TransactionModel.findAll({
        where: {
          userId,
          type: { [Op.in]: ['deposit', 'purchase'] },
          createdAt: { [Op.gte]: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
        },
        attributes: ['amount'],
        order: [['createdAt', 'DESC']],
        limit: 10
      });

      if (recentAmounts.length >= 3) {
        const amounts = recentAmounts.map(p => p.amount);
        const isIdenticalAmounts = amounts.every(amount => amount === amounts[0]);
        
        if (isIdenticalAmounts) {
          flags.push({
            type: 'identical_amounts',
            severity: 'medium',
            description: 'Multiple identical payment amounts'
          });
          riskScore += 25;
        }
      }

      // Определение рекомендуемого действия
      let recommendedAction: FraudDetectionResult['recommendedAction'];
      if (riskScore >= this.fraudThreshold) {
        recommendedAction = 'block';
      } else if (riskScore >= 50) {
        recommendedAction = 'review';
      } else {
        recommendedAction = 'allow';
      }

      return {
        isSuspicious: riskScore >= 30,
        riskScore,
        reasons: flags,
        recommendedAction
      };
    } catch (error) {
      logger.error('Fraud detection error:', error);
      return {
        isSuspicious: false,
        riskScore: 0,
        reasons: [],
        recommendedAction: 'allow'
      };
    }
  }

  /**
   * Создание запроса на возврат
   */
  async createRefundRequest(
    paymentId: number,
    userId: number,
    reason: string,
    type: RefundRequest['type'] = 'full',
    amount?: number
  ): Promise<RefundRequest> {
    const payment = await TransactionModel.findByPk(paymentId);
    
    if (!payment || payment.userId !== userId) {
      throw new AppError('Payment not found', 404);
    }

    if (payment.status !== 'completed') {
      throw new AppError('Only completed payments can be refunded', 400);
    }

    const refundAmount = type === 'full' ? payment.amount : (amount || 0);
    
    if (type === 'partial' && (!amount || amount <= 0 || amount > payment.amount)) {
      throw new AppError('Invalid refund amount', 400);
    }

    const refund: RefundRequest = {
      id: Date.now(),
      paymentId,
      userId,
      amount: refundAmount,
      reason,
      type,
      status: 'pending',
      requestedAt: new Date()
    };

    await sequelize.query(`
      INSERT INTO refund_requests (
        payment_id, user_id, amount, reason, type, status, requested_at
      ) VALUES (
        :paymentId, :userId, :amount, :reason, :type, :status, NOW()
      )
    `, {
      replacements: {
        paymentId,
        userId,
        amount: refundAmount,
        reason,
        type,
        status: 'pending'
      },
      type: QueryTypes.INSERT
    });

    logger.info(`Refund request created: payment ${paymentId}, amount ${refundAmount} by user ${userId}`);
    return refund;
  }

  /**
   * Получение аналитики платежей
   */
  async getPaymentAnalytics(period?: { from: Date; to: Date }): Promise<PaymentAnalytics> {
    const whereConditions: any = {
      type: { [Op.in]: ['deposit', 'purchase', 'subscription'] }
    };

    if (period) {
      whereConditions.createdAt = {
        [Op.gte]: period.from,
        [Op.lte]: period.to
      };
    }

    const [payments, packageData] = await Promise.all([
      TransactionModel.findAll({
        where: whereConditions,
        attributes: ['amount', 'status', 'paymentProvider', 'createdAt', 'metadata']
      }),
      this.getPackageAnalytics(period)
    ]);

    const totalRevenue = payments
      .filter(p => p.status === 'completed')
      .reduce((sum, p) => sum + p.amount, 0);

    const paymentsCount = payments.length;
    const successfulPayments = payments.filter(p => p.status === 'completed').length;
    const averagePayment = successfulPayments > 0 ? totalRevenue / successfulPayments : 0;
    const successRate = paymentsCount > 0 ? (successfulPayments / paymentsCount) * 100 : 0;

    // Определяем топ метод оплаты
    const methodStats = payments.reduce((acc, payment) => {
      const method = payment.paymentProvider || 'unknown';
      acc[method] = (acc[method] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const topPaymentMethod = Object.entries(methodStats)
      .sort(([,a], [,b]) => b - a)[0]?.[0] as PaymentMethod || PaymentMethod.TELEGRAM_STARS;

    // Тренды
    const trends = await this.getPaymentTrends(period);

    // Методы оплаты
    const methods = await this.getMethodAnalytics(payments);

    // География (заглушка)
    const geography: PaymentAnalytics['geography'] = [];

    // Пользователи
    const users = await this.getUserPaymentAnalytics(period);

    return {
      overview: {
        totalRevenue,
        paymentsCount,
        averagePayment: Math.round(averagePayment),
        successRate: Math.round(successRate * 10) / 10,
        topPaymentMethod,
        growthRate: 0 // Потребует исторических данных
      },
      trends,
      methods,
      packages: packageData,
      geography,
      users
    };
  }

  /**
   * Генерация отчета по платежам
   */
  async generatePaymentReport(
    period: { from: Date; to: Date },
    options?: {
      includeRefunds?: boolean;
      includeFailures?: boolean;
      groupBy?: 'day' | 'week' | 'month';
    }
  ): Promise<PaymentReport> {
    const analytics = await this.getPaymentAnalytics(period);
    
    // Рост относительно предыдущего периода
    const periodLength = period.to.getTime() - period.from.getTime();
    const previousPeriod = {
      from: new Date(period.from.getTime() - periodLength),
      to: period.from
    };
    
    const previousAnalytics = await this.getPaymentAnalytics(previousPeriod);
    
    const paymentsGrowth = previousAnalytics.overview.paymentsCount > 0
      ? ((analytics.overview.paymentsCount - previousAnalytics.overview.paymentsCount) / previousAnalytics.overview.paymentsCount) * 100
      : 0;

    const revenueGrowth = previousAnalytics.overview.totalRevenue > 0
      ? ((analytics.overview.totalRevenue - previousAnalytics.overview.totalRevenue) / previousAnalytics.overview.totalRevenue) * 100
      : 0;

    // Инсайты
    const insights: string[] = [];
    
    if (analytics.overview.successRate < 85) {
      insights.push(`Success rate is ${analytics.overview.successRate}% - consider improving payment flow`);
    }
    
    if (paymentsGrowth > 20) {
      insights.push(`Payment volume grew by ${Math.round(paymentsGrowth)}% - great performance!`);
    }
    
    if (analytics.overview.averagePayment > 5000) {
      insights.push(`High average payment amount (${analytics.overview.averagePayment} GRAM) indicates premium user base`);
    }

    return {
      period,
      summary: {
        totalPayments: analytics.overview.paymentsCount,
        totalRevenue: analytics.overview.totalRevenue,
        averagePayment: analytics.overview.averagePayment,
        successRate: analytics.overview.successRate,
        topMethod: analytics.overview.topPaymentMethod
      },
      breakdown: {
        byMethod: analytics.methods.reduce((acc, method) => {
          acc[method.method] = {
            count: method.payments,
            amount: method.revenue,
            successRate: method.successRate
          };
          return acc;
        }, {} as PaymentReport['breakdown']['byMethod']),
        byPackage: analytics.packages.reduce((acc, pkg) => {
          acc[pkg.packageId] = {
            count: pkg.purchases,
            amount: pkg.revenue,
            revenue: pkg.revenue
          };
          return acc;
        }, {} as PaymentReport['breakdown']['byPackage']),
        byDay: analytics.trends.daily
      },
      growth: {
        paymentsGrowth: Math.round(paymentsGrowth * 10) / 10,
        revenueGrowth: Math.round(revenueGrowth * 10) / 10,
        comparisonPeriod: previousPeriod
      },
      insights
    };
  }

  /**
   * Обработка pre-checkout query от Telegram
   */
  private async handlePreCheckoutQuery(
    query: any,
    transaction?: Transaction
  ): Promise<WebhookProcessResult> {
    try {
      // Здесь можно добавить дополнительные проверки
      // Например, валидацию пользователя, проверку лимитов и т.д.
      
      return {
        success: true,
        message: 'Pre-checkout query processed successfully'
      };
    } catch (error) {
      logger.error('Pre-checkout query error:', error);
      return {
        success: false,
        error: 'Pre-checkout validation failed'
      };
    }
  }

  /**
   * Обработка успешного платежа Telegram Stars
   */
  private async handleSuccessfulStarsPayment(
    payment: any,
    transaction?: Transaction
  ): Promise<WebhookProcessResult> {
    try {
      const paymentId = payment.invoice_payload;
      
      await this.processSuccessfulPayment(paymentId, {
        telegramChargeId: payment.telegram_payment_charge_id,
        providerChargeId: payment.provider_payment_charge_id,
        currency: payment.currency,
        totalAmount: payment.total_amount
      }, transaction);

      return {
        success: true,
        message: 'Telegram Stars payment processed successfully'
      };
    } catch (error) {
      logger.error('Telegram Stars payment error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Payment processing failed',
        shouldRetry: true
      };
    }
  }

  /**
   * Расчет следующей даты списания для подписки
   */
  private calculateNextBillingDate(frequency: Subscription['frequency']): Date {
    const now = new Date();
    
    switch (frequency) {
      case 'daily':
        return new Date(now.getTime() + 24 * 60 * 60 * 1000);
      case 'weekly':
        return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      case 'monthly':
        const nextMonth = new Date(now);
        nextMonth.setMonth(nextMonth.getMonth() + 1);
        return nextMonth;
      case 'yearly':
        const nextYear = new Date(now);
        nextYear.setFullYear(nextYear.getFullYear() + 1);
        return nextYear;
      default:
        return new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    }
  }

  /**
   * Получение промокода по коду
   */
  private async getPromoCodeByCode(code: string): Promise<PromoCode | null> {
    try {
      const result = await sequelize.query(`
        SELECT * FROM promo_codes WHERE code = :code AND is_active = true
      `, {
        replacements: { code: code.toUpperCase() },
        type: QueryTypes.SELECT
      }) as any[];

      if (result.length === 0) return null;

      const row = result[0];
      return {
        id: row.id,
        code: row.code,
        type: row.type,
        value: row.value,
        minAmount: row.min_amount,
        maxDiscount: row.max_discount,
        usageLimit: row.usage_limit,
        usageCount: row.usage_count,
        validFrom: new Date(row.valid_from),
        validUntil: row.valid_until ? new Date(row.valid_until) : undefined,
        applicablePackages: JSON.parse(row.applicable_packages || '[]'),
        isActive: row.is_active,
        createdBy: row.created_by,
        createdAt: new Date(row.created_at)
      };
    } catch (error) {
      logger.error('Error getting promo code:', error);
      return null;
    }
  }

  /**
   * Валидация промокода
   */
  private validatePromoCode(
    promoCode: PromoCode,
    userId: number,
    amount: number,
    packageId?: string
  ): { isValid: boolean; error?: string } {
    // Проверка активности
    if (!promoCode.isActive) {
      return { isValid: false, error: 'Promo code is inactive' };
    }

    // Проверка срока действия
    const now = new Date();
    if (now < promoCode.validFrom) {
      return { isValid: false, error: 'Promo code is not yet valid' };
    }
    
    if (promoCode.validUntil && now > promoCode.validUntil) {
      return { isValid: false, error: 'Promo code has expired' };
    }

    // Проверка минимальной суммы
    if (promoCode.minAmount && amount < promoCode.minAmount) {
      return { isValid: false, error: `Minimum amount is ${promoCode.minAmount} GRAM` };
    }

    // Проверка применимых пакетов
    if (promoCode.applicablePackages && promoCode.applicablePackages.length > 0 && packageId) {
      if (!promoCode.applicablePackages.includes(packageId)) {
        return { isValid: false, error: 'Promo code is not applicable to this package' };
      }
    }

    // Проверка лимита использований
    if (promoCode.usageLimit && promoCode.usageCount >= promoCode.usageLimit) {
      return { isValid: false, error: 'Promo code usage limit exceeded' };
    }

    return { isValid: true };
  }

  /**
   * Загрузка курсов валют
   */
  private async loadExchangeRates(): Promise<void> {
    try {
      // В реальном приложении здесь был бы запрос к внешнему API
      // Для примера устанавливаем фиксированные курсы
      const rates: ExchangeRate[] = [
        {
          fromCurrency: Currency.USD,
          toCurrency: Currency.GRAM,
          rate: 100, // 1 USD = 100 GRAM
          timestamp: new Date(),
          source: 'internal'
        },
        {
          fromCurrency: Currency.EUR,
          toCurrency: Currency.GRAM,
          rate: 110, // 1 EUR = 110 GRAM
          timestamp: new Date(),
          source: 'internal'
        }
      ];

      rates.forEach(rate => {
        const key = `${rate.fromCurrency}_${rate.toCurrency}`;
        this.exchangeRates.set(key, rate);
      });

      logger.info('Exchange rates loaded successfully');
    } catch (error) {
      logger.error('Failed to load exchange rates:', error);
    }
  }

  /**
   * Аналитика пакетов
   */
  private async getPackageAnalytics(period?: { from: Date; to: Date }): Promise<PaymentAnalytics['packages']> {
    const packages = this.getStarPackages();
    
    return packages.map(pkg => ({
      packageId: pkg.id,
      name: pkg.name,
      purchases: 0, // Здесь нужен запрос к БД для подсчета покупок
      revenue: 0,
      conversionRate: 0
    }));
  }

  /**
   * Получение трендов платежей
   */
  private async getPaymentTrends(period?: { from: Date; to: Date }): Promise<PaymentAnalytics['trends']> {
    // Заглушка - в реальном приложении здесь будут запросы к БД
    return {
      daily: [],
      monthly: []
    };
  }

  /**
   * Аналитика методов оплаты
   */
  private async getMethodAnalytics(payments: any[]): Promise<PaymentAnalytics['methods']> {
    const methodStats = payments.reduce((acc, payment) => {
      const method = payment.paymentProvider || PaymentMethod.TELEGRAM_STARS;
      if (!acc[method]) {
        acc[method] = {
          payments: 0,
          revenue: 0,
          successfulPayments: 0
        };
      }
      
      acc[method].payments++;
      if (payment.status === 'completed') {
        acc[method].successfulPayments++;
        acc[method].revenue += payment.amount;
      }
      
      return acc;
    }, {} as Record<string, {
      payments: number;
      revenue: number;
      successfulPayments: number;
    }>);

    return Object.entries(methodStats).map(([method, stats]) => ({
      method: method as PaymentMethod,
      payments: (stats as any).payments,
      revenue: (stats as any).revenue,
      successRate: (stats as any).payments > 0 ? ((stats as any).successfulPayments / (stats as any).payments) * 100 : 0,
      averageAmount: (stats as any).successfulPayments > 0 ? (stats as any).revenue / (stats as any).successfulPayments : 0
    }));
  }

  /**
   * Аналитика пользователей платежей
   */
  private async getUserPaymentAnalytics(period?: { from: Date; to: Date }): Promise<PaymentAnalytics['users']> {
    const whereConditions: any = {
      type: { [Op.in]: ['deposit', 'purchase', 'subscription'] }
    };

    if (period) {
      whereConditions.createdAt = {
        [Op.gte]: period.from,
        [Op.lte]: period.to
      };
    }

    // Новые плательщики - пользователи, сделавшие первый платеж в периоде
    const newPayingUsers = await sequelize.query(`
      SELECT COUNT(DISTINCT user_id) as count
      FROM transactions t1
      WHERE t1.type IN ('deposit', 'purchase', 'subscription')
        AND t1.status = 'completed'
        ${period ? `AND t1.created_at >= '${period.from.toISOString()}' AND t1.created_at <= '${period.to.toISOString()}'` : ''}
        AND NOT EXISTS (
          SELECT 1 FROM transactions t2
          WHERE t2.user_id = t1.user_id
            AND t2.type IN ('deposit', 'purchase', 'subscription')
            AND t2.status = 'completed'
            AND t2.created_at < t1.created_at
        )
    `, { type: QueryTypes.SELECT }) as any[];

    // Возвращающиеся пользователи
    const returningUsers = await sequelize.query(`
      SELECT COUNT(DISTINCT user_id) as count
      FROM transactions
      WHERE type IN ('deposit', 'purchase', 'subscription')
        AND status = 'completed'
        ${period ? `AND created_at >= '${period.from.toISOString()}' AND created_at <= '${period.to.toISOString()}'` : ''}
        AND user_id IN (
          SELECT user_id FROM transactions
          WHERE type IN ('deposit', 'purchase', 'subscription')
            AND status = 'completed'
            ${period ? `AND created_at < '${period.from.toISOString()}'` : ''}
        )
    `, { type: QueryTypes.SELECT }) as any[];

    // Средняя стоимость жизненного цикла клиента
    const avgLifetimeValue = await sequelize.query(`
      SELECT AVG(total_spent) as avg_ltv
      FROM (
        SELECT user_id, SUM(amount) as total_spent
        FROM transactions
        WHERE type IN ('deposit', 'purchase', 'subscription')
          AND status = 'completed'
        GROUP BY user_id
      ) user_totals
    `, { type: QueryTypes.SELECT }) as any[];

    return {
      newPayingUsers: parseInt(newPayingUsers[0]?.count || 0),
      returningUsers: parseInt(returningUsers[0]?.count || 0),
      averageLifetimeValue: Math.round(parseFloat(avgLifetimeValue[0]?.avg_ltv || 0)),
      churnRate: 0 // Потребует более сложных расчетов
    };
  }
}