// src/bot/handlers/advertise.ts
import { Bot, Context } from 'grammy';
import { requireAuth } from '../middlewares/auth';
import { logger } from '../../utils/logger';
import { EMOJIS, TASK_TYPES, LIMITS } from '../../utils/constants';
import { getAdvertiseKeyboard, getConfirmKeyboard, getBackKeyboard } from '../keyboards/main';
import { validateTelegramLink, validatePostLink } from '../../utils/validators';
import { Task, User } from '../../database/models';

interface TaskCreationState {
  type?: string;
  title?: string;
  description?: string;
  targetUrl?: string;
  reward?: number;
  totalExecutions?: number;
  isTopPromoted?: boolean;
}

export function setupAdvertiseHandlers(bot: Bot) {

  // Главное меню рекламы
  bot.callbackQuery('advertise', requireAuth, async (ctx) => {
    try {
      const user = ctx.session!.user!;
      
      logger.userAction(user.telegramId, 'advertise_opened');

      const myTasksCount = await Task.count({
        where: { authorId: user.id }
      });

      let message = `${EMOJIS.advertise} **Рекламировать**\n\n`;
      message += `💰 **Ваш баланс:** ${user.balance?.toLocaleString() || 0} GRAM\n`;
      message += `🏆 **Уровень:** ${user.getLevelText()} (комиссия ${user.getCommissionRate() * 100}%)\n`;
      message += `📊 **Создано заданий:** ${myTasksCount}\n\n`;
      message += `Выберите тип задания для создания:`;

      await ctx.editMessageText(message, {
        reply_markup: getAdvertiseKeyboard(),
        parse_mode: 'Markdown'
      });

      await ctx.answerCallbackQuery();
    } catch (error) {
      logger.error('Advertise handler error:', error);
      await ctx.answerCallbackQuery('Произошла ошибка');
    }
  });

  // Создание задания
  bot.callbackQuery('advertise_create', requireAuth, async (ctx) => {
    try {
      const user = ctx.session!.user!;

      let message = `${EMOJIS.advertise} **СОЗДАНИЕ ЗАДАНИЯ**\n\n`;
      message += `💰 Ваш баланс: **${user.balance?.toLocaleString() || 0} GRAM**\n`;
      message += `🏆 Уровень: **${user.getLevelText()}** (комиссия ${user.getCommissionRate() * 100}%)\n\n`;
      message += `Выберите тип задания:\n\n`;

      const keyboard = getBackKeyboard('advertise');
      
      // Добавляем кнопки типов заданий
      keyboard.row()
        .text(`${EMOJIS.channel} Подписка на канал`, 'create_subscribe_channel')
        .text(`${EMOJIS.group} Вступление в группу`, 'create_join_group');
      
      keyboard.row()
        .text(`${EMOJIS.view} Просмотр поста`, 'create_view_post')
        .text(`${EMOJIS.bot} Переход в бота`, 'create_bot_interaction');
        
      keyboard.row()
        .text(`${EMOJIS.reaction} Реакция на пост`, 'create_react_post');

      await ctx.editMessageText(message, {
        reply_markup: keyboard,
        parse_mode: 'Markdown'
      });

      await ctx.answerCallbackQuery();
    } catch (error) {
      logger.error('Advertise create error:', error);
      await ctx.answerCallbackQuery('Произошла ошибка');
    }
  });

  // Обработчики для каждого типа задания
  setupTaskTypeHandlers(bot, 'subscribe_channel', 'подписку на канал', '50-500 GRAM за задание');
  setupTaskTypeHandlers(bot, 'join_group', 'вступление в группу', '75-750 GRAM за задание');
  setupTaskTypeHandlers(bot, 'view_post', 'просмотр поста', '25-200 GRAM за задание');
  setupTaskTypeHandlers(bot, 'bot_interaction', 'переход в бота', '100-1500 GRAM');
  setupTaskTypeHandlers(bot, 'react_post', 'реакцию на пост', '30-150 GRAM за задание');

  // Мои задания
  bot.callbackQuery(/^advertise_my_tasks(?:_page_(\d+))?$/, requireAuth, async (ctx) => {
    try {
      const user = ctx.session!.user!;
      const page = parseInt(ctx.match![1] || '1');
      const limit = 5;
      const offset = (page - 1) * limit;

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
        message += `Создайте первое задание, нажав кнопку ниже.`;
      } else {
        tasks.forEach((task, index) => {
          const progress = task.totalExecutions > 0 
            ? Math.round((task.completedExecutions || 0) / task.totalExecutions * 100)
            : 0;
          
          message += `${index + 1}. **${task.title}**\n`;
          message += `${task.getTypeIcon()} ${task.getStatusIcon()} ${task.reward} GRAM\n`;
          message += `📊 ${progress}% (${task.completedExecutions || 0}/${task.totalExecutions})\n`;
          message += `👀 Просмотры: ${task.views || 0} | 👆 Клики: ${task.clicks || 0}\n\n`;
        });
      }

      const keyboard = getBackKeyboard('advertise');
      
      if (totalPages > 1) {
        keyboard.row();
        if (page > 1) {
          keyboard.text('⬅️', `advertise_my_tasks_page_${page - 1}`);
        }
        keyboard.text(`${page}/${totalPages}`, 'current_page');
        if (page < totalPages) {
          keyboard.text('➡️', `advertise_my_tasks_page_${page + 1}`);
        }
      }

      keyboard.row().text(`${EMOJIS.advertise} Создать задание`, 'advertise_create');

      await ctx.editMessageText(message, {
        reply_markup: keyboard,
        parse_mode: 'Markdown'
      });

      await ctx.answerCallbackQuery();
    } catch (error) {
      logger.error('My tasks error:', error);
      await ctx.answerCallbackQuery('Произошла ошибка');
    }
  });

  // Статистика заданий
  bot.callbackQuery('advertise_stats', requireAuth, async (ctx) => {
    try {
      const user = ctx.session!.user!;

      // Получаем статистику по заданиям пользователя
      const tasks = await Task.findAll({
        where: { authorId: user.id },
        attributes: [
          'id', 'title', 'type', 'reward', 'totalExecutions', 
          'completedExecutions', 'views', 'clicks', 'conversions',
          'spentAmount', 'createdAt'
        ]
      });

      const totalTasks = tasks.length;
      const activeTasks = tasks.filter(t => t.status === 'active').length;
      const completedTasks = tasks.filter(t => t.status === 'completed').length;
      const totalSpent = tasks.reduce((sum, t) => sum + (t.spentAmount || 0), 0);
      const totalViews = tasks.reduce((sum, t) => sum + (t.views || 0), 0);
      const totalClicks = tasks.reduce((sum, t) => sum + (t.clicks || 0), 0);
      const totalConversions = tasks.reduce((sum, t) => sum + (t.conversions || 0), 0);

      let message = `${EMOJIS.stats} **Статистика заданий**\n\n`;
      
      message += `📊 **Общая статистика:**\n`;
      message += `├ Всего заданий: ${totalTasks}\n`;
      message += `├ Активных: ${activeTasks}\n`;
      message += `├ Завершенных: ${completedTasks}\n`;
      message += `└ Потрачено: ${totalSpent.toLocaleString()} GRAM\n\n`;

      message += `👀 **Эффективность:**\n`;
      message += `├ Просмотры: ${totalViews.toLocaleString()}\n`;
      message += `├ Клики: ${totalClicks.toLocaleString()}\n`;
      message += `├ Выполнения: ${totalConversions.toLocaleString()}\n`;
      message += `└ CTR: ${totalViews > 0 ? ((totalClicks / totalViews) * 100).toFixed(1) : 0}%\n\n`;

      if (tasks.length > 0) {
        // Топ-3 задания по конверсии
        const topTasks = tasks
          .filter(t => (t.clicks || 0) > 0)
          .sort((a, b) => ((b.conversions || 0) / (b.clicks || 1)) - ((a.conversions || 0) / (a.clicks || 1)))
          .slice(0, 3);

        if (topTasks.length > 0) {
          message += `🏆 **Лучшие задания:**\n`;
          topTasks.forEach((task, index) => {
            const conversion = task.clicks ? ((task.conversions || 0) / task.clicks * 100) : 0;
            message += `${index + 1}. ${task.title} - ${conversion.toFixed(1)}%\n`;
          });
        }
      }

      const keyboard = getBackKeyboard('advertise')
        .row()
        .text(`${EMOJIS.chart} Детальная аналитика`, 'advertise_analytics')
        .text(`${EMOJIS.advertise} Создать задание`, 'advertise_create');

      await ctx.editMessageText(message, {
        reply_markup: keyboard,
        parse_mode: 'Markdown'
      });

      await ctx.answerCallbackQuery();
    } catch (error) {
      logger.error('Advertise stats error:', error);
      await ctx.answerCallbackQuery('Произошла ошибка');
    }
  });

  logger.info('✅ Advertise handlers configured');
}

// Функция для настройки обработчиков создания заданий каждого типа
function setupTaskTypeHandlers(bot: Bot, taskType: string, typeName: string, rewardRange: string) {
  const stateKey = `creating_${taskType}`;
  
  // Начало создания задания определенного типа
  bot.callbackQuery(`create_${taskType}`, requireAuth, async (ctx) => {
    try {
      const user = ctx.session!.user!;
      
      // Инициализируем состояние создания задания
      const state: TaskCreationState = { type: taskType };
      user.currentState = JSON.stringify({ action: stateKey, data: state });
      await user.save();

      let message = `${getTypeIcon(taskType)} **${typeName.toUpperCase()}**\n\n`;
      message += `👤 **Автор:** ${user.getDisplayName()}\n`;
      message += `💰 **Баланс:** ${user.balance?.toLocaleString() || 0} GRAM\n\n`;
      
      message += `📝 **Шаг 1/6: Ссылка**\n\n`;
      
      if (taskType === 'view_post' || taskType === 'react_post') {
        message += `🔗 Отправьте ссылку на пост в формате:\n`;
        message += `\`https://t.me/channel_name/123\`\n\n`;
      } else if (taskType === 'bot_interaction') {
        message += `🔗 Отправьте ссылку на бота в формате:\n`;
        message += `\`https://t.me/bot_name\` или \`@bot_name\`\n\n`;
      } else {
        message += `🔗 Отправьте ссылку на канал/группу в формате:\n`;
        message += `\`https://t.me/channel_name\` или \`@channel_name\`\n\n`;
      }
      
      message += `💰 **Диапазон наград:** ${rewardRange}`;

      const keyboard = getBackKeyboard('advertise_create');

      await ctx.editMessageText(message, {
        reply_markup: keyboard,
        parse_mode: 'Markdown'
      });

      await ctx.answerCallbackQuery();
    } catch (error) {
      logger.error(`Create ${taskType} error:`, error);
      await ctx.answerCallbackQuery('Произошла ошибка');
    }
  });
}

// Обработка текстовых сообщений для создания заданий
export function setupTaskCreationTextHandlers(bot: Bot) {
  bot.on('message:text', requireAuth, async (ctx, next) => {
    try {
      const user = ctx.session!.user!;
      
      if (!user.currentState?.startsWith('{"action":"creating_')) {
        await next();
        return;
      }

      const stateData = JSON.parse(user.currentState);
      const action = stateData.action;
      const data: TaskCreationState = stateData.data;
      
      if (action.startsWith('creating_')) {
        await handleTaskCreationStep(ctx, user, data);
        return;
      }
      
      await next();
    } catch (error) {
      logger.error('Task creation text handler error:', error);
      await next();
    }
  });
}

async function handleTaskCreationStep(ctx: Context, user: User, data: TaskCreationState) {
  const text = ctx.message!.text!.trim();
  
  try {
    // Определяем текущий шаг
    if (!data.targetUrl) {
      // Шаг 1: Ссылка
      const isPost = data.type === 'view_post' || data.type === 'react_post';
      const validation = isPost ? validatePostLink(text) : validateTelegramLink(text);
      
      if (!validation.isValid) {
        await ctx.reply(`❌ ${validation.error}\n\nПопробуйте еще раз:`);
        return;
      }
      
      data.targetUrl = text;
      await askForTitle(ctx, user, data);
      
    } else if (!data.title) {
      // Шаг 2: Название
      if (text.length < 3 || text.length > LIMITS.MAX_TASK_TITLE) {
        await ctx.reply(`❌ Название должно быть от 3 до ${LIMITS.MAX_TASK_TITLE} символов.\n\nПопробуйте еще раз:`);
        return;
      }
      
      data.title = text;
      await askForDescription(ctx, user, data);
      
    } else if (!data.description) {
      // Шаг 3: Описание
      if (text === '/skip') {
        data.description = '';
      } else if (text.length > LIMITS.MAX_TASK_DESCRIPTION) {
        await ctx.reply(`❌ Описание не должно превышать ${LIMITS.MAX_TASK_DESCRIPTION} символов.\n\nПопробуйте еще раз или отправьте /skip:`);
        return;
      } else {
        data.description = text;
      }
      
      await askForReward(ctx, user, data);
      
    } else if (!data.reward) {
      // Шаг 4: Награда
      const reward = parseInt(text);
      const minReward = getMinReward(data.type!);
      const maxReward = getMaxReward(data.type!);
      
      if (isNaN(reward) || reward < minReward || reward > maxReward) {
        await ctx.reply(`❌ Награда должна быть от ${minReward} до ${maxReward} GRAM.\n\nПопробуйте еще раз:`);
        return;
      }
      
      data.reward = reward;
      await askForExecutions(ctx, user, data);
      
    } else if (!data.totalExecutions) {
      // Шаг 5: Количество выполнений
      const executions = parseInt(text);
      
      if (isNaN(executions) || executions < LIMITS.MIN_TASK_EXECUTIONS || executions > LIMITS.MAX_TASK_EXECUTIONS) {
        await ctx.reply(`❌ Количество должно быть от ${LIMITS.MIN_TASK_EXECUTIONS} до ${LIMITS.MAX_TASK_EXECUTIONS}.\n\nПопробуйте еще раз:`);
        return;
      }
      
      data.totalExecutions = executions;
      await showTaskPreview(ctx, user, data);
    }
    
  } catch (error) {
    logger.error('Handle task creation step error:', error);
    await ctx.reply('Произошла ошибка. Попробуйте начать заново.');
  }
}

async function askForTitle(ctx: Context, user: User, data: TaskCreationState) {
  data.targetUrl = ctx.message!.text!.trim();
  user.currentState = JSON.stringify({ action: `creating_${data.type}`, data });
  await user.save();

  let message = `✅ Ссылка принята!\n\n`;
  message += `📝 **Шаг 2/6: Название задания**\n\n`;
  message += `Придумайте привлекательное название для вашего задания.\n\n`;
  message += `**Примеры:**\n`;
  message += `• "Крипто новости и аналитика"\n`;
  message += `• "Обзоры фильмов и сериалов"\n`;
  message += `• "Игровое сообщество"\n\n`;
  message += `Макс. ${LIMITS.MAX_TASK_TITLE} символов:`;

  await ctx.reply(message, { parse_mode: 'Markdown' });
}

async function askForDescription(ctx: Context, user: User, data: TaskCreationState) {
  data.title = ctx.message!.text!.trim();
  user.currentState = JSON.stringify({ action: `creating_${data.type}`, data });
  await user.save();

  let message = `✅ Название принято!\n\n`;
  message += `📝 **Шаг 3/6: Описание (необязательно)**\n\n`;
  message += `Опишите ваш канал/группу/бота чтобы привлечь больше пользователей.\n\n`;
  message += `**Что можно написать:**\n`;
  message += `• Тематика контента\n`;
  message += `• Частота публикаций\n`;
  message += `• Особенности сообщества\n\n`;
  message += `Макс. ${LIMITS.MAX_TASK_DESCRIPTION} символов или /skip для пропуска:`;

  await ctx.reply(message, { parse_mode: 'Markdown' });
}

async function askForReward(ctx: Context, user: User, data: TaskCreationState) {
  const text = ctx.message!.text!.trim();
  data.description = text === '/skip' ? '' : text;
  user.currentState = JSON.stringify({ action: `creating_${data.type}`, data });
  await user.save();

  const minReward = getMinReward(data.type!);
  const maxReward = getMaxReward(data.type!);

  let message = `✅ Описание сохранено!\n\n`;
  message += `💰 **Шаг 4/6: Награда за выполнение**\n\n`;
  message += `Чем выше награда, тем быстрее выполнят задание.\n\n`;
  message += `**Диапазон:** ${minReward}-${maxReward} GRAM\n`;
  message += `**Рекомендуемое:** ${Math.floor((minReward + maxReward) / 2)} GRAM\n\n`;
  message += `Введите сумму награды:`;

  await ctx.reply(message, { parse_mode: 'Markdown' });
}

async function askForExecutions(ctx: Context, user: User, data: TaskCreationState) {
  data.reward = parseInt(ctx.message!.text!.trim());
  user.currentState = JSON.stringify({ action: `creating_${data.type}`, data });
  await user.save();

  let message = `✅ Награда установлена!\n\n`;
  message += `👥 **Шаг 5/6: Количество выполнений**\n\n`;
  message += `Сколько человек должны выполнить задание?\n\n`;
  message += `**Диапазон:** ${LIMITS.MIN_TASK_EXECUTIONS}-${LIMITS.MAX_TASK_EXECUTIONS}\n`;
  message += `**Популярные:** 50, 100, 250, 500\n\n`;
  message += `Введите количество:`;

  await ctx.reply(message, { parse_mode: 'Markdown' });
}

async function showTaskPreview(ctx: Context, user: User, data: TaskCreationState) {
  data.totalExecutions = parseInt(ctx.message!.text!.trim());
  
  const totalCost = data.reward! * data.totalExecutions!;
  const commission = Math.ceil(totalCost * user.getCommissionRate());
  const finalCost = totalCost + commission;

  let message = `📋 **ПРЕДВАРИТЕЛЬНЫЙ ПРОСМОТР**\n\n`;
  message += `${getTypeIcon(data.type!)} **${data.title}**\n\n`;
  if (data.description) {
    message += `📝 ${data.description}\n\n`;
  }
  message += `🔗 ${data.targetUrl}\n\n`;
  message += `💰 **Параметры:**\n`;
  message += `├ Награда: ${data.reward} GRAM\n`;
  message += `├ Выполнений: ${data.totalExecutions}\n`;
  message += `├ Стоимость наград: ${totalCost.toLocaleString()} GRAM\n`;
  message += `├ Комиссия (${(user.getCommissionRate() * 100)}%): ${commission.toLocaleString()} GRAM\n`;
  message += `└ **Итого: ${finalCost.toLocaleString()} GRAM**\n\n`;
  
  if (user.balance! < finalCost) {
    message += `❌ **Недостаточно средств!**\n`;
    message += `Не хватает: ${(finalCost - user.balance!).toLocaleString()} GRAM\n\n`;
    message += `[💳 Пополнить баланс]`;
  } else {
    message += `✅ Средств достаточно\n`;
    message += `Остаток после создания: ${(user.balance! - finalCost).toLocaleString()} GRAM\n\n`;
    message += `**Дополнительные опции:**`;
  }

  const keyboard = getBackKeyboard('advertise_create');
  
  if (user.balance! >= finalCost) {
    keyboard.row()
      .text('🔥 В топе (+50 GRAM)', `task_preview_top_${JSON.stringify(data).length}`)
      .text('⚡ Обычное размещение', `task_preview_normal_${JSON.stringify(data).length}`);
  } else {
    keyboard.row()
      .text('💳 Пополнить баланс', 'cabinet_deposit');
  }

  // Сохраняем данные для финального создания
  user.currentState = JSON.stringify({ action: 'task_preview', data });
  await user.save();

  await ctx.reply(message, {
    reply_markup: keyboard,
    parse_mode: 'Markdown'
  });
}

// Обработчики финального создания задания
export function setupTaskCreationFinalHandlers(bot: Bot) {
  // Создание обычного задания
  bot.callbackQuery(/^task_preview_normal_(\d+)$/, requireAuth, async (ctx) => {
    try {
      const user = ctx.session!.user!;
      const stateData = JSON.parse(user.currentState || '{}');
      const data: TaskCreationState = stateData.data;

      if (!data || !data.type) {
        await ctx.answerCallbackQuery('Ошибка: данные задания не найдены');
        return;
      }

      await createTask(ctx, user, data, false);
    } catch (error) {
      logger.error('Task creation normal error:', error);
      await ctx.answerCallbackQuery('Произошла ошибка');
    }
  });

  // Создание задания в топе
  bot.callbackQuery(/^task_preview_top_(\d+)$/, requireAuth, async (ctx) => {
    try {
      const user = ctx.session!.user!;
      const stateData = JSON.parse(user.currentState || '{}');
      const data: TaskCreationState = stateData.data;

      if (!data || !data.type) {
        await ctx.answerCallbackQuery('Ошибка: данные задания не найдены');
        return;
      }

      await createTask(ctx, user, data, true);
    } catch (error) {
      logger.error('Task creation top error:', error);
      await ctx.answerCallbackQuery('Произошла ошибка');
    }
  });
}

async function createTask(ctx: Context, user: User, data: TaskCreationState, isTopPromoted: boolean) {
  try {
    const totalCost = data.reward! * data.totalExecutions!;
    const commission = Math.ceil(totalCost * user.getCommissionRate());
    const topCost = isTopPromoted ? 50 : 0;
    const finalCost = totalCost + commission + topCost;

    // Проверяем баланс еще раз
    if (user.balance! < finalCost) {
      await ctx.answerCallbackQuery('❌ Недостаточно средств');
      return;
    }

    // Создаем задание
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 дней

    const task = await Task.create({
      authorId: user.id,
      type: data.type!,
      title: data.title!,
      description: data.description || undefined,
      targetUrl: data.targetUrl!,
      reward: data.reward!,
      totalExecutions: data.totalExecutions!,
      remainingExecutions: data.totalExecutions!,
      autoCheck: data.type !== TASK_TYPES.BOT_INTERACTION,
      requireScreenshot: data.type === TASK_TYPES.BOT_INTERACTION,
      isTopPromoted,
      totalCost: finalCost,
      frozenAmount: totalCost,
      expiresAt
    });

    // Списываем средства с баланса
    await user.updateBalance(finalCost, 'subtract');

    // Создаем транзакцию
    const { Transaction } = await import('../../database/models');
    await Transaction.createTaskPayment(
      user.id,
      task.id,
      finalCost,
      user.balance! + finalCost
    );

    // Очищаем состояние пользователя
    user.currentState = null;
    await user.save();

    let message = `✅ **ЗАДАНИЕ СОЗДАНО!**\n\n`;
    message += `${task.getTypeIcon()} ${task.title}\n`;
    message += `💰 ${task.reward} GRAM за выполнение\n`;
    message += `👥 Цель: ${task.totalExecutions} ${getExecutionsWord(task.totalExecutions)}\n`;
    message += `⏰ Активно до: ${task.expiresAt.toLocaleDateString('ru-RU')}\n\n`;
    
    message += `📊 **Параметры:**\n`;
    message += `├ ID задания: #${task.id}\n`;
    message += `├ Статус: Активное ${isTopPromoted ? '🔥' : ''}\n`;
    message += `├ Потрачено: ${finalCost.toLocaleString()} GRAM\n`;
    message += `└ Остаток баланса: ${user.balance!.toLocaleString()} GRAM\n\n`;
    
    message += `🚀 Ваше задание уже показывается пользователям!`;

    const keyboard = getBackKeyboard('advertise')
      .row()
      .text('📊 Статистика задания', `task_stats_${task.id}`)
      .text('📢 Создать еще', 'advertise_create');

    await ctx.editMessageText(message, {
      reply_markup: keyboard,
      parse_mode: 'Markdown'
    });

    await ctx.answerCallbackQuery('🎉 Задание успешно создано!');

    logger.userAction(user.telegramId, 'task_created', {
      taskId: task.id,
      type: task.type,
      reward: task.reward,
      totalExecutions: task.totalExecutions,
      cost: finalCost,
      isTopPromoted
    });

  } catch (error) {
    logger.error('Create task error:', error);
    await ctx.answerCallbackQuery('Произошла ошибка при создании задания');
  }
}

// Вспомогательные функции
function getTypeIcon(taskType: string): string {
  switch (taskType) {
    case 'subscribe_channel': return EMOJIS.channel;
    case 'join_group': return EMOJIS.group;
    case 'view_post': return EMOJIS.view;
    case 'bot_interaction': return EMOJIS.bot;
    case 'react_post': return EMOJIS.reaction;
    default: return EMOJIS.advertise;
  }
}

function getMinReward(taskType: string): number {
  switch (taskType) {
    case 'subscribe_channel': return 50;
    case 'join_group': return 75;
    case 'view_post': return 25;
    case 'bot_interaction': return 100;
    case 'react_post': return 30;
    default: return 50;
  }
}

function getMaxReward(taskType: string): number {
  switch (taskType) {
    case 'subscribe_channel': return 500;
    case 'join_group': return 750;
    case 'view_post': return 200;
    case 'bot_interaction': return 1500;
    case 'react_post': return 150;
    default: return 500;
  }
}

function getExecutionsWord(count: number): string {
  const lastDigit = count % 10;
  const lastTwoDigits = count % 100;
  
  if (lastTwoDigits >= 11 && lastTwoDigits <= 19) {
    return 'выполнений';
  }
  
  switch (lastDigit) {
    case 1: return 'выполнение';
    case 2:
    case 3:
    case 4: return 'выполнения';
    default: return 'выполнений';
  }
}