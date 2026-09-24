import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const categories = await prisma.category.findMany();
  console.log(categories.map((c: any) => c.name));
  process.exit(0);
}
main();
