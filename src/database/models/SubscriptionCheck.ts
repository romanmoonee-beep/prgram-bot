// src/database/models/SubscriptionCheck.ts
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

export interface SubscriptionCheckAttributes extends Model<InferAttributes<SubscriptionCheck>, InferCreationAttributes<SubscriptionCheck>> {
  id: CreationOptional<number>;
  creatorId: ForeignKey<User['id']>;
  
  // Информация о чате где установлена ОП
  chatId: string; // Telegram chat ID
  chatTitle?: string;
  chatUsername?: string;
  
  // Настройки проверки
  type: 'public' | 'private' | 'invite_link' | 'referral_prgram';
  targetChannel?: string; // @channel или ссылка
  targetChannelId?: string; // Telegram channel ID
  
  // Настройки времени
  timerDuration?: number; // в секундах, null = без таймера
  
  // Реферальная система PR GRAM
  referralUserId?: ForeignKey<User['id']>; // Для типа referral_prgram
  
  // Настройки автоудаления
  autoDeleteEnabled: CreationOptional<boolean>;
  autoDeleteDuration: CreationOptional<number>; // в секундах
  
  // Статус
  isActive: CreationOptional<boolean>;
  lastChecked?: Date;
  
  // Статистика
  checksCount: CreationOptional<number>; // Сколько раз проверяли
  subscriptionsCount: CreationOptional<number>; // Сколько подписались
  kicksCount: CreationOptional<number>; // Сколько кикнули
  
  // Даты
  createdAt: CreationOptional<Date>;
  updatedAt: CreationOptional<Date>;
  
  // Ассоциации
  creator?: NonAttribute<User>;
  referralUser?: NonAttribute<User>;
}

export class SubscriptionCheck extends Model<InferAttributes<SubscriptionCheck>, InferCreationAttributes<SubscriptionCheck>> implements SubscriptionCheckAttributes {
  declare id: CreationOptional<number>;
  declare creatorId: ForeignKey<User['id']>;
  
  declare chatId: string;
  declare chatTitle?: string;
  declare chatUsername?: string;
  
  declare type: 'public' | 'private' | 'invite_link' | 'referral_prgram';
  declare targetChannel?: string;
  declare targetChannelId?: string;
  
  declare timerDuration?: number;
  
  declare referralUserId?: ForeignKey<User['id']>;
  
  declare autoDeleteEnabled: CreationOptional<boolean>;
  declare autoDeleteDuration: CreationOptional<number>;
  
  declare isActive: CreationOptional<boolean>;
  declare lastChecked?: Date;
  
  declare checksCount: CreationOptional<number>;
  declare subscriptionsCount: CreationOptional<number>;
  declare kicksCount: CreationOptional<number>;
  
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
  
  // Ассоциации
  declare creator?: NonAttribute<User>;
  declare referralUser?: NonAttribute<User>;
  
  declare static associations: {
    creator: Association<SubscriptionCheck, User>;
    referralUser: Association<SubscriptionCheck, User>;
  };

  // Методы экземпляра
  hasTimer(): boolean {
    return this.timerDuration !== undefined && this.timerDuration !== null && this.timerDuration > 0;
  }

  getTimerText(): string {
    if (!this.hasTimer()) return 'без таймера';
    
    const duration = this.timerDuration!;
    if (duration < 60) return `${duration}с`;
    if (duration < 3600) return `${Math.floor(duration / 60)}м`;
    if (duration < 86400) return `${Math.floor(duration / 3600)}ч`;
    return `${Math.floor(duration / 86400)}д`;
  }

  getTypeText(): string {
    switch (this.type) {
      case 'public': return 'Публичный канал';
      case 'private': return 'Приватный канал';
      case 'invite_link': return 'Пригласительная ссылка';
      case 'referral_prgram': return 'Реферальная система PR GRAM';
      default: return 'Неизвестный тип';
    }
  }

  isReferralType(): boolean {
    return this.type === 'referral_prgram';
  }

  async updateStats(action: 'check' | 'subscribe' | 'kick'): Promise<void> {
    switch (action) {
      case 'check':
        this.checksCount = (this.checksCount || 0) + 1;
        break;
      case 'subscribe':
        this.subscriptionsCount = (this.subscriptionsCount || 0) + 1;
        break;
      case 'kick':
        this.kicksCount = (this.kicksCount || 0) + 1;
        break;
    }
    this.lastChecked = new Date();
    await this.save();
  }

  getConversionRate(): number {
    const checks = this.checksCount || 0;
    const subscriptions = this.subscriptionsCount || 0;
    return checks > 0 ? Math.round((subscriptions / checks) * 100) : 0;
  }

  // Статические методы
  static async findByChatId(chatId: string): Promise<SubscriptionCheck[]> {
    return await SubscriptionCheck.findAll({
      where: { chatId, isActive: true },
      include: [
        { model: User, as: 'creator' },
        { model: User, as: 'referralUser' }
      ],
      order: [['createdAt', 'DESC']]
    });
  }

  static async findByCreator(creatorId: number): Promise<SubscriptionCheck[]> {
    return await SubscriptionCheck.findAll({
      where: { creatorId },
      order: [['createdAt', 'DESC']]
    });
  }

  static async createPublicCheck(
    creatorId: number,
    chatId: string,
    targetChannel: string,
    options: {
      chatTitle?: string;
      chatUsername?: string;
      timerDuration?: number;
      autoDeleteEnabled?: boolean;
      autoDeleteDuration?: number;
    } = {}
  ): Promise<SubscriptionCheck> {
    return await SubscriptionCheck.create({
      creatorId,
      chatId,
      chatTitle: options.chatTitle,
      chatUsername: options.chatUsername,
      type: 'public',
      targetChannel,
      timerDuration: options.timerDuration,
      autoDeleteEnabled: options.autoDeleteEnabled || false,
      autoDeleteDuration: options.autoDeleteDuration || 30
    });
  }

  static async createReferralCheck(
    creatorId: number,
    chatId: string,
    referralUserId: number,
    options: {
      chatTitle?: string;
      chatUsername?: string;
      timerDuration?: number;
      autoDeleteEnabled?: boolean;
      autoDeleteDuration?: number;
    } = {}
  ): Promise<SubscriptionCheck> {
    return await SubscriptionCheck.create({
      creatorId,
      chatId,
      chatTitle: options.chatTitle,
      chatUsername: options.chatUsername,
      type: 'referral_prgram',
      referralUserId,
      timerDuration: options.timerDuration,
      autoDeleteEnabled: options.autoDeleteEnabled || false,
      autoDeleteDuration: options.autoDeleteDuration || 30
    });
  }

  static async removeByTarget(chatId: string, targetChannel?: string): Promise<number> {
    const where: any = { chatId };
    if (targetChannel) {
      where.targetChannel = targetChannel;
    }
    
    const count = await SubscriptionCheck.count({ where });
    await SubscriptionCheck.destroy({ where });
    return count;
  }
}

// Инициализация модели
SubscriptionCheck.init({
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
  chatId: {
    type: DataTypes.STRING(50),
    allowNull: false,
    validate: {
      notEmpty: true
    }
  },
  chatTitle: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  chatUsername: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  type: {
    type: DataTypes.STRING(20),
    allowNull: false,
    validate: {
      isIn: [['public', 'private', 'invite_link', 'referral_prgram']]
    }
  },
  targetChannel: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  targetChannelId: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  timerDuration: {
    type: DataTypes.INTEGER,
    allowNull: true,
    validate: {
      min: 0
    }
  },
  referralUserId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  autoDeleteEnabled: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  autoDeleteDuration: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 30,
    validate: {
      min: 15,
      max: 300
    }
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true
  },
  lastChecked: {
    type: DataTypes.DATE,
    allowNull: true
  },
  checksCount: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    validate: {
      min: 0
    }
  },
  subscriptionsCount: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    validate: {
      min: 0
    }
  },
  kicksCount: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    validate: {
      min: 0
    }
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
  tableName: 'subscription_checks',
  timestamps: true,
  underscored: true,
  indexes: [
    {
      fields: ['chat_id']
    },
    {
      fields: ['creator_id']
    },
    {
      fields: ['type']
    },
    {
      fields: ['is_active']
    },
    {
      fields: ['referral_user_id']
    },
    {
      fields: ['target_channel']
    },
    {
      fields: ['created_at']
    },
    {
      // Составной индекс для быстрого поиска активных проверок в чате
      fields: ['chat_id', 'is_active']
    }
  ]
});

// Ассоциации
SubscriptionCheck.belongsTo(User, {
  as: 'creator',
  foreignKey: 'creatorId'
});

SubscriptionCheck.belongsTo(User, {
  as: 'referralUser',
  foreignKey: 'referralUserId'
});

User.hasMany(SubscriptionCheck, {
  as: 'subscriptionChecks',
  foreignKey: 'creatorId'
});

User.hasMany(SubscriptionCheck, {
  as: 'referralSubscriptionChecks',
  foreignKey: 'referralUserId'
});

export { SubscriptionCheck };