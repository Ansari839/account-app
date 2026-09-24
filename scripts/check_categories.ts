import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const cats = await prisma.category.findMany({ include: { children: true } });
  console.log("Categories:", JSON.stringify(cats, null, 2));
  const prods = await prisma.product.findMany({ select: { name: true, isService: true, category: { select: { name: true } } }});
  console.log("Products:", JSON.stringify(prods, null, 2));
  process.exit(0);
}
main();
