import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.appMeta.upsert({
    where: { key: 'schema_version' },
    update: {},
    create: { key: 'schema_version', value: '0' },
  });
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
