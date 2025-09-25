// src/bot/handlers/index.ts - ПОЛНАЯ ИСПРАВЛЕННАЯ ВЕРСИЯ
import { Bot } from 'grammy';
import { logger } from '../../utils/logger';

// Импорт всех обработчиков
import { setupStartHandler } from './start';
import { setupCabinetHandlers } from './cabinet';
import { setupEarnHandlers } from './earn';
import { setupTaskExecutionHandlers, setupTaskModerationHandlers } from './TaskExecution';
import { setupAdvertiseHandlers, setupTaskCreationTextHandlers, setupTaskCreationFinalHandlers } from './advertise';
import { setupChecksHandlers, setupCheckTextHandlers, setupCheckCreationConfirmHandlers } from './checks';
import { setupReferralsHandlers } from './referrals';
import { setupPaymentHandlers } from './payment';
import { setupAdminHandlers } from './admin';
import { setupSubscriptionCheckHandlers, setupSubscriptionCommands, setupNewMemberHandler } from './subscriptionCheck';
import { EMOJIS } from '../../utils/constants/index'
import { requireAuth } from '../middlewares/auth';
import { Transaction, User, Task, Notification } from '../../database/models';

// Вспомогательная функция для получения названия языка
function getLanguageName(code: string): string {
  const languages: { [key: string]: string } = {
    'ru': 'Русский',
    'en': 'English', 
    'uk': 'Українська',
    'kz': 'Қазақша'
  };
  return languages[code] || 'Неизвестно';
}

// Функция для настройки всех обработчиков
export function setupHandlers(bot: Bot) {
  try {
    logger.info('🔄 Setting up bot handlers...');

    // Основные обработчики
    setupStartHandler(bot);
    setupCabinetHandlers(bot);
    
    // Модуль заработка
    setupEarnHandlers(bot);
    setupTaskExecutionHandlers(bot);
    setupTaskModerationHandlers(bot);
    
    // Модуль рекламы
    setupAdvertiseHandlers(bot);
    setupTaskCreationTextHandlers(bot);
    setupTaskCreationFinalHandlers(bot);
    
    // Модуль чеков
    setupChecksHandlers(bot);
    setupCheckTextHandlers(bot);
    setupCheckCreationConfirmHandlers(bot);
    
    // Реферальная система
    setupReferralsHandlers(bot);

    // Платежная система
    setupPaymentHandlers(bot);

    // Админская панель
    setupAdminHandlers(bot);

    // Система проверки подписки
    setupSubscriptionCheckHandlers(bot);
    setupSubscriptionCommands(bot);
    setupNewMemberHandler(bot);

    // ===== ДОПОЛНИТЕЛЬНЫЕ ОБРАБОТЧИКИ =====

    // Обработчик помощи
    bot.callbackQuery('help', async (ctx) => {
      try {
        let message = `❓ **ЦЕНТР ПОМОЩИ**\n\n`;
        message += `**🆕 Начало работы**\n`;
        message += `Зарегистрируйтесь, выберите задание и начните зарабатывать!\n\n`;
        
        message += `**💰 Заработок**\n`;
        message += `Выполняйте задания: подписки, просмотры, взаимодействие с ботами\n\n`;
        
        message += `**📢 Реклама**\n`;
        message += `Создавайте задания для продвижения своих проектов\n\n`;
        
        message += `**🔗 Рефералы**\n`;
        message += `Приглашайте друзей и получайте бонусы\n\n`;
        
        message += `**💳 Чеки**\n`;
        message += `Отправляйте GRAM через специальные чеки\n\n`;
        
        message += `**📞 Поддержка:**\n`;
        message += `@prgram_support - техническая поддержка\n`;
        message += `@prgram_chat - общий чат пользователей`;

        await ctx.editMessageText(message, {
          reply_markup: { inline_keyboard: [[{ text: '🏠 Главное меню', callback_data: 'main_menu' }]] },
          parse_mode: 'Markdown'
        });

        await ctx.answerCallbackQuery();
      } catch (error) {
        logger.error('Help handler error:', error);
        await ctx.answerCallbackQuery('Произошла ошибка');
      }
    });

    // Обработчик настроек
    bot.callbackQuery('settings', requireAuth, async (ctx) => {
      try {
        const user = ctx.session?.user;
        if (!user) {
          await ctx.answerCallbackQuery('Пользователь не найден');
          return;
        }

        const settings = user.notificationSettings as any || {};
        
        let message = `⚙️ **НАСТРОЙКИ АККАУНТА**\n\n`;
        message += `👤 **Профиль:**\n`;
        message += `├ Имя: ${user.getDisplayName()}\n`;
        message += `├ Username: ${user.username ? `@${user.username}` : 'не указан'}\n`;
        message += `├ Уровень: ${user.getLevelText()} ${user.getLevelEmoji()}\n`;
        message += `└ Язык: ${user.languageCode || 'ru'}\n\n`;
        
        message += `🔔 **Уведомления:**\n`;
        message += `├ Задания: ${settings.taskCompleted !== false ? '✅ Включены' : '❌ Отключены'}\n`;
        message += `├ Рефералы: ${settings.referralJoined !== false ? '✅ Включены' : '❌ Отключены'}\n`;
        message += `├ Баланс: ${settings.balanceUpdates !== false ? '✅ Включены' : '❌ Отключены'}\n`;
        message += `└ Системные: ${settings.systemMessages !== false ? '✅ Включены' : '❌ Отключены'}\n\n`;
        
        message += `💾 **Данные:**\n`;
        message += `├ В системе: ${Math.floor((Date.now() - user.registeredAt.getTime()) / (1000 * 60 * 60 * 24))} дней\n`;
        message += `├ Транзакций: ${user.tasksCompleted || 0}\n`;
        message += `└ Размер данных: ~${Math.floor((JSON.stringify(user).length / 1024) * 10) / 10} КБ`;

        const keyboard = {
          inline_keyboard: [
            [
              { text: '🔔 Настроить уведомления', callback_data: 'settings_notifications' },
              { text: '🌐 Язык интерфейса', callback_data: 'settings_language' }
            ],
            [
              { text: '🔒 Конфиденциальность', callback_data: 'settings_privacy' },
              { text: '📊 Экспорт данных', callback_data: 'settings_export' }
            ],
            [
              { text: '🔗 Реферальная ссылка', callback_data: 'referrals_link' },
              { text: '💳 Личный кабинет', callback_data: 'cabinet' }
            ],
            [
              { text: '🏠 Главное меню', callback_data: 'main_menu' }
            ]
          ]
        };

        await ctx.editMessageText(message, {
          reply_markup: keyboard,
          parse_mode: 'Markdown'
        });

        await ctx.answerCallbackQuery();
        
        logger.userAction(user.telegramId, 'settings_opened');
      } catch (error) {
        logger.error('Settings handler error:', error);
        await ctx.answerCallbackQuery('Произошла ошибка');
      }
    });

    // Настройки уведомлений
    bot.callbackQuery('settings_notifications', requireAuth, async (ctx) => {
      try {
        const user = ctx.session?.user;
        if (!user) {
          await ctx.answerCallbackQuery('Пользователь не найден');
          return;
        }

        const settings = user.notificationSettings as any || {};

        let message = `🔔 **НАСТРОЙКИ УВЕДОМЛЕНИЙ**\n\n`;
        message += `Управляйте типами уведомлений которые хотите получать:\n\n`;
        
        message += `📋 **Уведомления о заданиях:**\n`;
        message += `${settings.taskCompleted !== false ? '✅' : '❌'} Выполнение заданий\n`;
        message += `${settings.taskCreated !== false ? '✅' : '❌'} Создание заданий\n\n`;
        
        message += `👥 **Социальные уведомления:**\n`;
        message += `${settings.referralJoined !== false ? '✅' : '❌'} Новые рефералы\n\n`;
        
        message += `💰 **Финансовые уведомления:**\n`;
        message += `${settings.balanceUpdates !== false ? '✅' : '❌'} Изменения баланса\n\n`;
        
        message += `🔔 **Системные уведомления:**\n`;
        message += `${settings.systemMessages !== false ? '✅' : '❌'} Важные сообщения\n\n`;
        
        message += `💡 **Совет:** Отключение уведомлений может привести к пропуску важной информации.`;

        const keyboard = {
          inline_keyboard: [
            [
              { text: `${settings.taskCompleted !== false ? '🔕' : '🔔'} Задания`, callback_data: 'toggle_notifications_taskCompleted' },
              { text: `${settings.taskCreated !== false ? '🔕' : '🔔'} Создание`, callback_data: 'toggle_notifications_taskCreated' }
            ],
            [
              { text: `${settings.referralJoined !== false ? '🔕' : '🔔'} Рефералы`, callback_data: 'toggle_notifications_referralJoined' },
              { text: `${settings.balanceUpdates !== false ? '🔕' : '🔔'} Баланс`, callback_data: 'toggle_notifications_balanceUpdates' }
            ],
            [
              { text: `${settings.systemMessages !== false ? '🔕' : '🔔'} Системные`, callback_data: 'toggle_notifications_systemMessages' }
            ],
            [
              { text: '💾 Сохранить настройки', callback_data: 'save_notification_settings' }
            ],
            [
              { text: '⬅️ Назад', callback_data: 'settings' }
            ]
          ]
        };

        await ctx.editMessageText(message, {
          reply_markup: keyboard,
          parse_mode: 'Markdown'
        });

        await ctx.answerCallbackQuery();
      } catch (error) {
        logger.error('Settings notifications error:', error);
        await ctx.answerCallbackQuery('Произошла ошибка');
      }
    });

    // Переключение настроек уведомлений
    bot.callbackQuery(/^toggle_notifications_(.+)$/, requireAuth, async (ctx) => {
      try {
        const user = ctx.session?.user;
        if (!user) return;

        const settingKey = ctx.match![1];
        const settings = user.notificationSettings as any || {};
        
        // Переключаем настройку
        if (settings[settingKey] === undefined) {
          settings[settingKey] = false; // По умолчанию включено, переключаем в выключено
        } else {
          settings[settingKey] = !settings[settingKey];
        }
        
        user.notificationSettings = settings;
        await user.save();

        const statusText = settings[settingKey] ? 'включены' : 'отключены';
        const settingNames: { [key: string]: string } = {
          'taskCompleted': 'Уведомления о заданиях',
          'taskCreated': 'Уведомления о создании',
          'referralJoined': 'Уведомления о рефералах',
          'balanceUpdates': 'Уведомления о балансе',
          'systemMessages': 'Системные уведомления'
        };

        await ctx.answerCallbackQuery(`✅ ${settingNames[settingKey]} ${statusText}`);

        // Обновляем интерфейс
        setTimeout(async () => {
          try {
            const newUpdate = {
              ...ctx.update,
              callback_query: {
                ...ctx.update.callback_query!,
                data: 'settings_notifications'
              }
            };
            await bot.handleUpdate(newUpdate);
          } catch (error) {
            logger.error('Failed to refresh notifications settings:', error);
          }
        }, 500);
        
        logger.userAction(user.telegramId, 'notification_setting_changed', { 
          setting: settingKey, 
          value: settings[settingKey] 
        });
        
      } catch (error) {
        logger.error('Toggle notifications error:', error);
        await ctx.answerCallbackQuery('Произошла ошибка');
      }
    });

    // Сохранение настроек уведомлений
    bot.callbackQuery('save_notification_settings', requireAuth, async (ctx) => {
      try {
        const user = ctx.session?.user;
        if (!user) return;

        // Настройки уже сохранены при переключении
        await ctx.answerCallbackQuery('✅ Настройки уведомлений сохранены');
        
        logger.userAction(user.telegramId, 'notification_settings_saved');
      } catch (error) {
        logger.error('Save notification settings error:', error);
        await ctx.answerCallbackQuery('Произошла ошибка');
      }
    });

    bot.callbackQuery('settings_language', requireAuth, async (ctx) => {
      try {
        const user = ctx.session?.user;
        if (!user) {
          await ctx.answerCallbackQuery('Пользователь не найден');
          return;
        }
        
        let message = `🌐 **ЯЗЫК ИНТЕРФЕЙСА**\n\n`;
        message += `Текущий язык: **${getLanguageName(user.languageCode || 'ru')}**\n\n`;
        message += `Выберите предпочитаемый язык для интерфейса бота:\n\n`;
        message += `🔤 Доступные языки:`;

        const keyboard = {
          inline_keyboard: [
            [
              { text: `🇷🇺 Русский ${user.languageCode === 'ru' ? '✅' : ''}`, callback_data: 'set_language_ru' },
              { text: `🇺🇸 English ${user.languageCode === 'en' ? '✅' : ''}`, callback_data: 'set_language_en' }
            ],
            [
              { text: `🇺🇦 Українська ${user.languageCode === 'uk' ? '✅' : ''}`, callback_data: 'set_language_uk' },
              { text: `🇰🇿 Қазақша ${user.languageCode === 'kz' ? '✅' : ''}`, callback_data: 'set_language_kz' }
            ],
            [
              { text: '⬅️ Назад к настройкам', callback_data: 'settings' }
            ]
          ]
        };

        await ctx.editMessageText(message, {
          reply_markup: keyboard,
          parse_mode: 'Markdown'
        });

        await ctx.answerCallbackQuery();
      } catch (error) {
        logger.error('Settings language error:', error);
        await ctx.answerCallbackQuery('Произошла ошибка');
      }
    });

    bot.callbackQuery(/^set_language_(.+)$/, requireAuth, async (ctx) => {
      try {
        const user = ctx.session?.user;
        if (!user) return;

        const language = ctx.match![1];
        const oldLanguage = user.languageCode;
        
        user.languageCode = language;
        await user.save();

        const languageName = getLanguageName(language);
        await ctx.answerCallbackQuery(`✅ Язык изменен на ${languageName}`);
        
        // Обновляем интерфейс
        setTimeout(async () => {
          try {
            const newUpdate = {
              ...ctx.update,
              callback_query: {
                ...ctx.update.callback_query!,
                data: 'settings_language'
              }
            };
            await bot.handleUpdate(newUpdate);
          } catch (error) {
            logger.error('Failed to refresh language settings:', error);
          }
        }, 500);
        
        logger.userAction(user.telegramId, 'language_changed', { 
          oldLanguage, 
          newLanguage: language 
        });
      } catch (error) {
        logger.error('Set language error:', error);
        await ctx.answerCallbackQuery('Произошла ошибка');
      }
    });

    // История чеков
    bot.callbackQuery(/^checks_history(?:_page_(\d+))?$/, async (ctx) => {
      try {
        const { requireAuth } = await import('../middlewares/auth');
        await requireAuth(ctx, async () => {
          const user = ctx.session!.user!;
          const page = parseInt(ctx.match![1] || '1');
          const limit = 10;
          const offset = (page - 1) * limit;

          // Получаем все чеки пользователя (созданные и активированные)
          const { Check, CheckActivation } = await import('../../database/models');
          
          const [createdChecks, activatedChecks] = await Promise.all([
            Check.findAll({
              where: { creatorId: user.id },
              order: [['createdAt', 'DESC']],
              limit: Math.ceil(limit / 2),
              offset: Math.floor(offset / 2)
            }),
            CheckActivation.findAll({
              where: { userId: user.id },
              include: [{ model: Check, as: 'check' }],
              order: [['activatedAt', 'DESC']],
              limit: Math.ceil(limit / 2),
              offset: Math.floor(offset / 2)
            })
          ]);

          let message = `📋 **ИСТОРИЯ ЧЕКОВ**\n\n`;

          if (createdChecks.length === 0 && activatedChecks.length === 0) {
            message += `${EMOJIS.info} История чеков пуста.\n\n`;
            message += `Создайте или активируйте чеки для просмотра истории.`;
          } else {
            if (createdChecks.length > 0) {
              message += `📤 **Созданные чеки:**\n`;
              createdChecks.forEach((check, index) => {
                message += `${index + 1}. ${check.comment || 'Чек без комментария'}\n`;
                message += `   💰 ${check.amountPerActivation} GRAM | ${check.currentActivations}/${check.maxActivations}\n`;
                message += `   🏷️ ${check.code} | ${check.createdAt.toLocaleDateString('ru-RU')}\n\n`;
              });
            }

            if (activatedChecks.length > 0) {
              message += `📥 **Активированные чеки:**\n`;
              activatedChecks.forEach((activation, index) => {
                const check = activation.check;
                message += `${index + 1}. ${check?.comment || 'Чек без комментария'}\n`;
                message += `   💰 +${activation.amount} GRAM\n`;
                message += `   📅 ${activation.activatedAt.toLocaleDateString('ru-RU')}\n\n`;
              });
            }
          }

          const keyboard = {
            inline_keyboard: [
              [
                { text: '💳 Создать чек', callback_data: 'checks_create' },
                { text: '🎁 Активировать чек', callback_data: 'checks_activate' }
              ],
              [
                { text: '⬅️ Назад', callback_data: 'checks' }
              ]
            ]
          };

          await ctx.editMessageText(message, {
            reply_markup: keyboard,
            parse_mode: 'Markdown'
          });

          await ctx.answerCallbackQuery();
        });
      } catch (error) {
        logger.error('Checks history error:', error);
        await ctx.answerCallbackQuery('Произошла ошибка');
      }
    });

    // Конфиденциальность
    bot.callbackQuery('settings_privacy', requireAuth, async (ctx) => {
      try {
        const user = ctx.session?.user;
        if (!user) return;

        let message = `🔒 **НАСТРОЙКИ КОНФИДЕНЦИАЛЬНОСТИ**\n\n`;
        message += `Управляйте видимостью вашей информации:\n\n`;
        
        message += `👁️ **Публичная видимость:**\n`;
        message += `✅ Показывать в топах пользователей\n`;
        message += `✅ Публичная статистика выполненных заданий\n`;
        message += `✅ Показывать уровень другим пользователям\n`;
        message += `✅ Отображать в поиске по username\n\n`;
        
        message += `🛡️ **Скрытая информация:**\n`;
        message += `❌ Скрывать точный баланс от других\n`;
        message += `❌ Скрывать историю транзакций\n`;
        message += `❌ Скрывать список рефералов\n`;
        message += `❌ Скрывать дату регистрации\n\n`;
        
        message += `⚙️ **Дополнительные настройки:**\n`;
        message += `📧 Разрешить контакт от администрации\n`;
        message += `📊 Участвовать в общей статистике бота\n`;
        message += `🔍 Участвовать в системе рекомендаций\n\n`;
        
        message += `🔧 Детальные настройки конфиденциальности будут добавлены в следующих обновлениях.`;

        const keyboard = {
          inline_keyboard: [
            [
              { text: '🔒 Полная приватность', callback_data: 'privacy_full' },
              { text: '🌐 Максимальная открытость', callback_data: 'privacy_open' }
            ],
            [
              { text: '⚙️ Настроить детально', callback_data: 'privacy_detailed' }
            ],
            [
              { text: '⬅️ Назад к настройкам', callback_data: 'settings' }
            ]
          ]
        };

        await ctx.editMessageText(message, {
          reply_markup: keyboard,
          parse_mode: 'Markdown'
        });

        await ctx.answerCallbackQuery();
      } catch (error) {
        logger.error('Settings privacy error:', error);
        await ctx.answerCallbackQuery('Произошла ошибка');
      }
    });

    // Обработчик отмены действий
    bot.callbackQuery('cancel', async (ctx) => {
      try {
        const user = ctx.session?.user;
        if (user) {
          user.currentState = null;
          await user.save();
          
          await logger.userAction(user.telegramId, 'action_cancelled');
        }

        await ctx.answerCallbackQuery('✅ Действие отменено');
        
        // Возвращаемся в главное меню через небольшую задержку
        setTimeout(async () => {
          try {
            await ctx.editMessageText(
              '🏠 **Главное меню**\n\nВыберите действие:',
              {
                reply_markup: { inline_keyboard: [[{ text: '🏠 Главное меню', callback_data: 'main_menu' }]] },
                parse_mode: 'Markdown'
              }
            );
          } catch (error) {
            logger.error('Cancel redirect error:', error);
          }
        }, 1000);

      } catch (error) {
        logger.error('Cancel handler error:', error);
        await ctx.answerCallbackQuery('Произошла ошибка');
      }
    });

    // Обработчик для игнорирования текущей страницы
    bot.callbackQuery('current_page', async (ctx) => {
      await ctx.answerCallbackQuery();
    });

    // Обработчик неизвестных команд
    bot.on('message:text', async (ctx, next) => {
      // Проверяем, является ли сообщение командой
      if (ctx.message.text.startsWith('/')) {
        const user = ctx.session?.user;
        if (!user) {
          await ctx.reply('❓ Для использования команд необходимо зарегистрироваться. Нажмите /start');
          return;
        }

        await logger.userAction(user.telegramId, 'unknown_command', { 
          command: ctx.message.text 
        });

        await ctx.reply(
          '❓ Неизвестная команда.\n\n' +
          'Доступные команды:\n' +
          '• /start - главное меню\n' +
          '• /menu - главное меню\n' +
          '• /help - помощь',
          {
            reply_markup: {
              inline_keyboard: [[
                { text: '🏠 Главное меню', callback_data: 'main_menu' },
                { text: '❓ Помощь', callback_data: 'help' }
              ]]
            }
          }
        );
        return;
      }
      
      await next();
    });

    // Обработчик необработанных callback запросов
    bot.on('callback_query', async (ctx, next) => {
      try {
        await next();
      } catch (error) {
        logger.error('Unhandled callback query error:', error, {
          userId: ctx.from?.id,
          data: ctx.callbackQuery.data
        });
        
        await ctx.answerCallbackQuery('Произошла ошибка. Попробуйте позже.');
      }
    });

    // Обработчик для всех необработанных callback_query
    bot.callbackQuery(/.*/, async (ctx) => {
      logger.warn(`Unhandled callback query: ${ctx.callbackQuery.data}`, {
        userId: ctx.from?.id,
        data: ctx.callbackQuery.data
      });
      
      if (ctx.session?.user) {
        await logger.userAction(ctx.session.user.telegramId, 'unhandled_callback', {
          data: ctx.callbackQuery.data
        });
      }
      
      await ctx.answerCallbackQuery('🔄 Функция в разработке или недоступна');
    });

    // Экспорт статистики (улучшенная версия)
    bot.callbackQuery('export_stats', requireAuth, async (ctx) => {
      try {
        const user = ctx.session!.user!;
        
        await ctx.answerCallbackQuery('⏳ Формирую экспорт статистики...');
        
        // Получаем дополнительную статистику
        const [totalTransactions, totalTaskRewards, totalReferralBonuses] = await Promise.all([
          Transaction.count({ where: { userId: user.id, status: 'completed' } }),
          Transaction.sum('amount', { where: { userId: user.id, type: 'task_reward', status: 'completed' } }),
          Transaction.sum('amount', { where: { userId: user.id, type: 'referral_bonus', status: 'completed' } })
        ]);
        
        // Формируем статистику для экспорта
        const stats = {
          user: {
            id: user.telegramId,
            username: user.username,
            displayName: user.getDisplayName(),
            level: user.getLevelText(),
            levelEmoji: user.getLevelEmoji(),
            registeredAt: user.registeredAt.toISOString(),
            lastActiveAt: user.lastActiveAt?.toISOString(),
            accountAgeDays: Math.floor((Date.now() - user.registeredAt.getTime()) / (1000 * 60 * 60 * 24))
          },
          balance: {
            current: user.balance || 0,
            totalEarned: user.totalEarned || 0,
            totalSpent: user.totalSpent || 0,
            netProfit: (user.totalEarned || 0) - (user.totalSpent || 0),
            fromTasks: totalTaskRewards || 0,
            fromReferrals: totalReferralBonuses || 0
          },
          activity: {
            tasksCompleted: user.tasksCompleted || 0,
            tasksCreated: user.tasksCreated || 0,
            referralsCount: user.referralsCount || 0,
            totalTransactions: totalTransactions,
            earnMultiplier: user.getEarnMultiplier(),
            commissionRate: user.getCommissionRate(),
            referralBonus: user.getReferralBonus()
          },
          meta: {
            exportDate: new Date().toISOString(),
            exportVersion: '1.0',
            exportType: 'user_statistics'
          }
        };

        const exportText = JSON.stringify(stats, null, 2);

        let message = `📊 **ЭКСПОРТ СТАТИСТИКИ ЗАВЕРШЕН**\n\n`;
        message += `👤 **Пользователь:** ${user.getDisplayName()}\n`;
        message += `📅 **Дата экспорта:** ${new Date().toLocaleDateString('ru-RU')}\n`;
        message += `🗂️ **Размер данных:** ${Math.round(exportText.length / 1024 * 10) / 10} КБ\n\n`;
        message += `**Ваша статистика в JSON формате:**\n\n`;
        message += `\`\`\`json\n${exportText}\`\`\`\n\n`;
        message += `💾 Скопируйте данные выше для сохранения или дальнейшей обработки.`;

        const keyboard = {
          inline_keyboard: [
            [
              { text: '💰 Экспорт транзакций', callback_data: 'export_transactions' },
              { text: '📦 Полный экспорт', callback_data: 'export_full' }
            ],
            [
              { text: '⬅️ Назад к экспорту', callback_data: 'settings_export' }
            ]
          ]
        };

        await ctx.reply(message, {
          reply_markup: keyboard,
          parse_mode: 'Markdown'
        });
        
        logger.userAction(user.telegramId, 'data_exported', { type: 'statistics', size: exportText.length });
      } catch (error) {
        logger.error('Export stats error:', error);
        await ctx.answerCallbackQuery('Произошла ошибка при экспорте');
      }
    });

    // Экспорт транзакций
    bot.callbackQuery('export_transactions', requireAuth, async (ctx) => {
      try {
        const user = ctx.session!.user!;
        
        await ctx.answerCallbackQuery('⏳ Формирую экспорт транзакций...');
        
        // Получаем все транзакции пользователя
        const transactions = await Transaction.findAll({
          where: { userId: user.id },
          order: [['createdAt', 'DESC']],
          limit: 100 // Ограничиваем для избежания слишком больших сообщений
        });

        const transactionData = transactions.map(t => ({
          id: t.id,
          type: t.getTypeText(),
          amount: t.amount,
          amountWithSign: t.getAmountWithSign(),
          balanceBefore: t.balanceBefore,
          balanceAfter: t.balanceAfter,
          description: t.description,
          status: t.status,
          createdAt: t.createdAt.toISOString(),
          processedAt: t.processedAt?.toISOString()
        }));

        const exportData = {
          user: {
            id: user.telegramId,
            displayName: user.getDisplayName()
          },
          transactions: transactionData,
          summary: {
            total: transactions.length,
            totalShown: transactionData.length,
            totalEarned: transactions.filter(t => t.isDeposit()).reduce((sum, t) => sum + t.amount, 0),
            totalSpent: transactions.filter(t => t.isWithdrawal()).reduce((sum, t) => sum + t.amount, 0)
          },
          meta: {
            exportDate: new Date().toISOString(),
            exportType: 'user_transactions'
          }
        };

        // CSV формат для удобства
        let csvData = 'Дата,Тип,Сумма,Баланс До,Баланс После,Описание,Статус\n';
        transactionData.forEach(t => {
          csvData += `${t.createdAt},${t.type},${t.amountWithSign},${t.balanceBefore},${t.balanceAfter},"${t.description}",${t.status}\n`;
        });

        let message = `💰 **ЭКСПОРТ ТРАНЗАКЦИЙ**\n\n`;
        message += `📊 **Статистика:**\n`;
        message += `├ Всего транзакций: ${exportData.summary.total}\n`;
        message += `├ Показано: ${exportData.summary.totalShown}\n`;
        message += `├ Заработано: +${exportData.summary.totalEarned.toLocaleString()} GRAM\n`;
        message += `└ Потрачено: -${exportData.summary.totalSpent.toLocaleString()} GRAM\n\n`;
        message += `**CSV данные для Excel:**\n\n`;
        message += `\`\`\`\n${csvData.length > 2000 ? csvData.substring(0, 2000) + '...' : csvData}\`\`\``;

        const keyboard = {
          inline_keyboard: [
            [
              { text: '📊 Экспорт статистики', callback_data: 'export_stats' },
              { text: '📋 Экспорт заданий', callback_data: 'export_tasks' }
            ],
            [
              { text: '⬅️ Назад к экспорту', callback_data: 'settings_export' }
            ]
          ]
        };

        await ctx.reply(message, {
          reply_markup: keyboard,
          parse_mode: 'Markdown'
        });
        
        logger.userAction(user.telegramId, 'data_exported', { 
          type: 'transactions', 
          count: transactions.length 
        });
      } catch (error) {
        logger.error('Export transactions error:', error);
        await ctx.answerCallbackQuery('Произошла ошибка при экспорте транзакций');
      }
    });

    bot.callbackQuery('export_referrals', requireAuth, async (ctx) => {
      try {
        const user = ctx.session!.user!;
        
        await ctx.answerCallbackQuery('⏳ Формирую экспорт рефералов...');
        
        // Получаем рефералов пользователя
        const referrals = await User.findAll({
          where: { referrerId: user.id },
          attributes: ['id', 'telegramId', 'username', 'firstName', 'lastName', 'level', 'totalEarned', 'registeredAt', 'lastActiveAt'],
          order: [['registeredAt', 'DESC']],
          limit: 100
        });

        const referralData = referrals.map(r => ({
          telegramId: r.telegramId,
          displayName: r.getDisplayName(),
          username: r.username,
          level: r.getLevelText(),
          totalEarned: r.totalEarned || 0,
          registeredAt: r.registeredAt.toISOString(),
          lastActiveAt: r.lastActiveAt?.toISOString(),
          accountAge: Math.floor((Date.now() - r.registeredAt.getTime()) / (1000 * 60 * 60 * 24))
        }));

        const now = new Date();
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        
        const summary = {
          total: referrals.length,
          active: referrals.filter(r => r.lastActiveAt && r.lastActiveAt >= weekAgo).length,
          premium: referrals.filter(r => r.level === 'premium').length,
          totalEarned: referrals.reduce((sum, r) => sum + (r.totalEarned || 0), 0),
          avgEarnings: referrals.length > 0 ? Math.floor(referrals.reduce((sum, r) => sum + (r.totalEarned || 0), 0) / referrals.length) : 0
        };

        let message = `👥 **ЭКСПОРТ РЕФЕРАЛОВ**\n\n`;
        message += `📊 **Сводка:**\n`;
        message += `├ Всего рефералов: ${summary.total}\n`;
        message += `├ Активных (7 дней): ${summary.active}\n`;
        message += `├ Premium рефералов: ${summary.premium}\n`;
        message += `├ Общий заработок рефералов: ${summary.totalEarned.toLocaleString()} GRAM\n`;
        message += `└ Средний заработок: ${summary.avgEarnings.toLocaleString()} GRAM\n\n`;

        if (referralData.length > 0) {
          message += `👥 **Топ рефералов:**\n\n`;
          const topReferrals = referralData
            .sort((a, b) => b.totalEarned - a.totalEarned)
            .slice(0, 5);
            
          topReferrals.forEach((ref, index) => {
            message += `${index + 1}. **${ref.displayName}**\n`;
            message += `   ${ref.level} | ${ref.totalEarned.toLocaleString()} GRAM\n`;
            message += `   📅 ${new Date(ref.registeredAt).toLocaleDateString('ru-RU')}\n\n`;
          });
        } else {
          message += `👥 У вас пока нет рефералов.\n\n📤 Поделитесь реферальной ссылкой с друзьями!`;
        }

        const keyboard = {
          inline_keyboard: [
            [
              { text: '🔗 Реферальная ссылка', callback_data: 'referrals_link' },
              { text: '📊 Статистика рефералов', callback_data: 'referrals_stats' }
            ],
            [
              { text: '⬅️ Назад к экспорту', callback_data: 'settings_export' }
            ]
          ]
        };

        await ctx.reply(message, {
          reply_markup: keyboard,
          parse_mode: 'Markdown'
        });
        
        logger.userAction(user.telegramId, 'data_exported', { 
          type: 'referrals', 
          count: referrals.length 
        });
      } catch (error) {
        logger.error('Export referrals error:', error);
        await ctx.answerCallbackQuery('Произошла ошибка при экспорте рефералов');
      }
    });

    // Экспорт данных
    bot.callbackQuery('settings_export', requireAuth, async (ctx) => {
      try {
        const user = ctx.session?.user;
        if (!user) return;
        
        let message = `📊 **ЭКСПОРТ ДАННЫХ**\n\n`;
        message += `Скачайте или получите копии ваших данных:\n\n`;
        
        message += `📈 **Доступные данные для экспорта:**\n`;
        message += `• Профиль и настройки аккаунта\n`;
        message += `• История транзакций и заработка\n`;
        message += `• Статистика выполненных заданий\n`;
        message += `• Информация о рефералах\n`;
        message += `• История созданных заданий\n`;
        message += `• Активность и логи действий\n\n`;
        
        message += `📄 **Форматы экспорта:**\n`;
        message += `• JSON - для программной обработки\n`;
        message += `• CSV - для таблиц Excel/Google Sheets\n`;
        message += `• TXT - простой текстовый формат\n\n`;
        
        message += `⏰ Формирование экспорта может занять до 30 секунд.`;

        const keyboard = {
          inline_keyboard: [
            [
              { text: '📊 Экспорт статистики', callback_data: 'export_stats' },
              { text: '💰 Экспорт транзакций', callback_data: 'export_transactions' }
            ],
            [
              { text: '📋 Экспорт заданий', callback_data: 'export_tasks' },
              { text: '👥 Экспорт рефералов', callback_data: 'export_referrals' }
            ],
            [
              { text: '📦 Полный экспорт', callback_data: 'export_full' }
            ],
            [
              { text: '⬅️ Назад к настройкам', callback_data: 'settings' }
            ]
          ]
        };

        await ctx.editMessageText(message, {
          reply_markup: keyboard,
          parse_mode: 'Markdown'
        });

        await ctx.answerCallbackQuery();
      } catch (error) {
        logger.error('Settings export error:', error);
        await ctx.answerCallbackQuery('Произошла ошибка');
      }
    });

    // Полный экспорт
    bot.callbackQuery('export_full', requireAuth, async (ctx) => {
      try {
        const user = ctx.session!.user!;
        
        await ctx.answerCallbackQuery('⏳ Формирую полный экспорт данных...');
        
        // Получаем все данные пользователя
        const [
          transactions,
          tasks,
          referrals,
          notifications
        ] = await Promise.all([
          Transaction.findAll({ 
            where: { userId: user.id }, 
            order: [['createdAt', 'DESC']], 
            limit: 50 
          }),
          Task.findAll({ 
            where: { authorId: user.id }, 
            order: [['createdAt', 'DESC']], 
            limit: 25 
          }),
          User.findAll({ 
            where: { referrerId: user.id }, 
            order: [['registeredAt', 'DESC']], 
            limit: 25 
          }),
          Notification.findAll({ 
            where: { userId: user.id }, 
            order: [['createdAt', 'DESC']], 
            limit: 10 
          })
        ]);

        const fullExport = {
          user: {
            telegramId: user.telegramId,
            username: user.username,
            displayName: user.getDisplayName(),
            level: user.getLevelText(),
            balance: user.balance || 0,
            totalEarned: user.totalEarned || 0,
            totalSpent: user.totalSpent || 0,
            tasksCompleted: user.tasksCompleted || 0,
            tasksCreated: user.tasksCreated || 0,
            referralsCount: user.referralsCount || 0,
            registeredAt: user.registeredAt.toISOString(),
            lastActiveAt: user.lastActiveAt?.toISOString()
          },
          statistics: {
            transactions: transactions.length,
            tasks: tasks.length,
            referrals: referrals.length,
            notifications: notifications.length,
            accountAgeDays: Math.floor((Date.now() - user.registeredAt.getTime()) / (1000 * 60 * 60 * 24))
          },
          recentTransactions: transactions.slice(0, 10).map(t => ({
            type: t.getTypeText(),
            amount: t.getAmountWithSign(),
            date: t.createdAt.toISOString(),
            description: t.description
          })),
          recentTasks: tasks.slice(0, 10).map(t => ({
            title: t.title,
            type: t.getTypeText(),
            reward: t.reward,
            status: t.getStatusText(),
            createdAt: t.createdAt.toISOString()
          })),
          recentReferrals: referrals.slice(0, 10).map(r => ({
            displayName: r.getDisplayName(),
            level: r.getLevelText(),
            totalEarned: r.totalEarned || 0,
            registeredAt: r.registeredAt.toISOString()
          })),
          meta: {
            exportDate: new Date().toISOString(),
            exportVersion: '1.1',
            exportType: 'full_user_data'
          }
        };

        const exportText = JSON.stringify(fullExport, null, 2);
        const sizeKB = Math.round(exportText.length / 1024 * 10) / 10;

        let message = `📦 **ПОЛНЫЙ ЭКСПОРТ ДАННЫХ**\n\n`;
        message += `👤 **Пользователь:** ${user.getDisplayName()}\n`;
        message += `📊 **Включено данных:**\n`;
        message += `├ Профиль и настройки\n`;
        message += `├ Транзакции: ${fullExport.statistics.transactions}\n`;
        message += `├ Задания: ${fullExport.statistics.tasks}\n`;
        message += `├ Рефералы: ${fullExport.statistics.referrals}\n`;
        message += `├ Уведомления: ${fullExport.statistics.notifications}\n`;
        message += `└ Размер: ${sizeKB} КБ\n\n`;
        
        if (exportText.length > 3000) {
          message += `⚠️ **Экспорт слишком большой для отображения**\n`;
          message += `Данные будут отправлены в следующем сообщении.\n\n`;
          message += `📋 **Краткая сводка:**\n`;
          message += `💰 Баланс: ${fullExport.user.balance.toLocaleString()} GRAM\n`;
          message += `📈 Заработано: ${fullExport.user.totalEarned.toLocaleString()} GRAM\n`;
          message += `📊 Выполнено заданий: ${fullExport.user.tasksCompleted}\n`;
          message += `👥 Рефералов: ${fullExport.user.referralsCount}`;
          
          const keyboard = {
            inline_keyboard: [
              [
                { text: '📄 Получить JSON файл', callback_data: 'export_json_file' }
              ],
              [
                { text: '⬅️ Назад к экспорту', callback_data: 'settings_export' }
              ]
            ]
          };

          await ctx.reply(message, {
            reply_markup: keyboard,
            parse_mode: 'Markdown'
          });

          // Отправляем данные вторым сообщением
          await ctx.reply(
            `\`\`\`json\n${exportText}\`\`\``, 
            { parse_mode: 'Markdown' }
          );
        } else {
          message += `**JSON данные:**\n\n\`\`\`json\n${exportText}\`\`\``;
          
          const keyboard = {
            inline_keyboard: [
              [
                { text: '⬅️ Назад к экспорту', callback_data: 'settings_export' }
              ]
            ]
          };

          await ctx.reply(message, {
            reply_markup: keyboard,
            parse_mode: 'Markdown'
          });
        }
        
        logger.userAction(user.telegramId, 'data_exported', { 
          type: 'full_export', 
          size: exportText.length,
          transactions: transactions.length,
          tasks: tasks.length,
          referrals: referrals.length
        });
      } catch (error) {
        logger.error('Export full error:', error);
        await ctx.answerCallbackQuery('Произошла ошибка при полном экспорте');
      }
    });

    // Обработчики настроек конфиденциальности
    bot.callbackQuery('privacy_full', requireAuth, async (ctx) => {
      await ctx.answerCallbackQuery('🔒 Полная приватность будет доступна в следующем обновлении');
    });

    bot.callbackQuery('privacy_open', requireAuth, async (ctx) => {
      await ctx.answerCallbackQuery('🌐 Максимальная открытость установлена по умолчанию');
    });

    bot.callbackQuery('privacy_detailed', requireAuth, async (ctx) => {
      await ctx.answerCallbackQuery('⚙️ Детальные настройки будут добавлены позже');
    });

    logger.info('✅ All handlers configured successfully');
    
  } catch (error) {
    logger.error('❌ Failed to setup handlers:', error);
    throw error;
  }
}

// Дополнительная функция для обработки ошибок в боте
export function setupErrorHandlers(bot: Bot) {
  // Глобальный обработчик ошибок
  bot.catch(async (err) => {
    const ctx = err.ctx;
    const error = err.error;
    
    logger.error('Bot error occurred', error, {
      updateId: ctx.update.update_id,
      userId: ctx.from?.id,
      username: ctx.from?.username,
      chatId: ctx.chat?.id
    });

    // Логируем действие пользователя если доступно
    if (ctx.session?.user) {
      await logger.userAction(ctx.session.user.telegramId, 'bot_error', {
        error: error,
        updateId: ctx.update.update_id
      });
    }

    // Пытаемся отправить сообщение об ошибке пользователю
    try {
      if (ctx.callbackQuery) {
        await ctx.answerCallbackQuery('❌ Произошла ошибка. Попробуйте позже.');
      } else {
        await ctx.reply(
          '❌ Произошла техническая ошибка.\n\n' +
          'Попробуйте:\n' +
          '• Повторить действие через несколько секунд\n' +
          '• Перезапустить бота командой /start\n' +
          '• Обратиться в поддержку @prgram_support',
          {
            reply_markup: {
              inline_keyboard: [[
                { text: '🔄 Перезапуск', callback_data: 'main_menu' }
              ]]
            }
          }
        );
      }
    } catch (replyError) {
      logger.error('Failed to send error message to user:', replyError);
    }
  });

  // Обработчик для необработанных исключений
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  });

  process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
    // Не завершаем процесс автоматически, но логируем критическую ошибку
  });

  logger.info('✅ Error handlers configured');
}

// Функция для инициализации фоновых задач
export async function setupBackgroundJobs() {
  try {
    // Инициализируем QueueManager
    const { QueueManager } = await import('../../jobs/queues');
    QueueManager.initialize();

    // Запускаем задачи очистки каждые 6 часов
    setInterval(async () => {
      try {
        await QueueManager.addCleanupTask({ type: 'expired_tasks' });
        await QueueManager.addCleanupTask({ type: 'old_notifications' });
        await QueueManager.addCleanupTask({ type: 'inactive_checks' });
        
        logger.info('Background cleanup tasks scheduled');
      } catch (error) {
        logger.error('Failed to schedule cleanup tasks:', error);
      }
    }, 6 * 60 * 60 * 1000); // 6 часов

    // Очистка завершенных задач в очереди каждые 24 часа  
    setInterval(async () => {
      try {
        await QueueManager.cleanCompletedJobs();
        logger.info('Completed queue jobs cleaned');
      } catch (error) {
        logger.error('Failed to clean completed jobs:', error);
      }
    }, 24 * 60 * 60 * 1000); // 24 часа

    logger.info('✅ Background jobs configured');
  } catch (error) {
    logger.error('❌ Failed to setup background jobs:', error);
  }
}

export default setupHandlers;

