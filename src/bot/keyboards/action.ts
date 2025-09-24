// src/bot/keyboards/actions.ts
import { InlineKeyboard } from 'grammy';
import { EMOJIS } from '../../utils/constants';

// Клавиатура подтверждения платежа Stars
export function getStarsPaymentKeyboard(amount: number, gramAmount: number) {
  return new InlineKeyboard()
    .text(`⭐ Оплатить ${amount} Stars`, `pay_stars_${amount}`)
    .text(`${EMOJIS.info} Подробнее о Stars`, 'stars_info').row()
    .text(`${EMOJIS.back} Выбрать другой пакет`, 'cabinet_deposit');
}

// Клавиатура выбора сортировки заданий
export function getTaskSortKeyboard(currentSort: string = 'reward_desc') {
  const sorts = [
    { key: 'reward_desc', text: '💰 По награде ↓', emoji: currentSort === 'reward_desc' ? '✅' : '' },
    { key: 'reward_asc', text: '💰 По награде ↑', emoji: currentSort === 'reward_asc' ? '✅' : '' },
    { key: 'date_desc', text: '📅 Новые первые', emoji: currentSort === 'date_desc' ? '✅' : '' },
    { key: 'date_asc', text: '📅 Старые первые', emoji: currentSort === 'date_asc' ? '✅' : '' },
    { key: 'popularity_desc', text: '🔥 Популярные', emoji: currentSort === 'popularity_desc' ? '✅' : '' },
    { key: 'deadline_asc', text: '⏰ Скоро истекают', emoji: currentSort === 'deadline_asc' ? '✅' : '' }
  ];

  const keyboard = new InlineKeyboard();
  
  sorts.forEach((sort, index) => {
    keyboard.text(`${sort.emoji} ${sort.text}`, `sort_tasks_${sort.key}`);
    if (index % 2 === 1) keyboard.row();
  });
  
  if (sorts.length % 2 !== 0) keyboard.row();
  
  keyboard.text(`${EMOJIS.back} Назад`, 'earn');
  
  return keyboard;
}

// Клавиатура фильтров заданий
export function getTaskFiltersKeyboard(filters: any = {}) {
  const keyboard = new InlineKeyboard();
  
  // Фильтр по типу
  keyboard
    .text(`${filters.type === 'subscribe_channel' ? '✅' : '▫️'} Каналы`, 'filter_type_subscribe_channel')
    .text(`${filters.type === 'join_group' ? '✅' : '▫️'} Группы`, 'filter_type_join_group').row()
    .text(`${filters.type === 'view_post' ? '✅' : '▫️'} Посты`, 'filter_type_view_post')
    .text(`${filters.type === 'bot_interaction' ? '✅' : '▫️'} Боты`, 'filter_type_bot_interaction').row();
  
  // Фильтр по награде
  keyboard
    .text(`💰 До 100 GRAM`, 'filter_reward_100')
    .text(`💎 100-500 GRAM`, 'filter_reward_500').row()
    .text(`🔥 500+ GRAM`, 'filter_reward_high')
    .text(`🚀 Только топ`, 'filter_only_promoted').row();
  
  // Фильтр по уровню доступа
  keyboard
    .text(`${filters.level ? '✅' : '▫️'} Мой уровень и выше`, 'filter_my_level')
    .text(`${filters.autoCheck ? '✅' : '▫️'} Автопроверка`, 'filter_auto_check').row();
  
  // Управление
  keyboard
    .text(`🔄 Сбросить фильтры`, 'filter_reset')
    .text(`✅ Применить`, 'filter_apply').row()
    .text(`${EMOJIS.back} Назад`, 'earn');
  
  return keyboard;
}

// Клавиатура подтверждения выполнения задания
export function getTaskConfirmKeyboard(taskId: number) {
  return new InlineKeyboard()
    .text(`✅ Да, выполнил условия`, `task_confirm_execution_${taskId}`)
    .text(`❌ Отмена`, `task_${taskId}`).row()
    .text(`${EMOJIS.info} Перечитать условия`, `task_${taskId}`);
}

// Клавиатура для задания с ручной проверкой
export function getManualTaskKeyboard(taskId: number) {
  return new InlineKeyboard()
    .text(`📤 Загрузить скриншот`, `task_upload_${taskId}`)
    .text(`${EMOJIS.info} Требования к скриншоту`, `task_screenshot_requirements_${taskId}`).row()
    .text(`${EMOJIS.back} К заданию`, `task_${taskId}`);
}

// Клавиатура выбора периода для статистики
export function getPeriodKeyboard(currentPeriod: string = 'month') {
  const periods = [
    { key: 'today', text: '📊 Сегодня', emoji: currentPeriod === 'today' ? '✅' : '' },
    { key: 'week', text: '📅 Неделя', emoji: currentPeriod === 'week' ? '✅' : '' },
    { key: 'month', text: '📈 Месяц', emoji: currentPeriod === 'month' ? '✅' : '' },
    { key: 'quarter', text: '📊 Квартал', emoji: currentPeriod === 'quarter' ? '✅' : '' },
    { key: 'year', text: '📈 Год', emoji: currentPeriod === 'year' ? '✅' : '' },
    { key: 'all', text: '📋 Все время', emoji: currentPeriod === 'all' ? '✅' : '' }
  ];

  const keyboard = new InlineKeyboard();
  
  periods.forEach((period, index) => {
    keyboard.text(`${period.emoji} ${period.text}`, `period_${period.key}`);
    if (index % 2 === 1) keyboard.row();
  });
  
  if (periods.length % 2 !== 0) keyboard.row();
  
  keyboard.text(`${EMOJIS.back} Назад`, 'cabinet_stats');
  
  return keyboard;
}

// Клавиатура управления задaniem
export function getTaskManageKeyboard(taskId: number, isAuthor: boolean = false) {
  const keyboard = new InlineKeyboard()
    .text(`📊 Статистика`, `task_stats_${taskId}`)
    .text(`👁️ Подробнее`, `task_details_${taskId}`).row();

  if (isAuthor) {
    keyboard
      .text(`⏸️ Приостановить`, `task_pause_${taskId}`)
      .text(`▶️ Возобновить`, `task_resume_${taskId}`).row()
      .text(`⚙️ Настройки`, `task_settings_${taskId}`)
      .text(`🔚 Завершить`, `task_complete_${taskId}`).row();
  }

  keyboard.text(`${EMOJIS.back} Назад`, 'advertise_my_tasks');
  
  return keyboard;
}

// Клавиатура настроек задания
export function getTaskSettingsKeyboard(taskId: number) {
  return new InlineKeyboard()
    .text(`💰 Изменить награду`, `task_edit_reward_${taskId}`)
    .text(`📝 Изменить описание`, `task_edit_description_${taskId}`).row()
    .text(`⏰ Продлить срок`, `task_extend_deadline_${taskId}`)
    .text(`🔥 Добавить в топ`, `task_promote_${taskId}`).row()
    .text(`📊 Расширенная аналитика`, `task_advanced_analytics_${taskId}`)
    .text(`${EMOJIS.back} Назад`, `task_manage_${taskId}`);
}

// Клавиатура выбора причины жалобы на задание
export function getTaskReportKeyboard(taskId: number) {
  return new InlineKeyboard()
    .text(`🚫 Спам`, `report_task_${taskId}_spam`)
    .text(`💸 Мошенничество`, `report_task_${taskId}_fraud`).row()
    .text(`🔞 Неприемлемое содержание`, `report_task_${taskId}_inappropriate`)
    .text(`❌ Невыполнимое задание`, `report_task_${taskId}_impossible`).row()
    .text(`📝 Другая причина`, `report_task_${taskId}_other`)
    .text(`${EMOJIS.back} Назад`, `task_${taskId}`);
}

// Клавиатура выбора типа чека при создании
export function getCheckTypeKeyboard() {
  return new InlineKeyboard()
    .text(`👤 Персональный чек`, 'create_personal_check')
    .text(`👥 Мульти-чек`, 'create_multi_check').row()
    .text(`🎁 Подарочный чек`, 'create_gift_check')
    .text(`🏆 Конкурсный чек`, 'create_contest_check').row()
    .text(`${EMOJIS.back} Назад`, 'checks');
}

// Клавиатура дополнительных настроек чека
export function getCheckAdvancedKeyboard() {
  return new InlineKeyboard()
    .text(`🔒 Установить пароль`, 'check_set_password')
    .text(`📺 Требовать подписку`, 'check_require_subscription').row()
    .text(`🖼️ Добавить картинку`, 'check_add_image')
    .text(`⏰ Срок действия`, 'check_set_expiry').row()
    .text(`🎯 Только для уровня`, 'check_set_level_requirement')
    .text(`✅ Продолжить без настроек`, 'check_skip_advanced').row()
    .text(`${EMOJIS.back} Назад`, 'checks_create');
}

// Клавиатура управления чеком
export function getCheckManageKeyboard(checkId: number, isCreator: boolean = false) {
  const keyboard = new InlineKeyboard()
    .text(`📊 Статистика`, `check_stats_${checkId}`)
    .text(`👁️ Детали`, `check_details_${checkId}`).row();

  if (isCreator) {
    keyboard
      .text(`⏸️ Деактивировать`, `check_deactivate_${checkId}`)
      .text(`🔄 Продлить`, `check_extend_${checkId}`).row()
      .text(`📤 Поделиться`, `check_share_${checkId}`)
      .text(`🗑️ Удалить`, `check_delete_${checkId}`).row();
  }

  keyboard.text(`${EMOJIS.back} Назад`, 'checks_my');
  
  return keyboard;
}

// Клавиатура выбора способа активации чека
export function getCheckActivationKeyboard() {
  return new InlineKeyboard()
    .text(`🏷️ Ввести код чека`, 'check_enter_code')
    .text(`📱 Сканировать QR`, 'check_scan_qr').row()
    .text(`🔗 По ссылке из сообщения`, 'check_from_link')
    .text(`${EMOJIS.back} Назад`, 'checks');
}

// Клавиатура для рефералов
export function getReferralActionsKeyboard() {
  return new InlineKeyboard()
    .text(`📤 Поделиться ссылкой`, 'referrals_share')
    .text(`📋 Скопировать ссылку`, 'referrals_copy').row()
    .text(`🎨 Создать промо-материалы`, 'referrals_create_promo')
    .text(`📊 Калькулятор доходов`, 'referrals_calculator').row()
    .text(`🏆 Топ моих рефералов`, 'referrals_top')
    .text(`📈 Детальная аналитика`, 'referrals_analytics').row()
    .text(`${EMOJIS.back} Назад`, 'referrals');
}

// Клавиатура промо-материалов для рефералов
export function getReferralPromoKeyboard() {
  return new InlineKeyboard()
    .text(`📝 Готовые тексты`, 'referrals_promo_texts')
    .text(`🎨 Картинки и баннеры`, 'referrals_promo_images').row()
    .text(`🎬 Видео-материалы`, 'referrals_promo_videos')
    .text(`📱 Для соцсетей`, 'referrals_promo_social').row()
    .text(`💼 Для бизнеса`, 'referrals_promo_business')
    .text(`${EMOJIS.back} Назад`, 'referrals');
}

// Клавиатура экспорта данных
export function getExportKeyboard() {
  return new InlineKeyboard()
    .text(`📊 Экспорт статистики`, 'export_stats')
    .text(`📋 Список заданий`, 'export_tasks').row()
    .text(`💰 История транзакций`, 'export_transactions')
    .text(`👥 Список рефералов`, 'export_referrals').row()
    .text(`💳 История чеков`, 'export_checks')
    .text(`🔔 Уведомления`, 'export_notifications').row()
    .text(`${EMOJIS.back} Назад`, 'cabinet_settings');
}

// Клавиатура выбора формата экспорта
export function getExportFormatKeyboard(dataType: string) {
  return new InlineKeyboard()
    .text(`📄 CSV файл`, `export_${dataType}_csv`)
    .text(`📊 Excel файл`, `export_${dataType}_excel`).row()
    .text(`📋 JSON файл`, `export_${dataType}_json`)
    .text(`📝 PDF отчет`, `export_${dataType}_pdf`).row()
    .text(`${EMOJIS.back} Назад`, 'export_menu');
}

// Клавиатура быстрых действий
export function getQuickActionsKeyboard() {
  return new InlineKeyboard()
    .text(`⚡ Найти задание`, 'quick_find_task')
    .text(`🚀 Создать задание`, 'quick_create_task').row()
    .text(`💳 Создать чек`, 'quick_create_check')
    .text(`📤 Пригласить друга`, 'quick_invite_friend').row()
    .text(`📊 Моя статистика`, 'quick_my_stats')
    .text(`💰 Пополнить баланс`, 'quick_deposit').row();
}

// Экспорт всех клавиатур
export {
  getStarsPaymentKeyboard,
  getTaskSortKeyboard,
  getTaskFiltersKeyboard,
  getTaskConfirmKeyboard,
  getManualTaskKeyboard,
  getPeriodKeyboard,
  getTaskManageKeyboard,
  getTaskSettingsKeyboard,
  getTaskReportKeyboard,
  getCheckTypeKeyboard,
  getCheckAdvancedKeyboard,
  getCheckManageKeyboard,
  getCheckActivationKeyboard,
  getReferralActionsKeyboard,
  getReferralPromoKeyboard,
  getExportKeyboard,
  getExportFormatKeyboard,
  getQuickActionsKeyboard
};