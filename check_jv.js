const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const invoice = await prisma.purchaseInvoice.findFirst({
    orderBy: { createdAt: 'desc' },
    include: {
      items: true,
      taxes: true,
      journalEntry: {
        include: {
          lines: {
            include: { account: true }
          }
        }
      }
    }
  });
  console.log(JSON.stringify(invoice, null, 2));
}
main().finally(() => prisma.$disconnect());
