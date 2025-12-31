
import prisma from "../lib/prisma";
import { TaxCode } from '@/app/generated/prisma/client';

export class TaxService {
    /**
     * Create a new Tax Code
     */
    static async createTaxCode(data: {
        name: string;
        code: string;
        rate: number;
    }) {
        if (data.rate < 0) {
            throw new Error("Tax rate cannot be negative.");
        }

        return prisma.taxCode.create({
            data: {
                name: data.name,
                code: data.code,
                rate: data.rate,
            },
        });
    }

    /**
     * Get all Tax Codes
     */
    static async getAllTaxCodes() {
        return prisma.taxCode.findMany({
            orderBy: { name: 'asc' }
        });
    }
}
