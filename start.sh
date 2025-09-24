#!/bin/bash

# start.sh - Скрипт быстрого запуска PR GRAM Bot

set -e

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Функция для красивого вывода
print_step() {
    echo -e "${BLUE}==>${NC} ${1}"
}

print_success() {
    echo -e "${GREEN}✓${NC} ${1}"
}

print_error() {
    echo -e "${RED}✗${NC} ${1}"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} ${1}"
}

# Проверка зависимостей
check_dependencies() {
    print_step "Проверка зависимостей..."
    
    # Проверка Node.js
    if ! command -v node &> /dev/null; then
        print_error "Node.js не установлен. Установите Node.js 18+ и попробуйте снова."
        exit 1
    fi
    
    NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 18 ]; then
        print_error "Требуется Node.js версии 18 или выше. Текущая версия: $(node --version)"
        exit 1
    fi
    
    # Проверка npm
    if ! command -v npm &> /dev/null; then
        print_error "npm не найден. Установите npm и попробуйте снова."
        exit 1
    fi
    
    # Проверка Docker
    if ! command -v docker &> /dev/null; then
        print_warning "Docker не найден. Будет использоваться локальная БД."
        USE_DOCKER=false
    else
        USE_DOCKER=true
    fi
    
    # Проверка Docker Compose
    if [ "$USE_DOCKER" = true ] && ! command -v docker-compose &> /dev/null; then
        print_warning "docker-compose не найден. Будет использоваться локальная БД."
        USE_DOCKER=false
    fi
    
    print_success "Зависимости проверены"
}

# Установка пакетов
install_packages() {
    print_step "Установка пакетов..."
    
    if [ ! -d "node_modules" ]; then
        npm install
        print_success "Пакеты установлены"
    else
        print_success "Пакеты уже установлены"
    fi
}

# Создание .env файла
setup_env() {
    print_step "Настройка переменных окружения..."
    
    if [ ! -f ".env" ]; then
        cp .env.example .env
        print_success "Создан .env файл из примера"
        print_warning "Не забудьте настроить переменные в .env файле!"
    else
        print_success ".env файл уже существует"
    fi
}

# Создание директорий
create_directories() {
    print_step "Создание необходимых директорий..."
    
    mkdir -p logs
    mkdir -p uploads/screenshots
    mkdir -p uploads/checks
    mkdir -p backups
    
    print_success "Директории созданы"
}

# Запуск баз данных
start_databases() {
    if [ "$USE_DOCKER" = true ]; then
        print_step "Запуск баз данных через Docker..."
        
        # Проверка, запущены ли уже контейнеры
        if docker-compose ps | grep -q "postgres.*Up" && docker-compose ps | grep -q "redis.*Up"; then
            print_success "Базы данных уже запущены"
        else
            docker-compose up -d postgres redis
            print_success "Базы данных запущены"
            
            # Ждем запуска PostgreSQL
            print_step "Ожидание запуска PostgreSQL..."
            sleep 5
            
            # Проверка подключения к PostgreSQL
            for i in {1..30}; do
                if docker-compose exec -T postgres pg_isready -U postgres > /dev/null 2>&1; then
                    print_success "PostgreSQL готов к работе"
                    break
                fi
                
                if [ $i -eq 30 ]; then
                    print_error "Не удалось подключиться к PostgreSQL"
                    exit 1
                fi
                
                sleep 1
            done
        fi
    else
        print_warning "Убедитесь, что PostgreSQL и Redis запущены локально"
    fi
}

# Выполнение миграций
run_migrations() {
    print_step "Выполнение миграций базы данных..."
    
    # Если используем Docker, применяем init.sql
    if [ "$USE_DOCKER" = true ]; then
        if docker-compose exec -T postgres psql -U postgres -d prgram_bot -c "\dt" > /dev/null 2>&1; then
            print_success "База данных уже инициализирована"
        else
            print_step "Инициализация базы данных..."
            docker-compose exec -T postgres psql -U postgres -d prgram_bot < init.sql
            print_success "База данных инициализирована"
        fi
    fi
}

# Выбор режима запуска
choose_mode() {
    echo -e "\n${BLUE}Выберите режим запуска:${NC}"
    echo "1) Development (с hot reload)"
    echo "2) Production (собранная версия)"
    echo "3) Docker (в контейнере)"
    echo "4) Только настройка (не запускать)"
    
    read -p "Ваш выбор [1-4]: " choice
    
    case $choice in
        1)
            MODE="development"
            ;;
        2)
            MODE="production"
            ;;
        3)
            MODE="docker"
            ;;
        4)
            MODE="setup"
            ;;
        *)
            print_warning "Неверный выбор, используется режим разработки"
            MODE="development"
            ;;
    esac
}

# Запуск приложения
start_app() {
    case $MODE in
        "development")
            print_step "Запуск в режиме разработки..."
            npm run dev
            ;;
        "production")
            print_step "Сборка проекта..."
            npm run build
            print_step "Запуск в production режиме..."
            npm start
            ;;
        "docker")
            print_step "Запуск в Docker контейнере..."
            docker-compose --profile production up -d
            print_success "Приложение запущено в Docker"
            print_step "Просмотр логов:"
            docker-compose logs -f bot
            ;;
        "setup")
            print_success "Настройка завершена!"
            print_step "Для запуска используйте:"
            echo "  npm run dev    - режим разработки"
            echo "  npm start      - production режим"
            echo "  make docker-up - Docker режим"
            ;;
    esac
}

# Главная функция
main() {
    echo -e "${GREEN}"
    echo "██████╗ ██████╗      ██████╗ ██████╗  █████╗ ███╗   ███╗"
    echo "██╔══██╗██╔══██╗    ██╔════╝ ██╔══██╗██╔══██╗████╗ ████║"
    echo "██████╔╝██████╔╝    ██║  ███╗██████╔╝███████║██╔████╔██║"
    echo "██╔═══╝ ██╔══██╗    ██║   ██║██╔══██╗██╔══██║██║╚██╔╝██║"
    echo "██║     ██║  ██║    ╚██████╔╝██║  ██║██║  ██║██║ ╚═╝ ██║"
    echo "╚═╝     ╚═╝  ╚═╝     ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝     ╚═╝"
    echo -e "${NC}"
    echo -e "${BLUE}Telegram Bot для взаимного продвижения${NC}\n"
    
    check_dependencies
    install_packages
    setup_env
    create_directories
    start_databases
    run_migrations
    choose_mode
    start_app
}

# Обработка прерывания
trap 'print_error "Установка прервана"; exit 1' INT

# Запуск
main "$@"