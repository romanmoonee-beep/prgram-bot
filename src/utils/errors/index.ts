// src/utils/errors/index.ts

// Экспорт основных классов ошибок
export {
  AppError,
  ValidationError,
  AuthorizationError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  InternalServerError,
  ExternalServiceError,
  DatabaseError
} from './AppError';

// Экспорт обработчика ошибок
export { ErrorHandler, errorHandler } from './ErrorHandler';

// Экспорт функций инициализации
export { initErrorHandling, setupGracefulShutdown } from './init';

// Для обратной совместимости с существующим кодом
export { AppError as default } from './AppError';