import { NextRequest, NextResponse } from 'next/server';
import { AuthUtils } from '@/lib/auth-utils';
import { BackupSchedulerService } from '@/services/backup-scheduler.service';

// GET /api/admin/backup/logs
export async function GET(req: NextRequest) {
    try {
        const user = await AuthUtils.getAuthUser(req);
        if (!user || !user.isSuperAdmin) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
        }

        const { searchParams } = new URL(req.url);
        const companyId = searchParams.get('companyId') ?? undefined;
        const scheduleId = searchParams.get('scheduleId') ?? undefined;
        const limit = parseInt(searchParams.get('limit') ?? '50');

        const logs = await BackupSchedulerService.getLogs({ companyId, scheduleId, limit });

        // Convert BigInt to string for JSON serialization
        const serializable = logs.map(l => ({
            ...l,
            fileSizeBytes: l.fileSizeBytes ? l.fileSizeBytes.toString() : null,
            approval: l.approval ? {
                ...l.approval,
                totalSizeBytes: l.approval.totalSizeBytes ? l.approval.totalSizeBytes.toString() : null,
            } : null,
        }));

        return NextResponse.json({ success: true, data: serializable });
    } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
