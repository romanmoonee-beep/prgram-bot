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
import { USER_LEVELS } from '../utils/constants';

export interface UserAttributes extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
  id: CreationOptional<number>;
  telegramId: number;
  username?: string;
  firstName?: string;
  lastName?: string;
  languageCode?: string;
  
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
  premiumExpiresAt?: Date;
  
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
  declare premiumExpiresAt?: Date;
  
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
      return this.firstName