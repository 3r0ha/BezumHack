# Seamless — Единая платформа для проектной разработки

> Решение кейса от **Astro Technologies** для компании N.  
> Репозиторий: запуск через `docker-compose up -d`

---

## Архитектура

```
gateway (nginx) → frontend (Next.js 14)
                → auth-service       (Node/Express + PostgreSQL)
                → projects-service   (Node/Express + PostgreSQL)
                → chat-service       (Node/Express + Socket.IO + PostgreSQL)
                → ai-service         (Python/FastAPI)
                → notifications-service (Node/Express + Socket.IO + Redis pub/sub)
```

---

## Сущности и связи

### Базовые

| Сущность | Описание |
|----------|----------|
| **Project** | Проект — верхний уровень пайплайна. Содержит эпохи, задачи, документы, встречи, релизы. |
| **Epoch** | Спринт. Объединяет задачи, документы, встречи и завершается релизом. Статус автоматически вычисляется из задач (`PLANNED → ACTIVE → COMPLETED`). |
| **Task** | Задача. Привязана к проекту и опционально к эпохе. Содержит `gitBranch`, `prNumber`, `prStatus` для CI/CD интеграции. |
| **Document** | Документ с версионированием, ролевым доступом и привязкой к задачам/эпохам/встречам. |
| **Meeting** | Встреча. Поддерживает двустороннее согласование слотов, запись, транскрипцию и AI-суммаризацию. |
| **Release** | Релиз — финальное событие эпохи. Привязан к git-тегу. |

### Роли и доступ

| Роль | Доступ |
|------|--------|
| **MANAGER** | Полный доступ ко всем проектам, документам любой видимости, встречам, утверждению документов. |
| **DEVELOPER** | Доступ к своим проектам, документам с видимостью `PUBLIC` и `TEAM`, задачам, встречам. |
| **CLIENT** | Доступ только к своему проекту, только к документам с видимостью `PUBLIC`. |

### Видимость документов (Docs-core)

```
PUBLIC         → все участники проекта (включая заказчика)
TEAM           → менеджеры + разработчики (без заказчика)
MANAGERS_ONLY  → только менеджеры
```

Пример: общие бизнес-требования к эпохе → `PUBLIC`.  
Техническое описание задачи → `TEAM`.  
Внутренние финансовые договорённости → `MANAGERS_ONLY`.

---

## Docs-core — Документация

### Функции
- **Иерархия**: документы группируются по эпохам или стоят отдельно в рамках проекта
- **Версионирование**: каждое сохранение создаёт новую версию с `changelog`. История версий хранится полностью.
- **Статусы**: `DRAFT → PENDING_REVIEW → APPROVED → ARCHIVED` с уведомлениями
- **Утверждение**: только менеджер может перевести документ в `APPROVED`
- **Inline-виджеты задач**: в документе отображается live-статус всех привязанных задач (с цитированием)
- **Привязка к встречам**: версия документа может быть помечена как созданная по итогам конкретной встречи (автоматически подтягивается суммаризация)

### API

```
GET    /api/projects/documents/project/:projectId   — список (с фильтром по эпохе, статусу, роли)
POST   /api/projects/documents                       — создать (+ первая версия)
GET    /api/projects/documents/:id                   — документ со всеми версиями и ссылками
PATCH  /api/projects/documents/:id                   — обновить (+ новая версия с changelog)
GET    /api/projects/documents/:id/versions          — история версий
GET    /api/projects/documents/:id/versions/:v       — конкретная версия
POST   /api/projects/documents/:id/task-refs         — привязать задачу (с цитатой)
DELETE /api/projects/documents/:id/task-refs/:taskId — отвязать задачу
POST   /api/projects/documents/:id/approve           — утвердить (MANAGER only)
```

---

## Kanban-core — Управление задачами

### Улучшения встреч

**Двустороннее согласование слотов:**
1. Организатор создаёт встречу и предлагает несколько временных слотов
2. Каждый участник получает уведомление и голосует за удобные слоты
3. Система автоматически выбирает ближайший слот, где все проголосовали
4. Встреча переходит в `SCHEDULED` и у всех участников появляется уведомление

**Автоматическая суммаризация встреч:**
1. После встречи транскрипция прикрепляется (через Nextcloud Talk API или вручную)
2. Вызывается `POST /api/projects/meetings/:id/summarize`
3. AI-сервис (`/api/ai/summarize/meeting`) формирует: краткое резюме, принятые решения, action items, открытые вопросы
4. Суммаризация прикрепляется к встрече и ко всем связанным документам

### Создание встречи из задачи

Встреча автоматически наследует:
- Задачу (`taskId`) → участников задачи
- Эпоху (`epochId`) → контекст спринта
- Документы (`documentIds`) → релевантная документация

### API

```
GET    /api/projects/meetings/project/:projectId   — список встреч
POST   /api/projects/meetings                       — создать (с слотами или конкретным временем)
GET    /api/projects/meetings/:id                   — детали встречи
POST   /api/projects/meetings/:id/vote              — проголосовать за слот
PATCH  /api/projects/meetings/:id                   — обновить (статус, запись, транскрипция)
POST   /api/projects/meetings/:id/summarize         — AI-суммаризация транскрипции
POST   /api/projects/meetings/:id/documents         — привязать документ
```

---

## Эпохи (Спринты)

```
GET    /api/projects/epochs/project/:projectId   — список эпох с прогрессом
POST   /api/projects/epochs                       — создать эпоху
GET    /api/projects/epochs/:id                   — детали (задачи, документы, встречи, релизы)
PATCH  /api/projects/epochs/:id                   — обновить
POST   /api/projects/epochs/:id/sync-status       — автовычислить статус из задач
```

---

## CI/CD-core — Интеграция с разработкой

### Связь PR → задача

Поддерживается интеграция с **GitLab** (MR webhook) и **GitHub** (PR webhook):

```
POST /api/cicd/webhook   — принимает webhook от GitLab/GitHub
```

**Алгоритм:**
1. Из webhook извлекается `prNumber` или `branchName`
2. Ищется задача с совпадающим `prNumber` или `gitBranch`
3. Статус PR маппируется на статус задачи: `OPEN → REVIEW`, `MERGED → DONE`, `CLOSED → TODO`
4. Задача обновляется + уведомление исполнителю

**Настройка задачи:**
```json
{
  "gitBranch": "feat/TASK-abc123",
  "prNumber": "42"
}
```

**Git тег → Релиз:**
При push тега в GitLab/GitHub — релиз с совпадающим `gitTag` автоматически переходит в `PUBLISHED`.

---

## Взаимные интеграции

### Docs ↔ Kanban
- Задача видит все привязанные документы с live-статусом (`GET /api/projects/tasks/:id/documents`)
- Документ видит все задачи с live-статусом (inline-виджет)
- При изменении статуса документа на `PENDING_REVIEW` → уведомление исполнителям привязанных задач
- Цитирование: при привязке задачи к документу можно выделить конкретный текст (цитату)

### Docs ↔ CI/CD
- Документ привязывается к задаче (мануально или автоматически по упоминанию)
- Версия документа может ссылаться на `meetingId` (встречу, по итогам которой была принята правка)

### Kanban ↔ CI/CD
- При изменении PR → задача обновляется автоматически без ручного вмешательства
- Задача хранит `gitBranch`, `prNumber`, `prStatus`

### Общие — Уведомления
Единая система уведомлений (Redis pub/sub → WebSocket) охватывает:

| Событие | Тип |
|---------|-----|
| Назначение задачи | `TASK_ASSIGNED` |
| Смена статуса задачи | `TASK_STATUS_CHANGED` |
| Разблокировка задачи | `BLOCKER_RESOLVED` |
| Документ отправлен на проверку | `DOCUMENT_REVIEW_REQUESTED` |
| Документ привязан к задаче | `DOCUMENT_LINKED` |
| Приглашение на встречу | `MEETING_INVITED` |
| Встреча согласована (слоты) | `MEETING_SCHEDULED` |
| AI-суммаризация готова | `MEETING_SUMMARY_READY` |
| Статус PR изменился | `TASK_STATUS_CHANGED` (CI/CD) |

---

## Оптимизации (ответы на боли)

### Боль 1: Иерархия документов

**Проблема:** Документы в разрозненных папках Google Docs без привязки к задачам и статусам.

**Решение:**
- Docs-core с иерархией: `Проект → Эпоха → Документ`
- Inline-виджеты: в теле документа отображается актуальный статус каждой задачи
- Двунаправленная связь: изменения в документе → уведомление в обсуждении задачи
- Версионирование с changelog и привязкой к встречам

### Боль 2: Планирование встреч

**Проблема:** Календарь только для согласования даты, всё остальное вручную.

**Решение:**
- Встреча создаётся из задачи одной кнопкой — автоматически наследует участников, документы, эпоху
- Двустороннее голосование за слоты с автосогласованием
- AI-суммаризация транскрипции → автоматически прикрепляется к встрече и документам
- Версия документа может быть помечена как принятая "по итогам встречи [X]"

### Боль 3: Работа с кодом и релизы

**Проблема:** Интеграция таск-трекера с GitLab ограничена, нет связи с остальной системой.

**Решение:**
- CI/CD webhook: PR статус → задача (OPEN→REVIEW, MERGED→DONE)
- Git tag → автопубликация релиза эпохи
- Задача хранит ветку и PR number
- Единые уведомления для всех событий (PR, документы, встречи)

---

## Рекомендуемая интеграция — Nextcloud Talk

Для видеоконференций рекомендуется **Nextcloud Talk** (self-hosted, open-source):

```
1. Создание встречи в Seamless
   → POST /ocs/v2.php/apps/spreed/api/v4/room (Nextcloud API)
   → Получаем roomToken → сохраняем в meeting.nextcloudRoomId

2. Запись разговора (Nextcloud Talk встроенная функция)
   → Видео сохраняется в Nextcloud Files

3. Транскрибация (whisper или аналог)
   → Запускается pipeline по завершении записи
   → Результат POST /api/projects/meetings/:id (transcription)

4. AI-суммаризация
   → POST /api/projects/meetings/:id/summarize
   → Суммаризация прикрепляется к встрече и документам
```

**Почему Nextcloud Talk (а не Google Meet, Zoom):**
- Self-hosted — данные не покидают инфраструктуру
- API для управления комнатами
- Встроенная запись
- Гибкая интеграция через API

**Почему не Nextcloud Docs:**
- Редактор ограничен по функциональности
- Невозможно реализовать inline-виджеты задач и версионирование в требуемом виде
- Поэтому документы реализованы нативно в Seamless

---

## Запуск

```bash
cp .env.example .env
# Заполните переменные (DB пароли, JWT secret, AI ключи)

docker-compose up -d

# Применить миграции
docker-compose exec projects npx prisma migrate deploy
docker-compose exec auth npx prisma migrate deploy
docker-compose exec chat npx prisma migrate deploy
docker-compose exec notifications npx prisma migrate deploy
```

### AI-сервис (опционально)

Поддерживается **YandexGPT** и **Anthropic Claude**. Без настройки — mock-ответы.

```env
# YandexGPT
AI_PROVIDER=yandex
YANDEX_API_KEY=...
YANDEX_FOLDER_ID=...

# Или Anthropic
AI_PROVIDER=anthropic
AI_API_KEY=sk-ant-...
```

---

## Технологии

| Слой | Технологии |
|------|-----------|
| Frontend | Next.js 14, React 18, TypeScript, TailwindCSS, shadcn/ui, Socket.IO |
| Backend | Node.js, Express, TypeScript, Prisma ORM, Zod |
| AI Service | Python 3.12, FastAPI, YandexGPT / Anthropic Claude |
| Database | PostgreSQL 16 (отдельная БД на сервис) |
| Real-time | Socket.IO + Redis pub/sub adapter |
| Gateway | Nginx (SSL, WebSocket upgrade, routing) |
| Infrastructure | Docker Compose, Let's Encrypt |
