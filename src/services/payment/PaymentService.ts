// src/services/payment/PaymentService.ts
import { Transaction, Op } from 'sequelize';
import { User, Transaction as TransactionModel } from '../../database/models';
import { UserService } from '../user';
import { NotificationService } from '../notification/NotificationService';
import { 
  PaymentMethod,
  PaymentStatus,
  PaymentType,
  PaymentCreateData,
  PaymentUpdateData,
  PaymentFilters,
  PaymentStats,
  StarPackage,
  PaymentResult
} from './types';
import { AppError } from '../../utils/errors';
import { logger } from '../../utils/logger';
import { generatePaymentId } from '../../utils/helpers';
import { sequelize } from '../../database/models';

export class PaymentService {
  constructor(
    private userService: UserService,
    private notificationService: NotificationService
  ) {}

  /**
   * Создание платежа
   */
  async createPayment(
    userId: number,
    paymentData: PaymentCreateData,
    transaction?: Transaction
  ): Promise<PaymentResult> {
    return await this.executeInTransaction(transaction, async (t) => {
      // Получаем пользователя
      const user = await this.userService.getById(userId, t);
      if (!user) {
        throw new AppError('User not found', 404);
      }

      // Валидируем данные платежа
      await this.validatePaymentData(paymentData);

      // Генерируем уникальный ID платежа
      const paymentId = await this.generateUniquePaymentId();

      // Создаем запись о транзакции
      const payment = await TransactionModel.create({
        userId,
        type: paymentData.type,
        amount: paymentData.amount,
        balanceBefore: user.balance,
        balanceAfter: user.balance, // Будет обновлен при успешном платеже
        description: paymentData.description || this.getDefaultDescription(paymentData.type, paymentData.amount),
        externalId: paymentId,
        paymentProvider: paymentData.method,
        status: 'pending',
        metadata: {
          method: paymentData.method,
          packageId: paymentData.packageId,
          originalCurrency: paymentData.originalCurrency,
          originalAmount: paymentData.originalAmount,
          exchangeRate: paymentData.exchangeRate
        }
      }, { transaction: t });

      // Создаем URL для оплаты в зависимости от метода
      const paymentUrl = await this.createPaymentUrl(payment, paymentData, t);

      // Уведомляем пользователя
      await this.notificationService.createNotification({
        userId,
        type: 'payment_created',
        title: 'Payment Created',
        message: `Payment for ${paymentData.amount} GRAM has been created`,
        data: { 
          paymentId: payment.id,
          amount: paymentData.amount,
          method: paymentData.method
        },
        priority: 2
      }, t);

      logger.info(`Payment created: ${payment.id} for user ${userId}, amount: ${paymentData.amount} GRAM`);

      return {
        paymentId: payment.id,
        externalId: paymentId,
        amount: paymentData.amount,
        method: paymentData.method,
        status: 'pending',
        paymentUrl,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000) // 30 минут
      };
    });
  }

  /**
   * Обработка успешного платежа
   */
  async processSuccessfulPayment(
    paymentId: string,
    providerData: any,
    transaction?: Transaction
  ): Promise<TransactionModel> {
    return await this.executeInTransaction(transaction, async (t) => {
      // Находим платеж
      const payment = await TransactionModel.findOne({
        where: { externalId: paymentId },
        transaction: t
      });

      if (!payment) {
        throw new AppError('Payment not found', 404);
      }

      if (payment.status !== 'pending') {
        throw new AppError('Payment already processed', 400);
      }

      // Обновляем статус платежа
      await payment.update({
        status: 'completed',
        processedAt: new Date(),
        metadata: {
          ...payment.metadata,
          providerData
        }
      }, { transaction: t });

      // Начисляем средства пользователю
      const user = await this.userService.updateBalance(
        payment.userId,
        payment.amount,
        0,
        t
      );

      // Обновляем balance_after в транзакции
      await payment.update({
        balanceAfter: user.balance
      }, { transaction: t });

      // Проверяем изменение уровня пользователя
      await this.checkUserLevelUp(user, t);

      // Уведомляем пользователя
      await this.notificationService.createNotification({
        userId: payment.userId,
        type: 'payment_completed',
        title: 'Payment Successful!',
        message: `Your account has been credited with ${payment.amount} GRAM`,
        data: { 
          paymentId: payment.id,
          amount: payment.amount
        },
        priority: 2
      }, t);

      logger.info(`Payment completed: ${payment.id} for user ${payment.userId}, amount: ${payment.amount} GRAM`);
      return payment;
    });
  }

  /**
   * Обработка неудачного платежа
   */
  async processFailedPayment(
    paymentId: string,
    reason: string,
    providerData?: any,
    transaction?: Transaction
  ): Promise<TransactionModel> {
    return await this.executeInTransaction(transaction, async (t) => {
      // Находим платеж
      const payment = await TransactionModel.findOne({
        where: { externalId: paymentId },
        transaction: t
      });

      if (!payment) {
        throw new AppError('Payment not found', 404);
      }

      if (payment.status !== 'pending') {
        throw new AppError('Payment already processed', 400);
      }

      // Обновляем статус платежа
      await payment.update({
        status: 'failed',
        failedReason: reason,
        processedAt: new Date(),
        metadata: {
          ...payment.metadata,
          providerData
        }
      }, { transaction: t });

      // Уведомляем пользователя
      await this.notificationService.createNotification({
        userId: payment.userId,
        type: 'payment_failed',
        title: 'Payment Failed',
        message: `Your payment could not be processed: ${reason}`,
        data: { 
          paymentId: payment.id,
          reason
        },
        priority: 2
      }, t);

      logger.warn(`Payment failed: ${payment.id} for user ${payment.userId}, reason: ${reason}`);
      return payment;
    });
  }

  /**
   * Получение информации о платеже
   */
  async getPayment(paymentId: number): Promise<TransactionModel | null> {
    return await TransactionModel.findByPk(paymentId, {
      include: [{ model: User, as: 'user', attributes: ['id', 'username'] }]
    });
  }

  /**
   * Получение платежей пользователя
   */
  async getUserPayments(
    userId: number,
    filters: PaymentFilters = {}
  ): Promise<{
    payments: TransactionModel[];
    total: number;
    hasMore: boolean;
  }> {
    const {
      status,
      method,
      type,
      amountFrom,
      amountTo,
      dateFrom,
      dateTo,
      limit = 20,
      offset = 0,
      sortBy = 'created_at',
      sortOrder = 'DESC'
    } = filters;

    const whereConditions: any = {
      userId,
      type: { [Op.in]: ['deposit', 'purchase'] }
    };

    if (status) whereConditions.status = status;
    if (method) whereConditions.paymentProvider = method;
    if (type && type !== 'all') whereConditions.type = type;

    if (amountFrom || amountTo) {
      whereConditions.amount = {};
      if (amountFrom) whereConditions.amount[Op.gte] = amountFrom;
      if (amountTo) whereConditions.amount[Op.lte] = amountTo;
    }

    if (dateFrom || dateTo) {
      whereConditions.createdAt = {};
      if (dateFrom) whereConditions.createdAt[Op.gte] = dateFrom;
      if (dateTo) whereConditions.createdAt[Op.lte] = dateTo;
    }

    const { count, rows } = await TransactionModel.findAndCountAll({
      where: whereConditions,
      limit,
      offset,
      order: [[sortBy, sortOrder]]
    });

    return {
      payments: rows,
      total: count,
      hasMore: offset + limit < count
    };
  }

  /**
   * Получение статистики платежей
   */
  async getPaymentStats(
    period?: { from: Date; to: Date },
    userId?: number
  ): Promise<PaymentStats> {
    const whereConditions: any = {
      type: { [Op.in]: ['deposit', 'purchase'] }
    };

    if (userId) whereConditions.userId = userId;

    if (period) {
      whereConditions.createdAt = {
        [Op.gte]: period.from,
        [Op.lte]: period.to
      };
    }

    const [payments, completedPayments] = await Promise.all([
      TransactionModel.findAll({
        where: whereConditions,
        attributes: ['status', 'amount', 'paymentProvider', 'type', 'createdAt']
      }),
      TransactionModel.findAll({
        where: { ...whereConditions, status: 'completed' },
        attributes: ['amount', 'paymentProvider']
      })
    ]);

    const totalPayments = payments.length;
    const successfulPayments = completedPayments.length;
    const totalVolume = completedPayments.reduce((sum, p) => sum + p.amount, 0);
    const averageAmount = successfulPayments > 0 ? totalVolume / successfulPayments : 0;
    const successRate = totalPayments > 0 ? (successfulPayments / totalPayments) * 100 : 0;

    // Группируем по методам оплаты
    const byMethod = completedPayments.reduce((acc, payment) => {
      const method = payment.paymentProvider || 'unknown';
      acc[method] = (acc[method] || 0) + payment.amount;
      return acc;
    }, {} as Record<string, number>);

    // Группируем по статусам
    const byStatus = payments.reduce((acc, payment) => {
      acc[payment.status] = (acc[payment.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalPayments,
      successfulPayments,
      failedPayments: totalPayments - successfulPayments,
      totalVolume,
      averageAmount: Math.round(averageAmount),
      successRate: Math.round(successRate * 10) / 10,
      byMethod,
      byStatus
    };
  }

  /**
   * Получение доступных пакетов Telegram Stars
   */
  getStarPackages(): StarPackage[] {
    return [
      {
        id: 'stars_100',
        name: 'Starter Pack',
        description: 'Perfect for beginners',
        stars: 100,
        gramAmount: 1000,
        usdPrice: 2.0,
        discountPercent: 0,
        isPopular: false,
        bonusGram: 0
      },
      {
        id: 'stars_450',
        name: 'Popular Pack',
        description: 'Most chosen by users',
        stars: 450,
        gramAmount: 5000,
        usdPrice: 9.0,
        discountPercent: 10,
        isPopular: true,
        bonusGram: 500
      },
      {
        id: 'stars_850',
        name: 'Value Pack',
        description: 'Great value for money',
        stars: 850,
        gramAmount: 10000,
        usdPrice: 17.0,
        discountPercent: 15,
        isPopular: false,
        bonusGram: 1500
      },
      {
        id: 'stars_2000',
        name: 'Premium Pack',
        description: 'Maximum savings',
        stars: 2000,
        gramAmount: 25000,
        usdPrice: 40.0,
        discountPercent: 20,
        isPopular: false,
        bonusGram: 5000
      }
    ];
  }

  /**
   * Получение пакета по ID
   */
  getStarPackageById(packageId: string): StarPackage | null {
    const packages = this.getStarPackages();
    return packages.find(pkg => pkg.id === packageId) || null;
  }

  /**
   * Отмена платежа
   */
  async cancelPayment(
    paymentId: number,
    reason: string = 'Cancelled by user',
    transaction?: Transaction
  ): Promise<TransactionModel> {
    return await this.executeInTransaction(transaction, async (t) => {
      const payment = await TransactionModel.findByPk(paymentId, { transaction: t });

      if (!payment) {
        throw new AppError('Payment not found', 404);
      }

      if (payment.status !== 'pending') {
        throw new AppError('Only pending payments can be cancelled', 400);
      }

      await payment.update({
        status: 'cancelled',
        failedReason: reason,
        processedAt: new Date()
      }, { transaction: t });

      logger.info(`Payment cancelled: ${paymentId}, reason: ${reason}`);
      return payment;
    });
  }

  /**
   * Получение просроченных платежей
   */
  async getExpiredPayments(olderThan: Date = new Date(Date.now() - 30 * 60 * 1000)): Promise<TransactionModel[]> {
    return await TransactionModel.findAll({
      where: {
        status: 'pending',
        type: { [Op.in]: ['deposit', 'purchase'] },
        createdAt: { [Op.lte]: olderThan }
      }
    });
  }

  /**
   * Автоматическая отмена просроченных платежей
   */
  async cancelExpiredPayments(): Promise<{
    cancelled: number;
    errors: Array<{ paymentId: number; error: string }>;
  }> {
    const expiredPayments = await this.getExpiredPayments();
    let cancelled = 0;
    const errors: Array<{ paymentId: number; error: string }> = [];

    for (const payment of expiredPayments) {
      try {
        await this.cancelPayment(payment.id, 'Payment expired');
        cancelled++;
      } catch (error) {
        errors.push({
          paymentId: payment.id,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    logger.info(`Expired payments cleanup: ${cancelled} cancelled, ${errors.length} errors`);
    return { cancelled, errors };
  }

  /**
   * Валидация данных платежа
   */
  private async validatePaymentData(paymentData: PaymentCreateData): Promise<void> {
    // Проверяем метод оплаты
    if (!Object.values(PaymentMethod).includes(paymentData.method)) {
      throw new AppError('Invalid payment method', 400);
    }

    // Проверяем сумму
    if (paymentData.amount <= 0) {
      throw new AppError('Amount must be positive', 400);
    }

    const minAmount = 10;
    const maxAmount = 100000;
    if (paymentData.amount < minAmount || paymentData.amount > maxAmount) {
      throw new AppError(`Amount must be between ${minAmount} and ${maxAmount} GRAM`, 400);
    }

    // Проверяем пакет если указан
    if (paymentData.packageId) {
      const package_ = this.getStarPackageById(paymentData.packageId);
      if (!package_) {
        throw new AppError('Invalid package ID', 400);
      }
      
      if (paymentData.amount !== package_.gramAmount) {
        throw new AppError('Amount does not match package', 400);
      }
    }
  }

  /**
   * Создание URL для оплаты
   */
  private async createPaymentUrl(
    payment: TransactionModel,
    paymentData: PaymentCreateData,
    transaction: Transaction
  ): Promise<string> {
    const baseUrl = process.env.BOT_WEBHOOK_URL || 'https://t.me/prgram_bot';
    
    switch (paymentData.method) {
      case PaymentMethod.TELEGRAM_STARS:
        // Для Telegram Stars возвращаем специальную ссылку
        return `${baseUrl}?start=pay_${payment.externalId}`;
        
      case PaymentMethod.CRYPTO:
        // Для криптовалют можно интегрировать с внешними провайдерами
        return `${baseUrl}?start=crypto_${payment.externalId}`;
        
      case PaymentMethod.CARD:
        // Для карт можно интегрировать с платежными шлюзами
        return `${baseUrl}?start=card_${payment.externalId}`;
        
      default:
        return `${baseUrl}?start=pay_${payment.externalId}`;
    }
  }

  /**
   * Генерация описания платежа по умолчанию
   */
  private getDefaultDescription(type: PaymentType, amount: number): string {
    switch (type) {
      case 'deposit':
        return `Balance top-up: ${amount} GRAM`;
      case 'purchase':
        return `GRAM purchase: ${amount} GRAM`;
      default:
        return `Payment: ${amount} GRAM`;
    }
  }

  /**
   * Проверка повышения уровня пользователя
   */
  private async checkUserLevelUp(user: User, transaction: Transaction): Promise<void> {
    // Логика проверки уровня должна быть в UserService
    // Здесь просто вызываем соответствующий метод
    // await this.userService.checkLevelUp(user.id, transaction);
  }

  /**
   * Генерация уникального ID платежа
   */
  private async generateUniquePaymentId(): Promise<string> {
    let attempts = 0;
    const maxAttempts = 10;

    while (attempts < maxAttempts) {
      const paymentId = generatePaymentId();
      const existingPayment = await TransactionModel.findOne({
        where: { externalId: paymentId }
      });
      
      if (!existingPayment) {
        return paymentId;
      }
      
      attempts++;
    }

    throw new AppError('Failed to generate unique payment ID', 500);
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