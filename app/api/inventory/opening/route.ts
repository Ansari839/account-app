import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { AuthUtils } from '@/lib/auth-utils';
import crypto from 'crypto';

export async function GET(req: Request) {
    try {
        const { companyId, error } = AuthUtils.getCompanyId(req);
        if (error) return error;

        const entries = await prisma.stockLedger.findMany({
            where: {
                companyId,
                refType: 'OPENING_STOCK'
            },
            include: {
                Product: {
                    include: {
                        Unit: true,
                        Category: true
                    }
                },
                Warehouse: true
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        const formatted = entries.map(e => {
            let origin = 'LOCAL';
            let isEFS = e.isEFS || false;
            let displayBatch = e.batchNo || '';

            if (displayBatch.includes('[EFS]') || e.isEFS) {
                origin = 'IMPORT';
                isEFS = true;
            } else if (displayBatch.includes('[IMPORT]')) {
                origin = 'IMPORT';
                isEFS = false;
            }

            return {
                id: e.id,
                productId: e.productId,
                productName: e.Product?.name || 'Unknown',
                productCode: e.Product?.code || '',
                isService: e.Product?.isService || false,
                warehouseId: e.warehouseId,
                warehouseName: e.Warehouse?.name || 'Warehouse',
                unitName: e.Product?.Unit?.name || 'Unit',
                date: e.date,
                qty: Number(e.qtyIn),
                costRate: Number(e.costRate),
                itpRate: Number(e.itpRate || 0),
                totalValue: Number(e.qtyIn) * Number(e.costRate),
                stage: e.stage || 'RAW',
                origin,
                isEFS,
                batchNo: e.batchNo
            };
        });

        return NextResponse.json({ success: true, data: formatted });
    } catch (err: any) {
        console.error('Fetch Opening Stock Error:', err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const { companyId, error } = AuthUtils.getCompanyId(req);
        if (error) return error;

        const body = await req.json();
        const {
            productId,
            warehouseId,
            stage = 'RAW',
            origin = 'LOCAL',
            isEFS = false,
            qty,
            costRate,
            itpRate = 0,
            batchNo = '',
            date
        } = body;

        if (!productId) {
            return NextResponse.json({ success: false, error: 'Product is required' }, { status: 400 });
        }
        if (!warehouseId) {
            return NextResponse.json({ success: false, error: 'Warehouse is required' }, { status: 400 });
        }
        if (Number(qty) <= 0) {
            return NextResponse.json({ success: false, error: 'Quantity must be greater than 0' }, { status: 400 });
        }

        const tagPrefix = origin === 'IMPORT' ? (isEFS ? '[EFS]' : '[IMPORT]') : '[LOCAL]';
        const formattedBatch = batchNo ? `${tagPrefix} ${batchNo}` : tagPrefix;

        const entry = await prisma.stockLedger.create({
            data: {
                id: crypto.randomUUID(),
                companyId,
                productId,
                warehouseId,
                date: new Date(date || new Date()),
                qtyIn: Number(qty),
                qtyOut: 0,
                costRate: Number(costRate || 0),
                itpRate: origin === 'IMPORT' ? Number(itpRate || 0) : 0,
                stage: stage as any,
                isEFS: origin === 'IMPORT' ? Boolean(isEFS) : false,
                batchNo: formattedBatch,
                refType: 'OPENING_STOCK',
                refId: crypto.randomUUID()
            },
            include: {
                Product: true,
                Warehouse: true
            }
        });

        return NextResponse.json({ success: true, data: entry });
    } catch (err: any) {
        console.error('Create Opening Stock Error:', err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    try {
        const { companyId, error } = AuthUtils.getCompanyId(req);
        if (error) return error;

        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');
        if (!id) {
            return NextResponse.json({ success: false, error: 'ID is required' }, { status: 400 });
        }

        await prisma.stockLedger.delete({
            where: {
                id,
                companyId,
                refType: 'OPENING_STOCK'
            }
        });

        return NextResponse.json({ success: true, message: 'Opening stock removed' });
    } catch (err: any) {
        console.error('Delete Opening Stock Error:', err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
