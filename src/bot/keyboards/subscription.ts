// src/bot/keyboards/subscription.ts
import { InlineKeyboard } from 'grammy';
import { EMOJIS } from '../../utils/constants';

// Главная клавиатура системы ОП
export function getSubscriptionMainKeyboard() {
  return new InlineKeyboard()
    .text(`🏛️ Публичные каналы/чаты`, 'subscription_public')
    .text(`🔒 Приватные каналы/чаты`, 'subscription_private').row()
    .text(`🔗 ОП на пригласительную ссылку`, 'subscription_invite_link')
    .text(`🎯 Реферальная система PR GRAM`, 'subscription_referral_prgram').row()
    .text(`⌛ Автоудаление сообщений`, 'subscription_autodelete')
    .text(`📊 Статистика и логи`, 'subscription_stats').row()
    .text(`❓ Инструкция по настройке`, 'subscription_help')
    .text(`${EMOJIS.home} Главное меню`, 'main_menu');
}

// Клавиатура публичных каналов/чатов
export function getPublicSubscriptionKeyboard() {
  return new InlineKeyboard()
    .text(`📝 Команды для настройки`, 'subscription_public_commands')
    .text(`⏰ Настройка таймеров`, 'subscription_public_timers').row()
    .text(`📊 Мои настройки ОП`, 'subscription_public_my_settings')
    .text(`🔍 Проверить настройки`, 'subscription_public_check').row()
    .text(`❓ Примеры использования`, 'subscription_public_examples')
    .text(`${EMOJIS.back} Назад`, 'subscription');
}

// Клавиатура приватных каналов/чатов
export function getPrivateSubscriptionKeyboard() {
  return new InlineKeyboard()
    .text(`🔑 Настройка через токен`, 'subscription_private_token')
    .text(`🤖 Настройка через бота`, 'subscription_private_bot').row()
    .text(`📋 Мои приватные ОП`, 'subscription_private_my')
    .text(`🔍 Проверить доступ`, 'subscription_private_check').row()
    .text(`⚠️ Ограничения`, 'subscription_private_limits')
    .text(`${EMOJIS.back} Назад`, 'subscription');
}

// Клавиатура ОП на пригласительные ссылки
export function getInviteLinkSubscriptionKeyboard() {
  return new InlineKeyboard()
    .text(`🔗 Добавить ссылку`, 'subscription_invite_add')
    .text(`📋 Мои ссылки`, 'subscription_invite_list').row()
    .text(`📊 Статистика переходов`, 'subscription_invite_stats')
    .text(`⚙️ Настройки проверки`, 'subscription_invite_settings').row()
    .text(`❓ Как работает`, 'subscription_invite_how')
    .text(`${EMOJIS.back} Назад`, 'subscription');
}

// Клавиатура реферальной системы ОП
export function getReferralSubscriptionKeyboard() {
  return new InlineKeyboard()
    .text(`🎯 Настроить реферальную ОП`, 'subscription_referral_setup')
    .text(`📊 Моя статистика`, 'subscription_referral_stats').row()
    .text(`💰 Доходы от ОП`, 'subscription_referral_earnings')
    .text(`🔧 Настройки проверки`, 'subscription_referral_settings').row()
    .text(`📝 Команды управления`, 'subscription_referral_commands')
    .text(`❓ FAQ`, 'subscription_referral_faq').row()
    .text(`${EMOJIS.back} Назад`, 'subscription');
}

// Клавиатура автоудаления сообщений
export function getAutoDeleteKeyboard() {
  return new InlineKeyboard()
    .text(`⏱️ Настроить время удаления`, 'autodelete_set_time')
    .text(`📋 Мои настройки`, 'autodelete_my_settings').row()
    .text(`🔧 Расширенные настройки`, 'autodelete_advanced')
    .text(`📊 Статистика удалений`, 'autodelete_stats').row()
    .text(`❓ Как работает`, 'autodelete_how')
    .text(`${EMOJIS.back} Назад`, 'subscription');
}

// Клавиатура статистики ОП
export function getSubscriptionStatsKeyboard() {
  return new InlineKeyboard()
    .text(`📊 Общая статистика`, 'subscription_stats_general')
    .text(`👥 По чатам`, 'subscription_stats_chats').row()
    .text(`📈 По периодам`, 'subscription_stats_periods')
    .text(`🎯 Эффективность`, 'subscription_stats_effectiveness').row()
    .text(`📋 Подробные логи`, 'subscription_stats_logs')
    .text(`📤 Экспорт данных`, 'subscription_stats_export').row()
    .text(`${EMOJIS.back} Назад`, 'subscription');
}

// Клавиатура выбора времени для автоудаления
export function getAutoDeleteTimeKeyboard() {
  return new InlineKeyboard()
    .text(`⚡ 15 секунд`, 'autodelete_time_15s')
    .text(`🔥 30 секунд`, 'autodelete_time_30s').row()
    .text(`⏰ 1 минута`, 'autodelete_time_1m')
    .text(`⏲️ 2 минуты`, 'autodelete_time_2m').row()
    .text(`🕐 5 минут`, 'autodelete_time_5m')
    .text(`🔴 Отключить`, 'autodelete_time_off').row()
    .text(`${EMOJIS.back} Назад`, 'subscription_autodelete');
}

// Клавиатура примеров команд для ОП
export function getSubscriptionExamplesKeyboard() {
  return new InlineKeyboard()
    .text(`📺 Для каналов`, 'subscription_examples_channels')
    .text(`👥 Для групп`, 'subscription_examples_groups').row()
    .text(`🔒 Для закрытых чатов`, 'subscription_examples_private')
    .text(`⏰ С таймерами`, 'subscription_examples_timers').row()
    .text(`🎯 Комбинированные`, 'subscription_examples_combined')
    .text(`${EMOJIS.back} Назад`, 'subscription_public');
}

// Клавиатура управления конкретной ОП
export function getSubscriptionManageKeyboard(subscriptionId: number) {
  return new InlineKeyboard()
    .text(`📊 Статистика`, `subscription_manage_stats_${subscriptionId}`)
    .text(`⚙️ Настройки`, `subscription_manage_settings_${subscriptionId}`).row()
    .text(`⏸️ Приостановить`, `subscription_manage_pause_${subscriptionId}`)
    .text(`▶️ Активировать`, `subscription_manage_resume_${subscriptionId}`).row()
    .text(`🗑️ Удалить`, `subscription_manage_delete_${subscriptionId}`)
    .text(`📋 Логи`, `subscription_manage_logs_${subscriptionId}`).row()
    .text(`${EMOJIS.back} Назад`, 'subscription_stats');
}

// Клавиатура подтверждения удаления ОП
export function getDeleteSubscriptionKeyboard(subscriptionId: number) {
  return new InlineKeyboard()
    .text(`⚠️ ДА, УДАЛИТЬ`, `confirm_delete_subscription_${subscriptionId}`)
    .text(`❌ Отмена`, `subscription_manage_settings_${subscriptionId}`).row()
    .text(`${EMOJIS.info} Что произойдет?`, `delete_subscription_info_${subscriptionId}`);
}

// Клавиатура помощи по ОП
export function getSubscriptionHelpKeyboard() {
  return new InlineKeyboard()
    .text(`🚀 Быстрый старт`, 'subscription_help_quick_start')
    .text(`📝 Список команд`, 'subscription_help_commands').row()
    .text(`❓ Частые вопросы`, 'subscription_help_faq')
    .text(`⚠️ Решение проблем`, 'subscription_help_troubleshooting').row()
    .text(`📞 Техподдержка`, 'subscription_help_support')
    .text(`🎥 Видео-инструкции`, 'subscription_help_videos').row()
    .text(`${EMOJIS.back} Назад`, 'subscription');
}

// Клавиатура настройки реферальной ОП
export function getReferralOPSetupKeyboard() {
  return new InlineKeyboard()
    .text(`🎯 Включить реферальную ОП`, 'referral_op_enable')
    .text(`⏰ С таймером`, 'referral_op_enable_timer').row()
    .text(`📊 Мой ID для команд`, 'referral_op_my_id')
    .text(`📋 Скопировать команду`, 'referral_op_copy_command').row()
    .text(`⚙️ Настройки проверки`, 'referral_op_settings')
    .text(`${EMOJIS.back} Назад`, 'subscription_referral_prgram');
}