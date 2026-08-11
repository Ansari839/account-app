/**
 * Cron Backup Engine
 * Handles scheduled backups with GFS (Grandfather-Father-Son) rotation:
 *   Daily → Weekly → Monthly → Quarterly → Yearly
 *
 * Started once via instrumentation.ts on server boot.
 */

import cron, { ScheduledTask } from 'node-cron';
import fs from 'fs';
import path from 'path';
import { BackupService } from '@/services/backup.service';
import { BackupSchedulerService } from '@/services/backup-scheduler.service';
import { BackupStatus, BackupType, ApprovalStatus } from '@prisma/client';

// Track running cron tasks so we can restart them when schedules change
const activeTasks = new Map<string, ScheduledTask>();

/**
 * Start all active cron schedules from DB
 */
export async function startCronBackups() {
    console.log('[CronBackup] Starting cron backup engine...');
    const schedules = await BackupSchedulerService.getAllActiveSchedules();
    for (const schedule of schedules) {
        registerCronTask(schedule);
    }
    console.log(`[CronBackup] ${schedules.length} schedule(s) registered.`);
}

/**
 * Stop all running cron tasks
 */
export function stopAllCronBackups() {
    for (const [id, task] of activeTasks.entries()) {
        task.stop();
        activeTasks.delete(id);
    }
    console.log('[CronBackup] All cron tasks stopped.');
}

/**
 * Register a single schedule as a cron task
 */
export function registerCronTask(schedule: {
    id: string;
    cronTime: string;
    companyId: string | null;
    storagePath: string;
    masterOnly: boolean;
    retainDaily: number;
    retainWeekly: number;
    retainMonthly: number;
    retainQuarterly: number;
    company?: { id: string; name: string } | null;
}) {
    // Stop existing task for this schedule if running
    if (activeTasks.has(schedule.id)) {
        activeTasks.get(schedule.id)!.stop();
        activeTasks.delete(schedule.id);
    }

    if (!cron.validate(schedule.cronTime)) {
        console.warn(`[CronBackup] Invalid cron expression for schedule ${schedule.id}: ${schedule.cronTime}`);
        return;
    }

    const task = cron.schedule(schedule.cronTime, async () => {
        console.log(`[CronBackup] Running backup for schedule ${schedule.id}`);
        await runBackupForSchedule(schedule);
    });

    activeTasks.set(schedule.id, task);
}

/**
 * Remove a cron task by schedule ID (on delete/disable)
 */
export function unregisterCronTask(scheduleId: string) {
    if (activeTasks.has(scheduleId)) {
        activeTasks.get(scheduleId)!.stop();
        activeTasks.delete(scheduleId);
    }
}

/**
 * Run a backup for a specific schedule (called by cron or manually)
 */
export async function runBackupForSchedule(schedule: {
    id: string;
    companyId: string | null;
    storagePath: string;
    masterOnly: boolean;
    retainDaily: number;
    retainWeekly: number;
    retainMonthly: number;
    retainQuarterly: number;
    company?: { id: string; name: string } | null;
}, triggeredBy: string = 'CRON') {

    // Create an in-progress log entry
    const logEntry = await BackupSchedulerService.createLog({
        scheduleId: schedule.id,
        companyId: schedule.companyId ?? undefined,
        companyName: schedule.company?.name,
        backupType: BackupType.DAILY,
        status: BackupStatus.IN_PROGRESS,
        triggeredBy,
    });

    try {
        // Determine which companies to back up
        const companyIds = schedule.companyId
            ? [{ id: schedule.companyId, name: schedule.company?.name ?? '' }]
            : await getAllCompanies();

        const storagePath = schedule.storagePath || './backups';

        for (const company of companyIds) {
            await backupSingleCompany({
                scheduleId: schedule.id,
                company,
                storagePath,
                masterOnly: schedule.masterOnly,
                triggeredBy,
                retainDaily: schedule.retainDaily,
                retainWeekly: schedule.retainWeekly,
                retainMonthly: schedule.retainMonthly,
                retainQuarterly: schedule.retainQuarterly,
            });
        }

        // Update the main log to SUCCESS
        await BackupSchedulerService.updateLog(logEntry.id, {
            status: BackupStatus.SUCCESS,
        });

        // After successful daily backup, check if rotation approval is needed
        await checkAndCreateRotationApproval(schedule);

    } catch (err: any) {
        console.error(`[CronBackup] Error in schedule ${schedule.id}:`, err);
        await BackupSchedulerService.updateLog(logEntry.id, {
            status: BackupStatus.FAILED,
            errorMessage: err.message ?? 'Unknown error',
        });
    }
}

/**
 * Backup a single company and save the JSON file
 */
async function backupSingleCompany(options: {
    scheduleId: string;
    company: { id: string; name: string };
    storagePath: string;
    masterOnly: boolean;
    triggeredBy: string;
    retainDaily: number;
    retainWeekly: number;
    retainMonthly: number;
    retainQuarterly: number;
}) {
    const { company, storagePath, masterOnly, scheduleId, triggeredBy } = options;

    // Ensure directory exists
    const companyDir = path.join(storagePath, sanitize(company.name));
    ensureDir(companyDir);

    // Generate filename: backup-daily-YYYY-MM-DD-HH-mm.json
    const ts = formatTimestamp();
    const fileName = `backup-daily-${ts}.json`;
    const filePath = path.join(companyDir, fileName);

    // Export company data
    const backupData = await BackupService.exportCompany(company.id, { masterOnly });
    const jsonStr = JSON.stringify(backupData, null, 2);

    // Write file
    fs.writeFileSync(filePath, jsonStr, 'utf8');
    const stats = fs.statSync(filePath);

    // Create log
    await BackupSchedulerService.createLog({
        scheduleId,
        companyId: company.id,
        companyName: company.name,
        backupType: BackupType.DAILY,
        status: BackupStatus.SUCCESS,
        filePath,
        fileName,
        fileSizeBytes: BigInt(stats.size),
        triggeredBy,
    });
}

/**
 * Check if a rotation approval is needed (e.g., 7 daily files → create weekly)
 * Creates a BackupApproval record — admin must approve via UI to proceed
 */
async function checkAndCreateRotationApproval(schedule: {
    id: string;
    companyId: string | null;
    retainDaily: number;
    retainWeekly: number;
    retainMonthly: number;
    retainQuarterly: number;
}) {
    const dayOfWeek = new Date().getDay(); // 0=Sun, 5=Fri, 6=Sat
    const isWeekend = dayOfWeek === 5 || dayOfWeek === 6 || dayOfWeek === 0;

    if (isWeekend) {
        // Check daily logs that are older than retainDaily days
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
                console.log(`[CronBackup] Rotation approval created: DAILY → WEEKLY for schedule ${schedule.id}`);
            }
        }
    }

    // Monthly rotation check (end of month)
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
 * Execute an approved rotation: take consolidated backup, delete old files
 */
export async function executeRotation(approvalId: string) {
    const approval = await getApprovalById(approvalId);
    if (!approval || approval.status !== ApprovalStatus.PENDING) {
        throw new Error('Approval not found or already resolved');
    }

    const schedule = approval.schedule;
    const company = schedule.companyId
        ? await getCompanyById(schedule.companyId)
        : null;

    const storagePath = schedule.storagePath || './backups';

    // Step 1: Take consolidated backup of the toType level
    const companyIds = schedule.companyId
        ? [{ id: schedule.companyId, name: company?.name ?? '' }]
        : await getAllCompanies();

    for (const comp of companyIds) {
        const companyDir = path.join(storagePath, sanitize(comp.name));
        ensureDir(companyDir);

        const ts = formatTimestamp();
        const typeName = approval.toType.toLowerCase();
        const fileName = `backup-${typeName}-${ts}.json`;
        const filePath = path.join(companyDir, fileName);

        const backupData = await BackupService.exportCompany(comp.id, { masterOnly: schedule.masterOnly });
        fs.writeFileSync(filePath, JSON.stringify(backupData, null, 2), 'utf8');
        const stats = fs.statSync(filePath);

        const newLog = await BackupSchedulerService.createLog({
            scheduleId: schedule.id,
            companyId: comp.id,
            companyName: comp.name,
            backupType: approval.toType,
            status: BackupStatus.SUCCESS,
            filePath,
            fileName,
            fileSizeBytes: BigInt(stats.size),
            triggeredBy: 'ROTATION',
        });

        // Step 2: Delete old files of fromType
        const oldLogs = await BackupSchedulerService.getLogsForRotation({
            companyId: comp.id,
            backupType: approval.fromType,
            olderThanDays: getRetainDays(approval.fromType, schedule),
        });

        for (const log of oldLogs) {
            if (log.filePath && fs.existsSync(log.filePath)) {
                fs.unlinkSync(log.filePath);
            }
            await BackupSchedulerService.deleteLog(log.id);
        }

        // Link new log to approval
        await BackupSchedulerService.updateLog(newLog.id, {});
    }

    // Resolve approval
    await BackupSchedulerService.resolveApproval(approvalId, ApprovalStatus.APPROVED);
}

// ─── Helpers ─────────────────────────────────────────────────

function getRetainDays(type: BackupType, schedule: { retainDaily: number; retainWeekly: number; retainMonthly: number; retainQuarterly: number }): number {
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

function sanitize(name: string) {
    return name.replace(/[^a-zA-Z0-9-_]/g, '_');
}

function ensureDir(dirPath: string) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}

async function getAllCompanies() {
    const { default: prisma } = await import('@/lib/prisma');
    return prisma.company.findMany({
        where: { deletedAt: null },
        select: { id: true, name: true }
    });
}

async function getCompanyById(id: string) {
    const { default: prisma } = await import('@/lib/prisma');
    return prisma.company.findUnique({ where: { id }, select: { id: true, name: true } });
}

async function getApprovalById(id: string) {
    const { default: prisma } = await import('@/lib/prisma');
    return prisma.backupApproval.findUnique({
        where: { id },
        include: {
            schedule: true,
        }
    });
}
