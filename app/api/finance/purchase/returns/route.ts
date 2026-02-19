import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { PurchaseService } from "@/services/purchase.service";
import { AuthUtils } from "@/lib/auth-utils";

export async function GET(req: NextRequest) {
    try {
        const { companyId, error } = AuthUtils.getCompanyId(req);
        if (error) return error;

        const searchParams = req.nextUrl.searchParams;
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '20');
        const search = searchParams.get('search') || '';

        const where: any = { companyId };

        if (search) {
            where.AND = [
                { companyId },
                {
                    OR: [
                        { returnNo: { contains: search, mode: 'insensitive' } },
                        { supplier: { name: { contains: search, mode: 'insensitive' } } },
                        { invoice: { invoiceNo: { contains: search, mode: 'insensitive' } } }
                    ]
                }
            ];
        }

        const [total, returns] = await Promise.all([
            prisma.purchaseReturn.count({ where }),
            prisma.purchaseReturn.findMany({
                where,
                skip: (page - 1) * limit,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: {
                    supplier: true,
                    warehouse: true,
                    invoice: true
                }
            })
        ]);

        return NextResponse.json({
            success: true,
            data: returns,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const { companyId, error } = AuthUtils.getCompanyId(req);
        if (error) return error;

        const body = await req.json();

        const result = await PurchaseService.createReturn({
            companyId,
            purchaseInvoiceId: body.purchaseInvoiceId || undefined,
            supplierId: body.supplierId,
            warehouseId: body.warehouseId,
            date: new Date(body.date),
            remarks: body.remarks,
            items: body.items
        });

        return NextResponse.json({ success: true, data: result });
    } catch (error: any) {
        console.error("Create Return Error:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
