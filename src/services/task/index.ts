// src/services/task/index.ts
import { TaskService } from './TaskService';
import { TaskServiceExtended } from './TaskServiceExtended';
import { TaskServiceAnalytics } from './TaskServiceAnalytics';
import { TaskServiceAdmin } from './TaskServiceAdmin';
import { UserService } from '../user';
import { TransactionService } from '../transaction';
import { NotificationService } from '../notification';
import { TelegramService } from '../telegram';

// Экспорт всех типов
export * from './types';

// Экспорт классов
export { 
  TaskService, 
  TaskServiceExtended, 
  TaskServiceAnalytics, 
  TaskServiceAdmin 
};

// Singleton экземпляр расширенного сервиса
let taskServiceInstance: TaskServiceExtended | null = null;

/**
 * Создание единственного экземпляра TaskService
 */
export const createTaskService = (
  userService: UserService,
  transactionService: TransactionService,
  notificationService: NotificationService,
  telegramService: TelegramService
): TaskServiceExtended => {
  if (!taskServiceInstance) {
    taskServiceInstance = new TaskServiceExtended(
      userService,
      transactionService,
      notificationService,
      telegramService
    );
  }
  return taskServiceInstance;
};

/**
 * Получение экземпляра TaskService
 */
export const getTaskService = (): TaskServiceExtended => {
  if (!taskServiceInstance) {
    throw new Error('TaskService not initialized. Call createTaskService first.');
  }
  return taskServiceInstance;
};

/**
 * Сброс экземпляра (для тестирования)
 */
export const resetTaskService = (): void => {
  taskServiceInstance = null;
};

// Экспорт по умолчанию для удобства
export default {
  createTaskService,
  getTaskService,
  resetTaskService
};