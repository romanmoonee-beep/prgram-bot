// src/services/user/types.ts

// Основные интерфейсы для работы с пользователями
export interface UserCreateData {
  telegramId: number;
  username?: string;
  firstName?: string;
  lastName?: string;
  languageCode?: string;
  referrerId?: number;
}

export interface UserUpdateData {
  username?: string;
  firstName?: string;
  lastName?: string;
  languageCode?: string;
  notificationSettings?: NotificationSettings;
  isActive?: boolean;
}

export interface NotificationSettings {
  tasks: boolean;
  referrals: boolean;
  system: boolean;
  marketing: boolean;
  achievements?: boolean;
  checks?: boolean;
}

// Фильтры для поиска пользователей
export interface UserFilters {
  level?: UserLevel;
  isPremium?: boolean;
  isBanned?: boolean;
  isActive?: boolean;
  hasReferrer?: boolean;
  registeredFrom?: Date;
  registeredTo?: Date;
  lastActiveFrom?: Date;
  lastActiveTo?: Date;
  balanceFrom?: number;
  balanceTo?: number;
  search?: string; // Поиск по username, имени
  sortBy?: 'registered_at' | 'last_active_at' | 'balance' | 'total_earned' | 'level';
  sortOrder?: 'ASC' | 'DESC';
  limit?: number;
  offset?: number;
}

// Статистика пользователя
export interface UserStats {
  balance: {
    current: number;
    frozen: number;
    total: number;
    totalEarned: number;
    totalSpent: number;
    netWorth: number;
  };
  tasks: {
    completed: number;
    created: number;
    successRate: number;
    averageReward: number;
    totalRewards: number;
  };
  referrals: {
    total: number;
    premium: number;
    conversionRate: number;
    totalEarnings: number;
  };
  level: {
    current: UserLevel;
    benefits: LevelBenefits;
    nextLevel: UserLevel | null;
    progress: {
      current: number;
      required: number;
      percentage: number;
    };
  };
  activity: {
    registeredAt: Date;
    daysSinceRegistration: number;
    averageDailyActivity: number;
  };
}

// Операции с балансом
export interface BalanceOperation {
  type: 'credit' | 'debit' | 'freeze' | 'unfreeze';
  amount: number;
  description: string;
  reference?: string;
  metadata?: Record<string, any>;
}

export interface BalanceHistory {
  operations: Array<{
    id: number;
    type: string;
    amount: number;
    balanceBefore: number;
    balanceAfter: number;
    description: string;
    createdAt: Date;
    metadata?: Record<string, any>;
  }>;
  summary: {
    totalCredits: number;
    totalDebits: number;
    totalOperations: number;
    periodStart: Date;
    periodEnd: Date;
  };
}

// Профиль пользователя с дополнительной информацией
export interface UserProfile {
  user: {
    id: number;
    username?: string;
    firstName?: string;
    lastName?: string;
    level: UserLevel;
    isPremium: boolean;
    premiumExpiresAt?: Date;
    registeredAt: Date;
    lastActiveAt?: Date;
  };
  stats: UserStats;
  achievements: Array<{
    id: string;
    name: string;
    description: string;
    earnedAt: Date;
    category: string;
    rarity: 'common' | 'rare' | 'epic' | 'legendary';
  }>;
// src/services/user/types.ts

// Основные интерфейсы для работы с пользователями
export interface UserCreateData {
  telegramId: number;
  username?: string;
  firstName?: string;
  lastName?: string;
  languageCode?: string;
  referrerId?: number;
}

export interface UserUpdateData {
  username?: string;
  firstName?: string;
  lastName?: string;
  languageCode?: string;
  notificationSettings?: NotificationSettings;
  isActive?: boolean;
}

export interface NotificationSettings {
  tasks: boolean;
  referrals: boolean;
  system: boolean;
  marketing: boolean;
  achievements?: boolean;
  checks?: boolean;
}

// Фильтры для поиска пользователей
export interface UserFilters {
  level?: UserLevel;
  isPremium?: boolean;
  isBanned?: boolean;
  isActive?: boolean;
  hasReferrer?: boolean;
  registeredFrom?: Date;
  registeredTo?: Date;
  lastActiveFrom?: Date;
  lastActiveTo?: Date;
  balanceFrom?: number;
  balanceTo?: number;
  search?: string; // Поиск по username, имени
  sortBy?: 'registered_at' | 'last_active_at' | 'balance' | 'total_earned' | 'level';
  sortOrder?: 'ASC' | 'DESC';
  limit?: number;
  offset?: number;
}

// Статистика пользователя
export interface UserStats {
  balance: {
    current: number;
    frozen: number;
    total: number;
    totalEarned: number;
    totalSpent: number;
    netWorth: number;
  };
  tasks: {
    completed: number;
    created: number;
    successRate: number;
    averageReward: number;
    totalRewards: number;
  };
  referrals: {
    total: number;
    premium: number;
    conversionRate: number;
    totalEarnings: number;
  };
  level: {
    current: UserLevel;
    benefits: LevelBenefits;
    nextLevel: UserLevel | null;
    progress: {
      current: number;
      required: number;
      percentage: number;
    };
  };
  activity: {
    registeredAt: Date;
    daysSinceRegistration: number;
    averageDailyActivity: number;
  };
}

// Операции с балансом
export interface BalanceOperation {
  type: 'credit' | 'debit' | 'freeze' | 'unfreeze';
  amount: number;
  description: string;
  reference?: string;
  metadata?: Record<string, any>;
}

export interface BalanceHistory {
  operations: Array<{
    id: number;
    type: string;
    amount: number;
    balanceBefore: number;
    balanceAfter: number;
    description: string;
    createdAt: Date;
    metadata?: Record<string, any>;
  }>;
  summary: {
    totalCredits: number;
    totalDebits: number;
    totalOperations: number;
    periodStart: Date;
    periodEnd: Date;
  };
}

// Профиль пользователя с дополнительной информацией
export interface UserProfile {
  user: {
    id: number;
    username?: string;
    firstName?: string;
    lastName?: string;
    level: UserLevel;
    isPremium: boolean;
    premiumExpiresAt?: Date;
    registeredAt: Date;
    lastActiveAt?: Date;
  };
  stats: UserStats;
  achievements: Array<{
    id: string;
    name: string;
    description: string;
    earnedAt: Date;
    category: string;
    rarity: 'common' | 'rare' | 'epic' | 'legendary';
  }>;
  referralInfo: {
    referralCode: string;
    referrer?: {
      id: number;
      username?: string;
      level: UserLevel;
    };
    directReferrals: number;
    totalReferralEarnings: number;
  };
}

// Сессии и безопасность
export interface UserSession {
  id: string;
  userId: number;
  deviceInfo: {
    platform: string;
    version?: string;
    ip?: string;
    userAgent?: string;
  };
  isActive: boolean;
  lastActivity: Date;
  createdAt: Date;
  expiresAt: Date;
}

export interface SecurityEvent {
  id: string;
  userId: number;
  type: 'login' | 'suspicious_activity' | 'ban' | 'unban' | 'password_change';
  severity: 'low' | 'medium' | 'high';
  details: Record<string, any>;
  ip?: string;
  userAgent?: string;
  createdAt: Date;
}

// Аналитика пользователей
export interface UserAnalytics {
  demographics: {
    totalUsers: number;
    activeUsers: number;
    premiumUsers: number;
    bannedUsers: number;
    levelDistribution: Record<UserLevel, number>;
    registrationTrends: Array<{
      date: string;
      registrations: number;
      activations: number;
    }>;
  };
  engagement: {
    dailyActiveUsers: number;
    weeklyActiveUsers: number;
    monthlyActiveUsers: number;
    averageSessionDuration: number;
    retentionRates: {
      day1: number;
      day7: number;
      day30: number;
    };
  };
  economics: {
    totalBalance: number;
    totalEarnings: number;
    totalSpent: number;
    averageBalance: number;
    topEarners: Array<{
      userId: number;
      username?: string;
      totalEarned: number;
    }>;
  };
}

// Уровни пользователей
export enum UserLevel {
  BRONZE = 'bronze',
  SILVER = 'silver',
  GOLD = 'gold',
  PREMIUM = 'premium'
}

// Преимущества уровней
export interface LevelBenefits {
  dailyTaskLimit: number;
  commissionRate: number;
  referralReward: number;
  bonusMultiplier: number;
  prioritySupport: boolean;
  specialFeatures: string[];
}

// Административные операции
export interface AdminUserAction {
  type: 'ban' | 'unban' | 'adjust_balance' | 'grant_premium' | 'revoke_premium' | 'change_level';
  userId: number;
  adminId: number;
  reason: string;
  metadata?: Record<string, any>;
  timestamp: Date;
}

export interface UserReport {
  reportId: string;
  reportedUserId: number;
  reporterId: number;
  category: 'spam' | 'fraud' | 'abuse' | 'other';
  description: string;
  evidence?: {
    screenshots: string[];
    transactionIds: number[];
    additionalInfo: Record<string, any>;
  };
  status: 'pending' | 'investigating' | 'resolved' | 'dismissed';
  assignedTo?: number;
  resolution?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Пользовательские предпочтения
export interface UserPreferences {
  language: string;
  timezone?: string;
  theme?: 'light' | 'dark' | 'auto';
  notifications: NotificationSettings;
  privacy: {
    showInLeaderboards: boolean;
    allowDirectMessages: boolean;
    shareActivityStatus: boolean;
  };
  display: {
    compactMode: boolean;
    showTutorials: boolean;
    animationsEnabled: boolean;
  };
}

// Достижения пользователя
export interface UserAchievement {
  achievementId: string;
  userId: number;
  progress: number;
  maxProgress: number;
  isCompleted: boolean;
  earnedAt?: Date;
  notificationSent: boolean;
  metadata?: Record<string, any>;
}

// Экспорт данных пользователя (GDPR)
export interface UserDataExport {
  profile: UserProfile;
  transactions: Array<{
    id: number;
    type: string;
    amount: number;
    description: string;
    createdAt: Date;
  }>;
  tasks: {
    created: Array<{
      id: number;
      title: string;
      reward: number;
      completions: number;
      createdAt: Date;
    }>;
    completed: Array<{
      taskId: number;
      taskTitle: string;
      reward: number;
      completedAt: Date;
    }>;
  };
  referrals: Array<{
    referredUserId: number;
    registeredAt: Date;
    earnings: number;
  }>;
  checks: {
    created: Array<{
      checkId: string;
      amount: number;
      activations: number;
      createdAt: Date;
    }>;
    activated: Array<{
      checkId: string;
      amount: number;
      activatedAt: Date;
    }>;
  };
  securityEvents: SecurityEvent[];
}

// Кеширование пользовательских данных
export interface UserCache {
  userId: number;
  data: {
    profile: Partial<UserProfile>;
    stats: Partial<UserStats>;
    preferences: UserPreferences;
  };
  lastUpdated: Date;
  expiresAt: Date;
  version: number;
}

// События пользователя
export interface UserRegisteredEvent {
  type: 'user_registered';
  userId: number;
  telegramId: number;
  referrerId?: number;
  timestamp: Date;
}

export interface UserLevelUpEvent {
  type: 'user_level_up';
  userId: number;
  fromLevel: UserLevel;
  toLevel: UserLevel;
  totalEarned: number;
  timestamp: Date;
}

export interface UserPremiumActivatedEvent {
  type: 'user_premium_activated';
  userId: number;
  durationDays: number;
  expiresAt: Date;
  timestamp: Date;
}

export interface UserBannedEvent {
  type: 'user_banned';
  userId: number;
  reason: string;
  adminId?: number;
  timestamp: Date;
}

export interface UserBalanceChangedEvent {
  type: 'user_balance_changed';
  userId: number;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  transactionType: string;
  timestamp: Date;
}

export type UserServiceEvent = 
  | UserRegisteredEvent
  | UserLevelUpEvent
  | UserPremiumActivatedEvent
  | UserBannedEvent
  | UserBalanceChangedEvent;

// API ответы
export interface UserListResponse {
  users: Array<{
    id: number;
    username?: string;
    firstName?: string;
    level: UserLevel;
    isPremium: boolean;
    balance: number;
    registeredAt: Date;
    lastActiveAt?: Date;
  }>;
  pagination: {
    total: number;
    page: number;
    limit: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  filters: UserFilters;
}

export interface UserStatsResponse {
  stats: UserStats;
  trends: {
    balanceHistory: Array<{
      date: string;
      balance: number;
      earned: number;
      spent: number;
    }>;
    activityHistory: Array<{
      date: string;
      tasksCompleted: number;
      earnings: number;
    }>;
  };
  goals: {
    nextLevel: {
      level: UserLevel;
      required: number;
      current: number;
      daysToAchieve?: number;
    };
    monthlyTarget?: {
      targetEarnings: number;
      currentEarnings: number;
      daysLeft: number;
    };
  };
}

// Кастомные ошибки
export class UserServiceError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400,
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = 'UserServiceError';
  }
}

export class UserNotFoundError extends UserServiceError {
  constructor(identifier: string | number) {
    super(
      `User not found: ${identifier}`,
      'USER_NOT_FOUND',
      404,
      { identifier }
    );
  }
}

export class InsufficientBalanceError extends UserServiceError {
  constructor(required: number, available: number) {
    super(
      `Insufficient balance. Required: ${required}, Available: ${available}`,
      'INSUFFICIENT_BALANCE',
      400,
      { required, available }
    );
  }
}

export class UserAlreadyExistsError extends UserServiceError {
  constructor(telegramId: number) {
    super(
      `User already exists with Telegram ID: ${telegramId}`,
      'USER_ALREADY_EXISTS',
      409,
      { telegramId }
    );
  }
}

export class UserBannedError extends UserServiceError {
  constructor(userId: number, reason?: string) {
    super(
      `User is banned: ${reason || 'No reason provided'}`,
      'USER_BANNED',
      403,
      { userId, reason }
    );
  }
}

export class InvalidLevelError extends UserServiceError {
  constructor(level: string) {
    super(
      `Invalid user level: ${level}`,
      'INVALID_LEVEL',
      400,
      { level }
    );
  }
}

export class PremiumExpiredError extends UserServiceError {
  constructor(userId: number, expiredAt: Date) {
    super(
      'Premium subscription has expired',
      'PREMIUM_EXPIRED',
      403,
      { userId, expiredAt }
    );
  }
}