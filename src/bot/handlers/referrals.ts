// src/bot/handlers/referrals.ts
import { Bot, Context } from 'grammy';
import { requireAuth } from '../middlewares/auth';
import { logger } from '../../utils/logger';
import { EMOJIS } from '../../utils/constants';
import { getReferralsKeyboard, getPaginationKeyboard, getBackKeyboard } from '../keyboards/main';
import { formatReferralStats } from '../../utils/formatters/init';
import { User, Transaction } from '../../database/models';
import { Op } from 'sequelize';

export function setupReferralsHandlers(bot: Bot) {

  // Главное меню реферальной системы
  bot.callbackQuery('referrals', requireAuth, async (ctx) => {
    try {
      const user = ctx.session!.user!;
      
      logger.userAction(user.telegramId, 'referrals_opened');

      // Получаем статистику рефералов
      const referrals = await User.findAll({
        where: { referrerId: user.id },
        attributes: ['id', 'username', 'firstName', 'lastName', 'level', 'totalEarned', 'registeredAt', 'lastActiveAt'],
        order: [['registeredAt', 'DESC']]
      });

      const totalReferrals = referrals.length;
      const premiumReferrals = referrals.filter(r => r.level === 'premium').length;
      const activeReferrals = referrals.filter(r => {
        const daysSinceActive = (Date.now() - r.lastActiveAt.getTime()) / (1000 * 60 * 60 * 24);
        return daysSinceActive <= 7; // активные за последние 7 дней
      }).length;

      // Рассчитываем заработок с рефералов
      const totalEarnedFromReferrals = await Transaction.sum('amount', {
        where: {
          userId: user.id,
          type: 'referral_bonus'
        }
      }) || 0;

      let message = `${EMOJIS.referrals} **РЕФЕРАЛЬНАЯ СИСТЕМА**\n\n`;
      message += `Приглашайте друзей и зарабатывайте!\n\n`;
      message += `📊 **ВАША СТАТИСТИКА:**\n`;
      message += `├ Всего рефералов: **${totalReferrals}**\n`;
      message += `├ Premium рефералов: **${premiumReferrals}** 💎\n`;
      message += `├ Активных (7 дней): **${activeReferrals}**\n`;
      message += `└ Заработано: **${totalEarnedFromReferrals.toLocaleString()} GRAM**\n\n`;
      
      message += `💰 **ДОХОДЫ:**\n`;
      message += `• **3,000 GRAM** за Premium реферала\n`;
      message += `• **1,000 GRAM** за обычного реферала\n`;
      message += `• **10%** от пополнений рефералов\n`;
      message += `• **5%** от заработка рефералов на заданиях\n\n`;
      
      message += `🔗 **ВАША ССЫЛКА:**\n`;
      message += `\`t.me/${ctx.me.username}?start=${user.telegramId}\``;

      await ctx.editMessageText(message, {
        reply_markup: getReferralsKeyboard(),
        parse_mode: 'Markdown'
      });

      await ctx.answerCallbackQuery();
    } catch (error) {
      logger.error('Referrals handler error:', error);
      await ctx.answerCallbackQuery('Произошла ошибка');
    }
  });

  // Реферальная ссылка
  bot.callbackQuery('referrals_link', requireAuth, async (ctx) => {
    try {
      const user = ctx.session!.user!;
      
      const referralLink = `https://t.me/${ctx.me.username}?start=${user.telegramId}`;
      
      let message = `🔗 **ВАША РЕФЕРАЛЬНАЯ ССЫЛКА**\n\n`;
      message += `\`${referralLink}\`\n\n`;
      message += `📤 **Как использовать:**\n`;
      message += `• Отправьте ссылку друзьям\n`;
      message += `• Разместите в соц. сетях\n`;
      message += `• Добавьте в биографию канала\n`;
      message += `• Используйте в сообщениях\n\n`;
      message += `💡 **Совет:** Расскажите друзьям о возможностях заработка в боте!`;

      const keyboard = getBackKeyboard('referrals')
        .row()
        .text('📋 Копировать ссылку', `copy_referral_link`)
        .text('📤 Поделиться', `share_referral_link`);

      await ctx.editMessageText(message, {
        reply_markup: keyboard,
        parse_mode: 'Markdown'
      });

      await ctx.answerCallbackQuery();
    } catch (error) {
      logger.error('Referrals link error:', error);
      await ctx.answerCallbackQuery('Произошла ошибка');
    }
  });

  // Копирование реферальной ссылки
  bot.callbackQuery('copy_referral_link', requireAuth, async (ctx) => {
    try {
      const user = ctx.session!.user!;
      const referralLink = `https://t.me/${ctx.me.username}?start=${user.telegramId}`;
      
      await ctx.answerCallbackQuery(`📋 Ссылка скопирована!\n${referralLink}`, { show_alert: true });
    } catch (error) {
      logger.error('Copy referral link error:', error);
      await ctx.answerCallbackQuery('Произошла ошибка');
    }
  });

  // Поделиться реферальной ссылкой
  bot.callbackQuery('share_referral_link', requireAuth, async (ctx) => {
    try {
      const user = ctx.session!.user!;
      const referralLink = `https://t.me/${ctx.me.username}?start=${user.telegramId}`;
      
      let shareText = `🚀 Присоединяйся к PR GRAM Bot!\n\n`;
      shareText += `💰 Зарабатывай GRAM за простые действия:\n`;
      shareText += `• Подписки на каналы\n`;
      shareText += `• Просмотры постов\n`;
      shareText += `• Взаимодействие с ботами\n\n`;
      shareText += `🎁 Начни зарабатывать прямо сейчас!\n\n`;
      shareText += referralLink;
      
      const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${encodeURIComponent(shareText)}`;
      
      const keyboard = getBackKeyboard('referrals_link')
        .row()
        .url('📤 Поделиться в Telegram', shareUrl);

      await ctx.editMessageText(
        `📤 **ПОДЕЛИТЬСЯ ССЫЛКОЙ**\n\n` +
        `Используйте кнопку ниже для быстрого создания сообщения с вашей реферальной ссылкой.\n\n` +
        `Или скопируйте готовый текст:\n\n` +
        `\`\`\`\n${shareText}\`\`\``,
        {
          reply_markup: keyboard,
          parse_mode: 'Markdown'
        }
      );

      await ctx.answerCallbackQuery();
    } catch (error) {
      logger.error('Share referral link error:', error);
      await ctx.answerCallbackQuery('Произошла ошибка');
    }
  });

  // Статистика рефералов
  bot.callbackQuery('referrals_stats', requireAuth, async (ctx) => {
    try {
      const user = ctx.session!.user!;

      // Получаем детальную статистику
      const referrals = await User.findAll({
        where: { referrerId: user.id },
        attributes: ['id', 'username', 'firstName', 'lastName', 'level', 'totalEarned', 'tasksCompleted', 'registeredAt', 'lastActiveAt']
      });

      const now = new Date();
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const statsToday = referrals.filter(r => 
        r.registeredAt.toDateString() === now.toDateString()
      ).length;

      const statsWeek = referrals.filter(r => 
        r.registeredAt >= oneWeekAgo
      ).length;

      const statsMonth = referrals.filter(r => 
        r.registeredAt >= oneMonthAgo
      ).length;

      const activeReferrals = referrals.filter(r => 
        r.lastActiveAt >= oneWeekAgo
      ).length;

      const totalEarnedByReferrals = referrals.reduce((sum, r) => sum + (r.totalEarned || 0), 0);
      const avgEarningsPerReferral = referrals.length > 0 ? Math.floor(totalEarnedByReferrals / referrals.length) : 0;

      // Статистика по уровням
      const levelStats = referrals.reduce((acc, r) => {
        acc[r.level] = (acc[r.level] || 0) + 1;
        return acc;
      }, {} as { [key: string]: number });

      let message = `📊 **ДЕТАЛЬНАЯ СТАТИСТИКА**\n\n`;
      
      message += `📅 **По периодам:**\n`;
      message += `├ За сегодня: ${statsToday}\n`;
      message += `├ За неделю: ${statsWeek}\n`;
      message += `├ За месяц: ${statsMonth}\n`;
      message += `└ Всего: ${referrals.length}\n\n`;
      
      message += `👥 **По активности:**\n`;
      message += `├ Активных (7 дней): ${activeReferrals}\n`;
      message += `├ Неактивных: ${referrals.length - activeReferrals}\n`;
      message += `└ Коэффициент удержания: ${referrals.length > 0 ? Math.round((activeReferrals / referrals.length) * 100) : 0}%\n\n`;
      
      message += `🏆 **По уровням:**\n`;
      message += `├ Bronze: ${levelStats.bronze || 0}\n`;
      message += `├ Silver: ${levelStats.silver || 0}\n`;
      message += `├ Gold: ${levelStats.gold || 0}\n`;
      message += `└ Premium: ${levelStats.premium || 0}\n\n`;
      
      message += `💰 **Заработок рефералов:**\n`;
      message += `├ Общий: ${totalEarnedByReferrals.toLocaleString()} GRAM\n`;
      message += `└ Средний: ${avgEarningsPerReferral.toLocaleString()} GRAM`;

      const keyboard = getBackKeyboard('referrals')
        .row()
        .text('👥 Список рефералов', 'referrals_list')
        .text('💰 Мои доходы', 'referrals_bonuses');

      await ctx.editMessageText(message, {
        reply_markup: keyboard,
        parse_mode: 'Markdown'
      });

      await ctx.answerCallbackQuery();
    } catch (error) {
      logger.error('Referrals stats error:', error);
      await ctx.answerCallbackQuery('Произошла ошибка');
    }
  });

  // Список рефералов
  bot.callbackQuery(/^referrals_list(?:_page_(\d+))?$/, requireAuth, async (ctx) => {
    try {
      const user = ctx.session!.user!;
      const page = parseInt(ctx.match![1] || '1');
      const limit = 5;
      const offset = (page - 1) * limit;

      const { rows: referrals, count } = await User.findAndCountAll({
        where: { referrerId: user.id },
        attributes: ['id', 'username', 'firstName', 'lastName', 'level', 'totalEarned', 'registeredAt', 'lastActiveAt'],
        order: [['registeredAt', 'DESC']],
        limit,
        offset
      });

      const totalPages = Math.ceil(count / limit);

      let message = `👥 **МОИ РЕФЕРАЛЫ** (${count})\n\n`;

      if (referrals.length === 0) {
        message += `${EMOJIS.info} У вас пока нет рефералов.\n\n`;
        message += `Поделитесь своей реферальной ссылкой с друзьями!`;
      } else {
        referrals.forEach((referral, index) => {
          const globalIndex = offset + index + 1;
          const levelEmoji = referral.getLevelEmoji();
          const displayName = referral.getDisplayName();
          const earnedAmount = referral.totalEarned || 0;
          const registrationDate = referral.registeredAt.toLocaleDateString('ru-RU');
          
          // Проверяем активность (последние 7 дней)
          const daysSinceActive = Math.floor((Date.now() - referral.lastActiveAt.getTime()) / (1000 * 60 * 60 * 24));
          const activityStatus = daysSinceActive <= 7 ? '🟢' : '🔴';

          message += `${globalIndex}. ${levelEmoji} **${displayName}**\n`;
          message += `${activityStatus} ${referral.getLevelText()} | ${earnedAmount.toLocaleString()} GRAM\n`;
          message += `📅 ${registrationDate}\n\n`;
        });
      }

      const keyboard = getPaginationKeyboard(
        page,
        totalPages,
        'referrals_list',
        [
          { text: '🔗 Пригласить друзей', data: 'referrals_link' },
          { text: '📊 Статистика', data: 'referrals_stats' }
        ]
      );

      await ctx.editMessageText(message, {
        reply_markup: keyboard,
        parse_mode: 'Markdown'
      });

      await ctx.answerCallbackQuery();
    } catch (error) {
      logger.error('Referrals list error:', error);
      await ctx.answerCallbackQuery('Произошла ошибка');
    }
  });

  // Мои бонусы с рефералов
  bot.callbackQuery(/^referrals_bonuses(?:_page_(\d+))?$/, requireAuth, async (ctx) => {
    try {
      const user = ctx.session!.user!;
      const page = parseInt(ctx.match![1] || '1');
      const limit = 10;
      const offset = (page - 1) * limit;

      // Получаем транзакции реферальных бонусов
      const { rows: transactions, count } = await Transaction.findAndCountAll({
        where: {
          userId: user.id,
          type: 'referral_bonus'
        },
        include: [
          {
            model: User,
            as: 'relatedUser',
            attributes: ['username', 'firstName', 'lastName']
          }
        ],
        order: [['createdAt', 'DESC']],
        limit,
        offset
      });

      const totalPages = Math.ceil(count / limit);

      // Рассчитываем общую сумму
      const totalEarned = await Transaction.sum('amount', {
        where: {
          userId: user.id,
          type: 'referral_bonus'
        }
      }) || 0;

      let message = `💰 **МОИ РЕФЕРАЛЬНЫЕ ДОХОДЫ**\n\n`;
      message += `💎 **Всего заработано:** ${totalEarned.toLocaleString()} GRAM\n`;
      message += `📊 **Транзакций:** ${count}\n\n`;

      if (transactions.length === 0) {
        message += `${EMOJIS.info} Пока нет доходов с рефералов.\n\n`;
        message += `Приглашайте друзей и получайте бонусы за их активность!`;
      } else {
        message += `📝 **Последние операции:**\n\n`;
        
        transactions.forEach((transaction, index) => {
          const globalIndex = offset + index + 1;
          const amount = transaction.amount;
          const relatedUser = transaction.relatedUser;
          const date = transaction.createdAt.toLocaleDateString('ru-RU');
          
          message += `${globalIndex}. **+${amount.toLocaleString()} GRAM**\n`;
          if (relatedUser) {
            message += `👤 ${relatedUser.getDisplayName()}\n`;
          }
          message += `📅 ${date}\n\n`;
        });
      }

      const keyboard = getPaginationKeyboard(
        page,
        totalPages,
        'referrals_bonuses',
        [
          { text: '👥 Мои рефералы', data: 'referrals_list' },
          { text: '📊 Статистика', data: 'referrals_stats' }
        ]
      );

      await ctx.editMessageText(message, {
        reply_markup: keyboard,
        parse_mode: 'Markdown'
      });

      await ctx.answerCallbackQuery();
    } catch (error) {
      logger.error('Referrals bonuses error:', error);
      await ctx.answerCallbackQuery('Произошла ошибка');
    }
  });

  // Топ рефералов
  bot.callbackQuery('referrals_top', requireAuth, async (ctx) => {
    try {
      const user = ctx.session!.user!;

      // Получаем топ рефералов по заработку
      const topReferrals = await User.findAll({
        where: { referrerId: user.id },
        attributes: ['username', 'firstName', 'lastName', 'level', 'totalEarned'],
        order: [['totalEarned', 'DESC']],
        limit: 10
      });

      let message = `🏆 **ТОП РЕФЕРАЛОВ**\n\n`;

      if (topReferrals.length === 0) {
        message += `${EMOJIS.info} У вас пока нет рефералов для отображения топа.`;
      } else {
        message += `По заработку GRAM:\n\n`;
        
        topReferrals.forEach((referral, index) => {
          const position = index + 1;
          const medal = position === 1 ? '🥇' : position === 2 ? '🥈' : position === 3 ? '🥉' : `${position}.`;
          const levelEmoji = referral.getLevelEmoji();
          const displayName = referral.getDisplayName();
          const earned = referral.totalEarned || 0;

          message += `${medal} ${levelEmoji} ${displayName}\n`;
          message += `💰 ${earned.toLocaleString()} GRAM\n\n`;
        });
      }

      const keyboard = getBackKeyboard('referrals_stats')
        .row()
        .text('👥 Все рефералы', 'referrals_list')
        .text('💰 Мои доходы', 'referrals_bonuses');

      await ctx.editMessageText(message, {
        reply_markup: keyboard,
        parse_mode: 'Markdown'
      });

      await ctx.answerCallbackQuery();
    } catch (error) {
      logger.error('Referrals top error:', error);
      await ctx.answerCallbackQuery('Произошла ошибка');
    }
  });

  // Калькулятор доходов
  bot.callbackQuery('referrals_calculator', requireAuth, async (ctx) => {
    try {
      const user = ctx.session!.user!;
      
      let message = `🧮 **КАЛЬКУЛЯТОР ДОХОДОВ**\n\n`;
      message += `Рассчитайте потенциальный доход от рефералов:\n\n`;
      
      message += `💰 **Разовые бонусы:**\n`;
      message += `• За обычного реферала: **1,000 GRAM**\n`;
      message += `• За Premium реферала: **3,000 GRAM**\n\n`;
      
      message += `📊 **Постоянные доходы:**\n`;
      message += `• 10% от пополнений рефералов\n`;
      message += `• 5% от заработка на заданиях\n\n`;
      
      message += `🔢 **Примеры расчетов:**\n\n`;
      
      message += `**10 обычных рефералов:**\n`;
      message += `├ Разовый доход: 10,000 GRAM\n`;
      message += `├ Если каждый пополнит на 5,000: +2,500 GRAM\n`;
      message += `└ Если каждый заработает 10,000: +5,000 GRAM\n`;
      message += `**Итого: ~17,500 GRAM**\n\n`;
      
      message += `**5 Premium рефералов:**\n`;
      message += `├ Разовый доход: 15,000 GRAM\n`;
      message += `├ Если каждый пополнит на 20,000: +10,000 GRAM\n`;
      message += `└ Если каждый заработает 50,000: +12,500 GRAM\n`;
      message += `**Итого: ~37,500 GRAM**\n\n`;
      
      message += `💡 **Совет:** Чем активнее ваши рефералы, тем больше ваш доход!`;

      const keyboard = getBackKeyboard('referrals')
        .row()
        .text('🔗 Получить ссылку', 'referrals_link')
        .text('📊 Моя статистика', 'referrals_stats');

      await ctx.editMessageText(message, {
        reply_markup: keyboard,
        parse_mode: 'Markdown'
      });

      await ctx.answerCallbackQuery();
    } catch (error) {
      logger.error('Referrals calculator error:', error);
      await ctx.answerCallbackQuery('Произошла ошибка');
    }
  });

  // Маркетинг материалы
  bot.callbackQuery('referrals_marketing', requireAuth, async (ctx) => {
    try {
      const user = ctx.session!.user!;
      
      let message = `📢 **МАРКЕТИНГ МАТЕРИАЛЫ**\n\n`;
      message += `Готовые тексты для привлечения рефералов:\n\n`;
      
      message += `**🔹 Короткий вариант:**\n`;
      message += `"💰 Зарабатывай в PR GRAM Bot!\n`;
      message += `Простые задания = реальные деньги\n`;
      message += `Попробуй прямо сейчас 👇"\n\n`;
      
      message += `**🔹 Подробный вариант:**\n`;
      message += `"🚀 Новый способ заработка в Telegram!\n\n`;
      message += `💰 PR GRAM Bot предлагает:\n`;
      message += `• Деньги за подписки на каналы\n`;
      message += `• Оплата за просмотры постов\n`;
      message += `• Бонусы за активность\n\n`;
      message += `🎁 Регистрация по моей ссылке = бонус!\n`;
      message += `Начни зарабатывать уже сегодня 👇"\n\n`;
      
      message += `**🔹 Для соцсетей:**\n`;
      message += `"💎 Открыл для себя крутой бот!\n`;
      message += `Можно зарабатывать на простых действиях\n`;
      message += `За час набрал уже 500+ GRAM 🔥\n`;
      message += `Кто со мной? Ссылка в комментах 👇"\n\n`;
      
      message += `**🔹 Для бизнес-каналов:**\n`;
      message += `"📈 Ищете дополнительный доход?\n`;
      message += `PR GRAM Bot - легальный заработок в крипте\n`;
      message += `✅ Без вложений и рисков\n`;
      message += `✅ Выплаты каждый день\n`;
      message += `Начните прямо сейчас 👇"`;

      const keyboard = getBackKeyboard('referrals')
        .row()
        .text('📋 Копировать текст', 'copy_marketing_text')
        .text('📤 Поделиться', 'share_referral_link');

      await ctx.editMessageText(message, {
        reply_markup: keyboard,
        parse_mode: 'Markdown'
      });

      await ctx.answerCallbackQuery();
    } catch (error) {
      logger.error('Referrals marketing error:', error);
      await ctx.answerCallbackQuery('Произошла ошибка');
    }
  });

  logger.info('✅ Referrals handlers configured');
}