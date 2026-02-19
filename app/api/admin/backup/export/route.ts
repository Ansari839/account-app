import { NextRequest, NextResponse } from "next/server";
import { AuthUtils } from "@/lib/auth-utils";
import { BackupService } from "@/services/backup.service";

export async function GET(req: NextRequest) {
    try {
        const user = await AuthUtils.getAuthUser(req);
        if (!user || !user.isSuperAdmin) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
        }

        const { searchParams } = new URL(req.url);
        const companyId = searchParams.get('companyId');
        const masterOnly = searchParams.get('masterOnly') === 'true';

        if (!companyId) {
            return NextResponse.json({ success: false, error: "Company ID required" }, { status: 400 });
        }

        const data = await BackupService.exportCompany(companyId, { masterOnly });

        // Return as downloadable file
        const type = masterOnly ? 'master' : 'full';
        return new NextResponse(JSON.stringify(data, null, 2), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Content-Disposition': `attachment; filename="backup-${type}-${data.metadata.companyName}-${new Date().toISOString().split('T')[0]}.json"`
            }
        });

    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
