# PR GRAM Bot 🚀

Telegram бот для взаимного продвижения каналов через систему заданий с вознаграждением GRAM.

## 📋 Возможности

- ✅ **Заработок на заданиях** - подписки, просмотры, реакции
- ✅ **Создание заданий** - продвижение своих проектов
- ✅ **Система чеков** - отправка GRAM через чеки
- ✅ **Реферальная программа** - доходы с приглашений
- ✅ **Система уровней** - Bronze, Silver, Gold, Premium
- ✅ **Админ-панель** - управление системой
- ⚠️ **Проверка подписки (ОП)** - в разработке
- ⚠️ **Полная автопроверка** - базовая реализация

## 🛠 Технологии

- **Node.js** + **TypeScript**
- **Grammy** (Telegram Bot Framework)
- **PostgreSQL** + **Sequelize ORM**
- **Redis** (очереди и кэш)
- **Bull** (фоновые задачи)
- **Express** (веб-сервер)

## 🚀 Быстрый запуск

### 1. Клонирование и установка

```bash
git clone <repository>
cd pr-gram-bot
npm install
```

### 2. Настройка окружения

```bash
# Скопируйте конфигурацию
cp .env.example .env

# Отредактируйте .env файл
nano .env
```

**Обязательные переменные:**
```env
BOT_TOKEN=your_bot_token_from_botfather
DB_HOST=localhost
DB_NAME=prgram_bot
DB_USER=postgres
DB_PASS=your_password
ADMIN_IDS=your_telegram_id
```

### 3. База данных

**Установка PostgreSQL:**
```bash
# Ubuntu/Debian
sudo apt update
sudo apt install postgresql postgresql-contrib

# macOS (с Homebrew)
brew install postgresql
brew services start postgresql

# Создание базы данных
sudo -u postgres createdb prgram_bot
```

**Миграция:**
```bash
npm run migrate
```

### 4. Redis (опционально)

```bash
# Ubuntu/Debian
sudo apt install redis-server

# macOS (с Homebrew)
brew install redis
brew services start redis

# Или используйте Docker
docker run -d --name redis -p 6379:6379 redis:alpine
```

### 5. Запуск

```bash
# Разработка
npm run dev

# Продакшн (сначала собрать)
npm run build
npm start
```

## 📁 Структура проекта

```
src/
├── app.ts                 # Главный файл приложения
├── config/                # Конфигурация
├── bot/
│   ├── handlers/          # Обработчики команд и событий
│   ├── keyboards/         # Клавиатуры для сообщений
│   └── middlewares/       # Middleware для бота
├── database/
│   ├── models/            # Модели данных (Sequelize)
│   └── config/            # Настройки БД
├── jobs/                  # Фоновые задачи
│   ├── cron/              # Cron задачи
│   ├── queues/            # Очереди (Bull)
│   └── workers/           # Обработчики очередей
├── services/              # Бизнес-логика
└── utils/                 # Утилиты и константы
```

## ⚙️ Конфигурация

### Переменные окружения

| Переменная | Описание | Обязательно |
|------------|----------|-------------|
| `BOT_TOKEN` | Токен бота от @BotFather | ✅ |
| `DB_HOST` | Хост PostgreSQL | ✅ |
| `DB_NAME` | Имя базы данных | ✅ |
| `DB_USER` | Пользователь БД | ✅ |
| `DB_PASS` | Пароль БД | ✅ |
| `ADMIN_IDS` | ID админов (через запятую) | ✅ |
| `REDIS_URL` | URL Redis сервера | ❌ |
| `WEBAPP_URL` | URL приложения (для webhook) | ❌ |
| `NODE_ENV` | Окружение (development/production) | ❌ |

### Создание бота

1. Найдите [@BotFather](https://t.me/BotFather) в Telegram
2. Отправьте `/newbot`
3. Следуйте инструкциям
4. Скопируйте полученный токен в `BOT_TOKEN`

### Настройка админа

1. Получите свой Telegram ID (например, через [@userinfobot](https://t.me/userinfobot))
2. Добавьте ID в переменную `ADMIN_IDS`

## 🔧 Основные команды

```bash
# Установка зависимостей
npm install

# Разработка с hot reload
npm run dev

# Сборка проекта
npm run build

# Запуск продакшн версии
npm start

# Миграция БД
npm run migrate

# Линтинг кода
npm run lint
npm run lint:fix

# Тестирование
npm test
```

## 📊 Админ-панель

После запуска бота админы могут использовать команды:

- `/start` - главное меню (кнопка "Админ-панель")
- Статистика системы
- Управление пользователями
- Модерация заданий
- Рассылки

## 💳 Система платежей

Бот поддерживает пополнение через **Telegram Stars**:

1. Настройте `STARS_PROVIDER_TOKEN` (получите у Telegram)
2. Пользователи могут пополнить баланс через встроенные платежи
3. Автоматическое начисление GRAM с бонусами

## 🔍 Мониторинг

### Логи

```bash
# Просмотр логов
tail -f logs/combined.log

# Только ошибки
tail -f logs/error.log
```

### Статистика Redis

```bash
redis-cli info
redis-cli monitor
```

### База данных

```sql
-- Подключение к БД
psql -h localhost -U postgres -d prgram_bot

-- Основные таблицы
SELECT COUNT(*) FROM users;
SELECT COUNT(*) FROM tasks;
SELECT COUNT(*) FROM task_executions;
```

## 🚨 Устранение неполадок

### Частые проблемы

**1. Ошибка подключения к БД**
```bash
# Проверьте статус PostgreSQL
sudo systemctl status postgresql

# Перезапустите сервис
sudo systemctl restart postgresql
```

**2. Бот не отвечает**
```bash
# Проверьте токен бота
curl -s "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getMe"

# Проверьте логи
tail -f logs/error.log
```

**3. Redis недоступен**
```bash
# Проверьте Redis
redis-cli ping

# Если не установлен
sudo apt install redis-server
```

**4. Ошибки миграции**
```sql
-- Сбросить БД (ОСТОРОЖНО!)
DROP DATABASE prgram_bot;
CREATE DATABASE prgram_bot;

-- Затем запустить миграцию
npm run migrate
```

### Режим отладки

```bash
# Запуск с подробными логами
LOG_LEVEL=debug npm run dev

# Только ошибки
LOG_LEVEL=error npm start
```

## 📈 Развертывание

### VPS/Сервер

```bash
# Установка Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# PM2 для управления процессом
npm install -g pm2

# Запуск с PM2
pm2 start dist/app.js --name "prgram-bot"
pm2 save
pm2 startup
```

### Docker (опционально)

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist ./dist
EXPOSE 3000
CMD ["node", "dist/app.js"]
```

### Nginx (для webhook)

```nginx
server {
    listen 80;
    server_name yourdomain.com;
    
    location /webhook {
        proxy_pass http://localhost:3000/webhook;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## 🤝 Разработка

### Добавление новых функций

1. **Обработчики** - `src/bot/handlers/`
2. **Модели данных** - `src/database/models/`
3. **Фоновые задачи** - `src/jobs/workers/`
4. **API эндпоинты** - `src/app.js`

### Структура обработчика

```typescript
// src/bot/handlers/myFeature.ts
import { Bot } from 'grammy';
import { requireAuth } from '../middlewares/auth';

export function setupMyFeatureHandlers(bot: Bot) {
  bot.callbackQuery('my_feature', requireAuth, async (ctx) => {
    // Ваша логика
  });
}
```

### Добавление модели

```typescript
// src/database/models/MyModel.ts
import { Model, DataTypes } from 'sequelize';
import { sequelize } from '../config/database';

export class MyModel extends Model {
  // Определение модели
}

MyModel.init({
  // Поля модели
}, {
  sequelize,
  tableName: 'my_models'
});
```

## 📄 Лицензия

MIT License - смотрите файл LICENSE

## 🐛 Сообщить об ошибке

1. Проверьте логи: `tail -f logs/error.log`
2. Опишите проблему и шаги для воспроизведения
3. Приложите релевантные логи
4. Укажите версию Node.js и OS

---

**Статус разработки:** 80% готов к использованию

- ✅ Основной функционал работает
- ⚠️ Некоторые функции требуют доработки
- 🔄 Активная разработка продолжается