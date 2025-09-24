// src/services/telegram/types.ts

// Основные интерфейсы для Telegram API
export interface TelegramUser {
  id: number;
  isBot: boolean;
  firstName: string;
  lastName?: string;
  username?: string;
  languageCode?: string;
  isPremium?: boolean;
  addedToAttachmentMenu?: boolean;
  canJoinGroups?: boolean;
  canReadAllGroupMessages?: boolean;
  supportsInlineQueries?: boolean;
}

export interface ChatMember {
  status: 'creator' | 'administrator' | 'member' | 'restricted' | 'left' | 'kicked';
  user: TelegramUser;
  isAnonymous?: boolean;
  customTitle?: string;
  canBeEdited?: boolean;
  canManageChat?: boolean;
  canDeleteMessages?: boolean;
  canManageVideoChats?: boolean;
  canRestrictMembers?: boolean;
  canPromoteMembers?: boolean;
  canChangeInfo?: boolean;
  canInviteUsers?: boolean;
  canPostMessages?: boolean;
  canEditMessages?: boolean;
  canPinMessages?: boolean;
  canManageTopics?: boolean;
  untilDate?: number;
  canSendMessages?: boolean;
  canSendAudios?: boolean;
  canSendDocuments?: boolean;
  canSendPhotos?: boolean;
  canSendVideos?: boolean;
  canSendVideoNotes?: boolean;
  canSendVoiceNotes?: boolean;
  canSendPolls?: boolean;
  canSendOtherMessages?: boolean;
  canAddWebPagePreviews?: boolean;
}

export interface ChatInfo {
  id: string;
  title: string;
  type: 'private' | 'group' | 'supergroup' | 'channel';
  memberCount?: number;
  description?: string;
  username?: string;
  inviteLink?: string;
  photo?: {
    smallFileId: string;
    smallFileUniqueId: string;
    bigFileId: string;
    bigFileUniqueId: string;
  };
  pinnedMessage?: MessageInfo;
  permissions?: ChatPermissions;
}

export interface ChatPermissions {
  canSendMessages?: boolean;
  canSendAudios?: boolean;
  canSendDocuments?: boolean;
  canSendPhotos?: boolean;
  canSendVideos?: boolean;
  canSendVideoNotes?: boolean;
  canSendVoiceNotes?: boolean;
  canSendPolls?: boolean;
  canSendOtherMessages?: boolean;
  canAddWebPagePreviews?: boolean;
  canChangeInfo?: boolean;
  canInviteUsers?: boolean;
  canPinMessages?: boolean;
  canManageTopics?: boolean;
}

export interface MessageInfo {
  messageId: number;
  chatId: string | number;
  date: Date;
  text?: string;
  caption?: string;
  from?: TelegramUser;
  replyToMessage?: MessageInfo;
  forwardFrom?: TelegramUser;
  forwardFromChat?: ChatInfo;
  editDate?: Date;
  mediaGroupId?: string;
  hasProtectedContent?: boolean;
  reactions?: MessageReaction[];
}

export interface MessageReaction {
  emoji: string;
  count: number;
  users?: TelegramUser[];
}

// Результаты проверок
export interface SubscriptionCheckResult {
  isSubscribed: boolean;
  status: ChatMember['status'];
  joinedAt?: Date | null;
  error?: string;
  channelInfo?: {
    id: string;
    title: string;
    type: 'channel' | 'group';
    memberCount?: number;
    username?: string;
  };
}

export interface BotAddResult {
  isAdded: boolean;
  botStatus: ChatMember['status'];
  permissions: boolean;
  error?: string;
  chatInfo?: ChatInfo;
  addedAt?: Date;
}

export interface ReactionCheckResult {
  hasReaction: boolean;
  reactionType?: string | null;
  error?: string;
  messageInfo?: {
    chatId: string | number;
    messageId: number;
    reactions: Array<{
      emoji: string;
      count: number;
    }>;
  };
}

// Операции с сообщениями
export interface SendMessageOptions {
  parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2';
  entities?: MessageEntity[];
  disableWebPagePreview?: boolean;
  disableNotification?: boolean;
  protectContent?: boolean;
  replyToMessageId?: number;
  allowSendingWithoutReply?: boolean;
  replyMarkup?: InlineKeyboardMarkup | ReplyKeyboardMarkup | ReplyKeyboardRemove | ForceReply;
}

export interface MessageEntity {
  type: 'mention' | 'hashtag' | 'cashtag' | 'bot_command' | 'url' | 'email' | 'phone_number' | 
        'bold' | 'italic' | 'underline' | 'strikethrough' | 'spoiler' | 'code' | 'pre' | 
        'text_link' | 'text_mention' | 'custom_emoji';
  offset: number;
  length: number;
  url?: string;
  user?: TelegramUser;
  language?: string;
  customEmojiId?: string;
}

// Клавиатуры
export interface InlineKeyboardMarkup {
  inline_keyboard: InlineKeyboardButton[][];
}

export interface InlineKeyboardButton {
  text: string;
  url?: string;
  callbackData?: string;
  webApp?: WebApp;
  loginUrl?: LoginUrl;
  switchInlineQuery?: string;
  switchInlineQueryCurrentChat?: string;
  callbackGame?: any;
  pay?: boolean;
}

export interface ReplyKeyboardMarkup {
  keyboard: KeyboardButton[][];
  isPersistent?: boolean;
  resizeKeyboard?: boolean;
  oneTimeKeyboard?: boolean;
  inputFieldPlaceholder?: string;
  selective?: boolean;
}

export interface KeyboardButton {
  text: string;
  requestUser?: KeyboardButtonRequestUser;
  requestChat?: KeyboardButtonRequestChat;
  requestContact?: boolean;
  requestLocation?: boolean;
  requestPoll?: KeyboardButtonPollType;
  webApp?: WebApp;
}

export interface ReplyKeyboardRemove {
  removeKeyboard: true;
  selective?: boolean;
}

export interface ForceReply {
  forceReply: true;
  inputFieldPlaceholder?: string;
  selective?: boolean;
}

// Дополнительные типы
export interface WebApp {
  url: string;
}

export interface LoginUrl {
  url: string;
  forwardText?: string;
  botUsername?: string;
  requestWriteAccess?: boolean;
}

export interface KeyboardButtonRequestUser {
  requestId: number;
  userIsBot?: boolean;
  userIsPremium?: boolean;
}

export interface KeyboardButtonRequestChat {
  requestId: number;
  chatIsChannel: boolean;
  chatIsForum?: boolean;
  chatHasUsername?: boolean;
  chatIsCreated?: boolean;
  userAdministratorRights?: ChatAdministratorRights;
  botAdministratorRights?: ChatAdministratorRights;
  botIsMember?: boolean;
}

export interface ChatAdministratorRights {
  isAnonymous: boolean;
  canManageChat: boolean;
  canDeleteMessages: boolean;
  canManageVideoChats: boolean;
  canRestrictMembers: boolean;
  canPromoteMembers: boolean;
  canChangeInfo: boolean;
// src/services/telegram/types.ts

// Основные интерфейсы для Telegram API
export interface TelegramUser {
  id: number;
  isBot: boolean;
  firstName: string;
  lastName?: string;
  username?: string;
  languageCode?: string;
  isPremium?: boolean;
  addedToAttachmentMenu?: boolean;
  canJoinGroups?: boolean;
  canReadAllGroupMessages?: boolean;
  supportsInlineQueries?: boolean;
}

export interface ChatMember {
  status: 'creator' | 'administrator' | 'member' | 'restricted' | 'left' | 'kicked';
  user: TelegramUser;
  isAnonymous?: boolean;
  customTitle?: string;
  canBeEdited?: boolean;
  canManageChat?: boolean;
  canDeleteMessages?: boolean;
  canManageVideoChats?: boolean;
  canRestrictMembers?: boolean;
  canPromoteMembers?: boolean;
  canChangeInfo?: boolean;
  canInviteUsers?: boolean;
  canPostMessages?: boolean;
  canEditMessages?: boolean;
  canPinMessages?: boolean;
  canManageTopics?: boolean;
  untilDate?: number;
  canSendMessages?: boolean;
  canSendAudios?: boolean;
  canSendDocuments?: boolean;
  canSendPhotos?: boolean;
  canSendVideos?: boolean;
  canSendVideoNotes?: boolean;
  canSendVoiceNotes?: boolean;
  canSendPolls?: boolean;
  canSendOtherMessages?: boolean;
  canAddWebPagePreviews?: boolean;
}

export interface ChatInfo {
  id: string;
  title: string;
  type: 'private' | 'group' | 'supergroup' | 'channel';
  memberCount?: number;
  description?: string;
  username?: string;
  inviteLink?: string;
  photo?: {
    smallFileId: string;
    smallFileUniqueId: string;
    bigFileId: string;
    bigFileUniqueId: string;
  };
  pinnedMessage?: MessageInfo;
  permissions?: ChatPermissions;
}

export interface ChatPermissions {
  canSendMessages?: boolean;
  canSendAudios?: boolean;
  canSendDocuments?: boolean;
  canSendPhotos?: boolean;
  canSendVideos?: boolean;
  canSendVideoNotes?: boolean;
  canSendVoiceNotes?: boolean;
  canSendPolls?: boolean;
  canSendOtherMessages?: boolean;
  canAddWebPagePreviews?: boolean;
  canChangeInfo?: boolean;
  canInviteUsers?: boolean;
  canPinMessages?: boolean;
  canManageTopics?: boolean;
}

export interface MessageInfo {
  messageId: number;
  chatId: string | number;
  date: Date;
  text?: string;
  caption?: string;
  from?: TelegramUser;
  replyToMessage?: MessageInfo;
  forwardFrom?: TelegramUser;
  forwardFromChat?: ChatInfo;
  editDate?: Date;
  mediaGroupId?: string;
  hasProtectedContent?: boolean;
  reactions?: MessageReaction[];
}

export interface MessageReaction {
  emoji: string;
  count: number;
  users?: TelegramUser[];
}

// Результаты проверок
export interface SubscriptionCheckResult {
  isSubscribed: boolean;
  status: ChatMember['status'];
  joinedAt?: Date | null;
  error?: string;
  channelInfo?: {
    id: string;
    title: string;
    type: 'channel' | 'group';
    memberCount?: number;
    username?: string;
  };
}

export interface BotAddResult {
  isAdded: boolean;
  botStatus: ChatMember['status'];
  permissions: boolean;
  error?: string;
  chatInfo?: ChatInfo;
  addedAt?: Date;
}

export interface ReactionCheckResult {
  hasReaction: boolean;
  reactionType?: string | null;
  error?: string;
  messageInfo?: {
    chatId: string | number;
    messageId: number;
    reactions: Array<{
      emoji: string;
      count: number;
    }>;
  };
}

// Операции с сообщениями
export interface SendMessageOptions {
  parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2';
  entities?: MessageEntity[];
  disableWebPagePreview?: boolean;
  disableNotification?: boolean;
  protectContent?: boolean;
  replyToMessageId?: number;
  allowSendingWithoutReply?: boolean;
  replyMarkup?: InlineKeyboardMarkup | ReplyKeyboardMarkup | ReplyKeyboardRemove | ForceReply;
}

export interface MessageEntity {
  type: 'mention' | 'hashtag' | 'cashtag' | 'bot_command' | 'url' | 'email' | 'phone_number' | 
        'bold' | 'italic' | 'underline' | 'strikethrough' | 'spoiler' | 'code' | 'pre' | 
        'text_link' | 'text_mention' | 'custom_emoji';
  offset: number;
  length: number;
  url?: string;
  user?: TelegramUser;
  language?: string;
  customEmojiId?: string;
}

// Клавиатуры
export interface InlineKeyboardMarkup {
  inline_keyboard: InlineKeyboardButton[][];
}

export interface InlineKeyboardButton {
  text: string;
  url?: string;
  callbackData?: string;
  webApp?: WebApp;
  loginUrl?: LoginUrl;
  switchInlineQuery?: string;
  switchInlineQueryCurrentChat?: string;
  callbackGame?: any;
  pay?: boolean;
}

export interface ReplyKeyboardMarkup {
  keyboard: KeyboardButton[][];
  isPersistent?: boolean;
  resizeKeyboard?: boolean;
  oneTimeKeyboard?: boolean;
  inputFieldPlaceholder?: string;
  selective?: boolean;
}

export interface KeyboardButton {
  text: string;
  requestUser?: KeyboardButtonRequestUser;
  requestChat?: KeyboardButtonRequestChat;
  requestContact?: boolean;
  requestLocation?: boolean;
  requestPoll?: KeyboardButtonPollType;
  webApp?: WebApp;
}

export interface ReplyKeyboardRemove {
  removeKeyboard: true;
  selective?: boolean;
}

export interface ForceReply {
  forceReply: true;
  inputFieldPlaceholder?: string;
  selective?: boolean;
}

// Дополнительные типы
export interface WebApp {
  url: string;
}

export interface LoginUrl {
  url: string;
  forwardText?: string;
  botUsername?: string;
  requestWriteAccess?: boolean;
}

export interface KeyboardButtonRequestUser {
  requestId: number;
  userIsBot?: boolean;
  userIsPremium?: boolean;
}

export interface KeyboardButtonRequestChat {
  requestId: number;
  chatIsChannel: boolean;
  chatIsForum?: boolean;
  chatHasUsername?: boolean;
  chatIsCreated?: boolean;
  userAdministratorRights?: ChatAdministratorRights;
  botAdministratorRights?: ChatAdministratorRights;
  botIsMember?: boolean;
}

export interface ChatAdministratorRights {
  isAnonymous: boolean;
  canManageChat: boolean;
  canDeleteMessages: boolean;
  canManageVideoChats: boolean;
  canRestrictMembers: boolean;
  canPromoteMembers: boolean;
  canChangeInfo: boolean;
  canInviteUsers: boolean;
  canPostMessages?: boolean;
  canEditMessages?: boolean;
  canPinMessages?: boolean;
  canManageTopics?: boolean;
}

export interface KeyboardButtonPollType {
  type?: 'quiz' | 'regular';
}

// Файлы и медиа
export interface FileInfo {
  fileId: string;
  fileUniqueId: string;
  fileSize?: number;
  filePath?: string;
}

export interface PhotoSize extends FileInfo {
  width: number;
  height: number;
}

export interface Audio extends FileInfo {
  duration: number;
  performer?: string;
  title?: string;
  fileName?: string;
  mimeType?: string;
  thumbnail?: PhotoSize;
}

export interface Document extends FileInfo {
  thumbnail?: PhotoSize;
  fileName?: string;
  mimeType?: string;
}

export interface Video extends FileInfo {
  width: number;
  height: number;
  duration: number;
  thumbnail?: PhotoSize;
  fileName?: string;
  mimeType?: string;
}

export interface Voice extends FileInfo {
  duration: number;
  mimeType?: string;
}

export interface VideoNote extends FileInfo {
  length: number;
  duration: number;
  thumbnail?: PhotoSize;
}

export interface Contact {
  phoneNumber: string;
  firstName: string;
  lastName?: string;
  userId?: number;
  vcard?: string;
}

export interface Location {
  longitude: number;
  latitude: number;
  horizontalAccuracy?: number;
  livePeriod?: number;
  heading?: number;
  proximityAlertRadius?: number;
}

export interface Venue {
  location: Location;
  title: string;
  address: string;
  foursquareId?: string;
  foursquareType?: string;
  googlePlaceId?: string;
  googlePlaceType?: string;
}

// Webhook и обновления
export interface WebhookInfo {
  url: string;
  hasCustomCertificate: boolean;
  pendingUpdateCount: number;
  ipAddress?: string;
  lastErrorDate?: number;
  lastErrorMessage?: string;
  lastSynchronizationErrorDate?: number;
  maxConnections?: number;
  allowedUpdates?: string[];
}

export interface Update {
  updateId: number;
  message?: Message;
  editedMessage?: Message;
  channelPost?: Message;
  editedChannelPost?: Message;
  inlineQuery?: InlineQuery;
  chosenInlineResult?: ChosenInlineResult;
  callbackQuery?: CallbackQuery;
  shippingQuery?: ShippingQuery;
  preCheckoutQuery?: PreCheckoutQuery;
  poll?: Poll;
  pollAnswer?: PollAnswer;
  myChatMember?: ChatMemberUpdated;
  chatMember?: ChatMemberUpdated;
  chatJoinRequest?: ChatJoinRequest;
}

export interface Message extends MessageInfo {
  from?: TelegramUser;
  senderChat?: ChatInfo;
  date: number;
  chat: ChatInfo;
  forwardFrom?: TelegramUser;
  forwardFromChat?: ChatInfo;
  forwardFromMessageId?: number;
  forwardSignature?: string;
  forwardSenderName?: string;
  forwardDate?: number;
  isTopicMessage?: boolean;
  isAutomaticForward?: boolean;
  replyToMessage?: Message;
  viaBot?: TelegramUser;
  editDate?: number;
  hasProtectedContent?: boolean;
  mediaGroupId?: string;
  authorSignature?: string;
  text?: string;
  entities?: MessageEntity[];
  animation?: any;
  audio?: Audio;
  document?: Document;
  photo?: PhotoSize[];
  sticker?: any;
  video?: Video;
  videoNote?: VideoNote;
  voice?: Voice;
  caption?: string;
  captionEntities?: MessageEntity[];
  hasMediaSpoiler?: boolean;
  contact?: Contact;
  dice?: any;
  game?: any;
  poll?: Poll;
  venue?: Venue;
  location?: Location;
  newChatMembers?: TelegramUser[];
  leftChatMember?: TelegramUser;
  newChatTitle?: string;
  newChatPhoto?: PhotoSize[];
  deleteChatPhoto?: boolean;
  groupChatCreated?: boolean;
  supergroupChatCreated?: boolean;
  channelChatCreated?: boolean;
  messageAutoDeleteTimerChanged?: any;
  migrateToChatId?: number;
  migrateFromChatId?: number;
  pinnedMessage?: Message;
  invoice?: any;
  successfulPayment?: any;
  userShared?: any;
  chatShared?: any;
  connectedWebsite?: string;
  writeAccessAllowed?: any;
  passportData?: any;
  proximityAlertTriggered?: any;
  forumTopicCreated?: any;
  forumTopicEdited?: any;
  forumTopicClosed?: any;
  forumTopicReopened?: any;
  generalForumTopicHidden?: any;
  generalForumTopicUnhidden?: any;
  videoChatScheduled?: any;
  videoChatStarted?: any;
  videoChatEnded?: any;
  videoChatParticipantsInvited?: any;
  webAppData?: any;
  replyMarkup?: InlineKeyboardMarkup;
}

export interface InlineQuery {
  id: string;
  from: TelegramUser;
  query: string;
  offset: string;
  chatType?: 'sender' | 'private' | 'group' | 'supergroup' | 'channel';
  location?: Location;
}

export interface ChosenInlineResult {
  resultId: string;
  from: TelegramUser;
  location?: Location;
  inlineMessageId?: string;
  query: string;
}

export interface CallbackQuery {
  id: string;
  from: TelegramUser;
  message?: Message;
  inlineMessageId?: string;
  chatInstance: string;
  data?: string;
  gameShortName?: string;
}

export interface ShippingQuery {
  id: string;
  from: TelegramUser;
  invoicePayload: string;
  shippingAddress: any;
}

export interface PreCheckoutQuery {
  id: string;
  from: TelegramUser;
  currency: string;
  totalAmount: number;
  invoicePayload: string;
  shippingOptionId?: string;
  orderInfo?: any;
}

export interface Poll {
  id: string;
  question: string;
  options: PollOption[];
  totalVoterCount: number;
  isClosed: boolean;
  isAnonymous: boolean;
  type: 'regular' | 'quiz';
  allowsMultipleAnswers: boolean;
  correctOptionId?: number;
  explanation?: string;
  explanationEntities?: MessageEntity[];
  openPeriod?: number;
  closeDate?: number;
}

export interface PollOption {
  text: string;
  voterCount: number;
}

export interface PollAnswer {
  pollId: string;
  user: TelegramUser;
  optionIds: number[];
}

export interface ChatMemberUpdated {
  chat: ChatInfo;
  from: TelegramUser;
  date: number;
  oldChatMember: ChatMember;
  newChatMember: ChatMember;
  inviteLink?: any;
}

export interface ChatJoinRequest {
  chat: ChatInfo;
  from: TelegramUser;
  userChatId: number;
  date: number;
  bio?: string;
  inviteLink?: any;
}

// Конфигурация TelegramService
export interface TelegramServiceConfig {
  botToken: string;
  webhookUrl?: string;
  webhookSecretToken?: string;
  apiTimeout: number;
  retryAttempts: number;
  rateLimiting: {
    messagesPerSecond: number;
    messagesPerMinute: number;
    burstLimit: number;
  };
  features: {
    enableWebhook: boolean;
    enablePolling: boolean;
    enableFileDownload: boolean;
    maxFileSize: number;
  };
  logging: {
    logRequests: boolean;
    logResponses: boolean;
    logErrors: boolean;
  };
}

// Статистика и мониторинг
export interface TelegramServiceStats {
  requestCount: number;
  errorCount: number;
  successCount: number;
  averageResponseTime: number;
  lastRequestTime?: Date;
  rateLimitHits: number;
  webhookStatus: 'active' | 'inactive' | 'error';
  botStatus: 'running' | 'stopped' | 'error';
}

// Кастомные ошибки
export class TelegramServiceError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400,
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = 'TelegramServiceError';
  }
}

export class TelegramAPIError extends TelegramServiceError {
  constructor(
    message: string,
    public errorCode: number,
    public description: string
  ) {
    super(
      `Telegram API Error: ${description}`,
      'TELEGRAM_API_ERROR',
      400,
      { errorCode, description }
    );
  }
}

export class ChatNotFoundError extends TelegramServiceError {
  constructor(chatId: string | number) {
    super(
      `Chat not found: ${chatId}`,
      'CHAT_NOT_FOUND',
      404,
      { chatId }
    );
  }
}

export class UserNotFoundError extends TelegramServiceError {
  constructor(userId: number) {
    super(
      `User not found in chat: ${userId}`,
      'USER_NOT_FOUND',
      404,
      { userId }
    );
  }
}

export class BotBlockedError extends TelegramServiceError {
  constructor(userId: number) {
    super(
      `Bot is blocked by user: ${userId}`,
      'BOT_BLOCKED',
      403,
      { userId }
    );
  }
}

export class InsufficientPermissionsError extends TelegramServiceError {
  constructor(action: string, chatId: string | number) {
    super(
      `Insufficient permissions for action: ${action} in chat ${chatId}`,
      'INSUFFICIENT_PERMISSIONS',
      403,
      { action, chatId }
    );
  }
}

export class InvalidUrlError extends TelegramServiceError {
  constructor(url: string) {
    super(
      `Invalid Telegram URL: ${url}`,
      'INVALID_URL',
      400,
      { url }
    );
  }
}

export class RateLimitError extends TelegramServiceError {
  constructor(retryAfter: number) {
    super(
      `Rate limit exceeded. Retry after ${retryAfter} seconds`,
      'RATE_LIMIT_EXCEEDED',
      429,
      { retryAfter }
    );
  }
}