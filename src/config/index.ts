// src/config/index.ts
import dotenv from 'dotenv';

dotenv.config();

export const config = {
  // Bot Configuration
  bot: {
    token: process.env.BOT_TOKEN!,
    webhookUrl: process.env.WEBAPP_URL,
    adminIds: process.env.ADMIN_IDS?.split(',').map(id => parseInt(id)) || []
  },

  // Database Configuration  
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    name: process.env.DB_NAME || 'prgram_bot',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASS || 'password'
  },

  // Telegram API
  telegram: {
    apiId: process.env.API_ID,
    apiHash: process.env.API_HASH
  },

  // Payment Configuration
  payment: {
    starsProviderToken: process.env.STARS_PROVIDER_TOKEN,
    exchangeRate: 10, // 1 Star = 10 GRAM
    bonusRates: {
      100: 0,     // 100 Stars = 1000 GRAM (базовый курс)
      450: 0.10,  // +10% бонус
      850: 0.15,  // +15% бонус
      2000: 0.20  // +20% бонус + 1000 GRAM
    }
  },

  // User Levels Configuration
  userLevels: {
    bronze: {
      minBalance: 0,
      maxBalance: 9999,
      earnMultiplier: 1.0,
      maxTasksPerDay: 5,
      commission: 0.07,
      referralBonus: 1000,
      priority: 1
    },
    silver: {
      minBalance: 10000,
      maxBalance: 49999,
      earnMultiplier: 1.2,
      maxTasksPerDay: 15,
      commission: 0.06,
      referralBonus: 1500,
      priority: 2
    },
    gold: {
      minBalance: 50000,
      maxBalance: 99999,
      earnMultiplier: 1.35,
      maxTasksPerDay: 30,
      commission: 0.05,
      referralBonus: 2000,
      priority: 3
    },
    premium: {
      minBalance: 100000,
      maxBalance: Infinity,
      earnMultiplier: 1.5,
      maxTasksPerDay: -1, // безлимит
      commission: 0.03,
      referralBonus: 3000,
      priority: 4
    }
  },

  // Task Configuration
  tasks: {
    types: {
      subscribe_channel: {
        minReward: 50,
        maxReward: 500,
        autoCheck: true
      },
      join_group: {
        minReward: 75,
        maxReward: 750,
        autoCheck: true
      },
      view_post: {
        minReward: 25,
        maxReward: 200,
        autoCheck: true
      },
      bot_interaction: {
        minReward: 100,
        maxReward: 1500,
        autoCheck: false // ручная проверка
      },
      react_post: {
        minReward: 30,
        maxReward: 150,
        autoCheck: true
      }
    },
    defaultDuration: 7 * 24 * 60 * 60 * 1000, // 7 дней в мс
    autoApproveTimeout: 24 * 60 * 60 * 1000, // 24 часа
    maxExecutions: 1000
  },

  // Redis Configuration
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379'
  },

  // Application Configuration
  app: {
    port: parseInt(process.env.PORT || '3000'),
    nodeEnv: process.env.NODE_ENV || 'development',
    uploadPath: './storage/uploads'
  }
};

// Проверка обязательных переменных
export function validateConfig() {
  const required = ['BOT_TOKEN'];
  
  for (const key of required) {
    if (!process.env[key]) {
      throw new Error(`Environment variable ${key} is required`);
    }
  }
}

export default config;