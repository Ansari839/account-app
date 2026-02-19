import { NextResponse } from 'next/server';
import prisma from "@/lib/prisma";
import { AuthUtils } from '@/lib/auth-utils';
import { CompanySettingsService } from '../services/settings.service';

export class SettingsController {
    // --- Company Settings (Feature Toggles) ---

    static async getCompanySettings(req: Request) {
        try {
            const { companyId, error } = AuthUtils.getCompanyId(req);
            if (error) return error;

            const settings = await CompanySettingsService.listAll(companyId);
            return NextResponse.json({ success: true, data: settings });
        } catch (error: any) {
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }
    }

    static async updateCompanySettings(req: Request) {
        try {
            const { companyId, error } = AuthUtils.getCompanyId(req);
            if (error) return error;

            const body = await req.json();
            await CompanySettingsService.updateMany(companyId, body);
            return NextResponse.json({ success: true });
        } catch (error: any) {
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }
    }

    // --- Company Profile ---

    static async getCompanyProfile(req: Request) {
        try {
            const { companyId, error } = AuthUtils.getCompanyId(req);
            if (error) return error;

            const company = await prisma.company.findUnique({ where: { id: companyId } });
            return NextResponse.json({ success: true, data: company });
        } catch (error: any) {
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }
    }

    static async updateCompanyProfile(req: Request) {
        try {
            const { companyId, error } = AuthUtils.getCompanyId(req);
            if (error) return error;

            const body = await req.json();
            const company = await prisma.company.update({
                where: { id: companyId },
                data: {
                    name: body.name,
                    address: body.address,
                    phone: body.phone,
                    email: body.email,
                    website: body.website
                }
            });

            return NextResponse.json({ success: true, data: company });
        } catch (error: any) {
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }
    }
}
