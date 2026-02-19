
import { ProductController } from '@/controllers/product.controller';

export async function GET(req: Request) {
    return ProductController.getAll(req);
}

export async function POST(req: Request) {
    return ProductController.create(req);
}
