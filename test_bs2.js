require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { ReportService } = require('./services/report.service');
async function main() {
    const c = await prisma.company.findFirst();
    const data = await ReportService.getBalanceSheet(c.id, new Date());
    require('fs').writeFileSync('bs_output.json', JSON.stringify(data, null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());
