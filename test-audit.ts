import prisma from "./lib/prisma";

async function main() {
    try {
        const after = {
            id: "123",
            companyId: "abc",
            number: "PV-26-00001",
            date: new Date(),
            type: "PAYMENT",
            reference: "",
            narration: "Test Payment",
            financialYearId: "fy123",
            createdById: "user123",
            createdAt: new Date(),
            updatedAt: new Date()
        };
        const log = await prisma.auditLog.create({
            data: {
                userId: null,
                action: "CREATE",
                module: "JOURNAL",
                entityId: "123",
                companyId: undefined,
                beforeState: undefined,
                afterState: JSON.parse(JSON.stringify(after))
            }
        });
        console.log("Success:", log.id);
    } catch (e: any) {
        console.error("ERROR:", e.message);
    }
}
main().finally(()=>prisma.$disconnect());
