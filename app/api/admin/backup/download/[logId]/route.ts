import { NextRequest, NextResponse } from 'next/server';
import { AuthUtils } from '@/lib/auth-utils';
import { BackupSchedulerService } from '@/services/backup-scheduler.service';
import fs from 'fs';
import path from 'path';
import prisma from '@/lib/prisma';

// GET /api/admin/backup/download/[logId]
export async function GET(req: NextRequest, { params }: { params: Promise<{ logId: string }> }) {
    try {
        const { logId } = await params;
        const user = await AuthUtils.getAuthUser(req);
        if (!user || !user.isSuperAdmin) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
        }

        const log = await prisma.backupLog.findUnique({ where: { id: logId } });

        if (!log || !log.filePath) {
            return NextResponse.json({ success: false, error: 'Backup file not found' }, { status: 404 });
        }

        const absolutePath = path.resolve(log.filePath);

        if (!fs.existsSync(absolutePath)) {
            return NextResponse.json({ success: false, error: 'File no longer exists on disk' }, { status: 404 });
        }

        const fileBuffer = fs.readFileSync(absolutePath);

        return new NextResponse(fileBuffer, {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Content-Disposition': `attachment; filename="${log.fileName ?? 'backup.json'}"`,
            },
        });
    } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
