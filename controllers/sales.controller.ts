import { NextResponse } from 'next/server';
import prisma from "@/lib/prisma";
import { AuthUtils } from '@/lib/auth-utils';
import { SalesService } from '@/services/sales.service';

async function getAuthUser(req: Request) {
    const token = req.headers.get('Authorization')?.split(' ')[1];
    if (!token) return null;
    return AuthUtils.verifyToken(token);
}

export class SalesController {
    /**
     * List Sales Invoices (Filtered by Company via Customer -> Account)
     */
    static async listInvoices(req: Request) {
        try {
            const user = await getAuthUser(req);
            if (!user?.companyId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

            const invoices = await prisma.salesInvoice.findMany({
                where: {
                    customer: {
                        receivableAccount: {
                            companyId: user.companyId
                        }
                    }
                },
                include: {
                    customer: true,
                    warehouse: true,
                    items: { include: { product: true, unit: true } }
                },
                orderBy: { date: 'desc' }
            });

            return NextResponse.json({ success: true, data: invoices });
        } catch (error: any) {
            console.error("List Sales Invoices Error:", error);
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }
    }

    /**
     * List Sales Orders
     */
    static async listOrders(req: Request) {
        try {
            const user = await getAuthUser(req);
            if (!user?.companyId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

            const orders = await prisma.salesOrder.findMany({
                where: {
                    customer: {
                        receivableAccount: {
                            companyId: user.companyId
                        }
                    }
                },
                include: {
                    customer: true,
                    warehouse: true,
                    items: { include: { product: true, unit: true } }
                },
                orderBy: { date: 'desc' }
            });

            return NextResponse.json({ success: true, data: orders });
        } catch (error: any) {
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }
    }

    /**
     * List Delivery Orders (Delivery Notes)
     */
    static async listDeliveryNotes(req: Request) {
        try {
            const user = await getAuthUser(req);
            if (!user?.companyId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

            const dns = await prisma.deliveryOrder.findMany({
                where: {
                    customer: {
                        receivableAccount: {
                            companyId: user.companyId
                        }
                    }
                },
                include: {
                    customer: true,
                    warehouse: true,
                    items: { include: { product: true, unit: true } },
                    order: { select: { orderNo: true } }
                },
                orderBy: { date: 'desc' }
            });

            return NextResponse.json({ success: true, data: dns });
        } catch (error: any) {
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }
    }

    /**
     * Create Sales Order
     */
    static async createOrder(req: Request) {
        try {
            const user = await getAuthUser(req);
            if (!user?.companyId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

            const body = await req.json();
            const order = await SalesService.createOrder({
                ...body,
                date: new Date(body.date),
                expectedDate: body.expectedDate ? new Date(body.expectedDate) : undefined,
                quoteId: body.quoteId || null,
                warehouseId: body.warehouseId || null
            });

            return NextResponse.json({ success: true, data: order });
        } catch (error: any) {
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }
    }

    /**
     * Create Delivery Note (DO)
     */
    static async createDeliveryNote(req: Request) {
        try {
            const user = await getAuthUser(req);
            if (!user?.companyId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

            const body = await req.json();
            const dn = await SalesService.createDO({
                ...body,
                date: new Date(body.date),
                orderId: body.orderId || null
            });

            return NextResponse.json({ success: true, data: dn });
        } catch (error: any) {
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }
    }

    /**
     * Create Sales Invoice
     */
    static async createInvoice(req: Request) {
        try {
            const user = await getAuthUser(req);
            if (!user?.companyId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

            const body = await req.json();
            const invoice = await SalesService.createSalesInvoice({
                ...body,
                date: new Date(body.date),
                dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
                doId: body.doId || null,
                warehouseId: body.warehouseId || null
            });

            return NextResponse.json({ success: true, data: invoice });
        } catch (error: any) {
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }
    }

    /**
     * Create Sales Return
     */
    static async createReturn(req: Request) {
        try {
            const user = await getAuthUser(req);
            if (!user?.companyId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

            const body = await req.json();
            const result = await SalesService.createSalesReturn({
                ...body,
                date: new Date(body.date),
                warehouseId: body.warehouseId || null
            });

            return NextResponse.json({ success: true, data: result });
        } catch (error: any) {
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }
    }

    /**
     * List Sales Returns
     */
    static async listReturns(req: Request) {
        try {
            const user = await getAuthUser(req);
            if (!user?.companyId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

            const returns = await prisma.salesReturn.findMany({
                where: {
                    customer: {
                        receivableAccount: {
                            companyId: user.companyId
                        }
                    }
                },
                include: {
                    customer: true,
                    warehouse: true,
                    invoice: { select: { invoiceNo: true } },
                    items: { include: { product: true, unit: true } }
                },
                orderBy: { date: 'desc' }
            });

            return NextResponse.json({ success: true, data: returns });
        } catch (error: any) {
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }
    }
}
