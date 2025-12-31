import { NextResponse } from "next/server";
import { AuthUtils } from "@/lib/auth-utils";
import { AuditService } from "@/services/audit.service";

export async function POST(req: Request) {
    try {
        const token = req.headers.get("Authorization")?.split(" ")[1];
        if (!token) {
            return NextResponse.json({ success: true }); // Already logged out or no token
        }

        const payload = await AuthUtils.verifyToken(token);
        if (payload) {
            await AuditService.log(payload.userId, "LOGOUT", "AUTH");
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("Logout Error:", error);
        return NextResponse.json({ success: true }); // Still return success to allow client cleanup
    }
}
