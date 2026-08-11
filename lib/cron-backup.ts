/**
 * Backup Engine — Vercel/Serverless Compatible
 *
 * - No node-cron (serverless has no persistent processes)
 * - No fs (Vercel filesystem is read-only)
 * - Backup JSON stored in BackupLog.fileContent (DB)
 * - Triggered via Vercel Cron → /api/cron/backup
 * - GFS rotation approvals work same way
 */

import { BackupService } from '@/services/backup.service';
import { BackupSchedulerService } from '@/services/backup-scheduler.service';
import { BackupStatus, BackupType, ApprovalStatus } from '@prisma/client';

// ─── Stubs for local dev cron engine (not used on Vercel) ───
export function registerCronTask(_schedule: unknown) { /* no-op on Vercel */ }
export function unregisterCronTask(_scheduleId: string) { /* no-op on Vercel */ }
export function stopAllCronBackups() { /* no-op on Vercel */ }
export async function startCronBackups() { /* no-op on Vercel */ }

/**
 * Run a backup for a specific schedule.
 * Called by: Vercel Cron endpoint, or manual trigger API.
 */
export async function runBackupForSchedule(
    schedule: {
        id: string;
        companyId: string | null;
        masterOnly: boolean;
        retainDaily: number;
        retainWeekly: number;
        retainMonthly: number;
        retainQuarterly: number;
        company?: { id: string; name: string } | null;
    },
    triggeredBy: string = 'CRON'
) {
    const logEntry = await BackupSchedulerService.createLog({
        scheduleId: schedule.id,
        companyId: schedule.companyId ?? undefined,
        companyName: schedule.company?.name,
        backupType: BackupType.DAILY,
        status: BackupStatus.IN_PROGRESS,
        triggeredBy,
    });

    try {
        const companyIds = schedule.companyId
            ? [{ id: schedule.companyId, name: schedule.company?.name ?? '' }]
            : await getAllCompanies();

        for (const company of companyIds) {
            await backupSingleCompany({
                scheduleId: schedule.id,
                company,
                masterOnly: schedule.masterOnly,
                triggeredBy,
            });
        }

        await BackupSchedulerService.updateLog(logEntry.id, {
            status: BackupStatus.SUCCESS,
        });

        await checkAndCreateRotationApproval(schedule);

    } catch (err: any) {
        console.error(`[Backup] Error in schedule ${schedule.id}:`, err);
        await BackupSchedulerService.updateLog(logEntry.id, {
            status: BackupStatus.FAILED,
            errorMessage: err.message ?? 'Unknown error',
        });
    }
}

/**
 * Backup a single company — saves JSON to DB (fileContent)
 */
async function backupSingleCompany(options: {
    scheduleId: string;
    company: { id: string; name: string };
    masterOnly: boolean;
    triggeredBy: string;
}) {
    const { company, masterOnly, scheduleId, triggeredBy } = options;

    const backupData = await BackupService.exportCompany(company.id, { masterOnly });
    const jsonStr = JSON.stringify(backupData);
    const sizeBytes = BigInt(Buffer.byteLength(jsonStr, 'utf8'));

    const ts = formatTimestamp();
    const fileName = `backup-daily-${sanitize(company.name)}-${ts}.json`;

    await BackupSchedulerService.createLog({
        scheduleId,
        companyId: company.id,
        companyName: company.name,
        backupType: BackupType.DAILY,
        status: BackupStatus.SUCCESS,
        fileName,
        fileSizeBytes: sizeBytes,
        fileContent: jsonStr,
        triggeredBy,
    });
}

/**
 * Check if a rotation approval is needed (e.g. 7 daily → 1 weekly)
 */
async function checkAndCreateRotationApproval(schedule: {
    id: string;
    companyId: string | null;
    retainDaily: number;
    retainWeekly: number;
    retainMonthly: number;
    retainQuarterly: number;
}) {
    const dayOfWeek = new Date().getDay();
    const isWeekend = dayOfWeek === 5 || dayOfWeek === 6 || dayOfWeek === 0;

    if (isWeekend) {
        const oldDailyLogs = await BackupSchedulerService.getLogsForRotation({
            companyId: schedule.companyId,
            backupType: BackupType.DAILY,
            olderThanDays: schedule.retainDaily,
        });

        if (oldDailyLogs.length > 0) {
            const existingPending = await BackupSchedulerService.getPendingApprovals(schedule.companyId);
            const alreadyPending = existingPending.some(
                a => a.fromType === BackupType.DAILY && a.toType === BackupType.WEEKLY && a.scheduleId === schedule.id
            );
            if (!alreadyPending) {
                const totalSize = oldDailyLogs.reduce((sum, l) => sum + (l.fileSizeBytes ?? BigInt(0)), BigInt(0));
                await BackupSchedulerService.createApproval({
                    scheduleId: schedule.id,
                    fromType: BackupType.DAILY,
                    toType: BackupType.WEEKLY,
                    companyId: schedule.companyId ?? undefined,
                    fileCount: oldDailyLogs.length,
                    totalSizeBytes: totalSize,
                });
            }
        }
    }

    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const isMonthEnd = tomorrow.getMonth() !== today.getMonth();

    if (isMonthEnd) {
        const oldWeeklyLogs = await BackupSchedulerService.getLogsForRotation({
            companyId: schedule.companyId,
            backupType: BackupType.WEEKLY,
            olderThanDays: schedule.retainWeekly * 7,
        });
        if (oldWeeklyLogs.length > 0) {
            const existingPending = await BackupSchedulerService.getPendingApprovals(schedule.companyId);
            const alreadyPending = existingPending.some(
                a => a.fromType === BackupType.WEEKLY && a.toType === BackupType.MONTHLY && a.scheduleId === schedule.id
            );
            if (!alreadyPending) {
                const totalSize = oldWeeklyLogs.reduce((sum, l) => sum + (l.fileSizeBytes ?? BigInt(0)), BigInt(0));
                await BackupSchedulerService.createApproval({
                    scheduleId: schedule.id,
                    fromType: BackupType.WEEKLY,
                    toType: BackupType.MONTHLY,
                    companyId: schedule.companyId ?? undefined,
                    fileCount: oldWeeklyLogs.length,
                    totalSizeBytes: totalSize,
                });
            }
        }
    }
}

/**
 * Execute an approved rotation:
 * Take consolidated backup, delete old logs from DB
 */
export async function executeRotation(approvalId: string) {
    const { default: prisma } = await import('@/lib/prisma');

    const approval = await prisma.backupApproval.findUnique({
        where: { id: approvalId },
        include: { schedule: true },
    });

    if (!approval || approval.status !== ApprovalStatus.PENDING) {
        throw new Error('Approval not found or already resolved');
    }

    const schedule = approval.schedule;
    const companyIds = schedule.companyId
        ? [await getCompanyById(schedule.companyId)].filter(Boolean) as { id: string; name: string }[]
        : await getAllCompanies();

    for (const comp of companyIds) {
        const backupData = await BackupService.exportCompany(comp.id, { masterOnly: schedule.masterOnly });
        const jsonStr = JSON.stringify(backupData);
        const sizeBytes = BigInt(Buffer.byteLength(jsonStr, 'utf8'));
        const ts = formatTimestamp();
        const typeName = approval.toType.toLowerCase();
        const fileName = `backup-${typeName}-${sanitize(comp.name)}-${ts}.json`;

        await BackupSchedulerService.createLog({
            scheduleId: schedule.id,
            companyId: comp.id,
            companyName: comp.name,
            backupType: approval.toType,
            status: BackupStatus.SUCCESS,
            fileName,
            fileSizeBytes: sizeBytes,
            fileContent: jsonStr,
            triggeredBy: 'ROTATION',
        });

        // Delete old logs from DB
        const oldLogs = await BackupSchedulerService.getLogsForRotation({
            companyId: comp.id,
            backupType: approval.fromType,
            olderThanDays: getRetainDays(approval.fromType, schedule),
        });
        for (const log of oldLogs) {
            await BackupSchedulerService.deleteLog(log.id);
        }
    }

    await BackupSchedulerService.resolveApproval(approvalId, ApprovalStatus.APPROVED);
}

// ─── Helpers ─────────────────────────────────────────────────

function getRetainDays(
    type: BackupType,
    schedule: { retainDaily: number; retainWeekly: number; retainMonthly: number; retainQuarterly: number }
): number {
    switch (type) {
        case BackupType.DAILY: return schedule.retainDaily;
        case BackupType.WEEKLY: return schedule.retainWeekly * 7;
        case BackupType.MONTHLY: return schedule.retainMonthly * 30;
        case BackupType.QUARTERLY: return schedule.retainQuarterly * 90;
        default: return 365;
    }
}

function formatTimestamp() {
    const d = new Date();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}-${pad(d.getMinutes())}`;
}
function pad(n: number) { return n.toString().padStart(2, '0'); }
function sanitize(name: string) { return name.replace(/[^a-zA-Z0-9-_]/g, '_'); }

async function getAllCompanies() {
    const { default: prisma } = await import('@/lib/prisma');
    return prisma.company.findMany({ where: { deletedAt: null }, select: { id: true, name: true } });
}

async function getCompanyById(id: string) {
    const { default: prisma } = await import('@/lib/prisma');
    return prisma.company.findUnique({ where: { id }, select: { id: true, name: true } });
}
