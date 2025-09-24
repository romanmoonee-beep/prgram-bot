// src/services/payment/PaymentConstants.ts
import { PaymentMethod, Currency, StarPackage } from './types';

// Лимиты платежей по методам
export const PAYMENT_LIMITS = {
  perTransaction: {
    [PaymentMethod.TELEGRAM_STARS]: { min: 10, max: 25000 },
    [PaymentMethod.CRYPTO]: { min: 50, max: 100000 },
    [PaymentMethod.CARD]: { min: 100, max: 50000 },
    [PaymentMethod.BANK_TRANSFER]: { min: 1000, max: 100000 },
    [PaymentMethod.WALLET]: { min: 10, max: 10000 }
  },
  daily: {
    bronze: 10000,
    silver: 25000,
    gold: 50000,
    premium: 100000
  },
  monthly: {
    bronze: 100000,
    silver: 250000,
    gold: 500000,
    premium: 1000000
  }
} as const;

// Комиссии платежных провайдеров
export const PROVIDER_FEES = {
  [PaymentMethod.TELEGRAM_STARS]: { percentage: 0, fixed: 0 }, // Telegram Stars без комиссии для ботов
  [PaymentMethod.CRYPTO]: { percentage: 1, fixed: 0 },
  [PaymentMethod.CARD]: { percentage: 2.9, fixed: 30 }, // 2.9% + 30 копеек
  [PaymentMethod.BANK_TRANSFER]: { percentage: 0.5, fixed: 50 },
  [PaymentMethod.WALLET]: { percentage: 1.5, fixed: 10 }
} as const;

// Курсы валют (базовые значения)
export const BASE_EXCHANGE_RATES = {
  [`${Currency.USD}_${Currency.GRAM}`]: 100,
  [`${Currency.EUR}_${Currency.GRAM}`]: 110,
  [`${Currency.RUB}_${Currency.GRAM}`]: 1.5,
  [`${Currency.BTC}_${Currency.GRAM}`]: 4500000, // 1 BTC = 4.5M GRAM
  [`${Currency.ETH}_${Currency.GRAM}`]: 300000,   // 1 ETH = 300K GRAM
  [`${Currency.USDT}_${Currency.GRAM}`]: 100      // 1 USDT = 100 GRAM
} as const;

// Время истечения платежей (в минутах)
export const PAYMENT_EXPIRY_TIMES = {
  [PaymentMethod.TELEGRAM_STARS]: 30,
  [PaymentMethod.CRYPTO]: 60,
  [PaymentMethod.CARD]: 15,
  [PaymentMethod.BANK_TRANSFER]: 1440, // 24 часа
  [PaymentMethod.WALLET]: 30
} as const;

// Пакеты Telegram Stars
export const STAR_PACKAGES: StarPackage[] = [
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
  },
  {
    id: 'stars_5000',
    name: 'Ultimate Pack',
    description: 'For power users',
    stars: 5000,
    gramAmount: 70000,
    usdPrice: 100.0,
    discountPercent: 25,
    isPopular: false,
    bonusGram: 15000
  }
];

// Статусы платежей с описаниями
export const PAYMENT_STATUS_DESCRIPTIONS = {
  pending: {
    title: 'Payment Pending',
    description: 'Your payment is being processed',
    color: '#FFA500'
  },
  processing: {
    title: 'Processing Payment',
    description: 'Please wait while we confirm your payment',
    color: '#2196F3'
  },
  completed: {
    title: 'Payment Successful',
    description: 'Your account has been credited',
    color: '#4CAF50'
  },
  failed: {
    title: 'Payment Failed',
    description: 'Payment could not be processed',
    color: '#F44336'
  },
  cancelled: {
    title: 'Payment Cancelled',
    description: 'Payment was cancelled by user or system',
    color: '#9E9E9E'
  },
  refunded: {
    title: 'Payment Refunded',
    description: 'Payment has been refunded to your account',
    color: '#FF9800'
  },
  expired: {
    title: 'Payment Expired',
    description: 'Payment link has expired',
    color: '#795548'
  }
} as const;

// Методы оплаты с описаниями и иконками
export const PAYMENT_METHOD_INFO = {
  [PaymentMethod.TELEGRAM_STARS]: {
    name: 'Telegram Stars',
    description: 'Pay with Telegram Stars',
    icon: '⭐',
    processingTime: 'Instant',
    isInstant: true
  },
  [PaymentMethod.CRYPTO]: {
    name: 'Cryptocurrency',
    description: 'Bitcoin, Ethereum, USDT',
    icon: '₿',
    processingTime: '10-30 minutes',
    isInstant: false
  },
  [PaymentMethod.CARD]: {
    name: 'Credit/Debit Card',
    description: 'Visa, MasterCard, Maestro',
    icon: '💳',
    processingTime: '1-3 minutes',
    isInstant: true
  },
  [PaymentMethod.BANK_TRANSFER]: {
    name: 'Bank Transfer',
    description: 'Direct bank transfer',
    icon: '🏦',
    processingTime: '1-3 business days',
    isInstant: false
  },
  [PaymentMethod.WALLET]: {
    name: 'E-Wallet',
    description: 'PayPal, Skrill, Neteller',
    icon: '👛',
    processingTime: 'Instant',
    isInstant: true
  }
} as const;

// Поддерживаемые криптовалюты
export const SUPPORTED_CRYPTOCURRENCIES = [
  {
    symbol: 'BTC',
    name: 'Bitcoin',
    network: 'Bitcoin',
    minConfirmations: 3,
    decimals: 8,
    icon: '₿'
  },
  {
    symbol: 'ETH',
    name: 'Ethereum',
    network: 'Ethereum',
    minConfirmations: 12,
    decimals: 18,
    icon: '◊'
  },
  {
    symbol: 'USDT',
    name: 'Tether USD',
    network: 'Ethereum',
    minConfirmations: 12,
    decimals: 6,
    icon: '₮'
  },
  {
    symbol: 'USDT_TRC20',
    name: 'Tether USD (TRC20)',
    network: 'Tron',
    minConfirmations: 19,
    decimals: 6,
    icon: '₮'
  },
  {
    symbol: 'LTC',
    name: 'Litecoin',
    network: 'Litecoin',
    minConfirmations: 6,
    decimals: 8,
    icon: 'Ł'
  }
] as const;

// Коды ошибок платежей
export const PAYMENT_ERROR_CODES = {
  // Общие ошибки
  PAYMENT_NOT_FOUND: 'Payment not found',
  INVALID_AMOUNT: 'Invalid payment amount',
  INSUFFICIENT_FUNDS: 'Insufficient funds',
  PAYMENT_EXPIRED: 'Payment has expired',
  PAYMENT_ALREADY_PROCESSED: 'Payment already processed',
  
  // Ошибки методов оплаты
  INVALID_PAYMENT_METHOD: 'Invalid payment method',
  PAYMENT_METHOD_UNAVAILABLE: 'Payment method temporarily unavailable',
  
  // Ошибки провайдеров
  PROVIDER_ERROR: 'Payment provider error',
  NETWORK_ERROR: 'Network connection error',
  PROVIDER_TIMEOUT: 'Payment provider timeout',
  INVALID_CREDENTIALS: 'Invalid payment credentials',
  
  // Ошибки карт
  CARD_DECLINED: 'Card declined by bank',
  INSUFFICIENT_CARD_FUNDS: 'Insufficient funds on card',
  INVALID_CARD: 'Invalid card details',
  CARD_EXPIRED: 'Card has expired',
  CVV_FAILED: 'CVV verification failed',
  
  // Ошибки криптовалют
  INVALID_ADDRESS: 'Invalid cryptocurrency address',
  TRANSACTION_NOT_FOUND: 'Blockchain transaction not found',
  INSUFFICIENT_CONFIRMATIONS: 'Insufficient blockchain confirmations',
  NETWORK_FEE_TOO_LOW: 'Network fee too low',
  
  // Ошибки лимитов
  DAILY_LIMIT_EXCEEDED: 'Daily payment limit exceeded',
  MONTHLY_LIMIT_EXCEEDED: 'Monthly payment limit exceeded',
  TRANSACTION_LIMIT_EXCEEDED: 'Transaction limit exceeded',
  
  // Ошибки безопасности
  FRAUD_DETECTED: 'Suspicious activity detected',
  ACCOUNT_SUSPENDED: 'Account suspended',
  TOO_MANY_ATTEMPTS: 'Too many payment attempts',
  
  // Ошибки промокодов
  INVALID_PROMO_CODE: 'Invalid promo code',
  PROMO_CODE_EXPIRED: 'Promo code has expired',
  PROMO_CODE_LIMIT_EXCEEDED: 'Promo code usage limit exceeded',
  PROMO_CODE_NOT_APPLICABLE: 'Promo code not applicable to this payment'
} as const;

// Настройки безопасности
export const SECURITY_SETTINGS = {
  // Максимальное количество неудачных попыток платежа
  maxFailedAttempts: 3,
  
  // Время блокировки после превышения лимита попыток (в минутах)
  lockoutDuration: 30,
  
  // Порог для определения подозрительной активности
  suspiciousActivityThreshold: {
    paymentsPerHour: 10,
    totalAmountPerHour: 50000,
    identicalAmountsCount: 5
  },
  
  // Минимальное время между платежами (в секундах)
  minTimeBetweenPayments: 10,
  
  // Требования для крупных платежей
  largePaymentThreshold: 10000,
  largePaymentRequirements: {
    requireAdditionalVerification: true,
    manualReviewRequired: true,
    cooldownPeriod: 3600 // 1 час
  }
} as const;

// Конфигурация уведомлений
export const NOTIFICATION_TEMPLATES = {
  payment_created: {
    title: '💰 Payment Created',
    template: 'Payment of {amount} GRAM via {method} has been created. Complete within {expires} minutes.'
  },
  payment_completed: {
    title: '✅ Payment Successful',
    template: 'Your account has been credited with {amount} GRAM. Transaction ID: {transactionId}'
  },
  payment_failed: {
    title: '❌ Payment Failed',
    template: 'Payment of {amount} GRAM failed. Reason: {reason}. Please try again.'
  },
  payment_expired: {
    title: '⏰ Payment Expired',
    template: 'Payment of {amount} GRAM has expired. Please create a new payment.'
  },
  refund_processed: {
    title: '💸 Refund Processed',
    template: 'Refund of {amount} GRAM has been processed to your account.'
  },
  subscription_created: {
    title: '🔄 Subscription Created',
    template: 'Your {packageName} subscription is now active. Next billing: {nextBilling}'
  },
  subscription_payment_failed: {
    title: '⚠️ Subscription Payment Failed',
    template: 'Unable to process subscription payment. Please update your payment method.'
  }
} as const;

// Конфигурация автоматических действий
export const AUTO_ACTIONS = {
  // Автоматическая отмена просроченных платежей
  expiredPaymentCleanup: {
    enabled: true,
    intervalMinutes: 60,
    batchSize: 100
  },
  
  // Автоматическое выставление счетов за подписки
  subscriptionBilling: {
    enabled: true,
    intervalMinutes: 60,
    retryAttempts: 3,
    retryDelayHours: 24
  },
  
  // Автоматическое обнаружение мошенничества
  fraudDetection: {
    enabled: true,
    intervalMinutes: 15,
    autoBlockThreshold: 90
  },
  
  // Автоматическое обновление курсов валют
  exchangeRateUpdate: {
    enabled: true,
    intervalMinutes: 30,
    providers: ['coindesk', 'exchangerate-api']
  }
} as const;

// Веб-хуки конфигурация
export const WEBHOOK_CONFIG = {
  // Максимальное количество попыток доставки
  maxRetryAttempts: 5,
  
  // Интервалы между попытками (в секундах)
  retryIntervals: [10, 60, 300, 1800, 7200], // 10s, 1m, 5m, 30m, 2h
  
  // Таймаут для веб-хука (в секундах)
  timeout: 30,
  
  // События, которые отправляются через веб-хуки
  events: [
    'payment.created',
    'payment.completed',
    'payment.failed',
    'payment.expired',
    'refund.processed',
    'subscription.created',
    'subscription.cancelled',
    'fraud.detected'
  ]
} as const;

// Метрики и аналитика
export const ANALYTICS_CONFIG = {
  // Период хранения данных аналитики (в днях)
  dataRetentionDays: 365,
  
  // Интервалы агрегации данных
  aggregationIntervals: ['hourly', 'daily', 'weekly', 'monthly'],
  
  // KPI которые отслеживаются
  kpis: [
    'total_revenue',
    'payment_count',
    'success_rate',
    'average_payment_amount',
    'fraud_rate',
    'refund_rate',
    'customer_lifetime_value'
  ],
  
  // Настройки алертов
  alerts: {
    lowSuccessRate: { threshold: 85, enabled: true },
    highFraudRate: { threshold: 5, enabled: true },
    largePayment: { threshold: 50000, enabled: true }
  }
} as const;

// Форматы экспорта данных
export const EXPORT_FORMATS = {
  csv: {
    extension: '.csv',
    mimeType: 'text/csv',
    headers: true
  },
  xlsx: {
    extension: '.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    headers: true
  },
  json: {
    extension: '.json',
    mimeType: 'application/json',
    pretty: true
  },
  pdf: {
    extension: '.pdf',
    mimeType: 'application/pdf',
    template: 'standard'
  }
} as const;

// Регулярные выражения для валидации
export const VALIDATION_PATTERNS = {
  // Криптовалютные адреса
  bitcoinAddress: /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$|^bc1[a-z0-9]{39,59}$/,
  ethereumAddress: /^0x[a-fA-F0-9]{40}$/,
  tronAddress: /^T[A-Za-z1-9]{33}$/,
  
  // Номера карт
  visaCard: /^4[0-9]{12}(?:[0-9]{3})?$/,
  mastercardCard: /^5[1-5][0-9]{14}$/,
  amexCard: /^3[47][0-9]{13}$/,
  
  // Коды валют
  currencyCode: /^[A-Z]{3}$/,
  
  // Промокоды
  promoCode: /^[A-Z0-9]{4,20}$/,
  
  // Суммы
  amount: /^\d+(\.\d{1,2})?$/
} as const;

export default {
  PAYMENT_LIMITS,
  PROVIDER_FEES,
  BASE_EXCHANGE_RATES,
  PAYMENT_EXPIRY_TIMES,
  STAR_PACKAGES,
  PAYMENT_STATUS_DESCRIPTIONS,
  PAYMENT_METHOD_INFO,
  SUPPORTED_CRYPTOCURRENCIES,
  PAYMENT_ERROR_CODES,
  SECURITY_SETTINGS,
  NOTIFICATION_TEMPLATES,
  AUTO_ACTIONS,
  WEBHOOK_CONFIG,
  ANALYTICS_CONFIG,
  EXPORT_FORMATS,
  VALIDATION_PATTERNS
};