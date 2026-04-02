import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding auth database...");

  const password = await bcrypt.hash("envelope2026", 10);

  // Manager
  const manager = await prisma.user.upsert({
    where: { email: "artem@envelope.dev" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000001",
      email: "artem@envelope.dev",
      passwordHash: password,
      name: "Артём Волков",
      role: "MANAGER",
    },
  });

  // Developers
  const dev1 = await prisma.user.upsert({
    where: { email: "masha@envelope.dev" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000002",
      email: "masha@envelope.dev",
      passwordHash: password,
      name: "Маша Иванова",
      role: "DEVELOPER",
    },
  });

  const dev2 = await prisma.user.upsert({
    where: { email: "nikita@envelope.dev" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000003",
      email: "nikita@envelope.dev",
      passwordHash: password,
      name: "Никита Смирнов",
      role: "DEVELOPER",
    },
  });

  const dev3 = await prisma.user.upsert({
    where: { email: "lena@envelope.dev" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000004",
      email: "lena@envelope.dev",
      passwordHash: password,
      name: "Лена Козлова",
      role: "DEVELOPER",
    },
  });

  // Clients (заказчики)
  const client1 = await prisma.user.upsert({
    where: { email: "dmitry@techcorp.ru" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000010",
      email: "dmitry@techcorp.ru",
      passwordHash: password,
      name: "Дмитрий Новиков",
      role: "CLIENT",
    },
  });

  const client2 = await prisma.user.upsert({
    where: { email: "olga@retail.ru" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000011",
      email: "olga@retail.ru",
      passwordHash: password,
      name: "Ольга Петрова",
      role: "CLIENT",
    },
  });

  console.log(`Created users:`);
  console.log(`  Manager:    ${manager.name} (${manager.email})`);
  console.log(`  Developer:  ${dev1.name} (${dev1.email})`);
  console.log(`  Developer:  ${dev2.name} (${dev2.email})`);
  console.log(`  Developer:  ${dev3.name} (${dev3.email})`);
  console.log(`  Client:     ${client1.name} (${client1.email})`);
  console.log(`  Client:     ${client2.name} (${client2.email})`);
  console.log(`\nAll passwords: envelope2026`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
