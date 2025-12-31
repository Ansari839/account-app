
import { ProductController } from '@/controllers/product.controller';

export async function POST(req: Request) {
    return ProductController.create(req);
}
