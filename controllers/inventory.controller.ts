
import { NextResponse } from 'next/server';
import { ProductService } from '../services/product.service';
import { WarehouseService } from '../services/warehouse.service';
import { CategoryService } from '../services/category.service';
import { UnitService } from '../services/unit.service';
import { AuthUtils } from '@/lib/auth-utils';

export class InventoryController {
    // --- PRODUCTS ---
    static async listProducts(req: Request) {
        try {
            const { companyId, error } = AuthUtils.getCompanyId(req);
            if (error) return error;

            const data = await ProductService.getAllProducts(companyId);
            return NextResponse.json({ success: true, data });
        } catch (e: any) {
            return NextResponse.json({ success: false, error: e.message }, { status: 500 });
        }
    }

    static async createProduct(req: Request) {
        try {
            const { companyId, error } = AuthUtils.getCompanyId(req);
            if (error) return error;

            const body = await req.json();
            const data = await ProductService.createProduct(companyId, body);
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
    static async listWarehouses(req: Request) {
        try {
            const { companyId, error } = AuthUtils.getCompanyId(req);
            if (error) return error;

            const data = await WarehouseService.getAllWarehouses(companyId);
            return NextResponse.json({ success: true, data });
        } catch (e: any) {
            return NextResponse.json({ success: false, error: e.message }, { status: 500 });
        }
    }

    static async createWarehouse(req: Request) {
        try {
            const { companyId, error } = AuthUtils.getCompanyId(req);
            if (error) return error;

            const body = await req.json();
            const data = await WarehouseService.createWarehouse(companyId, body);
            return NextResponse.json({ success: true, data });
        } catch (e: any) {
            return NextResponse.json({ success: false, error: e.message }, { status: 400 });
        }
    }

    static async updateWarehouse(req: Request, id: string) {
        try {
            const { companyId, error } = AuthUtils.getCompanyId(req);
            if (error) return error;

            const body = await req.json();
            const data = await WarehouseService.updateWarehouse(companyId, id, body);
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
    static async listCategories(req: Request) {
        try {
            const { companyId, error } = AuthUtils.getCompanyId(req);
            if (error) return error;

            const data = await CategoryService.list(companyId);
            return NextResponse.json({ success: true, data });
        } catch (e: any) {
            return NextResponse.json({ success: false, error: e.message }, { status: 500 });
        }
    }

    static async createCategory(req: Request) {
        try {
            const { companyId, error } = AuthUtils.getCompanyId(req);
            if (error) return error;

            const body = await req.json();
            const data = await CategoryService.create(companyId, body);
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
    static async listUnits(req: Request) {
        try {
            const { companyId, error } = AuthUtils.getCompanyId(req);
            if (error) return error;

            const data = await UnitService.getAllUnits(companyId);
            return NextResponse.json({ success: true, data });
        } catch (e: any) {
            return NextResponse.json({ success: false, error: e.message }, { status: 500 });
        }
    }

    static async createUnit(req: Request) {
        try {
            const { companyId, error } = AuthUtils.getCompanyId(req);
            if (error) return error;

            const body = await req.json();
            const data = await UnitService.createUnit(companyId, body);
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
