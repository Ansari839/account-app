import prisma from "@/lib/prisma";
import { BackupFrequency, BackupType, BackupStatus, ApprovalStatus } from "@prisma/client";

export class BackupSchedulerService {

    // ─── Schedule CRUD ───────────────────────────────────────

    static async getSchedules(companyId?: string | null) {
        return prisma.backupSchedule.findMany({
            where: companyId ? { companyId } : { companyId: null },
            include: {
                company: { select: { name: true } },
                _count: { select: { logs: true } }
            },
            orderBy: { createdAt: 'desc' }
        });
    }

    static async getScheduleById(id: string) {
        return prisma.backupSchedule.findUnique({
            where: { id },
            include: { company: { select: { id: true, name: true } } }
        });
    }

    static async createSchedule(data: {
        companyId?: string | null;
        frequency: BackupFrequency;
        cronTime: string;
        storagePath: string;
        masterOnly: boolean;
        retainDaily: number;
        retainWeekly: number;
        retainMonthly: number;
        retainQuarterly: number;
    }) {
        return prisma.backupSchedule.create({ data });
    }

    static async updateSchedule(id: string, data: Partial<{
        frequency: BackupFrequency;
        cronTime: string;
        storagePath: string;
        masterOnly: boolean;
        isActive: boolean;
        retainDaily: number;
        retainWeekly: number;
        retainMonthly: number;
        retainQuarterly: number;
    }>) {
        return prisma.backupSchedule.update({ where: { id }, data });
    }

    static async deleteSchedule(id: string) {
        return prisma.backupSchedule.delete({ where: { id } });
    }

    static async getAllActiveSchedules() {
        return prisma.backupSchedule.findMany({
            where: { isActive: true },
            include: { company: { select: { id: true, name: true } } }
        });
    }

    // ─── Backup Logs ──────────────────────────────────────────

    static async getLogs(options: { companyId?: string; scheduleId?: string; limit?: number }) {
        return prisma.backupLog.findMany({
            where: {
                ...(options.companyId ? { companyId: options.companyId } : {}),
                ...(options.scheduleId ? { scheduleId: options.scheduleId } : {}),
            },
            orderBy: { createdAt: 'desc' },
            take: options.limit ?? 50,
            include: { approval: true }
        });
    }

    static async createLog(data: {
        scheduleId?: string;
        companyId?: string;
        companyName?: string;
        backupType: BackupType;
        status: BackupStatus;
        filePath?: string;
        fileName?: string;
        fileSizeBytes?: bigint;
        fileContent?: string;
        errorMessage?: string;
        triggeredBy: string;
    }) {
        return prisma.backupLog.create({ data });
    }

    static async updateLog(id: string, data: Partial<{
        status: BackupStatus;
        filePath: string;
        fileName: string;
        fileSizeBytes: bigint;
        fileContent: string;
        errorMessage: string;
    }>) {
        return prisma.backupLog.update({ where: { id }, data });
    }

    // ─── Retention / Rotation ────────────────────────────────

    /**
     * Get logs of a specific type that are older than retainCount
     * Used to find daily logs that should be purged in favor of a weekly
     */
    static async getLogsForRotation(options: {
        companyId: string | null;
        backupType: BackupType;
        olderThanDays: number;
    }) {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - options.olderThanDays);

        return prisma.backupLog.findMany({
            where: {
                ...(options.companyId ? { companyId: options.companyId } : { companyId: null }),
                backupType: options.backupType,
                status: BackupStatus.SUCCESS,
                createdAt: { lt: cutoff }
            },
            orderBy: { createdAt: 'asc' }
        });
    }

    static async deleteLog(id: string) {
        return prisma.backupLog.delete({ where: { id } });
    }

    // ─── Approvals ────────────────────────────────────────────

    static async getPendingApprovals(companyId?: string | null) {
        return prisma.backupApproval.findMany({
            where: {
                status: ApprovalStatus.PENDING,
                ...(companyId !== undefined ? { companyId: companyId ?? null } : {})
            },
            include: {
                schedule: { include: { company: { select: { name: true } } } },
                log: true
            },
            orderBy: { requestedAt: 'desc' }
        });
    }

    static async createApproval(data: {
        scheduleId: string;
        logId?: string;
        fromType: BackupType;
        toType: BackupType;
        companyId?: string | null;
        fileCount: number;
        totalSizeBytes?: bigint;
    }) {
        return prisma.backupApproval.create({ data });
    }

    static async resolveApproval(id: string, status: ApprovalStatus) {
        return prisma.backupApproval.update({
            where: { id },
            data: { status, resolvedAt: new Date() }
        });
    }
}
