// src/bot/keyboards/index.ts
// Экспорт всех клавиатур из разных файлов

// Основные клавиатуры
export {
  getMainMenuKeyboard,
  getCabinetKeyboard,
  getEarnKeyboard,
  getAdvertiseKeyboard,
  getChecksKeyboard,
  getReferralsKeyboard,
  getPaginationKeyboard,
  getConfirmKeyboard,
  getBackKeyboard,
  getOnlyBackKeyboard,
  getAdminKeyboard
} from './main';

// Дополнительные клавиатуры
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
} from './additional';

// Клавиатуры системы проверки подписки
export {
  getSubscriptionMainKeyboard,
  getPublicSubscriptionKeyboard,
  getPrivateSubscriptionKeyboard,
  getInviteLinkSubscriptionKeyboard,
  getReferralSubscriptionKeyboard,
  getAutoDeleteKeyboard,
  getSubscriptionStatsKeyboard,
  getAutoDeleteTimeKeyboard,
  getSubscriptionExamplesKeyboard,
  getSubscriptionManageKeyboard,
  getDeleteSubscriptionKeyboard,
  getSubscriptionHelpKeyboard,
  getReferralOPSetupKeyboard
} from './subscription';

// Клавиатуры действий и состояний
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
} from './action';

// Вспомогательные функции для создания динамических клавиатур

/**
 * Создает клавиатуру со списком элементов для выбора
 */
export function createSelectionKeyboard(
  items: Array<{id: string | number, text: string, data: string}>,
  prefix: string,
  backData: string,
  itemsPerRow: number = 2
) {
  const { InlineKeyboard } = require('grammy');
  const keyboard = new InlineKeyboard();
  
  items.forEach((item, index) => {
    keyboard.text(item.text, `${prefix}_${item.data}`);
    if ((index + 1) % itemsPerRow === 0) keyboard.row();
  });
  
  if (items.length % itemsPerRow !== 0) keyboard.row();
  keyboard.text('⬅️ Назад', backData);
  
  return keyboard;
}

/**
 * Создает клавиатуру с переключателями вкл/выкл
 */
export function createToggleKeyboard(
  options: Array<{key: string, text: string, enabled: boolean}>,
  saveAction: string,
  backData: string
) {
  const { InlineKeyboard } = require('grammy');
  const keyboard = new InlineKeyboard();
  
  options.forEach((option, index) => {
    const status = option.enabled ? '✅' : '❌';
    keyboard.text(`${status} ${option.text}`, `toggle_${option.key}`);
    if ((index + 1) % 2 === 0) keyboard.row();
  });
  
  if (options.length % 2 !== 0) keyboard.row();
  
  keyboard
    .text('💾 Сохранить', saveAction)
    .text('⬅️ Назад', backData);
  
  return keyboard;
}

/**
 * Создает клавиатуру с числовыми значениями
 */
export function createNumberKeyboard(
  values: number[],
  prefix: string,
  currentValue?: number,
  backData: string = 'back'
) {
  const { InlineKeyboard } = require('grammy');
  const keyboard = new InlineKeyboard();
  
  values.forEach((value, index) => {
    const selected = value === currentValue ? '✅ ' : '';
    keyboard.text(`${selected}${value}`, `${prefix}_${value}`);
    if ((index + 1) % 3 === 0) keyboard.row();
  });
  
  if (values.length % 3 !== 0) keyboard.row();
  keyboard.text('⬅️ Назад', backData);
  
  return keyboard;
}

/**
 * Создает клавиатуру подтверждения с дополнительной информацией
 */
export function createConfirmationKeyboard(
  confirmText: string,
  confirmData: string,
  cancelData: string = 'cancel',
  infoText?: string,
  infoData?: string
) {
  const { InlineKeyboard } = require('grammy');
  const keyboard = new InlineKeyboard()
    .text(`✅ ${confirmText}`, confirmData)
    .text('❌ Отмена', cancelData);
    
  if (infoText && infoData) {
    keyboard.row().text(`ℹ️ ${infoText}`, infoData);
  }
  
  return keyboard;
}

/**
 * Создает клавиатуру с поиском и навигацией
 */
export function createSearchNavigationKeyboard(
  searchAction: string,
  sortAction: string,
  filterAction: string,
  backData: string
) {
  const { InlineKeyboard } = require('grammy');
  return new InlineKeyboard()
    .text('🔍 Поиск', searchAction)
    .text('📊 Сортировка', sortAction).row()
    .text('🔧 Фильтры', filterAction)
    .text('⬅️ Назад', backData);
}

/**
 * Создает клавиатуру управления состоянием (включить/выключить/настроить)
 */
export function createStateManagementKeyboard(
  isEnabled: boolean,
  enableAction: string,
  disableAction: string,
  settingsAction: string,
  backData: string
) {
  const { InlineKeyboard } = require('grammy');
  const keyboard = new InlineKeyboard();
  
  if (isEnabled) {
    keyboard
      .text('⏸️ Отключить', disableAction)
      .text('⚙️ Настройки', settingsAction);
  } else {
    keyboard.text('▶️ Включить', enableAction);
  }
  
  keyboard.row().text('⬅️ Назад', backData);
  
  return keyboard;
}

/**
 * Создает клавиатуру с временными интервалами
 */
export function createTimeIntervalKeyboard(
  intervals: Array<{text: string, value: string}>,
  prefix: string,
  backData: string
) {
  const { InlineKeyboard } = require('grammy');
  const keyboard = new InlineKeyboard();
  
  intervals.forEach((interval, index) => {
    keyboard.text(interval.text, `${prefix}_${interval.value}`);
    if ((index + 1) % 2 === 0) keyboard.row();
  });
  
  if (intervals.length % 2 !== 0) keyboard.row();
  keyboard.text('⬅️ Назад', backData);
  
  return keyboard;
}

/**
 * Создает адаптивную пагинацию с умным отображением номеров страниц
 */
export function createAdvancedPaginationKeyboard(
  currentPage: number,
  totalPages: number,
  prefix: string,
  maxVisiblePages: number = 5
) {
  const { InlineKeyboard } = require('grammy');
  const keyboard = new InlineKeyboard();
  
  if (totalPages <= 1) return keyboard;
  
  // Определяем видимый диапазон страниц
  let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
  let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
  
  // Корректируем начальную страницу если конечная достигла максимума
  if (endPage - startPage < maxVisiblePages - 1) {
    startPage = Math.max(1, endPage - maxVisiblePages + 1);
  }
  
  const buttons = [];
  
  // Кнопка "В начало" если мы далеко от первой страницы
  if (startPage > 2) {
    buttons.push({ text: '⏮️', data: `${prefix}_page_1` });
  }
  
}