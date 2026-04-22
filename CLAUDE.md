# Instagram Bot — CLAUDE.md

> **Правило обслуживания:** После каждого изменения кода обновить этот файл и memory.
> После каждой новой фичи, фикса или решения — внести в соответствующий раздел.

---

## Быстрый старт

```bash
node --check index.js          # всегда первым делом
git add index.js && git commit -m "..." && git push origin main
curl -s https://web-production-6ed0b.up.railway.app/health | python3 -m json.tool
```

---

## Что это

Telegram mini-CRM для Instagram DM. Тренер получает сообщения от клиентов в Instagram — бот показывает их в одном Telegram-сообщении (редактируется на месте, не спамит), Claude генерирует 3 варианта ответа, тренер выбирает/редактирует/подтверждает, бот отправляет.

**Stack:** Node.js + Express + Anthropic SDK + Telegram Bot API + Instagram Graph API → Railway

---

## Карта функций `index.js`

### Инфраструктура
| Строка | Функция | Что делает |
|--------|---------|-----------|
| 32 | `isDuplicateSend` | блок дублей (10 сек окно) |
| 40 | `resolveSelfIds` | получает реальный IG ID при старте |
| 63 | `loadBotState` | читает ID Telegram UI-сообщения |
| 70 | `saveBotState` | сохраняет ID |

### Данные (conversations.json)
| Строка | Функция | Что делает |
|--------|---------|-----------|
| 114 | `loadConversations` | in-memory кэш → файл при cold start |
| 138 | `saveConversations` | кэш + файл |
| 147 | `appendMessage` | добавляет сообщение в тред |
| 159 | `updateProfile` | имя/username пользователя |
| 167 | `setStatus` | New / Replied / Client / Ignored |
| 174 | `getHistory` | последние N сообщений |
| 185 | `getRecentSenders` | список для Inbox (только с incoming) |

### Уведомления
| Строка | Функция | Что делает |
|--------|---------|-----------|
| 80 | `addNotification` | очередь уведомлений |
| 87 | `removeNotification` | убирает уведомление |
| 92 | `applyNotifications` | оверлей поверх текущего экрана |

### Instagram API
| Строка | Функция | Что делает |
|--------|---------|-----------|
| 228 | `getInstagramUser` | имя и username по ID |
| 240 | `sendInstagramMessage` | отправка DM |

### Claude / Style
| Строка | Функция | Что делает |
|--------|---------|-----------|
| 284 | `loadStyleProfile` | кэш style_profile.json |
| 296 | `saveStyleExample` | сохраняет одобренное сообщение |
| 336 | `analyzeStyle` | avg слов, % вопросов, % коротких |
| 347 | `computeStyleMatch` | % соответствия стилю |
| 362 | `generateSuggestions` | 3 варианта с style-данными, retry < 50% |

### Telegram UI
| Строка | Функция | Что делает |
|--------|---------|-----------|
| 445 | `sendRawMessage` | создаёт новое сообщение (только при init) |
| 457 | `getOrCreateUIMessage` | ID единственного UI-сообщения |
| 467 | `pushEdit` | raw editMessageText |
| 490 | `editUIMessage` | edit + apply notifications + store content |
| 498 | `refreshUIWithNotifications` | обновить UI без смены экрана |

### Экраны
| Строка | Функция | Экран |
|--------|---------|-------|
| 525 | `showInbox` | 📥 список бесед |
| 551 | `showDialog` | 👤 диалог + генерация suggestions |
| 593 | `renderDialog` | 👤 диалог без генерации (быстро) |
| 646 | `showConfirm` | подтверждение перед отправкой |
| 665 | `showSentMessages` | 📜 последние 20 исходящих |
| 681 | `showCustomReply` | ✍️ ввод своего текста |

### Роуты
| Строка | Роут | Назначение |
|--------|------|-----------|
| 695 | `GET /health` | статус всех сервисов |
| 731 | `GET /debug-token` | IG токен и permissions |
| 748 | `GET /test-claude` | тест генерации suggestions |
| 757 | `GET /test-telegram` | тест Telegram |
| 775 | `GET /webhook` | верификация Meta |
| 788 | `POST /webhook` | входящие IG события |
| 881 | `POST /telegram` | кнопки и сообщения от тренера |

---

## Критические правила

```
AUTO_SEND = false          → всегда, без исключений
resolvedSelfIds            → используй, не PAGE_ID (он не задан в .env)
conversationsCache         → источник истины, не файл
editUIMessage()            → единственный способ обновить UI
confirm_send → renderDialog (не showDialog — он запускает Claude)
```

### Что НЕЛЬЗЯ делать
- Отправлять сообщения без `confirm_send`
- Создавать новые Telegram-сообщения для UI (только edit)
- Читать файл на каждый запрос (только кэш)
- Создавать беседы только с исходящими сообщениями
- Генерировать suggestions когда `lastMessage.type === 'outgoing'`

---

## Структура данных

### conversations.json
```json
{
  "sender_id": {
    "profile": { "name": "...", "username": "...", "status": "New" },
    "messages": [
      { "type": "incoming", "text": "...", "time": "ISO" },
      { "type": "outgoing", "text": "...", "time": "ISO" }
    ]
  }
}
```

### style_profile.json
```json
{ "examples": [{ "text": "...", "time": "ISO" }] }
```
Хранит последние 50 одобренных сообщений. Используется в `generateSuggestions`.

---

## Callback data
```
inbox | dialog_<id> | send_<0-2> | edit_<0-2> | custom
mark_client | followup | ignore_conv | view_sent_<id>
open_notif_<id> | ignore_notif_<id> | confirm_send
```

---

## Статусы бесед
```
New → Replied (авто после confirm_send)
Any → Client (кнопка Mark as Client)
Any → Ignored (кнопка Ignore)
Ignored → New (авто когда пишет снова)
```

---

## Env-переменные
| Переменная | Значение / назначение |
|-----------|----------------------|
| `PAGE_ACCESS_TOKEN` | IGAA... (long-lived Instagram token) |
| `BUSINESS_ACCOUNT_ID` | `17841400228014487` |
| `PAGE_ID` | не задан — ID `34828458240135295` подтягивается через API |
| `TELEGRAM_TOKEN` | токен бота |
| `CHAT_ID` | `784663861` (Yujin) |
| `VERIFY_TOKEN` | `my_secret_token_123` |
| `ANTHROPIC_API_KEY` | sk-ant-... |
| `RAILWAY_URL` | `https://web-production-6ed0b.up.railway.app` |

---

## Протокол обновления этого файла

**После добавления новой функции:**
→ добавить строку в таблицу "Карта функций"

**После добавления нового callback:**
→ добавить в раздел "Callback data"

**После изменения критического правила:**
→ обновить раздел "Критические правила"

**После изменения структуры данных:**
→ обновить раздел "Структура данных"

**После любого важного решения:**
→ обновить `memory/feedback_patterns.md`
