// src/models/User.ts
import { 
  Model, 
  DataTypes, 
  CreationOptional, 
  InferAttributes, 
  InferCreationAttributes,
  ForeignKey,
  NonAttribute,
  Association
} from 'sequelize';
import { sequelize } from '../config/database';
import { USER_LEVELS } from '../../utils/constants';

export interface UserAttributes extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
  id: CreationOptional<number>;
  telegramId: number;
  username?: string;
  firstName?: string;
  lastName?: string;
  languageCode?: string;
  currentState?: string | null;

  // Баланс и уровень
  balance: CreationOptional<number>;
  frozenBalance: CreationOptional<number>;
  level: CreationOptional<string>;
  totalEarned: CreationOptional<number>;
  totalSpent: CreationOptional<number>;
  
  // Статистика
  tasksCompleted: CreationOptional<number>;
  tasksCreated: CreationOptional<number>;
  referralsCount: CreationOptional<number>;
  premiumReferralsCount: CreationOptional<number>;
  
  // Реферальная система
  referrerId?: ForeignKey<User['id']>;
  referralCode: string;
  
  // Настройки
  isActive: CreationOptional<boolean>;
  isBanned: CreationOptional<boolean>;
  isPremium: CreationOptional<boolean>;
  premiumExpiresAt: Date | null;
  
  // Уведомления
  notificationSettings: CreationOptional<object>;
  
  // Даты
  lastActiveAt: CreationOptional<Date>;
  registeredAt: CreationOptional<Date>;
  createdAt: CreationOptional<Date>;
  updatedAt: CreationOptional<Date>;
  
  // Ассоциации
  referrer?: NonAttribute<User>;
  referrals?: NonAttribute<User[]>;
}

export class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> implements UserAttributes {
  declare id: CreationOptional<number>;
  declare telegramId: number;
  declare username?: string;
  declare firstName?: string;
  declare lastName?: string;
  declare languageCode?: string;
  declare currentState?: string | null;

  declare balance: CreationOptional<number>;
  declare frozenBalance: CreationOptional<number>;
  declare level: CreationOptional<string>;
  declare totalEarned: CreationOptional<number>;
  declare totalSpent: CreationOptional<number>;
  
  declare tasksCompleted: CreationOptional<number>;
  declare tasksCreated: CreationOptional<number>;
  declare referralsCount: CreationOptional<number>;
  declare premiumReferralsCount: CreationOptional<number>;
  
  declare referrerId?: ForeignKey<User['id']>;
  declare referralCode: string;
  
  declare isActive: CreationOptional<boolean>;
  declare isBanned: CreationOptional<boolean>;
  declare isPremium: CreationOptional<boolean>;
  declare premiumExpiresAt: Date | null;
  
  declare notificationSettings: CreationOptional<object>;
  
  declare lastActiveAt: CreationOptional<Date>;
  declare registeredAt: CreationOptional<Date>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
  
  // Ассоциации
  declare referrer?: NonAttribute<User>;
  declare referrals?: NonAttribute<User[]>;
  
  // Ассоциации
  declare static associations: {
    referrer: Association<User, User>;
    referrals: Association<User, User>;
  };

  // Методы экземпляра
  getDisplayName(): string {
    if (this.firstName && this.lastName) {
      return `${this.firstName} ${this.lastName}`;
    }
    if (this.firstName) {
      return this.firstName;
    }
    if (this.username) {
      return `@${this.username}`;
    }
    return `ID${this.telegramId}`;
  }

  getLevel(): string {
    const balance = this.balance || 0;
    if (balance >= 100000) return USER_LEVELS.PREMIUM;
    if (balance >= 50000) return USER_LEVELS.GOLD;
    if (balance >= 10000) return USER_LEVELS.SILVER;
    return USER_LEVELS.BRONZE;
  }

  getLevelText(): string {
    const level = this.getLevel();
    switch (level) {
      case USER_LEVELS.BRONZE: return 'Бронза';
      case USER_LEVELS.SILVER: return 'Серебро';
      case USER_LEVELS.GOLD: return 'Золото';
      case USER_LEVELS.PREMIUM: return 'Премиум';
      default: return 'Неизвестный';
    }
  }

  getLevelEmoji(): string {
    const level = this.getLevel();
    switch (level) {
      case USER_LEVELS.BRONZE: return '🥉';
      case USER_LEVELS.SILVER: return '🥈';
      case USER_LEVELS.GOLD: return '🥇';
      case USER_LEVELS.PREMIUM: return '💎';
      default: return '🥉';
    }
  }

  getCommissionRate(): number {
    const level = this.getLevel();
    switch (level) {
      case USER_LEVELS.BRONZE: return 0.07;
      case USER_LEVELS.SILVER: return 0.06;
      case USER_LEVELS.GOLD: return 0.05;
      case USER_LEVELS.PREMIUM: return 0.03;
      default: return 0.07;
    }
  }

  getEarnMultiplier(): number {
    const level = this.getLevel();
    switch (level) {
      case USER_LEVELS.BRONZE: return 1.0;
      case USER_LEVELS.SILVER: return 1.2;
      case USER_LEVELS.GOLD: return 1.35;
      case USER_LEVELS.PREMIUM: return 1.5;
      default: return 1.0;
    }
  }

  getReferralBonus(): number {
    const level = this.getLevel();
    switch (level) {
      case USER_LEVELS.BRONZE: return 1000;
      case USER_LEVELS.SILVER: return 1500;
      case USER_LEVELS.GOLD: return 2000;
      case USER_LEVELS.PREMIUM: return 3000;
      default: return 1000;
    }
  }

  async updateBalance(amount: number, operation: 'add' | 'subtract'): Promise<void> {
    const currentBalance = this.balance || 0;
    
    if (operation === 'add') {
      this.balance = currentBalance + amount;
      this.totalEarned = (this.totalEarned || 0) + amount;
    } else {
      if (currentBalance < amount) {
        throw new Error('Insufficient balance');
      }
      this.balance = currentBalance - amount;
      this.totalSpent = (this.totalSpent || 0) + amount;
    }
    
    // Обновляем уровень
    this.level = this.getLevel();
    
    await this.save();
  }

  async updateActivity(): Promise<void> {
    this.lastActiveAt = new Date();
    await this.save();
  }
}

User.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    telegramId: {
      type: DataTypes.BIGINT,
      allowNull: false,
      unique: true,
    },
    username: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    firstName: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    lastName: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    languageCode: {
      type: DataTypes.STRING(10),
      allowNull: true,
    },

    balance: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    frozenBalance: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    level: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'bronze',
    },
    totalEarned: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    totalSpent: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },

    tasksCompleted: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    tasksCreated: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    referralsCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    premiumReferralsCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },

    referrerId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    referralCode: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },

    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    isBanned: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    isPremium: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    premiumExpiresAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    notificationSettings: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
    },

    lastActiveAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    registeredAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    currentState: {
      type: DataTypes.STRING(1024),
      allowNull: true,
      defaultValue: null
    }
  },
  {
    sequelize,
    tableName: 'users',
    modelName: 'User',
  }
);

User.belongsTo(User, {
  as: 'referrer',
  foreignKey: 'referrerId'
});

User.hasMany(User, {
  as: 'referrals',
  foreignKey: 'referrerId'
});

