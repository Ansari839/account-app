import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { AuthUtils } from "@/lib/auth-utils";

export async function GET(req: NextRequest) {
    try {
        const { companyId, error } = AuthUtils.getCompanyId(req);
        if (error) return error;

        const { searchParams } = new URL(req.url);
        const pendingOnly = searchParams.get("pendingOnly") === "true";
        const supplierId = searchParams.get("supplierId");
        const productId = searchParams.get("productId");
        const stage = searchParams.get("stage");
        const serviceType = searchParams.get("serviceType");
        const search = searchParams.get("search")?.toLowerCase();

        const where: any = { companyId };

        if (supplierId) {
            where.supplierId = supplierId;
        }

        if (productId) {
            where.productId = productId;
        }

        if (stage && stage !== "ALL") {
            where.stage = stage;
        }

        if (serviceType && serviceType !== "ALL") {
            where.serviceType = serviceType;
        }

        if (pendingOnly) {
            where.status = { in: ["PENDING", "PARTIALLY_BILLED"] };
        }

        let accruals: any[] = [];
        try {
            const accrualModel = (prisma as any).productionAccrual;
            if (accrualModel?.findMany) {
                accruals = await accrualModel.findMany({
                    where,
                    include: {
                        Product: {
                            select: {
                                id: true,
                                name: true,
                                code: true,
                                hsCode: true,
                                stage: true,
                                isService: true,
                                Unit: { select: { id: true, code: true, name: true } }
                            }
                        },
                        Supplier: {
                            select: {
                                id: true,
                                name: true,
                                code: true,
                                payableAccountId: true
                            }
                        },
                        Unit: {
                            select: {
                                id: true,
                                code: true,
                                name: true
                            }
                        },
                        ProductionRecord: {
                            select: {
                                id: true,
                                date: true,
                                outputProductId: true,
                                outputQuantity: true,
                                Warehouse: { select: { id: true, name: true } },
                                Product: { select: { name: true, code: true } }
                            }
                        }
                    },
                    orderBy: { date: "asc" }
                });
            } else {
                throw new Error("prisma.productionAccrual not directly available on instance");
            }
        } catch (findErr: any) {
            console.warn("[Production Accruals] Falling back to direct SQL query:", findErr?.message);
            try {
                const rawRows = await prisma.$queryRaw<any[]>`
                    SELECT 
                        pa.*,
                        p.name as "productName",
                        p.code as "productCode",
                        p."hsCode" as "productHsCode",
                        s.name as "supplierName",
                        s.code as "supplierCode",
                        u.code as "unitCode",
                        prProd.name as "prProdName",
                        prProd.code as "prProdCode",
                        pr."outputQuantity" as "prOutputQty",
                        w.name as "warehouseName"
                    FROM "ProductionAccrual" pa
                    LEFT JOIN "Product" p ON pa."productId" = p.id
                    LEFT JOIN "Supplier" s ON pa."supplierId" = s.id
                    LEFT JOIN "Unit" u ON pa."unitId" = u.id
                    LEFT JOIN "ProductionRecord" pr ON pa."productionId" = pr.id
                    LEFT JOIN "Product" prProd ON pr."outputProductId" = prProd.id
                    LEFT JOIN "Warehouse" w ON pr."warehouseId" = w.id
                    WHERE pa."companyId" = ${companyId}
                    ORDER BY pa."date" ASC, pa."accrualNo" ASC
                `;

                accruals = (rawRows || []).map((r) => ({
                    id: r.id,
                    accrualNo: r.accrualNo,
                    date: r.date,
                    productionId: r.productionId,
                    productId: r.productId,
                    supplierId: r.supplierId,
                    unitId: r.unitId,
                    stage: r.stage,
                    serviceType: r.serviceType,
                    qty: r.qty,
                    rate: r.rate,
                    amount: r.amount,
                    billedQty: r.billedQty,
                    status: r.status,
                    remarks: r.remarks,
                    Product: { name: r.productName, code: r.productCode, hsCode: r.productHsCode },
                    Supplier: { name: r.supplierName, code: r.supplierCode },
                    Unit: { code: r.unitCode },
                    ProductionRecord: {
                        Product: { name: r.prProdName, code: r.prProdCode },
                        outputQuantity: r.prOutputQty,
                        Warehouse: { name: r.warehouseName }
                    }
                }));
            } catch (sqlErr: any) {
                console.error("[Production Accruals SQL Error]:", sqlErr);
                accruals = [];
            }
        }

        // Fetch batch details from StockLedger for all linked production records
        const prodRecordIds = Array.from(new Set(accruals.map((a: any) => a.productionId).filter(Boolean)));
        const stockLedgerMap = new Map<string, any>();
        if (prodRecordIds.length > 0) {
            try {
                const sls = await prisma.stockLedger.findMany({
                    where: {
                        companyId,
                        refType: 'PRODUCTION',
                        refId: { in: prodRecordIds },
                        qtyIn: { gt: 0 }
                    },
                    select: {
                        refId: true,
                        batchNo: true
                    }
                });
                sls.forEach(sl => {
                    if (sl.refId && !stockLedgerMap.has(sl.refId)) {
                        stockLedgerMap.set(sl.refId, sl);
                    }
                });
            } catch (slErr) {
                console.warn("[Production Accruals] StockLedger query note:", slErr);
            }
        }

        const formatted = accruals
            .map((item) => {
                const totalQty = Number(item.qty);
                const billedQty = Number(item.billedQty);
                const remainingQty = Math.max(0, totalQty - billedQty);
                const rate = Number(item.rate);
                const totalAmount = Number(item.amount);
                const remainingAmount = remainingQty * rate;

                const isStillUnspecified = (item.status === 'PENDING' && billedQty <= 0.001) &&
                    Boolean(item.remarks && item.remarks.includes('[UNSPECIFIED_YARN]'));

                let effectiveProductName = item.Product?.name || "Service / Raw Material";
                if (item.remarks && item.remarks.includes('[Settled from Stock:')) {
                    const match = item.remarks.match(/\[Settled from Stock:\s*([^-\]]+)/i);
                    if (match && match[1]) {
                        effectiveProductName = match[1].trim();
                    }
                }

                const sl = item.productionId ? stockLedgerMap.get(item.productionId) : null;
                const rawBatchNo = sl?.batchNo || '';
                const batchNoClean = rawBatchNo ? rawBatchNo.split(' [')[0] : (item.productionId ? `BATCH-${item.productionId.slice(-6).toUpperCase()}` : '');
                const batchSpecs = rawBatchNo && rawBatchNo.includes('[') ? rawBatchNo.slice(rawBatchNo.indexOf('[')) : '';

                return {
                    id: item.id,
                    accrualNo: item.accrualNo,
                    date: item.date,
                    productionId: item.productionId,
                    productionOutput: item.ProductionRecord?.Product?.name || "-",
                    outputProductName: item.ProductionRecord?.Product?.name || "",
                    outputProductCode: item.ProductionRecord?.Product?.code || "",
                    outputQuantity: item.ProductionRecord?.outputQuantity ? Number(item.ProductionRecord.outputQuantity) : null,
                    warehouseName: item.ProductionRecord?.Warehouse?.name || "",
                    batchNo: batchNoClean,
                    batchSpecs: batchSpecs,
                    productId: item.productId,
                    productName: effectiveProductName,
                    productCode: item.Product?.code || "",
                    hsCode: item.Product?.hsCode || "",
                    isUnspecifiedLot: isStillUnspecified,
                    supplierId: item.supplierId,
                    supplierName: item.Supplier?.name || "Unassigned / General Vendor",
                    supplierCode: item.Supplier?.code || "",
                    unitId: item.unitId || item.Product?.Unit?.id,
                    unitCode: item.Unit?.code || item.Product?.Unit?.code || "KG",
                    stage: item.stage,
                    serviceType: item.serviceType || "DYEING",
                    qty: totalQty,
                    billedQty,
                    remainingQty,
                    rate,
                    amount: totalAmount,
                    remainingAmount,
                    status: item.status,
                    remarks: item.remarks
                };
            })
            .filter((item) => {
                if (pendingOnly && (item.remainingQty <= 0 || item.status === "BILLED")) return false;
                if (stage && stage !== "ALL" && item.stage !== stage) return false;
                if (serviceType && serviceType !== "ALL" && item.serviceType !== serviceType) return false;
                if (supplierId && item.supplierId !== supplierId) return false;
                if (productId && item.productId !== productId) return false;
                if (!search) return true;
                const q = search.toLowerCase();
                return (
                    item.accrualNo.toLowerCase().includes(q) ||
                    item.productName.toLowerCase().includes(q) ||
                    item.productCode.toLowerCase().includes(q) ||
                    item.hsCode.toLowerCase().includes(q) ||
                    (item.outputProductName && item.outputProductName.toLowerCase().includes(q)) ||
                    (item.batchNo && item.batchNo.toLowerCase().includes(q)) ||
                    item.supplierName.toLowerCase().includes(q) ||
                    (item.remarks && item.remarks.toLowerCase().includes(q))
                );
            });

        return NextResponse.json({
            success: true,
            data: formatted
        });
    } catch (e: any) {
        console.error("Fetch Production Accruals Error:", e);
        return NextResponse.json({ success: false, error: e.message }, { status: 500 });
    }
}
