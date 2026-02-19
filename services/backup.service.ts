import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export class BackupService {
    /**
     * Export all company data to a JSON object
     */
    static async exportCompany(companyId: string, options: { masterOnly?: boolean } = {}) {
        const company = await prisma.company.findUnique({
            where: { id: companyId },
            select: { name: true }
        });

        if (!company) throw new Error("Company not found");

        // 1. Fetch Independent Masters
        const currencies = await prisma.currency.findMany({ where: { companyId } });
        const units = await prisma.unit.findMany({ where: { companyId } });
        const unitConversions = await prisma.unitConversion.findMany({ where: { companyId } });
        const categories = await prisma.category.findMany({ where: { companyId } });
        const warehouses = await prisma.warehouse.findMany({ where: { companyId } });
        const financialYears = await prisma.financialYear.findMany({ where: { companyId } });
        const voucherSequences = await prisma.voucherSequence.findMany({ where: { companyId } });
        const settings = await prisma.companySetting.findMany({ where: { companyId } });

        // 2. Accounts & Tax (Dependencies)
        const accounts = await prisma.account.findMany({
            where: { companyId },
            orderBy: { level: 'asc' }
        });
        const taxCodes = await prisma.taxCode.findMany({ where: { companyId } });

        // 3. Parties
        const customers = await prisma.customer.findMany({ where: { companyId } });
        const suppliers = await prisma.supplier.findMany({ where: { companyId } });

        // 4. Products
        const products = await prisma.product.findMany({ where: { companyId } });
        const variants = await prisma.productVariant.findMany({
            where: { product: { companyId } }
        });

        // 5. Procurement
        let purchaseRequests: any[] = [];
        let purchaseRequestItems: any[] = [];
        let purchaseOrders: any[] = [];
        let purchaseOrderItems: any[] = [];
        let grns: any[] = [];
        let grnItems: any[] = [];
        let purchaseInvoices: any[] = [];
        let purchaseInvoiceItems: any[] = [];
        let purchaseReturns: any[] = [];
        let purchaseReturnItems: any[] = [];

        // 6. Sales
        let salesQuotations: any[] = [];
        let salesQuotationItems: any[] = [];
        let salesOrders: any[] = [];
        let salesOrderItems: any[] = [];
        let deliveryOrders: any[] = [];
        let deliveryOrderItems: any[] = [];
        let salesInvoices: any[] = [];
        let salesInvoiceItems: any[] = [];
        let salesReturns: any[] = [];
        let salesReturnItems: any[] = [];

        // 7. Accounting & Stock
        let journalEntries: any[] = [];
        let linkedJournalLines: any[] = [];
        let stockLedgers: any[] = [];

        if (!options.masterOnly) {
            purchaseRequests = await prisma.purchaseRequest.findMany({ where: { companyId } });
            purchaseRequestItems = await prisma.purchaseRequestItem.findMany({ where: { request: { companyId } } });

            purchaseOrders = await prisma.purchaseOrder.findMany({ where: { companyId } });
            purchaseOrderItems = await prisma.purchaseOrderItem.findMany({ where: { po: { companyId } } });

            grns = await prisma.gRN.findMany({ where: { companyId } });
            grnItems = await prisma.gRNItem.findMany({ where: { grn: { companyId } } });

            purchaseInvoices = await prisma.purchaseInvoice.findMany({ where: { companyId } });
            purchaseInvoiceItems = await prisma.purchaseInvoiceItem.findMany({ where: { invoice: { companyId } } });

            purchaseReturns = await prisma.purchaseReturn.findMany({ where: { companyId } });
            purchaseReturnItems = await prisma.purchaseReturnItem.findMany({ where: { return: { companyId } } });

            salesQuotations = await prisma.salesQuotation.findMany({ where: { companyId } });
            salesQuotationItems = await prisma.salesQuotationItem.findMany({ where: { quote: { companyId } } });

            salesOrders = await prisma.salesOrder.findMany({ where: { companyId } });
            salesOrderItems = await prisma.salesOrderItem.findMany({ where: { order: { companyId } } });

            deliveryOrders = await prisma.deliveryOrder.findMany({ where: { companyId } });
            deliveryOrderItems = await prisma.deliveryOrderItem.findMany({ where: { do: { companyId } } });

            salesInvoices = await prisma.salesInvoice.findMany({ where: { companyId } });
            salesInvoiceItems = await prisma.salesInvoiceItem.findMany({ where: { invoice: { companyId } } });

            salesReturns = await prisma.salesReturn.findMany({ where: { companyId } });
            salesReturnItems = await prisma.salesReturnItem.findMany({ where: { return: { companyId } } });

            journalEntries = await prisma.journalEntry.findMany({ where: { companyId } });
            const journalEntryIds = journalEntries.map(j => j.id);
            linkedJournalLines = await prisma.journalLine.findMany({ where: { entryId: { in: journalEntryIds } } });

            stockLedgers = await prisma.stockLedger.findMany({ where: { companyId } });
        }

        const backupData = {
            metadata: {
                companyName: company.name,
                sourceCompanyId: companyId,
                exportedAt: new Date().toISOString(),
                version: "1.0",
                type: options.masterOnly ? "master" : "full"
            },
            data: {
                currencies, units, unitConversions, categories, warehouses, financialYears,
                settings, accounts, taxCodes, customers, suppliers, products, variants,
                purchaseRequests, purchaseRequestItems,
                purchaseOrders, purchaseOrderItems,
                grns, grnItems,
                purchaseInvoices, purchaseInvoiceItems,
                purchaseReturns, purchaseReturnItems,
                salesQuotations, salesQuotationItems,
                salesOrders, salesOrderItems,
                deliveryOrders, deliveryOrderItems,
                salesInvoices, salesInvoiceItems,
                salesReturns, salesReturnItems,
                journalEntries, journalLines: linkedJournalLines,
                stockLedgers
            }
        };

        return backupData;
    }

    /**
     * Restore company data
     * WARNING: Destructive for target company
     */
    static async restoreCompany(targetCompanyId: string, backup: any) {
        const { data } = backup;
        const withCid = (items: any[]) => items.map(item => ({ ...item, companyId: targetCompanyId }));

        await prisma.$transaction(async (tx) => {
            // 1. DELETE EXISTING DATA (Reverse Order)
            // Stock & Journals
            await tx.stockLedger.deleteMany({ where: { companyId: targetCompanyId } });
            await tx.journalLine.deleteMany({ where: { entry: { companyId: targetCompanyId } } });
            await tx.journalEntry.deleteMany({ where: { companyId: targetCompanyId } });

            // Sales
            await tx.salesReturnItem.deleteMany({ where: { return: { companyId: targetCompanyId } } });
            await tx.salesReturn.deleteMany({ where: { companyId: targetCompanyId } });
            await tx.salesInvoiceItem.deleteMany({ where: { invoice: { companyId: targetCompanyId } } });
            await tx.salesInvoice.deleteMany({ where: { companyId: targetCompanyId } });
            await tx.deliveryOrderItem.deleteMany({ where: { do: { companyId: targetCompanyId } } });
            await tx.deliveryOrder.deleteMany({ where: { companyId: targetCompanyId } });
            await tx.salesOrderItem.deleteMany({ where: { order: { companyId: targetCompanyId } } });
            await tx.salesOrder.deleteMany({ where: { companyId: targetCompanyId } });
            await tx.salesQuotationItem.deleteMany({ where: { quote: { companyId: targetCompanyId } } });
            await tx.salesQuotation.deleteMany({ where: { companyId: targetCompanyId } });

            // Procurement
            await tx.purchaseReturnItem.deleteMany({ where: { return: { companyId: targetCompanyId } } });
            await tx.purchaseReturn.deleteMany({ where: { companyId: targetCompanyId } });
            await tx.purchaseInvoiceItem.deleteMany({ where: { invoice: { companyId: targetCompanyId } } });
            await tx.purchaseInvoice.deleteMany({ where: { companyId: targetCompanyId } });
            await tx.gRNItem.deleteMany({ where: { grn: { companyId: targetCompanyId } } });
            await tx.gRN.deleteMany({ where: { companyId: targetCompanyId } });
            await tx.purchaseOrderItem.deleteMany({ where: { po: { companyId: targetCompanyId } } });
            await tx.purchaseOrder.deleteMany({ where: { companyId: targetCompanyId } });
            await tx.purchaseRequestItem.deleteMany({ where: { request: { companyId: targetCompanyId } } });
            await tx.purchaseRequest.deleteMany({ where: { companyId: targetCompanyId } });

            // Inventory & Settings
            await tx.productVariant.deleteMany({ where: { product: { companyId: targetCompanyId } } });
            await tx.product.deleteMany({ where: { companyId: targetCompanyId } });
            await tx.customer.deleteMany({ where: { companyId: targetCompanyId } });
            await tx.supplier.deleteMany({ where: { companyId: targetCompanyId } });
            await tx.taxCode.deleteMany({ where: { companyId: targetCompanyId } });
            await tx.account.deleteMany({ where: { companyId: targetCompanyId } });

            await tx.companySetting.deleteMany({ where: { companyId: targetCompanyId } });
            await tx.voucherSequence.deleteMany({ where: { companyId: targetCompanyId } });
            await tx.financialYear.deleteMany({ where: { companyId: targetCompanyId } });
            await tx.warehouse.deleteMany({ where: { companyId: targetCompanyId } });
            await tx.category.deleteMany({ where: { companyId: targetCompanyId } });
            await tx.unitConversion.deleteMany({ where: { companyId: targetCompanyId } });
            await tx.unit.deleteMany({ where: { companyId: targetCompanyId } });
            await tx.currency.deleteMany({ where: { companyId: targetCompanyId } });

            // 2. INSERT DATA (Dependency Order)

            if (data.currencies.length) await tx.currency.createMany({ data: withCid(data.currencies) });
            if (data.units.length) await tx.unit.createMany({ data: withCid(data.units) });
            if (data.unitConversions.length) await tx.unitConversion.createMany({ data: withCid(data.unitConversions) });
            if (data.categories.length) await tx.category.createMany({ data: withCid(data.categories) });
            if (data.warehouses.length) await tx.warehouse.createMany({ data: withCid(data.warehouses) });
            if (data.financialYears.length) await tx.financialYear.createMany({ data: withCid(data.financialYears) });
            if (data.voucherSequences && data.voucherSequences.length) await tx.voucherSequence.createMany({ data: withCid(data.voucherSequences) });
            if (data.settings.length) await tx.companySetting.createMany({ data: withCid(data.settings) });

            if (data.accounts.length) await tx.account.createMany({ data: withCid(data.accounts) });
            if (data.taxCodes.length) await tx.taxCode.createMany({ data: withCid(data.taxCodes) });

            if (data.customers.length) await tx.customer.createMany({ data: withCid(data.customers) });
            if (data.suppliers.length) await tx.supplier.createMany({ data: withCid(data.suppliers) });

            if (data.products.length) await tx.product.createMany({ data: withCid(data.products) });
            if (data.variants.length) await tx.productVariant.createMany({ data: data.variants });

            // Procurement
            if (data.purchaseRequests?.length) await tx.purchaseRequest.createMany({ data: withCid(data.purchaseRequests) });
            if (data.purchaseRequestItems?.length) await tx.purchaseRequestItem.createMany({ data: data.purchaseRequestItems });
            if (data.purchaseOrders?.length) await tx.purchaseOrder.createMany({ data: withCid(data.purchaseOrders) });
            if (data.purchaseOrderItems?.length) await tx.purchaseOrderItem.createMany({ data: data.purchaseOrderItems });
            if (data.grns?.length) await tx.gRN.createMany({ data: withCid(data.grns) });
            if (data.grnItems?.length) await tx.gRNItem.createMany({ data: data.grnItems });
            if (data.purchaseInvoices?.length) await tx.purchaseInvoice.createMany({ data: withCid(data.purchaseInvoices) });
            if (data.purchaseInvoiceItems?.length) await tx.purchaseInvoiceItem.createMany({ data: data.purchaseInvoiceItems });
            if (data.purchaseReturns?.length) await tx.purchaseReturn.createMany({ data: withCid(data.purchaseReturns) });
            if (data.purchaseReturnItems?.length) await tx.purchaseReturnItem.createMany({ data: data.purchaseReturnItems });

            // Sales
            if (data.salesQuotations?.length) await tx.salesQuotation.createMany({ data: withCid(data.salesQuotations) });
            if (data.salesQuotationItems?.length) await tx.salesQuotationItem.createMany({ data: data.salesQuotationItems });
            if (data.salesOrders?.length) await tx.salesOrder.createMany({ data: withCid(data.salesOrders) });
            if (data.salesOrderItems?.length) await tx.salesOrderItem.createMany({ data: data.salesOrderItems });
            if (data.deliveryOrders?.length) await tx.deliveryOrder.createMany({ data: withCid(data.deliveryOrders) });
            if (data.deliveryOrderItems?.length) await tx.deliveryOrderItem.createMany({ data: data.deliveryOrderItems });
            if (data.salesInvoices?.length) await tx.salesInvoice.createMany({ data: withCid(data.salesInvoices) });
            if (data.salesInvoiceItems?.length) await tx.salesInvoiceItem.createMany({ data: data.salesInvoiceItems });
            if (data.salesReturns?.length) await tx.salesReturn.createMany({ data: withCid(data.salesReturns) });
            if (data.salesReturnItems?.length) await tx.salesReturnItem.createMany({ data: data.salesReturnItems });

            // Finance & Stock
            if (data.journalEntries?.length) await tx.journalEntry.createMany({ data: withCid(data.journalEntries) });
            if (data.journalLines?.length) await tx.journalLine.createMany({ data: data.journalLines });
            if (data.stockLedgers?.length) await tx.stockLedger.createMany({ data: withCid(data.stockLedgers) });
        }, {
            maxWait: 20000,
            timeout: 50000
        });

        return { success: true };
    }
}
