# Сессия 2026-05-06 — Фаза 2: Instagram API подключён

## Что сделано

### Локальный API сервер (dm-app/server/index.cjs)
- Express сервер на порту 3001
- Подключён к Instagram как @temayujin
- 24 реальных диалога загружены
- Эндпоинты: GET /api/conversations, GET /api/conversations/:id/messages, POST /api/conversations/:id/send, PATCH /api/conversations/:id/status

### React (dm-app/src/)
- `api.ts` — клиент для локального сервера
- `Inbox.tsx` — показывает реальные диалоги, поллинг каждые 15с, badge "live/demo"
- `Dialog.tsx` — загружает реальные сообщения, отправка через API, время в читаемом формате

### Что ещё не починено (начать с этого!)
1. Диалоги не открываются по клику (fix уже написан — убрана зависимость от serverOnline, нужно проверить после перезапуска)
2. Панель Claude выглядит не так как надо — нужен скриншот от пользователя
3. Имена пользователей показываются как ID (ограничение Meta API — без дополнительных permissions)

## Как запустить в следующей сессии

```bash
# Терминал 1 — API сервер
cd ~/Projects/toward-perfection/instagram-bot/dm-app
npm run server

# Терминал 2 — Tauri приложение  
cd ~/Projects/toward-perfection/instagram-bot/dm-app
source ~/.cargo/env
cargo tauri dev
```

## Статус компонентов

| Компонент | Статус |
|-----------|--------|
| ActivityBar | ✅ работает |
| TabBar | ✅ работает |
| Inbox | ✅ реальные данные |
| Dialog | ⚠️ открытие нужно проверить |
| SuggestionsPanel | ⚠️ вид нужно проверить (скриншот) |
| ResizeHandle | ✅ работает |
| API сервер | ✅ онлайн, @temayujin |
