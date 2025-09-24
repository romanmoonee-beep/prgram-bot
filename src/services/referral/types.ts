// src/services/referral/types.ts

// Основные интерфейсы для реферальной системы
export interface ReferralReward {
  type: 'registration' | 'premium_upgrade' | 'activity';
  amount: number;
  referrerId: number;
  referralId: number;
  activityType?: 'task_completion' | 'balance_topup';
  metadata?: Record<string, any>;
}

export interface ReferralStats {
  totalReferrals: number;
  activeReferrals: number;
  premiumReferrals: number;
  totalEarned: number;
  breakdown: {
    registrationRewards: number;
    premiumBonuses: number;
    activityRewards: number;
  };
  levelDistribution: Record<UserLevel, number>;
  conversionRate: number; // Процент рефералов, ставших Premium
  averageEarningPerReferral: number;
  referrals: Array<{
    id: number;
    username?: string;
    level: string;
    isPremium: boolean;
    registeredAt: Date;
    lastActiveAt?: Date;
    isActive: boolean;
  }>;
}

export interface ReferralFilters {
  level?: UserLevel;
  isPremium?: boolean;
  isActive?: boolean;
  dateFrom?: Date;
  dateTo?: Date;
  limit?: number;
  offset?: number;
  sortBy?: 'registered_at' | 'last_active_at' | 'level' | 'total_earned';
  sortOrder?: 'ASC' | 'DESC';
  search?: string; // Поиск по username
}

// Детальная информация о реферале
export interface ReferralDetails {
  referral: {
    id: number;
    username?: string;
    level: UserLevel;
    isPremium: boolean;
    registeredAt: Date;
    lastActiveAt?: Date;
    isActive: boolean;
    totalEarned: number;
    totalSpent: number;
    tasksCompleted: number;
  };
  earnings: {
    total: number;
    registration: number;
    premiumBonus: number;
    activityRewards: number;
    monthlyBreakdown: Array<{
      month: string;
      amount: number;
      activities: number;
    }>;
  };
  activity: {
    tasksCompleted: number;
    totalTopups: number;
    topupAmount: number;
    lastActivity?: Date;
    averageTaskReward: number;
  };
  timeline: Array<{
    type: 'registered' | 'premium_upgrade' | 'task_completed' | 'balance_topup';
    date: Date;
    amount?: number;
    description: string;
  }>;
}

// Многоуровневая структура рефералов
export interface ReferralTreeNode {
  id: number;
  username?: string;
  level: UserLevel;
  isPremium: boolean;
  registeredAt: Date;
  depth: number;
  directEarnings: number;
  indirectEarnings: number;
  totalEarnings: number;
  children: ReferralTreeNode[];
  isActive: boolean;
  referralsCount: number;
}

export interface ReferralTree {
  tree: ReferralTreeNode[];
  totalLevels: number;
  totalReferrals: number;
  totalEarnings: number;
  levelStats: Array<{
    level: number;
    count: number;
    earnings: number;
  }>;
}

// Рейтинги и лидерборды
export interface ReferrerRanking {
  user: {
    id: number;
    username?: string;
    level: UserLevel;
  };
  rank: number;
  referralsCount: number;
  totalEarned: number;
  premiumReferrals: number;
  conversionRate: number;
  growthRate: number; // Процент роста за период
  badge?: string; // Специальный бейдж за достижения
}

export interface ReferralLeaderboard {
  period: string;
  rankings: ReferrerRanking[];
  myRank?: number;
  totalParticipants: number;
  averageReferrals: number;
  averageEarnings: number;
}

// Конфигурация реферальной системы
export interface ReferralConfig {
  rewards: {
    registration: Record<UserLevel, number>;
    premiumBonus: Record<UserLevel, number>;
    activityPercentage: Record<UserLevel, {
      task_completion: number;
      balance_topup: number;
    }>;
  };
  limits: {
    maxReferralsPerDay: number;
    maxActivityRewardPerDay: Record<UserLevel, number>;
    maxTreeDepth: number;
    minActivityAmountForReward: number;
  };
  features: {
    enableMultiLevel: boolean;
    enableActivityRewards: boolean;
    enablePremiumBonuses: boolean;
    enableLeaderboards: boolean;
  };
  campaigns: {
    bonusMultipliers: Record<string, number>; // Временные кампании
    specialRewards: Record<string, number>;
  };
}

// Аналитика и отчеты
export interface ReferralAnalytics {
  overview: {
    totalReferrers: number;
    totalReferrals: number;
    totalRewardsDistributed: number;
    averageRewardsPerReferrer: number;
    conversionToPremium: number;
    retentionRate30Days: number;
  };
  trends: {
    daily: Array<{
      date: string;
      newReferrals: number;
      rewardsDistributed: number;
      premiumUpgrades: number;
    }>;
// src/services/referral/types.ts

// Основные интерфейсы для реферальной системы
export interface ReferralReward {
  type: 'registration' | 'premium_upgrade' | 'activity';
  amount: number;
  referrerId: number;
  referralId: number;
  activityType?: 'task_completion' | 'balance_topup';
  metadata?: Record<string, any>;
}

export interface ReferralStats {
  totalReferrals: number;
  activeReferrals: number;
  premiumReferrals: number;
  totalEarned: number;
  breakdown: {
    registrationRewards: number;
    premiumBonuses: number;
    activityRewards: number;
  };
  levelDistribution: Record<UserLevel, number>;
  conversionRate: number; // Процент рефералов, ставших Premium
  averageEarningPerReferral: number;
  referrals: Array<{
    id: number;
    username?: string;
    level: string;
    isPremium: boolean;
    registeredAt: Date;
    lastActiveAt?: Date;
    isActive: boolean;
  }>;
}

export interface ReferralFilters {
  level?: UserLevel;
  isPremium?: boolean;
  isActive?: boolean;
  dateFrom?: Date;
  dateTo?: Date;
  limit?: number;
  offset?: number;
  sortBy?: 'registered_at' | 'last_active_at' | 'level' | 'total_earned';
  sortOrder?: 'ASC' | 'DESC';
  search?: string; // Поиск по username
}

// Детальная информация о реферале
export interface ReferralDetails {
  referral: {
    id: number;
    username?: string;
    level: UserLevel;
    isPremium: boolean;
    registeredAt: Date;
    lastActiveAt?: Date;
    isActive: boolean;
    totalEarned: number;
    totalSpent: number;
    tasksCompleted: number;
  };
  earnings: {
    total: number;
    registration: number;
    premiumBonus: number;
    activityRewards: number;
    monthlyBreakdown: Array<{
      month: string;
      amount: number;
      activities: number;
    }>;
  };
  activity: {
    tasksCompleted: number;
    totalTopups: number;
    topupAmount: number;
    lastActivity?: Date;
    averageTaskReward: number;
  };
  timeline: Array<{
    type: 'registered' | 'premium_upgrade' | 'task_completed' | 'balance_topup';
    date: Date;
    amount?: number;
    description: string;
  }>;
}

// Многоуровневая структура рефералов
export interface ReferralTreeNode {
  id: number;
  username?: string;
  level: UserLevel;
  isPremium: boolean;
  registeredAt: Date;
  depth: number;
  directEarnings: number;
  indirectEarnings: number;
  totalEarnings: number;
  children: ReferralTreeNode[];
  isActive: boolean;
  referralsCount: number;
}

export interface ReferralTree {
  tree: ReferralTreeNode[];
  totalLevels: number;
  totalReferrals: number;
  totalEarnings: number;
  levelStats: Array<{
    level: number;
    count: number;
    earnings: number;
  }>;
}

// Рейтинги и лидерборды
export interface ReferrerRanking {
  user: {
    id: number;
    username?: string;
    level: UserLevel;
  };
  rank: number;
  referralsCount: number;
  totalEarned: number;
  premiumReferrals: number;
  conversionRate: number;
  growthRate: number; // Процент роста за период
  badge?: string; // Специальный бейдж за достижения
}

export interface ReferralLeaderboard {
  period: string;
  rankings: ReferrerRanking[];
  myRank?: number;
  totalParticipants: number;
  averageReferrals: number;
  averageEarnings: number;
}

// Конфигурация реферальной системы
export interface ReferralConfig {
  rewards: {
    registration: Record<UserLevel, number>;
    premiumBonus: Record<UserLevel, number>;
    activityPercentage: Record<UserLevel, {
      task_completion: number;
      balance_topup: number;
    }>;
  };
  limits: {
    maxReferralsPerDay: number;
    maxActivityRewardPerDay: Record<UserLevel, number>;
    maxTreeDepth: number;
    minActivityAmountForReward: number;
  };
  features: {
    enableMultiLevel: boolean;
    enableActivityRewards: boolean;
    enablePremiumBonuses: boolean;
    enableLeaderboards: boolean;
  };
  campaigns: {
    bonusMultipliers: Record<string, number>; // Временные кампании
    specialRewards: Record<string, number>;
  };
}

// Аналитика и отчеты
export interface ReferralAnalytics {
  overview: {
    totalReferrers: number;
    totalReferrals: number;
    totalRewardsDistributed: number;
    averageRewardsPerReferrer: number;
    conversionToPremium: number;
    retentionRate30Days: number;
  };
  trends: {
    daily: Array<{
      date: string;
      newReferrals: number;
      rewardsDistributed: number;
      premiumUpgrades: number;
    }>;
    monthly: Array<{
      month: string;
      referrals: number;
      rewards: number;
      conversionRate: number;
    }>;
  };
  topPerformers: {
    byReferrals: ReferrerRanking[];
    byEarnings: ReferrerRanking[];
    byConversion: ReferrerRanking[];
  };
  demographics: {
    levelDistribution: Record<UserLevel, number>;
    activityPatterns: Array<{
      hour: number;
      registrations: number;
      activity: number;
    }>;
    geographicDistribution?: Array<{
      country: string;
      referrals: number;
      conversionRate: number;
    }>;
  };
}

// Кампании и промоакции
export interface ReferralCampaign {
  id: string;
  name: string;
  description: string;
  startDate: Date;
  endDate: Date;
  isActive: boolean;
  multipliers: {
    registration: number;
    premiumBonus: number;
    activityReward: number;
  };
  conditions: {
    minReferrals?: number;
    targetLevel?: UserLevel;
    requiresPremium?: boolean;
  };
  rewards: {
    milestoneRewards: Array<{
      referralsCount: number;
      reward: number;
      description: string;
    }>;
    specialBadges: string[];
  };
  stats: {
    participants: number;
    totalReferrals: number;
    rewardsDistributed: number;
  };
}

// Уведомления и коммуникация
export interface ReferralNotification {
  type: 'new_referral' | 'premium_upgrade' | 'milestone_reached' | 'campaign_reward';
  title: string;
  message: string;
  data: {
    referralId?: number;
    referralUsername?: string;
    reward?: number;
    milestone?: string;
    campaignId?: string;
  };
  priority: 1 | 2 | 3;
  actionUrl?: string;
  imageUrl?: string;
}

// Достижения и бейджи
export interface ReferralAchievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: 'referrals' | 'earnings' | 'conversion' | 'special';
  requirements: {
    type: 'referrals_count' | 'total_earned' | 'conversion_rate' | 'special_condition';
    value: number;
    additionalConditions?: Record<string, any>;
  };
  rewards: {
    gram?: number;
    title?: string;
    multiplierBonus?: number; // Бонус к множителю наград
  };
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  isHidden: boolean; // Скрытые достижения
}

export interface UserReferralAchievements {
  earned: Array<{
    achievement: ReferralAchievement;
    earnedAt: Date;
    progress?: number;
  }>;
  inProgress: Array<{
    achievement: ReferralAchievement;
    currentProgress: number;
    targetProgress: number;
    progressPercentage: number;
  }>;
  available: ReferralAchievement[];
}

// Перечисления
export enum UserLevel {
  BRONZE = 'bronze',
  SILVER = 'silver',
  GOLD = 'gold',
  PREMIUM = 'premium'
}

export enum ReferralLevel {
  DIRECT = 1, // Прямые рефералы
  SECOND = 2, // Рефералы рефералов
  THIRD = 3   // Третий уровень
}

export enum ReferralEventType {
  REGISTRATION = 'referral_registered',
  PREMIUM_UPGRADE = 'referral_premium_upgrade',
  ACTIVITY_REWARD = 'referral_activity_reward',
  MILESTONE_REACHED = 'referral_milestone_reached',
  CAMPAIGN_JOINED = 'referral_campaign_joined',
  ACHIEVEMENT_EARNED = 'referral_achievement_earned'
}

// События реферальной системы
export interface ReferralRegisteredEvent {
  type: 'referral_registered';
  referrerId: number;
  referralId: number;
  reward: number;
  referralCode: string;
  timestamp: Date;
}

export interface ReferralPremiumUpgradeEvent {
  type: 'referral_premium_upgrade';
  referrerId: number;
  referralId: number;
  bonus: number;
  timestamp: Date;
}

export interface ReferralActivityRewardEvent {
  type: 'referral_activity_reward';
  referrerId: number;
  referralId: number;
  activityType: 'task_completion' | 'balance_topup';
  baseAmount: number;
  rewardAmount: number;
  percentage: number;
  timestamp: Date;
}

export interface ReferralMilestoneEvent {
  type: 'referral_milestone_reached';
  userId: number;
  milestone: string;
  referralsCount: number;
  reward?: number;
  badge?: string;
  timestamp: Date;
}

export interface ReferralCampaignJoinedEvent {
  type: 'referral_campaign_joined';
  userId: number;
  campaignId: string;
  campaignName: string;
  timestamp: Date;
}

export interface ReferralAchievementEarnedEvent {
  type: 'referral_achievement_earned';
  userId: number;
  achievementId: string;
  achievementName: string;
  reward?: number;
  timestamp: Date;
}

export type ReferralServiceEvent =
  | ReferralRegisteredEvent
  | ReferralPremiumUpgradeEvent
  | ReferralActivityRewardEvent
  | ReferralMilestoneEvent
  | ReferralCampaignJoinedEvent
  | ReferralAchievementEarnedEvent;

// API ответы
export interface ReferralStatsResponse {
  stats: ReferralStats;
  achievements: UserReferralAchievements;
  currentCampaigns: ReferralCampaign[];
  nextMilestone?: {
    description: string;
    requiredReferrals: number;
    currentReferrals: number;
    reward: number;
  };
}

export interface ReferralTreeResponse {
  tree: ReferralTree;
  summary: {
    directReferrals: number;
    indirectReferrals: number;
    totalEarnings: number;
    potentialEarnings: number; // Если бы все рефералы были активны
  };
}

// Отчеты и экспорт
export interface ReferralReport {
  period: { from: Date; to: Date };
  summary: {
    newReferrals: number;
    totalEarnings: number;
    activeReferrals: number;
    premiumConversions: number;
  };
  breakdown: {
    byLevel: Record<UserLevel, { count: number; earnings: number }>;
    byWeek: Array<{
      week: string;
      referrals: number;
      earnings: number;
    }>;
    byActivity: {
      taskCompletions: { count: number; earnings: number };
      balanceTopups: { count: number; earnings: number };
    };
  };
  topReferrals: Array<{
    id: number;
    username?: string;
    earnings: number;
    activities: number;
  }>;
}

// Кастомные ошибки
export class ReferralServiceError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400,
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = 'ReferralServiceError';
  }
}

export class InvalidReferralCodeError extends ReferralServiceError {
  constructor(code: string) {
    super(
      `Invalid referral code: ${code}`,
      'INVALID_REFERRAL_CODE',
      400,
      { code }
    );
  }
}

export class SelfReferralError extends ReferralServiceError {
  constructor() {
    super(
      'Cannot use your own referral code',
      'SELF_REFERRAL_NOT_ALLOWED',
      400
    );
  }
}

export class MaxReferralLimitError extends ReferralServiceError {
  constructor(limit: number) {
    super(
      `Maximum referral limit reached: ${limit}`,
      'MAX_REFERRAL_LIMIT_REACHED',
      400,
      { limit }
    );
  }
}

export class ReferralAlreadyUsedError extends ReferralServiceError {
  constructor() {
    super(
      'Referral code has already been used by this user',
      'REFERRAL_ALREADY_USED',
      400
    );
  }
}