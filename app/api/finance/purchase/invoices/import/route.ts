import { NextRequest, NextResponse } from 'next/server';
import { PurchaseController } from '@/controllers/purchase.controller';

export async function POST(req: NextRequest) {
    return PurchaseController.createImportInvoice(req);
}
