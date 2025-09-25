// src/bot/handlers/admin.ts - ИСПРАВЛЕННАЯ ВЕРСИЯ БЕЗ ЗАГЛУШЕК
import { Bot, Context } from 'grammy';
import { adminMiddleware, isAdmin } from '../middlewares/admin';
import { logger } from '../../utils/logger';
import { EMOJIS } from '../../utils/constants';
import { getAdminPanelKeyboard } from '../keyboards/additional';
import { User, Task, TaskExecution, Transaction } from '../../database/models';
import { Op } from 'sequelize';
import { literal } from 'sequelize';
import { sequelize } from '../../database/config/database';

export function setupAdminHandlers(bot: Bot) {

  // Главная панель администратора
  bot.callbackQuery('admin_panel', adminMiddleware, async (ctx) => {
    try {
      const user = ctx.session!.user!;
      
      logger.userAction(user.telegramId, 'admin_panel_opened');

      // Получаем быструю статистику
      const [
        totalUsers,
        totalTasks,
        pendingExecutions,
        totalBalance
      ] = await Promise.all([
        User.count(),
        Task.count(),
        TaskExecution.count({ where: { status: 'in_review' } }),
        User.sum('balance')
      ]);

      let message = `${EMOJIS.key} **АДМИН-ПАНЕЛЬ**\n\n`;
      message += `📊 **Быстрая статистика:**\n`;
      message += `├ Пользователей: ${totalUsers.toLocaleString()}\n`;
      message += `├ Заданий: ${totalTasks.toLocaleString()}\n`;
      message += `├ На проверке: ${pendingExecutions}\n`;
      message += `└ Общий баланс: ${(totalBalance || 0).toLocaleString()} GRAM\n\n`;
      message += `Выберите раздел для управления:`;

      await ctx.editMessageText(message, {
        reply_markup: getAdminPanelKeyboard(),
        parse_mode: 'Markdown'
      });

      await ctx.answerCallbackQuery();
    } catch (error) {
      logger.error('Admin panel error:', error);
      await ctx.answerCallbackQuery('Произошла ошибка');
    }
  });

  // Общая статистика системы
  bot.callbackQuery('admin_general_stats', adminMiddleware, async (ctx) => {
    try {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      // Статистика пользователей
      const [
        totalUsers,
        activeUsers,
        newUsersToday,
        newUsersYesterday,
        premiumUsers,
        bannedUsers
      ] = await Promise.all([
        User.count(),
        User.count({ where: { isActive: true, isBanned: false } }),
        User.count({ where: { registeredAt: { [Op.gte]: today } } }),
        User.count({ where: { registeredAt: { [Op.gte]: yesterday, [Op.lt]: today } } }),
        User.count({ where: { isPremium: true } }),
        User.count({ where: { isBanned: true } })
      ]);

      // Статистика заданий
      const [
        totalTasks,
        activeTasks,
        tasksToday,
        completedTasks,
        expiredTasks
      ] = await Promise.all([
        Task.count(),
        Task.count({ where: { status: 'active' } }),
        Task.count({ where: { createdAt: { [Op.gte]: today } } }),
        Task.count({ where: { status: 'completed' } }),
        Task.count({ where: { status: 'expired' } })
      ]);

      // Статистика выполнений
      const [
        totalExecutions,
        completedExecutions,
        pendingExecutions,
        rejectedExecutions,
        executionsToday
      ] = await Promise.all([
        TaskExecution.count(),
        TaskExecution.count({ where: { status: { [Op.in]: ['completed', 'auto_approved'] } } }),
        TaskExecution.count({ where: { status: 'in_review' } }),
        TaskExecution.count({ where: { status: 'rejected' } }),
        TaskExecution.count({ where: { createdAt: { [Op.gte]: today } } })
      ]);

      // Финансовая статистика
      const [
        totalBalance,
        totalTransactions,
        transactionsToday,
        totalVolume
      ] = await Promise.all([
        User.sum('balance'),
        Transaction.count({ where: { status: 'completed' } }),
        Transaction.count({ where: { createdAt: { [Op.gte]: today }, status: 'completed' } }),
        Transaction.sum('amount', { where: { status: 'completed' } })
      ]);

      let message = `📊 **ОБЩАЯ СТАТИСТИКА СИСТЕМЫ**\n\n`;
      
      message += `👥 **Пользователи:**\n`;
      message += `├ Всего: ${totalUsers.toLocaleString()}\n`;
      message += `├ Активных: ${activeUsers.toLocaleString()}\n`;
      message += `├ Новых сегодня: ${newUsersToday} (вчера: ${newUsersYesterday})\n`;
      message += `├ Premium: ${premiumUsers.toLocaleString()}\n`;
      message += `└ Заблокированных: ${bannedUsers}\n\n`;
      
      message += `📋 **Задания:**\n`;
      message += `├ Всего: ${totalTasks.toLocaleString()}\n`;
      message += `├ Активных: ${activeTasks.toLocaleString()}\n`;
      message += `├ Завершенных: ${completedTasks.toLocaleString()}\n`;
      message += `├ Истекших: ${expiredTasks.toLocaleString()}\n`;
      message += `└ Создано сегодня: ${tasksToday}\n\n`;
      
      message += `⚡ **Выполнения:**\n`;
      message += `├ Всего: ${totalExecutions.toLocaleString()}\n`;
      message += `├ Завершенных: ${completedExecutions.toLocaleString()}\n`;
      message += `├ На проверке: ${pendingExecutions}\n`;
      message += `├ Отклоненных: ${rejectedExecutions}\n`;
      message += `└ Сегодня: ${executionsToday}\n\n`;
      
      message += `💰 **Финансы:**\n`;
      message += `├ Общий баланс: ${(totalBalance || 0).toLocaleString()} GRAM\n`;
      message += `├ Транзакций: ${totalTransactions.toLocaleString()}\n`;
      message += `├ Сегодня: ${transactionsToday}\n`;
      message += `└ Общий оборот: ${(totalVolume || 0).toLocaleString()} GRAM`;

      const keyboard = {
        inline_keyboard: [[
          { text: '🔄 Обновить', callback_data: 'admin_general_stats' },
          { text: '⬅️ Назад', callback_data: 'admin_panel' }
        ]]
      };

      await ctx.editMessageText(message, {
        reply_markup: keyboard,
        parse_mode: 'Markdown'
      });

      await ctx.answerCallbackQuery();
    } catch (error) {
      logger.error('Admin general stats error:', error);
      await ctx.answerCallbackQuery('Произошла ошибка');
    }
  });

  // Управление пользователями
  bot.callbackQuery('admin_users_management', adminMiddleware, async (ctx) => {
    try {
      let message = `👥 **УПРАВЛЕНИЕ ПОЛЬЗОВАТЕЛЯМИ**\n\n`;
      message += `Функции управления пользователями:`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: '🔍 Поиск пользователя', callback_data: 'admin_user_search' },
            { text: '📊 Статистика', callback_data: 'admin_user_stats' }
          ],
          [
            { text: '🏆 Топ пользователей', callback_data: 'admin_user_top' },
            { text: '🚫 Заблокированные', callback_data: 'admin_user_banned' }
          ],
          [
            { text: '💎 Premium', callback_data: 'admin_user_premium' },
            { text: '📈 Новые', callback_data: 'admin_user_new' }
          ],
          [
            { text: '⬅️ Назад', callback_data: 'admin_panel' }
          ]
        ]
      };

      await ctx.editMessageText(message, {
        reply_markup: keyboard,
        parse_mode: 'Markdown'
      });

      await ctx.answerCallbackQuery();
    } catch (error) {
      logger.error('Admin users management error:', error);
      await ctx.answerCallbackQuery('Произошла ошибка');
    }
  });

  // Поиск пользователя
  bot.callbackQuery('admin_user_search', adminMiddleware, async (ctx) => {
    try {
      const user = ctx.session!.user!;
      
      user.currentState = JSON.stringify({ action: 'admin_searching_user', data: {} });
      await user.save();

      let message = `🔍 **ПОИСК ПОЛЬЗОВАТЕЛЯ**\n\n`;
      message += `Введите один из следующих параметров для поиска:\n\n`;
      message += `• **Telegram ID** (числовой ID)\n`;
      message += `• **Username** (без @)\n`;
      message += `• **Имя пользователя**\n\n`;
      message += `Например: \`123456789\` или \`username\``;

      const keyboard = {
        inline_keyboard: [[
          { text: '❌ Отмена', callback_data: 'admin_users_management' }
        ]]
      };

      await ctx.editMessageText(message, {
        reply_markup: keyboard,
        parse_mode: 'Markdown'
      });

      await ctx.answerCallbackQuery();
    } catch (error) {
      logger.error('Admin user search error:', error);
      await ctx.answerCallbackQuery('Произошла ошибка');
    }
  });

  // Статистика пользователей
  bot.callbackQuery('admin_user_stats', adminMiddleware, async (ctx) => {
    try {
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      // Детальная статистика пользователей
      const [
        totalUsers,
        activeLastWeek,
        activeLastMonth,
        averageBalance,
        topBalanceUser,
        usersByLevel
      ] = await Promise.all([
        User.count(),
        User.count({ where: { lastActiveAt: { [Op.gte]: weekAgo } } }),
        User.count({ where: { lastActiveAt: { [Op.gte]: monthAgo } } }),
        User.findOne({
          attributes: [[sequelize.literal('AVG(balance)'), 'avgBalance']],
          raw: true
        }),
        User.findOne({
          order: [['balance', 'DESC']],
          attributes: ['balance', 'firstName', 'username']
        }),
        User.findAll({
          attributes: [
            'level',
            [sequelize.literal('COUNT(*)'), 'count']
          ],
          group: ['level'],
          raw: true
        })
      ]);

      let message = `👥 **ДЕТАЛЬНАЯ СТАТИСТИКА ПОЛЬЗОВАТЕЛЕЙ**\n\n`;
      
      message += `📊 **Активность:**\n`;
      message += `├ Всего пользователей: ${totalUsers.toLocaleString()}\n`;
      message += `├ Активных за неделю: ${activeLastWeek.toLocaleString()}\n`;
      message += `├ Активных за месяц: ${activeLastMonth.toLocaleString()}\n`;
      message += `└ Коэффициент удержания: ${Math.round((activeLastWeek / totalUsers) * 100)}%\n\n`;
      
      message += `💰 **Финансы:**\n`;
      message += `├ Средний баланс: ${Math.round((averageBalance as any)?.avgBalance || 0).toLocaleString()} GRAM\n`;
      message += `├ Топ баланс: ${(topBalanceUser?.balance || 0).toLocaleString()} GRAM\n`;
      message += `└ Владелец: ${topBalanceUser?.firstName || topBalanceUser?.username || 'Неизвестно'}\n\n`;
      
      message += `🏆 **Распределение по уровням:**\n`;
      usersByLevel.forEach((level: any) => {
        const levelName = level.level === 'bronze' ? 'Бронза' : 
                         level.level === 'silver' ? 'Серебро' :
                         level.level === 'gold' ? 'Золото' : 'Премиум';
        message += `├ ${levelName}: ${level.count}\n`;
      });

      const keyboard = {
        inline_keyboard: [
          [
            { text: '🔄 Обновить', callback_data: 'admin_user_stats' },
            { text: '🏆 Топ пользователи', callback_data: 'admin_user_top' }
          ],
          [
            { text: '⬅️ Назад', callback_data: 'admin_users_management' }
          ]
        ]
      };

      await ctx.editMessageText(message, {
        reply_markup: keyboard,
        parse_mode: 'Markdown'
      });

      await ctx.answerCallbackQuery();
    } catch (error) {
      logger.error('Admin user stats error:', error);
      await ctx.answerCallbackQuery('Произошла ошибка');
    }
  });

  // Топ пользователей
  bot.callbackQuery('admin_user_top', adminMiddleware, async (ctx) => {
    try {
      const [
        topByBalance,
        topByEarned,
        topByTasks,
        topByReferrals
      ] = await Promise.all([
        User.findAll({
          order: [['balance', 'DESC']],
          limit: 5,
          attributes: ['telegramId', 'firstName', 'username', 'balance']
        }),
        User.findAll({
          order: [['totalEarned', 'DESC']],
          limit: 5,
          attributes: ['telegramId', 'firstName', 'username', 'totalEarned']
        }),
        User.findAll({
          order: [['tasksCompleted', 'DESC']],
          limit: 5,
          attributes: ['telegramId', 'firstName', 'username', 'tasksCompleted']
        }),
        User.findAll({
          order: [['referralsCount', 'DESC']],
          limit: 5,
          attributes: ['telegramId', 'firstName', 'username', 'referralsCount']
        })
      ]);

      let message = `🏆 **ТОП ПОЛЬЗОВАТЕЛЕЙ**\n\n`;
      
      message += `💰 **По балансу:**\n`;
      topByBalance.forEach((user, i) => {
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
        const name = user.firstName || user.username || `ID${user.telegramId}`;
        message += `${medal} ${name} - ${(user.balance || 0).toLocaleString()} GRAM\n`;
      });

      message += `\n⚡ **По заданиям:**\n`;
      topByTasks.forEach((user, i) => {
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
        const name = user.firstName || user.username || `ID${user.telegramId}`;
        message += `${medal} ${name} - ${user.tasksCompleted || 0} заданий\n`;
      });

      message += `\n🤝 **По рефералам:**\n`;
      topByReferrals.forEach((user, i) => {
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
        const name = user.firstName || user.username || `ID${user.telegramId}`;
        message += `${medal} ${name} - ${user.referralsCount || 0} рефералов\n`;
      });

      const keyboard = {
        inline_keyboard: [
          [
            { text: '📊 Статистика', callback_data: 'admin_user_stats' },
            { text: '🔍 Поиск', callback_data: 'admin_user_search' }
          ],
          [
            { text: '⬅️ Назад', callback_data: 'admin_users_management' }
          ]
        ]
      };

      await ctx.editMessageText(message, {
        reply_markup: keyboard,
        parse_mode: 'Markdown'
      });

      await ctx.answerCallbackQuery();
    } catch (error) {
      logger.error('Admin user top error:', error);
      await ctx.answerCallbackQuery('Произошла ошибка');
    }
  });

  // Заблокированные пользователи
  bot.callbackQuery('admin_user_banned', adminMiddleware, async (ctx) => {
    try {
      const bannedUsers = await User.findAll({
        where: { isBanned: true },
        order: [['updatedAt', 'DESC']],
        limit: 10,
        attributes: ['id', 'telegramId', 'firstName', 'username', 'updatedAt']
      });

      let message = `🚫 **ЗАБЛОКИРОВАННЫЕ ПОЛЬЗОВАТЕЛИ** (${bannedUsers.length})\n\n`;

      if (bannedUsers.length === 0) {
        message += `✅ Нет заблокированных пользователей.`;
      } else {
        bannedUsers.forEach((user, i) => {
          const name = user.firstName || user.username || `ID${user.telegramId}`;
          const date = user.updatedAt.toLocaleDateString('ru-RU');
          message += `${i + 1}. ${name}\n`;
          message += `ID: ${user.telegramId}\n`;
          message += `Заблокирован: ${date}\n\n`;
        });
      }

      const keyboard = {
        inline_keyboard: [
          [
            { text: '🔄 Обновить', callback_data: 'admin_user_banned' },
            { text: '🔍 Поиск пользователя', callback_data: 'admin_user_search' }
          ],
          [
            { text: '⬅️ Назад', callback_data: 'admin_users_management' }
          ]
        ]
      };

      await ctx.editMessageText(message, {
        reply_markup: keyboard,
        parse_mode: 'Markdown'
      });

      await ctx.answerCallbackQuery();
    } catch (error) {
      logger.error('Admin banned users error:', error);
      await ctx.answerCallbackQuery('Произошла ошибка');
    }
  });

  // Premium пользователи
  bot.callbackQuery('admin_user_premium', adminMiddleware, async (ctx) => {
    try {
      const premiumUsers = await User.findAll({
        where: { isPremium: true },
        order: [['balance', 'DESC']],
        limit: 10,
        attributes: ['telegramId', 'firstName', 'username', 'balance', 'premiumExpiresAt']
      });

      let message = `💎 **PREMIUM ПОЛЬЗОВАТЕЛИ** (${premiumUsers.length})\n\n`;

      if (premiumUsers.length === 0) {
        message += `ℹ️ Нет Premium пользователей.`;
      } else {
        premiumUsers.forEach((user, i) => {
          const name = user.firstName || user.username || `ID${user.telegramId}`;
          const expires = user.premiumExpiresAt ? 
            user.premiumExpiresAt.toLocaleDateString('ru-RU') : 'Бессрочно';
          message += `${i + 1}. 💎 ${name}\n`;
          message += `💰 ${(user.balance || 0).toLocaleString()} GRAM\n`;
          message += `📅 До: ${expires}\n\n`;
        });
      }

      const keyboard = {
        inline_keyboard: [
          [
            { text: '🔄 Обновить', callback_data: 'admin_user_premium' },
            { text: '🔍 Поиск пользователя', callback_data: 'admin_user_search' }
          ],
          [
            { text: '⬅️ Назад', callback_data: 'admin_users_management' }
          ]
        ]
      };

      await ctx.editMessageText(message, {
        reply_markup: keyboard,
        parse_mode: 'Markdown'
      });

      await ctx.answerCallbackQuery();
    } catch (error) {
      logger.error('Admin premium users error:', error);
      await ctx.answerCallbackQuery('Произошла ошибка');
    }
  });

  // Новые пользователи
  bot.callbackQuery('admin_user_new', adminMiddleware, async (ctx) => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const newUsers = await User.findAll({
        where: {
          registeredAt: { [Op.gte]: today }
        },
        order: [['registeredAt', 'DESC']],
        limit: 15,
        attributes: ['telegramId', 'firstName', 'username', 'registeredAt', 'referrerId'],
        include: [
          {
            model: User,
            as: 'referrer',
            attributes: ['firstName', 'username'],
            required: false
          }
        ]
      });

      let message = `📈 **НОВЫЕ ПОЛЬЗОВАТЕЛИ СЕГОДНЯ** (${newUsers.length})\n\n`;

      if (newUsers.length === 0) {
        message += `ℹ️ Сегодня новых регистраций пока нет.`;
      } else {
        newUsers.forEach((user, i) => {
          const name = user.firstName || user.username || `ID${user.telegramId}`;
          const time = user.registeredAt.toLocaleTimeString('ru-RU', { 
            hour: '2-digit', 
            minute: '2-digit' 
          });
          const referrerName = user.referrer ? 
            (user.referrer.firstName || user.referrer.username || 'Неизвестно') : 
            'Прямая регистрация';
          
          message += `${i + 1}. ${name}\n`;
          message += `⏰ ${time} | 🤝 ${referrerName}\n\n`;
        });
      }

      const keyboard = {
        inline_keyboard: [
          [
            { text: '🔄 Обновить', callback_data: 'admin_user_new' },
            { text: '📊 Статистика', callback_data: 'admin_user_stats' }
          ],
          [
            { text: '⬅️ Назад', callback_data: 'admin_users_management' }
          ]
        ]
      };

      await ctx.editMessageText(message, {
        reply_markup: keyboard,
        parse_mode: 'Markdown'
      });

      await ctx.answerCallbackQuery();
    } catch (error) {
      logger.error('Admin new users error:', error);
      await ctx.answerCallbackQuery('Произошла ошибка');
    }
  });

  // Модерация заданий
  bot.callbackQuery('admin_tasks_pending', adminMiddleware, async (ctx) => {
    try {
      const pendingExecutions = await TaskExecution.findAll({
        where: { status: 'in_review' },
        include: [
          {
            model: Task,
            as: 'task',
            include: [{ model: User, as: 'author' }]
          },
          {
            model: User,
            as: 'user'
          }
        ],
        order: [['createdAt', 'ASC']],
        limit: 10
      });

      let message = `🔍 **ЗАДАНИЯ НА МОДЕРАЦИИ** (${pendingExecutions.length})\n\n`;

      if (pendingExecutions.length === 0) {
        message += `✅ Нет заданий, ожидающих проверки.`;
      } else {
        pendingExecutions.forEach((execution, index) => {
          const task = execution.task;
          const user = execution.user;
          const timeAgo = Math.floor((Date.now() - execution.createdAt.getTime()) / (1000 * 60 * 60));
          
          message += `${index + 1}. **${task?.title || 'Задание'}**\n`;
          message += `👤 ${user?.getDisplayName() || 'Неизвестно'}\n`;
          message += `💰 ${execution.rewardAmount} GRAM\n`;
          message += `⏰ ${timeAgo}ч назад\n`;
          message += `🔗 /moderate_${execution.id}\n\n`;
        });
      }

      const keyboard = {
        inline_keyboard: [
          [
            { text: '🔄 Обновить', callback_data: 'admin_tasks_pending' },
            { text: '⬅️ Назад', callback_data: 'admin_panel' }
          ]
        ]
      };

      await ctx.editMessageText(message, {
        reply_markup: keyboard,
        parse_mode: 'Markdown'
      });

      await ctx.answerCallbackQuery();
    } catch (error) {
      logger.error('Admin tasks pending error:', error);
      await ctx.answerCallbackQuery('Произошла ошибка');
    }
  });

  // Обработка поиска пользователя
  bot.on('message:text', async (ctx, next) => {
    try {
      const user = ctx.session?.user;
      if (!user || !isAdmin(user.telegramId)) {
        return next();
      }

      const stateData = JSON.parse(user.currentState || '{}');
      if (stateData.action !== 'admin_searching_user') {
        return next();
      }

      const searchTerm = ctx.message.text.trim();
      
      // Поиск пользователя
      let foundUser = null;
      
      // Поиск по Telegram ID
      if (/^\d+$/.test(searchTerm)) {
        foundUser = await User.findOne({
          where: { telegramId: parseInt(searchTerm) }
        });
      }
      
      // Поиск по username
      if (!foundUser && searchTerm.length > 0) {
        foundUser = await User.findOne({
          where: { username: searchTerm.replace('@', '') }
        });
      }
      
      // Поиск по имени
      if (!foundUser) {
        foundUser = await User.findOne({
          where: {
            [Op.or]: [
              { firstName: { [Op.iLike]: `%${searchTerm}%` } },
              { lastName: { [Op.iLike]: `%${searchTerm}%` } }
            ]
          }
        });
      }

      user.currentState = null;
      await user.save();

      if (!foundUser) {
        await ctx.reply(
          `❌ Пользователь не найден.\n\nПопробуйте другой поисковый запрос.`,
          {
            reply_markup: {
              inline_keyboard: [[
                { text: '🔍 Новый поиск', callback_data: 'admin_user_search' },
                { text: '⬅️ Назад', callback_data: 'admin_users_management' }
              ]]
            }
          }
        );
        return;
      }

      // Показываем информацию о пользователе
      const referralsCount = await User.count({ where: { referrerId: foundUser.id } });
      const tasksCount = await Task.count({ where: { authorId: foundUser.id } });
      const executionsCount = await TaskExecution.count({ where: { userId: foundUser.id } });

      let message = `👤 **ИНФОРМАЦИЯ О ПОЛЬЗОВАТЕЛЕ**\n\n`;
      message += `🆔 **ID:** ${foundUser.telegramId}\n`;
      message += `👨‍💼 **Имя:** ${foundUser.getDisplayName()}\n`;
      if (foundUser.username) {
        message += `📱 **Username:** @${foundUser.username}\n`;
      }
      message += `🏆 **Уровень:** ${foundUser.getLevelText()} ${foundUser.getLevelEmoji()}\n`;
      message += `💰 **Баланс:** ${foundUser.balance?.toLocaleString() || 0} GRAM\n`;
      message += `📊 **Статус:** ${foundUser.isActive ? '🟢 Активен' : '🔴 Неактивен'}\n`;
      if (foundUser.isBanned) {
        message += `🚫 **Заблокирован:** Да\n`;
      }
      message += `\n📈 **Активность:**\n`;
      message += `├ Создано заданий: ${tasksCount}\n`;
      message += `├ Выполнено заданий: ${executionsCount}\n`;
      message += `├ Рефералов: ${referralsCount}\n`;
      message += `├ Заработано: ${foundUser.totalEarned?.toLocaleString() || 0} GRAM\n`;
      message += `└ Потрачено: ${foundUser.totalSpent?.toLocaleString() || 0} GRAM\n\n`;
      message += `📅 **Даты:**\n`;
      message += `├ Регистрация: ${foundUser.registeredAt.toLocaleDateString('ru-RU')}\n`;
      message += `└ Последняя активность: ${foundUser.lastActiveAt.toLocaleDateString('ru-RU')}`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: foundUser.isBanned ? '✅ Разблокировать' : '🚫 Заблокировать', 
              callback_data: `admin_user_${foundUser.isBanned ? 'unban' : 'ban'}_${foundUser.id}` },
            { text: foundUser.isPremium ? '⭐ Убрать Premium' : '💎 Дать Premium', 
              callback_data: `admin_user_${foundUser.isPremium ? 'unpremium' : 'premium'}_${foundUser.id}` }
          ],
          [
            { text: '💰 Изменить баланс', callback_data: `admin_user_balance_${foundUser.id}` },
            { text: '📊 Подробная статистика', callback_data: `admin_user_detailed_${foundUser.id}` }
          ],
          [
            { text: '🔍 Новый поиск', callback_data: 'admin_user_search' },
            { text: '⬅️ Назад', callback_data: 'admin_users_management' }
          ]
        ]
      };

      await ctx.reply(message, {
        reply_markup: keyboard,
        parse_mode: 'Markdown'
      });

    } catch (error) {
      logger.error('Admin user search handler error:', error);
      await next();
    }
  });

  // Блокировка пользователя
  bot.callbackQuery(/^admin_user_ban_(\d+)$/, adminMiddleware, async (ctx) => {
    try {
      const userId = parseInt(ctx.match![1]);
      const targetUser = await User.findByPk(userId);
      
      if (!targetUser) {
        await ctx.answerCallbackQuery('❌ Пользователь не найден');
        return;
      }

      targetUser.isBanned = true;
      targetUser.isActive = false;
      await targetUser.save();

      logger.userAction(ctx.session!.user!.telegramId, 'admin_user_banned', { targetUserId: userId });

      await ctx.answerCallbackQuery(`✅ Пользователь ${targetUser.getDisplayName()} заблокирован`);

      // Обновляем сообщение - показываем информацию об обновленном пользователе
      let message = `👤 **ПОЛЬЗОВАТЕЛЬ ЗАБЛОКИРОВАН**\n\n`;
      message += `🆔 **ID:** ${targetUser.telegramId}\n`;
      message += `👨‍💼 **Имя:** ${targetUser.getDisplayName()}\n`;
      message += `📊 **Статус:** 🚫 Заблокирован\n\n`;
      message += `Пользователь больше не может использовать бота.`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: '✅ Разблокировать', callback_data: `admin_user_unban_${userId}` },
            { text: '🔍 Новый поиск', callback_data: 'admin_user_search' }
          ],
          [
            { text: '⬅️ Назад', callback_data: 'admin_users_management' }
          ]
        ]
      };

      await ctx.editMessageText(message, {
        reply_markup: keyboard,
        parse_mode: 'Markdown'
      });

    } catch (error) {
      logger.error('Admin ban user error:', error);
      await ctx.answerCallbackQuery('❌ Произошла ошибка');
    }
  });

  // Разблокировка пользователя
  bot.callbackQuery(/^admin_user_unban_(\d+)$/, adminMiddleware, async (ctx) => {
    try {
      const userId = parseInt(ctx.match![1]);
      const targetUser = await User.findByPk(userId);
      
      if (!targetUser) {
        await ctx.answerCallbackQuery('❌ Пользователь не найден');
        return;
      }

      targetUser.isBanned = false;
      targetUser.isActive = true;
      await targetUser.save();

      logger.userAction(ctx.session!.user!.telegramId, 'admin_user_unbanned', { targetUserId: userId });

      await ctx.answerCallbackQuery(`✅ Пользователь ${targetUser.getDisplayName()} разблокирован`);

      // Обновляем сообщение
      let message = `👤 **ПОЛЬЗОВАТЕЛЬ РАЗБЛОКИРОВАН**\n\n`;
      message += `🆔 **ID:** ${targetUser.telegramId}\n`;
      message += `👨‍💼 **Имя:** ${targetUser.getDisplayName()}\n`;
      message += `📊 **Статус:** 🟢 Активен\n\n`;
      message += `Пользователь снова может использовать бота.`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: '🚫 Заблокировать', callback_data: `admin_user_ban_${userId}` },
            { text: '🔍 Новый поиск', callback_data: 'admin_user_search' }
          ],
          [
            { text: '⬅️ Назад', callback_data: 'admin_users_management' }
          ]
        ]
      };

      await ctx.editMessageText(message, {
        reply_markup: keyboard,
        parse_mode: 'Markdown'
      });

    } catch (error) {
      logger.error('Admin unban user error:', error);
      await ctx.answerCallbackQuery('❌ Произошла ошибка');
    }
  });

  // Выдача Premium
  bot.callbackQuery(/^admin_user_premium_(\d+)$/, adminMiddleware, async (ctx) => {
    try {
      const userId = parseInt(ctx.match![1]);
      const targetUser = await User.findByPk(userId);
      
      if (!targetUser) {
        await ctx.answerCallbackQuery('❌ Пользователь не найден');
        return;
      }

      targetUser.isPremium = true;
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + 30);
      targetUser.premiumExpiresAt = expiryDate;

      await targetUser.save();

      logger.userAction(ctx.session!.user!.telegramId, 'admin_user_premium_granted', { targetUserId: userId });

      await ctx.answerCallbackQuery(`✅ Premium выдан пользователю ${targetUser.getDisplayName()}`);

      try {
        await ctx.api.sendMessage(
          targetUser.telegramId,
          `🎉 Поздравляем!\n\nВам выдан Premium статус на 30 дней!\n\n💎 Теперь вы получаете больше бонусов и привилегий.`
        );
      } catch (notifyError) {
        logger.warn('Failed to notify user about premium:', notifyError);
      }
    } catch (error) {
      logger.error('Admin premium grant error:', error);
      await ctx.answerCallbackQuery('❌ Произошла ошибка');
    }
  });

  // Снятие Premium
  bot.callbackQuery(/^admin_user_unpremium_(\d+)$/, adminMiddleware, async (ctx) => {
    try {
      const userId = parseInt(ctx.match![1]);
      const targetUser = await User.findByPk(userId);
      
      if (!targetUser) {
        await ctx.answerCallbackQuery('❌ Пользователь не найден');
        return;
      }

      targetUser.isPremium = false;
      targetUser.premiumExpiresAt = null;

      await targetUser.save();

      logger.userAction(ctx.session!.user!.telegramId, 'admin_user_premium_removed', { targetUserId: userId });

      await ctx.answerCallbackQuery(`✅ Premium снят у пользователя ${targetUser.getDisplayName()}`);
    } catch (error) {
      logger.error('Admin unpremium error:', error);
      await ctx.answerCallbackQuery('❌ Произошла ошибка');
    }
  });

  // Изменение баланса
  bot.callbackQuery(/^admin_user_balance_(\d+)$/, adminMiddleware, async (ctx) => {
    try {
      const userId = parseInt(ctx.match![1]);
      const user = ctx.session!.user!;
      
      user.currentState = JSON.stringify({ 
        action: 'admin_changing_balance', 
        data: { targetUserId: userId } 
      });
      await user.save();

      const targetUser = await User.findByPk(userId);
      if (!targetUser) {
        await ctx.answerCallbackQuery('❌ Пользователь не найден');
        return;
      }

      let message = `💰 **ИЗМЕНЕНИЕ БАЛАНСА**\n\n`;
      message += `👤 **Пользователь:** ${targetUser.getDisplayName()}\n`;
      message += `💳 **Текущий баланс:** ${targetUser.balance?.toLocaleString() || 0} GRAM\n\n`;
      message += `Введите сумму для изменения баланса:\n\n`;
      message += `**Примеры:**\n`;
      message += `• \`+1000\` - добавить 1000 GRAM\n`;
      message += `• \`-500\` - убрать 500 GRAM\n`;
      message += `• \`5000\` - установить баланс 5000 GRAM`;

      const keyboard = {
        inline_keyboard: [[
          { text: '❌ Отмена', callback_data: 'admin_users_management' }
        ]]
      };

      await ctx.editMessageText(message, {
        reply_markup: keyboard,
        parse_mode: 'Markdown'
      });

      await ctx.answerCallbackQuery();
    } catch (error) {
      logger.error('Admin change balance error:', error);
      await ctx.answerCallbackQuery('❌ Произошла ошибка');
    }
  });

  // Рассылка
  bot.callbackQuery('admin_broadcast', adminMiddleware, async (ctx) => {
    try {
      const user = ctx.session!.user!;
      
      user.currentState = JSON.stringify({ action: 'admin_creating_broadcast', data: {} });
      await user.save();

      let message = `📢 **СОЗДАНИЕ РАССЫЛКИ**\n\n`;
      message += `Введите текст сообщения для рассылки всем пользователям.\n\n`;
      message += `**Поддерживается Markdown форматирование:**\n`;
      message += `• **жирный текст**\n`;
      message += `• *курсив*\n`;
      message += `• \`код\`\n`;
      message += `• [ссылки](https://example.com)\n\n`;
      message += `⚠️ **Внимание:** Сообщение будет отправлено ВСЕМ активным пользователям бота!`;

      const keyboard = {
        inline_keyboard: [[
          { text: '❌ Отмена', callback_data: 'admin_panel' }
        ]]
      };

      await ctx.editMessageText(message, {
        reply_markup: keyboard,
        parse_mode: 'Markdown'
      });

      await ctx.answerCallbackQuery();
    } catch (error) {
      logger.error('Admin broadcast error:', error);
      await ctx.answerCallbackQuery('Произошла ошибка');
    }
  });

  // Обработка рассылки и изменения баланса
  bot.on('message:text', async (ctx, next) => {
    try {
      const user = ctx.session?.user;
      if (!user || !isAdmin(user.telegramId)) {
        return next();
      }

      const stateData = JSON.parse(user.currentState || '{}');
      
      if (stateData.action === 'admin_creating_broadcast') {
        await handleBroadcastCreation(ctx, user);
        return;
      } else if (stateData.action === 'admin_changing_balance') {
        await handleBalanceChange(ctx, user, stateData.data);
        return;
      }
      
      await next();
    } catch (error) {
      logger.error('Admin text handler error:', error);
      await next();
    }
  });

  // Подтверждение рассылки
  bot.callbackQuery(/^confirm_broadcast_(.+)$/, adminMiddleware, async (ctx) => {
    try {
      const encodedText = ctx.match![1];
      const broadcastText = Buffer.from(encodedText, 'base64').toString();

      await ctx.editMessageText('📤 **Рассылка запущена...**\n\nОтправляем сообщения пользователям...', {
        parse_mode: 'Markdown'
      });

      // Получаем всех пользователей для рассылки
      const users = await User.findAll({
        where: { 
          isActive: true,
          isBanned: false
        },
        attributes: ['telegramId']
      });

      let sent = 0;
      let failed = 0;

      // Отправляем сообщения порциями
      const chunkSize = 30; // 30 сообщений в секунду (лимит Telegram)
      for (let i = 0; i < users.length; i += chunkSize) {
        const chunk = users.slice(i, i + chunkSize);
        
        await Promise.all(
          chunk.map(async (user) => {
            try {
              await ctx.api.sendMessage(user.telegramId, broadcastText, { parse_mode: 'Markdown' });
              sent++;
            } catch (error: unknown) {
              failed++;
              logger.warn(`Broadcast failed for user ${user.telegramId}:`, error);
            }
          })
        );

        // Задержка между порциями
        if (i + chunkSize < users.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      const finalMessage = `✅ **Рассылка завершена!**\n\n` +
                          `📤 Отправлено: ${sent.toLocaleString()}\n` +
                          `❌ Ошибок: ${failed.toLocaleString()}\n` +
                          `📊 Успешность: ${Math.round((sent / users.length) * 100)}%`;

      await ctx.editMessageText(finalMessage, {
        reply_markup: {
          inline_keyboard: [[
            { text: '⬅️ В админ-панель', callback_data: 'admin_panel' }
          ]]
        },
        parse_mode: 'Markdown'
      });

      logger.userAction(ctx.session!.user!.telegramId, 'admin_broadcast_sent', { 
        sent, 
        failed, 
        total: users.length,
        text: broadcastText.substring(0, 100)
      });

      await ctx.answerCallbackQuery(`✅ Рассылка завершена: ${sent}/${users.length}`);

    } catch (error) {
      logger.error('Confirm broadcast error:', error);
      await ctx.answerCallbackQuery('❌ Произошла ошибка при рассылке');
    }
  });

  logger.info('✅ Admin handlers configured');
}

// Вспомогательные функции
async function handleBroadcastCreation(ctx: Context, user: User) {
  const broadcastText = ctx.message!.text!;

  user.currentState = null;
  await user.save();

  // Получаем всех активных пользователей
  const users = await User.findAll({
    where: { 
      isActive: true,
      isBanned: false
    },
    attributes: ['telegramId']
  });

  let message = `📢 **ПОДТВЕРЖДЕНИЕ РАССЫЛКИ**\n\n`;
  message += `**Получателей:** ${users.length.toLocaleString()} пользователей\n\n`;
  message += `**Текст сообщения:**\n`;
  message += `${broadcastText}\n\n`;
  message += `⚠️ Подтвердите отправку рассылки:`;

  const keyboard = {
    inline_keyboard: [
      [
        { text: '✅ Отправить рассылку', callback_data: `confirm_broadcast_${Buffer.from(broadcastText).toString('base64')}` },
        { text: '❌ Отмена', callback_data: 'admin_panel' }
      ]
    ]
  };

  await ctx.reply(message, {
    reply_markup: keyboard,
    parse_mode: 'Markdown'
  });
}

async function handleBalanceChange(ctx: Context, user: User, data: any) {
  const input = ctx.message!.text!.trim();
  const targetUserId = data.targetUserId;

  user.currentState = null;
  await user.save();

  const targetUser = await User.findByPk(targetUserId);
  if (!targetUser) {
    await ctx.reply('❌ Пользователь не найден.');
    return;
  }

  let amount: number;
  let operation: 'add' | 'subtract' | 'set' = 'set';

  if (input.startsWith('+')) {
    amount = parseInt(input.substring(1));
    operation = 'add';
  } else if (input.startsWith('-')) {
    amount = parseInt(input.substring(1));
    operation = 'subtract';
  } else {
    amount = parseInt(input);
    operation = 'set';
  }

  if (isNaN(amount) || amount < 0) {
    await ctx.reply('❌ Неверный формат суммы. Используйте числа.');
    return;
  }

  const oldBalance = targetUser.balance || 0;
  let newBalance: number;

  try {
    switch (operation) {
      case 'add':
        newBalance = oldBalance + amount;
        await targetUser.updateBalance(amount, 'add');
        break;
      case 'subtract':
        if (oldBalance < amount) {
          await ctx.reply(`❌ Недостаточно средств у пользователя. Баланс: ${oldBalance} GRAM`);
          return;
        }
        newBalance = oldBalance - amount;
        await targetUser.updateBalance(amount, 'subtract');
        break;
      case 'set':
        newBalance = amount;
        targetUser.balance = amount;
        await targetUser.save();
        break;
    }

    // Создаем транзакцию для истории
    await Transaction.create({
      userId: targetUser.id,
      type: operation === 'add' ? 'admin_bonus' : operation === 'subtract' ? 'admin_deduction' : 'admin_adjustment',
      amount: Math.abs(newBalance - oldBalance),
      balanceBefore: oldBalance,
      balanceAfter: newBalance,
      description: `Изменение баланса администратором`,
      status: 'completed',
      processedAt: new Date()
    });

    let message = `✅ **Баланс изменен!**\n\n`;
    message += `👤 **Пользователь:** ${targetUser.getDisplayName()}\n`;
    message += `💰 **Было:** ${oldBalance.toLocaleString()} GRAM\n`;
    message += `💳 **Стало:** ${newBalance.toLocaleString()} GRAM\n`;
    message += `📊 **Изменение:** ${operation === 'add' ? '+' : operation === 'subtract' ? '-' : ''}${Math.abs(newBalance - oldBalance).toLocaleString()} GRAM`;

    await ctx.reply(message, {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '🔍 Найти другого', callback_data: 'admin_user_search' },
            { text: '⬅️ Назад', callback_data: 'admin_users_management' }
          ]
        ]
      },
      parse_mode: 'Markdown'
    });

    // Уведомляем пользователя
    try {
      const changeText = operation === 'add' ? 'увеличен' : operation === 'subtract' ? 'уменьшен' : 'изменен';
      await ctx.api.sendMessage(
        targetUser.telegramId,
        `💰 **Ваш баланс ${changeText}**\n\n` +
        `Новый баланс: ${newBalance.toLocaleString()} GRAM\n\n` +
        `Изменение внесено администратором.`
      );
    } catch (notifyError) {
      logger.warn('Failed to notify user about balance change:', notifyError);
    }

    logger.userAction(user.telegramId, 'admin_balance_changed', {
      targetUserId: targetUser.id,
      oldBalance,
      newBalance,
      operation,
      amount
    });

  } catch (error) {
    logger.error('Balance change error:', error);
    await ctx.reply('❌ Произошла ошибка при изменении баланса.');
  }
}