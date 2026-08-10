const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const users = await prisma.user.findMany({
    include: { companies: true },
    orderBy: { createdAt: 'desc' },
    take: 2
  });
  console.dir(users, { depth: null });
}
main();
