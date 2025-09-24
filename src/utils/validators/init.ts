// src/utils/validators.ts
import { REGEX, LIMITS, TASK_TYPES, USER_LEVELS } from '../constants';

// Тип результата валидации
export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

// Валидация Telegram ID
export function validateTelegramId(id: string | number): ValidationResult {
  const numId = typeof id === 'string' ? parseInt(id, 10) : id;
  
  if (isNaN(numId)) {
    return { isValid: false, error: 'ID должен быть числом' };
  }
  
  if (numId <= 0) {
    return { isValid: false, error: 'ID должен быть положительным числом' };
  }
  
  if (numId.toString().length < 8 || numId.toString().length > 12) {
    return { isValid: false, error: 'Некорректный Telegram ID' };
  }
  
  return { isValid: true };
}

// Валидация username
export function validateUsername(username: string): ValidationResult {
  if (!username) {
    return { isValid: false, error: 'Username не может быть пустым' };
  }
  
  const cleanUsername = username.replace('@', '');
  
  if (!REGEX.TELEGRAM_USERNAME.test(`@${cleanUsername}`)) {
    return { isValid: false, error: 'Некорректный формат username' };
  }
  
  return { isValid: true };
}

// Валидация Telegram ссылки
export function validateTelegramLink(url: string): ValidationResult {
  if (!url) {
    return { isValid: false, error: 'Ссылка не может быть пустой' };
  }
  
  if (!url.startsWith('https://t.me/')) {
    return { isValid: false, error: 'Ссылка должна начинаться с https://t.me/' };
  }
  
  if (!REGEX.TELEGRAM_LINK.test(url)) {
    return { isValid: false, error: 'Некорректный формат ссылки Telegram' };
  }
  
  return { isValid: true };
}

// Валидация ссылки на пост
export function validatePostLink(url: string): ValidationResult {
  if (!url) {
    return { isValid: false, error: 'Ссылка на пост не может быть пустой' };
  }
  
  if (!REGEX.TELEGRAM_POST_LINK.test(url)) {
    return { isValid: false, error: 'Некорректная ссылка на пост Telegram' };
  }
  
  return { isValid: true };
}

// Валидация суммы GRAM
export function validateGramAmount(amount: string | number, min?: number, max?: number): ValidationResult {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  
  if (isNaN(num)) {
    return { isValid: false, error: 'Введите корректное число' };
  }
  
  if (!Number.isInteger(num)) {
    return { isValid: false, error: 'Сумма должна быть целым числом' };
  }
  
  const minAmount = min ?? LIMITS.MIN_TASK_REWARD;
  const maxAmount = max ?? LIMITS.MAX_TASK_REWARD;
  
  if (num < minAmount) {
    return { isValid: false, error: `Минимальная сумма: ${minAmount} GRAM` };
  }
  
  if (num > maxAmount) {
    return { isValid: false, error: `Максимальная сумма: ${maxAmount.toLocaleString()} GRAM` };
  }
  
  return { isValid: true };
}

// Валидация названия задания
export function validateTaskTitle(title: string): ValidationResult {
  if (!title || title.trim().length === 0) {
    return { isValid: false, error: 'Название задания не может быть пустым' };
  }
  
  if (title.length > LIMITS.MAX_TASK_TITLE) {
    return { isValid: false, error: `Максимальная длина названия: ${LIMITS.MAX_TASK_TITLE} символов` };
  }
  
  if (title.length < 3) {
    return { isValid: false, error: 'Минимальная длина названия: 3 символа' };
  }
  
  return { isValid: true };
}

// Валидация описания задания
export function validateTaskDescription(description?: string): ValidationResult {
  if (!description) {
    return { isValid: true }; // Описание необязательно
  }
  
  if (description.length > LIMITS.MAX_TASK_DESCRIPTION) {
    return { isValid: false, error: `Максимальная длина описания: ${LIMITS.MAX_TASK_DESCRIPTION} символов` };
  }
  
  return { isValid: true };
}

// Валидация типа задания
export function validateTaskType(type: string): ValidationResult {
  if (!Object.values(TASK_TYPES).includes(type as any)) {
    return { isValid: false, error: 'Некорректный тип задания' };
  }
  
  return { isValid: true };
}

// Валидация количества выполнений
export function validateExecutionsCount(count: string | number): ValidationResult {
  const num = typeof count === 'string' ? parseInt(count, 10) : count;
  
  if (isNaN(num)) {
    return { isValid: false, error: 'Введите корректное число' };
  }
  
  if (num < LIMITS.MIN_TASK_EXECUTIONS) {
    return { isValid: false, error: `Минимальное количество: ${LIMITS.MIN_TASK_EXECUTIONS}` };
  }
  
  if (num > LIMITS.MAX_TASK_EXECUTIONS) {
    return { isValid: false, error: `Максимальное количество: ${LIMITS.MAX_TASK_EXECUTIONS.toLocaleString()}` };
  }
  
  return { isValid: true };
}

// Валидация суммы чека
export function validateCheckAmount(amount: string | number): ValidationResult {
  const num = typeof amount === 'string' ? parseInt(amount, 10) : amount;
  
  if (isNaN(num)) {
    return { isValid: false, error: 'Введите корректное число' };
  }
  
  if (num < LIMITS.MIN_CHECK_AMOUNT) {
    return { isValid: false, error: `Минимальная сумма чека: ${LIMITS.MIN_CHECK_AMOUNT} GRAM` };
  }
  
  if (num > LIMITS.MAX_CHECK_AMOUNT) {
    return { isValid: false, error: `Максимальная сумма чека: ${LIMITS.MAX_CHECK_AMOUNT.toLocaleString()} GRAM` };
  }
  
  return { isValid: true };
}

// Валидация количества активаций чека
export function validateCheckActivations(count: string | number): ValidationResult {
  const num = typeof count === 'string' ? parseInt(count, 10) : count;
  
  if (isNaN(num)) {
    return { isValid: false, error: 'Введите корректное число' };
  }
  
  if (num < 1) {
    return { isValid: false, error: 'Минимальное количество активаций: 1' };
  }
  
  if (num > LIMITS.MAX_CHECK_ACTIVATIONS) {
    return { isValid: false, error: `Максимальное количество активаций: ${LIMITS.MAX_CHECK_ACTIVATIONS.toLocaleString()}` };
  }
  
  return { isValid: true };
}

// Валидация пароля для чека
export function validateCheckPassword(password?: string): ValidationResult {
  if (!password) {
    return { isValid: true }; // Пароль необязательный
  }
  
  if (password.length > LIMITS.CHECK_PASSWORD_LENGTH) {
    return { isValid: false, error: `Максимальная длина пароля: ${LIMITS.CHECK_PASSWORD_LENGTH} символов` };
  }
  
  if (password.length < 4) {
    return { isValid: false, error: 'Минимальная длина пароля: 4 символа' };
  }
  
  return { isValid: true };
}

// Валидация комментария к чеку
export function validateCheckComment(comment?: string): ValidationResult {
  if (!comment) {
    return { isValid: true }; // Комментарий необязательный
  }
  
  if (comment.length > LIMITS.CHECK_COMMENT_LENGTH) {
    return { isValid: false, error: `Максимальная длина комментария: ${LIMITS.CHECK_COMMENT_LENGTH} символов` };
  }
  
  return { isValid: true };
}

// Валидация уровня пользователя
export function validateUserLevel(level: string): ValidationResult {
  if (!Object.values(USER_LEVELS).includes(level as any)) {
    return { isValid: false, error: 'Некорректный уровень пользователя' };
  }
  
  return { isValid: true };
}

// Валидация имени пользователя
export function validateUserName(name?: string): ValidationResult {
  if (!name) {
    return { isValid: true }; // Имя необязательно
  }
  
  if (name.length > LIMITS.MAX_FIRST_NAME_LENGTH) {
    return { isValid: false, error: `Максимальная длина имени: ${LIMITS.MAX_FIRST_NAME_LENGTH} символов` };
  }
  
  if (name.trim().length === 0) {
    return { isValid: false, error: 'Имя не может состоять только из пробелов' };
  }
  
  return { isValid: true };
}

// Валидация размера файла
export function validateFileSize(fileSize: number, maxSize?: number): ValidationResult {
  const maxFileSize = maxSize ?? LIMITS.MAX_FILE_SIZE;
  
  if (fileSize > maxFileSize) {
    const maxSizeMB = Math.floor(maxFileSize / (1024 * 1024));
    return { isValid: false, error: `Максимальный размер файла: ${maxSizeMB} МБ` };
  }
  
  return { isValid: true };
}

// Валидация URL изображения
export function validateImageUrl(url?: string): ValidationResult {
  if (!url) {
    return { isValid: true }; // URL необязательный
  }
  
  try {
    new URL(url);
  } catch {
    return { isValid: false, error: 'Некорректный URL' };
  }
  
  const validExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
  const hasValidExtension = validExtensions.some(ext => 
    url.toLowerCase().includes(ext)
  );
  
  if (!hasValidExtension) {
    return { isValid: false, error: 'URL должен указывать на изображение (jpg, png, gif, webp)' };
  }
  
  return { isValid: true };
}

// Валидация номера страницы для пагинации
export function validatePageNumber(page: string | number, maxPage?: number): ValidationResult {
  const num = typeof page === 'string' ? parseInt(page, 10) : page;
  
  if (isNaN(num)) {
    return { isValid: false, error: 'Номер страницы должен быть числом' };
  }
  
  if (num < 1) {
    return { isValid: false, error: 'Номер страницы должен быть больше 0' };
  }
  
  if (maxPage && num > maxPage) {
    return { isValid: false, error: `Максимальный номер страницы: ${maxPage}` };
  }
  
  return { isValid: true };
}

// Валидация email адреса
export function validateEmail(email: string): ValidationResult {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  if (!emailRegex.test(email)) {
    return { isValid: false, error: 'Некорректный формат email' };
  }
  
  return { isValid: true };
}

// Комплексная валидация задания
export function validateCompleteTask(taskData: {
  type: string;
  title: string;
  description?: string;
  targetUrl: string;
  reward: number;
  totalExecutions: number;
}): ValidationResult {
  // Валидация типа
  const typeValidation = validateTaskType(taskData.type);
  if (!typeValidation.isValid) return typeValidation;
  
  // Валидация названия
  const titleValidation = validateTaskTitle(taskData.title);
  if (!titleValidation.isValid) return titleValidation;
  
  // Валидация описания
  const descValidation = validateTaskDescription(taskData.description);
  if (!descValidation.isValid) return descValidation;
  
  // Валидация URL в зависимости от типа
  let urlValidation: ValidationResult;
  if (taskData.type === TASK_TYPES.VIEW_POST || taskData.type === TASK_TYPES.REACT_POST) {
    urlValidation = validatePostLink(taskData.targetUrl);
  } else {
    urlValidation = validateTelegramLink(taskData.targetUrl);
  }
  if (!urlValidation.isValid) return urlValidation;
  
  // Валидация награды
  const rewardValidation = validateGramAmount(taskData.reward);
  if (!rewardValidation.isValid) return rewardValidation;
  
  // Валидация количества выполнений
  const executionsValidation = validateExecutionsCount(taskData.totalExecutions);
  if (!executionsValidation.isValid) return executionsValidation;
  
  return { isValid: true };
}

// Комплексная валидация чека
export function validateCompleteCheck(checkData: {
  totalAmount: number;
  maxActivations: number;
  password?: string;
  comment?: string;
  requiredSubscription?: string;
}): ValidationResult {
  // Валидация общей суммы
  const amountValidation = validateCheckAmount(checkData.totalAmount);
  if (!amountValidation.isValid) return amountValidation;
  
  // Валидация количества активаций
  const activationsValidation = validateCheckActivations(checkData.maxActivations);
  if (!activationsValidation.isValid) return activationsValidation;
  
  // Проверка, что сумма на активацию больше 0
  const amountPerActivation = Math.floor(checkData.totalAmount / checkData.maxActivations);
  if (amountPerActivation < LIMITS.MIN_CHECK_AMOUNT) {
    return { isValid: false, error: `Сумма на одну активацию слишком мала (минимум ${LIMITS.MIN_CHECK_AMOUNT} GRAM)` };
  }
  
  // Валидация пароля
  const passwordValidation = validateCheckPassword(checkData.password);
  if (!passwordValidation.isValid) return passwordValidation;
  
  // Валидация комментария
  const commentValidation = validateCheckComment(checkData.comment);
  if (!commentValidation.isValid) return commentValidation;
  
  // Валидация обязательной подписки
  if (checkData.requiredSubscription) {
    const subscriptionValidation = validateTelegramLink(checkData.requiredSubscription);
    if (!subscriptionValidation.isValid) return subscriptionValidation;
  }
  
  return { isValid: true };
}

export default {
  validateTelegramId,
  validateUsername,
  validateTelegramLink,
  validatePostLink,
  validateGramAmount,
  validateTaskTitle,
  validateTaskDescription,
  validateTaskType,
  validateExecutionsCount,
  validateCheckAmount,
  validateCheckActivations,
  validateCheckPassword,
  validateCheckComment,
  validateUserLevel,
  validateUserName,
  validateFileSize,
  validateImageUrl,
  validatePageNumber,
  validateEmail,
  validateCompleteTask,
  validateCompleteCheck
};