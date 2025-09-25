// src/services/telegram/TelegramServiceExtended.ts
import { TelegramService } from './TelegramService';
import { 
  TelegramServiceConfig, 
  TelegramServiceStats,
  WebhookInfo,
  ChatInfo,
  MessageInfo
} from './types';
import { logger } from '../../utils/logger';
import { AppError } from '../../utils/errors';
import Redis from 'ioredis';

export class TelegramServiceExtended extends TelegramService {
  private config: TelegramServiceConfig;
  private stats: TelegramServiceStats;
  private redis?: Redis;
  private rateLimitCache: Map<string, { count: number; resetTime: number }> = new Map();

  constructor(config: TelegramServiceConfig, redis?: Redis) {
    super(config.botToken);
    
    this.config = config;
    this.redis = redis;
    this.stats = {
      requestCount: 0,
      errorCount: 0,
      successCount: 0,
      averageResponseTime: 0,
      rateLimitHits: 0,
      webhookStatus: 'inactive',
      botStatus: 'stopped'
    };

    this.setupRateLimiting();
    this.setupWebhook();
  }

  /**
   * Настройка webhook для получения обновлений
   */
  async setupWebhook(): Promise<void> {
    if (!this.config.features.enableWebhook || !this.config.webhookUrl) {
      return;
    }

    try {
      const response = await this.apiClient.post('/setWebhook', {
        url: this.config.webhookUrl,
        secret_token: this.config.webhookSecretToken,
        max_connections: 40,
        allowed_updates: [
          'message', 'edited_message', 'channel_post', 'edited_channel_post',
          'callback_query', 'inline_query', 'chosen_inline_result',
          'my_chat_member', 'chat_member', 'chat_join_request'
        ]
      });

      this.stats.webhookStatus = 'active';
      logger.info('Webhook configured successfully');
    } catch (error) {
      this.stats.webhookStatus = 'error';
      logger.error('Failed to setup webhook:', error);
      throw error;
    }
  }

  /**
   * Получение информации о webhook
   */
  async getWebhookInfo(): Promise<WebhookInfo> {
    try {
      const response = await this.apiClient.post('/getWebhookInfo');
      return response.data.result;
    } catch (error) {
      logger.error('Failed to get webhook info:', error);
      throw new AppError('Failed to get webhook info', 500);
    }
  }

  /**
   * Удаление webhook
   */
  async deleteWebhook(): Promise<void> {
    try {
      await this.apiClient.post('/deleteWebhook', {
        drop_pending_updates: true
      });
      
      this.stats.webhookStatus = 'inactive';
      logger.info('Webhook deleted successfully');
    } catch (error) {
      logger.error('Failed to delete webhook:', error);
      throw error;
    }
  }

  /**
   * Массовая отправка сообщений с контролем скорости
   */
  async bulkSendMessage(
    recipients: Array<{ chatId: number | string; text: string; options?: any }>,
    delayMs: number = 100
  ): Promise<{
    successful: Array<{ chatId: number | string; messageId: number }>;
    failed: Array<{ chatId: number | string; error: string }>;
  }> {
    const successful: Array<{ chatId: number | string; messageId: number }> = [];
    const failed: Array<{ chatId: number | string; error: string }> = [];

    for (const recipient of recipients) {
      try {
        // Проверяем rate limit
        await this.checkRateLimit('bulk_send');
        
        const result = await this.sendMessage(recipient.chatId, recipient.text, recipient.options);
        
        if (result.success && result.messageId) {
          successful.push({ 
            chatId: recipient.chatId, 
            messageId: result.messageId 
          });
        } else {
          failed.push({ 
            chatId: recipient.chatId, 
            error: result.error || 'Unknown error' 
          });
        }

        // Задержка между отправками
        if (delayMs > 0) {
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      } catch (error) {
        failed.push({
          chatId: recipient.chatId,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    logger.info(`Bulk send completed: ${successful.length} successful, ${failed.length} failed`);
    return { successful, failed };
  }

  /**
   * Продвинутая проверка подписки с кешированием
   */
  async checkSubscriptionWithCache(
    userId: number,
    channelUrl: string,
    cacheTtl: number = 300 // 5 минут
  ): Promise<any> {
    const cacheKey = `sub_check:${userId}:${Buffer.from(channelUrl).toString('base64')}`;
    
    // Проверяем кеш
    if (this.redis) {
      try {
        const cached = await this.redis.get(cacheKey);
        if (cached) {
          return JSON.parse(cached);
        }
      } catch (error) {
        logger.warn('Cache read error:', error);
      }
    }

    // Выполняем проверку
    const result = await this.checkSubscription(userId, channelUrl);
    
    // Сохраняем в кеш
    if (this.redis) {
      try {
        await this.redis.setex(cacheKey, cacheTtl, JSON.stringify(result));
      } catch (error) {
        logger.warn('Cache write error:', error);
      }
    }

    return result;
  }

  /**
   * Получение списка администраторов чата
   */
  async getChatAdministrators(chatId: string | number): Promise<any[]> {
    try {
      await this.checkRateLimit('get_admins');
      
      const response = await this.apiClient.post('/getChatAdministrators', {
        chat_id: chatId
      });

      this.updateStats('success');
      return response.data.result;
    } catch (error) {
      this.updateStats('error');
      logger.error(`Failed to get chat administrators for ${chatId}:`, error);
      throw error;
    }
  }

  /**
   * Экспорт инвайт-ссылки чата
   */
  async exportChatInviteLink(chatId: string | number): Promise<string> {
    try {
      await this.checkRateLimit('export_invite');
      
      const response = await this.apiClient.post('/exportChatInviteLink', {
        chat_id: chatId
      });

      this.updateStats('success');
      return response.data.result;
    } catch (error) {
      this.updateStats('error');
      logger.error(`Failed to export invite link for ${chatId}:`, error);
      throw error;
    }
  }

  /**
   * Закрепление сообщения в чате
   */
  async pinChatMessage(
    chatId: string | number,
    messageId: number,
    disableNotification: boolean = false
  ): Promise<void> {
    try {
      await this.checkRateLimit('pin_message');
      
      await this.apiClient.post('/pinChatMessage', {
        chat_id: chatId,
        message_id: messageId,
        disable_notification: disableNotification
      });

      this.updateStats('success');
      logger.info(`Message ${messageId} pinned in chat ${chatId}`);
    } catch (error) {
      this.updateStats('error');
      logger.error(`Failed to pin message ${messageId} in chat ${chatId}:`, error);
      throw error;
    }
  }

  /**
   * Открепление сообщения в чате
   */
  async unpinChatMessage(
    chatId: string | number,
    messageId?: number
  ): Promise<void> {
    try {
      await this.checkRateLimit('unpin_message');
      
      await this.apiClient.post('/unpinChatMessage', {
        chat_id: chatId,
        message_id: messageId
      });

      this.updateStats('success');
      logger.info(`Message ${messageId || 'all'} unpinned in chat ${chatId}`);
    } catch (error) {
      this.updateStats('error');
      logger.error(`Failed to unpin message in chat ${chatId}:`, error);
      throw error;
    }
  }

  /**
   * Установка описания чата
   */
  async setChatDescription(
    chatId: string | number,
    description: string
  ): Promise<void> {
    try {
      await this.checkRateLimit('set_description');
      
      await this.apiClient.post('/setChatDescription', {
        chat_id: chatId,
        description
      });

      this.updateStats('success');
      logger.info(`Description set for chat ${chatId}`);
    } catch (error) {
      this.updateStats('error');
      logger.error(`Failed to set description for chat ${chatId}:`, error);
      throw error;
    }
  }

  /**
   * Получение статистики сервиса
   */
  getStats(): TelegramServiceStats {
    return { ...this.stats };
  }

  /**
   * Сброс статистики
   */
  resetStats(): void {
    this.stats = {
      requestCount: 0,
      errorCount: 0,
      successCount: 0,
      averageResponseTime: 0,
      lastRequestTime: undefined,
      rateLimitHits: 0,
      webhookStatus: this.stats.webhookStatus,
      botStatus: this.stats.botStatus
    };
  }

  /**
   * Проверка health состояния сервиса
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    bot: 'running' | 'error';
    webhook: 'active' | 'inactive' | 'error';
    api: 'accessible' | 'error';
    lastError?: string;
  }> {
    let botStatus: 'running' | 'error' = 'running';
    let apiStatus: 'accessible' | 'error' = 'accessible';
    let lastError: string | undefined;

    try {
      // Проверяем доступность API
      const me = await this.apiClient.post('/getMe');
      if (!me.data.ok) {
        apiStatus = 'error';
        lastError = 'API not accessible';
      }
    } catch (error) {
      apiStatus = 'error';
      botStatus = 'error';
      lastError = error instanceof Error ? error.message : 'Unknown error';
    }

    const isHealthy = botStatus === 'running' && apiStatus === 'accessible';

    return {
      status: isHealthy ? 'healthy' : 'unhealthy',
      bot: botStatus,
      webhook: this.stats.webhookStatus,
      api: apiStatus,
      lastError
    };
  }

  /**

   * Настройка rate limiting
   */
  private setupRateLimiting(): void {
    // Очистка счетчиков каждую минуту
    setInterval(() => {
      const now = Date.now();
      for (const [key, data] of this.rateLimitCache) {
        if (now > data.resetTime) {
          this.rateLimitCache.delete(key);
        }
      }
    }, 60000);
  }


  /**
   * Проверка rate limit
   */
  private async checkRateLimit(action: string): Promise<void> {
    const key = `${action}_${Math.floor(Date.now() / 60000)}`; // По минутам
    const limit = this.config.rateLimiting.messagesPerMinute;
    
    const current = this.rateLimitCache.get(key) || { 
      count: 0, 
      resetTime: Date.now() + 60000 
    };

    if (current.count >= limit) {
      this.stats.rateLimitHits++;
      throw new AppError(`Rate limit exceeded for ${action}`, 429);
    }

    current.count++;
    this.rateLimitCache.set(key, current);
  }

  /**
   * Обновление статистики
   */
  private updateStats(type: 'success' | 'error', responseTime?: number): void {
    this.stats.requestCount++;
    this.stats.lastRequestTime = new Date();

    if (type === 'success') {
      this.stats.successCount++;
    } else {
      this.stats.errorCount++;
    }

    if (responseTime) {
      const currentAvg = this.stats.averageResponseTime;
      const count = this.stats.requestCount;
      this.stats.averageResponseTime = (currentAvg * (count - 1) + responseTime) / count;
    }
  }

  /**
   * Переопределение методов базового класса для добавления статистики
   */
  async sendMessage(
    chatId: number | string,
    text: string,
    options?: any
  ): Promise<{ success: boolean; messageId?: number; error?: string }> {
    const startTime = Date.now();
    
    try {
      await this.checkRateLimit('send_message');
      const result = await super.sendMessage(chatId, text, options);
      
      this.updateStats('success', Date.now() - startTime);
      return result;
    } catch (error) {
      this.updateStats('error', Date.now() - startTime);
      throw error;
    }
  }

  async checkSubscription(userId: number, channelUrl: string): Promise<any> {
    const startTime = Date.now();
    
    try {
      await this.checkRateLimit('check_subscription');
      const result = await super.checkSubscription(userId, channelUrl);
      
      this.updateStats('success', Date.now() - startTime);
      return result;
    } catch (error) {
      this.updateStats('error', Date.now() - startTime);
      throw error;
    }
  }

  async checkUserSubscription(userId: number, channelUrl: string): Promise<any> {
    return this.checkSubscription(userId, channelUrl);
  }

  async checkUserMembership(userId: number, channelUrl: string): Promise<any> {
    return this.checkSubscription(userId, channelUrl);
  }
}