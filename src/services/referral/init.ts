// src/services/referral/index.ts
import { ReferralService } from './ReferralService';
import { ReferralServiceExtended } from './ReferralServiceExtended';
import { ReferralServiceAnalytics } from './ReferralServiceAnalytics';
import { UserService } from '../user';
import { TransactionService } from '../transaction/TransactionService';
import { NotificationService } from '../notification/NotificationService';

// Экспорт всех типов
export * from './types';

// Экспорт классов
export { 
  ReferralService, 
  ReferralServiceExtended, 
  ReferralServiceAnalytics 
};

// Singleton экземпляр расширенного сервиса
let referralServiceInstance: ReferralServiceExtended | null = null;

/**
 * Создание единственного экземпляра ReferralService
 */
export const createReferralService = (
  userService: UserService,
  transactionService: TransactionService,
  notificationService: NotificationService,
  config?: any
): ReferralServiceExtended => {
  if (!referralServiceInstance) {
    referralServiceInstance = new ReferralServiceExtended(
      userService,
      transactionService,
      notificationService,
      config
    );
  }
  return referralServiceInstance;
};

/**
 * Получение экземпляра ReferralService
 */
export const getReferralService = (): ReferralServiceExtended => {
  if (!referralServiceInstance) {
    throw new Error('ReferralService not initialized. Call createReferralService first.');
  }
  return referralServiceInstance;
};

/**
 * Сброс экземпляра (для тестирования)
 */
export const resetReferralService = (): void => {
  referralServiceInstance = null;
};

// Экспорт по умолчанию для удобства
export default {
  createReferralService,
  getReferralService,
  resetReferralService
};