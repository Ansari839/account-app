import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const p = await prisma.product.findMany({ select: { name: true, stage: true, isManufactured: true } });
  console.log(p);
}
main();
