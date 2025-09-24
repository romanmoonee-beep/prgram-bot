// src/models/Notification.ts
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
import { User } from './User';
import { NOTIFICATION_TYPES } from '../utils/constants';

export interface NotificationAttributes extends Model<InferAttributes<Notification>, InferCreationAttributes<Notification>> {
  id: CreationOptional<number>;
  userId: ForeignKey<User['id']>;
  
  // Содержимое уведомления
  type: string;
  title: string;
  message: string;
  
  // Дополнительные данные
  data?: object;
  actionUrl?: string;
  
  // Статус
  isRead: CreationOptional<boolean>;
  readAt?: Date;
  
  // Приоритет и отображение
  priority: CreationOptional<number>;
  icon?: string;
  
  // Время жизни
  expiresAt?: Date;
  
  // Даты
  createdAt: CreationOptional<Date>;
  updatedAt: CreationOptional<Date>;
  
  // Ассоциации
  user?: NonAttribute<User>;
}

export class Notification extends Model<InferAttributes<Notification>, InferCreationAttributes<Notification>> implements NotificationAttributes {
  declare id: CreationOptional<number>;
  declare userId: ForeignKey<User['id']>;
  
  declare type: string;
  declare title: string;
  declare message: string;
  
  declare data?: object;
  declare actionUrl?: string;
  
  declare isRead: CreationOptional<boolean>;
  declare readAt?: Date;
  
  declare priority: CreationOptional<number>;
  declare icon?: string;
  
  declare expiresAt?: Date;
  
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
  
  // Ассоциации
  declare user?: NonAttribute<User>;
  
  declare static associations: {
    user: Association<Notification, User>;
  };

  // Методы экземпляра
  isExpired(): boolean {
    return this.expiresAt ? this.expiresAt <= new Date() : false;
  }

  getTypeIcon(): string {
    if (this.icon) return this.icon;
    
    switch (this.type) {
      case NOTIFICATION_TYPES.TASK_COMPLETED: return '✅';
      case NOTIFICATION_TYPES.TASK_CREATED: return '📢';
      case NOTIFICATION_TYPES.REFERRAL_JOINED: return '🤝';
      case NOTIFICATION_TYPES.BALANCE_LOW: return '⚠️';
      case NOTIFICATION_TYPES.LEVEL_UP: return '⭐';
      case NOTIFICATION_TYPES.CHECK_RECEIVED: return '💳';
      case NOTIFICATION_TYPES.SYSTEM: return '🔔';
      default: return '📢';
    }
  }

  getPriorityText(): string {
    switch (this.priority) {
      case 1: return 'Низкий';
      case 2: return 'Средний';
      case 3: return 'Высокий';
      case 4: return 'Критический';
      default: return 'Обычный';
    }
  }

  async markAsRead(): Promise<void> {
    if (!this.isRead) {
      this.isRead = true;
      this.readAt = new Date();
      await this.save();
    }
  }

  // Статические методы для создания уведомлений
  static async createTaskCompleted(userId: number, taskTitle: string, reward: number): Promise<Notification> {
    return await Notification.create({
      userId,
      type: NOTIFICATION_TYPES.TASK_COMPLETED,
      title: 'Задание выполнено!',
      message: `Задание "${taskTitle}" выполнено. Получено ${reward} GRAM.`,
      priority: 2,
      data: { reward }
    });
  }

  static async createTaskCreated(userId: number, taskTitle: string, taskId: number): Promise<Notification> {
    return await Notification.create({
      userId,
      type: NOTIFICATION_TYPES.TASK_CREATED,
      title: 'Задание создано',
      message: `Ваше задание "${taskTitle}" опубликовано и доступно для выполнения.`,
      priority: 1,
      data: { taskId }
    });
  }

  static async createReferralJoined(userId: number, referralName: string, bonus: number): Promise<Notification> {
    return await Notification.create({
      userId,
      type: NOTIFICATION_TYPES.REFERRAL_JOINED,
      title: 'Новый реферал!',
      message: `${referralName} присоединился по вашей ссылке. Получено ${bonus} GRAM.`,
      priority: 2,
      data: { bonus }
    });
  }

  static async createBalanceLow(userId: number, currentBalance: number): Promise<Notification> {
    return await Notification.create({
      userId,
      type: NOTIFICATION_TYPES.BALANCE_LOW,
      title: 'Низкий баланс',
      message: `Ваш баланс составляет ${currentBalance} GRAM. Рекомендуем пополнить для продолжения работы.`,
      priority: 3
    });
  }

  static async createLevelUp(userId: number, newLevel: string): Promise<Notification> {
    const levelNames: { [key: string]: string } = {
      'bronze': 'Бронза',
      'silver': 'Серебро', 
      'gold': 'Золото',
      'premium': 'Премиум'
    };

    return await Notification.create({
      userId,
      type: NOTIFICATION_TYPES.LEVEL_UP,
      title: 'Повышение уровня!',
      message: `Поздравляем! Вы достигли уровня ${levelNames[newLevel] || newLevel}.`,
      priority: 2,
      data: { newLevel }
    });
  }

  static async createCheckReceived(userId: number, amount: number, checkCode: string): Promise<Notification> {
    return await Notification.create({
      userId,
      type: NOTIFICATION_TYPES.CHECK_RECEIVED,
      title: 'Чек получен!',
      message: `Вы получили чек на ${amount} GRAM (код: ${checkCode}).`,
      priority: 2,
      data: { amount, checkCode }
    });
  }

  static async createSystemNotification(userId: number, title: string, message: string, priority: number = 1): Promise<Notification> {
    return await Notification.create({
      userId,
      type: NOTIFICATION_TYPES.SYSTEM,
      title,
      message,
      priority
    });
  }

  // Массовые операции
  static async markAllAsRead(userId: number): Promise<number> {
    const [affectedCount] = await Notification.update(
      { 
        isRead: true,
        readAt: new Date()
      },
      { 
        where: { 
          userId,
          isRead: false
        }
      }
    );
    return affectedCount;
  }

  static async getUnreadCount(userId: number): Promise<number> {
    return await Notification.count({
      where: {
        userId,
        isRead: false
      }
    });
  }

  static async cleanupExpired(): Promise<number> {
    const count = await Notification.destroy({
      where: {
        expiresAt: {
          [sequelize.Sequelize.Op.lte]: new Date()
        }
      }
    });
    return count;
  }
}

// Инициализация модели
Notification.init({
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  type: {
    type: DataTypes.STRING(50),
    allowNull: false,
    validate: {
      isIn: [Object.values(NOTIFICATION_TYPES)]
    }
  },
  title: {
    type: DataTypes.STRING(255),
    allowNull: false,
    validate: {
      len: [1, 255]
    }
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: false,
    validate: {
      len: [1, 1000]
    }
  },
  data: {
    type: DataTypes.JSONB,
    allowNull: true
  },
  actionUrl: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  isRead: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  readAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  priority: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1,
    validate: {
      min: 1,
      max: 4
    }
  },
  icon: {
    type: DataTypes.STRING(10),
    allowNull: true
  },
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  createdAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  updatedAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  }
}, {
  sequelize,
  tableName: 'notifications',
  timestamps: true,
  underscored: true,
  indexes: [
    {
      fields: ['user_id']
    },
    {
      fields: ['type']
    },
    {
      fields: ['is_read']
    },
    {
      fields: ['priority']
    },
    {
      fields: ['expires_at']
    },
    {
      fields: ['created_at']
    },
    {
      // Составной индекс для быстрого получения непрочитанных уведомлений
      fields: ['user_id', 'is_read', 'created_at']
    }
  ]
});

// Ассоциации
Notification.belongsTo(User, {
  as: 'user',
  foreignKey: 'userId'
});

User.hasMany(Notification, {
  as: 'notifications',
  foreignKey: 'userId'
});

export { Notification };