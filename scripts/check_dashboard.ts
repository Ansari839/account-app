import prisma from '../lib/prisma';
async function main() {
  const cats = await prisma.category.findMany({ select: { name: true, isService: true } });
  console.log("Categories:", cats);
  const prods = await prisma.product.findMany({ select: { name: true, isService: true } });
  console.log("Products:", prods);
}
main().catch(console.error).finally(() => prisma.$disconnect());
