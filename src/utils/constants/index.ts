// src/utils/constants/index.ts

// Эмодзи для интерфейса
export const EMOJIS = {
  // Основные
  home: '🏠',
  user: '👤',
  money: '💰',
  diamond: '💎',
  fire: '🔥',
  check: '✅',
  cross: '❌',
  warning: '⚠️',
  info: 'ℹ️',
  
  // Уровни пользователей
  bronze: '🥉',
  silver: '🥈',
  gold: '🥇',
  premium: '💎',
  
  // Типы заданий
  channel: '📺',
  group: '👥',
  view: '👀',
  bot: '🤖',
  reaction: '👍',
  
  // Функции
  earn: '💰',
  advertise: '📢',
  referrals: '🔗',
  checks: '💳',
  subscription: '✅',
  settings: '⚙️',
  stats: '📊',
  help: '❓',
  
  // Состояния
  active: '🟢',
  inactive: '🔴',
  pending: '🟡',
  completed: '✅',
  failed: '❌',
  
  // Время
  clock: '🕐',
  calendar: '📅',
  timer: '⏱️',
  
  // Дополнительные
  star: '⭐',
  gift: '🎁',
  chart: '📈',
  lock: '🔒',
  key: '🔑',
  bell: '🔔'
} as const;

// Тексты интерфейса
export const TEXTS = {
  // Общие
  back: '⬅️ Назад',
  next: '➡️ Далее',
  cancel: '❌ Отмена',
  confirm: '✅ Подтвердить',
  save: '💾 Сохранить',
  edit: '✏️ Редактировать',
  delete: '🗑️ Удалить',
  
  // Главное меню
  mainMenu: 'ГЛАВНОЕ МЕНЮ',
  cabinet: 'Мой кабинет',
  earn: 'Заработать',
  advertise: 'Рекламировать',
  checks: 'Чеки',
  referrals: 'Реферальная',
  subscription: 'Проверка подписки',
  settings: 'Настройки',
  
  // Кабинет
  balance: 'Баланс',
  level: 'Уровень',
  frozen: 'Заморожено',
  statistics: 'Статистика',
  tasksCompleted: 'Выполнено заданий',
  tasksCreated: 'Создано заданий',
  referralsCount: 'Рефералов',
  totalEarned: 'Заработано всего',
  
  // Задания
  subscribe: 'Подписаться',
  joinGroup: 'Вступить',
  viewPost: 'Просмотреть',
  goToBot: 'Перейти к боту',
  reactPost: 'Поставить реакцию',
  checkTask: 'Проверить',
  taskCompleted: 'Задание выполнено!',
  taskFailed: 'Задание не выполнено',
  
  // Ошибки
  notRegistered: 'Вы не зарегистрированы в системе',
  insufficientFunds: 'Недостаточно средств',
  taskNotFound: 'Задание не найдено',
  alreadyCompleted: 'Задание уже выполнено',
  notSubscribed: 'Вы не подписаны на канал',
  
  // Успешные операции
  registered: 'Регистрация прошла успешно!',
  fundsAdded: 'Средства зачислены на баланс',
  taskCreated: 'Задание создано успешно',
  rewardReceived: 'Награда получена!'
} as const;

// Типы заданий
export const TASK_TYPES = {
  SUBSCRIBE_CHANNEL: 'subscribe_channel',
  JOIN_GROUP: 'join_group', 
  VIEW_POST: 'view_post',
  BOT_INTERACTION: 'bot_interaction',
  REACT_POST: 'react_post'
} as const;

// Статусы заданий
export const TASK_STATUSES = {
  ACTIVE: 'active',
  PAUSED: 'paused',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  EXPIRED: 'expired'
} as const;

// Статусы выполнения заданий
export const EXECUTION_STATUSES = {
  PENDING: 'pending',
  IN_REVIEW: 'in_review',
  COMPLETED: 'completed',
  REJECTED: 'rejected',
  AUTO_APPROVED: 'auto_approved'
} as const;

// Типы транзакций
export const TRANSACTION_TYPES = {
  DEPOSIT: 'deposit',
  WITHDRAW: 'withdraw',
  TASK_REWARD: 'task_reward',
  TASK_PAYMENT: 'task_payment',
  REFERRAL_BONUS: 'referral_bonus',
  COMMISSION: 'commission',
  REFUND: 'refund',
  CHECK_SENT: 'check_sent',
  CHECK_RECEIVED: 'check_received'
} as const;

// Уровни пользователей
export const USER_LEVELS = {
  BRONZE: 'bronze',
  SILVER: 'silver',
  GOLD: 'gold',
  PREMIUM: 'premium'
} as const;

// Типы уведомлений
export const NOTIFICATION_TYPES = {
  TASK_COMPLETED: 'task_completed',
  TASK_CREATED: 'task_created',
  REFERRAL_JOINED: 'referral_joined',
  BALANCE_LOW: 'balance_low',
  LEVEL_UP: 'level_up',
  CHECK_RECEIVED: 'check_received',
  SYSTEM: 'system'
} as const;

// Регулярные выражения
export const REGEX = {
  TELEGRAM_USERNAME: /^@[a-zA-Z0-9_]{5,32}$/,
  TELEGRAM_LINK: /^https:\/\/t\.me\/[a-zA-Z0-9_]{5,32}$/,
  TELEGRAM_CHANNEL_LINK: /^https:\/\/t\.me\/[a-zA-Z0-9_]{5,32}$/,
  TELEGRAM_POST_LINK: /^https:\/\/t\.me\/[a-zA-Z0-9_]{5,32}\/\d+$/,
  NUMBER: /^\d+$/,
  FLOAT_NUMBER: /^\d+\.?\d*$/
} as const;

// Лимиты системы
export const LIMITS = {
  // Задания
  MAX_TASK_DESCRIPTION: 500,
  MAX_TASK_TITLE: 100,
  MIN_TASK_REWARD: 10,
  MAX_TASK_REWARD: 10000,
  MIN_TASK_EXECUTIONS: 1,
  MAX_TASK_EXECUTIONS: 10000,
  
  // Чеки
  MIN_CHECK_AMOUNT: 10,
  MAX_CHECK_AMOUNT: 100000,
  MAX_CHECK_ACTIVATIONS: 1000,
  CHECK_PASSWORD_LENGTH: 50,
  CHECK_COMMENT_LENGTH: 200,
  
  // Рефералы
  MAX_REFERRAL_LEVELS: 3,
  
  // Файлы
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  MAX_SCREENSHOT_SIZE: 5 * 1024 * 1024, // 5MB
  
  // Пользователи
  MAX_USERNAME_LENGTH: 32,
  MAX_FIRST_NAME_LENGTH: 64,
  
  // Общие
  MAX_PAGINATION_LIMIT: 50,
  DEFAULT_PAGINATION_LIMIT: 10
} as const;

// Время (в миллисекундах)
export const TIME = {
  SECOND: 1000,
  MINUTE: 60 * 1000,
  HOUR: 60 * 60 * 1000,
  DAY: 24 * 60 * 60 * 1000,
  WEEK: 7 * 24 * 60 * 60 * 1000,
  MONTH: 30 * 24 * 60 * 60 * 1000,
  
  // Таймауты
  TASK_AUTO_APPROVE: 24 * 60 * 60 * 1000, // 24 часа
  SUBSCRIPTION_CHECK_DELAY: 30 * 1000, // 30 секунд
  RATE_LIMIT_WINDOW: 60 * 1000, // 1 минута
  
  // Интервалы проверок
  CHECK_SUBSCRIPTIONS_INTERVAL: 5 * 60 * 1000, // 5 минут
  CLEANUP_INTERVAL: 60 * 60 * 1000, // 1 час
  STATS_UPDATE_INTERVAL: 10 * 60 * 1000 // 10 минут
} as const;

export default {
  EMOJIS,
  TEXTS,
  TASK_TYPES,
  TASK_STATUSES,
  EXECUTION_STATUSES,
  TRANSACTION_TYPES,
  USER_LEVELS,
  NOTIFICATION_TYPES,
  REGEX,
  LIMITS,
  TIME
};