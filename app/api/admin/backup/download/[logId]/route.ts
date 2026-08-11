import { NextRequest, NextResponse } from 'next/server';
import { AuthUtils } from '@/lib/auth-utils';
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

        if (!log) {
            return NextResponse.json({ success: false, error: 'Backup log not found' }, { status: 404 });
        }

        // Serve from DB fileContent (Vercel compatible)
        if (log.fileContent) {
            return new NextResponse(log.fileContent, {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Disposition': `attachment; filename="${log.fileName ?? 'backup.json'}"`,
                },
            });
        }

        return NextResponse.json({ success: false, error: 'No file content available' }, { status: 404 });
    } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
