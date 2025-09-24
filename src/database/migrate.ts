// src/database/migrate.ts
import { setupDatabase } from './models';
import { logger } from '../utils/logger';

async function runMigration() {
  try {
    console.log('🔄 Starting database migration...');
    
    await setupDatabase({
      sync: true,
      force: false, // НЕ удаляем существующие данные
      alter: true,  // Обновляем структуру таблиц
      createExtensions: true,
      createIndexes: true
    });
    
    console.log('✅ Database migration completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Database migration failed:', error);
    process.exit(1);
  }
}

// Запускаем миграцию если файл вызван напрямую
if (require.main === module) {
  runMigration();
}