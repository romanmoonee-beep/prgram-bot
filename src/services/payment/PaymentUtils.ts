// src/services/payment/PaymentUtils.ts
import crypto from 'crypto';
import { PaymentMethod, Currency, StarPackage } from './types';
import { logger } from '../../utils/logger';

export class PaymentUtils {
  /**
   * Генерация уникального ID платежа
   */
  static generatePaymentId(): string {
    const timestamp = Date.now().toString();
    const random = Math.random().toString(36).substring(2, 8);
    return `pay_${timestamp}_${random}`;
  }

  /**
   * Валидация webhook подписи
   */
  static validateWebhookSignature(
    payload: string,
    signature: string,
    secret: string
  ): boolean {
    try {
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(payload)
        .digest('hex');
      
      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(`sha256=${expectedSignature}`)
      );
    } catch (error) {
      logger.error('Webhook signature validation error:', error);
      return false;
    }
  }

  /**
   * Конвертация валют
   */
  static convertCurrency(
    amount: number,
    fromCurrency: Currency,
    toCurrency: Currency,
    exchangeRate: number
  ): number {
    if (fromCurrency === toCurrency) {
      return amount;
    }
    
    return Math.round(amount * exchangeRate);
  }

  /**
   * Форматирование суммы для отображения
   */
  static formatAmount(amount: number, currency: Currency): string {
    switch (currency) {
      case Currency.GRAM:
        return `${amount.toLocaleString()} GRAM`;
      case Currency.USD:
        return `$${(amount / 100).toFixed(2)}`;
      case Currency.EUR:
        return `€${(amount / 100).toFixed(2)}`;
      case Currency.RUB:
        return `₽${(amount / 100).toFixed(2)}`;
      default:
        return `${amount} ${currency}`;
    }
  }

  /**
   * Расчет комиссии платежного провайдера
   */
  static calculateProviderFee(
    amount: number,
    method: PaymentMethod,
    config: { [key in PaymentMethod]?: { percentage: number; fixed: number } }
  ): number {
    const providerConfig = config[method];
    if (!providerConfig) return 0;

    const percentageFee = (amount * providerConfig.percentage) / 100;
    return Math.round(percentageFee + providerConfig.fixed);
  }

  /**
   * Создание URL для оплаты Telegram Stars
   */
  static createTelegramStarsPaymentUrl(
    botUsername: string,
    startParameter: string
  ): string {
    return `https://t.me/${botUsername}?start=${startParameter}`;
  }

  /**
   * Генерация QR кода для криптоплатежа
   */
  static generateCryptoPaymentQR(
    address: string,
    amount: number,
    currency: string,
    memo?: string
  ): string {
    const params = new URLSearchParams();
    if (amount > 0) params.set('amount', amount.toString());
    if (memo) params.set('memo', memo);

    const queryString = params.toString();
    return `${currency.toLowerCase()}:${address}${queryString ? '?' + queryString : ''}`;
  }

  /**
   * Валидация криптоадреса
   */
  static validateCryptoAddress(address: string, currency: string): boolean {
    switch (currency.toLowerCase()) {
      case 'btc':
        return /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$|^bc1[a-z0-9]{39,59}$/.test(address);
      case 'eth':
        return /^0x[a-fA-F0-9]{40}$/.test(address);
      case 'usdt':
        // USDT может быть на разных сетях, проверяем основные форматы
        return /^0x[a-fA-F0-9]{40}$/.test(address) || // Ethereum
               /^T[A-Za-z1-9]{33}$/.test(address) ||   // Tron
               /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(address); // Bitcoin (Omni)
      default:
        return false;
    }
  }

  /**
   * Расчет скидки по промокоду
   */
  static calculatePromoDiscount(
    amount: number,
    promoType: 'fixed' | 'percentage',
    promoValue: number,
    maxDiscount?: number
  ): number {
    let discount = 0;

    if (promoType === 'fixed') {
      discount = Math.min(promoValue, amount);
    } else {
      discount = (amount * promoValue) / 100;
      if (maxDiscount) {
        discount = Math.min(discount, maxDiscount);
      }
    }

    return Math.floor(discount);
  }

  /**
   * Создание инвойса для Telegram Stars
   */
  static createTelegramInvoice(
    title: string,
    description: string,
    payload: string,
    currency: string,
    prices: Array<{ label: string; amount: number }>
  ): any {
    return {
      title,
      description,
      payload,
      provider_token: '', // Для Telegram Stars не нужен токен
      currency,
      prices,
      need_name: false,
      need_phone_number: false,
      need_email: false,
      need_shipping_address: false,
      send_phone_number_to_provider: false,
      send_email_to_provider: false,
      is_flexible: false
    };
  }

  /**
   * Получение рекомендуемого пакета
   */
  static getRecommendedPackage(
    packages: StarPackage[],
    userLevel: string = 'bronze'
  ): StarPackage | null {
    // Логика рекомендации пакета на основе уровня пользователя
    const levelPackageMap: Record<string, string> = {
      bronze: 'stars_100',
      silver: 'stars_450',
      gold: 'stars_850',
      premium: 'stars_2000'
    };

    const recommendedId = levelPackageMap[userLevel];
    return packages.find(pkg => pkg.id === recommendedId) || packages[0] || null;
  }

  /**
   * Проверка лимитов платежа
   */
  static validatePaymentLimits(
    amount: number,
    method: PaymentMethod,
    userLevel: string,
    limits: {
      daily: Record<string, number>;
      monthly: Record<string, number>;
      perTransaction: Record<PaymentMethod, { min: number; max: number }>;
    }
  ): { isValid: boolean; error?: string } {
    const methodLimits = limits.perTransaction[method];
    
    if (!methodLimits) {
      return { isValid: false, error: 'Payment method not supported' };
    }

    if (amount < methodLimits.min) {
      return { 
        isValid: false, 
        error: `Minimum amount is ${methodLimits.min} GRAM` 
      };
    }

    if (amount > methodLimits.max) {
      return { 
        isValid: false, 
        error: `Maximum amount is ${methodLimits.max} GRAM` 
      };
    }

    // Проверка дневных лимитов
    const dailyLimit = limits.daily[userLevel];
    if (amount > dailyLimit) {
      return { 
        isValid: false, 
        error: `Daily limit exceeded. Maximum: ${dailyLimit} GRAM` 
      };
    }

    return { isValid: true };
  }

  /**
   * Создание уведомления о платеже
   */
  static createPaymentNotification(
    type: 'success' | 'failed' | 'pending',
    amount: number,
    method: PaymentMethod,
    additionalInfo?: string
  ): { title: string; message: string; priority: number } {
    switch (type) {
      case 'success':
        return {
          title: '💰 Payment Successful!',
          message: `Your account has been credited with ${amount} GRAM via ${method}`,
          priority: 2
        };
      
      case 'failed':
        return {
          title: '❌ Payment Failed',
          message: `Payment of ${amount} GRAM via ${method} was unsuccessful. ${additionalInfo || ''}`,
          priority: 3
        };
      
      case 'pending':
        return {
          title: '⏳ Payment Pending',
          message: `Your payment of ${amount} GRAM via ${method} is being processed`,
          priority: 1
        };
      
      default:
        return {
          title: 'Payment Update',
          message: `Payment status update for ${amount} GRAM`,
          priority: 1
        };
    }
  }

  /**
   * Обфускация номера карты для логов
   */
  static maskCardNumber(cardNumber: string): string {
    if (cardNumber.length < 8) return '****';
    
    const firstFour = cardNumber.substring(0, 4);
    const lastFour = cardNumber.substring(cardNumber.length - 4);
    const middleStars = '*'.repeat(cardNumber.length - 8);
    
    return `${firstFour}${middleStars}${lastFour}`;
  }

  /**
   * Получение статуса платежа по коду провайдера
   */
  static mapProviderStatus(
    providerStatus: string,
    provider: PaymentMethod
  ): 'pending' | 'completed' | 'failed' | 'cancelled' {
    const statusMaps: Record<PaymentMethod, Record<string, any>> = {
      [PaymentMethod.TELEGRAM_STARS]: {
        'successful': 'completed',
        'pending': 'pending',
        'failed': 'failed'
      },
      [PaymentMethod.CRYPTO]: {
        'confirmed': 'completed',
        'pending': 'pending',
        'failed': 'failed'
      },
      [PaymentMethod.CARD]: {
        'succeeded': 'completed',
        'processing': 'pending',
        'failed': 'failed',
        'canceled': 'cancelled'
      },
      [PaymentMethod.BANK_TRANSFER]: {
        'completed': 'completed',
        'pending': 'pending',
        'failed': 'failed'
      },
      [PaymentMethod.WALLET]: {
        'success': 'completed',
        'pending': 'pending',
        'error': 'failed'
      }
    };

    const statusMap = statusMaps[provider];
    return statusMap?.[providerStatus] || 'pending';
  }

  /**
   * Расчет времени истечения платежа
   */
  static calculatePaymentExpiry(
    method: PaymentMethod,
    defaultMinutes: number = 30
  ): Date {
    const expiryMinutes: Record<PaymentMethod, number> = {
      [PaymentMethod.TELEGRAM_STARS]: 30,
      [PaymentMethod.CRYPTO]: 60,
      [PaymentMethod.CARD]: 15,
      [PaymentMethod.BANK_TRANSFER]: 24 * 60, // 24 часа
      [PaymentMethod.WALLET]: 30
    };

    const minutes = expiryMinutes[method] || defaultMinutes;
    return new Date(Date.now() + minutes * 60 * 1000);
  }

  /**
   * Проверка истечения платежа
   */
  static isPaymentExpired(expiryDate: Date): boolean {
    return new Date() > expiryDate;
  }

  /**
   * Генерация отчета по платежам в CSV формате
   */
  static generatePaymentCSV(payments: Array<{
    id: number;
    userId: number;
    amount: number;
    method: PaymentMethod;
    status: string;
    createdAt: Date;
    description?: string;
  }>): string {
    const headers = ['ID', 'User ID', 'Amount', 'Method', 'Status', 'Created At', 'Description'];
    const csvRows = [headers.join(',')];

    payments.forEach(payment => {
      const row = [
        payment.id,
        payment.userId,
        payment.amount,
        payment.method,
        payment.status,
        payment.createdAt.toISOString(),
        payment.description || ''
      ].map(field => `"${field}"`);
      
      csvRows.push(row.join(','));
    });

    return csvRows.join('\n');
  }
}

export default PaymentUtils;