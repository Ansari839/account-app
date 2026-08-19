const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { ReportService } = require('./services/report.service');
async function main() {
    const company = await prisma.company.findFirst();
    const data = await ReportService.getBalanceSheet(company.id, new Date());
    console.log("Total Liabilities:", data.totalLiabilities);
    console.log("Groups:", JSON.stringify(data.liabilitySection, null, 2));
}
main().finally(() => prisma.$disconnect());
