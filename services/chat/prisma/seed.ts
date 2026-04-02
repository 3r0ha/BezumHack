import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const MANAGER_ID  = "00000000-0000-0000-0000-000000000001";
const DEV_MASHA   = "00000000-0000-0000-0000-000000000002";
const DEV_NIKITA  = "00000000-0000-0000-0000-000000000003";
const DEV_LENA    = "00000000-0000-0000-0000-000000000004";
const CLIENT_DIMA = "00000000-0000-0000-0000-000000000010";
const CLIENT_OLGA = "00000000-0000-0000-0000-000000000011";

const PROJ1 = "proj-0000-0000-0000-0000-000000000001";
const PROJ2 = "proj-0000-0000-0000-0000-000000000002";
const PROJ3 = "proj-0000-0000-0000-0000-000000000003";

async function main() {
  console.log("Seeding chat database...");

  // ── Чат проекта TechCorp ──
  const conv1 = await prisma.conversation.upsert({
    where: { id: "conv-0001" },
    update: {},
    create: {
      id: "conv-0001",
      projectId: PROJ1,
      title: "TechCorp — общий чат",
      participants: {
        create: [
          { userId: MANAGER_ID },
          { userId: DEV_MASHA },
          { userId: DEV_NIKITA },
          { userId: CLIENT_DIMA },
        ],
      },
    },
  });

  const conv1msgs = [
    { id: "msg-0001-001", senderId: MANAGER_ID, content: "Привет! Никита, как дела с интеграцией 1С? Клиент спрашивает." },
    { id: "msg-0001-002", senderId: DEV_NIKITA,  content: "Маппинг полей закончил, сейчас допиливаю retry при таймауте. К пятнице будет готово." },
    { id: "msg-0001-003", senderId: DEV_MASHA,   content: "Хорошо, жду API — форма заявки уже готова на фронте, осталось подключить." },
    { id: "msg-0001-004", senderId: CLIENT_DIMA,  content: "Когда будет демо? Хочу показать руководству." },
    { id: "msg-0001-005", senderId: MANAGER_ID,  content: "Планируем на следующей неделе, Дмитрий. Отправлю инвайт на созвон." },
    { id: "msg-0001-006", senderId: DEV_NIKITA,  content: "PR #21 открыл, @Артём — можешь проревьювить?" },
    { id: "msg-0001-007", senderId: MANAGER_ID,  content: "Да, посмотрю сегодня вечером." },
  ];

  for (const msg of conv1msgs) {
    await prisma.message.upsert({
      where: { id: msg.id },
      update: {},
      create: {
        id: msg.id,
        conversationId: conv1.id,
        senderId: msg.senderId,
        content: msg.content,
      },
    });
  }

  // ── Чат проекта RetailPlus ──
  const conv2 = await prisma.conversation.upsert({
    where: { id: "conv-0002" },
    update: {},
    create: {
      id: "conv-0002",
      projectId: PROJ2,
      title: "RetailPlus — общий чат",
      participants: {
        create: [
          { userId: MANAGER_ID },
          { userId: DEV_LENA },
          { userId: DEV_MASHA },
          { userId: CLIENT_OLGA },
        ],
      },
    },
  });

  const conv2msgs = [
    { id: "msg-0002-001", senderId: DEV_LENA,   content: "Каталог смёрджен, начинаю карточку товара." },
    { id: "msg-0002-002", senderId: MANAGER_ID, content: "Отлично! Ольга уже ждёт демо." },
    { id: "msg-0002-003", senderId: CLIENT_OLGA, content: "Да, очень хочется увидеть как будет выглядеть карточка. У конкурентов красивые галереи." },
    { id: "msg-0002-004", senderId: DEV_LENA,   content: "Сделаем свайп-галерею + zoom по клику. Должно быть круто 🔥" },
    { id: "msg-0002-005", senderId: DEV_MASHA,  content: "Корзина в работе. Завтра буду стыковать с API." },
    { id: "msg-0002-006", senderId: CLIENT_OLGA, content: "А оплата когда будет? ЮKassa уже договор подписали." },
    { id: "msg-0002-007", senderId: MANAGER_ID, content: "Ольга, оплата в спринте 2 — стартуем 16 марта. Всё по плану." },
  ];

  for (const msg of conv2msgs) {
    await prisma.message.upsert({
      where: { id: msg.id },
      update: {},
      create: {
        id: msg.id,
        conversationId: conv2.id,
        senderId: msg.senderId,
        content: msg.content,
      },
    });
  }

  // ── Внутренний чат команды ──
  const conv3 = await prisma.conversation.upsert({
    where: { id: "conv-0003" },
    update: {},
    create: {
      id: "conv-0003",
      projectId: PROJ3,
      title: "Envelope — команда студии",
      participants: {
        create: [
          { userId: MANAGER_ID },
          { userId: DEV_MASHA },
          { userId: DEV_NIKITA },
          { userId: DEV_LENA },
        ],
      },
    },
  });

  const conv3msgs = [
    { id: "msg-0003-001", senderId: MANAGER_ID, content: "Ребята, docs-core смёрджен — топ работа! Никита, молодец." },
    { id: "msg-0003-002", senderId: DEV_NIKITA, content: "Спасибо! Версионирование получилось чистым. Лена, AI-суммаризация улёт — уже тестировал." },
    { id: "msg-0003-003", senderId: DEV_LENA,   content: "Сегодня добавила mock-fallback, если AI не настроен. Теперь везде работает без ключей." },
    { id: "msg-0003-004", senderId: DEV_MASHA,  content: "Слот-голосование тоже сдала. Осталось доделать CI/CD вебхук и релиз 1.0.0 🚀" },
    { id: "msg-0003-005", senderId: MANAGER_ID, content: "Никита, вебхук берёшь? Дедлайн — конец недели." },
    { id: "msg-0003-006", senderId: DEV_NIKITA, content: "Уже в работе, PR #50 открыт." },
  ];

  for (const msg of conv3msgs) {
    await prisma.message.upsert({
      where: { id: msg.id },
      update: {},
      create: {
        id: msg.id,
        conversationId: conv3.id,
        senderId: msg.senderId,
        content: msg.content,
      },
    });
  }

  console.log("Chat seed completed: 3 conversations, 20 messages");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
