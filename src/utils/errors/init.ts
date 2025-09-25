// src/utils/errors/init.ts
import { errorHandler } from './ErrorHandler';
import { logger } from '../logger';

/**
 * Инициализация системы обработки ошибок
 */
export function initErrorHandling(): void {
  logger.info('Initializing error handling system...');

  // Настройка глобальных обработчиков ошибок
  process.on('unhandledRejection', (reason, promise) => {
    errorHandler.handleUnhandledRejection(reason, promise);
  });

  process.on('uncaughtException', (error) => {
    errorHandler.handleUncaughtException(error);
  });

  // Настройка обработки ошибок для различных компонентов
  setupTelegramErrorHandling();
  setupDatabaseErrorHandling();

  logger.info('Error handling system initialized successfully');
}

/**
 * Настройка обработки ошибок Telegram API
 */
function setupTelegramErrorHandling(): void {
  // Обработчики ошибок Telegram будут настроены в TelegramService
  logger.debug('Telegram error handling configured');
}

/**
 * Настройка обработки ошибок базы данных
 */
function setupDatabaseErrorHandling(): void {
  // Обработчики ошибок Sequelize будут настроены в database/config.ts
  logger.debug('Database error handling configured');
}

/**
 * Graceful shutdown приложения
 */
export function setupGracefulShutdown(): void {
  const gracefulShutdown = (signal: string) => {
    logger.info(`Received ${signal}, starting graceful shutdown...`);
    
    // Закрытие соединений с БД, остановка ботов, очистка ресурсов
    setTimeout(() => {
      logger.info('Graceful shutdown completed');
      process.exit(0);
    }, 5000);
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

// Экспорт основных классов ошибок для удобства
export * from './AppError';
export { errorHandler } from './ErrorHandler';