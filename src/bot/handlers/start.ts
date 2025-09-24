// src/bot/handlers/start.ts
import { Bot, Context } from 'grammy';
import { requireAuth } from '../middlewares/auth';
import { logger } from '../../utils/logger';
import { EMOJIS } from '../../utils/constants';
import { getMainMenuKeyboard } from '../keyboards/main';
import { formatUserProfile } from '../../utils/formatters';

// Стартовое сообщение для новых пользователей
const WELCOME_MESSAGE = `${EMOJIS.star} **Добро пожаловать в PR GRAM Bot!**

Зарабатывайте GRAM за простые действия:
${EMOJIS.channel} Подписки на каналы
${EMOJIS.group} Вступление в группы  
${EMOJIS.view} Просмотры постов
${EMOJIS.reaction} Реакции и переходы
${EMOJIS.bot} Взаимодействие с ботами

${EMOJIS.money} Тратьте GRAM на продвижение своих проектов

${EMOJIS.gift} Приглашайте друзей и получайте бонусы!

Выберите действие в меню ниже:`;

// Обработчик команды /start
export function setupStartHandler(bot: Bot) {
  bot.command('start', requireAuth, async (ctx: Context) => {
    try {
      const user = ctx.session!.user!;
      
      logger.userAction(user.telegramId, 'start_command', {
        isNewUser: user.createdAt.getTime() > Date.now() - 60000,
        balance: user.balance,
        level: user.getLevel()
      });

      let message: string;
      let isNewUser = false;

      // Проверяем, новый ли пользователь (зарегистрирован менее 5 минут назад)
      if (user.createdAt.getTime() > Date.now() - 5 * 60 * 1000) {
        message = WELCOME_MESSAGE;
        isNewUser = true;
      } else {
        // Формируем профиль для возвращающегося пользователя
        message = `${EMOJIS.home} **С возвращением!**\n\n${formatUserProfile(user)}`;
      }

      // Отправляем сообщение с главным меню
      await ctx.reply(message, {
        reply_markup: getMainMenuKeyboard(),
        parse_mode: 'Markdown'
      });

      // Для новых пользователей показываем дополнительную информацию
      if (isNewUser) {
        setTimeout(async () => {
          try {
            const tipsMessage = `${EMOJIS.info} **Полезные советы:**

${EMOJIS.money} Начните с выполнения заданий в разделе "Заработать"
${EMOJIS.chart} Следите за статистикой в личном кабинете
${EMOJIS.referrals} Приглашайте друзей и получайте бонусы
${EMOJIS.diamond} Повышайте уровень для больших наград

${EMOJIS.help} Если возникнут вопросы, используйте раздел "Помощь"`;

            await ctx.reply(tipsMessage, {
              parse_mode: 'Markdown'
            });
          } catch (error) {
            logger.error('Failed to send tips message:', error);
          }
        }, 2000);
      }

    } catch (error) {
      logger.error('Start handler error:', error, {
        userId: ctx.from?.id,
        username: ctx.from?.username
      });

      await ctx.reply(
        `${EMOJIS.cross} Произошла ошибка при обработке команды. Попробуйте позже.`
      );
    }
  });

  // Обработчик callback для главного меню
  bot.callbackQuery('main_menu', requireAuth, async (ctx) => {
    try {
      const user = ctx.session!.user!;
      
      const message = `${EMOJIS.home} **Главное меню**\n\n${formatUserProfile(user)}`;

      await ctx.editMessageText(message, {
        reply_markup: getMainMenuKeyboard(),
        parse_mode: 'Markdown'
      });

      await ctx.answerCallbackQuery();
    } catch (error) {
      logger.error('Main menu callback error:', error);
      await ctx.answerCallbackQuery('Произошла ошибка');
    }
  });

  // Команда /menu
  bot.command('menu', requireAuth, async (ctx) => {
    try {
      const user = ctx.session!.user!;
      
      const message = `${EMOJIS.home} **Главное меню**\n\n${formatUserProfile(user)}`;

      await ctx.reply(message, {
        reply_markup: getMainMenuKeyboard(),
        parse_mode: 'Markdown'
      });
    } catch (error) {
      logger.error('Menu command error:', error);
      await ctx.reply('Произошла ошибка при отображении меню');
    }
  });

  logger.info('✅ Start handler configured');
}