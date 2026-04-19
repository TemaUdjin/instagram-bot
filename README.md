# Instagram DM Bot — Production Ready для Railway

Бот получает сообщения из Instagram DM и автоматически отвечает.

## Установка на Railway

1. Создай аккаунт на [railway.app](https://railway.app)
2. Подключи свой GitHub репозиторий
3. Railway автоматически развернёт бота

**Или через CLI:**
```bash
npm install -g @railway/cli
railway login
railway init
railway up
```

## Environment переменные

На Railway добавь эти переменные (в Project Settings → Variables):

```
PAGE_ACCESS_TOKEN=твой_токен
VERIFY_TOKEN=my_secret_token_123
BUSINESS_ACCOUNT_ID=17841400228014487
```

## Meta Developer настройка

В Meta Developer обнови Webhook:

**Callback URL:** `https://твой-railway-домен/webhook`

Railway автоматически сгенерирует тебе домен вида: `instagram-bot-production.up.railway.app`

## Статус

✅ Node.js server  
✅ Express webhook  
✅ Instagram messages API integration  
✅ Auto-reply "hello"  

## Дальше

- Изменить текст ответа
- Добавить БД для логирования
- Интегрировать с другими сервисами

## Файлы проекта

```
instagram-bot/
├── index.js           # Основной код
├── package.json       # Зависимости
├── .env               # Секретные данные (локальные)
├── .env.example       # Шаблон (не содержит секретов)
├── Procfile           # Инструкция для Railway
├── README.md          # Этот файл
└── .gitignore         # Исключить .env из Git
```

## Первый запуск

После развертывания на Railway:

1. Обнови Webhook URL в Meta Developer
2. Напиши тестовое сообщение в DM
3. Бот должен ответить "hello"

Всё! 🚀
