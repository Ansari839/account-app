
import { NextResponse } from 'next/server';
import { ProductService } from '@/services/product.service';

export class ProductController {
    static async create(req: Request) {
        try {
            const body = await req.json();
            const product = await ProductService.createProduct(body);
            return NextResponse.json({ success: true, data: product });
        } catch (error: any) {
            return NextResponse.json({ success: false, error: error.message }, { status: 400 });
        }
    }
}
