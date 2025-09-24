// src/bot/handlers/index.ts
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

export default setupHandlers;// src/bot/handlers/cabinet.ts
import { Bot, Context } from 'grammy';
import { requireAuth } from '../middlewares/auth';
import { logger } from '../../utils/logger';
import { EMOJIS } from '../../utils/constants';
import { getCabinetKeyboard, getPaginationKeyboard, getMainMenuKeyboard } from '../keyboards/main';
import { formatUserProfile, formatUserStats } from '../../utils/formatters';
import { Transaction, Task, Notification } from '../../database/models';

export function setupCabinetHandlers(bot: Bot) {
  
  // Главная страница кабинета
  bot.callbackQuery('cabinet', requireAuth, async (ctx) => {
    try {
      const user = ctx.session!.user!;
      
      logger.userAction(user.telegramId, 'cabinet_opened');

      const message = `${EMOJIS.user} **Личный кабинет**\n\n${formatUserProfile(user)}`;

      await ctx.editMessageText(message, {
        reply_markup: getCabinetKeyboard(ctx.session!.isAdmin),
        parse_mode: 'Markdown'
      });

      await ctx.answerCallbackQuery();
    } catch (error) {
      logger.error('Cabinet handler error:', error);
      await ctx.answerCallbackQuery('Произошла ошибка');
    }
  });

  // Статистика пользователя
  bot.callbackQuery('cabinet_stats', requireAuth, async (ctx) => {
    try {
      const user = ctx.session!.user!;
      
      const message = formatUserStats(user, 'month');

      const keyboard = getCabinetKeyboard(ctx.session!.isAdmin)
        .row()
        .text(`${EMOJIS.chart} За неделю`, 'cabinet_stats_week')
        .text(`${EMOJIS.chart} За сегодня`, 'cabinet_stats_today');

      await ctx.editMessageText(message, {
        reply_markup: keyboard,
        parse_mode: 'Markdown'
      });

      await ctx.answerCallbackQuery();
    } catch (error) {
      logger.error('Cabinet stats error:', error);
      await ctx.answerCallbackQuery('Произошла ошибка');
    }
  });

  // Статистика за неделю
  bot.callbackQuery('cabinet_stats_week', requireAuth, async (ctx) => {
    try {
      const user = ctx.session!.user!;
      
      const message = formatUserStats(user, 'week');

      const keyboard = getCabinetKeyboard(ctx.session!.isAdmin)
        .row()
        .text(`${EMOJIS.chart} За месяц`, 'cabinet_stats')
        .text(`${EMOJIS.chart} За сегодня`, 'cabinet_stats_today');

      await ctx.editMessageText(message, {
        reply_markup: keyboard,
        parse_mode: 'Markdown'
      });

      await ctx.answerCallbackQuery();
    } catch (error) {
      logger.error('Cabinet stats week error:', error);
      await ctx.answerCallbackQuery('Произошла ошибка');
    }
  });

  // Статистика за сегодня
  bot.callbackQuery('cabinet_stats_today', requireAuth, async (ctx) => {
    try {
      const user = ctx.session!.user!;
      
      const message = formatUserStats(user, 'today');

      const keyboard = getCabinetKeyboard(ctx.session!.isAdmin)
        .row()
        .text(`${EMOJIS.chart} За месяц`, 'cabinet_stats')
        .text(`${EMOJIS.chart} За неделю`, 'cabinet_stats_week');

      await ctx.editMessageText(message, {
        reply_markup: keyboard,
        parse_mode: 'Markdown'
      });

      await ctx.answerCallbackQuery();
    } catch (error) {
      logger.error('Cabinet stats today error:', error);
      await ctx.answerCallbackQuery('Произошла ошибка');
    }
  });

  // Мои задания
  bot.callbackQuery(/^cabinet_tasks(?:_page_(\d+))?$/, requireAuth, async (ctx) => {
    try {
      const user = ctx.session!.user!;
      const page = parseInt(ctx.match![1] || '1');
      const limit = 5;
      const offset = (page - 1) * limit;

      // Получаем задания пользователя
      const { rows: tasks, count } = await Task.findAndCountAll({
        where: { authorId: user.id },
        order: [['createdAt', 'DESC']],
        limit,
        offset
      });

      const totalPages = Math.ceil(count / limit);

      let message = `${EMOJIS.chart} **Мои задания** (${count})\n\n`;

      if (tasks.length === 0) {
        message += `${EMOJIS.info} У вас пока нет созданных заданий.\n\n`;
        message += `Создайте первое задание в разделе "Рекламировать"`;
      } else {
        tasks.forEach((task, index) => {
          const progress = task.totalExecutions > 0 
            ? Math.round((task.completedExecutions || 0) / task.totalExecutions * 100)
            : 0;
          
          message += `${index + 1}. **${task.title}**\n`;
          message += `${EMOJIS.money} ${task.reward} GRAM | `;
          message += `${task.getStatusIcon()} ${progress}% | `;
          message += `${EMOJIS.view} ${task.views || 0}\n\n`;
        });
      }

      const keyboard = getPaginationKeyboard(
        page,
        totalPages,
        'cabinet_tasks',
        [
          { text: `${EMOJIS.advertise} Создать задание`, data: 'advertise_create' },
          { text: `${EMOJIS.stats} Статистика`, data: 'advertise_stats' }
        ]
      );

      await ctx.editMessageText(message, {
        reply_markup: keyboard,
        parse_mode: 'Markdown'
      });

      await ctx.answerCallbackQuery();
    } catch (error) {
      logger.error('Cabinet tasks error:', error);
      await ctx.answerCallbackQuery('Произошла ошибка');
    }
  });

  // Уведомления
  bot.callbackQuery(/^cabinet_notifications(?:_page_(\d+))?$/, requireAuth, async (ctx) => {
    try {
      const user = ctx.session!.user!;
      const page = parseInt(ctx.match![1] || '1');
      const limit = 5;
      const offset = (page - 1) * limit;

      // Получаем уведомления пользователя
      const { rows: notifications, count } = await Notification.findAndCountAll({
        where: { userId: user.id },
        order: [['createdAt', 'DESC']],
        limit,
        offset
      });

      const totalPages = Math.ceil(count / limit);
      const unreadCount = await Notification.count({
        where: { userId: user.id, isRead: false }
      });

      let message = `${EMOJIS.bell} **Уведомления** (${count})`;
      if (unreadCount > 0) {
        message += ` | ${EMOJIS.info} Непрочитанных: ${unreadCount}`;
      }
      message += '\n\n';

      if (notifications.length === 0) {
        message += `${EMOJIS.info} У вас пока нет уведомлений.`;
      } else {
        notifications.forEach((notification, index) => {
          const readIcon = notification.isRead ? '✅' : '🔔';
          message += `${readIcon} **${notification.title}**\n`;
          message += `${notification.message}\n`;
          message += `${notification.getTypeIcon()} ${notification.createdAt.toLocaleDateString('ru-RU')}\n\n`;
        });
      }

      const additionalButtons = [];
      if (unreadCount > 0) {
        additionalButtons.push({ text: '✅ Отметить все как прочитанные', data: 'cabinet_notifications_mark_read' });
      }

      const keyboard = getPaginationKeyboard(
        page,
        totalPages,
        'cabinet_notifications',
        additionalButtons
      );

      await ctx.editMessageText(message, {
        reply_markup: keyboard,
        parse_mode: 'Markdown'
      });

      await ctx.answerCallbackQuery();
    } catch (error) {
      logger.error('Cabinet notifications error:', error);
      await ctx.answerCallbackQuery('Произошла ошибка');
    }
  });

  // Отметить все уведомления как прочитанные
  bot.callbackQuery('cabinet_notifications_mark_read', requireAuth, async (ctx) => {
    try {
      const user = ctx.session!.user!;
      
      const markedCount = await Notification.markAllAsRead(user.id);

      await ctx.answerCallbackQuery(`✅ Отмечено ${markedCount} уведомлений как прочитанные`);
      
      // Обновляем список уведомлений
      ctx.callbackQuery = { ...ctx.callbackQuery!, data: 'cabinet_notifications' };
      return bot.handleUpdate(ctx.update);
      
    } catch (error) {
      logger.error('Mark notifications read error:', error);
      await ctx.answerCallbackQuery('Произошла ошибка');
    }
  });

  // Пополнение баланса
  bot.callbackQuery('cabinet_deposit', requireAuth, async (ctx) => {
    try {
      const message = `${EMOJIS.money} **Пополнение баланса**

Выберите сумму для пополнения:

${EMOJIS.info} **Курс:** 1 Star = 10 GRAM
${EMOJIS.gift} **Бонусы:**
• При пополнении от 450 Stars: +10% бонус
• При пополнении от 850 Stars: +15% бонус  
• При пополнении от 2000 Stars: +20% бонус + 1000 GRAM

${EMOJIS.diamond} Пополнение через Telegram Stars обеспечивает мгновенное зачисление средств.`;

      const keyboard = getMainMenuKeyboard()
        .row()
        .text('💳 100 Stars = 1,000 GRAM', 'deposit_100')
        .text('💎 450 Stars = 4,950 GRAM', 'deposit_450')
        .row()
        .text('🔥 850 Stars = 9,775 GRAM', 'deposit_850') 
        .text('⭐ 2000 Stars = 25,000 GRAM', 'deposit_2000');

      await ctx.editMessageText(message, {
        reply_markup: keyboard,
        parse_mode: 'Markdown'
      });

      await ctx.answerCallbackQuery();
    } catch (error) {
      logger.error('Cabinet deposit error:', error);
      await ctx.answerCallbackQuery('Произошла ошибка');
    }
  });

  // Настройки кабинета
  bot.callbackQuery('cabinet_settings', requireAuth, async (ctx) => {
    try {
      const user = ctx.session!.user!;
      
      const settings = user.notificationSettings as any || {};
      
      let message = `${EMOJIS.settings} **Настройки профиля**\n\n`;
      message += `${EMOJIS.user} **Профиль:**\n`;
      message += `├ ID: \`${user.telegramId}\`\n`;
      message += `├ Username: ${user.username ? `@${user.username}` : 'не указан'}\n`;
      message += `├ Имя: ${user.getDisplayName()}\n`;
      message += `└ Уровень: ${user.getLevelText()} ${user.getLevelEmoji()}\n\n`;
      
      message += `${EMOJIS.bell} **Уведомления:**\n`;
      message += `├ Выполнение заданий: ${settings.taskCompleted !== false ? '✅' : '❌'}\n`;
      message += `├ Создание заданий: ${settings.taskCreated !== false ? '✅' : '❌'}\n`;
      message += `├ Рефералы: ${settings.referralJoined !== false ? '✅' : '❌'}\n`;
      message += `├ Баланс: ${settings.balanceUpdates !== false ? '✅' : '❌'}\n`;
      message += `└ Системные: ${settings.systemMessages !== false ? '✅' : '❌'}`;

      const keyboard = getCabinetKeyboard(ctx.session!.isAdmin)
        .row()
        .text(`${EMOJIS.bell} Настроить уведомления`, 'settings_notifications')
        .text(`${EMOJIS.referrals} Реферальная ссылка`, 'referrals_link');

      await ctx.editMessageText(message, {
        reply_markup: keyboard,
        parse_mode: 'Markdown'
      });

      await ctx.answerCallbackQuery();
    } catch (error) {
      logger.error('Cabinet settings error:', error);
      await ctx.answerCallbackQuery('Произошла ошибка');
    }
  });

  logger.info('✅ Cabinet handlers configured');
}