// src/utils/errors/ErrorHandler.ts
import { AppError } from './AppError';
import { logger } from '../logger';

/**
 * Централизованный обработчик ошибок
 */
export class ErrorHandler {
  private static instance: ErrorHandler;

  private constructor() {}

  public static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  /**
   * Обработка ошибки
   */
  public handleError(error: Error, context?: string): void {
    if (this.isTrustedError(error)) {
      this.handleTrustedError(error as AppError, context);
    } else {
      this.handleUntrustedError(error, context);
    }
  }

  /**
   * Проверка, является ли ошибка операционной (ожидаемой)
   */
  public isTrustedError(error: Error): boolean {
    if (error instanceof AppError) {
      return error.isOperational;
    }
    return false;
  }

  /**
   * Обработка операционных ошибок
   */
  private handleTrustedError(error: AppError, context?: string): void {
    logger.warn('Operational error occurred', {
      name: error.name,
      message: error.message,
      statusCode: error.statusCode,
      context,
      details: error.details,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });

    // Отправляем уведомление если ошибка критична
    if (error.statusCode >= 500) {
      this.notifyAdmin(error, context);
    }
  }

  /**
   * Обработка неожиданных ошибок
   */
  private handleUntrustedError(error: Error, context?: string): void {
    logger.error('Unexpected error occurred', {
      name: error.name,
      message: error.message,
      context,
      stack: error.stack
    });

    // Всегда уведомляем админа о неожиданных ошибках
    this.notifyAdmin(error, context);
  }

  /**
   * Уведомление администратора об ошибке
   */
  private async notifyAdmin(error: Error, context?: string): Promise<void> {
    try {
      // Здесь можно реализовать отправку уведомлений:
      // - Email
      // - Slack
      // - Telegram
      // - Системы мониторинга (Sentry, Rollbar)
      
      logger.info('Admin notification should be sent for error', {
        errorName: error.name,
        context
      });
    } catch (notificationError) {
      logger.error('Failed to send admin notification', {
        originalError: error.message,
        notificationError: notificationError instanceof Error 
          ? notificationError.message 
          : 'Unknown error'
      });
    }
  }

  /**
   * Форматирование ошибки для API ответа
   */
  public formatErrorForResponse(error: Error): {
    success: false;
    error: {
      message: string;
      code?: string;
      statusCode: number;
      timestamp: string;
      details?: Record<string, any>;
    };
  } {
    if (error instanceof AppError) {
      return {
        success: false,
        error: {
          message: error.message,
          code: error.name,
          statusCode: error.statusCode,
          timestamp: error.timestamp.toISOString(),
          details: process.env.NODE_ENV === 'development' ? error.details : undefined
        }
      };
    }

    // Для неожиданных ошибок возвращаем общее сообщение
    return {
      success: false,
      error: {
        message: process.env.NODE_ENV === 'development' 
          ? error.message 
          : 'Internal server error',
        statusCode: 500,
        timestamp: new Date().toISOString()
      }
    };
  }

  /**
   * Обработка необработанных промисов
   */
  public handleUnhandledRejection(reason: any, promise: Promise<any>): void {
    logger.error('Unhandled promise rejection', {
      reason: reason instanceof Error ? reason.message : reason,
      stack: reason instanceof Error ? reason.stack : undefined
    });

    // В критических случаях можно завершить процесс
    if (process.env.NODE_ENV === 'production' && reason instanceof Error && !this.isTrustedError(reason)) {
      // Даем время на завершение текущих операций
      setTimeout(() => {
        process.exit(1);
      }, 1000);
    }
  }

  /**
   * Обработка необработанных исключений
   */
  public handleUncaughtException(error: Error): void {
    logger.error('Uncaught exception', {
      name: error.name,
      message: error.message,
      stack: error.stack
    });

    // Критическая ошибка - завершаем процесс
    process.exit(1);
  }
}

// Глобальный экземпляр
export const errorHandler = ErrorHandler.getInstance();