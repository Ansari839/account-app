const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const c = await prisma.account.findMany();
  console.log(c.length);
}
main().finally(() => prisma.$disconnect());
