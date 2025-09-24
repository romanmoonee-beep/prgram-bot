// src/services/task/types.ts

// Основные интерфейсы для создания и обновления заданий
export interface TaskCreateData {
  type: TaskType;
  title: string;
  description: string;
  targetUrl: string;
  reward: number;
  totalExecutions: number;
  autoCheck?: boolean;
  requireScreenshot?: boolean;
  isTopPromoted?: boolean;
  conditions?: Record<string, any>;
  requiredSubscriptions?: string[];
  minAccountAge?: number;
  minLevel?: UserLevel;
  expiresAt?: Date;
}

export interface TaskUpdateData {
  title?: string;
  description?: string;
  reward?: number;
  totalExecutions?: number;
  status?: TaskStatus;
  expiresAt?: Date;
  pausedReason?: string;
  conditions?: Record<string, any>;
  requiredSubscriptions?: string[];
  minAccountAge?: number;
  minLevel?: UserLevel;
}

// Фильтры для поиска и получения заданий
export interface TaskFilters {
  type?: TaskType;
  status?: TaskStatus;
  minReward?: number;
  maxReward?: number;
  userLevel?: UserLevel;
  excludeCompleted?: boolean;
  excludeAuthor?: boolean;
  authorId?: number;
  limit?: number;
  offset?: number;
  sortBy?: 'reward' | 'priority' | 'created_at' | 'expires_at' | 'views' | 'clicks' | 'conversions';
  sortOrder?: 'ASC' | 'DESC';
  search?: string;
  dateFrom?: Date;
  dateTo?: Date;
  hasScreenshot?: boolean;
  isTopPromoted?: boolean;
}

export interface TaskExecutionFilters {
  taskId?: number;
  userId?: number;
  status?: ExecutionStatus | ExecutionStatus[];
  dateFrom?: Date;
  dateTo?: Date;
  limit?: number;
  offset?: number;
  sortBy?: 'created_at' | 'completed_at' | 'reward_amount' | 'checked_at';
  sortOrder?: 'ASC' | 'DESC';
  hasScreenshot?: boolean;
  checkedById?: number;
  rewardPaid?: boolean;
}

// Расчеты и аналитика
export interface TaskCostCalculation {
  rewardsCost: number;
  commission: number;
  topPromotion: number;
  totalCost: number;
  commissionRate: number;
  breakdown: {
    baseRewards: number;
    commissionAmount: number;
    topPromotionFee: number;
    platformFee?: number;
  };
}

export interface TaskStats {
  totalTasks: number;
  activeTasks: number;
  completedTasks: number;
  pausedTasks: number;
  cancelledTasks: number;
  expiredTasks: number;
  totalSpent: number;
  totalEarned: number;
  conversionRate: number;
  averageReward: number;
  totalViews: number;
  totalClicks: number;
  totalConversions: number;
  clickThroughRate: number;
  completionRate: number;
}

export interface ExecutionStats {
  totalExecutions: number;
  completedExecutions: number;
  pendingExecutions: number;
  rejectedExecutions: number;
  inReviewExecutions: number;
  autoApprovedExecutions: number;
  successRate: number;
  averageTime: number;
  totalEarned: number;
  averageReward: number;
  fastestExecution?: number; // в минутах
  slowestExecution?: number; // в минутах
}

// Детальная аналитика
export interface TaskAnalytics {
  task: any; // Task model instance
  performance: {
    completionRate: number;
    averageExecutionTime: number;
    conversionFunnel: {
      views: number;
      clicks: number;
      startedExecutions: number;
      completedExecutions: number;
    };
    hourlyDistribution: Array<{
      hour: number;
      executions: number;
      completions: number;
      successRate: number;
    }>;
    dailyTrends: Array<{
      date: string;
      executions: number;
      completions: number;
      views: number;
      clicks: number;
    }>;
  };
  demographics: {
    userLevels: Record<UserLevel, number>;
    averageAccountAge: number;
    repeatUsers: number;
    newUsers: number;
  };
  topPerformers: Array<{
    userId: number;
    username?: string;
    completionTime: number;
    reward: number;
  }>;
  issues: {
    rejectionRate: number;
    commonRejectionReasons: Array<{
      reason: string;
      count: number;
    }>;
    suspiciousActivity: number;
  };
}

// Рекомендации и предложения
export interface TaskRecommendation {
  taskId: number;
  score: number;
  reasons: string[];
  estimatedTime: number;
  difficulty: 'easy' | 'medium' | 'hard';
  category: TaskType;
}

export interface UserTaskPreferences {
  favoriteTypes: TaskType[];
  averageReward: number;
  preferredDifficulty: 'easy' | 'medium' | 'hard';
  activeHours: number[]; // часы дня когда пользователь активен
  completionRate: number;
  averageTime: number;
}

// Административные интерфейсы
export interface ModerationQueueItem {
  executionId: number;
  taskId: number;
  userId: number;
  taskTitle: string;
  taskType: TaskType;
  reward: number;
  submittedAt: Date;
  screenshotUrl?: string;
  comment?: string;
  userLevel: UserLevel;
  userStats: {
    totalExecutions: number;
    successRate: number;
    averageTime: number;
  };
  taskStats: {
    totalExecutions: number;
    completionRate: number;
    rejectionRate: number;
  };
  priority: 'low' | 'medium' | 'high' | 'urgent';
  flags: string[]; // возможные проблемы или подозрения
}

export interface BulkActionResult {
  successful: number[];
  failed: Array<{
    id: number;
    error: string;
    code?: string;
  }>;
  summary: {
    total: number;
    successful: number;
    failed: number;
    processingTime: number;
  };
}

export interface SuspiciousActivityReport {
  userId: number;
  username?: string;
  level: UserLevel;
  flags: Array<{
    type: 'speed' | 'pattern' | 'success_rate' | 'timing' | 'device';
    severity: 'low' | 'medium' | 'high';
    description: string;
    evidence: Record<string, any>;
  }>;
  metrics: {
    tasksPerDay: number;
    averageExecutionTime: number;
    successRate: number;
    unusualPatterns: string[];
  };
  recommendation: 'monitor' | 'warn' | 'restrict' | 'ban';
  confidence: number; // 0-100
}

// Перечисления
export enum TaskType {
  SUBSCRIBE = 'subscribe',
  JOIN = 'join',
  VIEW = 'view',
  BOT = 'bot',
  REACT = 'react'
}

export enum TaskStatus {
  ACTIVE = 'active',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  EXPIRED = 'expired'
}

export enum ExecutionStatus {
  PENDING = 'pending',
  IN_REVIEW = 'in_review',
  COMPLETED = 'completed',
  REJECTED = 'rejected',
  AUTO_APPROVED = 'auto_approved'
}

export enum UserLevel {
  BRONZE = 'bronze',
  SILVER = 'silver',
  GOLD = 'gold',
  PREMIUM = 'premium'
}

export enum TaskPriority {
  LOW = 1,
  NORMAL = 5,
  HIGH = 8,
  URGENT = 10
}

// События для системы событий
export interface TaskCreatedEvent {
  type: 'task_created';
  taskId: number;
  authorId: number;
  taskType: TaskType;
  reward: number;
  totalExecutions: number;
  cost: number;
  timestamp: Date;
}

export interface TaskCompletedEvent {
  type: 'task_completed';
  taskId: number;
  authorId: number;
  totalSpent: number;
  completedExecutions: number;
  completionRate: number;
  timestamp: Date;
}

export interface ExecutionStartedEvent {
  type: 'execution_started';
  executionId: number;
  taskId: number;
  userId: number;
  taskType: TaskType;
  reward: number;
  timestamp: Date;
}

export interface ExecutionCompletedEvent {
  type: 'execution_completed';
  executionId: number;
  taskId: number;
  userId: number;
  reward: number;
  completionTime: number; // в минутах
  autoChecked: boolean;
  timestamp: Date;
}

export interface ExecutionRejectedEvent {
  type: 'execution_rejected';
  executionId: number;
  taskId: number;
  userId: number;
  reason: string;
  checkedBy: 'auto' | 'manual';
  checkedById?: number;
  timestamp: Date;
}

export interface TaskPausedEvent {
  type: 'task_paused';
  taskId: number;
  authorId: number;
  reason: string;
  pausedBy: 'author' | 'admin';
  adminId?: number;
  timestamp: Date;
}

export interface TaskCancelledEvent {
  type: 'task_cancelled';
  taskId: number;
  authorId: number;
  reason?: string;
  refundAmount: number;
  timestamp: Date;
}

export interface SuspiciousActivityDetectedEvent {
  type: 'suspicious_activity';
  userId: number;
  activityType: string;
  severity: 'low' | 'medium' | 'high';
  evidence: Record<string, any>;
  timestamp: Date;
}

// Объединенный тип всех событий
export type TaskServiceEvent = 
  | TaskCreatedEvent
  | TaskCompletedEvent
  | ExecutionStartedEvent
  | ExecutionCompletedEvent
  | ExecutionRejectedEvent
  | TaskPausedEvent
  | TaskCancelledEvent
  | SuspiciousActivityDetectedEvent;

// Конфигурации и настройки
export interface TaskServiceConfig {
  limits: {
    maxTasksPerDay: Record<UserLevel, number>;
    maxExecutionsPerUser: number;
    maxScreenshotSize: number; // в байтах
    taskTitleMaxLength: number;
    taskDescriptionMaxLength: number;
  };
  rewards: Record<TaskType, { min: number; max: number }>;
  commissions: Record<UserLevel, number>;
  timeouts: {
    executionExpiry: number; // в часах
    autoApprovalDelay: number; // в часах
    reviewTimeout: number; // в часах
  };
  antifraud: {
    minExecutionTime: number; // в секундах
    maxExecutionsPerHour: number;
    suspiciousSuccessRate: number; // в процентах
    maxSameTaskPerDay: number;
  };
}

// Ответы API
export interface TaskListResponse {
  tasks: any[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  filters: TaskFilters;
  summary: {
    totalReward: number;
    averageReward: number;
    mostPopularType: TaskType;
  };
}

export interface TaskDetailResponse {
  task: any;
  analytics?: TaskAnalytics;
  executions: {
    recent: any[];
    total: number;
    pending: number;
    completed: number;
  };
  author: {
    id: number;
    username?: string;
    level: UserLevel;
    reputation: number;
    tasksCreated: number;
  };
  canExecute: boolean;
  canModify: boolean;
  recommendations?: TaskRecommendation[];
}

// Ошибки и исключения
export class TaskServiceError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400,
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = 'TaskServiceError';
  }
}

export class InsufficientBalanceError extends TaskServiceError {
  constructor(required: number, available: number) {
    super(
      `Insufficient balance. Required: ${required}, Available: ${available}`,
      'INSUFFICIENT_BALANCE',
      400,
      { required, available }
    );
  }
}

export class TaskLimitExceededError extends TaskServiceError {
  constructor(limit: number, userLevel: UserLevel) {
    super(
      `Daily task creation limit exceeded. Limit: ${limit} for ${userLevel} level`,
      'TASK_LIMIT_EXCEEDED',
      400,
      { limit, userLevel }
    );
  }
}

export class ExecutionNotAllowedError extends TaskServiceError {
  constructor(reason: string) {
    super(
      `Task execution not allowed: ${reason}`,
      'EXECUTION_NOT_ALLOWED',
      403,
      { reason }
    );
  }
}