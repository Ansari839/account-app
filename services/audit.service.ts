import prisma from "@/lib/prisma";

export class AuditService {
    /**
     * Log a system action
     */
    static async log(userId: string | null, action: string, module: string, entityId?: string, before?: any, after?: any) {
        return await prisma.auditLog.create({
            data: {
                userId,
                action,
                module,
                entityId,
                beforeState: before ? JSON.parse(JSON.stringify(before)) : undefined,
                afterState: after ? JSON.parse(JSON.stringify(after)) : undefined
            }
        });
    }

    /**
     * Get logs for a module or entity
     */
    static async getLogs(module?: string, entityId?: string) {
        return await prisma.auditLog.findMany({
            where: { module, entityId },
            include: { user: true },
            orderBy: { createdAt: 'desc' },
            take: 100
        });
    }
}
