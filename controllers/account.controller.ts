
import { NextResponse } from 'next/server';
import { AccountService } from '@/services/account.service';
import { AuthUtils } from '@/lib/auth-utils';

export class AccountController {
    static async getHierarchy(req: Request) {
        try {
            const { companyId, error } = AuthUtils.getCompanyId(req);
            if (error) return error;

            const hierarchy = await AccountService.getAccountHierarchy(companyId);
            return NextResponse.json({ success: true, data: hierarchy });
        } catch (error: any) {
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }
    }

    static async create(req: Request) {
        try {
            const { companyId, error } = AuthUtils.getCompanyId(req);
            if (error) return error;

            const body = await req.json();
            const account = await AccountService.createAccount(companyId, body);
            return NextResponse.json({ success: true, data: account });
        } catch (error: any) {
            return NextResponse.json({ success: false, error: error.message }, { status: 400 });
        }
    }

    static async update(req: Request, { params }: { params: Promise<{ id: string }> }) {
        try {
            const { id } = await params;
            const body = await req.json();
            const account = await AccountService.updateAccount(id, body);
            return NextResponse.json({ success: true, data: account });
        } catch (error: any) {
            return NextResponse.json({ success: false, error: error.message }, { status: 400 });
        }
    }

    static async delete(req: Request, { params }: { params: Promise<{ id: string }> }) {
        try {
            const { id } = await params;
            await AccountService.deleteAccount(id);
            return NextResponse.json({ success: true, message: 'Account deleted successfully' });
        } catch (error: any) {
            return NextResponse.json({ success: false, error: error.message }, { status: 400 });
        }
    }

    static async setupDefault(req: Request) {
        try {
            const { companyId, error } = AuthUtils.getCompanyId(req);
            if (error) return error;

            const result = await AccountService.setupDefaultCOA(companyId);
            return NextResponse.json({ success: true, data: result });
        } catch (error: any) {
            return NextResponse.json({ success: false, error: error.message }, { status: 400 });
        }
    }

    static async getPostingAccounts(req: Request) {
        try {
            const { companyId, error } = AuthUtils.getCompanyId(req);
            if (error) return error;

            const { searchParams } = new URL(req.url);
            const type = searchParams.get('type') as any;

            const accounts = await AccountService.getPostingAccounts(companyId, type);
            return NextResponse.json({ success: true, data: accounts });
        } catch (error: any) {
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }
    }
}
