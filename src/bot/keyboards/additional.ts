// src/bot/keyboards/additional.ts
import { InlineKeyboard } from 'grammy';
import { EMOJIS } from '../../utils/constants';

// Клавиатура проверки подписки (ОП)
export function getSubscriptionCheckKeyboard() {
  return new InlineKeyboard()
    .text(`🏛️ Публичные каналы/чаты`, 'subscription_public')
    .text(`🔒 Приватные каналы/чаты`, 'subscription_private').row()
    .text(`🔗 ОП на пригласительную ссылку`, 'subscription_invite')
    .text(`🎯 Реферальная система`, 'subscription_referral').row()
    .text(`⌛ Автоудаление сообщений`, 'subscription_autodelete')
    .text(`📊 Статистика ОП`, 'subscription_stats').row()
    .text(`${EMOJIS.home} Главное меню`, 'main_menu');
}

// Настройки уведомлений
export function getNotificationSettingsKeyboard(settings: any) {
  const keyboard = new InlineKeyboard();
  
  // Группируем настройки
  keyboard
    .text(`${settings.taskCompleted !== false ? '✅' : '❌'} Выполнение заданий`, 'toggle_notifications_taskCompleted')
    .text(`${settings.taskCreated !== false ? '✅' : '❌'} Создание заданий`, 'toggle_notifications_taskCreated').row()
    .text(`${settings.referralJoined !== false ? '✅' : '❌'} Рефералы`, 'toggle_notifications_referralJoined')
    .text(`${settings.balanceUpdates !== false ? '✅' : '❌'} Баланс`, 'toggle_notifications_balanceUpdates').row()
    .text(`${settings.systemMessages !== false ? '✅' : '❌'} Системные`, 'toggle_notifications_systemMessages').row()
    .text(`${EMOJIS.check} Сохранить настройки`, 'save_notification_settings')
    .text(`${EMOJIS.back} Назад`, 'cabinet_settings');

  return keyboard;
}

// Клавиатура пополнения баланса
export function getDepositKeyboard() {
  return new InlineKeyboard()
    .text('💳 100 Stars = 1,000 GRAM', 'deposit_100')
    .text('💎 450 Stars = 4,950 GRAM', 'deposit_450').row()
    .text('🔥 850 Stars = 9,775 GRAM', 'deposit_850')
    .text('⭐ 2000 Stars = 25,000 GRAM', 'deposit_2000').row()
    .text(`${EMOJIS.info} Информация о Stars`, 'deposit_info')
    .text(`${EMOJIS.back} Назад`, 'cabinet');
}

// Админская панель - главное меню
export function getAdminPanelKeyboard() {
  return new InlineKeyboard()
    .text(`${EMOJIS.stats} Общая статистика`, 'admin_general_stats')
    .text(`${EMOJIS.user} Управление пользователями`, 'admin_users_management').row()
    .text(`${EMOJIS.chart} Управление заданиями`, 'admin_tasks_management')
    .text(`${EMOJIS.money} Финансы и транзакции`, 'admin_finance').row()
    .text(`${EMOJIS.bell} Рассылки и уведомления`, 'admin_broadcast')
    .text(`${EMOJIS.settings} Настройки системы`, 'admin_system_settings').row()
    .text(`🔧 Техническое обслуживание`, 'admin_maintenance')
    .text(`📊 Аналитика и отчеты`, 'admin_analytics').row()
    .text(`${EMOJIS.home} Главное меню`, 'main_menu');
}

// Управление пользователями (админка)
export function getUserManagementKeyboard() {
  return new InlineKeyboard()
    .text(`👤 Поиск пользователя`, 'admin_user_search')
    .text(`📊 Статистика пользователей`, 'admin_user_stats').row()
    .text(`🏆 Топ пользователей`, 'admin_user_top')
    .text(`🚫 Заблокированные`, 'admin_user_banned').row()
    .text(`💎 Premium пользователи`, 'admin_user_premium')
    .text(`📈 Новые регистрации`, 'admin_user_new').row()
    .text(`${EMOJIS.back} Назад`, 'admin_panel');
}

// Управление заданиями (админка)
export function getTaskManagementKeyboard() {
  return new InlineKeyboard()
    .text(`📋 Все задания`, 'admin_tasks_all')
    .text(`⏳ На модерации`, 'admin_tasks_pending').row()
    .text(`🔥 Топ задания`, 'admin_tasks_top')
    .text(`❌ Отклоненные`, 'admin_tasks_rejected').row()
    .text(`📊 Статистика заданий`, 'admin_tasks_stats')
    .text(`🔧 Настройки заданий`, 'admin_tasks_settings').row()
    .text(`${EMOJIS.back} Назад`, 'admin_panel');
}

// Финансовая панель (админка)
export function getFinanceKeyboard() {
  return new InlineKeyboard()
    .text(`💰 Общий баланс системы`, 'admin_finance_total')
    .text(`📊 Статистика транзакций`, 'admin_finance_stats').row()
    .text(`💳 Пополнения`, 'admin_finance_deposits')
    .text(`💸 Выводы`, 'admin_finance_withdrawals').row()
    .text(`🏦 Комиссии`, 'admin_finance_commissions')
    .text(`🎁 Бонусы и акции`, 'admin_finance_bonuses').row()
    .text(`📈 Финансовые отчеты`, 'admin_finance_reports')
    .text(`${EMOJIS.back} Назад`, 'admin_panel');
}

// Рассылки (админка)
export function getBroadcastKeyboard() {
  return new InlineKeyboard()
    .text(`📢 Создать рассылку`, 'admin_broadcast_create')
    .text(`📋 История рассылок`, 'admin_broadcast_history').row()
    .text(`👥 Рассылка по уровням`, 'admin_broadcast_by_level')
    .text(`🎯 Рассылка по активности`, 'admin_broadcast_by_activity').row()
    .text(`📊 Статистика рассылок`, 'admin_broadcast_stats')
    .text(`${EMOJIS.back} Назад`, 'admin_panel');
}

// Системные настройки (админка)
export function getSystemSettingsKeyboard() {
  return new InlineKeyboard()
    .text(`🔧 Параметры бота`, 'admin_settings_bot')
    .text(`💰 Курсы и лимиты`, 'admin_settings_rates').row()
    .text(`🏆 Настройки уровней`, 'admin_settings_levels')
    .text(`🎯 Настройки заданий`, 'admin_settings_tasks').row()
    .text(`🔔 Настройки уведомлений`, 'admin_settings_notifications')
    .text(`🛡️ Безопасность`, 'admin_settings_security').row()
    .text(`${EMOJIS.back} Назад`, 'admin_panel');
}

// Техническое обслуживание (админка)
export function getMaintenanceKeyboard() {
  return new InlineKeyboard()
    .text(`🔄 Перезапуск воркеров`, 'admin_maintenance_restart_workers')
    .text(`🧹 Очистка кэша`, 'admin_maintenance_clear_cache').row()
    .text(`📊 Статус системы`, 'admin_maintenance_system_status')
    .text(`💾 Резервное копирование`, 'admin_maintenance_backup').row()
    .text(`🔍 Логи системы`, 'admin_maintenance_logs')
    .text(`⚡ Производительность`, 'admin_maintenance_performance').row()
    .text(`${EMOJIS.back} Назад`, 'admin_panel');
}

// Клавиатура подтверждения для критических операций
export function getCriticalConfirmKeyboard(action: string) {
  return new InlineKeyboard()
    .text(`⚠️ ДА, ВЫПОЛНИТЬ`, `confirm_critical_${action}`)
    .text(`❌ Отмена`, 'cancel').row()
    .text(`${EMOJIS.info} Подробнее`, `info_${action}`);
}

// Настройки конфиденциальности
export function getPrivacyKeyboard() {
  return new InlineKeyboard()
    .text(`👤 Показывать статистику`, 'privacy_show_stats')
    .text(`🔗 Показывать в топах`, 'privacy_show_in_tops').row()
    .text(`📞 Уведомления от админов`, 'privacy_admin_notifications')
    .text(`📊 Участие в аналитике`, 'privacy_analytics').row()
    .text(`${EMOJIS.check} Сохранить`, 'save_privacy_settings')
    .text(`${EMOJIS.back} Назад`, 'settings');
}

// Языковые настройки
export function getLanguageKeyboard() {
  return new InlineKeyboard()
    .text(`🇷🇺 Русский`, 'language_ru')
    .text(`🇺🇸 English`, 'language_en').row()
    .text(`🇺🇦 Українська`, 'language_uk')
    .text(`🇰🇿 Қазақша`, 'language_kz').row()
    .text(`${EMOJIS.back} Назад`, 'settings');
}

// Клавиатура модерации задания
export function getTaskModerationKeyboard(taskExecutionId: number) {
  return new InlineKeyboard()
    .text(`✅ Принять`, `moderate_approve_${taskExecutionId}`)
    .text(`❌ Отклонить`, `moderate_reject_${taskExecutionId}`).row()
    .text(`💬 Запросить дополнительно`, `moderate_request_${taskExecutionId}`)
    .text(`👁️ Подробная информация`, `moderate_details_${taskExecutionId}`).row()
    .text(`📊 Статистика автора`, `moderate_author_stats_${taskExecutionId}`)
    .text(`🔄 Пропустить`, `moderate_skip_${taskExecutionId}`);
}

// Клавиатура для выбора причины отклонения
export function getRejectionReasonKeyboard(taskExecutionId: number) {
  return new InlineKeyboard()
    .text(`📷 Неверный скриншот`, `reject_${taskExecutionId}_invalid_screenshot`)
    .text(`❌ Не выполнены условия`, `reject_${taskExecutionId}_conditions_not_met`).row()
    .text(`🎭 Фейковое выполнение`, `reject_${taskExecutionId}_fake_completion`)
    .text(`📝 Неполная информация`, `reject_${taskExecutionId}_incomplete_info`).row()
    .text(`⚠️ Нарушение правил`, `reject_${taskExecutionId}_rule_violation`)
    .text(`✍️ Другая причина`, `reject_${taskExecutionId}_custom`).row()
    .text(`${EMOJIS.back} Назад`, `moderate_details_${taskExecutionId}`);
}

// Клавиатура типов рассылок
export function getBroadcastTypeKeyboard() {
  return new InlineKeyboard()
    .text(`📢 Всем пользователям`, 'broadcast_type_all')
    .text(`🎯 По фильтрам`, 'broadcast_type_filtered').row()
    .text(`🏆 По уровню`, 'broadcast_type_level')
    .text(`📊 По активности`, 'broadcast_type_activity').row()
    .text(`💰 По балансу`, 'broadcast_type_balance')
    .text(`🔗 Рефералам`, 'broadcast_type_referrals').row()
    .text(`${EMOJIS.back} Назад`, 'admin_broadcast');
}

// Клавиатура статистики
export function getStatsKeyboard() {
  return new InlineKeyboard()
    .text(`📊 Сегодня`, 'stats_today')
    .text(`📅 Неделя`, 'stats_week').row()
    .text(`📈 Месяц`, 'stats_month')
    .text(`📋 Все время`, 'stats_all_time').row()
    .text(`📊 Пользовательская`, 'stats_custom')
    .text(`📈 Сравнить периоды`, 'stats_compare').row()
    .text(`${EMOJIS.back} Назад`, 'cabinet_stats');
}

// Экспорт всех клавиатур
export {
  getSubscriptionCheckKeyboard,
  getNotificationSettingsKeyboard,
  getDepositKeyboard,
  getAdminPanelKeyboard,
  getUserManagementKeyboard,
  getTaskManagementKeyboard,
  getFinanceKeyboard,
  getBroadcastKeyboard,
  getSystemSettingsKeyboard,
  getMaintenanceKeyboard,
  getCriticalConfirmKeyboard,
  getPrivacyKeyboard,
  getLanguageKeyboard,
  getTaskModerationKeyboard,
  getRejectionReasonKeyboard,
  getBroadcastTypeKeyboard,
  getStatsKeyboard
};