
import { NextResponse } from 'next/server';
import { ProductService } from '../services/product.service';
import { WarehouseService } from '../services/warehouse.service';
import { CategoryService } from '../services/category.service';
import { UnitService } from '../services/unit.service';

export class InventoryController {
    // --- PRODUCTS ---
    static async listProducts() {
        try {
            const data = await ProductService.getAllProducts();
            return NextResponse.json({ success: true, data });
        } catch (e: any) {
            return NextResponse.json({ success: false, error: e.message }, { status: 500 });
        }
    }

    static async createProduct(req: Request) {
        try {
            const body = await req.json();
            const data = await ProductService.createProduct(body);
            return NextResponse.json({ success: true, data });
        } catch (e: any) {
            return NextResponse.json({ success: false, error: e.message }, { status: 400 });
        }
    }

    static async updateProduct(req: Request, id: string) {
        try {
            const body = await req.json();
            const data = await ProductService.updateProduct(id, body);
            return NextResponse.json({ success: true, data });
        } catch (e: any) {
            return NextResponse.json({ success: false, error: e.message }, { status: 400 });
        }
    }

    static async deleteProduct(id: string) {
        try {
            await ProductService.deleteProduct(id);
            return NextResponse.json({ success: true });
        } catch (e: any) {
            return NextResponse.json({ success: false, error: e.message }, { status: 400 });
        }
    }

    // --- WAREHOUSES ---
    static async listWarehouses() {
        try {
            const data = await WarehouseService.getAllWarehouses();
            return NextResponse.json({ success: true, data });
        } catch (e: any) {
            return NextResponse.json({ success: false, error: e.message }, { status: 500 });
        }
    }

    static async createWarehouse(req: Request) {
        try {
            const body = await req.json();
            const data = await WarehouseService.createWarehouse(body);
            return NextResponse.json({ success: true, data });
        } catch (e: any) {
            return NextResponse.json({ success: false, error: e.message }, { status: 400 });
        }
    }

    static async updateWarehouse(req: Request, id: string) {
        try {
            const body = await req.json();
            const data = await WarehouseService.updateWarehouse(id, body);
            return NextResponse.json({ success: true, data });
        } catch (e: any) {
            return NextResponse.json({ success: false, error: e.message }, { status: 400 });
        }
    }

    static async deleteWarehouse(id: string) {
        try {
            await WarehouseService.deleteWarehouse(id);
            return NextResponse.json({ success: true });
        } catch (e: any) {
            return NextResponse.json({ success: false, error: e.message }, { status: 400 });
        }
    }

    // --- CATEGORIES ---
    static async listCategories() {
        try {
            const data = await CategoryService.list();
            return NextResponse.json({ success: true, data });
        } catch (e: any) {
            return NextResponse.json({ success: false, error: e.message }, { status: 500 });
        }
    }

    static async createCategory(req: Request) {
        try {
            const body = await req.json();
            const data = await CategoryService.create(body);
            return NextResponse.json({ success: true, data });
        } catch (e: any) {
            return NextResponse.json({ success: false, error: e.message }, { status: 400 });
        }
    }

    static async updateCategory(req: Request, id: string) {
        try {
            const body = await req.json();
            const data = await CategoryService.update(id, body);
            return NextResponse.json({ success: true, data });
        } catch (e: any) {
            return NextResponse.json({ success: false, error: e.message }, { status: 400 });
        }
    }

    static async deleteCategory(id: string) {
        try {
            await CategoryService.delete(id);
            return NextResponse.json({ success: true });
        } catch (e: any) {
            return NextResponse.json({ success: false, error: e.message }, { status: 400 });
        }
    }

    // --- UNITS ---
    static async listUnits() {
        try {
            const data = await UnitService.getAllUnits();
            return NextResponse.json({ success: true, data });
        } catch (e: any) {
            return NextResponse.json({ success: false, error: e.message }, { status: 500 });
        }
    }

    static async createUnit(req: Request) {
        try {
            const body = await req.json();
            const data = await UnitService.createUnit(body);
            return NextResponse.json({ success: true, data });
        } catch (e: any) {
            return NextResponse.json({ success: false, error: e.message }, { status: 400 });
        }
    }

    static async updateUnit(req: Request, id: string) {
        try {
            const body = await req.json();
            const data = await UnitService.updateUnit(id, body);
            return NextResponse.json({ success: true, data });
        } catch (e: any) {
            return NextResponse.json({ success: false, error: e.message }, { status: 400 });
        }
    }

    static async deleteUnit(id: string) {
        try {
            await UnitService.deleteUnit(id);
            return NextResponse.json({ success: true });
        } catch (e: any) {
            return NextResponse.json({ success: false, error: e.message }, { status: 400 });
        }
    }
}
