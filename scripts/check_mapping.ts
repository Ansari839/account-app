import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const mappings = await prisma.systemAccountMapping.findMany({
    include: { account: true, company: true }
  });
  console.log("Mappings:", mappings);
  process.exit(0);
}
main();
