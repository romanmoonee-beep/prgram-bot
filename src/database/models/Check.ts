// src/models/Check.ts
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
import crypto from 'crypto';

export interface CheckAttributes extends Model<InferAttributes<Check>, InferCreationAttributes<Check>> {
  id: CreationOptional<number>;
  creatorId: ForeignKey<User['id']>;
  
  // Основная информация
  code: string;
  type: CreationOptional<string>; // 'personal' | 'multi'
  
  // Параметры чека
  totalAmount: number;
  amountPerActivation: number;
  maxActivations: number;
  currentActivations: CreationOptional<number>;
  
  // Условия активации
  password?: string;
  requiredSubscription?: string;
  targetUserId?: ForeignKey<User['id']>; // Для персональных чеков
  
  // Содержимое
  comment?: string;
  imageUrl?: string;
  
  // Статус
  isActive: CreationOptional<boolean>;
  expiresAt?: Date;
  
  // Даты
  createdAt: CreationOptional<Date>;
  updatedAt: CreationOptional<Date>;
  
  // Ассоциации
  creator?: NonAttribute<User>;
  targetUser?: NonAttribute<User>;
  activations?: NonAttribute<CheckActivation[]>;
}

export class Check extends Model<InferAttributes<Check>, InferCreationAttributes<Check>> implements CheckAttributes {
  declare id: CreationOptional<number>;
  declare creatorId: ForeignKey<User['id']>;
  
  declare code: string;
  declare type: CreationOptional<string>;
  
  declare totalAmount: number;
  declare amountPerActivation: number;
  declare maxActivations: number;
  declare currentActivations: CreationOptional<number>;
  
  declare password?: string;
  declare requiredSubscription?: string;
  declare targetUserId?: ForeignKey<User['id']>;
  
  declare comment?: string;
  declare imageUrl?: string;
  
  declare isActive: CreationOptional<boolean>;
  declare expiresAt?: Date;
  
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
  
  // Ассоциации
  declare creator?: NonAttribute<User>;
  declare targetUser?: NonAttribute<User>;
  declare activations?: NonAttribute<CheckActivation[]>;
  
  declare static associations: {
    creator: Association<Check, User>;
    targetUser: Association<Check, User>;
    activations: Association<Check, CheckActivation>;
  };

  // Методы экземпляра
  isPersonal(): boolean {
    return this.type === 'personal';
  }

  isMulti(): boolean {
    return this.type === 'multi';
  }

  canBeActivated(): boolean {
    if (!this.isActive) return false;
    if (this.expiresAt && this.expiresAt <= new Date()) return false;
    if ((this.currentActivations || 0) >= this.maxActivations) return false;
    return true;
  }

  getRemainingActivations(): number {
    return Math.max(0, this.maxActivations - (this.currentActivations || 0));
  }

  getRemainingAmount(): number {
    const remaining = this.getRemainingActivations();
    return remaining * this.amountPerActivation;
  }

  hasPassword(): boolean {
    return !!this.password;
  }

  hasSubscriptionRequirement(): boolean {
    return !!this.requiredSubscription;
  }

  verifyPassword(inputPassword: string): boolean {
    if (!this.password) return true;
    return this.password === inputPassword;
  }

  canUserActivate(userId: number): { canActivate: boolean; reason?: string } {
    if (!this.canBeActivated()) {
      return { canActivate: false, reason: 'Чек недоступен для активации' };
    }

    if (this.creatorId === userId) {
      return { canActivate: false, reason: 'Нельзя активировать собственный чек' };
    }

    if (this.isPersonal() && this.targetUserId && this.targetUserId !== userId) {
      return { canActivate: false, reason: 'Чек предназначен для другого пользователя' };
    }

    return { canActivate: true };
  }

  async activate(userId: number): Promise<void> {
    this.currentActivations = (this.currentActivations || 0) + 1;
    
    // Если достигнут лимит активаций, деактивируем чек
    if (this.currentActivations >= this.maxActivations) {
      this.isActive = false;
    }
    
    await this.save();
  }

  async deactivate(): Promise<void> {
    this.isActive = false;
    await this.save();
  }

  getStatusIcon(): string {
    if (!this.isActive) return '❌';
    if (this.expiresAt && this.expiresAt <= new Date()) return '⏰';
    if ((this.currentActivations || 0) >= this.maxActivations) return '✅';
    return '💳';
  }

  getStatusText(): string {
    if (!this.isActive) return 'Неактивен';
    if (this.expiresAt && this.expiresAt <= new Date()) return 'Истек';
    if ((this.currentActivations || 0) >= this.maxActivations) return 'Исчерпан';
    return 'Активен';
  }

  // Статический метод для генерации уникального кода
  static generateCode(): string {
    return crypto.randomBytes(16).toString('hex').toUpperCase();
  }
}

// Модель активации чеков
export interface CheckActivationAttributes extends Model<InferAttributes<CheckActivation>, InferCreationAttributes<CheckActivation>> {
  id: CreationOptional<number>;
  checkId: ForeignKey<Check['id']>;
  userId: ForeignKey<User['id']>;
  amount: number;
  activatedAt: CreationOptional<Date>;
  
  // Ассоциации
  check?: NonAttribute<Check>;
  user?: NonAttribute<User>;
}

export class CheckActivation extends Model<InferAttributes<CheckActivation>, InferCreationAttributes<CheckActivation>> implements CheckActivationAttributes {
  declare id: CreationOptional<number>;
  declare checkId: ForeignKey<Check['id']>;
  declare userId: ForeignKey<User['id']>;
  declare amount: number;
  declare activatedAt: CreationOptional<Date>;
  
  // Ассоциации
  declare check?: NonAttribute<Check>;
  declare user?: NonAttribute<User>;
  
  declare static associations: {
    check: Association<CheckActivation, Check>;
    user: Association<CheckActivation, User>;
  };
}

// Инициализация модели Check
Check.init({
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  creatorId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  code: {
    type: DataTypes.STRING(32),
    allowNull: false,
    unique: true
  },
  type: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'multi',
    validate: {
      isIn: [['personal', 'multi']]
    }
  },
  totalAmount: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      min: 1
    }
  },
  amountPerActivation: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      min: 1
    }
  },
  maxActivations: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      min: 1,
      max: 1000
    }
  },
  currentActivations: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    validate: {
      min: 0
    }
  },
  password: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  requiredSubscription: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  targetUserId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  comment: {
    type: DataTypes.TEXT,
    allowNull: true,
    validate: {
      len: [0, 500]
    }
  },
  imageUrl: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true
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
  tableName: 'checks',
  timestamps: true,
  underscored: true,
  indexes: [
    {
      unique: true,
      fields: ['code']
    },
    {
      fields: ['creator_id']
    },
    {
      fields: ['target_user_id']
    },
    {
      fields: ['type']
    },
    {
      fields: ['is_active']
    },
    {
      fields: ['expires_at']
    },
    {
      fields: ['created_at']
    }
  ],
  hooks: {
    beforeCreate: (check: Check) => {
      if (!check.code) {
        check.code = Check.generateCode();
      }
    }
  }
});

// Инициализация модели CheckActivation
CheckActivation.init({
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  checkId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'checks',
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
  amount: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      min: 1
    }
  },
  activatedAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  }
}, {
  sequelize,
  tableName: 'check_activations',
  timestamps: false,
  underscored: true,
  indexes: [
    {
      unique: true,
      fields: ['check_id', 'user_id']
    },
    {
      fields: ['check_id']
    },
    {
      fields: ['user_id']
    },
    {
      fields: ['activated_at']
    }
  ]
});

// Ассоциации
Check.belongsTo(User, {
  as: 'creator',
  foreignKey: 'creatorId'
});

Check.belongsTo(User, {
  as: 'targetUser',
  foreignKey: 'targetUserId'
});

Check.hasMany(CheckActivation, {
  as: 'activations',
  foreignKey: 'checkId'
});

CheckActivation.belongsTo(Check, {
  as: 'check',
  foreignKey: 'checkId'
});

CheckActivation.belongsTo(User, {
  as: 'user',
  foreignKey: 'userId'
});

User.hasMany(Check, {
  as: 'createdChecks',
  foreignKey: 'creatorId'
});

User.hasMany(Check, {
  as: 'personalChecks',
  foreignKey: 'targetUserId'
});

User.hasMany(CheckActivation, {
  as: 'checkActivations',
  foreignKey: 'userId'
});

// export { Check, CheckActivation };