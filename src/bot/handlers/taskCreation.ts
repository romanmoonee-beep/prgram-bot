// src/bot/handlers/taskCreationFixed.ts - ИСПРАВЛЕННОЕ СОЗДАНИЕ ЗАДАНИЙ
import { Bot, Context } from 'grammy';
import { requireAuth } from '../middlewares/auth';
import { logger } from '../../utils/logger';
import { EMOJIS } from '../../utils/constants';
import { User, Task } from '../../database/models';

// Валидация Telegram ссылки
function validateTelegramLink(url: string): { isValid: boolean; error?: string } {
  if (!url || typeof url !== 'string') {
    return { isValid: false, error: 'Ссылка не может быть пустой' };
  }

  const trimmedUrl = url.trim();
  
  if (!trimmedUrl.startsWith('https://t.me/')) {
    return { isValid: false, error: 'Ссылка должна начинаться с https://t.me/' };
  }

  // Проверка на канал/группу
  const channelMatch = trimmedUrl.match(/^https:\/\/t\.me\/([a-zA-Z0-9_]{5,32})$/);
  if (channelMatch) {
    return { isValid: true };
  }

  // Проверка на пост
  const postMatch = trimmedUrl.match(/^https:\/\/t\.me\/([a-zA-Z0-9_]{5,32})\/(\d+)$/);
  if (postMatch) {
    return { isValid: true };
  }

  // Проверка на бота
  const botMatch = trimmedUrl.match(/^https:\/\/t\.me\/([a-zA-Z0-9_]{5,32}bot)$/);
  if (botMatch) {
    return { isValid: true };
  }

  return { 
    isValid: false, 
    error: 'Неверный формат ссылки. Используйте: https://t.me/channel_name или https://t.me/channel/123' 
  };
}

// Валидация для постов
function validatePostLink(url: string): { isValid: boolean; error?: string } {
  if (!url || typeof url !== 'string') {
    return { isValid: false, error: 'Ссылка не может быть пустой' };
  }

  const trimmedUrl = url.trim();
  
  if (!trimmedUrl.startsWith('https://t.me/')) {
    return { isValid: false, error: 'Ссылка должна начинаться с https://t.me/' };
  }

  // Проверка на пост (обязательно с номером сообщения)
  const postMatch = trimmedUrl.match(/^https:\/\/t\.me\/([a-zA-Z0-9_]{5,32})\/(\d+)$/);
  if (postMatch) {
    return { isValid: true };
  }

  return { 
    isValid: false, 
    error: 'Ссылка на пост должна содержать номер сообщения: https://t.me/channel_name/123' 
  };
}

export function setupTaskCreationHandlers(bot: Bot) {
  // Обработка текстовых сообщений для создания заданий
  bot.on('message:text', requireAuth, async (ctx, next) => {
    try {
      const user = ctx.session!.user!;
      
      if (!user.currentState) {
        await next();
        return;
      }

      let stateData;
      try {
        stateData = JSON.parse(user.currentState);
      } catch {
        // Если не можем распарсить состояние, очищаем его
        user.currentState = null;
        await user.save();
        await next();
        return;
      }

      const action = stateData.action;
      const data = stateData.data || {};
      
      if (!action || !action.startsWith('creating_')) {
        await next();
        return;
      }

      await handleTaskCreationStep(ctx, user, action, data);
      return;
      
    } catch (error) {
      logger.error('Task creation text handler error:', error);
      await next();
    }
  });
}

async function handleTaskCreationStep(ctx: Context, user: User, action: string, data: any) {
  const text = ctx.message!.text!.trim();
  
  try {
    // Определяем текущий шаг
    if (!data.targetUrl) {
      // Шаг 1: Ссылка
      const isPost = action.includes('view_post') || action.includes('react_post');
      const validation = isPost ? validatePostLink(text) : validateTelegramLink(text);
      
      if (!validation.isValid) {
        await ctx.reply(`❌ ${validation.error}\n\nПопробуйте еще раз:`, {
          reply_markup: {
            inline_keyboard: [
              [{ text: '❌ Отмена', callback_data: 'cancel' }]
            ]
          }
        });
        return;
      }
      
      data.targetUrl = text;
      await askForTitle(ctx, user, action, data);
      
    } else if (!data.title) {
      // Шаг 2: Название
      if (text.length < 3 || text.length > 100) {
        await ctx.reply(`❌ Название должно быть от 3 до 100 символов.\n\nПопробуйте еще раз:`, {
          reply_markup: {
            inline_keyboard: [
              [{ text: '❌ Отмена', callback_data: 'cancel' }]
            ]
          }
        });
        return;
      }
      
      data.title = text;
      await askForDescription(ctx, user, action, data);
      
    } else if (!data.hasOwnProperty('description')) {
      // Шаг 3: Описание
      if (text === '/skip') {
        data.description = '';
      } else if (text.length > 500) {
        await ctx.reply(`❌ Описание не должно превышать 500 символов.\n\nПопробуйте еще раз или отправьте /skip:`, {
          reply_markup: {
            inline_keyboard: [
              [
                { text: '/skip Пропустить', callback_data: 'skip_description' },
                { text: '❌ Отмена', callback_data: 'cancel' }
              ]
            ]
          }
        });
        return;
      } else {
        data.description = text;
      }
      
      await askForReward(ctx, user, action, data);
      
    } else if (!data.reward) {
      // Шаг 4: Награда
      const reward = parseInt(text);
      const { minReward, maxReward } = getRewardLimits(getTaskTypeFromAction(action));
      
      if (isNaN(reward) || reward < minReward || reward > maxReward) {
        await ctx.reply(`❌ Награда должна быть от ${minReward} до ${maxReward} GRAM.\n\nПопробуйте еще раз:`, {
          reply_markup: {
            inline_keyboard: [
              [{ text: '❌ Отмена', callback_data: 'cancel' }]
            ]
          }
        });
        return;
      }
      
      data.reward = reward;
      await askForExecutions(ctx, user, action, data);
      
    } else if (!data.totalExecutions) {
      // Шаг 5: Количество выполнений
      const executions = parseInt(text);
      
      if (isNaN(executions) || executions < 5 || executions > 1000) {
        await ctx.reply(`❌ Количество должно быть от 5 до 1000.\n\nПопробуйте еще раз:`, {
          reply_markup: {
            inline_keyboard: [
              [{ text: '❌ Отмена', callback_data: 'cancel' }]
            ]
          }
        });
        return;
      }
      
      data.totalExecutions = executions;
      await showTaskPreview(ctx, user, action, data);
    }
    
  } catch (error) {
    logger.error('Handle task creation step error:', error);
    await ctx.reply('❌ Произошла ошибка. Попробуйте начать заново.', {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🏠 Главное меню', callback_data: 'main_menu' }]
        ]
      }
    });
  }
}

async function askForTitle(ctx: Context, user: User, action: string, data: any) {
  user.currentState = JSON.stringify({ action, data });
  await user.save();

  let message = `✅ Ссылка принята!\n\n`;
  message += `📝 **Шаг 2/5: Название задания**\n\n`;
  message += `Придумайте привлекательное название для вашего задания.\n\n`;
  message += `**Примеры:**\n`;
  message += `• "Крипто новости и аналитика"\n`;
  message += `• "Обзоры фильмов и сериалов"\n`;
  message += `• "Игровое сообщество"\n\n`;
  message += `Максимум 100 символов:`;

  await ctx.reply(message, { 
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: '❌ Отмена', callback_data: 'cancel' }]
      ]
    }
  });
}

async function askForDescription(ctx: Context, user: User, action: string, data: any) {
  user.currentState = JSON.stringify({ action, data });
  await user.save();

  let message = `✅ Название принято!\n\n`;
  message += `📝 **Шаг 3/5: Описание (необязательно)**\n\n`;
  message += `Опишите ваш канал/группу/бота чтобы привлечь больше пользователей.\n\n`;
  message += `**Что можно написать:**\n`;
  message += `• Тематика контента\n`;
  message += `• Частота публикаций\n`;
  message += `• Особенности сообщества\n\n`;
  message += `Максимум 500 символов или /skip для пропуска:`;

  await ctx.reply(message, { 
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [
          { text: '/skip Пропустить', callback_data: 'skip_description' },
          { text: '❌ Отмена', callback_data: 'cancel' }
        ]
      ]
    }
  });
}

async function askForReward(ctx: Context, user: User, action: string, data: any) {
  user.currentState = JSON.stringify({ action, data });
  await user.save();

  const taskType = getTaskTypeFromAction(action);
  const { minReward, maxReward } = getRewardLimits(taskType);

  let message = `✅ Описание сохранено!\n\n`;
  message += `💰 **Шаг 4/5: Награда за выполнение**\n\n`;
  message += `Чем выше награда, тем быстрее выполнят задание.\n\n`;
  message += `**Диапазон:** ${minReward}-${maxReward} GRAM\n`;
  message += `**Рекомендуемое:** ${Math.floor((minReward + maxReward) / 2)} GRAM\n\n`;
  message += `Введите сумму награды:`;

  await ctx.reply(message, { 
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: '❌ Отмена', callback_data: 'cancel' }]
      ]
    }
  });
}

async function askForExecutions(ctx: Context, user: User, action: string, data: any) {
  user.currentState = JSON.stringify({ action, data });
  await user.save();

  let message = `✅ Награда установлена!\n\n`;
  message += `👥 **Шаг 5/5: Количество выполнений**\n\n`;
  message += `Сколько человек должны выполнить задание?\n\n`;
  message += `**Диапазон:** 5-1000\n`;
  message += `**Популярные:** 25, 50, 100, 250\n\n`;
  message += `Введите количество:`;

  await ctx.reply(message, { 
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: '❌ Отмена', callback_data: 'cancel' }]
      ]
    }
  });
}

async function showTaskPreview(ctx: Context, user: User, action: string, data: any) {
  const taskType = getTaskTypeFromAction(action);
  const totalCost = data.reward * data.totalExecutions;
  const commission = Math.ceil(totalCost * user.getCommissionRate());
  const finalCost = totalCost + commission;

  let message = `📋 **ПРЕДВАРИТЕЛЬНЫЙ ПРОСМОТР**\n\n`;
  message += `${getTaskTypeIcon(taskType)} **${data.title}**\n\n`;
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
    message += `Не хватает: ${(finalCost - user.balance!).toLocaleString()} GRAM`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: '💳 Пополнить баланс', callback_data: 'cabinet_deposit' }
        ],
        [
          { text: '❌ Отмена', callback_data: 'cancel' }
        ]
      ]
    };

    user.currentState = null;
    await user.save();

    await ctx.reply(message, {
      reply_markup: keyboard,
      parse_mode: 'Markdown'
    });
  } else {
    message += `✅ Средств достаточно\n`;
    message += `Остаток после создания: ${(user.balance! - finalCost).toLocaleString()} GRAM`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: '🔥 В топе (+50 GRAM)', callback_data: `create_task_top` },
          { text: '⚡ Обычное размещение', callback_data: `create_task_normal` }
        ],
        [
          { text: '❌ Отмена', callback_data: 'cancel' }
        ]
      ]
    };

    // Сохраняем финальные данные
    data.taskType = taskType;
    data.finalCost = finalCost;
    data.commission = commission;
    user.currentState = JSON.stringify({ action: 'task_preview', data });
    await user.save();

    await ctx.reply(message, {
      reply_markup: keyboard,
      parse_mode: 'Markdown'
    });
  }
}

// Обработчик кнопки пропуска описания
export function setupSkipDescriptionHandler(bot: Bot) {
  bot.callbackQuery('skip_description', requireAuth, async (ctx) => {
    try {
      const user = ctx.session!.user!;
      
      if (!user.currentState) {
        await ctx.answerCallbackQuery('❌ Состояние не найдено');
        return;
      }

      const stateData = JSON.parse(user.currentState);
      const data = stateData.data;
      data.description = '';

      await askForReward(ctx, user, stateData.action, data);
      await ctx.answerCallbackQuery('✅ Описание пропущено');
    } catch (error) {
      logger.error('Skip description error:', error);
      await ctx.answerCallbackQuery('❌ Произошла ошибка');
    }
  });
}

// Обработчики создания задания
export function setupTaskCreationFinalHandlers(bot: Bot) {
  // Создание обычного задания
  bot.callbackQuery('create_task_normal', requireAuth, async (ctx) => {
    await createTaskFinal(ctx, false);
  });

  // Создание задания в топе
  bot.callbackQuery('create_task_top', requireAuth, async (ctx) => {
    await createTaskFinal(ctx, true);
  });
}

async function createTaskFinal(ctx: any, isTopPromoted: boolean) {
  try {
    const user = ctx.session!.user!;
    
    if (!user.currentState) {
      await ctx.answerCallbackQuery('❌ Данные задания не найдены');
      return;
    }

    const stateData = JSON.parse(user.currentState);
    const data = stateData.data;

    if (!data || !data.taskType) {
      await ctx.answerCallbackQuery('❌ Ошибка: данные задания не найдены');
      return;
    }

    const topCost = isTopPromoted ? 50 : 0;
    const totalCostWithTop = data.finalCost + topCost;

    // Проверяем баланс еще раз
    if (user.balance! < totalCostWithTop) {
      await ctx.answerCallbackQuery('❌ Недостаточно средств');
      return;
    }

    // Создаем задание
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 дней

    const task = await Task.create({
      authorId: user.id,
      type: data.taskType,
      title: data.title,
      description: data.description || null,
      targetUrl: data.targetUrl,
      reward: data.reward,
      totalExecutions: data.totalExecutions,
      remainingExecutions: data.totalExecutions,
      completedExecutions: 0,
      autoCheck: data.taskType !== 'bot_interaction',
      requireScreenshot: data.taskType === 'bot_interaction',
      isTopPromoted,
      totalCost: totalCostWithTop,
      frozenAmount: data.finalCost,
      spentAmount: 0,
      status: 'active',
      views: 0,
      clicks: 0,
      conversions: 0,
      expiresAt,
      priority: isTopPromoted ? 10 : 5
    });

    // Списываем средства с баланса
    await user.updateBalance(totalCostWithTop, 'subtract');

    // Очищаем состояние пользователя
    user.currentState = null;
    await user.save();

    let message = `✅ **ЗАДАНИЕ СОЗДАНО!**\n\n`;
    message += `${getTaskTypeIcon(data.taskType)} ${data.title}\n`;
    message += `💰 ${data.reward} GRAM за выполнение\n`;
    message += `👥 Цель: ${data.totalExecutions} выполнений\n`;
    message += `⏰ Активно до: ${expiresAt.toLocaleDateString('ru-RU')}\n\n`;
    
    message += `📊 **Параметры:**\n`;
    message += `├ ID задания: #${task.id}\n`;
    message += `├ Статус: Активное ${isTopPromoted ? '🔥' : ''}\n`;
    message += `├ Потрачено: ${totalCostWithTop.toLocaleString()} GRAM\n`;
    message += `└ Остаток баланса: ${user.balance!.toLocaleString()} GRAM\n\n`;
    
    message += `🚀 Ваше задание уже показывается пользователям!`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: '📊 Статистика задания', callback_data: `task_manage_stats_${task.id}` },
          { text: '📢 Создать еще', callback_data: 'advertise_create' }
        ],
        [
          { text: '📋 Мои задания', callback_data: 'advertise_my_tasks' },
          { text: '🏠 Главное меню', callback_data: 'main_menu' }
        ]
      ]
    };

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
      cost: totalCostWithTop,
      isTopPromoted
    });

  } catch (error) {
    logger.error('Create task final error:', error);
    await ctx.answerCallbackQuery('❌ Произошла ошибка при создании задания');
  }
}

// Вспомогательные функции
function getTaskTypeFromAction(action: string): string {
  if (action.includes('subscribe_channel')) return 'subscribe_channel';
  if (action.includes('join_group')) return 'join_group';
  if (action.includes('view_post')) return 'view_post';
  if (action.includes('bot_interaction')) return 'bot_interaction';
  if (action.includes('react_post')) return 'react_post';
  return 'subscribe_channel';
}

function getRewardLimits(taskType: string): { minReward: number; maxReward: number } {
  switch (taskType) {
    case 'subscribe_channel': return { minReward: 50, maxReward: 500 };
    case 'join_group': return { minReward: 75, maxReward: 750 };
    case 'view_post': return { minReward: 25, maxReward: 200 };
    case 'bot_interaction': return { minReward: 100, maxReward: 1500 };
    case 'react_post': return { minReward: 30, maxReward: 150 };
    default: return { minReward: 50, maxReward: 500 };
  }
}

function getTaskTypeIcon(taskType: string): string {
  switch (taskType) {
    case 'subscribe_channel': return EMOJIS.channel;
    case 'join_group': return EMOJIS.group;
    case 'view_post': return EMOJIS.view;
    case 'bot_interaction': return EMOJIS.bot;
    case 'react_post': return EMOJIS.reaction;
    default: return EMOJIS.advertise;
  }
}