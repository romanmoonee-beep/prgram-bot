// src/services/telegram/TelegramService.ts
import axios, { AxiosInstance } from 'axios';
import { Bot, Context, GrammyError, HttpError } from 'grammy';
import { 
  TelegramUser,
  ChatMember,
  SubscriptionCheckResult,
  BotAddResult,
  ReactionCheckResult,
  MessageInfo,
  ChatInfo
} from './types';
import { AppError } from '../../utils/errors/init';
import { logger } from '../../utils/logger';

export class TelegramService {
  private bot: Bot;
  private apiClient: AxiosInstance;
  private botToken: string;

  constructor(botToken: string) {
    this.botToken = botToken;
    this.bot = new Bot(botToken);
    
    // Создаем HTTP клиент для прямых API запросов
    this.apiClient = axios.create({
      baseURL: `https://api.telegram.org/bot${botToken}`,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    this.setupErrorHandling();
  }

  /**
   * Проверка подписки пользователя на канал
   */
  async checkSubscription(
    userId: number,
    channelUrl: string
  ): Promise<SubscriptionCheckResult> {
    try {
      const channelUsername = this.extractChannelUsername(channelUrl);
      
      // Получаем информацию о участнике канала
      const response = await this.apiClient.post('/getChatMember', {
        chat_id: channelUsername,
        user_id: userId
      });

      const member: ChatMember = response.data.result;
      const isSubscribed = ['member', 'administrator', 'creator'].includes(member.status);
      
      logger.debug(`Subscription check: user ${userId} in ${channelUsername} - ${isSubscribed}`);
      
      return {
        isSubscribed,
        status: member.status,
        joinedAt: member.status === 'member' ? new Date() : null,
        channelInfo: {
          id: channelUsername,
          title: await this.getChatTitle(channelUsername),
          type: 'channel',
          memberCount: await this.getChatMemberCount(channelUsername)
        }
      };
    } catch (error) {
      return this.handleSubscriptionError(error, userId, channelUrl);
    }
  }

  /**
   * Проверка участия в группе
   */
  async checkGroupMembership(
    userId: number,
    groupUrl: string
  ): Promise<SubscriptionCheckResult> {
    try {
      const chatId = this.extractChatId(groupUrl);
      
      const response = await this.apiClient.post('/getChatMember', {
        chat_id: chatId,
        user_id: userId
      });

      const member: ChatMember = response.data.result;
      const isMember = ['member', 'administrator', 'creator'].includes(member.status);
      
      logger.debug(`Group membership check: user ${userId} in ${chatId} - ${isMember}`);
      
      return {
        isSubscribed: isMember,
        status: member.status,
        joinedAt: member.status === 'member' ? new Date() : null,
        channelInfo: {
          id: chatId,
          title: await this.getChatTitle(chatId),
          type: 'group',
          memberCount: await this.getChatMemberCount(chatId)
        }
      };
    } catch (error) {
      return this.handleSubscriptionError(error, userId, groupUrl);
    }
  }

  /**
   * Проверка реакции на пост
   */
  async checkReaction(
    userId: number,
    postUrl: string
  ): Promise<ReactionCheckResult> {
    try {
      const { chatId, messageId } = this.parsePostUrl(postUrl);
      
      // Получаем информацию о реакциях на сообщение
      const response = await this.apiClient.post('/getMessageReactions', {
        chat_id: chatId,
        message_id: messageId
      });

      const reactions = response.data.result;
      
      // Проверяем, поставил ли пользователь реакцию
      const userReaction = reactions.find((r: any) => 
        r.users?.some((u: any) => u.id === userId)
      );

      return {
        hasReaction: !!userReaction,
        reactionType: userReaction?.emoji || null,
        messageInfo: {
          chatId,
          messageId,
          reactions: reactions.map((r: any) => ({
            emoji: r.emoji,
            count: r.count
          }))
        }
      };
    } catch (error) {
      logger.error('Reaction check error:', error);
      return {
        hasReaction: false,
        reactionType: null,
        error: 'Failed to check reaction'
      };
    }
  }

  /**
   * Проверка добавления бота в чат
   */
  async checkBotInChat(
    chatId: string | number,
    targetBotUsername: string
  ): Promise<BotAddResult> {
    try {
      // Получаем информацию о боте в чате
      const botInfo = await this.apiClient.post('/getChatMember', {
        chat_id: chatId,
        user_id: `@${targetBotUsername}`
      });

      const member: ChatMember = botInfo.data.result;
      const isAdded = ['member', 'administrator'].includes(member.status);
      
      return {
        isAdded,
        botStatus: member.status,
        permissions: member.status === 'administrator' ? member.can_manage_chat : false,
        chatInfo: {
          id: chatId.toString(),
          title: await this.getChatTitle(chatId),
          type: 'group',
          memberCount: await this.getChatMemberCount(chatId)
        }
      };
    } catch (error) {
      logger.error(`Bot check error for ${targetBotUsername} in ${chatId}:`, error);
      return {
        isAdded: false,
        botStatus: 'not_member',
        permissions: false,
        error: 'Failed to check bot presence'
      };
    }
  }

  /**
   * Получение информации о пользователе Telegram
   */
  async getUserInfo(userId: number): Promise<TelegramUser | null> {
    try {
      // Telegram Bot API не позволяет получить информацию о произвольном пользователе
      // Эта информация доступна только через взаимодействие с ботом
      logger.warn(`Cannot fetch user info for ${userId} - not available via Bot API`);
      return null;
    } catch (error) {
      logger.error(`Failed to get user info for ${userId}:`, error);
      return null;
    }
  }

  /**
   * Отправка сообщения пользователю
   */
  async sendMessage(
    chatId: number | string,
    text: string,
    options?: {
      parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2';
      replyMarkup?: any;
      disablePreview?: boolean;
    }
  ): Promise<{ success: boolean; messageId?: number; error?: string }> {
    try {
      const response = await this.apiClient.post('/sendMessage', {
        chat_id: chatId,
        text,
        parse_mode: options?.parseMode || 'HTML',
        reply_markup: options?.replyMarkup,
        disable_web_page_preview: options?.disablePreview || false
      });

      return {
        success: true,
        messageId: response.data.result.message_id
      };
    } catch (error) {
      logger.error(`Failed to send message to ${chatId}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Отправка фото с подписью
   */
  async sendPhoto(
    chatId: number | string,
    photo: string | Buffer,
    caption?: string,
    options?: {
      parseMode?: 'HTML' | 'Markdown';
      replyMarkup?: any;
    }
  ): Promise<{ success: boolean; messageId?: number; error?: string }> {
    try {
      const response = await this.apiClient.post('/sendPhoto', {
        chat_id: chatId,
        photo,
        caption,
        parse_mode: options?.parseMode || 'HTML',
        reply_markup: options?.replyMarkup
      });

      return {
        success: true,
        messageId: response.data.result.message_id
      };
    } catch (error) {
      logger.error(`Failed to send photo to ${chatId}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Удаление сообщения
   */
  async deleteMessage(
    chatId: number | string,
    messageId: number
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await this.apiClient.post('/deleteMessage', {
        chat_id: chatId,
        message_id: messageId
      });

      return { success: true };
    } catch (error) {
      logger.error(`Failed to delete message ${messageId} in ${chatId}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Получение информации о чате
   */
  async getChatInfo(chatId: string | number): Promise<ChatInfo | null> {
    try {
      const response = await this.apiClient.post('/getChat', {
        chat_id: chatId
      });

      const chat = response.data.result;
      
      return {
        id: chat.id.toString(),
        title: chat.title || `${chat.first_name || ''} ${chat.last_name || ''}`.trim(),
        type: chat.type,
        memberCount: await this.getChatMemberCount(chatId),
        description: chat.description,
        username: chat.username,
        inviteLink: chat.invite_link
      };
    } catch (error) {
      logger.error(`Failed to get chat info for ${chatId}:`, error);
      return null;
    }
  }

  /**
   * Создание инвайт-ссылки для чата
   */
  async createChatInviteLink(
    chatId: string | number,
    options?: {
      expireDate?: Date;
      memberLimit?: number;
      name?: string;
      createsJoinRequest?: boolean;
    }
  ): Promise<{ success: boolean; inviteLink?: string; error?: string }> {
    try {
      const response = await this.apiClient.post('/createChatInviteLink', {
        chat_id: chatId,
        expire_date: options?.expireDate ? Math.floor(options.expireDate.getTime() / 1000) : undefined,
        member_limit: options?.memberLimit,
        name: options?.name,
        creates_join_request: options?.createsJoinRequest
      });

      return {
        success: true,
        inviteLink: response.data.result.invite_link
      };
    } catch (error) {
      logger.error(`Failed to create invite link for ${chatId}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Кик пользователя из чата
   */
  async kickUser(
    chatId: string | number,
    userId: number,
    untilDate?: Date
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await this.apiClient.post('/banChatMember', {
        chat_id: chatId,
        user_id: userId,
        until_date: untilDate ? Math.floor(untilDate.getTime() / 1000) : undefined
      });

      return { success: true };
    } catch (error) {
      logger.error(`Failed to kick user ${userId} from ${chatId}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Ограничение пользователя в чате
   */
  async restrictUser(
    chatId: string | number,
    userId: number,
    permissions: {
      canSendMessages?: boolean;
      canSendMediaMessages?: boolean;
      canSendPolls?: boolean;
      canSendOtherMessages?: boolean;
      canAddWebPagePreviews?: boolean;
      canChangeInfo?: boolean;
      canInviteUsers?: boolean;
      canPinMessages?: boolean;
    },
    untilDate?: Date
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await this.apiClient.post('/restrictChatMember', {
        chat_id: chatId,
        user_id: userId,
        permissions,
        until_date: untilDate ? Math.floor(untilDate.getTime() / 1000) : undefined
      });

      return { success: true };
    } catch (error) {
      logger.error(`Failed to restrict user ${userId} in ${chatId}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Получение файла по file_id
   */
  async getFile(fileId: string): Promise<{ success: boolean; filePath?: string; fileUrl?: string; error?: string }> {
    try {
      const response = await this.apiClient.post('/getFile', {
        file_id: fileId
      });

      const filePath = response.data.result.file_path;
      const fileUrl = `https://api.telegram.org/file/bot${this.botToken}/${filePath}`;

      return {
        success: true,
        filePath,
        fileUrl
      };
    } catch (error) {
      logger.error(`Failed to get file ${fileId}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Скачивание файла
   */
  async downloadFile(fileId: string): Promise<{ success: boolean; buffer?: Buffer; error?: string }> {
    try {
      const fileInfo = await this.getFile(fileId);
      
      if (!fileInfo.success || !fileInfo.fileUrl) {
        return {
          success: false,
          error: fileInfo.error || 'Failed to get file URL'
        };
      }

      const response = await axios.get(fileInfo.fileUrl, {
        responseType: 'arraybuffer'
      });

      return {
        success: true,
        buffer: Buffer.from(response.data)
      };
    } catch (error) {
      logger.error(`Failed to download file ${fileId}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Валидация Telegram URL
   */
  validateTelegramUrl(url: string): {
    isValid: boolean;
    type: 'channel' | 'group' | 'bot' | 'message' | 'unknown';
    username?: string;
    chatId?: string;
    messageId?: number;
  } {
    try {
      const urlObj = new URL(url);
      
      if (!['t.me', 'telegram.me'].includes(urlObj.hostname)) {
        return { isValid: false, type: 'unknown' };
      }

      const path = urlObj.pathname.slice(1); // Убираем ведущий слэш
      const parts = path.split('/');

      // Канал или группа: t.me/username
      if (parts.length === 1 && parts[0].startsWith('@')) {
        return {
          isValid: true,
          type: 'channel',
          username: parts[0]
        };
      }

      // Сообщение: t.me/username/messageId
      if (parts.length === 2 && !isNaN(parseInt(parts[1]))) {
        return {
          isValid: true,
          type: 'message',
          username: parts[0],
          messageId: parseInt(parts[1])
        };
      }

      // Приватный чат: t.me/c/chatId/messageId
      if (parts[0] === 'c' && parts.length >= 2) {
        return {
          isValid: true,
          type: parts.length === 3 ? 'message' : 'group',
          chatId: parts[1],
          messageId: parts.length === 3 ? parseInt(parts[2]) : undefined
        };
      }

      // Бот: t.me/botusername
      if (parts.length === 1 && parts[0].endsWith('bot')) {
        return {
          isValid: true,
          type: 'bot',
          username: parts[0]
        };
      }

      return { isValid: false, type: 'unknown' };
    } catch {
      return { isValid: false, type: 'unknown' };
    }
  }

  /**
   * Извлечение username канала из URL
   */
  private extractChannelUsername(url: string): string {
    const validation = this.validateTelegramUrl(url);
    
    if (validation.username) {
      return validation.username.startsWith('@') ? validation.username : `@${validation.username}`;
    }
    
    if (validation.chatId) {
      return `-100${validation.chatId}`;
    }
    
    throw new AppError('Invalid channel URL', 400);
  }

  /**
   * Извлечение ID чата из URL
   */
  private extractChatId(url: string): string {
    const validation = this.validateTelegramUrl(url);
    
    if (validation.username) {
      return validation.username.startsWith('@') ? validation.username : `@${validation.username}`;
    }
    
    if (validation.chatId) {
      return `-100${validation.chatId}`;
    }
    
    throw new AppError('Invalid chat URL', 400);
  }

  /**
   * Парсинг URL поста
   */
  private parsePostUrl(url: string): { chatId: string; messageId: number } {
    const validation = this.validateTelegramUrl(url);
    
    if (validation.type !== 'message' || !validation.messageId) {
      throw new AppError('Invalid post URL', 400);
    }

    const chatId = validation.username 
      ? (validation.username.startsWith('@') ? validation.username : `@${validation.username}`)
      : `-100${validation.chatId}`;

    return {
      chatId,
      messageId: validation.messageId
    };
  }

  /**
   * Получение названия чата
   */
  private async getChatTitle(chatId: string | number): Promise<string> {
    try {
      const chatInfo = await this.getChatInfo(chatId);
      return chatInfo?.title || 'Unknown';
    } catch {
      return 'Unknown';
    }
  }

  /**
   * Получение количества участников чата
   */
  private async getChatMemberCount(chatId: string | number): Promise<number> {
    try {
      const response = await this.apiClient.post('/getChatMemberCount', {
        chat_id: chatId
      });
      return response.data.result;
    } catch {
      return 0;
    }
  }

  /**
   * Обработка ошибок проверки подписки
   */
  private handleSubscriptionError(
    error: any,
    userId: number,
    url: string
  ): SubscriptionCheckResult {
    logger.error(`Subscription check failed for user ${userId}, URL ${url}:`, error);
    
    if (error.response?.data?.error_code === 400) {
      // Пользователь не найден в чате или чат не существует
      return {
        isSubscribed: false,
        status: 'not_member',
        error: 'User not found in chat or chat does not exist'
      };
    }

    if (error.response?.data?.error_code === 403) {
      // Бот не имеет доступа к чату
      return {
        isSubscribed: false,
        status: 'not_member',
        error: 'Bot has no access to this chat'
      };
    }

    return {
      isSubscribed: false,
      status: 'not_member',
      error: 'Failed to check subscription'
    };
  }

  /**
   * Настройка обработки ошибок
   */
  private setupErrorHandling(): void {
    this.bot.catch((err) => {
      const ctx = err.ctx;
      logger.error(`Error while handling update ${ctx.update.update_id}:`);
      
      const e = err.error;
      if (e instanceof GrammyError) {
        logger.error('Error in request:', e.description);
      } else if (e instanceof HttpError) {
        logger.error('Could not contact Telegram:', e);
      } else {
        logger.error('Unknown error:', e);
      }
    });
  }

  /**
   * Получение экземпляра бота (для обработчиков)
   */
  getBot(): Bot {
    return this.bot;
  }

  /**
   * Запуск бота
   */
  async startBot(): Promise<void> {
    try {
      await this.bot.start({
        onStart: (botInfo) => {
          logger.info(`Bot started: @${botInfo.username}`);
        }
      });
    } catch (error) {
      logger.error('Failed to start bot:', error);
      throw error;
    }
  }

  /**
   * Остановка бота
   */
  async stopBot(): Promise<void> {
    try {
      await this.bot.stop();
      logger.info('Bot stopped');
    } catch (error) {
      logger.error('Failed to stop bot:', error);
      throw error;
    }
  }
}