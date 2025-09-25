// src/bot/handlers/taskExecution.ts
import { Bot, Context } from 'grammy';
import { requireAuth } from '../middlewares/auth';
import { logger } from '../../utils/logger';
import { EMOJIS, TASK_TYPES, EXECUTION_STATUSES } from '../../utils/constants';
import { getConfirmKeyboard, getBackKeyboard } from '../keyboards/main';
import { formatTimeRemaining } from '../../utils/helpers/init';
import { Task, TaskExecution, User } from '../../database/models';
import { QueueManager } from '../../jobs/queues';

export function setupTaskExecutionHandlers(bot: Bot) {

  // Просмотр детальной информации о задании
  bot.callbackQuery(/^task_(\d+)$/, requireAuth, async (ctx) => {
    try {
      const taskId = parseInt(ctx.match![1]);
      const user = ctx.session!.user!;

      const task = await Task.findByPk(taskId, {
        include: [{ model: User, as: 'author', attributes: ['username', 'firstName'] }]
      });

      if (!task) {
        await ctx.answerCallbackQuery('Задание не найдено');
        return;
      }

      // Проверяем, может ли пользователь выполнить задание
      const canExecute = task.canUserExecute(user);
      if (!canExecute.canExecute) {
        await ctx.answerCallbackQuery(`❌ ${canExecute.reason}`);
        return;
      }

      // Проверяем, не выполнял ли уже это задание
      const existingExecution = await TaskExecution.findOne({
        where: { taskId, userId: user.id }
      });

      if (existingExecution) {
        if (existingExecution.isCompleted()) {
          await ctx.answerCallbackQuery('✅ Задание уже выполнено');
          return;
        } else {
          await ctx.answerCallbackQuery('⏳ Задание находится на проверке');
          return;
        }
      }

      // Увеличиваем счетчик просмотров
      await task.incrementViews();

      let message = `${task.getTypeIcon()} **ЗАДАНИЕ: ${task.title}**\n\n`;
      
      if (task.description) {
        message += `📋 **Описание:**\n${task.description}\n\n`;
      }

      message += `💰 **Награда:** ${task.reward} GRAM\n`;
      message += `⏱️ **Осталось:** ${formatTimeRemaining(task.expiresAt)}\n`;
      message += `👥 **Выполнили:** ${task.completedExecutions || 0}/${task.totalExecutions}\n\n`;

      // Инструкция в зависимости от типа задания
      if (task.type === TASK_TYPES.SUBSCRIBE_CHANNEL) {
        message += `💡 **ИНСТРУКЦИЯ:**\n`;
        message += `1. Нажмите кнопку "Подписаться"\n`;
        message += `2. Подпишитесь на канал\n`;
        message += `3. Вернитесь и нажмите "Проверить"\n\n`;
        message += `⚠️ **Важно:** Не отписывайтесь раньше чем через 24 часа!`;
      } else if (task.type === TASK_TYPES.JOIN_GROUP) {
        message += `💡 **ИНСТРУКЦИЯ:**\n`;
        message += `1. Нажмите кнопку "Вступить"\n`;
        message += `2. Вступите в группу\n`;
        message += `3. Вернитесь и нажмите "Проверить"\n\n`;
        message += `⚠️ **Важно:** Не покидайте группу раньше чем через 24 часа!`;
      } else if (task.type === TASK_TYPES.VIEW_POST) {
        message += `💡 **ИНСТРУКЦИЯ:**\n`;
        message += `1. Нажмите кнопку "Просмотреть"\n`;
        message += `2. Просмотрите пост\n`;
        message += `3. Вернитесь и нажмите "Проверить"`;
      } else if (task.type === TASK_TYPES.BOT_INTERACTION) {
        message += `💡 **ИНСТРУКЦИЯ:**\n`;
        message += `1. Нажмите кнопку "Перейти к боту"\n`;
        message += `2. Выполните условия задания\n`;
        message += `3. Сделайте скриншот результата\n`;
        message += `4. Вернитесь и загрузите скриншот\n\n`;
        message += `⚠️ **Важно:** Задание проверяется автором вручную!`;
      } else if (task.type === TASK_TYPES.REACT_POST) {
        message += `💡 **ИНСТРУКЦИЯ:**\n`;
        message += `1. Нажмите кнопку "Поставить реакцию"\n`;
        message += `2. Поставьте любую реакцию на пост\n`;
        message += `3. Вернитесь и нажмите "Проверить"`;
      }

      const keyboard = getBackKeyboard('earn')
        .row()
        .url(`🔗 ${getActionButtonText(task.type)}`, task.targetUrl);

      if (task.type === TASK_TYPES.BOT_INTERACTION) {
        keyboard.row().text('📤 Загрузить скриншот', `task_upload_${taskId}`);
      } else {
        keyboard.row().text('✅ Проверить выполнение', `task_check_${taskId}`);
      }

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

  // Проверка выполнения простого задания
  bot.callbackQuery(/^task_check_(\d+)$/, requireAuth, async (ctx) => {
    try {
      const taskId = parseInt(ctx.match![1]);
      const user = ctx.session!.user!;

      const task = await Task.findByPk(taskId);
      if (!task || !task.isActive()) {
        await ctx.answerCallbackQuery('Задание недоступно');
        return;
      }

      // Проверяем, не выполнял ли уже это задание
      const existingExecution = await TaskExecution.findOne({
        where: { taskId, userId: user.id }
      });

      if (existingExecution) {
        await ctx.answerCallbackQuery('Задание уже выполнено или на проверке');
        return;
      }

      // Увеличиваем счетчик кликов
      await task.incrementClicks();

      // Создаем запись о выполнении
      const execution = await TaskExecution.create({
        taskId,
        userId: user.id,
        rewardAmount: Math.floor(task.reward * user.getEarnMultiplier()),
        status: EXECUTION_STATUSES.PENDING
      });

      // Отправляем в очередь на автопроверку
      await QueueManager.addTaskCheck({
        taskExecutionId: execution.id,
        userId: user.id,
        taskId,
        checkType: getCheckTypeFromTaskType(task.type),
        targetUrl: task.targetUrl
      }, 5000); // 5 секунд задержка

      let message = `⏳ **ЗАДАНИЕ НА ПРОВЕРКЕ**\n\n`;
      message += `${task.getTypeIcon()} ${task.title}\n`;
      message += `💰 ${execution.rewardAmount} GRAM\n\n`;
      message += `🔍 Проверяем выполнение...\n`;
      message += `⏰ Результат появится через несколько секунд\n\n`;
      message += `📱 Можете продолжить выполнять другие задания`;

      const keyboard = getBackKeyboard('earn');

      await ctx.editMessageText(message, {
        reply_markup: keyboard,
        parse_mode: 'Markdown'
      });

      await ctx.answerCallbackQuery('⏳ Задание отправлено на проверку');

      logger.userAction(user.telegramId, 'task_submitted', { taskId, executionId: execution.id });
    } catch (error) {
      logger.error('Task check error:', error);
      await ctx.answerCallbackQuery('Произошла ошибка при проверке');
    }
  });

  // Загрузка скриншота для задания с ботом
  bot.callbackQuery(/^task_upload_(\d+)$/, requireAuth, async (ctx) => {
    try {
      const taskId = parseInt(ctx.match![1]);
      const user = ctx.session!.user!;

      const task = await Task.findByPk(taskId);
      if (!task || !task.isActive()) {
        await ctx.answerCallbackQuery('Задание недоступно');
        return;
      }

      // Проверяем, не выполнял ли уже это задание
      const existingExecution = await TaskExecution.findOne({
        where: { taskId, userId: user.id }
      });

      if (existingExecution) {
        await ctx.answerCallbackQuery('Задание уже выполнено или на проверке');
        return;
      }

      let message = `📤 **ЗАГРУЗКА СКРИНШОТА**\n\n`;
      message += `${task.getTypeIcon()} ${task.title}\n`;
      message += `💰 ${Math.floor(task.reward * user.getEarnMultiplier())} GRAM\n\n`;
      message += `📷 **Отправьте скриншот** выполненного задания одним сообщением.\n\n`;
      message += `💬 Также можете добавить **комментарий** к скриншоту для автора задания.\n\n`;
      message += `⚠️ **Внимание:** После отправки скриншота изменить его будет нельзя!`;

      const keyboard = getBackKeyboard(`task_${taskId}`);

      await ctx.editMessageText(message, {
        reply_markup: keyboard,
        parse_mode: 'Markdown'
      });

      await ctx.answerCallbackQuery();

      // Устанавливаем состояние ожидания скриншота
      user.currentState = `awaiting_screenshot_${taskId}`;
      await user.save();

    } catch (error) {
      logger.error('Task upload handler error:', error);
      await ctx.answerCallbackQuery('Произошла ошибка');
    }
  });

  // Обработка загруженного скриншота
  bot.on('message:photo', requireAuth, async (ctx) => {
    try {
      const user = ctx.session!.user!;
      
      if (!user.currentState?.startsWith('awaiting_screenshot_')) {
        return; // Не ожидаем скриншот
      }

      const taskId = parseInt(user.currentState.replace('awaiting_screenshot_', ''));
      
      const task = await Task.findByPk(taskId, {
        include: [{ model: User, as: 'author' }]
      });

      if (!task || !task.isActive()) {
        await ctx.reply('Задание больше недоступно');
        return;
      }

      // Получаем URL скриншота
      const photo = ctx.message.photo[ctx.message.photo.length - 1]; // Берем самое большое разрешение
      const file = await ctx.api.getFile(photo.file_id);
      const screenshotUrl = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${file.file_path}`;

      // Увеличиваем счетчик кликов
      await task.incrementClicks();

      // Создаем запись о выполнении с скриншотом
      const execution = await TaskExecution.create({
        taskId,
        userId: user.id,
        rewardAmount: Math.floor(task.reward * user.getEarnMultiplier()),
        status: EXECUTION_STATUSES.IN_REVIEW,
        screenshotUrl,
        comment: ctx.message.caption || undefined
      });

      // Сбрасываем состояние пользователя
      user.currentState = null;
      await user.save();

      // Отправляем уведомление автору задания
      if (task.author) {
        try {
          await ctx.api.sendPhoto(task.author.telegramId, photo.file_id, {
            caption: `📋 **Новое выполнение задания**\n\n` +
                    `${task.getTypeIcon()} ${task.title}\n` +
                    `👤 Исполнитель: ${user.getDisplayName()}\n` +
                    `💰 К выплате: ${execution.rewardAmount} GRAM\n` +
                    `⏰ Время: ${new Date().toLocaleString('ru-RU')}\n\n` +
                    `${ctx.message.caption ? `💬 Комментарий:\n${ctx.message.caption}\n\n` : ''}` +
                    `У вас есть 24 часа для проверки. Если не проверите - задание будет засчитано автоматически.`,
            reply_markup: {
              inline_keyboard: [[
                { text: '✅ Принять', callback_data: `approve_${execution.id}` },
                { text: '❌ Отклонить', callback_data: `reject_${execution.id}` }
              ], [
                { text: '👁️ Подробнее', callback_data: `execution_${execution.id}` }
              ]]
            },
            parse_mode: 'Markdown'
          });
        } catch (notifyError) {
          logger.warn('Failed to notify task author:', notifyError);
        }
      }

      let message = `📤 **СКРИНШОТ ОТПРАВЛЕН**\n\n`;
      message += `✅ Задание #${execution.id} отправлено автору на проверку\n\n`;
      message += `⏰ **Статус проверки:**\n`;
      message += `├ Отправлено: ${new Date().toLocaleString('ru-RU')}\n`;
      message += `├ Автор: ${task.author?.getDisplayName() || 'Неизвестно'}\n`;
      message += `└ Автопроверка: через 24 часа\n\n`;
      message += `💡 Если автор не проверит задание в течение 24 часов,\n`;
      message += `оно будет автоматически засчитано и оплачено.\n\n`;
      message += `🔔 Вы получите уведомление о результате проверки.`;

      const keyboard = getBackKeyboard('earn')
        .row()
        .text('💰 Другие задания', 'earn');

      await ctx.reply(message, {
        reply_markup: keyboard,
        parse_mode: 'Markdown'
      });

      logger.userAction(user.telegramId, 'screenshot_uploaded', { 
        taskId, 
        executionId: execution.id,
        hasComment: !!ctx.message.caption 
      });

    } catch (error) {
      logger.error('Screenshot upload error:', error);
      await ctx.reply('Произошла ошибка при загрузке скриншота');
    }
  });

  // Обработка текстового сообщения как комментария к скриншоту
  bot.on('message:text', requireAuth, async (ctx, next) => {
    try {
      const user = ctx.session!.user!;
      
      if (user.currentState?.startsWith('awaiting_screenshot_')) {
        await ctx.reply(`📷 **Ожидается скриншот**\n\nПожалуйста, отправьте изображение, а не текст.\n\nЕсли хотите добавить комментарий - отправьте его вместе со скриншотом как подпись к фото.`);
        return;
      }
      
      await next();
    } catch (error) {
      logger.error('Text message handler error:', error);
      await next();
    }
  });

  logger.info('✅ Task execution handlers configured');
}

// Вспомогательные функции
function getActionButtonText(taskType: string): string {
  switch (taskType) {
    case TASK_TYPES.SUBSCRIBE_CHANNEL: return 'Подписаться на канал';
    case TASK_TYPES.JOIN_GROUP: return 'Вступить в группу';
    case TASK_TYPES.VIEW_POST: return 'Просмотреть пост';
    case TASK_TYPES.BOT_INTERACTION: return 'Перейти к боту';
    case TASK_TYPES.REACT_POST: return 'Поставить реакцию';
    default: return 'Перейти';
  }
}

function getCheckTypeFromTaskType(taskType: string): 'subscription' | 'membership' | 'reaction' | 'view' {
  switch (taskType) {
    case TASK_TYPES.SUBSCRIBE_CHANNEL: return 'subscription';
    case TASK_TYPES.JOIN_GROUP: return 'membership';
    case TASK_TYPES.REACT_POST: return 'reaction';
    case TASK_TYPES.VIEW_POST: return 'view';
    default: return 'view';
  }
}

// Обработчики для модерации заданий авторами
export function setupTaskModerationHandlers(bot: Bot) {

  // Принятие задания автором
  bot.callbackQuery(/^approve_(\d+)$/, requireAuth, async (ctx) => {
    try {
      const executionId = parseInt(ctx.match![1]);
      const user = ctx.session!.user!;

      const execution = await TaskExecution.findByPk(executionId, {
        include: [
          { model: Task, as: 'task' },
          { model: User, as: 'user' }
        ]
      });

      if (!execution || !execution.task) {
        await ctx.answerCallbackQuery('❌ Выполнение задания не найдено');
        return;
      }

      // Проверяем, что текущий пользователь - автор задания
      if (execution.task.authorId !== user.id) {
        await ctx.answerCallbackQuery('❌ Вы не автор этого задания');
        return;
      }

      // Проверяем статус
      if (!execution.isInReview()) {
        await ctx.answerCallbackQuery('❌ Задание не находится на проверке');
        return;
      }

      // Принимаем задание
      await execution.approve(user.id);

      // Начисляем награду исполнителю
      if (execution.user) {
        await execution.user.updateBalance(execution.rewardAmount, 'add');
        
        // Создаем транзакцию
        await Transaction.createTaskReward(
          execution.user.id,
          execution.task.id,
          execution.rewardAmount,
          (execution.user.balance || 0) - execution.rewardAmount
        );

        // Обновляем счетчики
        await execution.task.incrementConversions();
        execution.user.tasksCompleted = (execution.user.tasksCompleted || 0) + 1;
        await execution.user.save();

        // Помечаем как оплаченное
        await execution.markRewardPaid();

        // Уведомляем исполнителя
        try {
          await ctx.api.sendMessage(
            execution.user.telegramId,
            `✅ **Задание принято!**\n\n` +
            `${execution.task.getTypeIcon()} ${execution.task.title}\n` +
            `💰 Получено: ${execution.rewardAmount.toLocaleString()} GRAM\n` +
            `💳 Новый баланс: ${execution.user.balance?.toLocaleString()} GRAM\n\n` +
            `🎉 Поздравляем с успешным выполнением!`,
            { parse_mode: 'Markdown' }
          );
        } catch (notifyError) {
          logger.warn('Failed to notify task executor:', notifyError);
        }
      }

      await ctx.editMessageText(
        `✅ **Задание принято**\n\n` +
        `Исполнитель получил ${execution.rewardAmount.toLocaleString()} GRAM\n` +
        `Задание помечено как выполненное.`,
        { parse_mode: 'Markdown' }
      );

      await ctx.answerCallbackQuery('✅ Задание принято и оплачено');

      logger.userAction(user.telegramId, 'task_execution_approved', {
        executionId,
        taskId: execution.task.id,
        reward: execution.rewardAmount
      });

    } catch (error) {
      logger.error('Approve task execution error:', error);
      await ctx.answerCallbackQuery('❌ Произошла ошибка');
    }
  });

  // Отклонение задания автором
  bot.callbackQuery(/^reject_(\d+)$/, requireAuth, async (ctx) => {
    try {
      const executionId = parseInt(ctx.match![1]);
      const user = ctx.session!.user!;

      const execution = await TaskExecution.findByPk(executionId, {
        include: [
          { model: Task, as: 'task' },
          { model: User, as: 'user' }
        ]
      });

      if (!execution || !execution.task) {
        await ctx.answerCallbackQuery('❌ Выполнение задания не найдено');
        return;
      }

      if (execution.task.authorId !== user.id) {
        await ctx.answerCallbackQuery('❌ Вы не автор этого задания');
        return;
      }

      if (!execution.isInReview()) {
        await ctx.answerCallbackQuery('❌ Задание не находится на проверке');
        return;
      }

      // Устанавливаем состояние для указания причины отклонения
      user.currentState = JSON.stringify({ action: 'rejecting_execution', executionId });
      await user.save();

      let message = `❌ **ОТКЛОНЕНИЕ ЗАДАНИЯ**\n\n`;
      message += `Укажите причину отклонения задания:\n\n`;
      message += `**Популярные причины:**\n`;
      message += `• Неверный скриншот\n`;
      message += `• Не выполнены условия\n`;
      message += `• Фейковое выполнение\n`;
      message += `• Неполная информация\n\n`;
      message += `Напишите причину отклонения:`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: '📷 Неверный скриншот', callback_data: `reject_reason_${executionId}_screenshot` },
            { text: '❌ Не выполнены условия', callback_data: `reject_reason_${executionId}_conditions` }
          ],
          [
            { text: '🎭 Фейковое выполнение', callback_data: `reject_reason_${executionId}_fake` },
            { text: '📝 Неполная информация', callback_data: `reject_reason_${executionId}_incomplete` }
          ],
          [
            { text: '⬅️ Назад', callback_data: `execution_${executionId}` }
          ]
        ]
      };

      await ctx.editMessageText(message, {
        reply_markup: keyboard,
        parse_mode: 'Markdown'
      });

      await ctx.answerCallbackQuery();

    } catch (error) {
      logger.error('Reject task execution error:', error);
      await ctx.answerCallbackQuery('❌ Произошла ошибка');
    }
  });

  // Обработка готовых причин отклонения
  bot.callbackQuery(/^reject_reason_(\d+)_(.+)$/, requireAuth, async (ctx) => {
    try {
      const executionId = parseInt(ctx.match![1]);
      const reasonKey = ctx.match![2];
      const user = ctx.session

