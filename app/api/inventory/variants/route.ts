import { NextRequest, NextResponse } from "next/server";
import { VariantService } from "@/services/variant.service";

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const productId = searchParams.get('productId');

    if (productId) {
        const variants = await VariantService.getVariantsByProduct(productId);
        return NextResponse.json({ success: true, data: variants });
    }

    return NextResponse.json({ success: false, error: "productId is required" }, { status: 400 });
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const variant = await VariantService.createVariant(body);
        return NextResponse.json({ success: true, data: variant });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }
}

export async function PUT(req: NextRequest) {
    try {
        const body = await req.json();
        const { id, ...data } = body;
        if (!id) throw new Error("id is required");
        const variant = await VariantService.updateVariant(id, data);
        return NextResponse.json({ success: true, data: variant });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }
}

export async function DELETE(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');
        if (!id) throw new Error("id is required");
        await VariantService.deleteVariant(id);
        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }
}
