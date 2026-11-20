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
        const search = searchParams.get("search")?.toLowerCase();

        const where: any = { companyId };

        if (supplierId) {
            where.supplierId = supplierId;
        }

        if (productId) {
            where.productId = productId;
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
                                Product: { select: { name: true, code: true } }
                            }
                        }
                    },
                    orderBy: { date: "desc" }
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
                        prProd.name as "prProdName"
                    FROM "ProductionAccrual" pa
                    LEFT JOIN "Product" p ON pa."productId" = p.id
                    LEFT JOIN "Supplier" s ON pa."supplierId" = s.id
                    LEFT JOIN "Unit" u ON pa."unitId" = u.id
                    LEFT JOIN "ProductionRecord" pr ON pa."productionId" = pr.id
                    LEFT JOIN "Product" prProd ON pr."outputProductId" = prProd.id
                    WHERE pa."companyId" = ${companyId}
                    ORDER BY pa.date DESC
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
                    ProductionRecord: { Product: { name: r.prProdName } }
                }));
            } catch (sqlErr: any) {
                console.error("[Production Accruals SQL Error]:", sqlErr);
                accruals = [];
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

                return {
                    id: item.id,
                    accrualNo: item.accrualNo,
                    date: item.date,
                    productionId: item.productionId,
                    productionOutput: item.ProductionRecord?.Product?.name || "-",
                    productId: item.productId,
                    productName: item.Product?.name || "Service / Item",
                    productCode: item.Product?.code || "",
                    hsCode: item.Product?.hsCode || "",
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
                if (pendingOnly && item.remainingQty <= 0) return false;
                if (!search) return true;
                return (
                    item.accrualNo.toLowerCase().includes(search) ||
                    item.productName.toLowerCase().includes(search) ||
                    item.productCode.toLowerCase().includes(search) ||
                    item.hsCode.toLowerCase().includes(search) ||
                    item.supplierName.toLowerCase().includes(search) ||
                    item.remarks?.toLowerCase().includes(search)
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
