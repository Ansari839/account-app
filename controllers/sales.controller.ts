import { NextResponse } from 'next/server';
import prisma from "@/lib/prisma";
import { AuthUtils } from '@/lib/auth-utils';
import { SalesService } from '@/services/sales.service';

async function getAuthUser(req: Request) {
    const token = req.headers.get('Authorization')?.split(' ')[1];
    if (!token) return null;
    return AuthUtils.verifyToken(token);
}

// Helper: Resolve Account to Customer (Auto-Link/Create)
async function resolveCustomerId(id: string) {
    // Check if passed ID is an Account
    const account = await prisma.account.findUnique({ where: { id } });

    // If it's NOT an account, assume it's a Customer ID (or invalid) and return as is.
    if (!account) return id;

    // It IS an account. Check for existing linked Customer.
    let customer = await prisma.customer.findFirst({
        where: { receivableAccountId: account.id }
    });

    if (!customer) {
        // Check generic by name
        customer = await prisma.customer.findFirst({
            where: { name: `Cash Customer - ${account.name}`, currencyCode: 'PKR' }
        });

        if (!customer) {
            // Auto-Create
            const lastCustomer = await prisma.customer.findFirst({
                where: { code: { startsWith: 'CUST-' } },
                orderBy: { code: 'desc' }
            });
            let nextSeq = 1;
            if (lastCustomer) {
                const lastNum = parseInt(lastCustomer.code.split('-')[1]);
                if (!isNaN(lastNum)) nextSeq = lastNum + 1;
            }

            try {
                customer = await prisma.customer.create({
                    data: {
                        code: `CUST-${nextSeq.toString().padStart(4, '0')}`,
                        name: `Cash Customer - ${account.name}`,
                        receivableAccountId: account.id,
                        currencyCode: 'PKR'
                    }
                });
            } catch (e) {
                // Fallback
                customer = await prisma.customer.create({
                    data: {
                        code: `CUST-${Date.now()}`,
                        name: `Cash Customer - ${account.name}`,
                        receivableAccountId: account.id,
                        currencyCode: 'PKR'
                    }
                });
            }
        } else if (!customer.receivableAccountId) {
            // Found generic but unlinked? Link it.
            // This safeguards against "Found by name but failing strict check"
            await prisma.customer.update({
                where: { id: customer.id },
                data: { receivableAccountId: account.id }
            });
        }
    }
    return customer.id;
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
                    items: { include: { product: true } }
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
                    items: { include: { product: true } }
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
                    items: { include: { product: true } },
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
            const customerId = await resolveCustomerId(body.customerId);

            const order = await SalesService.createOrder({
                ...body,
                customerId,
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
            const customerId = await resolveCustomerId(body.customerId);

            const dn = await SalesService.createDO({
                ...body,
                customerId,
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
            const customerId = await resolveCustomerId(body.customerId);

            const invoice = await SalesService.createSalesInvoice({
                ...body,
                customerId,
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
            const customerId = await resolveCustomerId(body.customerId);

            const result = await SalesService.createSalesReturn({
                ...body,
                customerId,
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
                    items: { include: { product: true } }
                },
                orderBy: { date: 'desc' }
            });

            return NextResponse.json({ success: true, data: returns });
        } catch (error: any) {
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }
    }
}
