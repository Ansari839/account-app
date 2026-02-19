import { NextResponse } from 'next/server';
import prisma from "@/lib/prisma";
import { AuthUtils } from '@/lib/auth-utils';
import { SalesService } from '@/services/sales.service';

// Helper: Resolve Account to Customer (Auto-Link/Create)
async function resolveCustomerId(companyId: string, id: string) {
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
                        companyId,
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
                        companyId,
                        code: `CUST-${Date.now()}`,
                        name: `Cash Customer - ${account.name}`,
                        receivableAccountId: account.id,
                        currencyCode: 'PKR'
                    }
                });
            }
        } else if (!customer.receivableAccountId) {
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
     * List Sales Invoices (Filtered by Company)
     */
    static async listInvoices(req: Request) {
        try {
            const { companyId, error } = AuthUtils.getCompanyId(req);
            if (error) return error;

            const invoices = await prisma.salesInvoice.findMany({
                where: { companyId },
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
            const { companyId, error } = AuthUtils.getCompanyId(req);
            if (error) return error;

            const orders = await prisma.salesOrder.findMany({
                where: { companyId },
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
            const { companyId, error } = AuthUtils.getCompanyId(req);
            if (error) return error;

            const dns = await prisma.deliveryOrder.findMany({
                where: { companyId },
                include: {
                    customer: true,
                    warehouse: true,
                    items: { include: { product: true } },
                    order: { select: { orderNo: true } },
                    invoices: { select: { id: true } }
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
            const { companyId, error } = AuthUtils.getCompanyId(req);
            if (error) return error;

            const body = await req.json();
            const customerId = await resolveCustomerId(companyId, body.customerId);

            const order = await SalesService.createOrder({
                ...body,
                companyId,
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
            const { companyId, error } = AuthUtils.getCompanyId(req);
            if (error) return error;

            const body = await req.json();
            const customerId = await resolveCustomerId(companyId, body.customerId);

            const dn = await SalesService.createDO({
                ...body,
                companyId,
                customerId,
                date: new Date(body.date),
                orderId: body.orderId || null,
                items: body.items.map((it: any) => ({
                    productId: it.productId,
                    variantId: it.variantId || null,
                    unitId: it.unitId || null,
                    orderItemId: it.orderItemId || null,
                    qtyShipped: Number(it.qtyShipped)
                }))
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
            const { companyId, error } = AuthUtils.getCompanyId(req);
            if (error) return error;

            const body = await req.json();
            const customerId = await resolveCustomerId(companyId, body.customerId);

            const invoice = await SalesService.createSalesInvoice({
                ...body,
                companyId,
                customerId,
                date: new Date(body.date),
                dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
                doId: body.doId || null,
                orderId: body.orderId || null,
                warehouseId: body.warehouseId || null,
                trackingNo: body.trackingNo || null,
                trackingUrl: body.trackingUrl || null,
                items: body.items.map((it: any) => ({
                    productId: it.productId,
                    variantId: it.variantId || null,
                    unitId: it.unitId || null,
                    soItemId: it.soItemId || null,
                    qty: Number(it.qty),
                    rate: Number(it.rate),
                    taxCodeId: it.taxCodeId || null
                }))
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
            const { companyId, error } = AuthUtils.getCompanyId(req);
            if (error) return error;

            const body = await req.json();
            const customerId = await resolveCustomerId(companyId, body.customerId);

            const result = await SalesService.createSalesReturn({
                ...body,
                companyId,
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
            const { companyId, error } = AuthUtils.getCompanyId(req);
            if (error) return error;

            const returns = await prisma.salesReturn.findMany({
                where: { companyId },
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

    /**
     * Get Single Sales Order
     */
    static async getOrder(req: Request, { params }: { params: Promise<{ id: string }> }) {
        try {
            const { id } = await params;

            const order = await prisma.salesOrder.findUnique({
                where: { id },
                include: {
                    customer: true,
                    warehouse: true,
                    items: { include: { product: true } },
                    deliveryOrders: { include: { items: true } },
                    invoices: { include: { items: true } }
                }
            });

            if (!order) return NextResponse.json({ success: false, error: "Order not found" }, { status: 404 });
            return NextResponse.json({ success: true, data: order });
        } catch (error: any) {
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }
    }

    /**
     * Delete Sales Order
     */
    static async deleteOrder(req: Request, { params }: { params: Promise<{ id: string }> }) {
        try {
            const { id } = await params;

            await SalesService.deleteOrder(id);
            return NextResponse.json({ success: true });
        } catch (error: any) {
            return NextResponse.json({ success: false, error: error.message }, { status: 400 });
        }
    }

    /**
     * Get Single Delivery Note
     */
    static async getDeliveryNote(req: Request, { params }: { params: Promise<{ id: string }> }) {
        try {
            const { id } = await params;

            const dn = await prisma.deliveryOrder.findUnique({
                where: { id },
                include: {
                    customer: true,
                    warehouse: true,
                    order: true,
                    items: { include: { product: true } },
                    invoices: true
                }
            });

            if (!dn) return NextResponse.json({ success: false, error: "Delivery Note not found" }, { status: 404 });
            return NextResponse.json({ success: true, data: dn });
        } catch (error: any) {
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }
    }

    /**
     * Delete Delivery Note
     */
    static async deleteDeliveryNote(req: Request, { params }: { params: Promise<{ id: string }> }) {
        try {
            const { id } = await params;

            await SalesService.deleteDO(id);
            return NextResponse.json({ success: true });
        } catch (error: any) {
            return NextResponse.json({ success: false, error: error.message }, { status: 400 });
        }
    }

    /**
     * Get Single Sales Invoice
     */
    static async getInvoice(req: Request, { params }: { params: Promise<{ id: string }> }) {
        try {
            const { id } = await params;

            const invoice = await prisma.salesInvoice.findUnique({
                where: { id },
                include: {
                    customer: true,
                    warehouse: true,
                    order: true,
                    do: true,
                    items: { include: { product: true } },
                    journalEntry: { include: { lines: { include: { account: true } } } }
                }
            });

            if (!invoice) return NextResponse.json({ success: false, error: "Invoice not found" }, { status: 404 });
            return NextResponse.json({ success: true, data: invoice });
        } catch (error: any) {
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }
    }

    /**
     * Delete Sales Invoice
     */
    static async deleteInvoice(req: Request, { params }: { params: Promise<{ id: string }> }) {
        try {
            const { id } = await params;

            await SalesService.deleteSalesInvoice(id);
            return NextResponse.json({ success: true });
        } catch (error: any) {
            return NextResponse.json({ success: false, error: error.message }, { status: 400 });
        }
    }
}
