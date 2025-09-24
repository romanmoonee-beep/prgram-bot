// src/middlewares/rateLimit.ts
import { Context, NextFunction } from 'grammy';
import Redis from 'ioredis';
import { logger } from '../../utils/logger';
import { config } from '../../config';

// Создание Redis клиента
const redis = new Redis(config.redis.url, {
  retryDelayOnFailover: 100,
  maxRetriesPerRequest: 3,
  lazyConnect: true
});

// Настройки rate limiting
const RATE_LIMIT_WINDOW = 60; // 1 минута в секундах
const MAX_REQUESTS_PER_WINDOW = 30; // 30 запросов в минуту
const RATE_LIMIT_PREFIX = 'rl:';

// Подключение к Redis
redis.on('connect', () => {
  logger.info('✅ Redis connected for rate limiting');
});

redis.on('error', (error) => {
  logger.error('❌ Redis connection error:', error);
});

export async function rateLimitMiddleware(ctx: Context, next: NextFunction) {
  // Пропускаем, если нет пользователя
  if (!ctx.from) {
    return next();
  }

  const userId = ctx.from.id;
  const key = `${RATE_LIMIT_PREFIX}${userId}`;

  try {
    // Используем Redis pipeline для атомарности
    const pipeline = redis.pipeline();
    
    // Увеличиваем счетчик
    pipeline.incr(key);
    
    // Устанавливаем TTL только если ключ новый
    pipeline.expire(key, RATE_LIMIT_WINDOW);
    
    const results = await pipeline.exec();
    
    if (!results || results.length < 1) {
      logger.error('Redis pipeline failed for rate limiting');
      return next(); // В случае ошибки Redis пропускаем проверку
    }

    const count = results[0][1] as number;

    // Проверяем лимит
    if (count > MAX_REQUESTS_PER_WINDOW) {
      // Получаем оставшееся время
      const ttl = await redis.ttl(key);
      
      logger.warn(`Rate limit exceeded for user ${userId}`, {
        count,
        timeRemaining: ttl
      });

      try {
        await ctx.reply(
          `⚠️ Превышен лимит запросов!\n\n` +
          `Попробуйте снова через ${ttl} секунд.`,
          { 
            reply_parameters: { message_id: ctx.message?.message_id }
          }
        );
      } catch (error) {
        logger.error('Failed to send rate limit message:', error);
      }

      return; // Блокируем выполнение
    }

    return next();

  } catch (error) {
    logger.error('Rate limit middleware error:', error);
    // В случае ошибки Redis пропускаем проверку
    return next();
  }
}

// Функция для проверки rate limit без middleware
export async function checkRateLimit(userId: number): Promise<{ 
  allowed: boolean; 
  remaining: number; 
  resetTime: number;
  count: number;
}> {
  const key = `${RATE_LIMIT_PREFIX}${userId}`;

  try {
    const [count, ttl] = await Promise.all([
      redis.get(key),
      redis.ttl(key)
    ]);

    const currentCount = parseInt(count || '0');
    const allowed = currentCount < MAX_REQUESTS_PER_WINDOW;
    const remaining = Math.max(0, MAX_REQUESTS_PER_WINDOW - currentCount);
    const resetTime = ttl > 0 ? Date.now() + (ttl * 1000) : Date.now() + (RATE_LIMIT_WINDOW * 1000);

    return {
      allowed,
      remaining,
      resetTime,
      count: currentCount
    };

  } catch (error) {
    logger.error('Check rate limit error:', error);
    return {
      allowed: true,
      remaining: MAX_REQUESTS_PER_WINDOW,
      resetTime: Date.now() + (RATE_LIMIT_WINDOW * 1000),
      count: 0
    };
  }
}

// Функция для сброса rate limit для конкретного пользователя (для админов)
export async function resetRateLimit(userId: number): Promise<void> {
  const key = `${RATE_LIMIT_PREFIX}${userId}`;
  
  try {
    await redis.del(key);
    logger.info(`Rate limit reset for user ${userId}`);
  } catch (error) {
    logger.error('Reset rate limit error:', error);
  }
}

// Функция для получения статистики rate limiting
export async function getRateLimitStats(): Promise<{
  totalUsers: number;
  activeWindows: number;
  avgRequestsPerUser: number;
  topUsers: Array<{ userId: string; count: number }>;
}> {
  try {
    const keys = await redis.keys(`${RATE_LIMIT_PREFIX}*`);
    
    if (keys.length === 0) {
      return {
        totalUsers: 0,
        activeWindows: 0,
        avgRequestsPerUser: 0,
        topUsers: []
      };
    }

    // Получаем все счетчики
    const counts = await redis.mget(...keys);
    const userCounts = keys.map((key, index) => ({
      userId: key.replace(RATE_LIMIT_PREFIX, ''),
      count: parseInt(counts[index] || '0')
    }));

    const totalRequests = userCounts.reduce((sum, item) => sum + item.count, 0);
    const avgRequestsPerUser = userCounts.length > 0 ? 
      Math.round(totalRequests / userCounts.length * 100) / 100 : 0;

    // Топ пользователей по количеству запросов
    const topUsers = userCounts
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalUsers: keys.length,
      activeWindows: keys.length,
      avgRequestsPerUser,
      topUsers
    };

  } catch (error) {
    logger.error('Get rate limit stats error:', error);
    return {
      totalUsers: 0,
      activeWindows: 0,
      avgRequestsPerUser: 0,
      topUsers: []
    };
  }
}

// Функция для очистки всех rate limit данных (для тестов)
export async function clearAllRateLimits(): Promise<number> {
  try {
    const keys = await redis.keys(`${RATE_LIMIT_PREFIX}*`);
    
    if (keys.length === 0) {
      return 0;
    }

    const deletedCount = await redis.del(...keys);
    logger.info(`Cleared ${deletedCount} rate limit entries`);
    
    return deletedCount;

  } catch (error) {
    logger.error('Clear rate limits error:', error);
    return 0;
  }
}

// Graceful shutdown для Redis
process.on('SIGINT', async () => {
  try {
    await redis.quit();
    logger.info('Redis connection closed');
  } catch (error) {
    logger.error('Error closing Redis connection:', error);
  }
});

process.on('SIGTERM', async () => {
  try {
    await redis.quit();
    logger.info('Redis connection closed');
  } catch (error) {
    logger.error('Error closing Redis connection:', error);
  }
});

// Экспорт Redis клиента для использования в других частях приложения
export { redis };

export default rateLimitMiddleware;