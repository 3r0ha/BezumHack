import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const MANAGER_ID  = "00000000-0000-0000-0000-000000000001";
const DEV_MASHA   = "00000000-0000-0000-0000-000000000002";
const DEV_NIKITA  = "00000000-0000-0000-0000-000000000003";
const DEV_LENA    = "00000000-0000-0000-0000-000000000004";
const CLIENT_DIMA = "00000000-0000-0000-0000-000000000010";

async function main() {
  console.log("Seeding notifications database...");

  const notifications = [
    {
      id: "notif-0001",
      userId: DEV_NIKITA,
      type: "TASK_ASSIGNED" as const,
      priority: "HIGH" as const,
      title: "Новая задача",
      body: 'Вам назначена задача "Интеграция с 1С: экспорт сотрудников"',
      link: "/projects/proj-0000-0000-0000-0000-000000000001",
      read: true,
    },
    {
      id: "notif-0002",
      userId: DEV_MASHA,
      type: "TASK_ASSIGNED" as const,
      priority: "HIGH" as const,
      title: "Новая задача",
      body: 'Вам назначена задача "Форма подачи заявки на отпуск"',
      link: "/projects/proj-0000-0000-0000-0000-000000000001",
      read: true,
    },
    {
      id: "notif-0003",
      userId: MANAGER_ID,
      type: "TASK_STATUS_CHANGED" as const,
      priority: "MEDIUM" as const,
      title: "Статус задачи изменён",
      body: 'Задача "Каталог товаров с фильтрацией" → DONE',
      link: "/projects/proj-0000-0000-0000-0000-000000000002",
      read: true,
    },
    {
      id: "notif-0004",
      userId: MANAGER_ID,
      type: "MEETING_INVITED" as const,
      priority: "HIGH" as const,
      title: "Приглашение на согласование встречи",
      body: 'Выберите удобное время для встречи «Демо для клиента: модуль заявок»',
      link: "/meetings/meet-0001-0002",
      read: false,
    },
    {
      id: "notif-0005",
      userId: DEV_MASHA,
      type: "MEETING_INVITED" as const,
      priority: "HIGH" as const,
      title: "Приглашение на согласование встречи",
      body: 'Выберите удобное время для встречи «Демо для клиента: модуль заявок»',
      link: "/meetings/meet-0001-0002",
      read: false,
    },
    {
      id: "notif-0006",
      userId: CLIENT_DIMA,
      type: "MEETING_INVITED" as const,
      priority: "HIGH" as const,
      title: "Приглашение на согласование встречи",
      body: 'Выберите удобное время для встречи «Демо для клиента: модуль заявок»',
      link: "/meetings/meet-0001-0002",
      read: false,
    },
    {
      id: "notif-0007",
      userId: MANAGER_ID,
      type: "MEETING_SUMMARY_READY" as const,
      priority: "MEDIUM" as const,
      title: "Суммаризация встречи готова",
      body: 'AI сформировал итоги встречи «Ретро спринта 2: итоги интеграции с 1С»',
      link: "/meetings/meet-0001-0001",
      read: true,
    },
    {
      id: "notif-0008",
      userId: DEV_MASHA,
      type: "DOCUMENT_REVIEW_REQUESTED" as const,
      priority: "MEDIUM" as const,
      title: "Документ требует проверки",
      body: 'Документ «API-документация: модуль заявок» отправлен на проверку',
      link: "/docs/doc-0001-0002",
      read: false,
    },
    {
      id: "notif-0009",
      userId: DEV_NIKITA,
      type: "CICD_STATUS_CHANGED" as const,
      priority: "MEDIUM" as const,
      title: "CI/CD: PR смёрджен",
      body: 'PR #41 смёрджен — задача "Модуль документов" переведена в DONE',
      link: "/projects/proj-0000-0000-0000-0000-000000000003",
      read: true,
    },
    {
      id: "notif-0010",
      userId: DEV_LENA,
      type: "TASK_ASSIGNED" as const,
      priority: "HIGH" as const,
      title: "Новая задача",
      body: 'Вам назначена задача "AI-суммаризация встреч (YandexGPT / Claude)"',
      link: "/projects/proj-0000-0000-0000-0000-000000000003",
      read: true,
    },
  ];

  for (const n of notifications) {
    await prisma.notification.upsert({
      where: { id: n.id },
      update: {},
      create: n,
    });
  }

  console.log(`Notifications seed completed: ${notifications.length} notifications`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
