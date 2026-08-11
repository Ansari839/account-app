import { NextRequest, NextResponse } from 'next/server';
import { AuthUtils } from '@/lib/auth-utils';
import { BackupSchedulerService } from '@/services/backup-scheduler.service';
import { executeRotation } from '@/lib/cron-backup';
import { ApprovalStatus } from '@prisma/client';

// GET /api/admin/backup/approvals — list pending approvals
export async function GET(req: NextRequest) {
    try {
        const user = await AuthUtils.getAuthUser(req);
        if (!user || !user.isSuperAdmin) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
        }

        const approvals = await BackupSchedulerService.getPendingApprovals(null);

        const serializable = approvals.map(a => ({
            ...a,
            totalSizeBytes: a.totalSizeBytes ? a.totalSizeBytes.toString() : null,
            log: a.log ? {
                ...a.log,
                fileSizeBytes: a.log.fileSizeBytes ? a.log.fileSizeBytes.toString() : null,
            } : null,
        }));

        return NextResponse.json({ success: true, data: serializable });
    } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}

// POST /api/admin/backup/approvals — approve or reject rotation
export async function POST(req: NextRequest) {
    try {
        const user = await AuthUtils.getAuthUser(req);
        if (!user || !user.isSuperAdmin) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
        }

        const { approvalId, action } = await req.json();

        if (!approvalId || !['approve', 'reject'].includes(action)) {
            return NextResponse.json({ success: false, error: 'Invalid request' }, { status: 400 });
        }

        if (action === 'approve') {
            await executeRotation(approvalId);
        } else {
            await BackupSchedulerService.resolveApproval(approvalId, ApprovalStatus.REJECTED);
        }

        return NextResponse.json({ success: true });
    } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
