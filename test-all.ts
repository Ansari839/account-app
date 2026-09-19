import prisma from "./lib/prisma";

async function main() {
    const id = "7864f828-d75f-43c3-9c7c-867598342993";
    const pi = await prisma.purchaseInvoice.findUnique({where: {id}});
    const po = await prisma.purchaseOrder.findUnique({where: {id}});
    const grn = await prisma.gRN.findUnique({where: {id}});
    console.log("PI:", !!pi, "PO:", !!po, "GRN:", !!grn);
}
main().catch(console.error).finally(()=>prisma.$disconnect());
