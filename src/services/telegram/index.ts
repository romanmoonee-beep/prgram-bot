// src/services/telegram/index.ts
import { TelegramService } from './TelegramService';
import { TelegramServiceExtended } from './TelegramServiceExtended';
import { TelegramServiceConfig } from './types';
import Redis from 'ioredis';

// Экспорт всех типов
export * from './types';

// Экспорт классов
export { TelegramService, TelegramServiceExtended };

// Singleton экземпляр расширенного сервиса
let telegramServiceInstance: TelegramServiceExtended | null = null;

/**
 * Создание единственного экземпляра TelegramService
 */
export const createTelegramService = (
  config: TelegramServiceConfig,
  redis?: Redis
): TelegramServiceExtended => {
  if (!telegramServiceInstance) {
    telegramServiceInstance = new TelegramServiceExtended(config, redis);
  }
  return telegramServiceInstance;
};

/**
 * Получение экземпляра TelegramService
 */
export const getTelegramService = (): TelegramServiceExtended => {
  if (!telegramServiceInstance) {
    throw new Error('TelegramService not initialized. Call createTelegramService first.');
  }
  return telegramServiceInstance;
};

/**
 * Сброс экземпляра (для тестирования)
 */
export const resetTelegramService = (): void => {
  telegramServiceInstance = null;
};

// Экспорт по умолчанию для удобства
export default {
  createTelegramService,
  getTelegramService,
  resetTelegramService
};