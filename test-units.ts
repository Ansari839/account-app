import prisma from "./lib/prisma";
async function main() {
  const p = await prisma.product.findMany();
  console.log("Products:", JSON.stringify(p.map(x => ({id: x.id, name: x.name, companyId: x.companyId, baseUnitId: x.baseUnitId})), null, 2));
  const u = await prisma.unit.findMany();
  console.log("Units:", JSON.stringify(u.map(x => ({id: x.id, name: x.name, companyId: x.companyId})), null, 2));
}
main().catch(console.error).finally(()=>prisma.$disconnect());
