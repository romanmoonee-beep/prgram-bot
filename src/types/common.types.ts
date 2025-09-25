// src/types/common.types.ts

// Базовые типы для API ответов
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Типы для пагинации
export interface PaginationOptions {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// Типы для фильтров
export interface BaseFilter {
  startDate?: Date;
  endDate?: Date;
  status?: string;
  userId?: number;
}

export interface TaskFilter extends BaseFilter {
  type?: string;
  authorId?: number;
  minReward?: number;
  maxReward?: number;
  autoCheck?: boolean;
}

export interface TransactionFilter extends BaseFilter {
  type?: string;
  minAmount?: number;
  maxAmount?: number;
}

// Типы для статистики
export interface UserStatistics {
  totalEarned: number;
  totalSpent: number;
  tasksCompleted: number;
  tasksCreated: number;
  referralsCount: number;
  balanceHistory: {
    date: Date;
    balance: number;
  }[];
}

export interface TaskStatistics {
  totalViews: number;
  totalClicks: number;
  totalConversions: number;
  conversionRate: number;
  completionRate: number;
  averageCompletionTime: number;
}

export interface SystemStatistics {
  totalUsers: number;
  activeUsers: number;
  totalTasks: number;
  activeTasks: number;
  totalTransactions: number;
  totalGramInCirculation: number;
  topUsers: {
    id: number;
    username?: string;
    totalEarned: number;
  }[];
}

// Типы для уведомлений
export interface NotificationData {
  type: string;
  title: string;
  message: string;
  data?: Record<string, any>;
  actionUrl?: string;
  priority?: number;
  expiresAt?: Date;
}

// Типы для поиска
export interface SearchOptions {
  query: string;
  type?: 'users' | 'tasks' | 'transactions';
  filters?: Record<string, any>;
  limit?: number;
}

export interface SearchResult<T> {
  items: T[];
  total: number;
  query: string;
  searchTime: number;
}

// Типы для кэширования
export interface CacheOptions {
  key: string;
  ttl?: number; // время жизни в секундах
  tags?: string[];
}

export interface CachedData<T> {
  data: T;
  cachedAt: Date;
  expiresAt: Date;
  tags: string[];
}

// Типы для файлов
export interface FileUpload {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

export interface UploadedFile {
  id: string;
  originalName: string;
  filename: string;
  mimetype: string;
  size: number;
  url: string;
  uploadedAt: Date;
  uploadedBy: number;
}

// Типы для Telegram API
export interface TelegramUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
}

export interface TelegramChat {
  id: number;
  type: 'private' | 'group' | 'supergroup' | 'channel';
  title?: string;
  username?: string;
  first_name?: string;
  last_name?: string;
  description?: string;
  invite_link?: string;
  member_count?: number;
}

export interface TelegramMessage {
  message_id: number;
  from?: TelegramUser;
  chat: TelegramChat;
  date: number;
  text?: string;
  entities?: any[];
  photo?: any[];
  document?: any;
  reply_markup?: any;
}

// Типы для webhook данных
export interface WebhookUpdate {
  update_id: number;
  message?: TelegramMessage;
  edited_message?: TelegramMessage;
  channel_post?: TelegramMessage;
  edited_channel_post?: TelegramMessage;
  inline_query?: any;
  chosen_inline_result?: any;
  callback_query?: {
    id: string;
    from: TelegramUser;
    message?: TelegramMessage;
    inline_message_id?: string;
    chat_instance: string;
    data?: string;
    game_short_name?: string;
  };
  shipping_query?: any;
  pre_checkout_query?: any;
  poll?: any;
  poll_answer?: any;
  my_chat_member?: any;
  chat_member?: any;
  chat_join_request?: any;
}

// Типы для валидации
export interface ValidationError {
  field: string;
  message: string;
  value?: any;
}

export interface ValidationResult {
  isValid: boolean;
  errors?: ValidationError[];
}

// Типы для конфигурации
export interface BotConfig {
  token: string;
  webhookUrl?: string;
  adminIds: number[];
  moderatorIds?: number[];
  rateLimit: {
    windowMs: number;
    maxRequests: number;
  };
  features: {
    maintenanceMode: boolean;
    registrationOpen: boolean;
    taskCreationEnabled: boolean;
    checksEnabled: boolean;
  };
}

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl?: boolean;
  pool?: {
    max: number;
    min: number;
    acquire: number;
    idle: number;
  };
}

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
  retryDelayOnFailover: number;
  maxRetriesPerRequest: number;
}

// Типы для задач в очереди
export interface QueueJob<T = any> {
  id: string;
  type: string;
  data: T;
  priority: number;
  attempts: number;
  maxAttempts: number;
  createdAt: Date;
  processAt: Date;
  failedAt?: Date;
  completedAt?: Date;
  error?: string;
}

export interface QueueOptions {
  delay?: number;
  attempts?: number;
  priority?: number;
  removeOnComplete?: number;
  removeOnFail?: number;
}

// Типы для логирования
export interface LogEntry {
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  timestamp: Date;
  userId?: number;
  action?: string;
  data?: Record<string, any>;
  error?: Error;
  requestId?: string;
}

// Типы для метрик
export interface Metric {
  name: string;
  value: number;
  timestamp: Date;
  tags?: Record<string, string>;
}

export interface PerformanceMetrics {
  responseTime: number;
  memoryUsage: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
  };
  activeConnections: number;
  queueSize: number;
  errorRate: number;
}

// Типы для экспорта данных
export interface ExportOptions {
  format: 'json' | 'csv' | 'xlsx';
  fields?: string[];
  filters?: Record<string, any>;
  dateRange?: {
    start: Date;
    end: Date;
  };
}

export interface ExportResult {
  filename: string;
  url: string;
  size: number;
  recordCount: number;
  createdAt: Date;
}

// Типы для бэкапов
export interface BackupInfo {
  id: string;
  filename: string;
  size: number;
  tables: string[];
  createdAt: Date;
  type: 'full' | 'incremental';
  status: 'creating' | 'completed' | 'failed';
}

// Типы для миграций
export interface Migration {
  id: string;
  name: string;
  filename: string;
  executedAt?: Date;
  rollbackedAt?: Date;
  status: 'pending' | 'executed' | 'rollbacked' | 'failed';
}

// Общие utility типы
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
export type Required<T, K extends keyof T> = T & { [P in K]-?: T[P] };
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

// Типы для событий
export interface AppEvent<T = any> {
  type: string;
  data: T;
  timestamp: Date;
  userId?: number;
  source: string;
}

export type EventHandler<T = any> = (event: AppEvent<T>) => void | Promise<void>;

// Типы для middleware
export interface MiddlewareContext {
  userId?: number;
  chatId?: number;
  messageId?: number;
  isAdmin: boolean;
  isModerator: boolean;
  startTime: Date;
  requestId: string;
}

export type MiddlewareFunction = (ctx: any, next: () => Promise<void>) => Promise<void>;