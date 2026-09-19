import prisma from "./lib/prisma";

async function main() {
    try {
        const companyId = "some-company-id"; // we don't care, just checking if Prisma accepts the payload
        const key = "FINANCE_LOCK_DATE";
        const setting = await prisma.companySetting.findUnique({
            where: { companyId_key: { companyId, key } },
        });
        console.log("Success:", setting);
    } catch (e: any) {
        console.error("ERROR:", e.message);
    }
}
main().finally(()=>prisma.$disconnect());
