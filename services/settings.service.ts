import prisma from "@/lib/prisma";

export class CompanySettingsService {
    /**
     * Retrieve a setting by its key for a specific company.
     */
    static async get(companyId: string, key: string): Promise<string | null> {
        const setting = await prisma.companySetting.findUnique({
            where: { companyId_key: { companyId, key } },
        });
        return setting ? setting.value : null;
    }

    /**
     * Set or update a company setting.
     */
    static async set(companyId: string, key: string, value: string, type: string = "STRING") {
        return prisma.companySetting.upsert({
            where: { companyId_key: { companyId, key } },
            update: { value, type },
            create: { companyId, key, value, type },
        });
    }

    /**
     * Get a boolean setting, with a default fallback.
     */
    static async getBoolean(companyId: string, key: string, defaultValue: boolean = false): Promise<boolean> {
        const val = await this.get(companyId, key);
        if (val === null) return defaultValue;
        return val === "true";
    }

    /**
     * Get all settings by group for a company
     */
    static async getGroup(companyId: string, group: string) {
        const settings = await prisma.companySetting.findMany({
            where: { companyId, group }
        });
        return settings.reduce((acc: any, s) => {
            acc[s.key] = s.value;
            return acc;
        }, {});
    }

    /**
     * List all settings for a company
     */
    static async listAll(companyId: string) {
        return await prisma.companySetting.findMany({
            where: { companyId },
            orderBy: { group: 'asc' }
        });
    }

    /**
     * Update multiple settings at once for a company
     */
    static async updateMany(companyId: string, settings: Record<string, string>) {
        const promises = Object.entries(settings).map(([key, value]) =>
            this.set(companyId, key, value)
        );
        return await Promise.all(promises);
    }
}
