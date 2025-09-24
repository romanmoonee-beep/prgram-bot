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

class Logger {
  private logLevel: LogLevel;
  private logFile: string;

  constructor() {
    this.logLevel = process.env.NODE_ENV === 'development' ? LogLevel.DEBUG : LogLevel.INFO;
    this.logFile = path.join(logsDir, `app-${new Date().toISOString().split('T')[0]}.log`);
  }

  private formatMessage(level: string, message: string, ...args: any[]): string {
    const timestamp = new Date().toISOString();
    const formattedArgs = args.length > 0 ? ' ' + args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ') : '';
    
    return `[${timestamp}] ${level}: ${message}${formattedArgs}`;
  }

  private writeToFile(message: string): void {
    try {
      fs.appendFileSync(this.logFile, message + '\n');
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  private log(level: LogLevel, levelName: string, message: string, ...args: any[]): void {
    if (level <= this.logLevel) {
      const formattedMessage = this.formatMessage(levelName, message, ...args);
      
      // Вывод в консоль с цветами
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

      // Запись в файл (только ERROR и WARN в продакшене)
      if (process.env.NODE_ENV === 'production') {
        if (level <= LogLevel.WARN) {
          this.writeToFile(formattedMessage);
        }
      } else {
        this.writeToFile(formattedMessage);
      }
    }
  }

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

  // Специальные методы для бота
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
}

export const logger = new Logger();