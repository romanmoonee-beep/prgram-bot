// src/utils/logger.ts
import fs from 'fs';
import path from 'path';

// Создаем директорию для логов если её нет
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Enum для уровней логов
enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3
}

interface UserActionData {
  [key: string]: any;
  ip?: string;
  userAgent?: string;
}

interface SecurityContext {
  userId?: number;
  chatId?: number;
  updateId?: number;
  username?: string;
  command?: string;
}

class Logger {
  private logLevel: LogLevel;
  private logFile: string;
  private userActionsFile: string;
  private financialFile: string;
  private securityFile: string;

  constructor() {
    this.logLevel = process.env.NODE_ENV === 'development' ? LogLevel.DEBUG : LogLevel.INFO;
    const dateStr = new Date().toISOString().split('T')[0];
    this.logFile = path.join(logsDir, `app-${dateStr}.log`);
    this.userActionsFile = path.join(logsDir, `user-actions-${dateStr}.log`);
    this.financialFile = path.join(logsDir, `financial-${dateStr}.log`);
    this.securityFile = path.join(logsDir, `security-${dateStr}.log`);
  }

  private formatMessage(level: string, message: string, ...args: any[]): string {
    const timestamp = new Date().toISOString();
    const formattedArgs = args.length > 0 ? ' ' + args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ') : '';
    
    return `[${timestamp}] ${level}: ${message}${formattedArgs}`;
  }

  private writeToFile(filename: string, message: string): void {
    try {
      fs.appendFileSync(filename, message + '\n');
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  private log(level: LogLevel, levelName: string, message: string, ...args: any[]): void {
    if (level <= this.logLevel) {
      const formattedMessage = this.formatMessage(levelName, message, ...args);
      
      // Вывод в консоль с цветами (ваша существующая логика)
      switch (level) {
        case LogLevel.ERROR:
          console.error('\x1b[31m%s\x1b[0m', formattedMessage); // красный
          break;
        case LogLevel.WARN:
          console.warn('\x1b[33m%s\x1b[0m', formattedMessage); // желтый
          break;
        case LogLevel.INFO:
          console.info('\x1b[36m%s\x1b[0m', formattedMessage); // голубой
          break;
        case LogLevel.DEBUG:
          console.debug('\x1b[37m%s\x1b[0m', formattedMessage); // белый
          break;
      }
      
      // Запись в файл (ваша существующая логика)
      if (process.env.NODE_ENV === 'production') {
        if (level <= LogLevel.WARN) {
          this.writeToFile(this.logFile, formattedMessage);
        }
      } else {
        this.writeToFile(this.logFile, formattedMessage);
      }
    }
  }

  // Ваши существующие методы остаются без изменений
  error(message: string, ...args: any[]): void {
    this.log(LogLevel.ERROR, 'ERROR', message, ...args);
  }

  warn(message: string, ...args: any[]): void {
    this.log(LogLevel.WARN, 'WARN', message, ...args);
  }

  info(message: string, ...args: any[]): void {
    this.log(LogLevel.INFO, 'INFO', message, ...args);
  }

  debug(message: string, ...args: any[]): void {
    this.log(LogLevel.DEBUG, 'DEBUG', message, ...args);
  }

  // Ваши специальные методы для бота остаются
  botEvent(event: string, data?: any): void {
    this.info(`🤖 Bot Event: ${event}`, data);
  }

  userAction(userId: number, action: string, data?: any): void {
    this.info(`👤 User ${userId}: ${action}`, data);
  }

  taskEvent(taskId: number, event: string, data?: any): void {
    this.info(`📋 Task ${taskId}: ${event}`, data);
  }

  paymentEvent(userId: number, amount: number, type: string, data?: any): void {
    this.info(`💰 Payment - User ${userId}: ${amount} GRAM (${type})`, data);
  }

  // НОВЫЕ РАСШИРЕННЫЕ МЕТОДЫ:

  /**
   * Детальное логирование действий пользователя с сохранением в отдельный файл
   */
  async detailedUserAction(
    userId: number, 
    action: string, 
    data?: UserActionData,
    success: boolean = true,
    duration?: number,
    errorMessage?: string
  ): Promise<void> {
    try {
      const logData = {
        userId,
        action,
        timestamp: new Date().toISOString(),
        data: data || {},
        ip: data?.ip || 'unknown',
        userAgent: data?.userAgent || 'unknown',
        success,
        duration,
        errorMessage
      };

      // Ваш обычный лог
      if (success) {
        this.userAction(userId, action, data);
      } else {
        this.warn(`❌ Failed action: User ${userId} - ${action}`, { ...data, errorMessage });
      }

      // Дополнительно в отдельный файл для аналитики
      const level = success ? 'USER_ACTION' : 'USER_ACTION_FAILED';
      const message = success 
        ? `User ${userId} performed ${action}`
        : `User ${userId} failed ${action}: ${errorMessage}`;
      
      const detailedMessage = this.formatMessage(level, message, logData);
      this.writeToFile(this.userActionsFile, detailedMessage);

      // Критические действия можно также сохранять в БД
      if (process.env.SAVE_USER_ACTIONS_TO_DB === 'true') {
        await this.saveUserActionToDBWithStatus(logData);
      }

    } catch (error) {
      this.error('Failed to log detailed user action', error, { userId, action, data });
    }
  }

  /**
   * Сохраняет действие пользователя в БД с учетом статуса
   */
  private async saveUserActionToDBWithStatus(logData: any): Promise<void> {
    try {
      const criticalActions = [
        'registered', 'login', 'logout', 'task_created', 'task_completed', 
        'deposit_completed', 'withdrawal_requested', 'check_created', 
        'check_activated', 'referral_registered', 'admin_action'
      ];

      if (criticalActions.includes(logData.action)) {
        const { default: UserAction } = await import('../database/models/UserAction');
        await UserAction.create({
          userId: logData.userId,
          action: logData.action,
          data: logData.data,
          ip: logData.ip,
          userAgent: logData.userAgent,
          success: logData.success,
          duration: logData.duration,
          errorMessage: logData.errorMessage,
          createdAt: new Date(logData.timestamp)
        });
      }
    } catch (error) {
      this.error('Failed to save user action to DB', error);
    }
  }

  /**
   * Логирование ошибок в боте с расширенным контекстом
   */
  botError(message: string, error: any, context: SecurityContext): void {
    const errorDetails = {
      message,
      error: error?.message || error,
      stack: error?.stack,
      ...context
    };

    this.error(`🚨 Bot Error: ${message}`, errorDetails);
  }

  /**
   * Измерение производительности операций
   */
  performance(operation: string, duration: number, meta?: any): void {
    const perfMessage = `⚡ Performance: ${operation} took ${duration}ms`;
    this.debug(perfMessage, meta);

    // Если операция слишком медленная, логируем как warning
    if (duration > 5000) { // 5 секунд
      this.warn(`🐌 Slow operation detected: ${operation} took ${duration}ms`, meta);
    }
  }

  /**
   * Логирование проблем безопасности
   */
  security(message: string, userId: number, details?: any): void {
    const securityData = {
      userId,
      message,
      details,
      timestamp: new Date().toISOString(),
      severity: 'medium'
    };

    this.warn(`🔒 Security: ${message}`, securityData);
    
    // Сохраняем в отдельный файл безопасности
    const securityMessage = this.formatMessage('SECURITY', 
      `User ${userId}: ${message}`, securityData);
    this.writeToFile(this.securityFile, securityMessage);

    // В продакшене можно отправлять критические инциденты админам
    if (process.env.NODE_ENV === 'production') {
      this.notifyAdminsIfCritical(message, userId, details);
    }
  }

  /**
   * Уведомление админов о критических проблемах
   */
  private notifyAdminsIfCritical(message: string, userId: number, details?: any): void {
    const criticalKeywords = ['hack', 'attack', 'fraud', 'suspicious', 'violation'];
    const isCritical = criticalKeywords.some(keyword => 
      message.toLowerCase().includes(keyword)
    );

    if (isCritical) {
      const alertMessage = `🚨 CRITICAL SECURITY ALERT\nUser: ${userId}\nIncident: ${message}`;
      this.error('CRITICAL SECURITY INCIDENT', new Error(message), { 
        userId, 
        details, 
        adminNotified: true,
        severity: 'critical'
      });
      
      // Здесь можно добавить отправку в Telegram админам
      // await this.sendToAdminBot(alertMessage);
    }
  }

  /**
   * Создает дочерний logger с контекстом
   */
  child(context: { userId?: number; chatId?: number; action?: string }) {
    return {
      info: (message: string, meta?: any) => this.info(message, { ...context, ...meta }),
      error: (message: string, error?: any, meta?: any) => this.error(message, error, { ...context, ...meta }),
      warn: (message: string, meta?: any) => this.warn(message, { ...context, ...meta }),
      debug: (message: string, meta?: any) => this.debug(message, { ...context, ...meta }),
      userAction: (action: string, data?: UserActionData) => 
        this.detailedUserAction(context.userId || 0, action, { ...context, ...data }),
      botEvent: (event: string, data?: any) => this.botEvent(event, { ...context, ...data }),
      taskEvent: (taskId: number, event: string, data?: any) => this.taskEvent(taskId, event, { ...context, ...data })
    };
  }

  /**
   * Логирование использования функций с метриками
   */
  async featureUsage(feature: string, userId: number, success: boolean = true, duration?: number): Promise<void> {
    const data: any = { 
      success, 
      feature,
      timestamp: new Date().toISOString()
    };
    
    if (duration !== undefined) {
      data.duration = duration;
    }
    
    await this.detailedUserAction(userId, `feature_${feature}`, data);
    
    if (!success) {
      this.warn(`❌ Feature failed: ${feature}`, { userId, ...data });
    }
  }

  /**
   * Бизнес-метрики
   */
  businessMetric(metric: string, value: number, userId?: number, meta?: any): void {
    const data = {
      metric,
      value,
      userId,
      timestamp: new Date().toISOString(),
      ...meta
    };

    this.info(`📊 Business Metric: ${metric} = ${value}`, data);
  }

  /**
   * Финансовые операции с повышенным уровнем логирования
   */
  async financialOperation(
    userId: number, 
    operation: 'deposit' | 'withdraw' | 'task_payment' | 'reward' | 'refund',
    amount: number,
    details: any
  ): Promise<void> {
    const data = {
      userId,
      operation,
      amount,
      details,
      timestamp: new Date().toISOString()
    };

    // Обычный лог через ваш paymentEvent
    this.paymentEvent(userId, amount, operation, details);

    // Дополнительно в отдельный финансовый файл
    const financialMessage = this.formatMessage('FINANCIAL', 
      `${operation.toUpperCase()}: User ${userId} - ${amount} GRAM`, data);
    this.writeToFile(this.financialFile, financialMessage);

    // Большие суммы логируем особо
    if (amount > 1000) {
      this.warn(`💎 Large financial operation: ${operation} - ${amount} GRAM`, data);
    }
  }

  /**
   * Логирование API запросов
   */
  apiRequest(method: string, url: string, userId?: number, duration?: number, statusCode?: number): void {
    const data = {
      method,
      url,
      userId,
      duration,
      statusCode,
      timestamp: new Date().toISOString()
    };

    const message = `🌐 API ${method} ${url}`;
    
    if (statusCode && statusCode >= 400) {
      this.warn(`${message} - ${statusCode}`, data);
    } else {
      this.debug(message, data);
    }

    if (duration && duration > 3000) {
      this.warn(`🐌 Slow API request: ${method} ${url} took ${duration}ms`, data);
    }
  }

  /**
   * Ротация логов (вызывать по cron раз в день)
   */
  rotateLogs(): void {
    try {
      const files = fs.readdirSync(logsDir);
      const oldFiles = files.filter(file => {
        const filePath = path.join(logsDir, file);
        const stats = fs.statSync(filePath);
        const daysOld = (Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60 * 24);
        return daysOld > 30; // Удаляем файлы старше 30 дней
      });

      oldFiles.forEach(file => {
        fs.unlinkSync(path.join(logsDir, file));
        this.info(`🗑️  Rotated old log file: ${file}`);
      });

    } catch (error) {
      this.error('Failed to rotate logs', error);
    }
  }

  /**
   * Получает аналитику действий пользователя из БД
   */
  async getUserAnalytics(userId: number, days: number = 30): Promise<any> {
    try {
      const { default: UserAction } = await import('../database/models/UserAction');
      
      const summary = await UserAction.getUserActivitySummary(userId, days);
      const recentActions = await UserAction.getUserActions(userId, 20);
      
      return {
        summary,
        recentActions: recentActions.map(action => ({
          action: action.action,
          success: action.success,
          duration: action.duration,
          createdAt: action.createdAt,
          data: action.data
        }))
      };
    } catch (error) {
      this.error('Failed to get user analytics', error);
      return null;
    }
  }

  /**
   * Получает статистику по неудачным действиям
   */
  async getFailureAnalytics(days: number = 7): Promise<any> {
    try {
      const { default: UserAction } = await import('../database/models/UserAction');
      
      const failedActions = await UserAction.getFailedActions(days);
      
      return failedActions.map(action => ({
        userId: action.userId,
        username: action.user?.username,
        action: action.action,
        errorMessage: action.errorMessage,
        createdAt: action.createdAt,
        data: action.data
      }));
    } catch (error) {
      this.error('Failed to get failure analytics', error);
      return null;
    }
  }

  /**
   * Получает общую статистику по действиям
   */
  async getActionStatistics(action?: string, days: number = 30): Promise<any> {
    try {
      const { default: UserAction } = await import('../database/models/UserAction');
      
      if (action) {
        return await UserAction.getActionStats(action, days);
      } else {
        // Получаем статистику по всем действиям
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        return await UserAction.findAll({
          attributes: [
            'action',
            [UserAction.sequelize!.fn('COUNT', UserAction.sequelize!.col('id')), 'count'],
            [UserAction.sequelize!.fn('COUNT', UserAction.sequelize!.literal('CASE WHEN success = true THEN 1 END')), 'successCount'],
            [UserAction.sequelize!.fn('AVG', UserAction.sequelize!.col('duration')), 'avgDuration']
          ],
          where: {
            createdAt: {
              [UserAction.sequelize!.Op.gte]: startDate
            }
          },
          group: ['action'],
          order: [[UserAction.sequelize!.literal('count'), 'DESC']],
          raw: true
        });
      }
    } catch (error) {
      this.error('Failed to get action statistics', error);
      return null;
    }
  }
}

// Экспортируем singleton
export const logger = new Logger();
export default logger;
