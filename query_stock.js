const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
    const productName = '24/1 PC';
    const product = await prisma.product.findFirst({ where: { name: productName }});
    if (!product) { console.log('Product not found'); return; }
    console.log('Product ID:', product.id);

    const ledgers = await prisma.stockLedger.findMany({ where: { productId: product.id }});
    console.log('Ledgers:', ledgers.map(l => ({ in: l.qtyIn, out: l.qtyOut, desc: l.description, date: l.date })));
    
    const pii = await prisma.purchaseInvoiceItem.findMany({ where: { productId: product.id }, include: { invoice: { select: { invoiceNo: true } } }});
    console.log('Purchase Invoice Items:', pii.map(p => ({ inv: p.invoice?.invoiceNo, qty: p.qty, consumed: p.consumedQty })));
}
main().finally(() => prisma.$disconnect());
