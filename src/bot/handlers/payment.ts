// src/bot/handlers/payment.ts
import { Bot, Context } from 'grammy';
import { requireAuth } from '../middlewares/auth';
import { logger } from '../../utils/logger';
import { EMOJIS } from '../../utils/constants';
import { User, Transaction } from '../../database/models';
import { config } from '../../config';

export function setupPaymentHandlers(bot: Bot) {

  // Обработчики пополнения баланса через Telegram Stars
  bot.callbackQuery(/^deposit_(\d+)$/, requireAuth, async (ctx) => {
    try {
      const starsAmount = parseInt(ctx.match![1]);
      const user = ctx.session!.user!;

      logger.userAction(user.telegramId, 'deposit_initiated', { starsAmount });

      // Рассчитываем количество GRAM
      const baseGramAmount = starsAmount * config.payment.exchangeRate;
      let bonusPercentage = 0;
      let bonusGram = 0;
      let extraBonus = 0;

      // Определяем бонусы
      if (starsAmount >= 2000) {
        bonusPercentage = 20;
        extraBonus = 1000;
      } else if (starsAmount >= 850) {
        bonusPercentage = 15;
      } else if (starsAmount >= 450) {
        bonusPercentage = 10;
      }

      if (bonusPercentage > 0) {
        bonusGram = Math.floor(baseGramAmount * (bonusPercentage / 100));
      }

      const totalGramAmount = baseGramAmount + bonusGram + extraBonus;

      let title = `Пополнение ${totalGramAmount.toLocaleString()} GRAM`;
      let description = `Пополнение баланса на ${starsAmount} Stars = ${baseGramAmount.toLocaleString()} GRAM`;

      if (bonusGram > 0 || extraBonus > 0) {
        description += ` + ${(bonusGram + extraBonus).toLocaleString()} GRAM бонус`;
        title += ` (включая бонус)`;
      }

      // Создаем инвойс
      const invoice = {
        title,
        description,
        payload: JSON.stringify({
          userId: user.id,
          starsAmount,
          gramAmount: totalGramAmount,
          bonusGram: bonusGram + extraBonus
        }),
        provider_token: '', // Для Stars не нужен
        currency: 'XTR', // Telegram Stars
        prices: [{ label: title, amount: starsAmount }],
        max_tip_amount: 0,
        suggested_tip_amounts: [],
        start_parameter: 'deposit',
        photo_url: undefined,
        photo_size: undefined,
        photo_width: undefined,
        photo_height: undefined,
        need_name: false,
        need_phone_number: false,
        need_email: false,
        need_shipping_address: false,
        send_phone_number_to_provider: false,
        send_email_to_provider: false,
        is_flexible: false
      };

      await ctx.answerCallbackQuery();

      await bot.api.sendInvoice(
        user.id,                        // chat_id
        invoice.title,                  // title
        invoice.description,            // description
        invoice.payload,                // payload
        invoice.currency,               // currency
        invoice.prices,                 // prices
        {                               // other: объект с опциональными полями
          need_name: invoice.need_name,
          need_phone_number: invoice.need_phone_number,
          need_email: invoice.need_email,
          need_shipping_address: invoice.need_shipping_address,
          send_phone_number_to_provider: invoice.send_phone_number_to_provider,
          send_email_to_provider: invoice.send_email_to_provider,
          is_flexible: invoice.is_flexible,
        }
      );

      logger.info(`Invoice sent to user ${user.telegramId} for ${starsAmount} stars`);

    } catch (error) {
      logger.error('Deposit handler error:', error);
      await ctx.answerCallbackQuery('❌ Произошла ошибка при создании платежа');
    }
  });

  // Обработка pre_checkout_query (предварительная проверка)
  bot.on('pre_checkout_query', async (ctx) => {
    try {
      const query = ctx.preCheckoutQuery;
      const payload = JSON.parse(query.invoice_payload);
      
      logger.info('Pre-checkout query received', {
        userId: payload.userId,
        starsAmount: payload.starsAmount,
        gramAmount: payload.gramAmount
      });

      // Проверяем валидность данных
      const user = await User.findByPk(payload.userId);
      if (!user) {
        await ctx.answerPreCheckoutQuery(false, 'Пользователь не найден');
        return;
      }

      if (user.isBanned) {
        await ctx.answerPreCheckoutQuery(false, 'Аккаунт заблокирован');
        return;
      }

      // Подтверждаем платеж
      await ctx.answerPreCheckoutQuery(true);

    } catch (error) {
      logger.error('Pre-checkout query error:', error);
      await ctx.answerPreCheckoutQuery(false, 'Произошла ошибка при обработке платежа');
    }
  });

  // Обработка успешного платежа
  bot.on('message:successful_payment', requireAuth, async (ctx) => {
    try {
      const payment = ctx.message.successful_payment!;
      const payload = JSON.parse(payment.invoice_payload);
      const user = ctx.session!.user!;

      logger.info('Successful payment received', {
        userId: user.id,
        telegramPaymentChargeId: payment.telegram_payment_charge_id,
        providerPaymentChargeId: payment.provider_payment_charge_id,
        payload
      });

      // Начисляем GRAM
      const balanceBefore = user.balance || 0;
      await user.updateBalance(payload.gramAmount, 'add');

      // Создаем транзакцию
      await Transaction.createDeposit(
        user.id,
        payload.gramAmount,
        balanceBefore,
        payment.telegram_payment_charge_id,
        'telegram_stars'
      );

      // Отправляем подтверждение
      let message = `✅ **Пополнение успешно!**\n\n`;
      message += `⭐ **Оплачено:** ${payload.starsAmount} Stars\n`;
      message += `💰 **Получено:** ${payload.gramAmount.toLocaleString()} GRAM`;
      
      if (payload.bonusGram > 0) {
        message += `\n🎁 **Бонус:** ${payload.bonusGram.toLocaleString()} GRAM`;
      }
      
      message += `\n\n💳 **Новый баланс:** ${user.balance?.toLocaleString()} GRAM`;
      message += `\n\n🎉 Спасибо за пополнение! Теперь вы можете создавать задания или тратить GRAM на другие цели.`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: '📢 Создать задание', callback_data: 'advertise_create' },
            { text: '💳 Создать чек', callback_data: 'checks_create' }
          ],
          [
            { text: '🏠 Главное меню', callback_data: 'main_menu' }
          ]
        ]
      };

      await ctx.reply(message, {
        reply_markup: keyboard,
        parse_mode: 'Markdown'
      });

      logger.userAction(user.telegramId, 'deposit_completed', {
        starsAmount: payload.starsAmount,
        gramAmount: payload.gramAmount,
        bonusGram: payload.bonusGram,
        newBalance: user.balance,
        transactionId: payment.telegram_payment_charge_id
      });

    } catch (error) {
      logger.error('Successful payment handler error:', error);
      await ctx.reply('❌ Произошла ошибка при обработке платежа. Обратитесь в поддержку.');
    }
  });

  // Информация о Telegram Stars
  bot.callbackQuery('deposit_info', requireAuth, async (ctx) => {
    try {
      let message = `⭐ **ИНФОРМАЦИЯ О TELEGRAM STARS**\n\n`;
      message += `**Что такое Telegram Stars?**\n`;
      message += `Telegram Stars - это внутренняя валюта Telegram, которую можно купить прямо в приложении.\n\n`;
      
      message += `**Как купить Stars?**\n`;
      message += `1. Нажмите на кнопку пополнения\n`;
      message += `2. Выберите способ оплаты в Telegram\n`;
      message += `3. Подтвердите платеж\n`;
      message += `4. GRAM автоматически зачислятся на баланс\n\n`;
      
      message += `**Курс обмена:**\n`;
      message += `• 1 Star = ${config.payment.exchangeRate} GRAM\n\n`;
      
      message += `**Бонусы при пополнении:**\n`;
      message += `• 450+ Stars: +10% бонус\n`;
      message += `• 850+ Stars: +15% бонус\n`;
      message += `• 2000+ Stars: +20% бонус + 1000 GRAM\n\n`;
      
      message += `**Безопасность:**\n`;
      message += `✅ Мгновенное зачисление\n`;
      message += `✅ Официальный метод Telegram\n`;
      message += `✅ Никаких комиссий\n`;
      message += `✅ Поддержка всех способов оплаты`;

      const keyboard = {
        inline_keyboard: [[
          { text: '⬅️ Назад к пополнению', callback_data: 'cabinet_deposit' }
        ]]
      };

      await ctx.editMessageText(message, {
        reply_markup: keyboard,
        parse_mode: 'Markdown'
      });

      await ctx.answerCallbackQuery();
    } catch (error) {
      logger.error('Deposit info error:', error);
      await ctx.answerCallbackQuery('Произошла ошибка');
    }
  });

  logger.info('✅ Payment handlers configured');
}