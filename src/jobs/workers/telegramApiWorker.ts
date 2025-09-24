// src/jobs/workers/telegramApiWorker.ts
import { Job } from 'bull';
import { Bot } from 'grammy';
import { telegramApiQueue, TelegramApiJob } from '../queues';
import { logger } from '../../utils/logger';

// Worker для обработки Telegram API запросов
class TelegramApiWorker {
  private bot: Bot;

  constructor(bot: Bot) {
    this.bot = bot;
    this.setupProcessor();
  }

  private setupProcessor() {
    // Настраиваем обработчик очереди с ограничением concurrent jobs
    telegramApiQueue.process('telegram-request', 3, this.processTelegramRequest.bind(this));
    
    logger.info('✅ Telegram API worker initialized');
  }

  private async processTelegramRequest(job: Job<TelegramApiJob>) {
    const { action, data, userId, chatId } = job.data;
    
    try {
      switch (action) {
        case 'send_message':
          return await this.sendMessage(data);
          
        case 'check_subscription':
          return await this.checkSubscription(data);
          
        case 'get_chat_member':
          return await this.getChatMember(data);
          
        case 'get_chat':
          return await this.getChat(data);
          
        default:
          throw new Error(`Unknown Telegram API action: ${action}`);
      }
    } catch (error) {
      logger.error(`Telegram API worker error for action ${action}:`, error);
      
      // Если это ошибка rate limit, откладываем job
      if (error.error_code === 429) {
        const retryAfter = error.parameters?.retry_after || 30;
        throw new Error(`Rate limited, retry after ${retryAfter} seconds`);
      }
      
      throw error;
    }
  }

  private async sendMessage(data: any) {
    const { chatId, text, options = {} } = data;
    
    const result = await this.bot.api.sendMessage(chatId, text, options);
    
    logger.debug(`Message sent to chat ${chatId}`);
    return { success: true, messageId: result.message_id };
  }

  private async checkSubscription(data: any) {
    const { userId, channelUsername } = data;
    
    try {
      // Получаем информацию о пользователе в канале
      const chatMember = await this.bot.api.getChatMember(`@${channelUsername}`, userId);
      
      // Проверяем статус участника
      const isSubscribed = ['creator', 'administrator', 'member'].includes(chatMember.status);
      
      return { success: true, isSubscribed, status: chatMember.status };
    } catch (error) {
      // Если пользователь не найден или канал недоступен
      if (error.error_code === 400 || error.error_code === 403) {
        return { success: true, isSubscribed: false, error: error.description };
      }
      throw error;
    }
  }

  private async getChatMember(data: any) {
    const { chatId, userId } = data;
    
    const chatMember = await this.bot.api.getChatMember(chatId, userId);
    
    return { success: true, chatMember };
  }

  private async getChat(data: any) {
    const { chatId } = data;
    
    const chat = await this.bot.api.getChat(chatId);
    
    return { success: true, chat };
  }

  // Статические методы для добавления заданий
  static async sendMessage(chatId: number | string, text: string, options: any = {}, delay?: number) {
    return await telegramApiQueue.add('telegram-request', {
      action: 'send_message',
      data: { chatId, text, options }
    }, { delay, priority: 5 });
  }

  static async checkUserSubscription(userId: number, channelUsername: string, delay?: number) {
    return await telegramApiQueue.add('telegram-request', {
      action: 'check_subscription',
      data: { userId, channelUsername },
      userId
    }, { delay, priority: 8 });
  }

  static async getChatMember(chatId: number | string, userId: number, delay?: number) {
    return await telegramApiQueue.add('telegram-request', {
      action: 'get_chat_member',
      data: { chatId, userId },
      userId,
      chatId: typeof chatId === 'number' ? chatId : undefined
    }, { delay, priority: 6 });
  }

  static async getChat(chatId: number | string, delay?: number) {
    return await telegramApiQueue.add('telegram-request', {
      action: 'get_chat',
      data: { chatId },
      chatId: typeof chatId === 'number' ? chatId : undefined
    }, { delay, priority: 4 });
  }

  // Метод для остановки worker
  public async stop() {
    await telegramApiQueue.close();
    logger.info('Telegram API worker stopped');
  }
}

export default TelegramApiWorker;