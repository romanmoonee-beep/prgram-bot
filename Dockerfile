# Dockerfile
FROM node:18-alpine

# Установка системных зависимостей
RUN apk add --no-cache \
    postgresql-client \
    curl \
    tzdata

# Установка timezone
ENV TZ=Europe/Moscow
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

# Создание пользователя для безопасности
RUN addgroup -g 1001 -S nodejs && \
    adduser -S prgram -u 1001

# Создание рабочей директории
WORKDIR /app

# Копирование package файлов
COPY package*.json ./
COPY tsconfig.json ./

# Установка зависимостей
RUN npm ci --only=production && npm cache clean --force

# Копирование исходного кода
COPY src ./src

# Компиляция TypeScript
RUN npm run build

# Создание необходимых директорий
RUN mkdir -p /app/uploads /app/logs && \
    chown -R prgram:nodejs /app

# Переключение на пользователя prgram
USER prgram

# Expose порт
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Запуск приложения
CMD ["node", "dist/app.js"]