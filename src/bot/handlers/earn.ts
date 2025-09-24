// src/bot/handlers/earn.ts
import { Bot, Context } from 'grammy';
import { requireAuth } from '../middlewares/auth';
import { logger } from '../../utils/logger';
import { EMOJIS, TASK_TYPES, TASK_STATUSES } from '../../utils/constants';
import { getEarnKeyboard, getPaginationKeyboard, getConfirmKeyboard } from '../keyboards/main';
import { formatTaskListItem } from '../../utils/formatters/init';
import { Task, TaskExecution, User } from '../../database/models';
import { Op } from 'sequelize';

export function setupEarnHandlers(bot: Bot) {
  
  // Главное меню заработка
  bot.callbackQuery('earn', requireAuth, async (ctx) => {
    try {
      const user = ctx.session!.user!;
      
      logger.userAction(user.telegramId, 'earn_opened');

      // Получаем статистику для отображения
      const availableTasksCount = await Task.count({
        where: {
          status: TASK_STATUSES.ACTIVE,
          expiresAt: { [Op.gt]: new Date() },
          remainingExecutions: { [Op.gt]: 0 },
          authorId: { [Op.ne]: user.id } // Исключаем свои задания
        }
      });

      const userExecutionsCount = await TaskExecution.count({
        where: { userId: user.id }
      });

      let message = `${EMOJIS.earn} **Заработать GRAM**\n\n`;
      message += `Доступно заданий: **${availableTasksCount}**\n`;
      message += `Ваш множитель: **x${user.getEarnMultiplier()}** (${user.getLevelText()})\n\n`;
      
      message += `Выберите тип заданий:`;

      await ctx.editMessageText(message, {
        reply_markup: getEarnKeyboard(),
        parse_mode: 'Markdown'
      });

      await ctx.answerCallbackQuery();
    } catch (error) {
      logger.error('Earn handler error:', error);
      await ctx.answerCallbackQuery('Произошла ошибка');
    }
  });

  // Подписка на каналы
  bot.callbackQuery(/^earn_channels(?:_page_(\d+))?$/, requireAuth, async (ctx) => {
    try {
      const user = ctx.session!.user!;
      const page = parseInt(ctx.match![1] || '1');
      const limit = 5;
      const offset = (page - 1) * limit;

      // Получаем задания подписок на каналы
      const { rows: tasks, count } = await Task.findAndCountAll({
        where: {
          type: TASK_TYPES.SUBSCRIBE_CHANNEL,
          status: TASK_STATUSES.ACTIVE,
          expiresAt: { [Op.gt]: new Date() },
          remainingExecutions: { [Op.gt]: 0 },
          authorId: { [Op.ne]: user.id }
        },
        include: [{ model: User, as: 'author', attributes: ['username', 'firstName'] }],
        order: [['reward', 'DESC']],
        limit,
        offset
      });

      const totalPages = Math.ceil(count / limit);

      let message = `${EMOJIS.channel} **Подписка на каналы**\n\n`;
      message += `Найдено: **${count} заданий**\n`;
      message += `Сортировка: по награде ↓\n\n`;

      if (tasks.length === 0) {
        message += `${EMOJIS.info} Нет доступных заданий для подписки на каналы.`;
      } else {
        tasks.forEach((task, index) => {
          message += `${index + 1}. **${task.title}**\n`;
          message += `${EMOJIS.money} ${task.reward} GRAM\n`;
          message += `👥 ${task.completedExecutions || 0}/${task.totalExecutions}\n`;
          message += `⏱️ ${formatTimeRemaining(task.expiresAt)}\n`;
          message += `\n[Подписаться](callback_data:task_${task.id}) [Инфо ℹ️](callback_data:task_info_${task.id})\n\n`;
        });
      }

      const keyboard = getPaginationKeyboard(
        page,
        totalPages,
        'earn_channels',
        [
          { text: `${EMOJIS.fire} Топ задания`, data: 'earn_top' },
          { text: `${EMOJIS.diamond} Премиум`, data: 'earn_premium' }
        ]
      );

      await ctx.editMessageText(message, {
        reply_markup: keyboard,
        parse_mode: 'Markdown'
      });

      await ctx.answerCallbackQuery();
    } catch (error) {
      logger.error('Earn channels error:', error);
      await ctx.answerCallbackQuery('Произошла ошибка');
    }
  });

  // Вступление в группы
  bot.callbackQuery(/^earn_groups(?:_page_(\d+))?$/, requireAuth, async (ctx) => {
    try {
      const user = ctx.session!.user!;
      const page = parseInt(ctx.match![1] || '1');
      const limit = 5;
      const offset = (page - 1) * limit;

      const { rows: tasks, count } = await Task.findAndCountAll({
        where: {
          type: TASK_TYPES.JOIN_GROUP,
          status: TASK_STATUSES.ACTIVE,
          expiresAt: { [Op.gt]: new Date() },
          remainingExecutions: { [Op.gt]: 0 },
          authorId: { [Op.ne]: user.id }
        },
        include: [{ model: User, as: 'author', attributes: ['username', 'firstName'] }],
        order: [['reward', 'DESC']],
        limit,
        offset
      });

      const totalPages = Math.ceil(count / limit);

      let message = `${EMOJIS.group} **Вступить в группы**\n\n`;
      message += `Найдено: **${count} заданий**\n`;
      message += `Сортировка: по награде ↓\n\n`;

      if (tasks.length === 0) {
        message += `${EMOJIS.info} Нет доступных заданий для вступления в группы.`;
      } else {
        tasks.forEach((task, index) => {
          message += `${index + 1}. **${task.title}**\n`;
          message += `${EMOJIS.money} ${task.reward} GRAM\n`;
          message += `👥 ${task.completedExecutions || 0}/${task.totalExecutions}\n`;
          message += `⏱️ ${formatTimeRemaining(task.expiresAt)}\n\n`;
        });
      }

      const keyboard = getPaginationKeyboard(page, totalPages, 'earn_groups');

      await ctx.editMessageText(message, {
        reply_markup: keyboard,
        parse_mode: 'Markdown'
      });

      await ctx.answerCallbackQuery();
    } catch (error) {
      logger.error('Earn groups error:', error);
      await ctx.answerCallbackQuery('Произошла ошибка');
    }
  });

  // Просмотр постов
  bot.callbackQuery(/^earn_posts(?:_page_(\d+))?$/, requireAuth, async (ctx) => {
    try {
      const user = ctx.session!.user!;
      const page = parseInt(ctx.match![1] || '1');
      const limit = 5;
      const offset = (page - 1) * limit;

      const { rows: tasks, count } = await Task.findAndCountAll({
        where: {
          type: TASK_TYPES.VIEW_POST,
          status: TASK_STATUSES.ACTIVE,
          expiresAt: { [Op.gt]: new Date() },
          remainingExecutions: { [Op.gt]: 0 },
          authorId: { [Op.ne]: user.id }
        },
        order: [['reward', 'DESC']],
        limit,
        offset
      });

      const totalPages = Math.ceil(count / limit);

      let message = `${EMOJIS.view} **Просмотр постов**\n\n`;
      message += `Найдено: **${count} заданий**\n\n`;

      if (tasks.length === 0) {
        message += `${EMOJIS.info} Нет доступных заданий для просмотра постов.`;
      } else {
        tasks.forEach((task, index) => {
          message += `${index + 1}. **${task.title}**\n`;
          message += `${EMOJIS.money} ${task.reward} GRAM\n`;
          message += `👥 ${task.completedExecutions || 0}/${task.totalExecutions}\n\n`;
        });
      }

      const keyboard = getPaginationKeyboard(page, totalPages, 'earn_posts');

      await ctx.editMessageText(message, {
        reply_markup: keyboard,
        parse_mode: 'Markdown'
      });

      await ctx.answerCallbackQuery();
    } catch (error) {
      logger.error('Earn posts error:', error);
      await ctx.answerCallbackQuery('Произошла ошибка');
    }
  });

  // Переход в ботов
  bot.callbackQuery(/^earn_bots(?:_page_(\d+))?$/, requireAuth, async (ctx) => {
    try {
      const user = ctx.session!.user!;
      const page = parseInt(ctx.match![1] || '1');
      const limit = 5;
      const offset = (page - 1) * limit;

      const { rows: tasks, count } = await Task.findAndCountAll({
        where: {
          type: TASK_TYPES.BOT_INTERACTION,
          status: TASK_STATUSES.ACTIVE,
          expiresAt: { [Op.gt]: new Date() },
          remainingExecutions: { [Op.gt]: 0 },
          authorId: { [Op.ne]: user.id }
        },
        order: [['reward', 'DESC']],
        limit,
        offset
      });

      const totalPages = Math.ceil(count / limit);

      let message = `${EMOJIS.bot} **Перейти к ботам**\n\n`;
      message += `Найдено: **${count} заданий**\n`;
      message += `💰 100-1500 GRAM\n\n`;

      if (tasks.length === 0) {
        message += `${EMOJIS.info} Нет доступных заданий для взаимодействия с ботами.`;
      } else {
        tasks.forEach((task, index) => {
          message += `${index + 1}. **${task.title}**\n`;
          message += `${EMOJIS.money} ${task.reward} GRAM\n`;
          message += `👥 ${task.completedExecutions || 0}/${task.totalExecutions}\n`;
          message += `⚠️ Требует проверки автором\n\n`;
        });
      }

      const keyboard = getPaginationKeyboard(page, totalPages, 'earn_bots');

      await ctx.editMessageText(message, {
        reply_markup: keyboard,
        parse_mode: 'Markdown'
      });

      await ctx.answerCallbackQuery();
    } catch (error) {
      logger.error('Earn bots error:', error);
      await ctx.answerCallbackQuery('Произошла ошибка');
    }
  });

  // Топ задания
  bot.callbackQuery(/^earn_top(?:_page_(\d+))?$/, requireAuth, async (ctx) => {
    try {
      const user = ctx.session!.user!;
      const page = parseInt(ctx.match![1] || '1');
      const limit = 5;
      const offset = (page - 1) * limit;

      const { rows: tasks, count } = await Task.findAndCountAll({
        where: {
          isTopPromoted: true,
          status: TASK_STATUSES.ACTIVE,
          expiresAt: { [Op.gt]: new Date() },
          remainingExecutions: { [Op.gt]: 0 },
          authorId: { [Op.ne]: user.id }
        },
        order: [['priority', 'DESC'], ['reward', 'DESC']],
        limit,
        offset
      });

      const totalPages = Math.ceil(count / limit);

      let message = `${EMOJIS.fire} **Топ задания**\n\n`;
      message += `🔥 Промо-размещения с высокими наградами\n\n`;

      if (tasks.length === 0) {
        message += `${EMOJIS.info} Пока нет заданий в топе.`;
      } else {
        tasks.forEach((task, index) => {
          message += `🔥 ${index + 1}. **${task.title}**\n`;
          message += `${task.getTypeIcon()} ${task.getTypeText()}\n`;
          message += `${EMOJIS.money} ${task.reward} GRAM\n`;
          message += `👥 ${task.completedExecutions || 0}/${task.totalExecutions}\n\n`;
        });
      }

      const keyboard = getPaginationKeyboard(page, totalPages, 'earn_top');

      await ctx.editMessageText(message, {
        reply_markup: keyboard,
        parse_mode: 'Markdown'
      });

      await ctx.answerCallbackQuery();
    } catch (error) {
      logger.error('Earn top error:', error);
      await ctx.answerCallbackQuery('Произошла ошибка');
    }
  });

  // Премиум задания
  bot.callbackQuery(/^earn_premium(?:_page_(\d+))?$/, requireAuth, async (ctx) => {
    try {
      const user = ctx.session!.user!;
      const page = parseInt(ctx.match![1] || '1');
      const limit = 5;
      const offset = (page - 1) * limit;

      // Проверяем уровень пользователя
      if (user.getLevel() === 'bronze') {
        await ctx.answerCallbackQuery('💎 Премиум задания доступны с уровня Silver');
        return;
      }

      const { rows: tasks, count } = await Task.findAndCountAll({
        where: {
          minLevel: { [Op.in]: ['gold', 'premium'] },
          status: TASK_STATUSES.ACTIVE,
          expiresAt: { [Op.gt]: new Date() },
          remainingExecutions: { [Op.gt]: 0 },
          authorId: { [Op.ne]: user.id }
        },
        order: [['reward', 'DESC']],
        limit,
        offset
      });

      const totalPages = Math.ceil(count / limit);

      let message = `${EMOJIS.diamond} **Премиум задания**\n\n`;
      message += `Эксклюзивные задания для продвинутых пользователей\n`;
      message += `Требуется уровень Gold или Premium\n\n`;

      if (tasks.length === 0) {
        message += `${EMOJIS.info} Нет доступных премиум заданий.`;
      } else {
        tasks.forEach((task, index) => {
          message += `💎 ${index + 1}. **${task.title}**\n`;
          message += `${task.getTypeIcon()} ${task.getTypeText()}\n`;
          message += `${EMOJIS.money} ${task.reward} GRAM\n`;
          message += `Уровень: ${task.minLevel}\n\n`;
        });
      }

      const keyboard = getPaginationKeyboard(page, totalPages, 'earn_premium');

      await ctx.editMessageText(message, {
        reply_markup: keyboard,
        parse_mode: 'Markdown'
      });

      await ctx.answerCallbackQuery();
    } catch (error) {
      logger.error('Earn premium error:', error);
      await ctx.answerCallbackQuery('Произошла ошибка');
    }
  });