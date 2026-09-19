import prisma from "./lib/prisma";

async function main() {
    const id = "7864f828-d75f-43e3-9e7c-867598342993"; // The real ID
    try {
        const invoice = await prisma.purchaseInvoice.findUnique({
            where: { id },
            include: {
                supplier: true,
                po: true,
                grn: true,
                journalEntry: { include: { lines: { include: { account: true } } } },
                items: {
                    include: { product: true, poItem: true, unit: true }
                }
            }
        });
        console.log("Success:", !!invoice);
    } catch (e: any) {
        console.error("ERROR MESSAGE:", e.message);
        console.error("ERROR STACK:", e.stack);
        console.error("ERROR CODE:", e.code);
    }
}
main().finally(()=>prisma.$disconnect());
