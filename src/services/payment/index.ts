// src/services/payment/index.ts
import { PaymentService } from './PaymentService';
import { PaymentServiceExtended } from './PaymentServiceExtended';
import { UserService } from '../user';
import { NotificationService } from '../notification';
import { PaymentProviderConfig } from './types';

// Экспорт всех типов
export * from './types';

// Экспорт классов
export { 
  PaymentService, 
  PaymentServiceExtended 
};

// Экспорт утилит и констант
export { default as PaymentUtils } from './PaymentUtils';
export { default as PaymentConstants } from './PaymentConstants';
export * from './PaymentConstants';

// Singleton экземпляр расширенного сервиса
let paymentServiceInstance: PaymentServiceExtended | null = null;

/**
 * Создание единственного экземпляра PaymentService
 */
export const createPaymentService = (
  userService: UserService,
  notificationService: NotificationService,
  config?: PaymentProviderConfig
): PaymentServiceExtended => {
  if (!paymentServiceInstance) {
    paymentServiceInstance = new PaymentServiceExtended(
      userService,
      notificationService,
      config
    );
  }
  return paymentServiceInstance;
};

/**
 * Получение экземпляра PaymentService
 */
export const getPaymentService = (): PaymentServiceExtended => {
  if (!paymentServiceInstance) {
    throw new Error('PaymentService not initialized. Call createPaymentService first.');
  }
  return paymentServiceInstance;
};

/**
 * Сброс экземпляра (для тестирования)
 */
export const resetPaymentService = (): void => {
  paymentServiceInstance = null;
};

// Экспорт по умолчанию для удобства
export default {
  createPaymentService,
  getPaymentService,
  resetPaymentService
};