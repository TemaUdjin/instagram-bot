# Сессия 2026-05-06 (день) — Claude живой + Instagram API

## Задача
Подключить реальный Claude API, починить отправку сообщений, фильтры inbox.

## Что сделано

### Claude API — работает
- Endpoint `/api/claude/suggest` — генерирует 3 варианта на основе реальной переписки
- Endpoint `/api/claude/chat` — живой чат с Claude, принимает историю разговора и коррекции
- Endpoint `/api/claude/skill` — хранит системный промпт тренера
- Парсинг JSON без markdown-мусора (`extractSuggestions`)
- Скилл по умолчанию: только английский, без тире, стиль тренера

### Inbox фильтры — заменили папки Instagram
- Было: Primary / General / Requests (не работало — Meta API не поддерживает)
- Стало: Все / Новые / Отвечено / Клиенты (наши собственные фильтры, работают)

### Отправка сообщений
- "Подтвердить и отправить" → реально отправляет в Instagram
- После отправки: refreshKey меняется → Dialog перезагружает сообщения
- Исправлена синхронизация кэшей (folderCache + conversationsCache)
- Отправленное сообщение добавляется в ОБА кэша

### Мелкие фиксы
- `data-tauri-drag-region` + `core:window:allow-start-dragging` → окно перетаскивается
- Пустые пузыри → показывают "📎 Вложение" или "🎤 Голосовое"
- Авто-скролл вниз при загрузке/отправке сообщений
- Непрочитанные помечаются прочитанными при открытии диалога

## Что НЕ доделано (начать с этого)

### Критично
1. **Отправленное сообщение не всегда появляется в чате** — возможно timing issue между server update и client refresh. Нужно проверить и добавить оптимистичное обновление (добавить сразу в local state без ждать API)

2. **Аватарки** — Meta API не отдаёт profile_picture_url без доп. разрешений. Пока буква аватара.

### Хорошо бы
3. **StylePanel** (✦ иконка) — создана, показывает промпт, но не тестировалась
4. **"Клиент"/"Отвечено" статусы** — кнопки есть но не обновляются в inbox при смене
5. **Реальное время ответа** — сейчас показывает время последнего incoming, не всегда корректно

## Как запустить

```bash
# Терминал 1 — сервер
cd ~/Projects/toward-perfection/instagram-bot/dm-app
npm run server   # node server/index.cjs

# Терминал 2 — приложение
cd ~/Projects/toward-perfection/instagram-bot/dm-app
source ~/.cargo/env && cargo tauri dev
```

## Ключевые файлы
- `server/index.cjs` — Instagram API + Claude API + кэши
- `src/components/SuggestionsPanel.tsx` — живой чат с Claude
- `src/components/Dialog.tsx` — переписка + кнопка "Спросить Claude"
- `src/components/Inbox.tsx` — фильтры, список диалогов
- `src/components/StylePanel.tsx` — промпт/скилл для Claude
- `src/App.tsx` — оркестрация, claudeTrigger, refreshKey
