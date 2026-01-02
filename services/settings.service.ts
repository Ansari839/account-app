import prisma from "@/lib/prisma";

export class GlobalSettingsService {
    /**
     * Retrieve a setting by its key.
     * @param key - Unique key of the setting
     * @returns Value string or null if not found
     */
    static async get(key: string): Promise<string | null> {
        const setting = await prisma.globalSetting.findUnique({
            where: { key },
        });
        return setting ? setting.value : null;
    }

    /**
     * Set or update a global setting.
     * @param key - Unique key
     * @param value - Value to store
     * @param type - simple type annotation (STRING, BOOLEAN, JSON)
     */
    static async set(key: string, value: string, type: string = "STRING") {
        return prisma.globalSetting.upsert({
            where: { key },
            update: { value, type },
            create: { key, value, type },
        });
    }

    /**
     * Get a boolean setting, with a default fallback.
     */
    static async getBoolean(key: string, defaultValue: boolean = false): Promise<boolean> {
        const val = await this.get(key);
        if (val === null) return defaultValue;
        return val === "true";
    }

    /**
     * Get all settings by group
     */
    static async getGroup(group: string) {
        const settings = await prisma.globalSetting.findMany({
            where: { group }
        });
        return settings.reduce((acc: any, s) => {
            acc[s.key] = s.value;
            return acc;
        }, {});
    }

    /**
     * List all settings grouped
     */
    static async listAll() {
        return await prisma.globalSetting.findMany({
            orderBy: { group: 'asc' }
        });
    }

    /**
     * Update multiple settings at once
     */
    static async updateMany(settings: Record<string, string>) {
        const promises = Object.entries(settings).map(([key, value]) =>
            this.set(key, value)
        );
        return await Promise.all(promises);
    }
}
