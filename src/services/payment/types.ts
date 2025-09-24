// src/services/payment/types.ts

// Основные интерфейсы для платежной системы
export interface PaymentCreateData {
  method: PaymentMethod;
  type: PaymentType;
  amount: number;
  packageId?: string;
  description?: string;
  originalCurrency?: string;
  originalAmount?: number;
  exchangeRate?: number;
  metadata?: Record<string, any>;
}

export interface PaymentUpdateData {
  status?: PaymentStatus;
  failedReason?: string;
  processedAt?: Date;
  metadata?: Record<string, any>;
}

export interface PaymentResult {
  paymentId: number;
  externalId: string;
  amount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  paymentUrl: string;
  expiresAt: Date;
  instructions?: string;
  metadata?: Record<string, any>;
}

// Фильтры для поиска платежей
export interface PaymentFilters {
  status?: PaymentStatus | PaymentStatus[];
  method?: PaymentMethod | PaymentMethod[];
  type?: PaymentType | 'all';
  amountFrom?: number;
  amountTo?: number;
  dateFrom?: Date;
  dateTo?: Date;
  userId?: number;
  externalId?: string;
  limit?: number;
  offset?: number;
  sortBy?: 'created_at' | 'processed_at' | 'amount' | 'status';
  sortOrder?: 'ASC' | 'DESC';
}

// Пакеты Telegram Stars
export interface StarPackage {
  id: string;
  name: string;
  description: string;
  stars: number;
  gramAmount: number;
  usdPrice: number;
  discountPercent: number;
  isPopular: boolean;
  bonusGram: number;
  savings?: number;
  originalPrice?: number;
  validUntil?: Date;
  conditions?: string[];
}

// Статистика платежей
export interface PaymentStats {
  totalPayments: number;
  successfulPayments: number;
  failedPayments: number;
  pendingPayments?: number;
  cancelledPayments?: number;
  totalVolume: number;
  averageAmount: number;
  successRate: number;
  conversionRate?: number;
  byMethod: Record<PaymentMethod, number>;
  byStatus: Record<PaymentStatus, number>;
  byPeriod?: Array<{
    period: string;
    payments: number;
    volume: number;
    successRate: number;
  }>;
  topPackages?: Array<{
    packageId: string;
    purchases: number;
    volume: number;
    percentage: number;
  }>;
}

// Детальная информация о платеже
export interface PaymentDetails {
  payment: {
    id: number;
    externalId: string;
    userId: number;
    method: PaymentMethod;
    type: PaymentType;
    amount: number;
    originalAmount?: number;
    originalCurrency?: string;
    exchangeRate?: number;
    status: PaymentStatus;
    description: string;
    createdAt: Date;
    processedAt?: Date;
    failedReason?: string;
    expiresAt?: Date;
  };
  user: {
    id: number;
    username?: string;
    level: string;
    balanceAfter?: number;
  };
  package?: StarPackage;
  provider: {
    name: string;
    transactionId?: string;
    details?: Record<string, any>;
  };
  timeline: Array<{
    event: string;
    timestamp: Date;
    description: string;
    data?: Record<string, any>;
  }>;
}

// Платежные провайдеры и их конфигурации
export interface PaymentProviderConfig {
  telegram: {
    enabled: boolean;
    testMode: boolean;
    merchantToken?: string;
    supportedCurrencies: string[];
  };
  crypto: {
    enabled: boolean;
    networks: Array<{
      name: string;
      symbol: string;
      contractAddress?: string;
      minAmount: number;
      fees: number;
      confirmations: number;
    }>;
    walletAddress: string;
  };
  cards: {
    enabled: boolean;
    providers: Array<{
      name: string;
      apiKey?: string;
      secretKey?: string;
      webhookUrl?: string;
      supportedCurrencies: string[];
      fees: number;
    }>;
  };
}

// Конфигурация платежного сервиса
export interface PaymentServiceConfig {
  limits: {
    minAmount: number;
    maxAmount: number;
    dailyLimit: number;
    monthlyLimit: number;
  };
  fees: {
    telegramStars: number; // процент
    crypto: number;
    cards: number;
    minimumFee: number;
  };
  timeouts: {
    paymentExpiry: number; // в минутах
    confirmationTimeout: number; // в минутах
    refundTimeout: number; // в днях
  };
  exchange: {
    starToGram: number; // курс обмена
    updateInterval: number; // в минутах
    source: 'fixed' | 'api' | 'manual';
  };
  features: {
    autoRefunds: boolean;
    fraudDetection: boolean;
    multiCurrency: boolean;
    recurringPayments: boolean;
  };
}

// Результат обработки webhook
export interface WebhookProcessResult {
  success: boolean;
  paymentId?: number;
  status?: PaymentStatus;
  amount?: number;
  message?: string;
  error?: string;
  shouldRetry?: boolean;
  retryAfter?: number;
}

// Данные для webhook от провайдеров
export interface TelegramStarsWebhook {
  update_id: number;
  pre_checkout_query?: {
    id: string;
    from: {
      id: number;
      username?: string;
    };
    currency: string;
    total_amount: number;
    invoice_payload: string;
  };
  successful_payment?: {
    currency: string;
    total_amount: number;
    invoice_payload: string;
    shipping_option_id?: string;
    order_info?: any;
    telegram_payment_charge_id: string;
    provider_payment_charge_id: string;
  };
}

export interface CryptoWebhook {
  transaction_id: string;
  amount: string;
  currency: string;
  network: string;
  from_address: string;
  to_address: string;
  confirmations: number;
  status: 'pending' | 'confirmed' | 'failed';
  block_hash?: string;
  block_number?: number;
  gas_fee?: string;
  metadata?: Record<string, any>;
}

// Аналитика платежей
export interface PaymentAnalytics {
  overview: {
    totalRevenue: number;
    paymentsCount: number;
    averagePayment: number;
    successRate: number;
    topPaymentMethod: PaymentMethod;
    growthRate: number; // процент роста
  };
  trends: {
    daily: Array<{
      date: string;
      payments: number;
      revenue: number;
      successRate: number;
    }>;
    monthly: Array<{
      month: string;
      payments: number;
      revenue: number;
      averagePayment: number;
    }>;
  };
  methods: Array<{
    method: PaymentMethod;
    payments: number;
    revenue: number;
    successRate: number;
    averageAmount: number;
  }>;
  packages: Array<{
    packageId: string;
    name: string;
    purchases: number;
    revenue: number;
    conversionRate: number;
  }>;
  geography?: Array<{
    country: string;
    payments: number;
    revenue: number;
    averageAmount: number;
  }>;
  users: {
    newPayingUsers: number;
    returningUsers: number;
    averageLifetimeValue: number;
    churnRate: number;
  };
}

// Мошенничество и безопасность
export interface FraudDetectionResult {
  isSuspicious: boolean;
  riskScore: number; // 0-100
  reasons: Array<{
    type: string;
    severity: 'low' | 'medium' | 'high';
    description: string;
  }>;
  recommendedAction: 'allow' | 'review' | 'block';
  blockedUntil?: Date;
}

export interface PaymentSecurityEvent {
  id: string;
  type: 'fraud_detected' | 'unusual_pattern' | 'failed_verification' | 'chargeback';
  paymentId: number;
  userId: number;
  riskScore: number;
  details: Record<string, any>;
  status: 'pending' | 'reviewed' | 'resolved';
  createdAt: Date;
  reviewedAt?: Date;
  reviewedBy?: number;
}

// Возвраты и отмены
export interface RefundRequest {
  id: number;
  paymentId: number;
  userId: number;
  amount: number;
  reason: string;
  type: 'full' | 'partial';
  status: 'pending' | 'approved' | 'rejected' | 'processed';
  requestedAt: Date;
  processedAt?: Date;
  adminNotes?: string;
}

// Подписки и recurring платежи
export interface Subscription {
  id: string;
  userId: number;
  packageId: string;
  status: 'active' | 'cancelled' | 'expired' | 'paused';
  amount: number;
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  nextBillingDate: Date;
  createdAt: Date;
  cancelledAt?: Date;
  pausedAt?: Date;
  metadata?: Record<string, any>;
}

// Промокоды и скидки
export interface PromoCode {
  id: string;
  code: string;
  type: 'fixed' | 'percentage';
  value: number;
  minAmount?: number;
  maxDiscount?: number;
  usageLimit?: number;
  usageCount: number;
  validFrom: Date;
  validUntil?: Date;
  applicablePackages?: string[];
  isActive: boolean;
  createdBy: number;
  createdAt: Date;
}

export interface PromoCodeUsage {
  id: number;
  promoCodeId: string;
  userId: number;
  paymentId: number;
  discountAmount: number;
  usedAt: Date;
}

// Перечисления
export enum PaymentMethod {
  TELEGRAM_STARS = 'telegram_stars',
  CRYPTO = 'crypto',
  CARD = 'card',
  BANK_TRANSFER = 'bank_transfer',
  WALLET = 'wallet'
}

export enum PaymentStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded',
  EXPIRED = 'expired'
}

export enum PaymentType {
  DEPOSIT = 'deposit',
  PURCHASE = 'purchase',
  SUBSCRIPTION = 'subscription',
  REFUND = 'refund',
  ADJUSTMENT = 'adjustment'
}

export enum CryptoNetwork {
  BITCOIN = 'bitcoin',
  ETHEREUM = 'ethereum',
  BINANCE_SMART_CHAIN = 'bsc',
  POLYGON = 'polygon',
  TRON = 'tron',
  LITECOIN = 'litecoin',
  DOGECOIN = 'dogecoin'
}

export enum Currency {
  USD = 'USD',
  EUR = 'EUR',
  RUB = 'RUB',
  BTC = 'BTC',
  ETH = 'ETH',
  USDT = 'USDT',
  GRAM = 'GRAM'
}

// События платежной системы
export interface PaymentCreatedEvent {
  type: 'payment_created';
  paymentId: number;
  userId: number;
  method: PaymentMethod;
  amount: number;
  packageId?: string;
  timestamp: Date;
}

export interface PaymentCompletedEvent {
  type: 'payment_completed';
  paymentId: number;
  userId: number;
  method: PaymentMethod;
  amount: number;
  processingTime: number; // в секундах
  timestamp: Date;
}

export interface PaymentFailedEvent {
  type: 'payment_failed';
  paymentId: number;
  userId: number;
  method: PaymentMethod;
  amount: number;
  reason: string;
  timestamp: Date;
}

export interface RefundProcessedEvent {
  type: 'refund_processed';
  paymentId: number;
  refundId: number;
  userId: number;
  amount: number;
  reason: string;
  timestamp: Date;
}

export interface FraudDetectedEvent {
  type: 'fraud_detected';
  paymentId: number;
  userId: number;
  riskScore: number;
  reasons: string[];
  action: string;
  timestamp: Date;
}

export type PaymentServiceEvent = 
  | PaymentCreatedEvent
  | PaymentCompletedEvent
  | PaymentFailedEvent
  | RefundProcessedEvent
  | FraudDetectedEvent;

// API ответы
export interface PaymentListResponse {
  payments: PaymentDetails[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  summary: {
    totalAmount: number;
    successfulPayments: number;
    averageAmount: number;
  };
}

export interface PackageListResponse {
  packages: StarPackage[];
  recommendations: {
    mostPopular: string;
    bestValue: string;
    recommended: string;
  };
  currency: Currency;
  exchangeRate: number;
}

// Интеграция с внешними провайдерами
export interface ExternalPaymentProvider {
  name: string;
  type: PaymentMethod;
  isEnabled: boolean;
  config: Record<string, any>;
  fees: {
    fixed: number;
    percentage: number;
    currency: Currency;
  };
  limits: {
    min: number;
    max: number;
    daily?: number;
    monthly?: number;
  };
  supportedCurrencies: Currency[];
  processingTime: {
    min: number; // в минутах
    max: number;
    average: number;
  };
  reliability: {
    uptime: number; // процент
    successRate: number; // процент
    lastIncident?: Date;
  };
}

// Курсы валют и конвертация
export interface ExchangeRate {
  fromCurrency: Currency;
  toCurrency: Currency;
  rate: number;
  timestamp: Date;
  source: string;
  spread?: number; // спред в процентах
  validUntil?: Date;
}

export interface CurrencyConversion {
  fromAmount: number;
  fromCurrency: Currency;
  toAmount: number;
  toCurrency: Currency;
  exchangeRate: number;
  fees: number;
  timestamp: Date;
}

// Отчеты и экспорт
export interface PaymentReport {
  period: { from: Date; to: Date };
  summary: {
    totalPayments: number;
    totalRevenue: number;
    averagePayment: number;
    successRate: number;
    topMethod: PaymentMethod;
  };
  breakdown: {
    byMethod: Record<PaymentMethod, {
      count: number;
      amount: number;
      successRate: number;
    }>;
    byPackage: Record<string, {
      count: number;
      amount: number;
      revenue: number;
    }>;
    byDay: Array<{
      date: string;
      payments: number;
      revenue: number;
    }>;
  };
  growth: {
    paymentsGrowth: number; // процент
    revenueGrowth: number; // процент
    comparisonPeriod: { from: Date; to: Date };
  };
  insights: string[];
}

export interface PaymentExportOptions {
  format: 'csv' | 'xlsx' | 'json';
  fields: Array<keyof PaymentDetails>;
  filters: PaymentFilters;
  includeUserData: boolean;
  includeProviderData: boolean;
  dateRange: { from: Date; to: Date };
}

// Кэширование и производительность
export interface PaymentCache {
  packages: {
    data: StarPackage[];
    cachedAt: Date;
    expiresAt: Date;
  };
  exchangeRates: {
    rates: Record<string, ExchangeRate>;
    cachedAt: Date;
    expiresAt: Date;
  };
  stats: {
    data: PaymentStats;
    cachedAt: Date;
    expiresAt: Date;
  };
}

// Конфигурация уведомлений
export interface PaymentNotificationConfig {
  email: {
    enabled: boolean;
    templates: Record<PaymentStatus, string>;
    adminAlerts: boolean;
  };
  telegram: {
    enabled: boolean;
    instantNotifications: boolean;
    adminChatId?: number;
  };
  webhooks: {
    enabled: boolean;
    urls: Array<{
      url: string;
      events: PaymentServiceEvent['type'][];
      secret?: string;
    }>;
  };
}

// Кастомные ошибки
export class PaymentServiceError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400,
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = 'PaymentServiceError';
  }
}

export class PaymentNotFoundError extends PaymentServiceError {
  constructor(paymentId: string | number) {
    super(
      `Payment not found: ${paymentId}`,
      'PAYMENT_NOT_FOUND',
      404,
      { paymentId }
    );
  }
}

export class InvalidPaymentMethodError extends PaymentServiceError {
  constructor(method: string) {
    super(
      `Invalid payment method: ${method}`,
      'INVALID_PAYMENT_METHOD',
      400,
      { method }
    );
  }
}

export class PaymentAlreadyProcessedError extends PaymentServiceError {
  constructor(paymentId: number, status: PaymentStatus) {
    super(
      `Payment already processed with status: ${status}`,
      'PAYMENT_ALREADY_PROCESSED',
      400,
      { paymentId, status }
    );
  }
}

export class InsufficientFundsError extends PaymentServiceError {
  constructor(required: number, available: number) {
    super(
      `Insufficient funds. Required: ${required}, Available: ${available}`,
      'INSUFFICIENT_FUNDS',
      400,
      { required, available }
    );
  }
}

export class PaymentExpiredError extends PaymentServiceError {
  constructor(paymentId: number, expiredAt: Date) {
    super(
      'Payment has expired',
      'PAYMENT_EXPIRED',
      400,
      { paymentId, expiredAt }
    );
  }
}

export class FraudDetectedError extends PaymentServiceError {
  constructor(riskScore: number, reasons: string[]) {
    super(
      'Payment blocked due to fraud detection',
      'FRAUD_DETECTED',
      403,
      { riskScore, reasons }
    );
  }
}

export class PaymentLimitExceededError extends PaymentServiceError {
  constructor(limit: number, period: string) {
    super(
      `Payment limit exceeded: ${limit} for ${period}`,
      'PAYMENT_LIMIT_EXCEEDED',
      400,
      { limit, period }
    );
  }
}

export class InvalidPromoCodeError extends PaymentServiceError {
  constructor(code: string, reason?: string) {
    super(
      `Invalid promo code: ${code}${reason ? ` (${reason})` : ''}`,
      'INVALID_PROMO_CODE',
      400,
      { code, reason }
    );
  }
}