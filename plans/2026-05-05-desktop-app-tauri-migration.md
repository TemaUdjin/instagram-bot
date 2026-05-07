# Desktop App — Переход на Tauri

**Статус:** Готово к реализации  
**Контекст:** Начали с Electron, обнаружили что macOS 26.4.1 несовместима с Electron из npm (process.type=undefined, нативные модули не инициализируются). Решение — Tauri.

---

## Почему Tauri, а не Electron

- macOS 26 (Darwin 25.4.0) ломает Electron из npm — нативные биндинги не инициализируются
- Tauri использует системный WebKit (WKWebView) — всегда совместим с macOS
- Тот же React UI, ничего переписывать не надо
- Весит 5-10 MB vs 150 MB у Electron

---

## Что уже готово (НЕ УДАЛЯТЬ)

Папка `desktop-app/src/renderer/src/` содержит готовый React UI:
- `App.tsx` — главный компонент, три колонки, переключатель темы
- `components/Titlebar.tsx` — titlebar с переключателем день/ночь
- `components/Inbox.tsx` — список диалогов с цветовыми статусами
- `components/Dialog.tsx` — окно переписки с полем ввода
- `components/SuggestionsPanel.tsx` — 3 варианта от Claude
- `components/Icons.tsx` — SVG иконки
- `assets/main.css` — дизайн-система (токены сайта: #0a0a0a, #c8a96e, Geist)

Это ВСЁ переезжает в Tauri без изменений.

---

## Что выбрасываем из desktop-app/

- `src/main/` — Electron main process (заменяется на Tauri src-tauri/)
- `src/preload/` — Electron preload (не нужен в Tauri)
- `electron.vite.config.ts` — заменяется на vite.config.ts
- `tsconfig.node.json`, `tsconfig.web.json` — упрощаем до одного tsconfig.json

---

## План перехода на Tauri (следующая сессия)

### Шаг 1 — Установить зависимости (если не сделано)
```bash
# Rust (если не установлен)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
source ~/.cargo/env

# Tauri CLI
cargo install tauri-cli --version "^2"

# Проверка
cargo tauri --version
```

### Шаг 2 — Создать новый Tauri проект
```bash
cd /Users/yujin/Projects/toward-perfection/instagram-bot
npm create tauri-app@latest dm-app -- --template react-ts --manager npm --no-open
cd dm-app
npm install
```

### Шаг 3 — Перенести UI
```bash
# Скопировать готовые компоненты
cp -r ../desktop-app/src/renderer/src/components src/
cp -r ../desktop-app/src/renderer/src/assets src/
cp ../desktop-app/src/renderer/src/App.tsx src/
cp ../desktop-app/src/renderer/src/main.tsx src/
```

### Шаг 4 — Настроить Tauri window (src-tauri/tauri.conf.json)
```json
{
  "app": {
    "windows": [{
      "title": "Toward Perfection DM",
      "width": 1280,
      "height": 800,
      "minWidth": 900,
      "minHeight": 600,
      "decorations": false,
      "titleBarStyle": "Overlay"
    }]
  }
}
```

### Шаг 5 — Добавить Tailwind v4 + Geist
```bash
npm install tailwindcss @tailwindcss/vite @fontsource-variable/geist
```
Добавить в `vite.config.ts`:
```ts
import tailwindcss from '@tailwindcss/vite'
plugins: [tauri(), react(), tailwindcss()]
```

### Шаг 6 — Запустить и проверить
```bash
cargo tauri dev
```

---

## Дизайн-система (токены из сайта — не менять)

```css
/* тёмная тема (default) */
--background: #0a0a0a
--card: #141414
--accent: #c8a96e  (золото)
--foreground: #fafafa
--border: #27272a
--muted-foreground: #888888

/* светлая тема */
--background: #ffffff
--card: #ffffff
--accent: #c8a96e
--foreground: #0a0a0a
--border: #e4e4e7
```
Шрифт: Geist Variable (@fontsource-variable/geist)

---

## Фазы разработки

Фаза 2: подключить Instagram API (перенести логику из index.js)
  - Реальные аватарки из profile_picture_url
  - Клик на username → открывает instagram.com/{username} в браузере
  - Фото из DM → <img> в диалоге
  - Видео из DM → <video> плеер прямо в диалоге
  - Кнопка «Показать Claude» на медиа → отправляет изображение в чат Claude (vision API)
Фаза 3: подключить Claude (generateSuggestions)
  - Прикрепить фото/скриншот в чат Claude → анализ через vision API
  - Claude анализирует позу/технику клиента по фото и даёт фидбэк
  - Drag & drop или кнопка 📎 для загрузки изображения
Фаза 4: импорт стиля + мульти-AI
  - Импорт ChatGPT export (JSON из Settings → Export data) → извлечь твои ответы → загрузить в style_profile (GPT API не нужен)
  - Импорт Meta archive (Instagram DM история) → тоже в style_profile
  - Панель «Стиль» (activity bar ✦): скиллы-системные промпты
    · «Преподаватель» — твоя методика, философия, стиль объяснений
    · «Продажи» — мягкое приглашение в курс
    · «Фидбэк по технике» — разбор видео/фото клиента
    · Загрузка своего .md файла со скиллом
    · Переключение скилла одним кликом
Фаза 5: хоткеи, уведомления macOS
Фаза 6: чат поддержки на сайте → появляется в приложении рядом с Instagram DM
  - WebSocket между сайтом и приложением
  - Виджет чата на сайте (маленькая кнопка в углу)
  - В Inbox новый тип канала: 💬 Сайт (рядом с 📸 Instagram)
  - Claude помогает с ответами в обоих каналах
Фаза 7: автономность
