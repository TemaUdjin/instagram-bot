# Browser Extension — TP DM Assist (Arc/Chrome)

## Задача
Расширение для Arc/Chrome, которое инжектирует hack-панель прямо в Instagram.
Решает проблему 24-часового лимита API: читает DOM страницы (не Graph API),
генерирует ответы через Claude, пользователь копирует вручную.

## Архитектура
```
Extension (Arc/Chrome)
    ↓ fetch localhost:3001
dm-app/server/index.cjs  ← тот же сервер что DM Launch
    ↓ Anthropic API
Claude с handstand-скиллом (5700 символов)

Данные extension: localStorage (templates, chatHistory)
Данные dm-app:    conversations.json, style_profile.json
→ Планируется синхронизация через сервер
```

```
browser-extension/
├── manifest.json   — MV3, host_permissions: instagram.com + localhost:3001
└── content.js      — Shadow DOM панель, все логика
```

## Сделано

- [x] Скелет расширения + manifest.json (MV3)
- [x] Shadow DOM панель — hack-тема (цвета/шрифты из dm-app, изолировано от Instagram CSS)
- [x] Страница сдвигается влево, панель не перекрывает контент
- [x] Collapse/expand кнопка (панель сворачивается в 32px полоску)
- [x] Три вкладки: suggest / chat / templates
- [x] **Suggest**: capture from page DOM + генерация 3 вариантов Claude
- [x] **Chat**: живой чат с Claude о стиле и тактике ответов
- [x] **Templates**: сохранение, копирование, удаление шаблонов (localStorage)
- [x] Кнопки copy + save template под каждым ответом Claude в чате
- [x] Endpoint `/api/claude/suggest-text` на сервере
- [x] Фильтрация системных сообщений Instagram при capture

## Roadmap — что нужно для совершенства

### Фаза 2 — Умный capture (приоритет: высокий)
- [ ] Различать входящие / исходящие сообщения при capture (сейчас всё в одну кучу)
- [ ] Авто-capture при открытии диалога (без нажатия кнопки)
- [ ] Показывать имя собеседника в панели
- [ ] Работать при SPA-навигации (сейчас нужен Cmd+R после перехода между диалогами)
- [ ] Определять язык переписки и подсказывать Claude

### Фаза 3 — Автовставка ответа (приоритет: высокий)
- [ ] Кнопка "use" вставляет текст прямо в Instagram input (через DOM inject)
- [ ] Это устранит необходимость копировать вручную — одним кликом
- [ ] Нужно найти `textarea[placeholder*="Message"]` и сделать `.focus()` + `dispatchEvent`

### Фаза 4 — Обучение стилю (приоритет: средний)
- [ ] При сохранении шаблона — отправлять в `POST /api/style/example` (сохранять в style_profile.json)
- [ ] style_profile влияет на генерацию в dm-app и в расширении одновременно
- [ ] Просмотр style_profile в панели (вкладка "style" или секция в templates)
- [ ] Кнопка "это идеальный ответ" на suggestion — сохраняет в style_profile напрямую

### Фаза 5 — Статус сервера и UX (приоритет: средний)
- [ ] Индикатор статуса сервера в заголовке (зелёная точка = online, красная = offline)
- [ ] При offline — кнопка "как запустить" с инструкцией
- [ ] Клавиатурный шорткат для toggle панели (Alt+T или похожее)
- [ ] Анимация появления сообщений в чате (печатает...)
- [ ] Панель запоминает последнюю вкладку между перезагрузками
- [ ] Регенерация suggestions (кнопка ↻ рядом с generate)
- [ ] Выбор тона ответа: casual / warm / direct / detailed

### Фаза 6 — Templates как база знаний (приоритет: низкий)
- [ ] Категории шаблонов (первый контакт / работа с возражениями / follow-up / закрытие)
- [ ] Поиск по шаблонам
- [ ] Редактирование шаблона прямо в панели
- [ ] Экспорт/импорт шаблонов (JSON)
- [ ] Синхронизация шаблонов с dm-app (единая база на сервере)

### Фаза 7 — Интеграция с dm-app (приоритет: низкий)
- [ ] Расширение видит conversations.json — знает историю переписки с этим человеком
- [ ] Показывает статус клиента (New / Replied / Client) из dm-app
- [ ] Кнопка "добавить в клиенты" из расширения — пишет в conversations.json

## Установка (Arc)

1. Запустить `DM Launch.command` (поднимает сервер на localhost:3001)
2. Arc → `arc://extensions` → Developer mode ON
3. "Load unpacked" → папка `instagram-bot/browser-extension/`
4. Открыть `instagram.com/direct/` — панель появится справа

## Как пользоваться

**Suggest (для Requests — без 24ч лимита):**
1. Открыть любой диалог в Instagram (Primary / General / Requests)
2. Нажать "📸 capture" → текст переписки появится в поле
3. "▶ generate" → 3 варианта от Claude
4. "copy" → вставить вручную в Instagram

**Chat:**
1. Открыть диалог, нажать capture
2. Перейти в чат, написать "как мне ответить этому человеку?"
3. Claude предложит вариант — нажать copy или save template

**Templates:**
1. Сохранять хорошие ответы из чата кнопкой "save template"
2. Клик по шаблону — копирует в буфер, вставляешь в Instagram
