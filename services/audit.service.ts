import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export class AuditService {
    /**
     * Log a system action (with optional companyId)
     */
    static async log(userId: string | null, action: string, module: string, entityId?: string, before?: any, after?: any, companyId?: string, txClient?: Prisma.TransactionClient) {
        const client = txClient || prisma;
        return await client.auditLog.create({
            data: {
                userId,
                action,
                module,
                entityId,
                companyId,
                beforeState: before ? JSON.parse(JSON.stringify(before)) : undefined,
                afterState: after ? JSON.parse(JSON.stringify(after)) : undefined
            }
        });
    }

    /**
     * Get logs for a module or entity (scoped to company)
     */
    static async getLogs(companyId: string, module?: string, entityId?: string) {
        return await prisma.auditLog.findMany({
            where: { companyId, module, entityId },
            include: { user: true },
            orderBy: { createdAt: 'desc' },
            take: 100
        });
    }
}
