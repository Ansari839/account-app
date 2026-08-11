import { NextRequest, NextResponse } from 'next/server';
import { BackupSchedulerService } from '@/services/backup-scheduler.service';
import { runBackupForSchedule } from '@/lib/cron-backup';

/**
 * Vercel Cron Job endpoint — called by Vercel on schedule defined in vercel.json
 * Vercel passes Authorization: Bearer <CRON_SECRET> header for security
 */
export async function GET(req: NextRequest) {
    // Verify Vercel cron secret
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const schedules = await BackupSchedulerService.getAllActiveSchedules();

        if (schedules.length === 0) {
            return NextResponse.json({ success: true, message: 'No active schedules' });
        }

        const results = [];
        for (const schedule of schedules) {
            try {
                await runBackupForSchedule(schedule, 'CRON');
                results.push({ scheduleId: schedule.id, status: 'success' });
            } catch (err: any) {
                results.push({ scheduleId: schedule.id, status: 'error', error: err.message });
            }
        }

        return NextResponse.json({ success: true, ran: results.length, results });
    } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
