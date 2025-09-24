// src/bot/keyboards/main.ts
import { InlineKeyboard } from 'grammy';
import { EMOJIS, TEXTS } from '../../utils/constants';

// Главное меню
export function getMainMenuKeyboard() {
  return new InlineKeyboard()
    .text(`${EMOJIS.user} ${TEXTS.cabinet}`, 'cabinet')
    .text(`${EMOJIS.earn} ${TEXTS.earn}`, 'earn').row()
    .text(`${EMOJIS.advertise} ${TEXTS.advertise}`, 'advertise')
    .text(`${EMOJIS.checks} ${TEXTS.checks}`, 'checks').row()
    .text(`${EMOJIS.referrals} ${TEXTS.referrals}`, 'referrals')
    .text(`${EMOJIS.subscription} Проверка`, 'subscription').row()
    .text(`${EMOJIS.settings} ${TEXTS.settings}`, 'settings')
    .text(`${EMOJIS.help} Помощь`, 'help');
}

// Кабинет пользователя
export function getCabinetKeyboard(isAdmin: boolean = false) {
  const keyboard = new InlineKeyboard()
    .text(`${EMOJIS.stats} Статистика`, 'cabinet_stats')
    .text(`${EMOJIS.money} Пополнить`, 'cabinet_deposit').row()
    .text(`${EMOJIS.chart} Мои задания`, 'cabinet_tasks')
    .text(`${EMOJIS.bell} Уведомления`, 'cabinet_notifications').row()
    .text(`${EMOJIS.settings} Настройки`, 'cabinet_settings');

  if (isAdmin) {
    keyboard.row().text(`${EMOJIS.key} Админ-панель`, 'admin_panel');
  }

  keyboard.row().text(`${EMOJIS.home} Главное меню`, 'main_menu');
  
  return keyboard;
}

// Меню заработка
export function getEarnKeyboard() {
  return new InlineKeyboard()
    .text(`${EMOJIS.channel} Каналы`, 'earn_channels')
    .text(`${EMOJIS.group} Группы`, 'earn_groups').row()
    .text(`${EMOJIS.view} Посты`, 'earn_posts')
    .text(`${EMOJIS.bot} Боты`, 'earn_bots').row()
    .text(`${EMOJIS.fire} Топ задания`, 'earn_top')
    .text(`${EMOJIS.diamond} Премиум`, 'earn_premium').row()
    .text(`${EMOJIS.home} Главное меню`, 'main_menu');
}

// Меню рекламы
export function getAdvertiseKeyboard() {
  return new InlineKeyboard()
    .text(`${EMOJIS.advertise} Создать задание`, 'advertise_create')
    .text(`${EMOJIS.chart} Мои задания`, 'advertise_my_tasks').row()
    .text(`${EMOJIS.stats} Статистика`, 'advertise_stats')
    .text(`${EMOJIS.diamond} Топ-продвижение`, 'advertise_promote').row()
    .text(`${EMOJIS.home} Главное меню`, 'main_menu');
}

// Меню чеков
export function getChecksKeyboard() {
  return new InlineKeyboard()
    .text(`${EMOJIS.checks} Создать чек`, 'checks_create')
    .text(`${EMOJIS.money} Мои чеки`, 'checks_my').row()
    .text(`${EMOJIS.gift} Активировать`, 'checks_activate')
    .text(`${EMOJIS.stats} История`, 'checks_history').row()
    .text(`${EMOJIS.home} Главное меню`, 'main_menu');
}

// Меню рефералов
export function getReferralsKeyboard() {
  return new InlineKeyboard()
    .text(`${EMOJIS.referrals} Моя ссылка`, 'referrals_link')
    .text(`${EMOJIS.stats} Статистика`, 'referrals_stats').row()
    .text(`${EMOJIS.gift} Мои рефералы`, 'referrals_list')
    .text(`${EMOJIS.diamond} Бонусы`, 'referrals_bonuses').row()
    .text(`${EMOJIS.home} Главное меню`, 'main_menu');
}

// Пагинация
export function getPaginationKeyboard(
  currentPage: number,
  totalPages: number,
  prefix: string,
  additionalButtons?: Array<{ text: string; data: string }>
) {
  const keyboard = new InlineKeyboard();
  
  // Дополнительные кнопки сверху
  if (additionalButtons) {
    let buttonsInRow = 0;
    additionalButtons.forEach(button => {
      keyboard.text(button.text, button.data);
      buttonsInRow++;
      if (buttonsInRow % 2 === 0) keyboard.row();
    });
    if (buttonsInRow % 2 !== 0) keyboard.row();
  }
  
  // Кнопки пагинации
  if (totalPages > 1) {
    const buttons = [];
    
    if (currentPage > 1) {
      buttons.push({ text: '⬅️', data: `${prefix}_page_${currentPage - 1}` });
    }
    
    buttons.push({ 
      text: `${currentPage}/${totalPages}`, 
      data: 'current_page' 
    });
    
    if (currentPage < totalPages) {
      buttons.push({ text: '➡️', data: `${prefix}_page_${currentPage + 1}` });
    }
    
    buttons.forEach(button => keyboard.text(button.text, button.data));
    keyboard.row();
  }
  
  keyboard.text(`${EMOJIS.home} Главное меню`, 'main_menu');
  
  return keyboard;
}

// Подтверждение действия
export function getConfirmKeyboard(confirmData: string, cancelData: string = 'cancel') {
  return new InlineKeyboard()
    .text(`${EMOJIS.check} Подтвердить`, confirmData)
    .text(`${EMOJIS.cross} Отмена`, cancelData);
}

// Назад и отмена
export function getBackKeyboard(backData: string) {
  return new InlineKeyboard()
    .text(`${EMOJIS.back} Назад`, backData)
    .text(`${EMOJIS.cross} Отмена`, 'cancel');
}

// Только назад
export function getOnlyBackKeyboard(backData: string) {
  return new InlineKeyboard()
    .text(`${EMOJIS.back} Назад`, backData);
}

// Админская панель
export function getAdminKeyboard() {
  return new InlineKeyboard()
    .text(`${EMOJIS.stats} Статистика`, 'admin_stats')
    .text(`${EMOJIS.user} Пользователи`, 'admin_users').row()
    .text(`${EMOJIS.chart} Задания`, 'admin_tasks')
    .text(`${EMOJIS.money} Транзакции`, 'admin_transactions').row()
    .text(`${EMOJIS.bell} Рассылка`, 'admin_broadcast')
    .text(`${EMOJIS.settings} Настройки`, 'admin_settings').row()
    .text(`${EMOJIS.home} Главное меню`, 'main_menu');
}tasks')
    .text(`${EMOJIS.bell} Уведомления`, 'cabinet_notifications').row()
    .text(`${EMOJIS.settings} Настройки`, 'cabinet_settings');

  if (isAdmin) {
    keyboard.row().text(`${EMOJIS.key} Админ-панель`, 'admin_panel');
  }

  keyboard.row().text(`${EMOJIS.home} Главное меню`, 'main_menu');
  
  return keyboard;
}

// Меню заработка
export function getEarnKeyboard() {
  return new InlineKeyboard()
    .text(`${EMOJIS.channel} Каналы`, 'earn_channels')
    .text(`${EMOJIS.group} Группы`, 'earn_groups').row()
    .text(`${EMOJIS.view} Посты`, 'earn_posts')
    .text(`${EMOJIS.bot} Боты`, 'earn_bots').row()
    .text(`${EMOJIS.fire} Топ задания`, 'earn_top')
    .text(`${EMOJIS.diamond} Премиум`, 'earn_premium').row()
    .text(`${EMOJIS.home} Главное меню`, 'main_menu');
}

// Меню рекламы
export function getAdvertiseKeyboard() {
  return new InlineKeyboard()
    .text(`${EMOJIS.advertise} Создать задание`, 'advertise_create')
    .text(`${EMOJIS.chart} Мои задания`, 'advertise_my_tasks').row()
    .text(`${EMOJIS.stats} Статистика`, 'advertise_stats')
    .text(`${EMOJIS.diamond} Топ-продвижение`, 'advertise_promote').row()
    .text(`${EMOJIS.home} Главное меню`, 'main_menu');
}

// Меню чеков
export function getChecksKeyboard() {
  return new InlineKeyboard()
    .text(`${EMOJIS.checks} Создать чек`, 'checks_create')
    .text(`${EMOJIS.money} Мои чеки`, 'checks_my').row()
    .text(`${EMOJIS.gift} Активировать`, 'checks_activate')
    .text(`${EMOJIS.stats} История`, 'checks_history').row()
    .text(`${EMOJIS.home} Главное меню`, 'main_menu');
}

// Меню рефералов
export function getReferralsKeyboard() {
  return new InlineKeyboard()
    .text(`${EMOJIS.referrals} Моя ссылка`, 'referrals_link')
    .text(`${EMOJIS.stats} Статистика`, 'referrals_stats').row()
    .text(`${EMOJIS.gift} Мои рефералы`, 'referrals_list')
    .text(`${EMOJIS.diamond} Бонусы`, 'referrals_bonuses').row()
    .text(`${EMOJIS.home} Главное меню`, 'main_menu');
}

// Пагинация
export function getPaginationKeyboard(
  currentPage: number,
  totalPages: number,
  prefix: string,
  additionalButtons?: Array<{ text: string; data: string }>
) {
  const keyboard = new InlineKeyboard();
  
  // Дополнительные кнопки сверху
  if (additionalButtons) {
    let buttonsInRow = 0;
    additionalButtons.forEach(button => {
      keyboard.text(button.text, button.data);
      buttonsInRow++;
      if (buttonsInRow % 2 === 0) keyboard.row();
    });
    if (buttonsInRow % 2 !== 0) keyboard.row();
  }
  
  // Кнопки пагинации
  if (totalPages > 1) {
    const buttons = [];
    
    if (currentPage > 1) {
      buttons.push({ text: '⬅️', data: `${prefix}_page_${currentPage - 1}` });
    }
    
    buttons.push({ 
      text: `${currentPage}/${totalPages}`, 
      data: 'current_page' 
    });
    
    if (currentPage < totalPages) {
      buttons.push({ text: '➡️', data: `${prefix}_page_${currentPage + 1}` });
    }
    
    buttons.forEach(button => keyboard.text(button.text, button.data));
    keyboard.row();
  }
  
  keyboard.text(`${EMOJIS.home} Главное меню`, 'main_menu');
  
  return keyboard;
}

// Подтверждение действия
export function getConfirmKeyboard(confirmData: string, cancelData: string = 'cancel') {
  return new InlineKeyboard()
    .text(`${EMOJIS.check} Подтвердить`, confirmData)
    .text(`${EMOJIS.cross} Отмена`, cancelData);
}

// Назад и отмена
export function getBackKeyboard(backData: string) {
  return new InlineKeyboard()
    .text(`${EMOJIS.back} Назад`, backData)
    .text(`${EMOJIS.cross} Отмена`, 'cancel');
}

// Только назад
export function getOnlyBackKeyboard(backData: string) {
  return new InlineKeyboard()
    .text(`${EMOJIS.back} Назад`, backData);
}

// Админская панель
export function getAdminKeyboard() {
  return new InlineKeyboard()
    .text(`${EMOJIS.stats} Статистика`, 'admin_stats')
    .text(`${EMOJIS.user} Пользователи`, 'admin_users').row()
    .text(`${EMOJIS.chart} Задания`, 'admin_tasks')
    .text(`${EMOJIS.money} Транзакции`, 'admin_transactions').row()
    .text(`${EMOJIS.bell} Рассылка`, 'admin_broadcast')
    .text(`${EMOJIS.settings} Настройки`, 'admin_settings').row()
    .text(`${EMOJIS.home} Главное меню`, 'main_menu');
}