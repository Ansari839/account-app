import { NextRequest } from 'next/server';
import { PurchaseController } from '@/controllers/purchase.controller';

export async function GET(req: NextRequest) {
    return PurchaseController.listOrders(req);
}

export async function POST(req: NextRequest) {
    return PurchaseController.createOrder(req);
}
