// src/bot/handlers/taskHandlers.ts - ИСПРАВЛЕННЫЕ ОБРАБОТЧИКИ
import { Bot, Context } from 'grammy';
import { requireAuth } from '../middlewares/auth';
import { logger } from '../../utils/logger';
import { EMOJIS, TASK_TYPES, TASK_STATUSES } from '../../utils/constants';
import { Task, TaskExecution, User } from '../../database/models';
import { Op } from 'sequelize';

// Исправленный обработчик для earn_channels
export function setupEarnChannelsHandler(bot: Bot) {
  bot.callbackQuery(/^earn_channels(?:_page_(\d+))?$/, requireAuth, async (ctx) => {
    try {
      const user = ctx.session!.user!;
      const page = parseInt(ctx.match![1] || '1');
      const limit = 5;
      const offset = (page - 1) * limit;

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
        
        const keyboard = {
          inline_keyboard: [
            [
              { text: `${EMOJIS.fire} Топ задания`, callback_data: 'earn_top' },
              { text: `${EMOJIS.diamond} Премиум`, callback_data: 'earn_premium' }
            ],
            [{ text: `${EMOJIS.home} Главное меню`, callback_data: 'main_menu' }]
          ]
        };

        await ctx.editMessageText(message, {
          reply_markup: keyboard,
          parse_mode: 'Markdown'
        });
      } else {
        // Создаем кнопки для каждого задания
        const keyboard = { inline_keyboard: [] as any[] };
        
        tasks.forEach((task, index) => {
          message += `${index + 1}. **${task.title}**\n`;
          message += `${EMOJIS.money} ${task.reward} GRAM\n`;
          message += `👥 ${task.completedExecutions || 0}/${task.totalExecutions}\n`;
          message += `⏱️ ${formatTimeRemaining(task.expiresAt)}\n\n`;

          // Добавляем кнопку для каждого задания
          keyboard.inline_keyboard.push([
            { text: `📋 ${task.title} - ${task.reward} GRAM`, callback_data: `task_${task.id}` }
          ]);
        });

        // Добавляем пагинацию если нужно
        if (totalPages > 1) {
          const paginationRow = [];
          if (page > 1) {
            paginationRow.push({ text: '⬅️', callback_data: `earn_channels_page_${page - 1}` });
          }
          paginationRow.push({ text: `${page}/${totalPages}`, callback_data: 'current_page' });
          if (page < totalPages) {
            paginationRow.push({ text: '➡️', callback_data: `earn_channels_page_${page + 1}` });
          }
          keyboard.inline_keyboard.push(paginationRow);
        }

        // Дополнительные кнопки
        keyboard.inline_keyboard.push([
          { text: `${EMOJIS.fire} Топ задания`, callback_data: 'earn_top' },
          { text: `${EMOJIS.diamond} Премиум`, callback_data: 'earn_premium' }
        ]);
        
        keyboard.inline_keyboard.push([
          { text: `${EMOJIS.back} К заработку`, callback_data: 'earn' }
        ]);

        await ctx.editMessageText(message, {
          reply_markup: keyboard,
          parse_mode: 'Markdown'
        });
      }

      await ctx.answerCallbackQuery();
    } catch (error) {
      logger.error('Earn channels error:', error);
      await ctx.answerCallbackQuery('Произошла ошибка');
    }
  });
}

// Исправленный обработчик просмотра задания
export function setupTaskViewHandler(bot: Bot) {
  bot.callbackQuery(/^task_(\d+)$/, requireAuth, async (ctx) => {
    try {
      const taskId = parseInt(ctx.match![1]);
      const user = ctx.session!.user!;

      const task = await Task.findByPk(taskId, {
        include: [{ model: User, as: 'author', attributes: ['username', 'firstName'] }]
      });

      if (!task) {
        await ctx.answerCallbackQuery('❌ Задание не найдено');
        return;
      }

      // Проверяем, может ли пользователь выполнить задание
      const canExecute = await checkCanUserExecuteTask(task, user);
      if (!canExecute.canExecute) {
        await ctx.answerCallbackQuery(`❌ ${canExecute.reason}`);
        return;
      }

      // Увеличиваем счетчик просмотров
      await task.increment('views');

      let message = `${getTaskTypeIcon(task.type)} **${task.title}**\n\n`;
      
      if (task.description) {
        message += `📋 **Описание:**\n${task.description}\n\n`;
      }

      message += `💰 **Награда:** ${task.reward} GRAM\n`;
      message += `⏱️ **Осталось:** ${formatTimeRemaining(task.expiresAt)}\n`;
      message += `👥 **Выполнили:** ${task.completedExecutions || 0}/${task.totalExecutions}\n`;
      message += `👀 **Просмотры:** ${task.views || 0}\n\n`;

      // Инструкция в зависимости от типа задания
      message += getTaskInstructions(task.type);

      const keyboard = {
        inline_keyboard: [
          [
            { text: `🔗 ${getActionButtonText(task.type)}`, url: task.targetUrl }
          ],
          [
            { text: '✅ Проверить выполнение', callback_data: `task_check_${taskId}` }
          ],
          [
            { text: '📊 Статистика задания', callback_data: `task_stats_${taskId}` },
            { text: '⚠️ Пожаловаться', callback_data: `task_report_${taskId}` }
          ],
          [
            { text: `${EMOJIS.back} К заданиям`, callback_data: getBackToTasksCallback(task.type) }
          ]
        ]
      };

      await ctx.editMessageText(message, {
        reply_markup: keyboard,
        parse_mode: 'Markdown'
      });

      await ctx.answerCallbackQuery();
    } catch (error) {
      logger.error('Task view error:', error);
      await ctx.answerCallbackQuery('Произошла ошибка');
    }
  });
}

// Обработчик проверки задания
export function setupTaskCheckHandler(bot: Bot) {
  bot.callbackQuery(/^task_check_(\d+)$/, requireAuth, async (ctx) => {
    try {
      const taskId = parseInt(ctx.match![1]);
      const user = ctx.session!.user!;

      const task = await Task.findByPk(taskId);
      if (!task || task.status !== 'active') {
        await ctx.answerCallbackQuery('❌ Задание недоступно');
        return;
      }

      // Проверяем, не выполнял ли уже это задание
      const existingExecution = await TaskExecution.findOne({
        where: { taskId, userId: user.id }
      });

      if (existingExecution) {
        let status = '';
        switch (existingExecution.status) {
          case 'completed':
            status = 'выполнено';
            break;
          case 'in_review':
            status = 'на проверке';
            break;
          case 'rejected':
            status = 'отклонено';
            break;
          default:
            status = 'в обработке';
        }
        await ctx.answerCallbackQuery(`⚠️ Задание уже ${status}`);
        return;
      }

      // Увеличиваем счетчик кликов
      await task.increment('clicks');

      // Рассчитываем награду с множителем пользователя
      const rewardAmount = Math.floor(task.reward * user.getEarnMultiplier());

      // Создаем запись о выполнении
      const execution = await TaskExecution.create({
        taskId,
        userId: user.id,
        rewardAmount,
        status: 'pending'
      });

      // Отправляем на автопроверку или ручную проверку
      if (task.autoCheck && task.type !== 'bot_interaction') {
        // Для автопроверки - имитируем успешную проверку через 3 секунды
        setTimeout(async () => {
          try {
            await execution.update({ status: 'completed' });
            
            // Начисляем награду
            await user.updateBalance(rewardAmount, 'add');
            
            // Обновляем статистику задания
            await task.increment('completedExecutions');
            await task.decrement('remainingExecutions');
            
            // Уведомляем пользователя
            try {
              await ctx.api.sendMessage(
                user.telegramId,
                `✅ **Задание выполнено!**\n\n` +
                `${getTaskTypeIcon(task.type)} ${task.title}\n` +
                `💰 Получено: ${rewardAmount} GRAM\n` +
                `💳 Новый баланс: ${user.balance} GRAM`,
                { parse_mode: 'Markdown' }
              );
            } catch (notifyError) {
              logger.warn('Failed to notify user about task completion:', notifyError);
            }
          } catch (autoCheckError) {
            logger.error('Auto-check error:', autoCheckError);
          }
        }, 3000);
      } else {
        // Для ручной проверки - обновляем статус
        await execution.update({ status: 'in_review' });
      }

      let message = `⏳ **ЗАДАНИЕ ОТПРАВЛЕНО НА ПРОВЕРКУ**\n\n`;
      message += `${getTaskTypeIcon(task.type)} ${task.title}\n`;
      message += `💰 К получению: ${rewardAmount} GRAM\n\n`;
      
      if (task.autoCheck && task.type !== 'bot_interaction') {
        message += `🔍 Автоматическая проверка...\n`;
        message += `⏰ Результат появится через несколько секунд`;
      } else {
        message += `👨‍💼 Требуется проверка автором задания\n`;
        message += `⏰ Результат появится в течение 24 часов`;
      }

      const keyboard = {
        inline_keyboard: [
          [
            { text: '💰 Другие задания', callback_data: 'earn' },
            { text: '📊 Мой кабинет', callback_data: 'cabinet' }
          ],
          [
            { text: `${EMOJIS.home} Главное меню`, callback_data: 'main_menu' }
          ]
        ]
      };

      await ctx.editMessageText(message, {
        reply_markup: keyboard,
        parse_mode: 'Markdown'
      });

      await ctx.answerCallbackQuery('⏳ Задание отправлено на проверку');

      logger.userAction(user.telegramId, 'task_submitted', { taskId, executionId: execution.id });
    } catch (error) {
      logger.error('Task check error:', error);
      await ctx.answerCallbackQuery('❌ Произошла ошибка при проверке');
    }
  });
}

// Исправленный обработчик управления заданиями
export function setupTaskManagementHandler(bot: Bot) {
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
        
        const keyboard = {
          inline_keyboard: [
            [
              { text: `${EMOJIS.advertise} Создать задание`, callback_data: 'advertise_create' }
            ],
            [
              { text: `${EMOJIS.back} К рекламе`, callback_data: 'advertise' }
            ]
          ]
        };

        await ctx.editMessageText(message, {
          reply_markup: keyboard,
          parse_mode: 'Markdown'
        });
      } else {
        const keyboard = { inline_keyboard: [] as any[] };
        
        tasks.forEach((task, index) => {
          const progress = task.totalExecutions > 0 
            ? Math.round((task.completedExecutions || 0) / task.totalExecutions * 100)
            : 0;
          
          message += `${index + 1}. **${task.title}**\n`;
          message += `${getTaskTypeIcon(task.type)} ${getTaskStatusIcon(task.status)} ${task.reward} GRAM\n`;
          message += `📊 ${progress}% (${task.completedExecutions || 0}/${task.totalExecutions})\n`;
          message += `👀 Просмотры: ${task.views || 0} | 👆 Клики: ${task.clicks || 0}\n\n`;

          // Добавляем кнопки управления для каждого задания
          const taskRow = [
            { text: `📊 Статистика`, callback_data: `task_manage_stats_${task.id}` },
            { text: `⚙️ Управление`, callback_data: `task_manage_${task.id}` }
          ];
          keyboard.inline_keyboard.push(taskRow);
        });

        // Пагинация
        if (totalPages > 1) {
          const paginationRow = [];
          if (page > 1) {
            paginationRow.push({ text: '⬅️', callback_data: `advertise_my_tasks_page_${page - 1}` });
          }
          paginationRow.push({ text: `${page}/${totalPages}`, callback_data: 'current_page' });
          if (page < totalPages) {
            paginationRow.push({ text: '➡️', callback_data: `advertise_my_tasks_page_${page + 1}` });
          }
          keyboard.inline_keyboard.push(paginationRow);
        }

        // Дополнительные кнопки
        keyboard.inline_keyboard.push([
          { text: `${EMOJIS.advertise} Создать задание`, callback_data: 'advertise_create' },
          { text: `${EMOJIS.stats} Общая статистика`, callback_data: 'advertise_stats' }
        ]);
        
        keyboard.inline_keyboard.push([
          { text: `${EMOJIS.back} К рекламе`, callback_data: 'advertise' }
        ]);

        await ctx.editMessageText(message, {
          reply_markup: keyboard,
          parse_mode: 'Markdown'
        });
      }

      await ctx.answerCallbackQuery();
    } catch (error) {
      logger.error('My tasks error:', error);
      await ctx.answerCallbackQuery('Произошла ошибка');
    }
  });
}

// Обработчик управления конкретным заданием
export function setupTaskManageHandler(bot: Bot) {
  bot.callbackQuery(/^task_manage_(\d+)$/, requireAuth, async (ctx) => {
    try {
      const taskId = parseInt(ctx.match![1]);
      const user = ctx.session!.user!;

      const task = await Task.findOne({
        where: { id: taskId, authorId: user.id }
      });

      if (!task) {
        await ctx.answerCallbackQuery('❌ Задание не найдено');
        return;
      }

      const progress = task.totalExecutions > 0 
        ? Math.round((task.completedExecutions || 0) / task.totalExecutions * 100)
        : 0;

      let message = `⚙️ **УПРАВЛЕНИЕ ЗАДАНИЕМ**\n\n`;
      message += `${getTaskTypeIcon(task.type)} **${task.title}**\n`;
      message += `📊 Статус: ${getTaskStatusText(task.status)} ${getTaskStatusIcon(task.status)}\n`;
      message += `💰 Награда: ${task.reward} GRAM\n`;
      message += `📈 Прогресс: ${progress}% (${task.completedExecutions || 0}/${task.totalExecutions})\n`;
      message += `👀 Просмотры: ${task.views || 0}\n`;
      message += `👆 Клики: ${task.clicks || 0}\n`;
      message += `✅ Выполнения: ${task.conversions || 0}\n`;
      message += `⏰ Истекает: ${formatTimeRemaining(task.expiresAt)}\n\n`;
      
      if (task.status === 'active') {
        message += `🔥 Задание активно и показывается пользователям`;
      } else if (task.status === 'paused') {
        message += `⏸️ Задание приостановлено`;
      } else if (task.status === 'completed') {
        message += `✅ Задание завершено`;
      }

      const keyboard = {
        inline_keyboard: [
          [
            { text: '📊 Детальная статистика', callback_data: `task_detailed_stats_${taskId}` },
            { text: '📈 Аналитика', callback_data: `task_analytics_${taskId}` }
          ],
          [
            { text: '⚙️ Настройки', callback_data: `task_settings_${taskId}` },
            { text: '🔥 В топ (+50 GRAM)', callback_data: `task_promote_${taskId}` }
          ]
        ]
      };

      if (task.status === 'active') {
        keyboard.inline_keyboard.push([
          { text: '⏸️ Приостановить', callback_data: `task_pause_${taskId}` },
          { text: '🔚 Завершить', callback_data: `task_complete_${taskId}` }
        ]);
      } else if (task.status === 'paused') {
        keyboard.inline_keyboard.push([
          { text: '▶️ Возобновить', callback_data: `task_resume_${taskId}` },
          { text: '🔚 Завершить', callback_data: `task_complete_${taskId}` }
        ]);
      }

      keyboard.inline_keyboard.push([
        { text: `${EMOJIS.back} К моим заданиям`, callback_data: 'advertise_my_tasks' }
      ]);

      await ctx.editMessageText(message, {
        reply_markup: keyboard,
        parse_mode: 'Markdown'
      });

      await ctx.answerCallbackQuery();
    } catch (error) {
      logger.error('Task manage error:', error);
      await ctx.answerCallbackQuery('Произошла ошибка');
    }
  });
}

// Вспомогательные функции
function formatTimeRemaining(expiresAt: Date): string {
  const now = new Date();
  const diffMs = expiresAt.getTime() - now.getTime();
  
  if (diffMs <= 0) return 'истекло';
  
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  
  if (diffDays > 0) return `${diffDays} д. ${diffHours} ч.`;
  return `${diffHours} ч.`;
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

function getTaskStatusIcon(status: string): string {
  switch (status) {
    case 'active': return '🟢';
    case 'paused': return '⏸️';
    case 'completed': return '✅';
    case 'cancelled': return '❌';
    case 'expired': return '⏰';
    default: return '❓';
  }
}

function getTaskStatusText(status: string): string {
  switch (status) {
    case 'active': return 'Активно';
    case 'paused': return 'Приостановлено';
    case 'completed': return 'Завершено';
    case 'cancelled': return 'Отменено';
    case 'expired': return 'Истекло';
    default: return 'Неизвестно';
  }
}

function getActionButtonText(taskType: string): string {
  switch (taskType) {
    case 'subscribe_channel': return 'Подписаться на канал';
    case 'join_group': return 'Вступить в группу';
    case 'view_post': return 'Просмотреть пост';
    case 'bot_interaction': return 'Перейти к боту';
    case 'react_post': return 'Поставить реакцию';
    default: return 'Перейти';
  }
}

function getTaskInstructions(taskType: string): string {
  switch (taskType) {
    case 'subscribe_channel':
      return `💡 **ИНСТРУКЦИЯ:**\n` +
             `1. Нажмите кнопку "Подписаться на канал"\n` +
             `2. Подпишитесь на канал\n` +
             `3. Вернитесь и нажмите "Проверить выполнение"\n\n` +
             `⚠️ **Важно:** Не отписывайтесь раньше чем через 24 часа!\n\n`;
    
    case 'join_group':
      return `💡 **ИНСТРУКЦИЯ:**\n` +
             `1. Нажмите кнопку "Вступить в группу"\n` +
             `2. Вступите в группу\n` +
             `3. Вернитесь и нажмите "Проверить выполнение"\n\n` +
             `⚠️ **Важно:** Не покидайте группу раньше чем через 24 часа!\n\n`;
    
    case 'view_post':
      return `💡 **ИНСТРУКЦИЯ:**\n` +
             `1. Нажмите кнопку "Просмотреть пост"\n` +
             `2. Просмотрите пост\n` +
             `3. Вернитесь и нажмите "Проверить выполнение"\n\n`;
    
    case 'bot_interaction':
      return `💡 **ИНСТРУКЦИЯ:**\n` +
             `1. Нажмите кнопку "Перейти к боту"\n` +
             `2. Выполните указанные действия\n` +
             `3. Вернитесь и нажмите "Проверить выполнение"\n\n` +
             `⚠️ **Важно:** Задание проверяется автором вручную!\n\n`;
    
    case 'react_post':
      return `💡 **ИНСТРУКЦИЯ:**\n` +
             `1. Нажмите кнопку "Поставить реакцию"\n` +
             `2. Поставьте любую реакцию на пост\n` +
             `3. Вернитесь и нажмите "Проверить выполнение"\n\n`;
    
    default:
      return `💡 Следуйте инструкциям автора задания\n\n`;
  }
}

function getBackToTasksCallback(taskType: string): string {
  switch (taskType) {
    case 'subscribe_channel': return 'earn_channels';
    case 'join_group': return 'earn_groups';
    case 'view_post': return 'earn_posts';
    case 'bot_interaction': return 'earn_bots';
    case 'react_post': return 'earn_posts';
    default: return 'earn';
  }
}

async function checkCanUserExecuteTask(task: any, user: any): Promise<{canExecute: boolean, reason?: string}> {
  // Проверяем статус задания
  if (task.status !== 'active') {
    return { canExecute: false, reason: 'Задание неактивно' };
  }

  // Проверяем срок действия
  if (task.expiresAt && task.expiresAt < new Date()) {
    return { canExecute: false, reason: 'Срок выполнения задания истек' };
  }

  // Проверяем оставшиеся выполнения
  if (task.remainingExecutions <= 0) {
    return { canExecute: false, reason: 'Нет свободных мест для выполнения' };
  }

  // Проверяем, не автор ли пытается выполнить свое задание
  if (task.authorId === user.id) {
    return { canExecute: false, reason: 'Нельзя выполнять собственные задания' };
  }

  return { canExecute: true };
}