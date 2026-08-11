import { NextRequest, NextResponse } from 'next/server';
import { AuthUtils } from '@/lib/auth-utils';
import { BackupSchedulerService } from '@/services/backup-scheduler.service';
import { runBackupForSchedule } from '@/lib/cron-backup';
import { BackupStatus, BackupType } from '@prisma/client';

// GET /api/company/backup/logs
export async function GET(req: NextRequest) {
    try {
        const user = await AuthUtils.getAuthUser(req);
        if (!user || !user.companyId) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
        }

        const logs = await BackupSchedulerService.getLogs({ companyId: user.companyId, limit: 30 });

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

// POST /api/company/backup/logs — manual trigger backup now
export async function POST(req: NextRequest) {
    try {
        const user = await AuthUtils.getAuthUser(req);
        if (!user || !user.companyId) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
        }

        const body = await req.json();
        const { scheduleId } = body;

        if (!scheduleId) {
            return NextResponse.json({ success: false, error: 'scheduleId required' }, { status: 400 });
        }

        const schedule = await BackupSchedulerService.getScheduleById(scheduleId);
        if (!schedule || schedule.companyId !== user.companyId) {
            return NextResponse.json({ success: false, error: 'Schedule not found' }, { status: 404 });
        }

        // Run immediately in background (don't await — return fast)
        runBackupForSchedule(schedule, 'MANUAL').catch(console.error);

        return NextResponse.json({ success: true, message: 'Backup started' });
    } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
