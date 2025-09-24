// src/models/TaskExecution.ts
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
import { sequelize } from '../../config/database';
import { User } from './User';
import { Task } from './Task';
import { EXECUTION_STATUSES } from '../../utils/constants';

export interface TaskExecutionAttributes extends Model<InferAttributes<TaskExecution>, InferCreationAttributes<TaskExecution>> {
  id: CreationOptional<number>;
  taskId: ForeignKey<Task['id']>;
  userId: ForeignKey<User['id']>;
  
  // Статус выполнения
  status: CreationOptional<string>;
  
  // Доказательства выполнения
  screenshotUrl?: string;
  comment?: string;
  
  // Проверка
  checkedAt?: Date;
  checkedById?: ForeignKey<User['id']>;
  rejectionReason?: string;
  
  // Награда
  rewardAmount: number;
  rewardPaid: CreationOptional<boolean>;
  rewardPaidAt?: Date;
  
  // Автопроверка
  autoCheckAttempts: CreationOptional<number>;
  autoCheckResult?: object;
  
  // Время
  startedAt: CreationOptional<Date>;
  completedAt?: Date;
  expiresAt?: Date;
  
  // Даты
  createdAt: CreationOptional<Date>;
  updatedAt: CreationOptional<Date>;
  
  // Ассоциации
  task?: NonAttribute<Task>;
  user?: NonAttribute<User>;
  checkedBy?: NonAttribute<User>;
}

export class TaskExecution extends Model<InferAttributes<TaskExecution>, InferCreationAttributes<TaskExecution>> implements TaskExecutionAttributes {
  declare id: CreationOptional<number>;
  declare taskId: ForeignKey<Task['id']>;
  declare userId: ForeignKey<User['id']>;
  
  declare status: CreationOptional<string>;
  
  declare screenshotUrl?: string;
  declare comment?: string;
  
  declare checkedAt?: Date;
  declare checkedById?: ForeignKey<User['id']>;
  declare rejectionReason?: string;
  
  declare rewardAmount: number;
  declare rewardPaid: CreationOptional<boolean>;
  declare rewardPaidAt?: Date;
  
  declare autoCheckAttempts: CreationOptional<number>;
  declare autoCheckResult?: object;
  
  declare startedAt: CreationOptional<Date>;
  declare completedAt?: Date;
  declare expiresAt?: Date;
  
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
  
  // Ассоциации
  declare task?: NonAttribute<Task>;
  declare user?: NonAttribute<User>;
  declare checkedBy?: NonAttribute<User>;
  
  declare static associations: {
    task: Association<TaskExecution, Task>;
    user: Association<TaskExecution, User>;
    checkedBy: Association<TaskExecution, User>;
  };

  // Методы экземпляра
  isPending(): boolean {
    return this.status === EXECUTION_STATUSES.PENDING;
  }

  isInReview(): boolean {
    return this.status === EXECUTION_STATUSES.IN_REVIEW;
  }

  isCompleted(): boolean {
    return this.status === EXECUTION_STATUSES.COMPLETED || 
           this.status === EXECUTION_STATUSES.AUTO_APPROVED;
  }

  isRejected(): boolean {
    return this.status === EXECUTION_STATUSES.REJECTED;
  }

  canBeAutoChecked(): boolean {
    return this.status === EXECUTION_STATUSES.PENDING &&
           (this.autoCheckAttempts || 0) < 3;
  }

  getStatusIcon(): string {
    switch (this.status) {
      case EXECUTION_STATUSES.PENDING: return '🟡';
      case EXECUTION_STATUSES.IN_REVIEW: return '🔍';
      case EXECUTION_STATUSES.COMPLETED: return '✅';
      case EXECUTION_STATUSES.AUTO_APPROVED: return '🤖';
      case EXECUTION_STATUSES.REJECTED: return '❌';
      default: return '❓';
    }
  }

  getStatusText(): string {
    switch (this.status) {
      case EXECUTION_STATUSES.PENDING: return 'Ожидает проверки';
      case EXECUTION_STATUSES.IN_REVIEW: return 'На проверке';
      case EXECUTION_STATUSES.COMPLETED: return 'Выполнено';
      case EXECUTION_STATUSES.AUTO_APPROVED: return 'Авто-проверка';
      case EXECUTION_STATUSES.REJECTED: return 'Отклонено';
      default: return 'Неизвестно';
    }
  }

  async approve(checkedById?: number): Promise<void> {
    this.status = EXECUTION_STATUSES.COMPLETED;
    this.completedAt = new Date();
    this.checkedAt = new Date();
    if (checkedById) {
      this.checkedById = checkedById;
    }
    await this.save();
  }

  async autoApprove(): Promise<void> {
    this.status = EXECUTION_STATUSES.AUTO_APPROVED;
    this.completedAt = new Date();
    this.checkedAt = new Date();
    await this.save();
  }

  async reject(reason: string, checkedById?: number): Promise<void> {
    this.status = EXECUTION_STATUSES.REJECTED;
    this.rejectionReason = reason;
    this.checkedAt = new Date();
    if (checkedById) {
      this.checkedById = checkedById;
    }
    await this.save();
  }

  async sendToReview(): Promise<void> {
    this.status = EXECUTION_STATUSES.IN_REVIEW;
    await this.save();
  }

  async markRewardPaid(): Promise<void> {
    this.rewardPaid = true;
    this.rewardPaidAt = new Date();
    await this.save();
  }

  async incrementAutoCheckAttempts(): Promise<void> {
    this.autoCheckAttempts = (this.autoCheckAttempts || 0) + 1;
    await this.save();
  }
}

// Инициализация модели
TaskExecution.init({
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  taskId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'tasks',
      key: 'id'
    }
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  status: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: EXECUTION_STATUSES.PENDING,
    validate: {
      isIn: [Object.values(EXECUTION_STATUSES)]
    }
  },
  screenshotUrl: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  comment: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  checkedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  checkedById: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  rejectionReason: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  rewardAmount: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      min: 0
    }
  },
  rewardPaid: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  rewardPaidAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  autoCheckAttempts: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    validate: {
      min: 0,
      max: 10
    }
  },
  autoCheckResult: {
    type: DataTypes.JSONB,
    allowNull: true
  },
  startedAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  completedAt: {
    type: DataTypes.DATE,
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
  tableName: 'task_executions',
  timestamps: true,
  underscored: true,
  indexes: [
    {
      unique: true,
      fields: ['task_id', 'user_id']
    },
    {
      fields: ['task_id']
    },
    {
      fields: ['user_id']
    },
    {
      fields: ['status']
    },
    {
      fields: ['checked_by_id']
    },
    {
      fields: ['reward_paid']
    },
    {
      fields: ['created_at']
    },
    {
      fields: ['expires_at']
    }
  ]
});

// Ассоциации
TaskExecution.belongsTo(Task, {
  as: 'task',
  foreignKey: 'taskId'
});

TaskExecution.belongsTo(User, {
  as: 'user',
  foreignKey: 'userId'
});

TaskExecution.belongsTo(User, {
  as: 'checkedBy',
  foreignKey: 'checkedById'
});

Task.hasMany(TaskExecution, {
  as: 'executions',
  foreignKey: 'taskId'
});

User.hasMany(TaskExecution, {
  as: 'taskExecutions',
  foreignKey: 'userId'
});

User.hasMany(TaskExecution, {
  as: 'checkedExecutions',
  foreignKey: 'checkedById'
});

export { TaskExecution };