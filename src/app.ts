// src/app.ts - FINAL FIXED VERSION
import { Bot, webhookCallback } from 'grammy';
import express from 'express';
import dotenv from 'dotenv';
import { sequelize, setupDatabase } from './database/models';
import { setupHandlers, setupErrorHandlers } from './bot/handlers/init';
import { setupMiddlewares } from './bot/middlewares';
import { startCronJobs } from './jobs/cron';
import { logger } from './utils/logger';
import { initTelegramService } from './services/telegram';

// Загрузка переменных окружения
dotenv.config();

// Проверка обязательных переменных
if (!process.env.BOT_TOKEN) {
  throw new Error('BOT_TOKEN is required');
}

// Создание бота
const bot = new Bot(process.env.BOT_TOKEN);

// Express приложение для webhook
const app = express();
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  });
});

// API endpoint для получения статистики бота
app.get('/api/stats', async (req, res) => {
  try {
    const { User, Task, Transaction } = await import('./database/models');
    
    const stats = {
      users: {
        total: await User.count(),
        active: await User.count({ where: { isActive: true } }),
        premium: await User.count({ where: { isPremium: true } })
      },
      tasks: {
        total: await Task.count(),
        active: await Task.count({ where: { status: 'active' } }),
        completed: await Task.count({ where: { status: 'completed' } })
      },
      transactions: {
        total: await Transaction.count({ where: { status: 'completed' } }),
        totalAmount: await Transaction.sum('amount', { where: { status: 'completed' } }) || 0
      }
    };
    
    res.json(stats);
  } catch (error) {
    logger.error('Stats API error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Endpoint для webhook уведомлений
app.post('/api/webhook/payment', express.json(), async (req, res) => {
  try {
    logger.info('Payment webhook received:', req.body);
    res.json({ success: true });
  } catch (error) {
    logger.error('Payment webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

async function startBot() {
  try {
    logger.info('🚀 Starting PR GRAM Bot...');
    
    // Настройка базы данных
    await setupDatabase({
      sync: true,
      force: false,
      alter: process.env.NODE_ENV === 'development',
      createExtensions: true,
      createIndexes: true
    });
    
    logger.info('✅ Database setup completed');

    // Инициализация Telegram сервиса
    initTelegramService(bot);

    // Настройка middleware для бота
    setupMiddlewares(bot);
    logger.info('✅ Bot middlewares configured');

    // Настройка обработчиков команд и событий
    setupHandlers(bot);
    logger.info('✅ Bot handlers configured');
    
    // Настройка обработчиков ошибок
    setupErrorHandlers(bot);
    logger.info('✅ Error handlers configured');

    // Получение информации о боте
    const botInfo = await bot.api.getMe();
    logger.info(`🤖 Bot initialized: @${botInfo.username} (${botInfo.first_name})`);

    if (process.env.NODE_ENV === 'production' && process.env.WEBAPP_URL) {
      // Production: Webhook режим
      const webhookUrl = `${process.env.WEBAPP_URL}/webhook`;
      
      logger.info(`🌐 Setting webhook URL: ${webhookUrl}`);
      
      // Удаляем существующий webhook перед установкой нового
      await bot.api.deleteWebhook();
      
      // Установка нового webhook
      await bot.api.setWebhook(webhookUrl, {
        drop_pending_updates: true,
        allowed_updates: [
          'message',
          'callback_query',
          'inline_query',
          'chosen_inline_result',
          'pre_checkout_query',
          'successful_payment'
        ]
      });
      
      // Обработка webhook
      app.use('/webhook', webhookCallback(bot, 'express'));
      
      const port = process.env.PORT || 3000;
      app.listen(port, () => {
        logger.info(`🚀 Webhook server running on port ${port}`);
        logger.info(`🌐 Bot is ready to receive updates at ${webhookUrl}`);
      });
    } else {
      // Development: Polling режим
      logger.info('🔄 Starting in polling mode (development)...');
      
      // Удаляем webhook для polling режима
      await bot.api.deleteWebhook();
      
      await bot.start({
        drop_pending_updates: true,
        allowed_updates: [
          'message',
          'callback_query',
          'inline_query',
          'chosen_inline_result',
          'pre_checkout_query',
          'successful_payment'
        ]
      });

      // В режиме разработки тоже запускаем Express для API
      const port = process.env.PORT || 3000;
      app.listen(port, () => {
        logger.info(`🌐 API server running on port ${port}`);
      });
    }

    // Запуск cron задач
    startCronJobs();
    logger.info('✅ Cron jobs started');
    
    // Отправка уведомления админам о запуске бота
    if (process.env.ADMIN_IDS) {
      const adminIds = process.env.ADMIN_IDS.split(',').map(id => parseInt(id));
      const startMessage = `🎉 **PR GRAM Bot запущен!**\n\n` +
                          `🤖 Версия: ${process.env.npm_package_version || '1.0.0'}\n` +
                          `🌐 Режим: ${process.env.NODE_ENV || 'development'}\n` +
                          `⏰ Время: ${new Date().toLocaleString('ru-RU')}\n\n` +
                          `Бот готов к работе! 🚀`;
      
      for (const adminId of adminIds) {
        try {
          await bot.api.sendMessage(adminId, startMessage, { parse_mode: 'Markdown' });
        } catch (error) {
          logger.warn(`Failed to notify admin ${adminId}:`, error.message);
        }
      }
    }
    
    logger.info('🎉 PR GRAM Bot is fully operational and ready for users!');
    
  } catch (error) {
    logger.error('❌ Critical error during bot startup:', error);
    process.exit(1);
  }
}

// Graceful shutdown handler
async function gracefulShutdown(signal: string) {
  logger.info(`🛑 Received ${signal}. Starting graceful shutdown...`);
  
  try {
    // Остановка бота
    logger.info('⏹️  Stopping bot...');
    await bot.stop();
    
    // Остановка cron задач
    const { stopCronJobs } = await import('./jobs/cron');
    stopCronJobs();
    logger.info('⏹️  Cron jobs stopped');
    
    // Закрытие подключения к БД
    await sequelize.close();
    logger.info('⏹️  Database connection closed');
    
    logger.info('✅ Graceful shutdown completed successfully');
  } catch (error) {
    logger.error('❌ Error during graceful shutdown:', error);
  }
  
  process.exit(0);
}

// Обработчики сигналов завершения
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Обработчик необработанных исключений
process.on('unhandledRejection', (reason, promise) => {
  logger.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  logger.error('❌ Uncaught Exception:', error);
  // В продакшене перезапускаем процесс при критических ошибках
  if (process.env.NODE_ENV === 'production') {
    gracefulShutdown('UNCAUGHT_EXCEPTION');
  }
});

// Запуск бота
startBot().catch((error) => {
  logger.error('❌ Failed to start PR GRAM Bot:', error);
  process.exit(1);
});

// Экспорт для тестирования
export { bot, app };