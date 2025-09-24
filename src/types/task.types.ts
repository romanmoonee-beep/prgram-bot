// src/types/task.types.ts

import { TASK_TYPES, TASK_STATUSES, EXECUTION_STATUSES } from '../utils/constants';
import { UserLevel } from './user.types';

// Основные типы
export type TaskType = keyof typeof TASK_TYPES;
export type TaskStatus = keyof typeof TASK_STATUSES;
export type ExecutionStatus = keyof typeof EXECUTION_STATUSES;

// Создание задания
export interface CreateTaskData {
  type: TaskType;
  title: string;
  description?: string;
  targetUrl: string;
  reward: number;
  totalExecutions: number;
  autoCheck?: boolean;
  requireScreenshot?: boolean;
  priority?: number;
  isTopPromoted?: boolean;
  conditions?: TaskConditions;
  requiredSubscriptions?: string[];
  minAccountAge?: number;
  minLevel?: UserLevel;
  expiresAt: Date;
}

// Обновление задания
export interface UpdateTaskData {
  title?: string;
  description?: string;
  reward?: number;
  priority?: number;
  isTopPromoted?: boolean;
  status?: TaskStatus;
  pausedReason?: string;
  expiresAt?: Date;
}

// Условия выполнения задания
export interface TaskConditions {
  requireSubscriptionCheck?: boolean;
  allowedCountries?: string[];
  blockedCountries?: string[];
  minFollowers?: number;
  requireProfilePhoto?: boolean;
  requireBio?: boolean;
  customConditions?: string;
}

// Полная информация о задании
export interface TaskDetails {
  id: number;
  authorId: number;
  type: TaskType;
  title: string;
  description?: string;
  targetUrl: string;
  reward: number;
  totalExecutions: number;
  completedExecutions: number;
  remainingExecutions: number;
  autoCheck: boolean;
  requireScreenshot: boolean;
  priority: number;
  isTopPromoted: boolean;
  conditions?: TaskConditions;
  requiredSubscriptions?: string[];
  minAccountAge?: number;
  minLevel?: UserLevel;
  status: TaskStatus;
  expiresAt: Date;
  pausedAt?: Date;
  pausedReason?: string;
  totalCost: number;
  spentAmount: number;
  frozenAmount: number;
  views: number;
  clicks: number;
  conversions: number;
  createdAt: Date;
  updatedAt: Date;
  
  // Вычисляемые поля
  progress: number; // 0-100%
  conversionRate: number; // 0-100%
  remainingBudget: number;
  isActive: boolean;
  isExpired: boolean;
  isCompleted: boolean;
  
  // Связанные данные
  author?: {
    id: number;
    username?: string;
    firstName?: string;
    displayName: string;
    level: UserLevel;
  };
}

// Краткая информация о задании для списков
export interface TaskSummary {
  id: number;
  type: TaskType;
  title: string;
  reward: number;
  totalExecutions: number;
  completedExecutions: number;
  remainingExecutions: number;
  status: TaskStatus;
  expiresAt: Date;
  views: number;
  clicks: number;
  conversions: number;
  progress: number;
  conversionRate: number;
  isTopPromoted: boolean;
  createdAt: Date;
}

// Выполнение задания
export interface TaskExecution {
  id: number;
  taskId: number;
  userId: number;
  status: ExecutionStatus;
  screenshotUrl?: string;
  comment?: string;
  checkedAt?: Date;
  checkedById?: number;
  rejectionReason?: string;
  rewardAmount: number;
  rewardPaid: boolean;
  rewardPaidAt?: Date;
  autoCheckAttempts: number;
  autoCheckResult?: AutoCheckResult;
  startedAt: Date;
  completedAt?: Date;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  
  // Связанные данные
  task?: TaskSummary;
  user?: {
    id: number;
    username?: string;
    firstName?: string;
    displayName: string;
  };
  checkedBy?: {
    id: number;
    username?: string;
    firstName?: string;
    displayName: string;
  };
}

// Результат автоматической проверки
export interface AutoCheckResult {
  success: boolean;
  checkType: 'subscription' | 'membership' | 'reaction' | 'view';
  details: Record<string, any>;
  timestamp: Date;
  error?: string;
}

// Создание выполнения задания
export interface CreateExecutionData {
  taskId: number;
  userId: number;
  screenshotUrl?: string;
  comment?: string;
}

// Обновление выполнения задания
export interface UpdateExecutionData {
  status?: ExecutionStatus;
  screenshotUrl?: string;
  comment?: string;
  rejectionReason?: string;
}

// Фильтры для поиска заданий
export interface TaskFilter {
  authorId?: number;
  type?: TaskType;
  status?: TaskStatus;
  minReward?: number;
  maxReward?: number;
  autoCheck?: boolean;
  requireScreenshot?: boolean;
  isTopPromoted?: boolean;
  minLevel?: UserLevel;
  createdAfter?: Date;
  createdBefore?: Date;
  expiresAfter?: Date;
  expiresBefore?: Date;
  hasRemainingExecutions?: boolean;
  search?: string; // Поиск по title, description
}

// Фильтры для выполнений заданий
export interface ExecutionFilter {
  taskId?: number;
  userId?: number;
  authorId?: number;
  status?: ExecutionStatus;
  checkedById?: number;
  rewardPaid?: boolean;
  createdAfter?: Date;
  createdBefore?: Date;
  completedAfter?: Date;
  completedBefore?: Date;
}

// Сортировка заданий
export interface TaskSort {
  field: 'reward' | 'totalExecutions' | 'completedExecutions' | 'views' | 'clicks' | 'conversions' | 'createdAt' | 'expiresAt' | 'priority';
  order: 'ASC' | 'DESC';
}

// Сортировка выполнений
export interface ExecutionSort {
  field: 'rewardAmount' | 'createdAt' | 'completedAt' | 'checkedAt';
  order: 'ASC' | 'DESC';
}

// Опции для получения списка заданий
export interface TaskListOptions {
  page: number;
  limit: number;
  filter?: TaskFilter;
  sort?: TaskSort;
  includeAuthor?: boolean;
  includeStats?: boolean;
}

// Результат списка заданий
export interface TaskListResult {
  tasks: TaskDetails[];
  total: number;
  page: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// Опции для получения выполнений
export interface ExecutionListOptions {
  page: number;
  limit: number;
  filter?: ExecutionFilter;
  sort?: ExecutionSort;
  includeTask?: boolean;
  includeUser?: boolean;
}

// Результат списка выполнений
export interface ExecutionListResult {
  executions: TaskExecution[];
  total: number;
  page: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// Статистика задания
export interface TaskStats {
  totalViews: number;
  totalClicks: number;
  totalConversions: number;
  conversionRate: number;
  averageCompletionTime: number;
  completionsByDay: Array<{
    date: Date;
    completions: number;
  }>;
  completionsByHour: Array<{
    hour: number;
    completions: number;
  }>;
  userLevelDistribution: Record<UserLevel, number>;
  geographicDistribution: Record<string, number>;
}

// Аналитика заданий
export interface TaskAnalytics {
  totalTasks: number;
  activeTasks: number;
  completedTasks: number;
  expiredTasks: number;
  totalExecutions: number;
  completedExecutions: number;
  averageCompletionRate: number;
  averageConversionRate: number;
  totalRewardsPaid: number;
  tasksByType: Record<TaskType, number>;
  tasksByStatus: Record<TaskStatus, number>;
  topTasks: Array<{
    id: number;
    title: string;
    completions: number;
    conversionRate: number;
  }>;
}

// Модерация заданий
export interface TaskModeration {
  taskId: number;
  moderatorId: number;
  action: 'approve' | 'reject' | 'pause' | 'resume';
  reason?: string;
  timestamp: Date;
}

// Жалоба на задание
export interface TaskReport {
  id: number;
  taskId: number;
  reporterId: number;
  reason: 'spam' | 'fraud' | 'inappropriate' | 'impossible' | 'other';
  description: string;
  status: 'pending' | 'reviewed' | 'resolved' | 'dismissed';
  reviewedById?: number;
  reviewedAt?: Date;
  resolution?: string;
  createdAt: Date;
}

// Шаблон задания
export interface TaskTemplate {
  id: number;
  name: string;
  type: TaskType;
  title: string;
  description?: string;
  defaultReward: number;
  autoCheck: boolean;
  requireScreenshot: boolean;
  conditions?: TaskConditions;
  isPublic: boolean;
  createdById: number;
  usageCount: number;
  createdAt: Date;
  updatedAt: Date;
}

// Массовые операции с заданиями
export interface BulkTaskOperation {
  taskIds: number[];
  operation: 'pause' | 'resume' | 'cancel' | 'extend' | 'update_priority';
  reason: string;
  data?: Record<string, any>;
}

// Автоматизация заданий
export interface TaskAutomation {
  id: number;
  taskId: number;
  trigger: 'completion_rate' | 'time_remaining' | 'budget_low' | 'no_activity';
  condition: Record<string, any>;
  action: 'pause' | 'increase_reward' | 'extend_deadline' | 'notify_author';
  actionData: Record<string, any>;
  isActive: boolean;
  lastTriggered?: Date;
  createdAt: Date;
}

// Рекомендации заданий
export interface TaskRecommendation {
  taskId: number;
  userId: number;
  score: number; // 0-1
  reasons: string[];
  createdAt: Date;
}

// A/B тестирование заданий
export interface TaskABTest {
  id: number;
  name: string;
  description: string;
  variants: Array<{
    name: string;
    percentage: number;
    changes: Record<string, any>;
  }>;
  metric: 'completion_rate' | 'conversion_rate' | 'clicks';
  isActive: boolean;
  startDate: Date;
  endDate?: Date;
  results?: Record<string, any>;
}

// Экспорт заданий
export interface TaskExportOptions {
  format: 'csv' | 'xlsx' | 'json';
  fields: Array<keyof TaskDetails>;
  filter?: TaskFilter;
  includeExecutions?: boolean;
  includeStats?: boolean;
}

// События задания
export interface TaskEvent {
  taskId: number;
  eventType: 'created' | 'started' | 'completed' | 'paused' | 'resumed' | 'cancelled' | 'expired';
  eventData: Record<string, any>;
  triggeredById?: number;
  timestamp: Date;
}

export default {
  CreateTaskData,
  TaskDetails,
  TaskSummary,
  TaskExecution,
  TaskFilter,
  TaskStats,
  TaskAnalytics,
  TaskReport
};