// src/middlewares/admin.ts
import { Context, NextFunction } from 'grammy';
import { logger } from '../utils/logger';

// Middleware для проверки админских прав
export function adminMiddleware(ctx: Context, next: NextFunction) {
  if (!ctx.session?.isAdmin) {
    logger.warn(`Unauthorized admin access attempt by user ${ctx.from?.id}`);
    
    return ctx.reply(
      '🚫 У вас нет прав администратора для выполнения этого действия.'
    );
  }
  
  logger.info(`Admin action by user ${ctx.from?.id}`, {
    command: ctx.message && 'text' in ctx.message ? ctx.message.text : 'callback',
    username: ctx.from?.username
  });
  
  return next();
}

// Проверка супер-админа (первый ID в списке админов)
export function superAdminMiddleware(ctx: Context, next: NextFunction) {
  if (!ctx.session?.isAdmin) {
    return ctx.reply('🚫 У вас нет прав администратора.');
  }

  const adminIds = process.env.ADMIN_IDS?.split(',').map(id => parseInt(id)) || [];
  const isSuperAdmin = adminIds.length > 0 && adminIds[0] === ctx.from?.id;

  if (!isSuperAdmin) {
    logger.warn(`Super admin access denied for user ${ctx.from?.id}`);
    return ctx.reply('🚫 Требуются права супер-администратора.');
  }

  logger.info(`Super admin action by user ${ctx.from?.id}`);
  return next();
}

// Проверка модераторских прав (для проверки заданий)
export function moderatorMiddleware(ctx: Context, next: NextFunction) {
  // Модераторы = админы + возможные дополнительные пользователи
  const moderatorIds = process.env.MODERATOR_IDS?.split(',').map(id => parseInt(id)) || [];
  const adminIds = process.env.ADMIN_IDS?.split(',').map(id => parseInt(id)) || [];
  
  const allModerators = [...new Set([...adminIds, ...moderatorIds])];
  const isModerator = allModerators.includes(ctx.from?.id || 0);

  if (!isModerator) {
    logger.warn(`Moderator access denied for user ${ctx.from?.id}`);
    return ctx.reply('🚫 У вас нет прав модератора.');
  }

  logger.info(`Moderator action by user ${ctx.from?.id}`);
  return next();
}

// Функция для проверки админских прав без middleware
export function isAdmin(userId: number): boolean {
  const adminIds = process.env.ADMIN_IDS?.split(',').map(id => parseInt(id)) || [];
  return adminIds.includes(userId);
}

// Функция для проверки супер-админских прав
export function isSuperAdmin(userId: number): boolean {
  const adminIds = process.env.ADMIN_IDS?.split(',').map(id => parseInt(id)) || [];
  return adminIds.length > 0 && adminIds[0] === userId;
}

// Функция для проверки модераторских прав
export function isModerator(userId: number): boolean {
  const moderatorIds = process.env.MODERATOR_IDS?.split(',').map(id => parseInt(id)) || [];
  const adminIds = process.env.ADMIN_IDS?.split(',').map(id => parseInt(id)) || [];
  
  const allModerators = [...new Set([...adminIds, ...moderatorIds])];
  return allModerators.includes(userId);
}

// Получение списка всех админов
export function getAdminList(): number[] {
  return process.env.ADMIN_IDS?.split(',').map(id => parseInt(id)) || [];
}

// Получение списка всех модераторов
export function getModeratorList(): number[] {
  const moderatorIds = process.env.MODERATOR_IDS?.split(',').map(id => parseInt(id)) || [];
  const adminIds = process.env.ADMIN_IDS?.split(',').map(id => parseInt(id)) || [];
  
  return [...new Set([...adminIds, ...moderatorIds])];
}

export {
  adminMiddleware as default
};