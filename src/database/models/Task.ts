// src/models/Task.ts
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
import { TASK_TYPES, TASK_STATUSES } from '../utils/constants';

export interface TaskAttributes extends Model<InferAttributes<Task>, InferCreationAttributes<Task>> {
  id: CreationOptional<number>;
  authorId: ForeignKey<User['id']>;
  
  // Основная информация
  type: string;
  title: string;
  description?: string;
  targetUrl: string;
  
  // Параметры задания
  reward: number;
  totalExecutions: number;
  completedExecutions: CreationOptional<number>;
  remainingExecutions: CreationOptional<number>;
  
  // Настройки
  autoCheck: CreationOptional<boolean>;
  requireScreenshot: CreationOptional<boolean>;
  priority: CreationOptional<number>;
  isTopPromoted: CreationOptional<boolean>;
  
  // Условия выполнения
  conditions?: object;
  requiredSubscriptions?: string[];
  minAccountAge?: number; // в днях
  minLevel?: string;
  
  // Статус и время
  status: CreationOptional<string>;
  expiresAt: Date;
  pausedAt?: Date;
  pausedReason?: string;
  
  // Финансы
  totalCost: CreationOptional<number>;
  spentAmount: CreationOptional<number>;
  frozenAmount: CreationOptional<number>;
  
  // Статистика
  views: CreationOptional<number>;
  clicks: CreationOptional<number>;
  conversions: CreationOptional<number>;
  
  // Даты
  createdAt: CreationOptional<Date>;
  updatedAt: CreationOptional<Date>;
  
  // Ассоциации
  author?: NonAttribute<User>;
}

export class Task extends Model<InferAttributes<Task>, InferCreationAttributes<Task>> implements TaskAttributes {
  declare id: CreationOptional<number>;
  declare authorId: ForeignKey<User['id']>;
  
  declare type: string;
  declare title: string;
  declare description?: string;
  declare targetUrl: string;
  
  declare reward: number;
  declare totalExecutions: number;
  declare completedExecutions: CreationOptional<number>;
  declare remainingExecutions: CreationOptional<number>;
  
  declare autoCheck: CreationOptional<boolean>;
  declare requireScreenshot: CreationOptional<boolean>;
  declare priority: CreationOptional<number>;
  declare isTopPromoted: CreationOptional<boolean>;
  
  declare conditions?: object;
  declare requiredSubscriptions?: string[];
  declare minAccountAge?: number;
  declare minLevel?: string;
  
  declare status: CreationOptional<string>;
  declare expiresAt: Date;
  declare pausedAt?: Date;
  declare pausedReason?: string;
  
  declare totalCost: CreationOptional<number>;
  declare spentAmount: CreationOptional<number>;
  declare frozenAmount: CreationOptional<number>;
  
  declare views: CreationOptional<number>;
  declare clicks: CreationOptional<number>;
  declare conversions: CreationOptional<number>;
  
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
  
  // Ассоциации
  declare author?: NonAttribute<User>;
  
  declare static associations: {
    author: Association<Task, User>;
  };

  // Методы экземпляра
  isActive(): boolean {
    return this.status === TASK_STATUSES.ACTIVE && 
           this.expiresAt > new Date() &&
           (this.remainingExecutions || 0) > 0;
  }

  isExpired(): boolean {
    return this.expiresAt <= new Date();
  }

  isCompleted(): boolean {
    return this.status === TASK_STATUSES.COMPLETED ||
           (this.remainingExecutions || 0) <= 0;
  }

  getTypeIcon(): string {
    switch (this.type) {
      case TASK_TYPES.SUBSCRIBE_CHANNEL: return '📺';
      case TASK_TYPES.JOIN_GROUP: return '👥';
      case TASK_TYPES.VIEW_POST: return '👀';
      case TASK_TYPES.BOT_INTERACTION: return '🤖';
      case TASK_TYPES.REACT_POST: return '👍';
      default: return '📋';
    }
  }

  getTypeText(): string {
    switch (this.type) {
      case TASK_TYPES.SUBSCRIBE_CHANNEL: return 'Подписка на канал';
      case TASK_TYPES.JOIN_GROUP: return 'Вступление в группу';
      case TASK_TYPES.VIEW_POST: return 'Просмотр поста';
      case TASK_TYPES.BOT_INTERACTION: return 'Переход в бота';
      case TASK_TYPES.REACT_POST: return 'Реакция на пост';
      default: return 'Неизвестное задание';
    }
  }

  getStatusIcon(): string {
    switch (this.status) {
      case TASK_STATUSES.ACTIVE: return '🟢';
      case TASK_STATUSES.PAUSED: return '🟡';
      case TASK_STATUSES.COMPLETED: return '✅';
      case TASK_STATUSES.CANCELLED: return '❌';
      case TASK_STATUSES.EXPIRED: return '⏰';
      default: return '❓';
    }
  }

  getStatusText(): string {
    switch (this.status) {
      case TASK_STATUSES.ACTIVE: return 'Активное';
      case TASK_STATUSES.PAUSED: return 'Приостановлено';
      case TASK_STATUSES.COMPLETED: return 'Завершено';
      case TASK_STATUSES.CANCELLED: return 'Отменено';
      case TASK_STATUSES.EXPIRED: return 'Истекло';
      default: return 'Неизвестно';
    }
  }

  getProgress(): { completed: number; total: number; percentage: number } {
    const completed = this.completedExecutions || 0;
    const total = this.totalExecutions;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
    
    return { completed, total, percentage };
  }

  getConversionRate(): number {
    const clicks = this.clicks || 0;
    const conversions = this.conversions || 0;
    
    if (clicks === 0) return 0;
    return Math.round((conversions / clicks) * 100 * 100) / 100; // округление до 2 знаков
  }

  getRemainingBudget(): number {
    const totalCost = this.totalCost || 0;
    const spentAmount = this.spentAmount || 0;
    return totalCost - spentAmount;
  }

  canUserExecute(user: User): { canExecute: boolean; reason?: string } {
    // Проверка активности задания
    if (!this.isActive()) {
      return { canExecute: false, reason: 'Задание неактивно' };
    }

    // Проверка автора (автор не может выполнять свои задания)
    if (this.authorId === user.id) {
      return { canExecute: false, reason: 'Нельзя выполнять собственные задания' };
    }

    // Проверка уровня пользователя
    if (this.minLevel) {
      const userLevel = user.getLevel();
      const requiredLevels = ['bronze', 'silver', 'gold', 'premium'];
      const userLevelIndex = requiredLevels.indexOf(userLevel);
      const minLevelIndex = requiredLevels.indexOf(this.minLevel);
      
      if (userLevelIndex < minLevelIndex) {
        return { canExecute: false, reason: `Требуется уровень ${this.minLevel}` };
      }
    }

    // Проверка возраста аккаунта
    if (this.minAccountAge) {
      const accountAge = Math.floor((Date.now() - user.registeredAt.getTime()) / (1000 * 60 * 60 * 24));
      if (accountAge < this.minAccountAge) {
        return { canExecute: false, reason: `Требуется возраст аккаунта ${this.minAccountAge} дней` };
      }
    }

    return { canExecute: true };
  }

  async incrementViews(): Promise<void> {
    this.views = (this.views || 0) + 1;
    await this.save();
  }

  async incrementClicks(): Promise<void> {
    this.clicks = (this.clicks || 0) + 1;
    await this.save();
  }

  async incrementConversions(): Promise<void> {
    this.conversions = (this.conversions || 0) + 1;
    this.completedExecutions = (this.completedExecutions || 0) + 1;
    this.remainingExecutions = Math.max(0, this.totalExecutions - (this.completedExecutions || 0));
    
    // Проверка завершения задания
    if (this.remainingExecutions <= 0) {
      this.status = TASK_STATUSES.COMPLETED;
    }
    
    await this.save();
  }

  async pause(reason?: string): Promise<void> {
    this.status = TASK_STATUSES.PAUSED;
    this.pausedAt = new Date();
    this.pausedReason = reason;
    await this.save();
  }

  async resume(): Promise<void> {
    this.status = TASK_STATUSES.ACTIVE;
    this.pausedAt = undefined;
    this.pausedReason = undefined;
    await this.save();
  }

  async cancel(): Promise<void> {
    this.status = TASK_STATUSES.CANCELLED;
    await this.save();
  }
}

// Инициализация модели
Task.init({
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  authorId: {
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
      isIn: [Object.values(TASK_TYPES)]
    }
  },
  title: {
    type: DataTypes.STRING(200),
    allowNull: false,
    validate: {
      len: [3, 200]
    }
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  targetUrl: {
    type: DataTypes.TEXT,
    allowNull: false,
    validate: {
      isUrl: true
    }
  },
  reward: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      min: 1,
      max: 100000
    }
  },
  totalExecutions: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      min: 1,
      max: 10000
    }
  },
  completedExecutions: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    validate: {
      min: 0
    }
  },
  remainingExecutions: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      min: 0
    }
  },
  autoCheck: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true
  },
  requireScreenshot: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  priority: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1,
    validate: {
      min: 1,
      max: 10
    }
  },
  isTopPromoted: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  conditions: {
    type: DataTypes.JSONB,
    allowNull: true
  },
  requiredSubscriptions: {
    type: DataTypes.ARRAY(DataTypes.STRING),
    allowNull: true
  },
  minAccountAge: {
    type: DataTypes.INTEGER,
    allowNull: true,
    validate: {
      min: 0
    }
  },
  minLevel: {
    type: DataTypes.STRING(20),
    allowNull: true
  },
  status: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: TASK_STATUSES.ACTIVE,
    validate: {
      isIn: [Object.values(TASK_STATUSES)]
    }
  },
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: false
  },
  pausedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  pausedReason: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  totalCost: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  spentAmount: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  frozenAmount: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  views: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  clicks: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  conversions: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
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
  tableName: 'tasks',
  timestamps: true,
  underscored: true,
  indexes: [
    {
      fields: ['author_id']
    },
    {
      fields: ['type']
    },
    {
      fields: ['status']
    },
    {
      fields: ['expires_at']
    },
    {
      fields: ['is_top_promoted']
    },
    {
      fields: ['priority']
    },
    {
      fields: ['created_at']
    }
  ],
  hooks: {
    beforeCreate: (task: Task) => {
      // Устанавливаем remainingExecutions при создании
      task.remainingExecutions = task.totalExecutions;
    }
  }
});

// Ассоциации
Task.belongsTo(User, {
  as: 'author',
  foreignKey: 'authorId'
});

User.hasMany(Task, {
  as: 'createdTasks',
  foreignKey: 'authorId'
});

export { Task };