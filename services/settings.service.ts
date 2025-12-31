import { prisma } from "@/lib/prisma";

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
}
