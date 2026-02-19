import { NextRequest, NextResponse } from "next/server";
import { AuthUtils } from "@/lib/auth-utils";
import { BackupService } from "@/services/backup.service";

export async function POST(req: NextRequest) {
    try {
        const user = await AuthUtils.getAuthUser(req);
        if (!user || !user.isSuperAdmin) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
        }

        const body = await req.json();
        const { targetCompanyId, backupData } = body;

        if (!targetCompanyId || !backupData) {
            return NextResponse.json({ success: false, error: "Target Company ID and Backup Data required" }, { status: 400 });
        }

        await BackupService.restoreCompany(targetCompanyId, backupData);

        return NextResponse.json({ success: true, message: "Company data restored successfully" });

    } catch (error: any) {
        console.error("Restore failed:", error);
        return NextResponse.json({ success: false, error: error.message || "msg failed" }, { status: 500 });
    }
}
