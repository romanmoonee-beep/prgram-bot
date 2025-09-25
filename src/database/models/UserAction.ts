// src/database/models/UserAction.ts
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

export interface UserActionAttributes extends Model<InferAttributes<UserAction>, InferCreationAttributes<UserAction>> {
  id: CreationOptional<number>;
  userId: ForeignKey<User['id']>;
  
  // Основная информация о действии
  action: string; // тип действия
  data: CreationOptional<object>; // дополнительные данные
  
  // Контекст
  ip?: string;
  userAgent?: string;
  sessionId?: string;
  
  // Метаданные
  success: CreationOptional<boolean>;
  duration?: number; // время выполнения в мс
  errorMessage?: string;
  
  // Даты
  createdAt: CreationOptional<Date>;
  
  // Ассоциации
  user?: NonAttribute<User>;
}

export class UserAction extends Model<InferAttributes<UserAction>, InferCreationAttributes<UserAction>> implements UserActionAttributes {
  declare id: CreationOptional<number>;
  declare userId: ForeignKey<User['id']>;
  
  declare action: string;
  declare data: CreationOptional<object>;
  
  declare ip?: string;
  declare userAgent?: string;
  declare sessionId?: string;
  
  declare success: CreationOptional<boolean>;
  declare duration?: number;
  declare errorMessage?: string;
  
  declare createdAt: CreationOptional<Date>;
  
  // Ассоциации
  declare user?: NonAttribute<User>;
  declare static associations: {
    user: Association<UserAction, User>;
  };

  // Статические методы для аналитики
  static async getUserActions(userId: number, limit: number = 50) {
    return await UserAction.findAll({
      where: { userId },
      order: [['createdAt', 'DESC']],
      limit,
      include: [{ model: User, as: 'user' }]
    });
  }

  static async getActionStats(action: string, days: number = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    return await UserAction.findAll({
      attributes: [
        'action',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
        [sequelize.fn('COUNT', sequelize.literal('CASE WHEN success = true THEN 1 END')), 'successCount'],
        [sequelize.fn('AVG', sequelize.col('duration')), 'avgDuration']
      ],
      where: {
        action,
        createdAt: {
          [DataTypes.Op.gte]: startDate
        }
      },
      group: ['action'],
      raw: true
    });
  }

  static async getFailedActions(days: number = 7) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    return await UserAction.findAll({
      where: {
        success: false,
        createdAt: {
          [DataTypes.Op.gte]: startDate
        }
      },
      order: [['createdAt', 'DESC']],
      include: [{ model: User, as: 'user' }]
    });
  }

  static async getUserActivitySummary(userId: number, days: number = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    return await UserAction.findAll({
      attributes: [
        'action',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
        [sequelize.fn('MAX', sequelize.col('createdAt')), 'lastAction']
      ],
      where: {
        userId,
        createdAt: {
          [DataTypes.Op.gte]: startDate
        }
      },
      group: ['action'],
      order: [[sequelize.literal('count'), 'DESC']],
      raw: true
    });
  }

  // Методы экземпляра
  toJSON() {
    const values = super.toJSON();
    return {
      ...values,
      data: typeof values.data === 'string' ? JSON.parse(values.data) : values.data
    };
  }
}

// Инициализация модели
UserAction.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: User,
        key: 'id'
      },
      onDelete: 'CASCADE'
    },
    action: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [1, 100]
      }
    },
    data: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: {}
    },
    ip: {
      type: DataTypes.STRING(45), // поддержка IPv6
      allowNull: true,
      validate: {
        isIP: true
      }
    },
    userAgent: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    sessionId: {
      type: DataTypes.STRING(128),
      allowNull: true
    },
    success: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    },
    duration: {
      type: DataTypes.INTEGER, // в миллисекундах
      allowNull: true,
      validate: {
        min: 0
      }
    },
    errorMessage: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    }
  },
  {
    sequelize,
    modelName: 'UserAction',
    tableName: 'user_actions',
    timestamps: false, // используем только createdAt
    indexes: [
      {
        fields: ['userId', 'createdAt']
      },
      {
        fields: ['action', 'createdAt']
      },
      {
        fields: ['success']
      },
      {
        fields: ['createdAt']
      },
      {
        // Составной индекс для быстрого поиска по пользователю и действию
        fields: ['userId', 'action']
      }
    ]
  }
);

// Ассоциации
UserAction.belongsTo(User, {
  foreignKey: 'userId',
  as: 'user'
});

User.hasMany(UserAction, {
  foreignKey: 'userId',
  as: 'actions'
});

<<<<<<< HEAD
export default UserAction;
=======
export default UserAction;
>>>>>>> 9cc5691 (5-commit)
