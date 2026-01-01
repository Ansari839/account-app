import { NextResponse } from 'next/server';
import prisma from "@/lib/prisma";
import { AuthUtils } from '@/lib/auth-utils';

async function getAuthUser(req: Request) {
    const token = req.headers.get('Authorization')?.split(' ')[1];
    if (!token) return null;
    return AuthUtils.verifyToken(token);
}

export class PurchaseController {
    /**
     * List Purchase Invoices (Filtered by Company via Supplier -> Account)
     */
    static async listInvoices(req: Request) {
        try {
            const user = await getAuthUser(req);
            if (!user?.companyId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

            const invoices = await prisma.purchaseInvoice.findMany({
                where: {
                    supplier: {
                        payableAccount: {
                            companyId: user.companyId
                        }
                    }
                },
                include: {
                    supplier: true,
                    items: true
                },
                orderBy: { date: 'desc' }
            });

            return NextResponse.json({ success: true, data: invoices });
        } catch (error: any) {
            console.error("List Invoices Error:", error);
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }
    }

    /**
     * List Purchase Orders (Filtered)
     */
    static async listOrders(req: Request) {
        try {
            const user = await getAuthUser(req);
            if (!user?.companyId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

            const orders = await prisma.purchaseOrder.findMany({
                where: {
                    supplier: {
                        payableAccount: {
                            companyId: user.companyId
                        }
                    }
                },
                include: {
                    supplier: true,
                    items: true
                },
                orderBy: { date: 'desc' }
            });

            return NextResponse.json({ success: true, data: orders });
        } catch (error: any) {
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }
    }

    /**
     * List GRNs (Filtered)
     */
    static async listGRNs(req: Request) {
        try {
            const user = await getAuthUser(req);
            if (!user?.companyId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

            const grns = await prisma.gRN.findMany({
                where: {
                    supplier: {
                        payableAccount: {
                            companyId: user.companyId
                        }
                    }
                },
                include: {
                    supplier: true,
                    items: true
                },
                orderBy: { date: 'desc' }
            });

            return NextResponse.json({ success: true, data: grns });
        } catch (error: any) {
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }
    }
}
