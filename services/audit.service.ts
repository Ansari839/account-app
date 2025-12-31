import { prisma } from "@/lib/prisma";

/**
 * Service to handle system-wide audit logging.
 * Captures critical information about write operations and security events.
 */
export class AuditService {
    /**
     * Log an action to the database.
     * 
     * @param userId - ID of the user performing the action (optional for system events)
     * @param action - Action name (e.g., "CREATE_USER", "POST_INVOICE")
     * @param module - Module related to the action (e.g., "AUTH", "SALES")
     * @param entityId - ID of the entity being affected
     * @param data - { before: any, after: any } snapshot of the data
     * @param ipAddress - IP address of the requestor
     */
    static async logAction(params: {
        userId?: string;
        action: string;
        module: string;
        entityId?: string;
        before?: any;
        after?: any;
        ipAddress?: string;
    }) {
        try {
            await prisma.auditLog.create({
                data: {
                    userId: params.userId,
                    action: params.action,
                    module: params.module,
                    entityId: params.entityId,
                    beforeState: params.before ? (params.before) : undefined,
                    afterState: params.after ? (params.after) : undefined,
                    ipAddress: params.ipAddress,
                },
            });
        } catch (error) {
            console.error("Failed to write audit log:", error);
            // Failsafe: Do not block main thread if audit fails, but log to stderr
        }
    }
}
