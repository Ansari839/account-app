import { NextRequest, NextResponse } from 'next/server';
import { AuthUtils } from '@/lib/auth-utils';
import { BackupSchedulerService } from '@/services/backup-scheduler.service';
import { BackupFrequency } from '@prisma/client';
import { registerCronTask, unregisterCronTask } from '@/lib/cron-backup';

// GET /api/admin/backup/schedule
export async function GET(req: NextRequest) {
    const user = await AuthUtils.getAuthUser(req);
    if (!user || !user.isSuperAdmin) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }
    const schedules = await BackupSchedulerService.getSchedules(null);
    return NextResponse.json({ success: true, data: schedules });
}

// POST /api/admin/backup/schedule
export async function POST(req: NextRequest) {
    try {
        const user = await AuthUtils.getAuthUser(req);
        if (!user || !user.isSuperAdmin) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
        }

        const body = await req.json();
        const { frequency, cronTime, storagePath, masterOnly, retainDaily, retainWeekly, retainMonthly, retainQuarterly } = body;

        const schedule = await BackupSchedulerService.createSchedule({
            companyId: null,
            frequency: frequency as BackupFrequency,
            cronTime: cronTime || '0 2 * * *',
            storagePath: storagePath || './backups',
            masterOnly: masterOnly ?? false,
            retainDaily: retainDaily ?? 7,
            retainWeekly: retainWeekly ?? 4,
            retainMonthly: retainMonthly ?? 3,
            retainQuarterly: retainQuarterly ?? 4,
        });

        // Register in running cron engine
        registerCronTask({ ...schedule, company: null });

        return NextResponse.json({ success: true, data: schedule }, { status: 201 });
    } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
