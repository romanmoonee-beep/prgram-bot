// src/bot/middlewares/index.ts
import { Bot } from 'grammy';
import { authMiddleware } from './auth';
import { rateLimitMiddleware } from './rateLimit';
import { adminMiddleware } from './admin';
import { logger } from '../../utils/logger';

// Функция для настройки всех middleware
export function setupMiddlewares(bot: Bot) {
  try {
    // Логирование всех входящих сообщений
    bot.use((ctx, next) => {
      logger.debug('Incoming update:', {
        updateId: ctx.update.update_id,
        userId: ctx.from?.id,
        username: ctx.from?.username,
        type: ctx.update.message ? 'message' : 
              ctx.update.callback_query ? 'callback_query' : 'other'
      });
      return next();
    });

    // Middleware для обработки ошибок
    bot.use(async (ctx, next) => {
      try {
        await next();
      } catch (error) {
        logger.error('Bot error in middleware:', error, {
          userId: ctx.from?.id,
          updateId: ctx.update.update_id
        });
        
        // Отправляем пользователю сообщение об ошибке
        try {
          await ctx.reply('❌ Произошла ошибка. Попробуйте позже или обратитесь в поддержку.');
        } catch (replyError) {
          logger.error('Failed to send error message to user:', replyError);
        }
      }
    });

    // Rate limiting
    bot.use(rateLimitMiddleware);

    // Аутентификация пользователей
    bot.use(authMiddleware);

    // Обновление активности пользователя
    bot.use(async (ctx, next) => {
      if (ctx.session?.user) {
        try {
          await ctx.session.user.updateActivity();
        } catch (error) {
          logger.error('Failed to update user activity:', error);
        }
      }
      return next();
    });

    logger.info('✅ All middlewares configured successfully');
  } catch (error) {
    logger.error('❌ Failed to setup middlewares:', error);
    throw error;
  }
}

export { authMiddleware, rateLimitMiddleware, adminMiddleware };