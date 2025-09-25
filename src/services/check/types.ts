// src/services/check/types.ts

// Основные интерфейсы для создания и активации чеков
export interface CheckCreateData {
  type: CheckType;
  totalAmount: number;
  maxActivations?: number; // Для multi-чека
  password?: string;
  requiredSubscription?: string; // Ссылка на канал/чат для обязательной подписки
  targetUserId?: number; // Для personal чека
  comment?: string;
  imageUrl?: string;
  expiresAt?: Date;
}

export interface CheckActivateData {
  code: string;
  password?: string;
}

export interface CheckUpdateData {
  comment?: string;
  imageUrl?: string;
  expiresAt?: Date;
  isActive?: boolean;
}

// Фильтры для поиска чеков
export interface CheckFilters {
  type?: CheckType;
  status?: 'active' | 'inactive' | 'expired';
  creatorId?: number;
  hasPassword?: boolean;
  hasSubscriptionRequirement?: boolean;
  amountFrom?: number;
  amountTo?: number;
  dateFrom?: Date;
  dateTo?: Date;
  limit?: number;
  offset?: number;
  sortBy?: 'created_at' | 'total_amount' | 'current_activations' | 'expires_at';
  sortOrder?: 'ASC' | 'DESC';
  search?: string;
}

export interface ActivationFilters {
  checkId?: number;
  userId?: number;
  amountFrom?: number;
  amountTo?: number;
  dateFrom?: Date;
  dateTo?: Date;
  limit?: number;
  offset?: number;
  sortBy?: 'activated_at' | 'amount';
  sortOrder?: 'ASC' | 'DESC';
}

// Статистика и аналитика чеков
export interface CheckStats {
  totalChecks: number;
  activeChecks: number;
  expiredChecks: number;
  totalVolume: number; // Общий объем созданных чеков
  totalActivations: number;
  totalDistributed: number; // Реально распределенная сумма
  averageCheckAmount: number;
  averageActivationsPerCheck: number;
  activationRate: number; // Процент активированных чеков
  checksByType: Record<CheckType, number>;
  popularTimeSlots: Array<{
    hour: number;
    activations: number;
  }>;
  topCreators: Array<{
    userId: number;
    username?: string;
    checksCreated: number;
    totalAmount: number;
  }>;
  topReceivers: Array<{
    userId: number;
    username?: string;
    activationsCount: number;
    totalReceived: number;
  }>;
}

export interface UserCheckStats {
  created: {
    total: number;
    active: number;
    totalAmount: number;
    totalActivated: number;
    averageActivationRate: number;
  };
  received: {
    total: number;
    totalAmount: number;
    averageAmount: number;
    lastActivation?: Date;
  };
  trends: {
    createdByMonth: Array<{
      month: string;
      count: number;
      amount: number;
    }>;
    receivedByMonth: Array<{
      month: string;
      count: number;
      amount: number;
    }>;
  };
}

// Детальная информация о чеке
export interface CheckDetails {
  check: any; // Check model instance
  creator: {
    id: number;
    username?: string;
    level: string;
    reputation?: number;
  };
  activations: Array<{
    id: number;
    userId: number;
    username?: string;
    amount: number;
    activatedAt: Date;
  }>;
  stats: {
    activationRate: number;
    averageTimeToActivation?: number;
    fastestActivation?: number;
    slowestActivation?: number;
    uniqueActivators: number;
  };
  timeline: Array<{
    type: 'created' | 'activated' | 'expired' | 'deactivated';
    timestamp: Date;
    userId?: number;
    username?: string;
    amount?: number;
  }>;
}

// Результаты операций
export interface CheckCreationResult {
  check: any;
  code: string;
  qrCode?: string; // Base64 QR код
  shareUrl: string;
  estimatedActivationTime?: number;
}

export interface CheckActivationResult {
  success: boolean;
  amount: number;
  message: string;
  check: any;
  bonuses?: Array<{
    type: string;
    amount: number;
    description: string;
  }>;
}

export interface BulkCheckCreationData {
  checks: Array<{
    amount: number;
    comment?: string;
    targetUserId?: number;
  }>;
  commonSettings: {
    maxActivations: number;
    type: CheckType;
    password?: string;
    requiredSubscription?: string;
    expiresAt?: Date;
  };
}

export interface BulkCheckResult {
  successful: Array<{
    check: any;
    code: string;
  }>;
  failed: Array<{
    index: number;
    error: string;
    data: any;
  }>;
  summary: {
    total: number;
    successful: number;
    failed: number;
    totalAmount: number;
  };
}

// Конфигурация чеков
export interface CheckServiceConfig {
  limits: {
    minAmount: number;
    maxAmount: number;
    maxActiveChecksPerUser: number;
    maxActivationsPerMultiCheck: number;
    maxExpiryDays: number;
  };
  features: {
    allowPasswordProtection: boolean;
    allowSubscriptionRequirement: boolean;
    allowImageAttachment: boolean;
    allowBulkCreation: boolean;
  };
  fees: {
    creationFeePercent: number; // Комиссия за создание чека
    minCreationFee: number;
    maxCreationFee: number;
  };
  security: {
    maxActivationsPerUserPerDay: number;
    suspiciousActivityThreshold: number;
    requireCaptchaForLargeAmounts: boolean;
    largeAmountThreshold: number;
  };
}

// Перечисления
export enum CheckType {
  PERSONAL = 'personal', // Для конкретного пользователя
  MULTI = 'multi' // Для множественных активаций
}

export enum CheckStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  EXPIRED = 'expired',
  EXHAUSTED = 'exhausted' // Все активации использованы
}

// События системы чеков
export interface CheckCreatedEvent {
  type: 'check_created';
  checkId: number;
  creatorId: number;
  checkType: CheckType;
  amount: number;
  code: string;
  timestamp: Date;
}

export interface CheckActivatedEvent {
  type: 'check_activated';
  checkId: number;
  activationId: number;
  userId: number;
  creatorId: number;
  amount: number;
  code: string;
  remainingActivations: number;
  timestamp: Date;
}

export interface CheckExpiredEvent {
  type: 'check_expired';
  checkId: number;
  creatorId: number;
  unusedAmount: number;
  timestamp: Date;
}

export interface CheckDeactivatedEvent {
  type: 'check_deactivated';
  checkId: number;
  creatorId: number;
  refundAmount: number;
  reason: 'manual' | 'expired' | 'violation';
  timestamp: Date;
}

export interface SuspiciousCheckActivityEvent {
  type: 'suspicious_check_activity';
  userId: number;
  activityType: 'rapid_activations' | 'pattern_detected' | 'large_amount';
  details: Record<string, any>;
  severity: 'low' | 'medium' | 'high';
  timestamp: Date;
}

export type CheckServiceEvent = 
  | CheckCreatedEvent
  | CheckActivatedEvent
  | CheckExpiredEvent
  | CheckDeactivatedEvent
  | SuspiciousCheckActivityEvent;

// API ответы
export interface CheckListResponse {
  checks: any[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  stats: {
    totalAmount: number;
    activeChecks: number;
    totalActivations: number;
  };
}

// src/services/check/types.ts

// Основные интерфейсы для создания и активации чеков
export interface CheckCreateData {
  type: CheckType;
  totalAmount: number;
  maxActivations?: number; // Для multi-чека
  password?: string;
  requiredSubscription?: string; // Ссылка на канал/чат для обязательной подписки
  targetUserId?: number; // Для personal чека
  comment?: string;
  imageUrl?: string;
  expiresAt?: Date;
}

export interface CheckActivateData {
  code: string;
  password?: string;
}

export interface CheckUpdateData {
  comment?: string;
  imageUrl?: string;
  expiresAt?: Date;
  isActive?: boolean;
}

// Фильтры для поиска чеков
export interface CheckFilters {
  type?: CheckType;
  status?: 'active' | 'inactive' | 'expired';
  creatorId?: number;
  hasPassword?: boolean;
  hasSubscriptionRequirement?: boolean;
  amountFrom?: number;
  amountTo?: number;
  dateFrom?: Date;
  dateTo?: Date;
  limit?: number;
  offset?: number;
  sortBy?: 'created_at' | 'total_amount' | 'current_activations' | 'expires_at';
  sortOrder?: 'ASC' | 'DESC';
  search?: string;
}

export interface ActivationFilters {
  checkId?: number;
  userId?: number;
  amountFrom?: number;
  amountTo?: number;
  dateFrom?: Date;
  dateTo?: Date;
  limit?: number;
  offset?: number;
  sortBy?: 'activated_at' | 'amount';
  sortOrder?: 'ASC' | 'DESC';
}

// Статистика и аналитика чеков
export interface CheckStats {
  totalChecks: number;
  activeChecks: number;
  expiredChecks: number;
  totalVolume: number; // Общий объем созданных чеков
  totalActivations: number;
  totalDistributed: number; // Реально распределенная сумма
  averageCheckAmount: number;
  averageActivationsPerCheck: number;
  activationRate: number; // Процент активированных чеков
  checksByType: Record<CheckType, number>;
  popularTimeSlots: Array<{
    hour: number;
    activations: number;
  }>;
  topCreators: Array<{
    userId: number;
    username?: string;
    checksCreated: number;
    totalAmount: number;
  }>;
  topReceivers: Array<{
    userId: number;
    username?: string;
    activationsCount: number;
    totalReceived: number;
  }>;
}

export interface UserCheckStats {
  created: {
    total: number;
    active: number;
    totalAmount: number;
    totalActivated: number;
    averageActivationRate: number;
  };
  received: {
    total: number;
    totalAmount: number;
    averageAmount: number;
    lastActivation?: Date;
  };
  trends: {
    createdByMonth: Array<{
      month: string;
      count: number;
      amount: number;
    }>;
    receivedByMonth: Array<{
      month: string;
      count: number;
      amount: number;
    }>;
  };
}

// Детальная информация о чеке
export interface CheckDetails {
  check: any; // Check model instance
  creator: {
    id: number;
    username?: string;
    level: string;
    reputation?: number;
  };
  activations: Array<{
    id: number;
    userId: number;
    username?: string;
    amount: number;
    activatedAt: Date;
  }>;
  stats: {
    activationRate: number;
    averageTimeToActivation?: number;
    fastestActivation?: number;
    slowestActivation?: number;
    uniqueActivators: number;
  };
  timeline: Array<{
    type: 'created' | 'activated' | 'expired' | 'deactivated';
    timestamp: Date;
    userId?: number;
    username?: string;
    amount?: number;
  }>;
}

// Результаты операций
export interface CheckCreationResult {
  check: any;
  code: string;
  qrCode?: string; // Base64 QR код
  shareUrl: string;
  estimatedActivationTime?: number;
}

export interface CheckActivationResult {
  success: boolean;
  amount: number;
  message: string;
  check: any;
  bonuses?: Array<{
    type: string;
    amount: number;
    description: string;
  }>;
}

export interface BulkCheckCreationData {
  checks: Array<{
    amount: number;
    comment?: string;
    targetUserId?: number;
  }>;
  commonSettings: {
    type: CheckType;
    password?: string;
    requiredSubscription?: string;
    expiresAt?: Date;
    maxActivations: number;
  };
}

export interface BulkCheckResult {
  successful: Array<{
    check: any;
    code: string;
  }>;
  failed: Array<{
    index: number;
    error: string;
    data: any;
  }>;
  summary: {
    total: number;
    successful: number;
    failed: number;
    totalAmount: number;
  };
}

// Конфигурация чеков
export interface CheckServiceConfig {
  limits: {
    minAmount: number;
    maxAmount: number;
    maxActiveChecksPerUser: number;
    maxActivationsPerMultiCheck: number;
    maxExpiryDays: number;
  };
  features: {
    allowPasswordProtection: boolean;
    allowSubscriptionRequirement: boolean;
    allowImageAttachment: boolean;
    allowBulkCreation: boolean;
  };
  fees: {
    creationFeePercent: number; // Комиссия за создание чека
    minCreationFee: number;
    maxCreationFee: number;
  };
  security: {
    maxActivationsPerUserPerDay: number;
    suspiciousActivityThreshold: number;
    requireCaptchaForLargeAmounts: boolean;
    largeAmountThreshold: number;
  };
}

// События системы чеков
export interface CheckCreatedEvent {
  type: 'check_created';
  checkId: number;
  creatorId: number;
  checkType: CheckType;
  amount: number;
  code: string;
  timestamp: Date;
}

export interface CheckActivatedEvent {
  type: 'check_activated';
  checkId: number;
  activationId: number;
  userId: number;
  creatorId: number;
  amount: number;
  code: string;
  remainingActivations: number;
  timestamp: Date;
}

export interface CheckExpiredEvent {
  type: 'check_expired';
  checkId: number;
  creatorId: number;
  unusedAmount: number;
  timestamp: Date;
}

export interface CheckDeactivatedEvent {
  type: 'check_deactivated';
  checkId: number;
  creatorId: number;
  refundAmount: number;
  reason: 'manual' | 'expired' | 'violation';
  timestamp: Date;
}

export interface SuspiciousCheckActivityEvent {
  type: 'suspicious_check_activity';
  userId: number;
  activityType: 'rapid_activations' | 'pattern_detected' | 'large_amount';
  details: Record<string, any>;
  severity: 'low' | 'medium' | 'high';
  timestamp: Date;
}

// API ответы
export interface CheckListResponse {
  checks: any[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  stats: {
    totalAmount: number;
    activeChecks: number;
    totalActivations: number;
  };
}

export interface ActivationListResponse {
  activations: any[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  summary: {
    totalAmount: number;
    averageAmount: number;
    mostRecentActivation?: Date;
  };
}

// Шаблоны чеков
export interface CheckTemplate {
  id: string;
  name: string;
  description: string;
  type: CheckType;
  defaultAmount?: number;
  defaultMaxActivations?: number;
  requiresPassword: boolean;
  requiresSubscription: boolean;
  imageUrl?: string;
  category: 'giveaway' | 'reward' | 'payment' | 'bonus' | 'other';
  isPopular: boolean;
}

// Аналитика активаций
export interface ActivationAnalytics {
  timeDistribution: {
    hourly: Array<{ hour: number; count: number; amount: number }>;
    daily: Array<{ date: string; count: number; amount: number }>;
    weekly: Array<{ week: string; count: number; amount: number }>;
    monthly: Array<{ month: string; count: number; amount: number }>;
  };
  userBehavior: {
    newVsReturning: {
      newUsers: number;
      returningUsers: number;
      newUserAmount: number;
      returningUserAmount: number;
    };
    averageActivationTime: number;
    fastestUsers: Array<{
      userId: number;
      username?: string;
      averageTime: number;
      activationsCount: number;
    }>;
  };
  geographicDistribution?: Array<{
    country: string;
    count: number;
    amount: number;
  }>;
  deviceTypes?: Array<{
    type: 'mobile' | 'desktop' | 'tablet';
    count: number;
    percentage: number;
  }>;
}

// Рекомендации для чеков
export interface CheckRecommendations {
  optimalAmount: {
    suggested: number;
    reason: string;
    basedOn: 'user_history' | 'platform_average' | 'trend_analysis';
  };
  bestTimeToCreate: {
    hour: number;
    dayOfWeek: number;
    reason: string;
  };
  targetAudience: {
    recommendedLevels: string[];
    estimatedActivationRate: number;
  };
  features: {
    usePassword: boolean;
    useSubscriptionRequirement: boolean;
    reasons: string[];
  };
}

// Безопасность и мониторинг
export interface SecurityAlert {
  id: string;
  type: 'suspicious_pattern' | 'rapid_creation' | 'large_amount' | 'bot_activity';
  severity: 'low' | 'medium' | 'high' | 'critical';
  userId: number;
  checkId?: number;
  details: {
    description: string;
    evidence: Record<string, any>;
    riskScore: number;
    automatedAction?: string;
  };
  status: 'pending' | 'reviewed' | 'resolved' | 'false_positive';
  createdAt: Date;
  reviewedAt?: Date;
  reviewedBy?: number;
}

export interface FraudDetectionResult {
  isSuspicious: boolean;
  riskScore: number; // 0-100
  flags: Array<{
    type: string;
    severity: 'low' | 'medium' | 'high';
    description: string;
    confidence: number;
  }>;
  recommendedAction: 'allow' | 'review' | 'block' | 'restrict';
  explanation: string;
}

// Кастомные ошибки
export class CheckServiceError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400,
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = 'CheckServiceError';
  }
}

export class CheckNotFoundError extends CheckServiceError {
  constructor(code: string) {
    super(
      `Check with code ${code} not found`,
      'CHECK_NOT_FOUND',
      404,
      { code }
    );
  }
}

export class CheckExpiredError extends CheckServiceError {
  constructor(code: string, expiresAt: Date) {
    super(
      `Check ${code} has expired`,
      'CHECK_EXPIRED',
      400,
      { code, expiresAt }
    );
  }
}

export class InvalidPasswordError extends CheckServiceError {
  constructor() {
    super(
      'Invalid password for check',
      'INVALID_PASSWORD',
      400
    );
  }
}

export class SubscriptionRequiredError extends CheckServiceError {
  constructor(subscription: string) {
    super(
      `Subscription to ${subscription} is required`,
      'SUBSCRIPTION_REQUIRED',
      400,
      { subscription }
    );
  }
}

export class CheckAlreadyActivatedError extends CheckServiceError {
  constructor(code: string) {
    super(
      `Check ${code} has already been activated by this user`,
      'ALREADY_ACTIVATED',
      400,
      { code }
    );
  }
}

export class NoActivationsRemainingError extends CheckServiceError {
  constructor(code: string) {
    super(
      `Check ${code} has no activations remaining`,
      'NO_ACTIVATIONS_REMAINING',
      400,
      { code }
    );
  }
}