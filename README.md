# Instagram DM Bot

Бот получает сообщения из Instagram DM и отвечает автоматически.

## Установка

```bash
cd ~/instagram-bot
pnpm install
```

## Настройка

1. Скопируй `.env.example` в `.env`
2. Заполни PAGE_ACCESS_TOKEN из Meta Developer
3. Убедись что ngrok запущен

## Запуск

**Терминал 1 — сервер:**
```bash
cd ~/instagram-bot && node index.js
```

**Терминал 2 — ngrok:**
```bash
~/bin/ngrok http 3000
```

## Статус

- ✅ Webhook подтверждён (GET /webhook)
- ✅ Сообщения принимаются (POST /webhook)
- ✅ Первое сообщение получено: "Handstand"
- ⏳ Отправка ответов — в процессе

## Структура

```
instagram-bot/
├── index.js           # Главный сервер
├── package.json       # Зависимости
├── .env.example       # Пример конфига
└── README.md          # Этот файл
```

## ngrok URL

Текущий: `https://operate-rust-dreary.ngrok-free.dev`

Meta Webhook Callback: `https://operate-rust-dreary.ngrok-free.dev/webhook`

Verify Token: `my_secret_token_123`
