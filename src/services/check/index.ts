// src/services/check/index.ts
import { CheckService } from './CheckService';
import { CheckServiceExtended } from './CheckServiceExtended';
import { CheckServiceAnalytics } from './CheckServiceAnalytics';
import { UserService } from '../user';
import { TransactionService } from '../transaction/TransactionService';
import { NotificationService } from '../notification/NotificationService';
import { TelegramService } from '../telegram';

// Экспорт всех типов
export * from './types';

// Экспорт классов
export { 
  CheckService, 
  CheckServiceExtended, 
  CheckServiceAnalytics 
};

// Singleton экземпляр расширенного сервиса
let checkServiceInstance: CheckServiceExtended | null = null;

/**
 * Создание единственного экземпляра CheckService
 */
export const createCheckService = (
  userService: UserService,
  transactionService: TransactionService,
  notificationService: NotificationService,
  telegramService: TelegramService,
  config?: any
): CheckServiceExtended => {
  if (!checkServiceInstance) {
    checkServiceInstance = new CheckServiceExtended(
      userService,
      transactionService,
      notificationService,
      telegramService,
      config
    );
  }
  return checkServiceInstance;
};

/**
 * Получение экземпляра CheckService
 */
export const getCheckService = (): CheckServiceExtended => {
  if (!checkServiceInstance) {
    throw new Error('CheckService not initialized. Call createCheckService first.');
  }
  return checkServiceInstance;
};

/**
 * Сброс экземпляра (для тестирования)
 */
export const resetCheckService = (): void => {
  checkServiceInstance = null;
};

// Экспорт по умолчанию для удобства
export default {
  createCheckService,
  getCheckService,
  resetCheckService
};