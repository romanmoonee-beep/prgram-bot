// src/bot/handlers/init.ts - UPDATED COMPLETE VERSION
import { Bot } from 'grammy';
import { logger } from '../../utils/logger';

// Импорт всех обработчиков
import { setupStartHandler } from './start';
import { setupCabinetHandlers } from './cabinet';
import { setupEarnHandlers } from './earn';
import { setupTaskExecutionHandlers } from './taskExecution';
import { setupAdvertiseHandlers, setupTaskCreationTextHandlers, setupTaskCreationFinalHandlers } from './advertise';
import { setupChecksHandlers, setupCheckTextHandlers, setupCheckCreationConfirmHandlers } from './checks';
import { setupReferralsHandlers } from './referrals';

// Функция для настройки всех обработчиков
export function setupHandlers(bot: Bot) {
  try {
    logger.info('🔄 Setting up bot handlers...');

    // Основные обработчики
    setupStartHandler(bot);
    setupCabinetHandlers(bot);
    
    // Модуль заработка
    setupEarnHandlers(bot);
    setupTaskExecutionHandlers(bot);
    
    // Модуль рекламы
    setupAdvertiseHandlers(bot);
    setupTaskCreationTextHandlers(bot);
    setupTaskCreationFinalHandlers(bot);
    
    // Модуль чеков
    setupChecksHandlers(bot);
    setupCheckTextHandlers(bot);
    setupCheckCreationConfirmHandlers(bot);
    
    // Реферальная система
    setupReferralsHandlers(bot);

    // Обработчик помощи
    bot.callbackQuery('help', async (ctx) => {
      try {
        let message = `❓ **ЦЕНТР ПОМОЩИ**\n\n`;
        message += `**🆕 Начало работы**\n`;
        message += `Зарегистрируйтесь, выберите задание и начните зарабатывать!\n\n`;
        
        message += `**💰 Заработок**\n`;
        message += `Выполняйте задания: подписки, просмотры, взаимодействие с ботами\n\n`;
        
        message += `**📢 Реклама**\n`;
        message += `Создавайте задания для продвижения своих проектов\n\n`;
        
        message += `**🔗 Рефералы**\n`;
        message += `Приглашайте друзей по реферальной ссылке\n\n`;
        
        message += `**💳 Чеки**\n`;
        message += `Отправляйте GRAM через специальные чеки\n\n`;
        
        message += `**📞 Поддержка:**\n`;
        message += `@prgram_support - техническая поддержка\n`;
        message += `@prgram_chat - общий чат пользователей`;

        await ctx.editMessageText(message, {
          reply_markup: { inline_keyboard: [[{ text: '🏠 Главное меню', callback_data: 'main_menu' }]] },
          parse_mode: 'Markdown'
        });

        await ctx.answerCallbackQuery();
      } catch (error) {
        logger.error('Help handler error:', error);
        await ctx.answerCallbackQuery('Произошла ошибка');
      }
    });

    // Обработчик настроек
    bot.callbackQuery('settings', async (ctx) => {
      try {
        const user = ctx.session?.user;
        if (!user) {
          await ctx.answerCallbackQuery('Пользователь не найден');
          return;
        }

        let message = `⚙️ **НАСТРОЙКИ**\n\n`;
        message += `Здесь будут настройки бота:\n`;
        message += `• Уведомления\n`;
        message += `• Язык интерфейса\n`;
        message += `• Приватность\n`;
        message += `• Прочие параметры\n\n`;
        message += `🚧 Раздел в разработке`;

        await ctx.editMessageText(message, {
          reply_markup: { inline_keyboard: [[{ text: '🏠 Главное меню', callback_data: 'main_menu' }]] },
          parse_mode: 'Markdown'
        });

        await ctx.answerCallbackQuery();
      } catch (error) {
        logger.error('Settings handler error:', error);
        await ctx.answerCallbackQuery('Произошла ошибка');
      }
    });

    // Обработчик отмены действий
    bot.callbackQuery('cancel', async (ctx) => {
      try {
        const user = ctx.session?.user;
        if (user) {
          user.currentState = null;
          await user.save();
        }

        await ctx.answerCallbackQuery('✅ Действие отменено');
        
        // Возвращаемся в главное меню
        setTimeout(() => {
          bot.handleUpdate({
            ...ctx.update,
            callback_query: {
              ...ctx.update.callback_query!,
              data: 'main_menu'
            }
          });
        }, 1000);

      } catch (error) {
        logger.error('Cancel handler error:', error);
        await ctx.answerCallbackQuery('Произошла ошибка');
      }
    });

    // Обработчик для игнорирования текущей страницы
    bot.callbackQuery('current_page', async (ctx) => {
      await ctx.answerCallbackQuery();
    });

    // Обработчик неизвестных команд
    bot.on('message:text', async (ctx, next) => {
      // Проверяем, является ли сообщение командой
      if (ctx.message.text.startsWith('/')) {
        const user = ctx.session?.user;
        if (!user) {
          await ctx.reply('❓ Для использования команд необходимо зарегистрироваться. Нажмите /start');
          return;
        }

        await ctx.reply(
          '❓ Неизвестная команда.\n\n' +
          'Доступные команды:\n' +
          '• /start - главное меню\n' +
          '• /menu - главное меню\n' +
          '• /help - помощь',
          {
            reply_markup: {
              inline_keyboard: [[
                { text: '🏠 Главное меню', callback_data: 'main_menu' },
                { text: '❓ Помощь', callback_data: 'help' }
              ]]
            }
          }
        );
        return;
      }
      
      await next();
    });

    // Базовый обработчик callback запросов
    bot.on('callback_query', async (ctx, next) => {
      // Если callback не был обработан, уведомляем пользователя
      if (!ctx.callbackQuery.message) {
        await ctx.answerCallbackQuery('🔄 Функция в разработке');
        return;
      }
      
      await next();
    });

    // Обработчик для всех необработанных callback_query
    bot.callbackQuery(/.*/, async (ctx) => {
      logger.warn(`Unhandled callback query: ${ctx.callbackQuery.data}`, {
        userId: ctx.from?.id,
        data: ctx.callbackQuery.data
      });
      
      await ctx.answerCallbackQuery('🔄 Функция в разработке или недоступна');
    });

    logger.info('✅ All handlers configured successfully');
    
  } catch (error) {
    logger.error('❌ Failed to setup handlers:', error);
    throw error;
  }
}

// Дополнительная функция для обработки ошибок в боте
export function setupErrorHandlers(bot: Bot) {
  // Глобальный обработчик ошибок
  bot.catch((err) => {
    const ctx = err.ctx;
    const error = err.error;
    
    logger.error('Bot error occurred:', error, {
      updateId: ctx.update.update_id,
      userId: ctx.from?.id,
      username: ctx.from?.username,
      chatId: ctx.chat?.id
    });

    // Пытаемся отправить сообщение об ошибке пользователю
    try {
      if (ctx.callbackQuery) {
        ctx.answerCallbackQuery('Произошла ошибка. Попробуйте позже.');
      } else {
        ctx.reply('❌ Произошла ошибка. Попробуйте позже или обратитесь в поддержку.');
      }
    } catch (replyError) {
      logger.error('Failed to send error message to user:', replyError);
    }
  });

  // Обработчик для необработанных исключений
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  });

  process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
    // Не завершаем процесс автоматически, но логируем критическую ошибку
  });

  logger.info('✅ Error handlers configured');
}

export default setupHandlers;