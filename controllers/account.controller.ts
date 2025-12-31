
import { NextResponse } from 'next/server';
import { AccountService } from '@/services/account.service';

export class AccountController {
    static async getHierarchy() {
        try {
            const hierarchy = await AccountService.getAccountHierarchy();
            return NextResponse.json({ success: true, data: hierarchy });
        } catch (error: any) {
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }
    }

    static async create(req: Request) {
        try {
            const body = await req.json();
            // Basic validation could go here or Zod
            const account = await AccountService.createAccount(body);
            return NextResponse.json({ success: true, data: account });
        } catch (error: any) {
            return NextResponse.json({ success: false, error: error.message }, { status: 400 });
        }
    }

    static async getPostingAccounts(req: Request) {
        try {
            // Extract query param 'type' if needed
            const { searchParams } = new URL(req.url);
            const type = searchParams.get('type') as any;

            const accounts = await AccountService.getPostingAccounts(type);
            return NextResponse.json({ success: true, data: accounts });
        } catch (error: any) {
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }
    }
}
