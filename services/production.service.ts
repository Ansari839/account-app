import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { VoucherService } from "./voucher.service";

export class ProductionService {
    
    static async getAll(companyId: string) {
        return await prisma.productionRecord.findMany({
            where: { companyId },
            include: {
                outputProduct: true,
                warehouse: true,
                inputs: {
                    include: { product: true }
                },
                overheads: true
            },
            orderBy: { date: 'desc' }
        });
    }
    static async create(companyId: string, userId: string, data: any, txClient?: Prisma.TransactionClient) {
        const execute = async (tx: Prisma.TransactionClient) => {
            // 1. Calculate Input Costs (FIFO logic mockup for now, ideally fetch from stock ledger)
            // For simplicity in this implementation, we will fetch the latest average cost rate 
            // or require the cost to be passed if standard costing is used.
            let totalInputCost = new Prisma.Decimal(0);
            const processedInputs = [];

            for (const input of data.inputs) {
                // Fetch latest cost rate from Stock Ledger (simplified FIFO/Average)
                const lastStockIn = await tx.stockLedger.findFirst({
                    where: { companyId, productId: input.productId, qtyIn: { gt: 0 } },
                    orderBy: { date: 'desc' }
                });
                
                const costRate = lastStockIn ? lastStockIn.costRate : new Prisma.Decimal(0);
                const costValue = new Prisma.Decimal(input.quantity).mul(costRate);
                totalInputCost = totalInputCost.add(costValue);

                processedInputs.push({
                    ...input,
                    costValue
                });
            }

            // 2. Calculate Overhead Costs
            let totalOverheadCost = new Prisma.Decimal(0);
            for (const overhead of data.overheads) {
                totalOverheadCost = totalOverheadCost.add(new Prisma.Decimal(overhead.amount));
            }

            const totalCost = totalInputCost.add(totalOverheadCost);

            // 3. Create Production Record
            const production = await tx.productionRecord.create({
                data: {
                    companyId,
                    date: new Date(data.date),
                    outputProductId: data.outputProductId,
                    outputQuantity: data.outputQuantity,
                    warehouseId: data.warehouseId,
                    totalCost: totalCost,
                    status: "COMPLETED",
                    inputs: {
                        create: processedInputs.map(input => ({
                            productId: input.productId,
                            quantity: input.quantity,
                            costValue: input.costValue,
                            lotNumber: input.lotNumber
                        }))
                    },
                    overheads: {
                        create: data.overheads.map((overhead: any) => ({
                            description: overhead.description,
                            amount: overhead.amount,
                            purchaseInvoiceItemId: overhead.purchaseInvoiceItemId,
                            quantity: overhead.quantity,
                            unitId: overhead.unitId
                        }))
                    }
                },
                include: {
                    inputs: true,
                    overheads: true
                }
            });

            // Update Consumed Qty for Service Invoice Items
            for (const overhead of data.overheads) {
                if (overhead.purchaseInvoiceItemId && overhead.quantity) {
                    await tx.purchaseInvoiceItem.update({
                        where: { id: overhead.purchaseInvoiceItemId },
                        data: {
                            consumedQty: { increment: overhead.quantity }
                        }
                    });
                }
            }

            // 4. Update Stock Ledger
            // Output Item (WIP/FG)
            await tx.stockLedger.create({
                data: {
                    companyId,
                    productId: data.outputProductId,
                    warehouseId: data.warehouseId,
                    date: new Date(data.date),
                    qtyIn: data.outputQuantity,
                    qtyOut: 0,
                    costRate: totalCost.div(new Prisma.Decimal(data.outputQuantity || 1)),
                    refType: "PRODUCTION",
                    refId: production.id
                }
            });

            // Input Items (RM/WIP)
            for (const input of processedInputs) {
                await tx.stockLedger.create({
                    data: {
                        companyId,
                        productId: input.productId,
                        warehouseId: data.warehouseId, // Assuming consumed from same warehouse
                        date: new Date(data.date),
                        qtyIn: 0,
                        qtyOut: input.quantity,
                        costRate: input.costValue.div(new Prisma.Decimal(input.quantity || 1)),
                        refType: "PRODUCTION_CONSUMPTION",
                        refId: production.id
                    }
                });
            }

            // 5. Financial Posting (Journal Entry)
            // Fetch Accounts
            const outputProduct = await tx.product.findUnique({ where: { id: data.outputProductId } });
            const wipClearingMapping = await tx.systemAccountMapping.findUnique({
                where: { companyId_key: { companyId, key: "WIP_CLEARING_ACCOUNT" } }
            });

            let wipClearingAccountId = wipClearingMapping?.accountId;
            
            if (!wipClearingAccountId) {
                // Fallback: Try to find an account with name "WIP Clearing Account"
                const fallbackAcc = await tx.account.findFirst({
                    where: { companyId, name: { contains: "WIP Clearing" } }
                });
                if (fallbackAcc) {
                    wipClearingAccountId = fallbackAcc.id;
                }
            }

            const lines = [];

            // Debit: Output Product Inventory Account
            if (outputProduct?.inventoryAccountId) {
                lines.push({
                    accountId: outputProduct.inventoryAccountId,
                    debit: totalCost,
                    credit: 0,
                    narration: `Production Output for ${production.id}`
                });
            }

            // Credit: Input Product Inventory Accounts
            for (const input of processedInputs) {
                const inputProduct = await tx.product.findUnique({ where: { id: input.productId } });
                if (inputProduct?.inventoryAccountId) {
                    lines.push({
                        accountId: inputProduct.inventoryAccountId,
                        debit: 0,
                        credit: input.costValue,
                        narration: `Production Consumption for ${production.id}`
                    });
                }
            }
            
            // Credit: Overhead Accounts (WIP)
            for (const overhead of data.overheads) {
                const overheadAmt = new Prisma.Decimal(overhead.amount);
                if (overheadAmt.greaterThan(0)) {
                    let specificAccountId = null;
                    
                    // 1. Try to get the exact account used in the Purchase Invoice
                    if (overhead.purchaseInvoiceItemId) {
                        const piItem = await tx.purchaseInvoiceItem.findUnique({
                            where: { id: overhead.purchaseInvoiceItemId },
                            include: { product: true }
                        });
                        if (piItem?.product) {
                            specificAccountId = piItem.product.purchaseAccountId || piItem.product.inventoryAccountId;
                        }
                    }

                    // 2. Fallbacks
                    const finalAccountId = specificAccountId || wipClearingAccountId;
                    
                    if (finalAccountId) {
                        lines.push({
                            accountId: finalAccountId,
                            debit: 0,
                            credit: overheadAmt,
                            narration: `Production Overheads for ${production.id} ${overhead.description ? '- ' + overhead.description : ''}`
                        });
                    } else {
                        // Ultimate fallback
                        const cogsAcc = await tx.account.findFirst({
                            where: { companyId, name: { contains: "Cost of Goods Sold" } }
                        });
                        if (cogsAcc) {
                            lines.push({
                                accountId: cogsAcc.id,
                                debit: 0,
                                credit: overheadAmt,
                                narration: `Production Overheads (Fallback) for ${production.id}`
                            });
                        }
                    }
                }
            }

            // Create Journal Entry if lines are balanced (Simple check)
            const totalDebit = lines.reduce((acc, line) => acc.add(new Prisma.Decimal(line.debit)), new Prisma.Decimal(0));
            const totalCredit = lines.reduce((acc, line) => acc.add(new Prisma.Decimal(line.credit)), new Prisma.Decimal(0));

            if (totalDebit.equals(totalCredit) && lines.length > 0) {
                const voucherNo = await VoucherService.generateNumber(companyId, "JOURNAL", tx);
                await tx.journalEntry.create({
                    data: {
                        companyId,
                        number: voucherNo,
                        date: new Date(data.date),
                        type: "JOURNAL",
                        reference: `PROD-${production.id}`,
                        narration: "Production & Consumption Cost Roll-up",
                        createdById: userId,
                        lines: {
                            create: lines.map(line => ({
                                accountId: line.accountId,
                                debit: line.debit,
                                credit: line.credit,
                                narration: line.narration
                            }))
                        }
                    }
                });
            }

            return production;
        };

        if (txClient) {
            return await execute(txClient);
        } else {
            return await prisma.$transaction(async (tx) => await execute(tx));
        }
    }
}
