// src/services/telegram/index.ts
import { Bot } from 'grammy';
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

export const resetTelegramService = (): void => {
  telegramServiceInstance = null;
};

export const initTelegramService = (
  bot: Bot,
  redis?: Redis
): TelegramServiceExtended => {
  const defaultConfig: TelegramServiceConfig = {
    botToken: bot.token,
    apiTimeout: 30000, // 30 секунд
    retryAttempts: 3,
    rateLimiting: {
      messagesPerSecond: 30,
      messagesPerMinute: 1000,
      burstLimit: 50
    },
    features: {
      enableWebhook: process.env.NODE_ENV === 'production',
      enablePolling: process.env.NODE_ENV !== 'production',
      enableFileDownload: true,
      maxFileSize: 20 * 1024 * 1024 // 20 MB
    },
    logging: {
      logRequests: process.env.NODE_ENV === 'development',
      logResponses: false,
      logErrors: true
    }
  };

  return createTelegramService(defaultConfig, redis);
};

// Экспорт по умолчанию для удобства
export default {
  createTelegramService,
  getTelegramService,
  resetTelegramService,
  initTelegramService
};
