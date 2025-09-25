// src/bot/handlers/cancelHandler.ts - ИСПРАВЛЕННЫЙ ОБРАБОТЧИК ОТМЕНЫ
import { Bot } from 'grammy';
import { requireAuth } from '../middlewares/auth';
import { getMainMenuKeyboard } from '../keyboards/main';
import { logger } from '../../utils/logger';
import { EMOJIS } from '../../utils/constants';
import { formatUserProfile } from '../../utils/formatters/init';

export function setupCancelHandler(bot: Bot) {
  // Обработчик отмены действий
  bot.callbackQuery('cancel', async (ctx) => {
    try {
      const user = ctx.session?.user;
      
      // Очищаем состояние пользователя
      if (user) {
        user.currentState = null;
        await user.save();
        
        logger.userAction(user.telegramId, 'action_cancelled');
      }

      await ctx.answerCallbackQuery('✅ Действие отменено');
      
      // Возвращаемся в главное меню
      const message = user 
        ? `${EMOJIS.home} **Главное меню**\n\n${formatUserProfile(user)}`
        : `${EMOJIS.home} **Главное меню**\n\nДобро пожаловать! Выберите действие:`;

      await ctx.editMessageText(message, {
        reply_markup: getMainMenuKeyboard(),
        parse_mode: 'Markdown'
      });

    } catch (error) {
      logger.error('Cancel handler error:', error);
      await ctx.answerCallbackQuery('Произошла ошибка');
      
      // Фallback - отправляем новое сообщение если не можем отредактировать
      try {
        await ctx.reply('🏠 **Главное меню**\n\nВыберите действие:', {
          reply_markup: getMainMenuKeyboard(),
          parse_mode: 'Markdown'
        });
      } catch (fallbackError) {
        logger.error('Cancel fallback error:', fallbackError);
      }
    }
  });

  // Обработчик для очистки состояния при текстовых сообщениях
  bot.on('message:text', async (ctx, next) => {
    const user = ctx.session?.user;
    
    // Если пользователь пишет "отмена" или "/cancel" - очищаем состояние
    const text = ctx.message.text.toLowerCase();
    if (['отмена', 'отменить', '/cancel', 'cancel'].includes(text) && user) {
      try {
        user.currentState = null;
        await user.save();

        await ctx.reply('✅ Действие отменено\n\nВозвращаемся в главное меню:', {
          reply_markup: getMainMenuKeyboard()
        });
        
        logger.userAction(user.telegramId, 'action_cancelled_by_text');
        return;
      } catch (error) {
        logger.error('Text cancel error:', error);
      }
    }

    await next();
  });

  logger.info('✅ Cancel handler configured');
}

// Функция для безопасной очистки состояния пользователя
export async function clearUserState(userId: number): Promise<void> {
  try {
    const { User } = await import('../../database/models');
    await User.update(
      { currentState: null },
      { where: { telegramId: userId } }
    );
    
    logger.info(`User state cleared for ${userId}`);
  } catch (error) {
    logger.error('Failed to clear user state:', error);
  }
}