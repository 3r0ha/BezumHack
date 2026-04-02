import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Synced with auth seed IDs
const MANAGER_ID   = "00000000-0000-0000-0000-000000000001"; // Артём Волков
const DEV_MASHA    = "00000000-0000-0000-0000-000000000002"; // Маша Иванова
const DEV_NIKITA   = "00000000-0000-0000-0000-000000000003"; // Никита Смирнов
const DEV_LENA     = "00000000-0000-0000-0000-000000000004"; // Лена Козлова
const CLIENT_DIMA  = "00000000-0000-0000-0000-000000000010"; // Дмитрий Новиков
const CLIENT_OLGA  = "00000000-0000-0000-0000-000000000011"; // Ольга Петрова

async function main() {
  console.log("Seeding projects database...");

  // ─────────────────────────────────────────
  // PROJECT 1: TechCorp — корпоративный портал
  // ─────────────────────────────────────────
  const proj1 = await prisma.project.upsert({
    where: { id: "proj-0000-0000-0000-0000-000000000001" },
    update: {},
    create: {
      id: "proj-0000-0000-0000-0000-000000000001",
      title: "TechCorp — Корпоративный портал",
      description: "Разработка внутреннего портала для управления заявками и HR-процессами компании TechCorp. Интеграция с 1С и Active Directory.",
      status: "ACTIVE",
      clientId: CLIENT_DIMA,
      managerId: MANAGER_ID,
      deadline: new Date("2026-07-31"),
      hourlyRate: 4500,
    },
  });

  // Epoch 1 (завершённый)
  const epoch1a = await prisma.epoch.upsert({
    where: { id: "epoch-000-0001-0001" },
    update: {},
    create: {
      id: "epoch-000-0001-0001",
      projectId: proj1.id,
      title: "Спринт 1: Авторизация и роли",
      description: "Базовая инфраструктура: авторизация, роли, структура БД",
      startDate: new Date("2026-04-01"),
      endDate: new Date("2026-04-01"),
      status: "COMPLETED",
      goals: [
        "Реализовать авторизацию через AD",
        "Настроить ролевой доступ (admin/employee/hr)",
        "Задеплоить dev-окружение",
      ],
    },
  });

  // Epoch 2 (активный)
  const epoch1b = await prisma.epoch.upsert({
    where: { id: "epoch-000-0001-0002" },
    update: {},
    create: {
      id: "epoch-000-0001-0002",
      projectId: proj1.id,
      title: "Спринт 2: Заявки и дашборд",
      description: "Модуль заявок сотрудников и дашборд HR-отдела",
      startDate: new Date("2026-04-01"),
      endDate: new Date("2026-05-15"),
      status: "ACTIVE",
      goals: [
        "Создать модуль подачи заявок",
        "Реализовать дашборд для HR",
        "Интеграция с 1С (экспорт данных)",
      ],
    },
  });

  // Tasks for project 1
  const t1_1 = await prisma.task.upsert({
    where: { id: "task-0001-0001" },
    update: {},
    create: {
      id: "task-0001-0001",
      projectId: proj1.id,
      epochId: epoch1a.id,
      title: "Настройка авторизации через LDAP/AD",
      description: "Интеграция с Active Directory компании. OAuth2 flow, маппинг ролей.",
      status: "DONE",
      priority: "HIGH",
      assigneeId: DEV_NIKITA,
      estimatedHours: 16,
      actualHours: 14,
      gitBranch: "feature/ldap-auth",
      prNumber: "12",
      prStatus: "MERGED",
    },
  });

  const t1_2 = await prisma.task.upsert({
    where: { id: "task-0001-0002" },
    update: {},
    create: {
      id: "task-0001-0002",
      projectId: proj1.id,
      epochId: epoch1b.id,
      title: "Форма подачи заявки на отпуск",
      description: "UI-форма с валидацией, выбором дат, согласующим. Сохранение в БД.",
      status: "IN_PROGRESS",
      priority: "HIGH",
      assigneeId: DEV_MASHA,
      estimatedHours: 12,
      gitBranch: "feature/leave-request",
      prNumber: "23",
      prStatus: "OPEN",
    },
  });

  const t1_3 = await prisma.task.upsert({
    where: { id: "task-0001-0003" },
    update: {},
    create: {
      id: "task-0001-0003",
      projectId: proj1.id,
      epochId: epoch1b.id,
      title: "Дашборд HR: список активных заявок",
      description: "Таблица заявок с фильтрами по статусу и сотруднику. Экспорт в Excel.",
      status: "TODO",
      priority: "MEDIUM",
      assigneeId: DEV_MASHA,
      estimatedHours: 10,
    },
  });

  await prisma.taskDependency.upsert({
    where: { blockedTaskId_blockingTaskId: { blockedTaskId: t1_3.id, blockingTaskId: t1_2.id } },
    update: {},
    create: { blockedTaskId: t1_3.id, blockingTaskId: t1_2.id },
  });

  const t1_4 = await prisma.task.upsert({
    where: { id: "task-0001-0004" },
    update: {},
    create: {
      id: "task-0001-0004",
      projectId: proj1.id,
      epochId: epoch1b.id,
      title: "Интеграция с 1С: экспорт сотрудников",
      description: "REST API до 1С, маппинг полей, обработка ошибок синхронизации.",
      status: "REVIEW",
      priority: "CRITICAL",
      assigneeId: DEV_NIKITA,
      estimatedHours: 20,
      gitBranch: "feature/1c-integration",
      prNumber: "21",
      prStatus: "OPEN",
    },
  });

  const t1_5 = await prisma.task.upsert({
    where: { id: "task-0001-0005" },
    update: {},
    create: {
      id: "task-0001-0005",
      projectId: proj1.id,
      epochId: epoch1b.id,
      title: "Уведомления по email при изменении статуса заявки",
      description: "SMTP-интеграция. Шаблоны писем на русском языке.",
      status: "BACKLOG",
      priority: "LOW",
      estimatedHours: 6,
    },
  });

  // Documents for project 1
  const doc1_1 = await prisma.document.upsert({
    where: { id: "doc-0001-0001" },
    update: {},
    create: {
      id: "doc-0001-0001",
      projectId: proj1.id,
      epochId: epoch1a.id,
      title: "Техническое задание: Корпоративный портал v1.2",
      content: {
        type: "doc",
        content: [
          { type: "paragraph", content: [{ type: "text", text: "1. Общие требования" }] },
          { type: "paragraph", content: [{ type: "text", text: "Портал должен обеспечивать единую точку доступа к HR-сервисам компании." }] },
          { type: "paragraph", content: [{ type: "text", text: "2. Авторизация" }] },
          { type: "paragraph", content: [{ type: "text", text: "Интеграция с Active Directory. SSO через LDAP/SAML." }] },
          { type: "paragraph", content: [{ type: "text", text: "3. Модуль заявок" }] },
          { type: "paragraph", content: [{ type: "text", text: "Подача заявок на отпуск, командировку, материальную помощь." }] },
        ],
      },
      status: "APPROVED",
      visibility: "PUBLIC",
      createdBy: MANAGER_ID,
    },
  });

  await prisma.documentVersion.upsert({
    where: { id: "docv-0001-0001-v1" },
    update: {},
    create: {
      id: "docv-0001-0001-v1",
      documentId: doc1_1.id,
      version: 1,
      title: doc1_1.title,
      content: doc1_1.content,
      changelog: "Начальная версия ТЗ",
      createdBy: MANAGER_ID,
    },
  });

  await prisma.documentVersion.upsert({
    where: { id: "docv-0001-0001-v2" },
    update: {},
    create: {
      id: "docv-0001-0001-v2",
      documentId: doc1_1.id,
      version: 2,
      title: doc1_1.title,
      content: doc1_1.content,
      changelog: "Добавлены требования к интеграции с 1С",
      createdBy: MANAGER_ID,
    },
  });

  const doc1_2 = await prisma.document.upsert({
    where: { id: "doc-0001-0002" },
    update: {},
    create: {
      id: "doc-0001-0002",
      projectId: proj1.id,
      epochId: epoch1b.id,
      title: "API-документация: модуль заявок",
      content: {
        type: "doc",
        content: [
          { type: "paragraph", content: [{ type: "text", text: "POST /api/requests — создать заявку" }] },
          { type: "paragraph", content: [{ type: "text", text: "GET /api/requests — список заявок пользователя" }] },
          { type: "paragraph", content: [{ type: "text", text: "PATCH /api/requests/:id/status — изменить статус (только HR)" }] },
        ],
      },
      status: "DRAFT",
      visibility: "TEAM",
      createdBy: DEV_MASHA,
    },
  });

  await prisma.documentVersion.upsert({
    where: { id: "docv-0001-0002-v1" },
    update: {},
    create: {
      id: "docv-0001-0002-v1",
      documentId: doc1_2.id,
      version: 1,
      title: doc1_2.title,
      content: doc1_2.content,
      changelog: null,
      createdBy: DEV_MASHA,
    },
  });

  // Link doc to task
  await prisma.taskDocumentRef.upsert({
    where: { id: "taskdocref-0001-0001" },
    update: {},
    create: {
      id: "taskdocref-0001-0001",
      taskId: t1_2.id,
      documentId: doc1_2.id,
      quote: "POST /api/requests — создать заявку",
      createdBy: DEV_MASHA,
    },
  });

  // Meeting
  const meet1 = await prisma.meeting.upsert({
    where: { id: "meet-0001-0001" },
    update: {},
    create: {
      id: "meet-0001-0001",
      projectId: proj1.id,
      epochId: epoch1b.id,
      taskId: t1_4.id,
      title: "Ретро спринта 2: итоги интеграции с 1С",
      organizerId: MANAGER_ID,
      status: "COMPLETED",
      scheduledAt: new Date("2026-04-01T11:00:00"),
      duration: 45,
      participants: [MANAGER_ID, DEV_NIKITA, DEV_MASHA],
      transcription: "Артём: Никита, расскажи как прошла интеграция с 1С?\nНикита: Основной flow готов, маппинг полей сделан. Осталась обработка ошибок при таймауте.\nМаша: UI готов, ждём API.\nАртём: Ок, ставим дедлайн — пятница. Никита, успеешь?\nНикита: Да, сделаю.\nАртём: Маша, после этого можно сразу в review выводить форму.",
      summary: "Интеграция с 1С в финальной стадии — маппинг полей завершён, осталась обработка edge cases. UI-форма заявок ждёт готовности API. Дедлайн: пятница.",
    },
  });

  await prisma.meetingDocument.upsert({
    where: { meetingId_documentId: { meetingId: meet1.id, documentId: doc1_1.id } },
    update: {},
    create: { meetingId: meet1.id, documentId: doc1_1.id },
  });

  // Meeting in SCHEDULING mode
  await prisma.meeting.upsert({
    where: { id: "meet-0001-0002" },
    update: {},
    create: {
      id: "meet-0001-0002",
      projectId: proj1.id,
      epochId: epoch1b.id,
      title: "Демо для клиента: модуль заявок",
      organizerId: MANAGER_ID,
      status: "SCHEDULING",
      participants: [MANAGER_ID, DEV_MASHA, CLIENT_DIMA],
      slots: {
        create: [
          {
            startTime: new Date("2026-04-04T10:00:00"),
            endTime: new Date("2026-04-04T11:00:00"),
            votes: [MANAGER_ID],
          },
          {
            startTime: new Date("2026-04-05T15:00:00"),
            endTime: new Date("2026-04-05T16:00:00"),
            votes: [MANAGER_ID, DEV_MASHA],
          },
          {
            startTime: new Date("2026-04-07T12:00:00"),
            endTime: new Date("2026-04-07T13:00:00"),
            votes: [],
          },
        ],
      },
    },
  });

  // Release
  await prisma.release.upsert({
    where: { id: "release-0001-0001" },
    update: {},
    create: {
      id: "release-0001-0001",
      epochId: epoch1a.id,
      title: "v0.1.0 — Авторизация и базовая структура",
      notes: "Первый публичный релиз: авторизация через AD, роли, структура проекта.",
      version: "0.1.0",
      gitTag: "v0.1.0",
      status: "PUBLISHED",
      releasedAt: new Date("2026-04-01"),
      createdBy: MANAGER_ID,
    },
  });

  // ─────────────────────────────────────────
  // PROJECT 2: RetailPlus — e-commerce платформа
  // ─────────────────────────────────────────
  const proj2 = await prisma.project.upsert({
    where: { id: "proj-0000-0000-0000-0000-000000000002" },
    update: {},
    create: {
      id: "proj-0000-0000-0000-0000-000000000002",
      title: "RetailPlus — E-commerce платформа",
      description: "Разработка интернет-магазина с корзиной, оплатой через ЮKassa, личным кабинетом и CMS для управления товарами.",
      status: "ACTIVE",
      clientId: CLIENT_OLGA,
      managerId: MANAGER_ID,
      deadline: new Date("2026-09-01"),
      hourlyRate: 5000,
    },
  });

  const epoch2a = await prisma.epoch.upsert({
    where: { id: "epoch-000-0002-0001" },
    update: {},
    create: {
      id: "epoch-000-0002-0001",
      projectId: proj2.id,
      title: "Спринт 1: Каталог и карточка товара",
      startDate: new Date("2026-04-01"),
      endDate: new Date("2026-05-15"),
      status: "ACTIVE",
      goals: [
        "Реализовать каталог с фильтрами и поиском",
        "Карточка товара с фото, характеристиками, ценой",
        "Корзина с локальным хранилищем",
      ],
    },
  });

  const epoch2b = await prisma.epoch.upsert({
    where: { id: "epoch-000-0002-0002" },
    update: {},
    create: {
      id: "epoch-000-0002-0002",
      projectId: proj2.id,
      title: "Спринт 2: Оплата и личный кабинет",
      startDate: new Date("2026-05-16"),
      endDate: new Date("2026-06-30"),
      status: "PLANNED",
      goals: [
        "Интеграция с ЮKassa",
        "Личный кабинет: история заказов",
        "Уведомления по SMS (SMSRU)",
      ],
    },
  });

  await prisma.task.upsert({
    where: { id: "task-0002-0001" },
    update: {},
    create: {
      id: "task-0002-0001",
      projectId: proj2.id,
      epochId: epoch2a.id,
      title: "Каталог товаров с фильтрацией",
      description: "Сетка товаров, фильтры по категории/цене/бренду. Сортировка. Пагинация.",
      status: "DONE",
      priority: "HIGH",
      assigneeId: DEV_LENA,
      estimatedHours: 20,
      actualHours: 22,
      gitBranch: "feature/catalog",
      prNumber: "5",
      prStatus: "MERGED",
    },
  });

  await prisma.task.upsert({
    where: { id: "task-0002-0002" },
    update: {},
    create: {
      id: "task-0002-0002",
      projectId: proj2.id,
      epochId: epoch2a.id,
      title: "Карточка товара",
      description: "Галерея фото, описание, характеристики, кнопка «В корзину».",
      status: "REVIEW",
      priority: "HIGH",
      assigneeId: DEV_LENA,
      estimatedHours: 14,
      gitBranch: "feature/product-card",
      prNumber: "8",
      prStatus: "OPEN",
    },
  });

  await prisma.task.upsert({
    where: { id: "task-0002-0003" },
    update: {},
    create: {
      id: "task-0002-0003",
      projectId: proj2.id,
      epochId: epoch2a.id,
      title: "Корзина (localStorage + API)",
      description: "Добавление/удаление товаров, счётчик, синхронизация с бэком при авторизации.",
      status: "IN_PROGRESS",
      priority: "MEDIUM",
      assigneeId: DEV_MASHA,
      estimatedHours: 10,
      gitBranch: "feature/cart",
    },
  });

  await prisma.task.upsert({
    where: { id: "task-0002-0004" },
    update: {},
    create: {
      id: "task-0002-0004",
      projectId: proj2.id,
      epochId: epoch2b.id,
      title: "Интеграция с ЮKassa",
      status: "BACKLOG",
      priority: "CRITICAL",
      estimatedHours: 24,
    },
  });

  // Document for project 2
  const doc2_1 = await prisma.document.upsert({
    where: { id: "doc-0002-0001" },
    update: {},
    create: {
      id: "doc-0002-0001",
      projectId: proj2.id,
      epochId: epoch2a.id,
      title: "Дизайн-спецификация: каталог и карточка товара",
      content: {
        type: "doc",
        content: [
          { type: "paragraph", content: [{ type: "text", text: "Каталог: 4-колоночная сетка на десктопе, 2 на мобиле." }] },
          { type: "paragraph", content: [{ type: "text", text: "Фильтры: выезжающая панель слева. Кнопка сброса." }] },
          { type: "paragraph", content: [{ type: "text", text: "Карточка: hero-изображение 600x600, свайп на мобиле." }] },
        ],
      },
      status: "PENDING_REVIEW",
      visibility: "PUBLIC",
      createdBy: DEV_LENA,
    },
  });

  await prisma.documentVersion.upsert({
    where: { id: "docv-0002-0001-v1" },
    update: {},
    create: {
      id: "docv-0002-0001-v1",
      documentId: doc2_1.id,
      version: 1,
      title: doc2_1.title,
      content: doc2_1.content,
      changelog: "Первичная спецификация",
      createdBy: DEV_LENA,
    },
  });

  // Meeting for project 2
  await prisma.meeting.upsert({
    where: { id: "meet-0002-0001" },
    update: {},
    create: {
      id: "meet-0002-0001",
      projectId: proj2.id,
      epochId: epoch2a.id,
      title: "Согласование дизайна каталога с клиентом",
      organizerId: MANAGER_ID,
      status: "SCHEDULED",
      scheduledAt: new Date("2026-04-05T14:00:00"),
      duration: 60,
      participants: [MANAGER_ID, DEV_LENA, CLIENT_OLGA],
    },
  });

  // ─────────────────────────────────────────
  // PROJECT 3: внутренний проект студии
  // ─────────────────────────────────────────
  const proj3 = await prisma.project.upsert({
    where: { id: "proj-0000-0000-0000-0000-000000000003" },
    update: {},
    create: {
      id: "proj-0000-0000-0000-0000-000000000003",
      title: "Envelope — Внутренняя разработка платформы",
      description: "Развитие и поддержка самой платформы Envelope. CI/CD, новые фичи, багфиксы.",
      status: "ACTIVE",
      clientId: MANAGER_ID,
      managerId: MANAGER_ID,
      hourlyRate: 0,
    },
  });

  const epoch3a = await prisma.epoch.upsert({
    where: { id: "epoch-000-0003-0001" },
    update: {},
    create: {
      id: "epoch-000-0003-0001",
      projectId: proj3.id,
      title: "Спринт 1: Docs-core + Meetings",
      startDate: new Date("2026-04-01"),
      endDate: new Date("2026-05-01"),
      status: "ACTIVE",
      goals: [
        "Реализовать модуль документов с версионированием",
        "Встречи со слот-голосованием",
        "AI-суммаризация транскрипций",
        "CI/CD вебхук (GitLab/GitHub)",
      ],
    },
  });

  await prisma.task.upsert({
    where: { id: "task-0003-0001" },
    update: {},
    create: {
      id: "task-0003-0001",
      projectId: proj3.id,
      epochId: epoch3a.id,
      title: "Модуль документов (Docs-core)",
      description: "CRUD документов, версионирование, ролевая видимость, привязка к задачам.",
      status: "DONE",
      priority: "CRITICAL",
      assigneeId: DEV_NIKITA,
      estimatedHours: 32,
      actualHours: 35,
      gitBranch: "feature/docs-core",
      prNumber: "41",
      prStatus: "MERGED",
    },
  });

  await prisma.task.upsert({
    where: { id: "task-0003-0002" },
    update: {},
    create: {
      id: "task-0003-0002",
      projectId: proj3.id,
      epochId: epoch3a.id,
      title: "Встречи: слот-голосование и автофинализация",
      description: "Участники голосуют за слоты, система выбирает ближайшее пересечение.",
      status: "DONE",
      priority: "HIGH",
      assigneeId: DEV_MASHA,
      estimatedHours: 20,
      actualHours: 18,
      gitBranch: "feature/meetings-slots",
      prNumber: "44",
      prStatus: "MERGED",
    },
  });

  await prisma.task.upsert({
    where: { id: "task-0003-0003" },
    update: {},
    create: {
      id: "task-0003-0003",
      projectId: proj3.id,
      epochId: epoch3a.id,
      title: "AI-суммаризация встреч (YandexGPT / Claude)",
      description: "POST /summarize/meeting: summary, decisions, action_items, open_questions.",
      status: "DONE",
      priority: "HIGH",
      assigneeId: DEV_LENA,
      estimatedHours: 12,
      actualHours: 10,
      gitBranch: "feature/ai-meeting-summary",
      prNumber: "46",
      prStatus: "MERGED",
    },
  });

  await prisma.task.upsert({
    where: { id: "task-0003-0004" },
    update: {},
    create: {
      id: "task-0003-0004",
      projectId: proj3.id,
      epochId: epoch3a.id,
      title: "CI/CD webhook: GitLab MR + GitHub PR → Task status",
      description: "Вебхук нормализует события, обновляет prStatus задачи, публикует тег как релиз.",
      status: "IN_PROGRESS",
      priority: "HIGH",
      assigneeId: DEV_NIKITA,
      estimatedHours: 10,
      gitBranch: "feature/cicd-webhook",
      prNumber: "50",
      prStatus: "OPEN",
    },
  });

  // Release for project 3
  await prisma.release.upsert({
    where: { id: "release-0003-0001" },
    update: {},
    create: {
      id: "release-0003-0001",
      epochId: epoch3a.id,
      title: "v1.0.0 — Docs-core + Meetings",
      notes: "Первый major-релиз с модулем документов, встречами и AI-суммаризацией.",
      version: "1.0.0",
      gitTag: "v1.0.0",
      status: "DRAFT",
      createdBy: MANAGER_ID,
    },
  });

  console.log("Projects seed completed:");
  console.log(`  Project 1: ${proj1.title}`);
  console.log(`  Project 2: ${proj2.title}`);
  console.log(`  Project 3: ${proj3.title}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
