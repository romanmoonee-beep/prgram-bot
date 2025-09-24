// src/middlewares/auth.ts
import { Context, NextFunction } from 'grammy';
import { User } from '../models/User';
import { logger } from '../utils/logger';

// Расширение типа Context для добавления session
declare module 'grammy' {
  interface Context {
    session?: {
      user?: User;
      isRegistered: boolean;
      isAdmin: boolean;
    };
  }
}

// Middleware для аутентификации пользователей
export async function authMiddleware(ctx: Context, next: NextFunction) {
  try {
    // Пропускаем обновления без пользователя (например, channel posts)
    if (!ctx.from) {
      return next();
    }

    const telegramId = ctx.from.id;
    const username = ctx.from.username;
    const firstName = ctx.from.first_name;
    const lastName = ctx.from.last_name;
    const languageCode = ctx.from.language_code;

    // Ищем пользователя в базе данных
    let user = await User.findOne({
      where: { telegramId }
    });

    let isNewUser = false;

    // Если пользователь не найден, создаем нового
    if (!user) {
      // Генерируем реферальный код
      const referralCode = telegramId.toString();
      
      user = await User.create({
        telegramId,
        username,
        firstName,
        lastName,
        languageCode: languageCode || 'en',
        referralCode,
        registeredAt: new Date(),
        lastActiveAt: new Date()
      });

      isNewUser = true;
      
      logger.userAction(telegramId, 'registered', {
        username,
        firstName,
        lastName
      });
    } else {
      // Обновляем информацию о пользователе, если она изменилась
      let needUpdate = false;

      if (user.username !== username) {
        user.username = username;
        needUpdate = true;
      }

      if (user.firstName !== firstName) {
        user.firstName = firstName;
        needUpdate = true;
      }

      if (user.lastName !== lastName) {
        user.lastName = lastName;
        needUpdate = true;
      }

      if (user.languageCode !== languageCode) {
        user.languageCode = languageCode || 'en';
        needUpdate = true;
      }

      if (needUpdate) {
        await user.save();
        logger.userAction(telegramId, 'profile_updated');
      }
    }

    // Проверяем, является ли пользователь администратором
    const adminIds = process.env.ADMIN_IDS?.split(',').map(id => parseInt(id)) || [];
    const isAdmin = adminIds.includes(telegramId);

    // Создаем сессию
    ctx.session = {
      user,
      isRegistered: true,
      isAdmin
    };

    // Обработка реферальной системы для новых пользователей
    if (isNewUser) {
      await handleReferralForNewUser(ctx, user);
    }

    return next();

  } catch (error) {
    logger.error('Auth middleware error:', error, {
      userId: ctx.from?.id,
      username: ctx.from?.username
    });

    // В случае ошибки создаем базовую сессию
    ctx.session = {
      isRegistered: false,
      isAdmin: false
    };

    return next();
  }
}

// Функция для обработки реферальной системы
async function handleReferralForNewUser(ctx: Context, user: User) {
  try {
    // Извлекаем реферальный код из команды /start
    const message = ctx.message;
    if (message && 'text' in message && message.text) {
      const startPayload = message.text.split(' ')[1];
      
      if (startPayload && /^\d+$/.test(startPayload)) {
        const referrerTelegramId = parseInt(startPayload);
        
        // Находим реферера
        const referrer = await User.findOne({
          where: { telegramId: referrerTelegramId }
        });

        if (referrer && referrer.id !== user.id) {
          // Устанавливаем связь
          user.referrerId = referrer.id;
          await user.save();

          // Обновляем счетчик рефералов у реферера
          referrer.referralsCount = (referrer.referralsCount || 0) + 1;
          
          // Определяем бонус в зависимости от уровня реферера
          const bonusAmount = referrer.getReferralBonus();
          
          // Начисляем бонус рефереру
          await referrer.updateBalance(bonusAmount, 'add');
          await referrer.save();

          // Создаем транзакцию
          const { Transaction } = await import('../models/Transaction');
          await Transaction.createReferralBonus(
            referrer.id,
            user.id,
            bonusAmount,
            (referrer.balance || 0) - bonusAmount
          );

          // Создаем уведомление рефереру
          const { Notification } = await import('../models/Notification');
          await Notification.createReferralJoined(
            referrer.id,
            user.getDisplayName(),
            bonusAmount
          );

          logger.userAction(user.telegramId, 'referral_registered', {
            referrerId: referrer.id,
            bonusAmount
          });

          // Отправляем уведомление рефереру (если он активен)
          try {
            await ctx.api.sendMessage(
              referrer.telegramId,
              `🎉 У вас новый реферал!\n\n` +
              `👤 ${user.getDisplayName()}\n` +
              `💰 Получено ${bonusAmount} GRAM\n\n` +
              `Всего рефералов: ${referrer.referralsCount}`
            );
          } catch (notificationError) {
            logger.warn('Failed to send referral notification:', notificationError);
          }
        }
      }
    }
  } catch (error) {
    logger.error('Referral handling error:', error);
  }
}

// Middleware для проверки регистрации пользователя
export function requireAuth(ctx: Context, next: NextFunction) {
  if (!ctx.session?.isRegistered || !ctx.session.user) {
    return ctx.reply(
      '❌ Вы не зарегистрированы в системе.\n' +
      'Нажмите /start для регистрации.'
    );
  }
  
  if (ctx.session.user.isBanned) {
    return ctx.reply(
      '🚫 Ваш аккаунт заблокирован.\n' +
      'Обратитесь в поддержку для разблокировки.'
    );
  }

  if (!ctx.session.user.isActive) {
    return ctx.reply(
      '⚠️ Ваш аккаунт неактивен.\n' +
      'Обратитесь в поддержку для активации.'
    );
  }

  return next();
}

// Middleware для проверки активности пользователя
export function requireActive(ctx: Context, next: NextFunction) {
  if (!ctx.session?.user?.isActive || ctx.session.user.isBanned) {
    return ctx.reply(
      '⚠️ Ваш аккаунт неактивен или заблокирован.\n' +
      'Обратитесь в поддержку.'
    );
  }
  
  return next();
}

export default authMiddleware;