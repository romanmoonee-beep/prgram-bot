// src/utils/formatters/init.ts
import { User } from '../../database/models';

/**
 * Форматирует профиль пользователя для отображения
 */
export function formatUserProfile(user: User): string {
  let profile = `🆔 **ID:** ${user.telegramId}\n`;
  profile += `👨‍💼 **${user.username ? `@${user.username}` : user.getDisplayName()}**\n`;
  profile += `🏆 **Уровень:** ${user.getLevelText()} ${user.getLevelEmoji()}\n\n`;
  
  profile += `💰 **Баланс:** ${(user.balance || 0).toLocaleString()} GRAM\n`;
  if (user.frozenBalance && user.frozenBalance > 0) {
    profile += `❄️ **Заморожено:** ${user.frozenBalance.toLocaleString()} GRAM\n`;
  }
  
  profile += `\n📊 **СТАТИСТИКА:**\n`;
  profile += `├ Выполнено заданий: ${user.tasksCompleted || 0}\n`;
  profile += `├ Создано заданий: ${user.tasksCreated || 0}\n`;
  profile += `├ Рефералов: ${user.referralsCount || 0}`;
  
  if (user.premiumReferralsCount && user.premiumReferralsCount > 0) {
    profile += ` (${user.premiumReferralsCount} Premium)`;
  }
  
  profile += `\n└ Заработано всего: ${(user.totalEarned || 0).toLocaleString()} GRAM`;
  
  return profile;
}

/**
 * Форматирует статистику пользователя за период
 */
export function formatUserStats(user: User, period: 'today' | 'week' | 'month'): string {
  const periodText = {
    'today': 'СЕГОДНЯ',
    'week': 'ЗА НЕДЕЛЮ', 
    'month': 'ЗА МЕСЯЦ'
  };
  
  let stats = `📊 **СТАТИСТИКА ${periodText[period]}**\n\n`;
  
  // В реальном приложении здесь должны быть расчеты из БД за период
  // Пока показываем общую статистику
  const earnedToday = period === 'today' ? Math.floor((user.totalEarned || 0) * 0.1) : 
                     period === 'week' ? Math.floor((user.totalEarned || 0) * 0.3) :
                     (user.totalEarned || 0);
  
  const tasksToday = period === 'today' ? Math.floor((user.tasksCompleted || 0) * 0.1) :
                    period === 'week' ? Math.floor((user.tasksCompleted || 0) * 0.3) :
                    (user.tasksCompleted || 0);
  
  stats += `💰 **Финансы:**\n`;
  stats += `├ Заработано: ${earnedToday.toLocaleString()} GRAM\n`;
  stats += `├ Потрачено: ${Math.floor(earnedToday * 0.3).toLocaleString()} GRAM\n`;
  stats += `└ Текущий баланс: ${(user.balance || 0).toLocaleString()} GRAM\n\n`;
  
  stats += `📋 **Задания:**\n`;
  stats += `├ Выполнено: ${tasksToday}\n`;
  stats += `├ Создано: ${Math.floor(tasksToday * 0.2)}\n`;
  stats += `└ В процессе: ${Math.floor(tasksToday * 0.1)}\n\n`;
  
  stats += `🔗 **Рефералы:**\n`;
  const referralsForPeriod = period === 'today' ? Math.floor((user.referralsCount || 0) * 0.05) :
                            period === 'week' ? Math.floor((user.referralsCount || 0) * 0.2) :
                            (user.referralsCount || 0);
  
  stats += `├ Новых: ${referralsForPeriod}\n`;
  stats += `├ Всего: ${user.referralsCount || 0}\n`;
  stats += `└ Доход с рефералов: ${Math.floor(earnedToday * 0.15).toLocaleString()} GRAM`;
  
  return stats;
}

/**
 * Форматирует баланс пользователя
 */
export function formatBalance(balance: number, includeEmoji: boolean = true): string {
  const emoji = includeEmoji ? '💰 ' : '';
  return `${emoji}${balance.toLocaleString()} GRAM`;
}

/**
 * Форматирует временной период
 */
export function formatTimeRemaining(endDate: Date): string {
  const now = new Date();
  const diff = endDate.getTime() - now.getTime();
  
  if (diff <= 0) {
    return 'Истекло';
  }
  
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  
  if (days > 0) {
    return `${days}д ${hours}ч`;
  } else if (hours > 0) {
    return `${hours}ч ${minutes}м`;
  } else {
    return `${minutes}м`;
  }
}

export function formatNotification(
  type: string,
  title: string,
  message: string,
  data?: any
): string {
  switch (type) {
    case 'task_completed':
      return `✅ *${title}*\n${message}\nНаграда: ${data?.reward ?? ''} GRAM`;
    case 'referral_joined':
      return `👥 *${title}*\n${message}\nБонус: ${data?.bonus ?? ''} GRAM`;
    case 'balance_low':
      return `⚠️ *${title}*\n${message}`;
    case 'level_up':
      return `🏆 *${title}*\n${message}`;
    case 'check_received':
      return `💸 *${title}*\n${message}\nКод чека: \`${data?.checkCode ?? ''}\``;
    case 'system':
      return `📢 *${title}*\n${message}`;
    default:
      return `📩 *${title}*\n${message}`;
  }
}