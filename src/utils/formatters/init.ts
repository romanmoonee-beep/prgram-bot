// src/utils/formatters.ts
import { EMOJIS, TASK_TYPES, USER_LEVELS, TRANSACTION_TYPES } from './constants';
import { formatGram, formatTimeAgo, formatTimeRemaining, createProgressBar, getLevelText, getLevelEmoji } from './helpers';

// Интерфейсы для типизации
interface UserData {
  id: number;
  username?: string;
  firstName?: string;
  lastName?: string;
  balance?: number;
  level: string;
  tasksCompleted?: number;
  tasksCreated?: number;
  referralsCount?: number;
  totalEarned?: number;
  registeredAt: Date;
  lastActiveAt: Date;
}

interface TaskData {
  id: number;
  title: string;
  type: string;
  reward: number;
  totalExecutions: number;
  completedExecutions?: number;
  remainingExecutions?: number;
  status: string;
  views?: number;
  clicks?: number;
  conversions?: number;
  createdAt: Date;
  expiresAt: Date;
}

interface TransactionData {
  id: number;
  type: string;
  amount: number;
  description?: string;
  createdAt: Date;
  status: string;
}

// Форматирование профиля пользователя
export function formatUserProfile(user: UserData): string {
  const displayName = user.firstName && user.lastName 
    ? `${user.firstName} ${user.lastName}`
    : user.firstName || user.username || 'Пользователь';

  const levelEmoji = getLevelEmoji(user.level);
  const levelText = getLevelText(user.level);

  return `${EMOJIS.user} **${displayName}**

${EMOJIS.info} **Информация:**
├ ID: \`${user.id}\`
├ Username: ${user.username ? `@${user.username}` : 'не указан'}
├ Уровень: ${levelText} ${levelEmoji}
└ Зарегистрирован: ${formatTimeAgo(user.registeredAt)}

${EMOJIS.money} **Баланс:** ${formatGram(user.balance || 0)}

${EMOJIS.stats} **Статистика:**
├ Выполнено заданий: ${user.tasksCompleted || 0}
├ Создано заданий: ${user.tasksCreated || 0}
├ Рефералов: ${user.referralsCount || 0}
└ Заработано всего: ${formatGram(user.totalEarned || 0)}

${EMOJIS.clock} Последняя активность: ${formatTimeAgo(user.lastActiveAt)}`;
}

// Форматирование краткой информации о пользователе
export function formatUserShort(user: UserData): string {
  const displayName = user.firstName || user.username || 'Пользователь';
  const levelEmoji = getLevelEmoji(user.level);
  
  return `${levelEmoji} ${displayName} | ${formatGram(user.balance || 0)}`;
}

// Форматирование задания для списка
export function formatTaskListItem(task: TaskData, index?: number): string {
  const typeIcon = getTaskTypeIcon(task.type);
  const statusIcon = getTaskStatusIcon(task.status);
  const progress = task.totalExecutions > 0 
    ? Math.round(((task.completedExecutions || 0) / task.totalExecutions) * 100)
    : 0;

  const prefix = index !== undefined ? `${index}. ` : '';

  return `${prefix}${typeIcon} **${task.title}**
${EMOJIS.money} ${formatGram(task.reward)} | ${statusIcon} ${progress}% | ${EMOJIS.view} ${task.views || 0}
${EMOJIS.timer} ${formatTimeRemaining(task.expiresAt)}`;
}

// Форматирование детальной информации о задании
export function formatTaskDetails(task: TaskData): string {
  const typeIcon = getTaskTypeIcon(task.type);
  const typeText = getTaskTypeText(task.type);
  const statusIcon = getTaskStatusIcon(task.status);
  const progress = task.totalExecutions > 0 
    ? ((task.completedExecutions || 0) / task.totalExecutions)
    : 0;
  const progressBar = createProgressBar(task.completedExecutions || 0, task.totalExecutions);
  const conversionRate = (task.clicks || 0) > 0 
    ? Math.round(((task.conversions || 0) / (task.clicks || 0)) * 100)
    : 0;

  return `${typeIcon} **Задание #${task.id}**

${EMOJIS.info} **Информация:**
├ Название: ${task.title}
├ Тип: ${typeText}
├ Статус: ${statusIcon} ${getTaskStatusText(task.status)}
└ Создано: ${formatTimeAgo(task.createdAt)}

${EMOJIS.money} **Условия:**
├ Награда: ${formatGram(task.reward)}
├ Выполнений: ${task.completedExecutions || 0}/${task.totalExecutions}
├ Осталось: ${task.remainingExecutions || 0}
└ Истекает: ${formatTimeRemaining(task.expiresAt)}

${EMOJIS.chart} **Прогресс:**
${progressBar} ${Math.round(progress * 100)}%

${EMOJIS.stats} **Статистика:**
├ Просмотры: ${task.views || 0}
├ Переходы: ${task.clicks || 0}
├ Выполнения: ${task.conversions || 0}
└ Конверсия: ${conversionRate}%`;
}

// Форматирование транзакции
export function formatTransaction(transaction: TransactionData): string {
  const typeIcon = getTransactionTypeIcon(transaction.type);
  const typeText = getTransactionTypeText(transaction.type);
  const isIncome = isIncomeTransaction(transaction.type);
  const amountText = isIncome 
    ? `+${formatGram(transaction.amount)}`
    : `-${formatGram(transaction.amount)}`;
  const statusIcon = transaction.status === 'completed' ? EMOJIS.check : EMOJIS.pending;

  return `${typeIcon} ${typeText}
${amountText} ${statusIcon}
${transaction.description || ''}
${formatTimeAgo(transaction.createdAt)}`;
}

// Форматирование списка транзакций
export function formatTransactionsList(transactions: TransactionData[]): string {
  if (transactions.length === 0) {
    return `${EMOJIS.info} История транзакций пуста`;
  }

  const header = `${EMOJIS.money} **История транзакций** (${transactions.length})\n`;
  const items = transactions.map((tx, index) => 
    `${index + 1}. ${formatTransaction(tx)}`
  ).join('\n\n');

  return header + items;
}

// Форматирование статистики пользователя
export function formatUserStats(user: UserData, period: 'today' | 'week' | 'month' = 'today'): string {
  const periodText = {
    'today': 'За сегодня',
    'week': 'За неделю', 
    'month': 'За месяц'
  }[period];

  return `${EMOJIS.chart} **Статистика ${periodText.toLowerCase()}**

${EMOJIS.money} **Финансы:**
├ Заработано: ${formatGram(user.totalEarned || 0)}
├ Текущий баланс: ${formatGram(user.balance || 0)}
└ Уровень: ${getLevelText(user.level)} ${getLevelEmoji(user.level)}

${EMOJIS.stats} **Активность:**
├ Выполнено заданий: ${user.tasksCompleted || 0}
├ Создано заданий: ${user.tasksCreated || 0}
└ Привлечено рефералов: ${user.referralsCount || 0}`;
}

// Форматирование топа пользователей
export function formatUserTop(users: UserData[], title: string = 'Топ пользователей'): string {
  if (users.length === 0) {
    return `${EMOJIS.info} ${title}: список пуст`;
  }

  const header = `${EMOJIS.chart} **${title}**\n`;
  
  const items = users.map((user, index) => {
    const position = index + 1;
    const medal = position === 1 ? '🥇' : position === 2 ? '🥈' : position === 3 ? '🥉' : `${position}.`;
    const displayName = user.firstName || user.username || `ID${user.id}`;
    const levelEmoji = getLevelEmoji(user.level);
    
    return `${medal} ${levelEmoji} ${displayName} - ${formatGram(user.totalEarned || 0)}`;
  }).join('\n');

  return header + items;
}

// Форматирование уведомления
export function formatNotification(type: string, title: string, message: string, data?: any): string {
  const icon = getNotificationIcon(type);
  let formattedMessage = `${icon} **${title}**\n\n${message}`;
  
  if (data?.reward) {
    formattedMessage += `\n\n${EMOJIS.money} Получено: ${formatGram(data.reward)}`;
  }
  
  return formattedMessage;
}

// Форматирование чека
export function formatCheck(check: {
  code: string;
  totalAmount: number;
  maxActivations: number;
  currentActivations?: number;
  comment?: string;
  createdAt: Date;
  expiresAt?: Date;
}): string {
  const remaining = check.maxActivations - (check.currentActivations || 0);
  const amountPerActivation = Math.floor(check.totalAmount / check.maxActivations);
  const progressBar = createProgressBar(check.currentActivations || 0, check.maxActivations);
  const progress = Math.round(((check.currentActivations || 0) / check.maxActivations) * 100);

  let result = `${EMOJIS.checks} **Чек ${check.code}**

${EMOJIS.money} **Параметры:**
├ Сумма за активацию: ${formatGram(amountPerActivation)}
├ Активаций: ${check.currentActivations || 0}/${check.maxActivations}
├ Осталось активаций: ${remaining}
└ Создан: ${formatTimeAgo(check.createdAt)}

${EMOJIS.chart} **Прогресс:**
${progressBar} ${progress}%`;

  if (check.comment) {
    result += `\n\n${EMOJIS.info} **Комментарий:**\n${check.comment}`;
  }

  if (check.expiresAt) {
    result += `\n\n${EMOJIS.timer} Истекает: ${formatTimeRemaining(check.expiresAt)}`;
  }

  return result;
}

// Форматирование реферальной статистики
export function formatReferralStats(user: UserData, referrals: UserData[] = []): string {
  const totalEarned = referrals.reduce((sum, ref) => sum + (ref.totalEarned || 0), 0) * 0.1; // 10% от заработка рефералов
  
  return `${EMOJIS.referrals} **Реферальная программа**

${EMOJIS.info} **Ваша ссылка:**
\`t.me/prgram_bot?start=${user.id}\`

${EMOJIS.stats} **Статистика:**
├ Всего рефералов: ${user.referralsCount || 0}
├ Premium рефералов: ${referrals.filter(r => r.level === 'premium').length}
├ Заработано с рефералов: ${formatGram(Math.floor(totalEarned))}
└ Средний заработок реферала: ${formatGram(Math.floor((user.totalEarned || 0) / Math.max(1, user.referralsCount || 1)))}

${EMOJIS.money} **Ставки:**
├ За обычного реферала: ${formatGram(1000)}
├ За Premium реферала: ${formatGram(3000)}
├ От пополнений: 10%
└ От заданий: 5%`;
}

// Вспомогательные функции для получения иконок и текстов

function getTaskTypeIcon(type: string): string {
  switch (type) {
    case TASK_TYPES.SUBSCRIBE_CHANNEL: return EMOJIS.channel;
    case TASK_TYPES.JOIN_GROUP: return EMOJIS.group;
    case TASK_TYPES.VIEW_POST: return EMOJIS.view;
    case TASK_TYPES.BOT_INTERACTION: return EMOJIS.bot;
    case TASK_TYPES.REACT_POST: return EMOJIS.reaction;
    default: return EMOJIS.info;
  }
}

function getTaskTypeText(type: string): string {
  switch (type) {
    case TASK_TYPES.SUBSCRIBE_CHANNEL: return 'Подписка на канал';
    case TASK_TYPES.JOIN_GROUP: return 'Вступление в группу';
    case TASK_TYPES.VIEW_POST: return 'Просмотр поста';
    case TASK_TYPES.BOT_INTERACTION: return 'Взаимодействие с ботом';
    case TASK_TYPES.REACT_POST: return 'Реакция на пост';
    default: return 'Неизвестный тип';
  }
}

function getTaskStatusIcon(status: string): string {
  switch (status) {
    case 'active': return EMOJIS.active;
    case 'paused': return EMOJIS.pending;
    case 'completed': return EMOJIS.completed;
    case 'cancelled': return EMOJIS.failed;
    case 'expired': return EMOJIS.timer;
    default: return EMOJIS.info;
  }
}

function getTaskStatusText(status: string): string {
  switch (status) {
    case 'active': return 'Активное';
    case 'paused': return 'Приостановлено';
    case 'completed': return 'Завершено';
    case 'cancelled': return 'Отменено';
    case 'expired': return 'Истекло';
    default: return 'Неизвестно';
  }
}

function getTransactionTypeIcon(type: string): string {
  switch (type) {
    case TRANSACTION_TYPES.DEPOSIT: return '💳';
    case TRANSACTION_TYPES.WITHDRAW: return '💸';
    case TRANSACTION_TYPES.TASK_REWARD: return '🎯';
    case TRANSACTION_TYPES.TASK_PAYMENT: return '📢';
    case TRANSACTION_TYPES.REFERRAL_BONUS: return '🤝';
    case TRANSACTION_TYPES.COMMISSION: return '🏦';
    case TRANSACTION_TYPES.REFUND: return '↩️';
    case TRANSACTION_TYPES.CHECK_SENT: return '📤';
    case TRANSACTION_TYPES.CHECK_RECEIVED: return '📥';
    default: return EMOJIS.money;
  }
}

function getTransactionTypeText(type: string): string {
  switch (type) {
    case TRANSACTION_TYPES.DEPOSIT: return 'Пополнение';
    case TRANSACTION_TYPES.WITHDRAW: return 'Вывод';
    case TRANSACTION_TYPES.TASK_REWARD: return 'Награда за задание';
    case TRANSACTION_TYPES.TASK_PAYMENT: return 'Оплата задания';
    case TRANSACTION_TYPES.REFERRAL_BONUS: return 'Реферальный бонус';
    case TRANSACTION_TYPES.COMMISSION: return 'Комиссия';
    case TRANSACTION_TYPES.REFUND: return 'Возврат';
    case TRANSACTION_TYPES.CHECK_SENT: return 'Отправка чека';
    case TRANSACTION_TYPES.CHECK_RECEIVED: return 'Получение чека';
    default: return 'Операция';
  }
}

function isIncomeTransaction(type: string): boolean {
  return [
    TRANSACTION_TYPES.DEPOSIT,
    TRANSACTION_TYPES.TASK_REWARD,
    TRANSACTION_TYPES.REFERRAL_BONUS,
    TRANSACTION_TYPES.REFUND,
    TRANSACTION_TYPES.CHECK_RECEIVED
  ].includes(type as any);
}

function getNotificationIcon(type: string): string {
  switch (type) {
    case 'task_completed': return EMOJIS.completed;
    case 'task_created': return EMOJIS.advertise;
    case 'referral_joined': return EMOJIS.referrals;
    case 'balance_low': return EMOJIS.warning;
    case 'level_up': return EMOJIS.star;
    case 'check_received': return EMOJIS.checks;
    case 'system': return EMOJIS.bell;
    default: return EMOJIS.info;
  }
}

export default {
  formatUserProfile,
  formatUserShort,
  formatTaskListItem,
  formatTaskDetails,
  formatTransaction,
  formatTransactionsList,
  formatUserStats,
  formatUserTop,
  formatNotification,
  formatCheck,
  formatReferralStats
};