// src/models/Transaction.ts
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
import { Task } from './Task';
import { TRANSACTION_TYPES } from '../../utils/constants';

export interface TransactionAttributes extends Model<InferAttributes<Transaction>, InferCreationAttributes<Transaction>> {
  id: CreationOptional<number>;
  userId: ForeignKey<User['id']>;
  
  // Основная информация
  type: string;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  
  // Связанные объекты
  relatedTaskId?: ForeignKey<Task['id']>;
  relatedUserId?: ForeignKey<User['id']>; // Для реферальных бонусов
  relatedCheckId?: number;
  
  // Детали транзакции
  description?: string;
  metadata?: object;
  
  // Внешние данные (для пополнений)
  externalId?: string;
  paymentProvider?: string;
  
  // Статус
  status: CreationOptional<string>;
  processedAt?: Date;
  failedReason?: string;
  
  // Даты
  createdAt: CreationOptional<Date>;
  updatedAt: CreationOptional<Date>;
  
  // Ассоциации
  user?: NonAttribute<User>;
  relatedTask?: NonAttribute<Task>;
  relatedUser?: NonAttribute<User>;
}

export class Transaction extends Model<InferAttributes<Transaction>, InferCreationAttributes<Transaction>> implements TransactionAttributes {
  declare id: CreationOptional<number>;
  declare userId: ForeignKey<User['id']>;
  
  declare type: string;
  declare amount: number;
  declare balanceBefore: number;
  declare balanceAfter: number;
  
  declare relatedTaskId?: ForeignKey<Task['id']>;
  declare relatedUserId?: ForeignKey<User['id']>;
  declare relatedCheckId?: number;
  
  declare description?: string;
  declare metadata?: object;
  
  declare externalId?: string;
  declare paymentProvider?: string;
  
  declare status: CreationOptional<string>;
  declare processedAt?: Date;
  declare failedReason?: string;
  
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
  
  // Ассоциации
  declare user?: NonAttribute<User>;
  declare relatedTask?: NonAttribute<Task>;
  declare relatedUser?: NonAttribute<User>;
  
  declare static associations: {
    user: Association<Transaction, User>;
    relatedTask: Association<Transaction, Task>;
    relatedUser: Association<Transaction, User>;
  };

  // Методы экземпляра
  isDeposit(): boolean {
    return [TRANSACTION_TYPES.DEPOSIT, TRANSACTION_TYPES.TASK_REWARD, TRANSACTION_TYPES.REFERRAL_BONUS, TRANSACTION_TYPES.REFUND, TRANSACTION_TYPES.CHECK_RECEIVED].includes(this.type as any);
  }

  isWithdrawal(): boolean {
    return [TRANSACTION_TYPES.WITHDRAW, TRANSACTION_TYPES.TASK_PAYMENT, TRANSACTION_TYPES.COMMISSION, TRANSACTION_TYPES.CHECK_SENT].includes(this.type as any);
  }

  getTypeIcon(): string {
    switch (this.type) {
      case TRANSACTION_TYPES.DEPOSIT: return '💳';
      case TRANSACTION_TYPES.WITHDRAW: return '💸';
      case TRANSACTION_TYPES.TASK_REWARD: return '🎯';
      case TRANSACTION_TYPES.TASK_PAYMENT: return '📢';
      case TRANSACTION_TYPES.REFERRAL_BONUS: return '🤝';
      case TRANSACTION_TYPES.COMMISSION: return '🏦';
      case TRANSACTION_TYPES.REFUND: return '↩️';
      case TRANSACTION_TYPES.CHECK_SENT: return '📤';
      case TRANSACTION_TYPES.CHECK_RECEIVED: return '📥';
      default: return '💰';
    }
  }

  getTypeText(): string {
    switch (this.type) {
      case TRANSACTION_TYPES.DEPOSIT: return 'Пополнение';
      case TRANSACTION_TYPES.WITHDRAW: return 'Вывод средств';
      case TRANSACTION_TYPES.TASK_REWARD: return 'Награда за задание';
      case TRANSACTION_TYPES.TASK_PAYMENT: return 'Оплата задания';
      case TRANSACTION_TYPES.REFERRAL_BONUS: return 'Реферальный бонус';
      case TRANSACTION_TYPES.COMMISSION: return 'Комиссия';
      case TRANSACTION_TYPES.REFUND: return 'Возврат средств';
      case TRANSACTION_TYPES.CHECK_SENT: return 'Отправка чека';
      case TRANSACTION_TYPES.CHECK_RECEIVED: return 'Получение чека';
      default: return 'Неизвестная операция';
    }
  }

  getAmountWithSign(): string {
    const sign = this.isDeposit() ? '+' : '-';
    return `${sign}${this.amount}`;
  }

  isPending(): boolean {
    return this.status === 'pending';
  }

  isCompleted(): boolean {
    return this.status === 'completed';
  }

  isFailed(): boolean {
    return this.status === 'failed';
  }

  async markAsCompleted(): Promise<void> {
    this.status = 'completed';
    this.processedAt = new Date();
    await this.save();
  }

  async markAsFailed(reason: string): Promise<void> {
    this.status = 'failed';
    this.failedReason = reason;
    this.processedAt = new Date();
    await this.save();
  }

  // Статические методы для создания транзакций
  static async createDeposit(userId: number, amount: number, balanceBefore: number, externalId?: string, paymentProvider?: string): Promise<Transaction> {
    return await Transaction.create({
      userId,
      type: TRANSACTION_TYPES.DEPOSIT,
      amount,
      balanceBefore,
      balanceAfter: balanceBefore + amount,
      description: `Пополнение баланса на ${amount} GRAM`,
      externalId,
      paymentProvider,
      status: 'completed',
      processedAt: new Date()
    });
  }

  static async createTaskReward(userId: number, taskId: number, amount: number, balanceBefore: number): Promise<Transaction> {
    return await Transaction.create({
      userId,
      type: TRANSACTION_TYPES.TASK_REWARD,
      amount,
      balanceBefore,
      balanceAfter: balanceBefore + amount,
      relatedTaskId: taskId,
      description: `Награда за выполнение задания #${taskId}`,
      status: 'completed',
      processedAt: new Date()
    });
  }

  static async createTaskPayment(userId: number, taskId: number, amount: number, balanceBefore: number): Promise<Transaction> {
    return await Transaction.create({
      userId,
      type: TRANSACTION_TYPES.TASK_PAYMENT,
      amount,
      balanceBefore,
      balanceAfter: balanceBefore - amount,
      relatedTaskId: taskId,
      description: `Оплата задания #${taskId}`,
      status: 'completed',
      processedAt: new Date()
    });
  }

  static async createReferralBonus(userId: number, referralUserId: number, amount: number, balanceBefore: number): Promise<Transaction> {
    return await Transaction.create({
      userId,
      type: TRANSACTION_TYPES.REFERRAL_BONUS,
      amount,
      balanceBefore,
      balanceAfter: balanceBefore + amount,
      relatedUserId: referralUserId,
      description: `Бонус за приглашение пользователя`,
      status: 'completed',
      processedAt: new Date()
    });
  }

  static async createCommission(userId: number, amount: number, balanceBefore: number, taskId?: number): Promise<Transaction> {
    return await Transaction.create({
      userId,
      type: TRANSACTION_TYPES.COMMISSION,
      amount,
      balanceBefore,
      balanceAfter: balanceBefore - amount,
      relatedTaskId: taskId,
      description: `Комиссия системы`,
      status: 'completed',
      processedAt: new Date()
    });
  }

  static async createCheckTransaction(userId: number, amount: number, balanceBefore: number, checkId: number, isSent: boolean): Promise<Transaction> {
    const type = isSent ? TRANSACTION_TYPES.CHECK_SENT : TRANSACTION_TYPES.CHECK_RECEIVED;
    const description = isSent ? `Отправка чека #${checkId}` : `Получение чека #${checkId}`;
    const balanceAfter = isSent ? balanceBefore - amount : balanceBefore + amount;

    return await Transaction.create({
      userId,
      type,
      amount,
      balanceBefore,
      balanceAfter,
      relatedCheckId: checkId,
      description,
      status: 'completed',
      processedAt: new Date()
    });
  }

  static async createRefund(userId: number, amount: number, balanceBefore: number, reason: string, taskId?: number): Promise<Transaction> {
    return await Transaction.create({
      userId,
      type: TRANSACTION_TYPES.REFUND,
      amount,
      balanceBefore,
      balanceAfter: balanceBefore + amount,
      relatedTaskId: taskId,
      description: `Возврат средств: ${reason}`,
      status: 'completed',
      processedAt: new Date()
    });
  }
}

// Инициализация модели
Transaction.init({
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
      isIn: [Object.values(TRANSACTION_TYPES)]
    }
  },
  amount: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      min: 1
    }
  },
  balanceBefore: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      min: 0
    }
  },
  balanceAfter: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      min: 0
    }
  },
  relatedTaskId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'tasks',
      key: 'id'
    }
  },
  relatedUserId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  relatedCheckId: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  metadata: {
    type: DataTypes.JSONB,
    allowNull: true
  },
  externalId: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  paymentProvider: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  status: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'pending',
    validate: {
      isIn: [['pending', 'completed', 'failed', 'cancelled']]
    }
  },
  processedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  failedReason: {
    type: DataTypes.TEXT,
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
  tableName: 'transactions',
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
      fields: ['status']
    },
    {
      fields: ['related_task_id']
    },
    {
      fields: ['related_user_id']
    },
    {
      fields: ['external_id']
    },
    {
      fields: ['created_at']
    },
    {
      fields: ['processed_at']
    }
  ]
});

// Ассоциации
Transaction.belongsTo(User, {
  as: 'user',
  foreignKey: 'userId'
});

Transaction.belongsTo(Task, {
  as: 'relatedTask',
  foreignKey: 'relatedTaskId'
});

Transaction.belongsTo(User, {
  as: 'relatedUser',
  foreignKey: 'relatedUserId'
});

User.hasMany(Transaction, {
  as: 'transactions',
  foreignKey: 'userId'
});

Task.hasMany(Transaction, {
  as: 'transactions',
  foreignKey: 'relatedTaskId'
});

// export { Transaction };