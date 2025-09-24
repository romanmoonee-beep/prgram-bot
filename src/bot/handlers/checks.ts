// src/bot/handlers/checks.ts - COMPLETION
import { Bot, Context } from 'grammy';
import { requireAuth } from '../middlewares/auth';
import { logger } from '../../utils/logger';
import { EMOJIS, LIMITS } from '../../utils/constants';
import { getChecksKeyboard, getConfirmKeyboard, getBackKeyboard } from '../keyboards/main';
import { validateCheckAmount, validateCheckActivations, validateCheckPassword } from '../../utils/validators/init';
import { Check, CheckActivation, User, Transaction } from '../../database/models';

interface CheckCreationState {
  type?: 'personal' | 'multi';
  totalAmount?: number;
  maxActivations?: number;
  targetUserId?: number;
  password?: string;
  comment?: string;
  requiredSubscription?: string;
}

// Продолжение обработки создания чека
async function askPersonalCheckRecipient(ctx: Context, user: User, data: CheckCreationState) {
  data.maxActivations = 1;
  user.currentState = JSON.stringify({ action: 'creating_personal_check', data });
  await user.save();

  let message = `✅ Сумма установлена!\n\n`;
  message += `📝 **Шаг 2/4: Получатель (необязательно)**\n\n`;
  message += `Укажите получателя чека одним из способов:\n\n`;
  message += `• **Telegram ID** (числовой ID)\n`;
  message += `• **Username** (без @)\n`;
  message += `• **Отправьте /skip** чтобы пропустить\n\n`;
  message += `💡 Если не указать получателя, чек сможет активировать любой пользователь.`;

  await ctx.reply(message, { parse_mode: 'Markdown' });
}

async function askMultiCheckActivations(ctx: Context, user: User, data: CheckCreationState) {
  user.currentState = JSON.stringify({ action: 'creating_multi_check', data });
  await user.save();

  let message = `✅ Сумма установлена!\n\n`;
  message += `📝 **Шаг 2/5: Количество активаций**\n\n`;
  message += `На сколько человек разделить чек?\n\n`;
  message += `**Пример:** 5000 GRAM на 10 человек = 500 GRAM каждому\n\n`;
  message += `**Лимиты:** 1-1000 активаций`;

  await ctx.reply(message, { parse_mode: 'Markdown' });
}

async function askCheckComment(ctx: Context, user: User, data: CheckCreationState, action: string) {
  user.currentState = JSON.stringify({ action, data });
  await user.save();

  let message = `✅ Параметры установлены!\n\n`;
  message += `📝 **Шаг ${action === 'creating_personal_check' ? '3' : '4'}/5: Комментарий (необязательно)**\n\n`;
  message += `Добавьте комментарий к чеку:\n\n`;
  message += `**Примеры:**\n`;
  message += `• "🎉 Бонус за активность!"\n`;
  message += `• "Спасибо за помощь"\n`;
  message += `• "Подарок от админа"\n\n`;
  message += `Или отправьте /skip для пропуска`;

  await ctx.reply(message, { parse_mode: 'Markdown' });
}

async function showCheckPreview(ctx: Context, user: User, data: CheckCreationState, action: string) {
  const amountPerActivation = Math.floor(data.totalAmount! / data.maxActivations!);
  
  let message = `📋 **ПРЕДВАРИТЕЛЬНЫЙ ПРОСМОТР ЧЕКА**\n\n`;
  message += `💳 **Тип:** ${data.type === 'personal' ? 'Персональный' : 'Мульти-чек'}\n`;
  message += `💰 **Сумма:** ${data.totalAmount!.toLocaleString()} GRAM\n`;
  message += `👥 **Активаций:** ${data.maxActivations}\n`;
  message += `💵 **На каждого:** ${amountPerActivation.toLocaleString()} GRAM\n`;
  
  if (data.comment) {
    message += `💬 **Комментарий:** ${data.comment}\n`;
  }
  
  if (data.targetUserId) {
    message += `👤 **Получатель:** указан\n`;
  }
  
  message += `\n💰 **К списанию:** ${data.totalAmount!.toLocaleString()} GRAM\n`;
  message += `💳 **Остаток:** ${((user.balance || 0) - data.totalAmount!).toLocaleString()} GRAM\n\n`;
  
  if (user.balance! < data.totalAmount!) {
    message += `❌ **Недостаточно средств!**\n`;
    message += `Не хватает: ${(data.totalAmount! - user.balance!).toLocaleString()} GRAM`;
  } else {
    message += `✅ Средств достаточно для создания чека`;
  }

  const keyboard = getBackKeyboard('checks_create');
  
  if (user.balance! >= data.totalAmount!) {
    keyboard.row().text('✅ Создать чек', `confirm_create_check`);
  } else {
    keyboard.row().text('💳 Пополнить баланс', 'cabinet_deposit');
  }

  // Сохраняем финальные данные
  user.currentState = JSON.stringify({ action: 'check_preview', data });
  await user.save();

  await ctx.reply(message, {
    reply_markup: keyboard,
    parse_mode: 'Markdown'
  });
}

async function handleCheckActivation(ctx: Context, user: User, checkCode: string) {
  try {
    const code = checkCode.toUpperCase().trim();
    
    // Ищем чек по коду
    const check = await Check.findOne({
      where: { code },
      include: [
        { model: User, as: 'creator' },
        { model: User, as: 'targetUser' }
      ]
    });

    if (!check) {
      await ctx.reply('❌ Чек с таким кодом не найден.\n\nПроверьте правильность введенного кода.');
      user.currentState = null;
      await user.save();
      return;
    }

    // Проверяем возможность активации
    const canActivate = check.canUserActivate(user.id);
    if (!canActivate.canActivate) {
      await ctx.reply(`❌ ${canActivate.reason}`);
      user.currentState = null;
      await user.save();
      return;
    }

    // Проверяем, не активировал ли уже пользователь этот чек
    const existingActivation = await CheckActivation.findOne({
      where: { checkId: check.id, userId: user.id }
    });

    if (existingActivation) {
      await ctx.reply('❌ Вы уже активировали этот чек ранее.');
      user.currentState = null;
      await user.save();
      return;
    }

    // Проверяем требование подписки
    if (check.requiredSubscription) {
      // TODO: Здесь должна быть проверка подписки
      // const isSubscribed = await telegramService.checkUserSubscription(user.telegramId, check.requiredSubscription);
      // if (!isSubscribed) {
      //   await ctx.reply(`❌ Для активации чека необходимо подписаться на ${check.requiredSubscription}`);
      //   return;
      // }
    }

    // Активируем чек
    const amountPerActivation = Math.floor(check.totalAmount / check.maxActivations);
    
    await CheckActivation.create({
      checkId: check.id,
      userId: user.id,
      amount: amountPerActivation
    });

    // Обновляем состояние чека
    await check.activate(user.id);

    // Начисляем средства пользователю
    await user.updateBalance(amountPerActivation, 'add');

    // Создаем транзакцию
    await Transaction.createCheckTransaction(user.id, amountPerActivation, (user.balance || 0) - amountPerActivation, check.id, false);

    // Уведомляем создателя чека
    if (check.creator) {
      try {
        await ctx.api.sendMessage(
          check.creator.telegramId,
          `💳 **Ваш чек активирован!**\n\n` +
          `👤 **Получатель:** ${user.getDisplayName()}\n` +
          `💰 **Сумма:** ${amountPerActivation.toLocaleString()} GRAM\n` +
          `🏷️ **Код чека:** ${check.code}\n` +
          `📊 **Активаций:** ${check.currentActivations}/${check.maxActivations}`,
          { parse_mode: 'Markdown' }
        );
      } catch (error) {
        logger.warn('Failed to notify check creator:', error.message);
      }
    }

    // Очищаем состояние
    user.currentState = null;
    await user.save();

    // Отправляем подтверждение
    let message = `🎉 **ЧЕК УСПЕШНО АКТИВИРОВАН!**\n\n`;
    message += `💰 **Получено:** ${amountPerActivation.toLocaleString()} GRAM\n`;
    message += `🏷️ **Код чека:** ${check.code}\n`;
    
    if (check.comment) {
      message += `💬 **Комментарий:** ${check.comment}\n`;
    }
    
    message += `\n💳 **Новый баланс:** ${user.balance?.toLocaleString()} GRAM\n`;
    message += `\n🙏 Спасибо за использование системы чеков!`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: '💳 Создать свой чек', callback_data: 'checks_create' },
          { text: '🏠 Главное меню', callback_data: 'main_menu' }
        ]
      ]
    };

    await ctx.reply(message, {
      reply_markup: keyboard,
      parse_mode: 'Markdown'
    });

    logger.userAction(user.telegramId, 'check_activated', {
      checkId: check.id,
      amount: amountPerActivation,
      newBalance: user.balance
    });

  } catch (error) {
    logger.error('Check activation error:', error);
    await ctx.reply('❌ Произошла ошибка при активации чека. Попробуйте позже.');
  }
}

// Экспорт функций для создания чеков
export function setupCheckCreationConfirmHandlers(bot: Bot) {
  // Подтверждение создания чека
  bot.callbackQuery('confirm_create_check', requireAuth, async (ctx) => {
    try {
      const user = ctx.session!.user!;
      const stateData = JSON.parse(user.currentState || '{}');
      const data: CheckCreationState = stateData.data;

      if (!data || !data.type || !data.totalAmount) {
        await ctx.answerCallbackQuery('❌ Ошибка: данные чека не найдены');
        return;
      }

      // Проверяем баланс еще раз
      if (user.balance! < data.totalAmount) {
        await ctx.answerCallbackQuery('❌ Недостаточно средств');
        return;
      }

      // Создаем чек
      const check = await Check.create({
        creatorId: user.id,
        code: Check.generateCode(),
        type: data.type,
        totalAmount: data.totalAmount,
        amountPerActivation: Math.floor(data.totalAmount / data.maxActivations!),
        maxActivations: data.maxActivations!,
        targetUserId: data.targetUserId,
        password: data.password,
        comment: data.comment,
        requiredSubscription: data.requiredSubscription
      });

      // Списываем средства
      await user.updateBalance(data.totalAmount, 'subtract');

      // Создаем транзакцию
      await Transaction.createCheckTransaction(user.id, data.totalAmount, user.balance! + data.totalAmount, check.id, true);

      // Очищаем состояние
      user.currentState = null;
      await user.save();

      // Формируем сообщение чека для отправки
      const checkMessage = `💳 **ЧЕК СОЗДАН!**\n\n`;
      const checkContent = formatCheckMessage(check);

      let message = `✅ **ЧЕК УСПЕШНО СОЗДАН!**\n\n`;
      message += `🏷️ **Код:** ${check.code}\n`;
      message += `💰 **Сумма:** ${data.totalAmount.toLocaleString()} GRAM\n`;
      message += `👥 **Активаций:** ${data.maxActivations}\n`;
      message += `💵 **На каждого:** ${check.amountPerActivation.toLocaleString()} GRAM\n\n`;
      message += `💳 **Остаток баланса:** ${user.balance?.toLocaleString()} GRAM\n\n`;
      message += `🎉 Чек готов к использованию! Отправьте его в любой чат или пользователю.`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: '📤 Переслать чек', callback_data: `forward_check_${check.id}` },
            { text: '📋 Скопировать код', callback_data: `copy_check_code_${check.id}` }
          ],
          [
            { text: '💳 Создать еще чек', callback_data: 'checks_create' },
            { text: '🏠 Главное меню', callback_data: 'main_menu' }
          ]
        ]
      };

      await ctx.editMessageText(message, {
        reply_markup: keyboard,
        parse_mode: 'Markdown'
      });

      // Отправляем красиво оформленный чек отдельным сообщением
      await ctx.reply(checkContent, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[
            { text: '💰 ПОЛУЧИТЬ GRAM', callback_data: `activate_check_${check.code}` }
          ]]
        }
      });

      await ctx.answerCallbackQuery('✅ Чек успешно создан!');

      logger.userAction(user.telegramId, 'check_created', {
        checkId: check.id,
        type: data.type,
        amount: data.totalAmount,
        activations: data.maxActivations
      });

    } catch (error) {
      logger.error('Create check confirmation error:', error);
      await ctx.answerCallbackQuery('❌ Произошла ошибка при создании чека');
    }
  });

  // Активация чека по кнопке
  bot.callbackQuery(/^activate_check_(.+)$/, requireAuth, async (ctx) => {
    try {
      const checkCode = ctx.match![1];
      const user = ctx.session!.user!;

      await handleCheckActivation(ctx, user, checkCode);
      await ctx.answerCallbackQuery();

    } catch (error) {
      logger.error('Activate check callback error:', error);
      await ctx.answerCallbackQuery('❌ Произошла ошибка при активации чека');
    }
  });
}

function formatCheckMessage(check: Check): string {
  let message = `💳 **ЧЕК НА GRAM**\n\n`;
  
  if (check.comment) {
    message += `💬 ${check.comment}\n\n`;
  }
  
  message += `💰 **${check.amountPerActivation.toLocaleString()} GRAM**\n`;
  message += `👥 Осталось активаций: **${check.getRemainingActivations()}/${check.maxActivations}**\n`;
  message += `⏰ Создан: ${check.createdAt.toLocaleDateString('ru-RU')}\n\n`;
  
  message += `🏷️ **Код чека:** \`${check.code}\`\n\n`;
  message += `💡 Для получения нажмите кнопку ниже`;
  
  return message;
}

export { handleCheckCreation };