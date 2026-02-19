
import { NextResponse } from 'next/server';
import { ProductService } from '@/services/product.service';
import { AuthUtils } from '@/lib/auth-utils';

export class ProductController {
    static async getAll(req: Request) {
        try {
            const { companyId, error } = AuthUtils.getCompanyId(req);
            if (error) return error;

            const products = await ProductService.getAllProducts(companyId);
            return NextResponse.json({ success: true, data: products });
        } catch (error: any) {
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }
    }

    static async create(req: Request) {
        try {
            const { companyId, error } = AuthUtils.getCompanyId(req);
            if (error) return error;

            const body = await req.json();
            const product = await ProductService.createProduct(companyId, body);
            return NextResponse.json({ success: true, data: product });
        } catch (error: any) {
            return NextResponse.json({ success: false, error: error.message }, { status: 400 });
        }
    }
}
