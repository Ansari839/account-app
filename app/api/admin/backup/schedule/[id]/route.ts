import { NextRequest, NextResponse } from 'next/server';
import { AuthUtils } from '@/lib/auth-utils';
import { BackupSchedulerService } from '@/services/backup-scheduler.service';
import { BackupFrequency } from '@prisma/client';
import { registerCronTask, unregisterCronTask } from '@/lib/cron-backup';

// PUT /api/admin/backup/schedule/[id]
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const user = await AuthUtils.getAuthUser(req);
        if (!user || !user.isSuperAdmin) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
        }

        const body = await req.json();
        const schedule = await BackupSchedulerService.updateSchedule(id, {
            frequency: body.frequency as BackupFrequency,
            cronTime: body.cronTime,
            storagePath: body.storagePath,
            masterOnly: body.masterOnly,
            isActive: body.isActive,
            retainDaily: body.retainDaily,
            retainWeekly: body.retainWeekly,
            retainMonthly: body.retainMonthly,
            retainQuarterly: body.retainQuarterly,
        });

        if (schedule.isActive) {
            registerCronTask({ ...schedule, company: null });
        } else {
            unregisterCronTask(schedule.id);
        }

        return NextResponse.json({ success: true, data: schedule });
    } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}

// DELETE /api/admin/backup/schedule/[id]
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const user = await AuthUtils.getAuthUser(req);
        if (!user || !user.isSuperAdmin) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
        }

        unregisterCronTask(id);
        await BackupSchedulerService.deleteSchedule(id);

        return NextResponse.json({ success: true });
    } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
