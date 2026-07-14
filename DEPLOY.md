# Growth Dashboard — Инструкция по запуску

Время: ~1.5 часа. Опыт с Vercel/Supabase не нужен.

---

## ШАГ 1: Supabase (база данных) — 20 мин

### 1.1 Создать аккаунт
1. Зайди на https://supabase.com → **Start your project** → войди через GitHub или email
2. Нажми **New Project**
3. Заполни:
   - Name: `growth-dashboard`
   - Database Password: придумай и **запиши** (понадобится)
   - Region: **Frankfurt (eu-central-1)** (ближе к Израилю)
4. Жди ~2 минуты пока создастся

### 1.2 Запустить SQL (создать таблицы)
1. В левом меню нажми **SQL Editor** (иконка с `>_`)
2. Нажми **New Query**
3. Открой файл `supabase-schema.sql` из этого проекта
4. Скопируй ВСЁ содержимое → вставь в SQL Editor
5. Нажми **Run** (зелёная кнопка)
6. Должно написать "Success" — таблицы созданы

### 1.3 Создать пользователей
1. В левом меню → **Authentication** → **Users**
2. Нажми **Add User** → **Create new user**
3. Создай 3 пользователей:

| Email | Password | (потом в БД выставить role) |
|-------|----------|---------------------------|
| alex@levhaolam.com | (придумай) | admin |
| ivan@levhaolam.com | (придумай) | editor |
| olga@levhaolam.com | (придумай) | editor |

4. После создания зайди в **Table Editor** → таблица `profiles`
5. Для каждого юзера укажи: name и role (`admin` или `editor`)

### 1.4 Скопировать ключи
1. В левом меню → **Settings** (шестерёнка внизу) → **API**
2. Скопируй и запиши:
   - **Project URL** — выглядит как `https://xxxxx.supabase.co`
   - **anon public key** — длинная строка `eyJhbGci...`

---

## ШАГ 2: Настроить проект локально — 15 мин

### 2.1 Установить Node.js (если нет)
1. Зайди на https://nodejs.org → скачай **LTS** версию → установи
2. Проверь: открой терминал, напиши `node --version` → должно показать v18+

### 2.2 Создать проект
Открой терминал и выполни:

```bash
# Создать папку и перейти в неё
mkdir growth-dashboard
cd growth-dashboard

# Скопировать ВСЕ файлы из этого архива в эту папку
# (package.json, vite.config.js, index.html, src/ и т.д.)

# Установить зависимости
npm install
```

### 2.3 Добавить ключи Supabase
1. Создай файл `.env` в корне проекта (рядом с package.json)
2. Вставь туда:

```
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...тут_твой_ключ...
```

3. Замени на свои значения из Шага 1.4

### 2.4 Запустить локально
```bash
npm run dev
```
Откроется http://localhost:5173 → увидишь дашборд → залогинься

---

## ШАГ 3: Vercel (хостинг) — 15 мин

### 3.1 Залить код на GitHub
1. Зайди на https://github.com → создай аккаунт (если нет)
2. Нажми **New repository** → Name: `growth-dashboard` → **Create**
3. В терминале:

```bash
git init
git add .
git commit -m "initial"
git branch -M main
git remote add origin https://github.com/ТВОЙ_ЮЗЕРНЕЙМ/growth-dashboard.git
git push -u origin main
```

### 3.2 Задеплоить на Vercel
1. Зайди на https://vercel.com → войди через GitHub
2. Нажми **Add New → Project**
3. Выбери репозиторий `growth-dashboard`
4. В **Environment Variables** добавь:
   - `VITE_SUPABASE_URL` = твой URL
   - `VITE_SUPABASE_ANON_KEY` = твой ключ
5. Нажми **Deploy**
6. Через ~1 мин получишь URL вида `growth-dashboard-xxx.vercel.app`

**Готово.** Этот URL можно открыть на любом устройстве.

---

## ШАГ 4: Проверить

1. Открой URL → экран логина
2. Введи email/password одного из юзеров
3. Увидишь дашборд с данными
4. Проверь: вкладки Обзор / Проекты / Тренды
5. Перейди в Проекты → добавь комментарий
6. Если ты admin — зайди в Настройки

---

## Если что-то не работает

| Проблема | Решение |
|----------|---------|
| "Invalid API key" | Проверь .env файл — ключи без кавычек, без пробелов |
| "401 Unauthorized" | В Supabase → Authentication → Settings → убери подтверждение email |
| Пустой экран | В терминале npm run dev → посмотри ошибки |
| Vercel 500 ошибка | Проверь Environment Variables в настройках проекта |

---

## Файлы проекта

```
growth-dashboard/
├── .env                    ← твои ключи (НЕ коммитить в git!)
├── .gitignore
├── index.html
├── package.json
├── vite.config.js
├── supabase-schema.sql     ← запустить в Supabase SQL Editor
└── src/
    ├── lib/
    │   └── supabase.js     ← клиент Supabase
    └── App.jsx             ← всё приложение
```
