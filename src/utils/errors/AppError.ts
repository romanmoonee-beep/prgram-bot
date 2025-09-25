// src/utils/errors/AppError.ts

/**
 * Базовый класс для ошибок приложения
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly timestamp: Date;
  public readonly details?: Record<string, any>;

  constructor(
    message: string,
    statusCode: number = 500,
    isOperational: boolean = true,
    details?: Record<string, any>
  ) {
    super(message);
    
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.timestamp = new Date();
    this.details = details;

    // Поддерживаем правильный stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * Ошибка валидации данных
 */
export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 400, true, details);
  }
}

/**
 * Ошибка авторизации
 */
export class AuthorizationError extends AppError {
  constructor(message: string = 'Unauthorized', details?: Record<string, any>) {
    super(message, 401, true, details);
  }
}

/**
 * Ошибка доступа
 */
export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden', details?: Record<string, any>) {
    super(message, 403, true, details);
  }
}

/**
 * Ошибка "не найдено"
 */
export class NotFoundError extends AppError {
  constructor(message: string = 'Not found', details?: Record<string, any>) {
    super(message, 404, true, details);
  }
}

/**
 * Ошибка конфликта данных
 */
export class ConflictError extends AppError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 409, true, details);
  }
}

/**
 * Ошибка превышения лимита запросов
 */
export class RateLimitError extends AppError {
  constructor(message: string = 'Too many requests', retryAfter?: number) {
    super(message, 429, true, { retryAfter });
  }
}

/**
 * Внутренняя ошибка сервера
 */
export class InternalServerError extends AppError {
  constructor(message: string = 'Internal server error', details?: Record<string, any>) {
    super(message, 500, false, details);
  }
}

/**
 * Ошибка внешнего сервиса
 */
export class ExternalServiceError extends AppError {
  constructor(
    service: string,
    message: string,
    originalError?: Error,
    details?: Record<string, any>
  ) {
    super(`${service}: ${message}`, 502, true, { 
      service, 
      originalError: originalError?.message,
      ...details 
    });
  }
}

/**
 * Ошибка базы данных
 */
export class DatabaseError extends AppError {
  constructor(message: string, originalError?: Error, details?: Record<string, any>) {
    super(`Database error: ${message}`, 500, false, { 
      originalError: originalError?.message,
      ...details 
    });
  }
}