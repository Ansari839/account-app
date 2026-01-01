import { NextResponse } from 'next/server';
import prisma from "@/lib/prisma";
import { AuthUtils } from '@/lib/auth-utils';
import { GlobalSettingsService } from '../services/settings.service';

async function getAuthUser(req: Request) {
    const token = req.headers.get('Authorization')?.split(' ')[1];
    if (!token) return null;
    return AuthUtils.verifyToken(token);
}

export class SettingsController {
    // --- Global Settings (Feature Toggles) ---

    static async getGlobalSettings(req: Request) {
        try {
            // In a real app, maybe restrict to Admin
            const settings = await GlobalSettingsService.getAll();
            return NextResponse.json({ success: true, data: settings });
        } catch (error: any) {
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }
    }

    static async updateGlobalSettings(req: Request) {
        try {
            const user = await getAuthUser(req);
            // Verify Admin role here if needed

            const body = await req.json();
            // Body expected: { "SETTING_KEY": "value", ... }
            await GlobalSettingsService.updateMany(body);
            return NextResponse.json({ success: true });
        } catch (error: any) {
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }
    }

    // --- Company Profile ---

    static async getCompanyProfile(req: Request) {
        try {
            const user = await getAuthUser(req);
            if (!user?.companyId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

            const company = await prisma.company.findUnique({ where: { id: user.companyId } });
            return NextResponse.json({ success: true, data: company });
        } catch (error: any) {
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }
    }

    static async updateCompanyProfile(req: Request) {
        try {
            const user = await getAuthUser(req);
            if (!user?.companyId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

            const body = await req.json();
            const company = await prisma.company.update({
                where: { id: user.companyId },
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
