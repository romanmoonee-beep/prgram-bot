// src/services/user/index.ts
import { UserService } from './UserService';
import { UserServiceExtended } from './UserServiceExtended';
import { UserServiceAnalytics } from './UserServiceAnalytics';

// Экспорт всех типов
export * from './types';

// Экспорт классов
export { 
  UserService, 
  UserServiceExtended, 
  UserServiceAnalytics 
};

// Singleton экземпляр расширенного сервиса
let userServiceInstance: UserServiceExtended | null = null;

/**
 * Создание единственного экземпляра UserService
 */
export const createUserService = (): UserServiceExtended => {
  if (!userServiceInstance) {
    userServiceInstance = new UserServiceExtended();
  }
  return userServiceInstance;
};

/**
 * Получение экземпляра UserService
 */
export const getUserService = (): UserServiceExtended => {
  if (!userServiceInstance) {
    throw new Error('UserService not initialized. Call createUserService first.');
  }
  return userServiceInstance;
};

/**
 * Сброс экземпляра (для тестирования)
 */
export const resetUserService = (): void => {
  userServiceInstance = null;
};

// Экспорт по умолчанию для удобства
export default {
  createUserService,
  getUserService,
  resetUserService
};