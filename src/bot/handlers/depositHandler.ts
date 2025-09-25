// src/bot/handlers/depositHandler.ts - ИСПРАВЛЕННЫЙ ОБРАБОТЧИК ПОПОЛНЕНИЯ
import { Bot } from 'grammy';
import { requireAuth } from '../middlewares/auth';
import { logger } from '../../utils/logger';
import { EMOJIS } from '../../utils/constants';

export function setupDepositHandler(bot: Bot) {
  // Пополнение баланса
  bot.callbackQuery('cabinet_deposit', requireAuth, async (ctx) => {
    try {
      let message = `${EMOJIS.money} **ПОПОЛНЕНИЕ БАЛАНСА**\n\n`;
      message += `Выберите сумму для пополнения:\n\n`;
      message += `${EMOJIS.info} **Курс:** 1 Star = 10 GRAM\n`;
      message += `${EMOJIS.gift} **Бонусы:**\n`;
      message += `• При пополнении от 450 Stars: +10% бонус\n`;
      message += `• При пополнении от 850 Stars: +15% бонус\n`;
      message += `• При пополнении от 2000 Stars: +20% бонус + 1000 GRAM\n\n`;
      message += `${EMOJIS.diamond} Пополнение через Telegram Stars обеспечивает мгновенное зачисление средств.`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: '💳 100 Stars = 1,000 GRAM', callback_data: 'deposit_100' },
            { text: '💎 450 Stars = 4,950 GRAM', callback_data: 'deposit_450' }
          ],
          [
            { text: '🔥 850 Stars = 9,775 GRAM', callback_data: 'deposit_850' },
            { text: '⭐ 2000 Stars = 25,000 GRAM', callback_data: 'deposit_2000' }
          ],
          [
            { text: `${EMOJIS.info} Информация о Stars`, callback_data: 'deposit_info' }
          ],
          [
            { text: `${EMOJIS.back} Назад в кабинет`, callback_data: 'cabinet' }
          ]
        ]
      };

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

  // Информация о Stars
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
      message += `• 1 Star = 10 GRAM\n\n`;
      
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
        inline_keyboard: [
          [
            { text: '⬅️ Назад к пополнению', callback_data: 'cabinet_deposit' }
          ]
        ]
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

  logger.info('✅ Deposit handler configured');
}