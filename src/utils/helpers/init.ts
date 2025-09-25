// src/utils/helpers.ts
import { REGEX, USER_LEVELS, EMOJIS } from '../constants/index';

// Функция для форматирования числа с разделителями
export function formatNumber(num: number): string {
  return num.toLocaleString('ru-RU');
}

// Функция для форматирования GRAM
export function formatGram(amount: number): string {
  return `${formatNumber(amount)} GRAM`;
}

// Функция для получения текстового названия уровня
export function getLevelText(level: string): string {
  switch (level) {
    case USER_LEVELS.BRONZE: return 'Бронза';
    case USER_LEVELS.SILVER: return 'Серебро';
    case USER_LEVELS.GOLD: return 'Золото';
    case USER_LEVELS.PREMIUM: return 'Премиум';
    default: return 'Неизвестный';
  }
}

// Функция для получения эмодзи уровня
export function getLevelEmoji(level: string): string {
  switch (level) {
    case USER_LEVELS.BRONZE: return EMOJIS.bronze;
    case USER_LEVELS.SILVER: return EMOJIS.silver;
    case USER_LEVELS.GOLD: return EMOJIS.gold;
    case USER_LEVELS.PREMIUM: return EMOJIS.premium;
    default: return EMOJIS.bronze;
  }
}

// Функция для валидации Telegram ссылок
export function validateTelegramLink(url: string): { isValid: boolean; type?: string; username?: string } {
  // Проверка на канал/группу
  const channelMatch = url.match(/^https:\/\/t\.me\/([a-zA-Z0-9_]{5,32})$/);
  if (channelMatch) {
    return { isValid: true, type: 'channel', username: channelMatch[1] };
  }

  // Проверка на пост
  const postMatch = url.match(/^https:\/\/t\.me\/([a-zA-Z0-9_]{5,32})\/(\d+)$/);
  if (postMatch) {
    return { isValid: true, type: 'post', username: postMatch[1] };
  }

  // Проверка на бота
  const botMatch = url.match(/^https:\/\/t\.me\/([a-zA-Z0-9_]{5,32}bot)$/);
  if (botMatch) {
    return { isValid: true, type: 'bot', username: botMatch[1] };
  }

  return { isValid: false };
}

// Функция для извлечения username из ссылки
export function extractUsernameFromLink(url: string): string | null {
  const match = url.match(/t\.me\/([a-zA-Z0-9_]{5,32})/);
  return match ? match[1] : null;
}

// Функция для создания ссылки на канал/чат
export function createTelegramLink(username: string): string {
  const cleanUsername = username.replace('@', '');
  return `https://t.me/${cleanUsername}`;
}

// Функция для генерации случайного кода
export function generateRandomCode(length: number = 8): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Функция для создания реферальной ссылки
export function createReferralLink(telegramId: number, botUsername: string): string {
  return `https://t.me/${botUsername}?start=${telegramId}`;
}

// Функция для сокращения текста
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

// Функция для escape HTML символов
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Функция для escape Markdown символов
export function escapeMarkdown(text: string): string {
  return text
    .replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&');
}

// Функция для валидации суммы GRAM
export function validateGramAmount(amount: string | number): { isValid: boolean; amount?: number; error?: string } {
  const num = typeof amount === 'string' ? parseInt(amount, 10) : amount;
  
  if (isNaN(num)) {
    return { isValid: false, error: 'Введите корректное число' };
  }
  
  if (num <= 0) {
    return { isValid: false, error: 'Сумма должна быть больше 0' };
  }
  
  if (num > 1000000) {
    return { isValid: false, error: 'Максимальная сумма: 1,000,000 GRAM' };
  }
  
  return { isValid: true, amount: num };
}

// Функция для расчета комиссии
export function calculateCommission(amount: number, rate: number): number {
  return Math.ceil(amount * rate);
}

// Функция для расчета множителя заработка
export function calculateRewardWithMultiplier(baseReward: number, multiplier: number): number {
  return Math.floor(baseReward * multiplier);
}

// Функция для форматирования времени
export function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'только что';
  if (diffMins < 60) return `${diffMins} мин. назад`;
  if (diffHours < 24) return `${diffHours} ч. назад`;
  if (diffDays < 30) return `${diffDays} д. назад`;
  
  return date.toLocaleDateString('ru-RU');
}

// Функция для форматирования оставшегося времени
export function formatTimeRemaining(expiresAt: Date): string {
  const now = new Date();
  const diffMs = expiresAt.getTime() - now.getTime();
  
  if (diffMs <= 0) return 'истекло';
  
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  if (diffDays > 0) return `${diffDays} д. ${diffHours} ч.`;
  if (diffHours > 0) return `${diffHours} ч. ${diffMins} мин.`;
  return `${diffMins} мин.`;
}

// Функция для создания прогресс-бара
export function createProgressBar(current: number, total: number, length: number = 10): string {
  const percentage = Math.min(current / total, 1);
  const filledLength = Math.floor(percentage * length);
  const emptyLength = length - filledLength;
  
  return '█'.repeat(filledLength) + '░'.repeat(emptyLength);
}

// Функция для генерации pagination кнопок
export function generatePaginationData(currentPage: number, totalPages: number): {
  hasPrev: boolean;
  hasNext: boolean;
  prevPage: number;
  nextPage: number;
  pages: number[];
} {
  const maxVisiblePages = 5;
  const hasPrev = currentPage > 1;
  const hasNext = currentPage < totalPages;
  
  let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
  let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
  
  if (endPage - startPage + 1 < maxVisiblePages) {
    startPage = Math.max(1, endPage - maxVisiblePages + 1);
  }
  
  const pages = [];
  for (let i = startPage; i <= endPage; i++) {
    pages.push(i);
  }
  
  return {
    hasPrev,
    hasNext,
    prevPage: currentPage - 1,
    nextPage: currentPage + 1,
    pages
  };
}

// Функция для валидации password
export function validatePassword(password: string): { isValid: boolean; error?: string } {
  if (password.length < 4) {
    return { isValid: false, error: 'Пароль должен содержать минимум 4 символа' };
  }
  
  if (password.length > 50) {
    return { isValid: false, error: 'Пароль не может быть длиннее 50 символов' };
  }
  
  return { isValid: true };
}

// Функция для определения типа файла по расширению
export function getFileType(filename: string): string {
  const extension = filename.split('.').pop()?.toLowerCase();
  
  switch (extension) {
    case 'jpg':
    case 'jpeg':
    case 'png':
    case 'gif':
    case 'webp':
      return 'image';
    case 'mp4':
    case 'avi':
    case 'mov':
    case 'mkv':
      return 'video';
    case 'pdf':
      return 'document';
    default:
      return 'unknown';
  }
}

// Функция для безопасного парсинга JSON
export function safeJsonParse<T>(json: string, defaultValue: T): T {
  try {
    return JSON.parse(json);
  } catch {
    return defaultValue;
  }
}

// Функция для глубокого клонирования объекта
export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return new Date(obj.getTime()) as unknown as T;
  if (obj instanceof Array) return obj.map(item => deepClone(item)) as unknown as T;
  if (typeof obj === 'object') {
    const cloned = {} as T;
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        cloned[key] = deepClone(obj[key]);
      }
    }
    return cloned;
  }
  return obj;
}

// Функция для задержки (sleep)
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Функция для retry логики
export async function retry<T>(
  fn: () => Promise<T>,
  attempts: number = 3,
  delay: number = 1000
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (attempts > 1) {
      await sleep(delay);
      return retry(fn, attempts - 1, delay * 2);
    }
    throw error;
  }
}

// Функция для группировки массива по ключу
export function groupBy<T>(array: T[], keyFn: (item: T) => string | number): Record<string | number, T[]> {
  return array.reduce((groups, item) => {
    const key = keyFn(item);
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(item);
    return groups;
  }, {} as Record<string | number, T[]>);
}

// Функция для перемешивания массива
export function shuffle<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Функция для получения случайного элемента из массива
export function getRandomElement<T>(array: T[]): T | undefined {
  if (array.length === 0) return undefined;
  return array[Math.floor(Math.random() * array.length)];
}

// Функция для генерации кода чека
export function generateCheckCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 16; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Функция для хеширования пароля (простая для примера)
export function hashPassword(password: string): string {
  // В реальном проекте используйте bcrypt или другую криптографическую библиотеку
  let hash = 0;
  for (let i = 0; i < password.length; i++) {
    const char = password.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Конвертируем в 32-битное целое
  }
  return Math.abs(hash).toString(36);
}

// Функция для проверки пароля
export function validatePasswordHash(password: string, hash: string): boolean {
  return hashPassword(password) === hash;
}

export default {
  formatNumber,
  formatGram,
  getLevelText,
  getLevelEmoji,
  validateTelegramLink,
  extractUsernameFromLink,
  createTelegramLink,
  generateRandomCode,
  createReferralLink,
  truncateText,
  escapeHtml,
  escapeMarkdown,
  validateGramAmount,
  calculateCommission,
  calculateRewardWithMultiplier,
  formatTimeAgo,
  formatTimeRemaining,
  createProgressBar,
  generatePaginationData,
  validatePassword,
  getFileType,
  safeJsonParse,
  deepClone,
  sleep,
  retry,
  groupBy,
  shuffle,
  getRandomElement
};