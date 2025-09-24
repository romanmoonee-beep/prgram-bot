// src/models/index.ts
import { sequelize } from '../config/database';

// Импорт всех моделей
import { User } from './User';
import { Task } from './Task';
import { TaskExecution } from './TaskExecution';
import { Transaction } from './Transaction';
import { Check, CheckActivation } from './Check';
import { Notification } from './Notification';

// Экспорт моделей
export {
  User,
  Task,
  TaskExecution,
  Transaction,
  Check,
  CheckActivation,
  Notification
};

// Экспорт экземпляра sequelize
export { sequelize };

// Объект с инициализированными моделями
export const models = {
  User,
  Task,
  TaskExecution,
  Transaction,
  Check,
  CheckActivation,
  Notification
};

// Функция для инициализации всех ассоциаций
export function initializeAssociations() {
  // Ассоциации уже определены в каждой модели
  // Эта функция может использоваться для дополнительной настройки
  console.log('✅ All model associations initialized');
}

// Функция для синхронизации БД
export async function syncDatabase(options: { force?: boolean; alter?: boolean } = {}) {
  try {
    await sequelize.sync(options);
    console.log('✅ Database synchronized successfully');
  } catch (error) {
    console.error('❌ Database synchronization failed:', error);
    throw error;
  }
}

// Функция для создания индексов (если нужны дополнительные)
export async function createIndexes() {
  try {
    // Дополнительные составные индексы
    await sequelize.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_level_balance 
      ON users(level, balance);
    `);
    
    await sequelize.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_type_status_created 
      ON tasks(type, status, created_at);
    `);
    
    await sequelize.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_task_executions_status_created 
      ON task_executions(status, created_at);
    `);
    
    await sequelize.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_user_type_created 
      ON transactions(user_id, type, created_at);
    `);
    
    console.log('✅ Additional indexes created successfully');
  } catch (error) {
    console.warn('⚠️ Some indexes might already exist:', error.message);
  }
}

// Функция для создания расширений PostgreSQL
export async function createExtensions() {
  try {
    // Расширение для полнотекстового поиска
    await sequelize.query('CREATE EXTENSION IF NOT EXISTS pg_trgm;');
    
    // Расширение для UUID
    await sequelize.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');
    
    console.log('✅ PostgreSQL extensions created successfully');
  } catch (error) {
    console.warn('⚠️ Some extensions might already exist:', error.message);
  }
}

// Функция для полной настройки БД
export async function setupDatabase(options: { 
  sync?: boolean; 
  force?: boolean; 
  alter?: boolean;
  createExtensions?: boolean;
  createIndexes?: boolean;
} = {}) {
  const {
    sync = true,
    force = false,
    alter = false,
    createExtensions: shouldCreateExtensions = true,
    createIndexes: shouldCreateIndexes = true
  } = options;

  try {
    console.log('🔄 Setting up database...');
    
    // Проверка подключения
    await sequelize.authenticate();
    console.log('✅ Database connection established');
    
    // Создание расширений
    if (shouldCreateExtensions) {
      await createExtensions();
    }
    
    // Синхронизация моделей
    if (sync) {
      await syncDatabase({ force, alter });
    }
    
    // Инициализация ассоциаций
    initializeAssociations();
    
    // Создание дополнительных индексов
    if (shouldCreateIndexes) {
      await createIndexes();
    }
    
    console.log('✅ Database setup completed successfully');
    
  } catch (error) {
    console.error('❌ Database setup failed:', error);
    throw error;
  }
}

// Функция для очистки старых данных
export async function cleanupOldData() {
  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    // Удаление старых уведомлений
    const deletedNotifications = await Notification.destroy({
      where: {
        createdAt: {
          [sequelize.Sequelize.Op.lt]: thirtyDaysAgo
        },
        isRead: true
      }
    });
    
    // Удаление истекших чеков
    const deletedChecks = await Check.destroy({
      where: {
        expiresAt: {
          [sequelize.Sequelize.Op.lt]: now
        },
        isActive: false
      }
    });
    
    // Деактивация просроченных заданий
    const expiredTasks = await Task.update(
      { status: 'expired' },
      {
        where: {
          expiresAt: {
            [sequelize.Sequelize.Op.lt]: now
          },
          status: 'active'
        }
      }
    );
    
    console.log(`✅ Cleanup completed:
      - Deleted ${deletedNotifications} old notifications
      - Deleted ${deletedChecks} expired checks  
      - Expired ${expiredTasks[0]} tasks`);
      
    return {
      deletedNotifications,
      deletedChecks,
      expiredTasks: expiredTasks[0]
    };
    
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    throw error;
  }
}

// Экспорт по умолчанию
export default {
  models,
  sequelize,
  setupDatabase,
  syncDatabase,
  initializeAssociations,
  createIndexes,
  createExtensions,
  cleanupOldData
};