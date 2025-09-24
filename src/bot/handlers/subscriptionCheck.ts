// src/bot/handlers/subscriptionCheck.ts
import { Bot, Context } from 'grammy';
import { requireAuth } from '../middlewares/auth';
import { logger } from '../../utils/logger';
import { EMOJIS } from '../../utils/constants';
import { getSubscriptionMainKeyboard, getBackKeyboard } from '../keyboards/main';
import { SubscriptionCheck } from '../../database/models/SubscriptionCheck';
import { User } from '../../database/models';

export function setupSubscriptionCheckHandlers(bot: Bot) {

  // Главное меню системы ОП
  bot.callbackQuery('subscription', requireAuth, async (ctx) => {
    try {
      const user = ctx.session!.user!;
      
      logger.userAction(user.telegramId, 'subscription_opened');

      const myChecksCount = await SubscriptionCheck.count({
        where: { creatorId: user.id }
      });

      let message = `${EMOJIS.subscription} **ПРОВЕРКА ПОДПИСКИ**\n\n`;
      message += `Настройте обязательную подписку на каналы/чаты\n`;
      message += `для участников вашего сообщества.\n\n`;
      message += `📊 **Ваша статистика:**\n`;
      message += `├ Активных проверок: ${myChecksCount}\n`;
      message += `└ Всего настроек: ${myChecksCount}\n\n`;
      message += `📋 **ИНСТРУКЦИЯ:**\n`;
      message += `▸ **Шаг 1:** Добавьте бота в ваш чат с правами администратора\n`;
      message += `▸ **Шаг 2:** Добавьте бота в админы канала/чата на который хотите установить проверку\n`;
      message += `▸ **Шаг 3:** Используйте команду /setup`;

      await ctx.editMessageText(message, {
        reply_markup: getSubscriptionMainKeyboard(),
        parse_mode: 'Markdown'
      });

      await ctx.answerCallbackQuery();
    } catch (error) {
      logger.error('Subscription handler error:', error);
      await ctx.answerCallbackQuery('Произошла ошибка');
    }
  });

  // Публичные каналы/чаты
  bot.callbackQuery('subscription_public', requireAuth, async (ctx) => {
    try {
      let message = `🏛️ **ПУБЛИЧНЫЕ КАНАЛЫ/ЧАТЫ**\n\n`;
      message += `Настройка проверки подписки на публичные каналы с открытыми ссылками.\n\n`;
      message += `📝 **КОМАНДЫ ДЛЯ ВАШЕГО ЧАТА:**\n\n`;
      message += `**┌── ОСНОВНЫЕ ──┐**\n`;
      message += `\`/setup @channel\` - добавить проверку подписки\n`;
      message += `\`/unsetup @channel\` - убрать конкретную проверку\n`;
      message += `\`/unsetup\` - убрать все проверки\n`;
      message += `\`/status\` - показать активные проверки\n\n`;
      message += `**┌── С ТАЙМЕРОМ ──┐**\n`;
      message += `\`/setup @channel 1d\` - проверка на 1 день\n`;
      message += `\`/setup @channel 5h\` - проверка на 5 часов\n`;
      message += `\`/setup @channel 30m\` - проверка на 30 минут\n\n`;
      message += `🕒 **Форматы времени:**\n`;
      message += `s - секунды | m - минуты | h - часы | d - дни\n\n`;
      message += `📝 **ПРИМЕР ИСПОЛЬЗОВАНИЯ:**\n`;
      message += `1. Добавьте бота @${ctx.me.username} в ваш чат как админа\n`;
      message += `2. Напишите: \`/setup @your_channel\`\n`;
      message += `3. Новые участники должны будут подписаться\n\n`;
      message += `⚠️ **Лимит:** 5 одновременных проверок`;

      const keyboard = getBackKeyboard('subscription');

      await ctx.editMessageText(message, {
        reply_markup: keyboard,
        parse_mode: 'Markdown'
      });

      await ctx.answerCallbackQuery();
    } catch (error) {
      logger.error('Subscription public error:', error);
      await ctx.answerCallbackQuery('Произошла ошибка');
    }
  });

  // Реферальная система PR GRAM
  bot.callbackQuery('subscription_referral_prgram', requireAuth, async (ctx) => {
    try {
      const user = ctx.session!.user!;
      
      let message = `🎯 **РЕФЕРАЛЬНАЯ СИСТЕМА PR GRAM**\n\n`;
      message += `Добавьте обязательную подписку через вашу реферальную ссылку PR GRAM!\n\n`;
      message += `💰 **ВЫ БУДЕТЕ ПОЛУЧАТЬ:**\n`;
      message += `• **3,000 GRAM** – за каждого привлеченного реферала\n`;
      message += `• **+10%** – от суммы пополнений ваших рефералов\n`;
      message += `• **+10%** – от выполнения заданий вашими рефералами\n\n`;
      message += `📝 **НАСТРОЙКА:**\n`;
      message += `▸ **Шаг 1:** Добавьте бота в ваш чат с правами админа\n`;
      message += `▸ **Шаг 2:** Используйте команду \`/setup_bot\` с вашим ID\n\n`;
      message += `**┌── КОМАНДЫ ──┐**\n`;
      message += `\`/setup_bot ${user.telegramId}\` - включить реферальную ОП\n`;
      message += `\`/setup_bot ${user.telegramId} 1d\` - с таймером на 1 день\n`;
      message += `\`/unsetup_bot\` - отключить реферальную ОП\n\n`;
      message += `📊 **ВАШ ID:** \`${user.telegramId}\`\n`;
      message += `🔗 **Ваша реф. ссылка:** \`t.me/${ctx.me.username}?start=${user.telegramId}\`\n\n`;
      message += `💡 Скопируйте свой ID для использования в команде!`;

      const keyboard = getBackKeyboard('subscription')
        .row()
        .text('📋 Копировать ID', `copy_user_id_${user.telegramId}`)
        .text('🔗 Реферальная ссылка', 'referrals_link');

      await ctx.editMessageText(message, {
        reply_markup: keyboard,
        parse_mode: 'Markdown'
      });

      await ctx.answerCallbackQuery();
    } catch (error) {
      logger.error('Subscription referral error:', error);
      await ctx.answerCallbackQuery('Произошла ошибка');
    }
  });

  // Автоудаление сообщений
  bot.callbackQuery('subscription_autodelete', requireAuth, async (ctx) => {
    try {
      let message = `⌛ **АВТОУДАЛЕНИЕ СООБЩЕНИЙ**\n\n`;
      message += `Настройте автоматическое удаление сообщений бота через заданный интервал времени.\n\n`;
      message += `⚙️ **КОМАНДЫ НАСТРОЙКИ:**\n`;
      message += `\`/autodelete 30s\` - удаление через 30 секунд\n`;
      message += `\`/autodelete 2m\` - удаление через 2 минуты\n`;
      message += `\`/autodelete 5m\` - удаление через 5 минут\n\n`;
      message += `🛑 **ОТКЛЮЧЕНИЕ:**\n`;
      message += `\`/autodelete off\` - отключить автоудаление\n\n`;
      message += `📊 **ПРОВЕРКА СТАТУСА:**\n`;
      message += `\`/get_autodelete\` - текущие настройки\n\n`;
      message += `📋 **ДОСТУПНЫЕ ИНТЕРВАЛЫ:**\n`;
      message += `├ Минимум: 15 секунд\n`;
      message += `├ Максимум: 5 минут\n`;
      message += `└ Форматы: s (сек), m (мин)\n\n`;
      message += `💡 **ПРИМЕЧАНИЕ:**\n`;
      message += `Функция работает только для сообщений, отправленных ботом в вашем чате.\n\n`;
      message += `⚠️ После настройки все сообщения бота будут автоматически удаляться через указанное время.`;

      const keyboard = getBackKeyboard('subscription');

      await ctx.editMessageText(message, {
        reply_markup: keyboard,
        parse_mode: 'Markdown'
      });

      await ctx.answerCallbackQuery();
    } catch (error) {
      logger.error('Subscription autodelete error:', error);
      await ctx.answerCallbackQuery('Произошла ошибка');
    }
  });

  // Копирование ID пользователя
  bot.callbackQuery(/^copy_user_id_(\d+)$/, requireAuth, async (ctx) => {
    try {
      const userId = ctx.match![1];
      await ctx.answerCallbackQuery(`📋 ID скопирован: ${userId}`, { show_alert: true });
    } catch (error) {
      logger.error('Copy user ID error:', error);
      await ctx.answerCallbackQuery('Произошла ошибка');
    }
  });

  logger.info('✅ Subscription check handlers configured');
}

// Обработчики команд для чатов
export function setupSubscriptionCommands(bot: Bot) {
  
  // Команда /setup @channel [время]
  bot.command('setup', async (ctx) => {
    try {
      // Проверяем, что команда вызвана в группе/супергруппе
      if (ctx.chat?.type !== 'group' && ctx.chat?.type !== 'supergroup') {
        await ctx.reply('❌ Эта команда работает только в группах и супергруппах.');
        return;
      }

      // Проверяем права бота
      const botMember = await ctx.api.getChatMember(ctx.chat.id, ctx.me.id);
      if (botMember.status !== 'administrator') {
        await ctx.reply('❌ Бот должен быть администратором чата для настройки проверки подписки.');
        return;
      }

      // Проверяем права пользователя
      const userMember = await ctx.api.getChatMember(ctx.chat.id, ctx.from.id);
      if (!['creator', 'administrator'].includes(userMember.status)) {
        await ctx.reply('❌ Только администраторы могут настраивать проверку подписки.');
        return;
      }

      const args = ctx.message?.text?.split(' ').slice(1) || [];
      
      if (args.length === 0) {
        await ctx.reply(`📝 **Использование:**\n\`/setup @channel\` - базовая настройка\n\`/setup @channel 1d\` - с таймером`, { parse_mode: 'Markdown' });
        return;
      }

      const targetChannel = args[0];
      const timeStr = args[1];

      // Валидация канала
      if (!targetChannel.startsWith('@')) {
        await ctx.reply('❌ Укажите канал в формате @channel_name');
        return;
      }

      // Парсинг времени
      let timerDuration: number | undefined;
      if (timeStr) {
        timerDuration = parseTimeString(timeStr);
        if (timerDuration === null) {
          await ctx.reply('❌ Неверный формат времени. Используйте: 30s, 5m, 2h, 1d');
          return;
        }
      }

      // Находим или создаем пользователя
      let user = await User.findOne({ where: { telegramId: ctx.from.id } });
      if (!user) {
        user = await User.create({
          telegramId: ctx.from.id,
          username: ctx.from.username,
          firstName: ctx.from.first_name,
          lastName: ctx.from.last_name,
          referralCode: ctx.from.id.toString()
        });
      }

      // Проверяем лимит
      const existingChecks = await SubscriptionCheck.count({
        where: { 
          chatId: ctx.chat.id.toString(),
          isActive: true
        }
      });

      if (existingChecks >= 5) {
        await ctx.reply('❌ Достигнут лимит в 5 проверок на чат. Удалите неиспользуемые проверки командой /unsetup');
        return;
      }

      // Проверяем, что канал не добавлен уже
      const existingCheck = await SubscriptionCheck.findOne({
        where: {
          chatId: ctx.chat.id.toString(),
          targetChannel,
          isActive: true
        }
      });

      if (existingCheck) {
        await ctx.reply(`❌ Проверка подписки на ${targetChannel} уже настроена в этом чате.`);
        return;
      }

      // Проверяем доступ к каналу
      try {
        const channelInfo = await ctx.api.getChat(targetChannel);
        
        // Проверяем, что бот админ канала (если он публичный)
        try {
          const botChannelMember = await ctx.api.getChatMember(targetChannel, ctx.me.id);
          if (!['creator', 'administrator'].includes(botChannelMember.status)) {
            await ctx.reply(`⚠️ Рекомендуется добавить бота администратором канала ${targetChannel} для корректной работы.`);
          }
        } catch {
          // Игнорируем ошибку - возможно приватный канал
        }

        // Создаем проверку
        await SubscriptionCheck.createPublicCheck(
          user.id,
          ctx.chat.id.toString(),
          targetChannel,
          {
            chatTitle: ctx.chat.title,
            chatUsername: ctx.chat.username,
            timerDuration
          }
        );

        let confirmMessage = `✅ **Проверка подписки настроена!**\n\n`;
        confirmMessage += `📺 **Канал:** ${targetChannel}\n`;
        confirmMessage += `🏠 **Чат:** ${ctx.chat.title}\n`;
        if (timerDuration) {
          confirmMessage += `⏰ **Таймер:** ${formatDuration(timerDuration)}\n`;
        }
        confirmMessage += `\n💡 Новые участники должны будут подписаться на указанный канал.`;

        await ctx.reply(confirmMessage, { parse_mode: 'Markdown' });

        logger.userAction(user.telegramId, 'subscription_check_created', {
          chatId: ctx.chat.id,
          targetChannel,
          timerDuration
        });

      } catch (error) {
        await ctx.reply(`❌ Не удалось получить информацию о канале ${targetChannel}. Проверьте правильность написания и убедитесь, что канал существует.`);
        logger.error('Setup command error:', error);
      }

    } catch (error) {
      logger.error('Setup command error:', error);
      await ctx.reply('❌ Произошла ошибка при настройке проверки подписки.');
    }
  });

  // Команда /unsetup [канал]
  bot.command('unsetup', async (ctx) => {
    try {
      if (ctx.chat?.type !== 'group' && ctx.chat?.type !== 'supergroup') {
        await ctx.reply('❌ Эта команда работает только в группах и супергруппах.');
        return;
      }

      const userMember = await ctx.api.getChatMember(ctx.chat.id, ctx.from.id);
      if (!['creator', 'administrator'].includes(userMember.status)) {
        await ctx.reply('❌ Только администраторы могут управлять проверками подписки.');
        return;
      }

      const args = ctx.message?.text?.split(' ').slice(1) || [];
      const targetChannel = args[0];

      let removedCount: number;

      if (targetChannel) {
        // Удаляем конкретную проверку
        removedCount = await SubscriptionCheck.removeByTarget(ctx.chat.id.toString(), targetChannel);
        
        if (removedCount > 0) {
          await ctx.reply(`✅ Проверка подписки на ${targetChannel} удалена.`);
        } else {
          await ctx.reply(`❌ Проверка подписки на ${targetChannel} не найдена.`);
        }
      } else {
        // Удаляем все проверки
        removedCount = await SubscriptionCheck.removeByTarget(ctx.chat.id.toString());
        
        if (removedCount > 0) {
          await ctx.reply(`✅ Удалено ${removedCount} проверок подписки.`);
        } else {
          await ctx.reply(`ℹ️ В этом чате нет активных проверок подписки.`);
        }
      }

    } catch (error) {
      logger.error('Unsetup command error:', error);
      await ctx.reply('❌ Произошла ошибка при удалении проверки подписки.');
    }
  });

  // Команда /status - показать активные проверки
  bot.command('status', async (ctx) => {
    try {
      if (ctx.chat?.type !== 'group' && ctx.chat?.type !== 'supergroup') {
        await ctx.reply('❌ Эта команда работает только в группах и супергруппах.');
        return;
      }

      const checks = await SubscriptionCheck.findByChatId(ctx.chat.id.toString());

      if (checks.length === 0) {
        await ctx.reply('ℹ️ В этом чате нет активных проверок подписки.');
        return;
      }

      let message = `📊 **АКТИВНЫЕ ПРОВЕРКИ ПОДПИСКИ**\n\n`;
      message += `📍 **Чат:** ${ctx.chat.title}\n`;
      message += `📝 **Всего проверок:** ${checks.length}\n\n`;

      checks.forEach((check, index) => {
        message += `${index + 1}. **${check.getTypeText()}**\n`;
        
        if (check.targetChannel) {
          message += `   📺 Канал: ${check.targetChannel}\n`;
        }
        
        if (check.referralUser) {
          message += `   👤 Реферер: ${check.referralUser.getDisplayName()}\n`;
        }
        
        if (check.hasTimer()) {
          message += `   ⏰ Таймер: ${check.getTimerText()}\n`;
        }
        
        message += `   📊 Проверок: ${check.checksCount} | Подписались: ${check.subscriptionsCount}\n`;
        message += `   📈 Конверсия: ${check.getConversionRate()}%\n\n`;
      });

      message += `💡 Используйте \`/unsetup @channel\` для удаления конкретной проверки`;

      await ctx.reply(message, { parse_mode: 'Markdown' });

    } catch (error) {
      logger.error('Status command error:', error);
      await ctx.reply('❌ Произошла ошибка при получении статуса проверок.');
    }
  });

  // Команда /setup_bot ID [время] - реферальная система
  bot.command('setup_bot', async (ctx) => {
    try {
      if (ctx.chat?.type !== 'group' && ctx.chat?.type !== 'supergroup') {
        await ctx.reply('❌ Эта команда работает только в группах и супергруппах.');
        return;
      }

      const userMember = await ctx.api.getChatMember(ctx.chat.id, ctx.from.id);
      if (!['creator', 'administrator'].includes(userMember.status)) {
        await ctx.reply('❌ Только администраторы могут настраивать реферальную систему.');
        return;
      }

      const args = ctx.message?.text?.split(' ').slice(1) || [];
      
      if (args.length === 0) {
        await ctx.reply('📝 **Использование:**\n`/setup_bot USER_ID` - настроить реферальную ОП\n`/setup_bot USER_ID 1d` - с таймером', { parse_mode: 'Markdown' });
        return;
      }

      const referralUserId = parseInt(args[0]);
      const timeStr = args[1];

      if (isNaN(referralUserId)) {
        await ctx.reply('❌ Укажите корректный ID пользователя (число)');
        return;
      }

      // Проверяем, существует ли реферальный пользователь
      const referralUser = await User.findOne({ where: { telegramId: referralUserId } });
      if (!referralUser) {
        await ctx.reply(`❌ Пользователь с ID ${referralUserId} не найден в системе PR GRAM Bot.`);
        return;
      }

      // Парсинг времени
      let timerDuration: number | undefined;
      if (timeStr) {
        timerDuration = parseTimeString(timeStr);
        if (timerDuration === null) {
          await ctx.reply('❌ Неверный формат времени. Используйте: 30s, 5m, 2h, 1d');
          return;
        }
      }

      // Находим или создаем пользователя-создателя
      let creator = await User.findOne({ where: { telegramId: ctx.from.id } });
      if (!creator) {
        creator = await User.create({
          telegramId: ctx.from.id,
          username: ctx.from.username,
          firstName: ctx.from.first_name,
          lastName: ctx.from.last_name,
          referralCode: ctx.from.id.toString()
        });
      }

      // Проверяем, нет ли уже реферальной проверки
      const existingCheck = await SubscriptionCheck.findOne({
        where: {
          chatId: ctx.chat.id.toString(),
          type: 'referral_prgram',
          isActive: true
        }
      });

      if (existingCheck) {
        await ctx.reply('❌ Реферальная система уже настроена в этом чате. Используйте /unsetup_bot для отключения.');
        return;
      }

      // Создаем реферальную проверку
      await SubscriptionCheck.createReferralCheck(
        creator.id,
        ctx.chat.id.toString(),
        referralUser.id,
        {
          chatTitle: ctx.chat.title,
          chatUsername: ctx.chat.username,
          timerDuration
        }
      );

      let confirmMessage = `✅ **Реферальная система PR GRAM настроена!**\n\n`;
      confirmMessage += `👤 **Реферер:** ${referralUser.getDisplayName()}\n`;
      confirmMessage += `🏠 **Чат:** ${ctx.chat.title}\n`;
      if (timerDuration) {
        confirmMessage += `⏰ **Таймер:** ${formatDuration(timerDuration)}\n`;
      }
      confirmMessage += `🔗 **Реф. ссылка:** \`t.me/${ctx.me.username}?start=${referralUserId}\`\n\n`;
      confirmMessage += `💡 Новые участники должны будут зарегистрироваться в PR GRAM Bot через указанную реферальную ссылку.`;

      await ctx.reply(confirmMessage, { parse_mode: 'Markdown' });

      logger.userAction(creator.telegramId, 'referral_subscription_check_created', {
        chatId: ctx.chat.id,
        referralUserId,
        timerDuration
      });

    } catch (error) {
      logger.error('Setup bot command error:', error);
      await ctx.reply('❌ Произошла ошибка при настройке реферальной системы.');
    }
  });

  // Команда /unsetup_bot - отключить реферальную систему
  bot.command('unsetup_bot', async (ctx) => {
    try {
      if (ctx.chat?.type !== 'group' && ctx.chat?.type !== 'supergroup') {
        await ctx.reply('❌ Эта команда работает только в группах и супергруппах.');
        return;
      }

      const userMember = await ctx.api.getChatMember(ctx.chat.id, ctx.from.id);
      if (!['creator', 'administrator'].includes(userMember.status)) {
        await ctx.reply('❌ Только администраторы могут управлять реферальной системой.');
        return;
      }

      const deletedCount = await SubscriptionCheck.destroy({
        where: {
          chatId: ctx.chat.id.toString(),
          type: 'referral_prgram',
          isActive: true
        }
      });

      if (deletedCount > 0) {
        await ctx.reply('✅ Реферальная система PR GRAM отключена.');
      } else {
        await ctx.reply('ℹ️ Реферальная система не была настроена в этом чате.');
      }

    } catch (error) {
      logger.error('Unsetup bot command error:', error);
      await ctx.reply('❌ Произошла ошибка при отключении реферальной системы.');
    }
  });

  // Команда /autodelete - настройка автоудаления
  bot.command('autodelete', async (ctx) => {
    try {
      if (ctx.chat?.type !== 'group' && ctx.chat?.type !== 'supergroup') {
        await ctx.reply('❌ Эта команда работает только в группах и супергруппах.');
        return;
      }

      const userMember = await ctx.api.getChatMember(ctx.chat.id, ctx.from.id);
      if (!['creator', 'administrator'].includes(userMember.status)) {
        await ctx.reply('❌ Только администраторы могут настраивать автоудаление.');
        return;
      }

      const args = ctx.message?.text?.split(' ').slice(1) || [];
      
      if (args.length === 0) {
        await ctx.reply('📝 **Использование:**\n`/autodelete 30s` - удаление через 30 сек\n`/autodelete off` - отключить', { parse_mode: 'Markdown' });
        return;
      }

      const timeStr = args[0].toLowerCase();
      
      // Обновляем все активные проверки в чате
      if (timeStr === 'off') {
        await SubscriptionCheck.update(
          { autoDeleteEnabled: false },
          { where: { chatId: ctx.chat.id.toString(), isActive: true } }
        );
        
        await ctx.reply('✅ Автоудаление сообщений отключено.');
      } else {
        const duration = parseTimeString(timeStr);
        
        if (duration === null || duration < 15 || duration > 300) {
          await ctx.reply('❌ Неверный формат времени. Используйте от 15s до 5m (15 секунд - 5 минут)');
          return;
        }

        const updatedCount = await SubscriptionCheck.update(
          { 
            autoDeleteEnabled: true,
            autoDeleteDuration: duration
          },
          { where: { chatId: ctx.chat.id.toString(), isActive: true } }
        );

        if (updatedCount[0] > 0) {
          await ctx.reply(`✅ Автоудаление настроено на ${formatDuration(duration)}.`);
        } else {
          await ctx.reply('ℹ️ В этом чате нет активных проверок подписки для настройки автоудаления.');
        }
      }

    } catch (error) {
      logger.error('Autodelete command error:', error);
      await ctx.reply('❌ Произошла ошибка при настройке автоудаления.');
    }
  });

  // Команда /get_autodelete - получить текущие настройки
  bot.command('get_autodelete', async (ctx) => {
    try {
      if (ctx.chat?.type !== 'group' && ctx.chat?.type !== 'supergroup') {
        return;
      }

      const checks = await SubscriptionCheck.findByChatId(ctx.chat.id.toString());
      
      if (checks.length === 0) {
        await ctx.reply('ℹ️ В этом чате нет активных проверок подписки.');
        return;
      }

      let message = `⌛ **НАСТРОЙКИ АВТОУДАЛЕНИЯ**\n\n`;
      
      checks.forEach((check, index) => {
        message += `${index + 1}. ${check.getTypeText()}\n`;
        if (check.autoDeleteEnabled) {
          message += `   ✅ Автоудаление: ${formatDuration(check.autoDeleteDuration)}\n`;
        } else {
          message += `   ❌ Автоудаление: отключено\n`;
        }
        message += `\n`;
      });

      await ctx.reply(message, { parse_mode: 'Markdown' });

    } catch (error) {
      logger.error('Get autodelete command error:', error);
    }
  });

  logger.info('✅ Subscription check commands configured');
}

// Обработчик новых участников чата
export function setupNewMemberHandler(bot: Bot) {
  bot.on('message:new_chat_members', async (ctx) => {
    try {
      const chatId = ctx.chat.id.toString();
      const newMembers = ctx.message.new_chat_members!;

      // Получаем активные проверки для этого чата
      const checks = await SubscriptionCheck.findByChatId(chatId);
      
      if (checks.length === 0) {
        return; // Нет проверок
      }

      // Обрабатываем каждого нового участника
      for (const member of newMembers) {
        if (member.is_bot) continue; // Игнорируем ботов

        for (const check of checks) {
          await processNewMemberCheck(ctx, member, check);
        }
      }

    } catch (error) {
      logger.error('New member handler error:', error);
    }
  });
}

// Функция обработки проверки нового участника
async function processNewMemberCheck(ctx: Context, member: any, check: SubscriptionCheck) {
  try {
    await check.updateStats('check');

    let isValid = false;
    let kickReason = '';

    if (check.type === 'referral_prgram') {
      // Проверяем реферальную систему
      const user = await User.findOne({ 
        where: { 
          telegramId: member.id,
          referrerId: check.referralUserId 
        }
      });

      if (user) {
        isValid = true;
      } else {
        kickReason = `Необходима регистрация через реферальную ссылку`;
      }
    } else if (check.targetChannel) {
      // Проверяем подписку на канал
      try {
        const chatMember = await ctx.api.getChatMember(check.targetChannel, member.id);
        isValid = ['creator', 'administrator', 'member'].includes(chatMember.status);
        
        if (!isValid) {
          kickReason = `Необходима подписка на ${check.targetChannel}`;
        }
      } catch {
        kickReason = `Необходима подписка на ${check.targetChannel}`;
      }
    }

    if (isValid) {
      await check.updateStats('subscribe');
      return; // Пользователь прошел проверку
    }

    // Пользователь не прошел проверку
    let warningMessage = `👋 ${member.first_name}, добро пожаловать!\n\n`;
    warningMessage += `${kickReason}\n\n`;

    if (check.type === 'referral_prgram' && check.referralUser) {
      warningMessage += `🔗 Регистрируйтесь через ссылку:\n`;
      warningMessage += `t.me/${ctx.me.username}?start=${check.referralUserId}\n\n`;
      warningMessage += `💰 За регистрацию ${check.referralUser.getDisplayName()} получит бонус!`;
    } else if (check.targetChannel) {
      warningMessage += `📺 Подпишитесь на: ${check.targetChannel}`;
    }

    if (check.hasTimer()) {
      warningMessage += `\n\n⏰ У вас есть ${check.getTimerText()} на выполнение требования.`;
    }

    // Отправляем предупреждение
    const warningMsg = await ctx.reply(warningMessage, { parse_mode: 'Markdown' });

    // Настраиваем автоудаление предупреждения
    if (check.autoDeleteEnabled) {
      setTimeout(async () => {
        try {
          await ctx.api.deleteMessage(ctx.chat!.id, warningMsg.message_id);
        } catch (error) {
          logger.warn('Failed to auto-delete warning message:', error);
        }
      }, check.autoDeleteDuration * 1000);
    }

    // Если есть таймер, ставим отложенную проверку
    if (check.hasTimer()) {
      setTimeout(async () => {
        await recheckMember(ctx, member.id, check);
      }, check.timerDuration! * 1000);
    } else {
      // Без таймера - сразу кикаем
      await kickMember(ctx, member.id, check);
    }

  } catch (error) {
    logger.error('Process new member check error:', error);
  }
}

// Функция повторной проверки участника
async function recheckMember(ctx: Context, userId: number, check: SubscriptionCheck) {
  try {
    let isValid = false;

    if (check.type === 'referral_prgram') {
      const user = await User.findOne({ 
        where: { 
          telegramId: userId,
          referrerId: check.referralUserId 
        }
      });
      isValid = !!user;
    } else if (check.targetChannel) {
      try {
        const chatMember = await ctx.api.getChatMember(check.targetChannel, userId);
        isValid = ['creator', 'administrator', 'member'].includes(chatMember.status);
      } catch {
        isValid = false;
      }
    }

    if (isValid) {
      await check.updateStats('subscribe');
    } else {
      await kickMember(ctx, userId, check);
    }

  } catch (error) {
    logger.error('Recheck member error:', error);
  }
}

// Функция исключения участника
async function kickMember(ctx: Context, userId: number, check: SubscriptionCheck) {
  try {
    await ctx.api.banChatMember(ctx.chat!.id, userId);
    await ctx.api.unbanChatMember(ctx.chat!.id, userId); // Сразу разбаниваем (просто кикаем)
    
    await check.updateStats('kick');
    
    logger.info(`Kicked user ${userId} from chat ${ctx.chat!.id} due to subscription check`);
  } catch (error) {
    logger.error('Kick member error:', error);
  }
}

// Вспомогательные функции
function parseTimeString(timeStr: string): number | null {
  const match = timeStr.match(/^(\d+)([smhd])$/);
  if (!match) return null;

  const value = parseInt(match[1]);
  const unit = match[2];

  switch (unit) {
    case 's': return value;
    case 'm': return value * 60;
    case 'h': return value * 3600;
    case 'd': return value * 86400;
    default: return null;
  }
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}с`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}м`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}ч`;
  return `${Math.floor(seconds / 86400)}д`;
}