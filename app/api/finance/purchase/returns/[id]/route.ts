
import { NextRequest, NextResponse } from "next/server";
import { AuthUtils } from "@/lib/auth-utils";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const user = await AuthUtils.getAuthUser(req);
        if (!user?.companyId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

        const purchaseReturn = await prisma.purchaseReturn.findUnique({
            where: { id },
            include: {
                supplier: true,
                warehouse: true,
                invoice: true,
                items: {
                    include: { product: true }
                }
            }
        });

        if (!purchaseReturn) return NextResponse.json({ success: false, error: "Return not found" }, { status: 404 });

        return NextResponse.json({ success: true, data: purchaseReturn });

    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

// DELETE logic could be complex (reverting stock, etc.), leaving out for now unless requested specifically.
