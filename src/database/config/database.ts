// src/config/database.ts
import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';

dotenv.config();

// Конфигурация базы данных
const config = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'prgram_bot',
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASS || 'password',
  dialect: 'postgres' as const,
  logging: process.env.NODE_ENV === 'development' ? console.log : false,
  pool: {
    max: 10,
    min: 0,
    acquire: 30000,
    idle: 10000
  },
  timezone: '+00:00', // UTC
  dialectOptions: {
    useUTC: true,
    dateStrings: true,
    typeCast: true
  }
};

// Создание экземпляра Sequelize
export const sequelize = new Sequelize(
  config.database,
  config.username,
  config.password,
  {
    host: config.host,
    port: config.port,
    dialect: config.dialect,
    logging: config.logging,
    pool: config.pool,
    timezone: config.timezone,
    dialectOptions: config.dialectOptions,
    define: {
      timestamps: true,
      underscored: true,
      paranoid: false, // Мягкое удаление отключено
      freezeTableName: true // Не изменять названия таблиц
    }
  }
);

// Тестирование подключения
export async function testConnection(): Promise<boolean> {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connection established successfully');
    return true;
  } catch (error) {
    console.error('❌ Unable to connect to database:', error);
    return false;
  }
}