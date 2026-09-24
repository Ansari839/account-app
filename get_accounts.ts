import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const accounts = await prisma.account.findMany({ select: { name: true, code: true, isPosting: true, id: true } });
  console.log(JSON.stringify(accounts, null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());
