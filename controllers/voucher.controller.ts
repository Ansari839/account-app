import { NextResponse } from 'next/server';
import { JournalService } from "../services/journal.service";
import { AuthUtils } from '@/lib/auth-utils';

async function getAuthUser(req: Request) {
    const token = req.headers.get('Authorization')?.split(' ')[1];
    if (!token) return null;
    return AuthUtils.verifyToken(token);
}

export class VoucherController {
    /**
     * Create Manual Journal Entry
     */
    static async createJournal(req: Request) {
        try {
            const user = await getAuthUser(req);
            if (!user?.companyId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

            const body = await req.json();
            const entry = await JournalService.createEntry({ ...body, companyId: user.companyId });
            return NextResponse.json({ success: true, data: entry });
        } catch (error: any) {
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }
    }

    /**
     * Get Voucher Details
     */
    static async getVoucher(req: Request, { params }: { params: { number: string } }) {
        try {
            const user = await getAuthUser(req);
            if (!user?.companyId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

            const { number } = params;
            const entry = await JournalService.getEntryByNumber(number);

            // Basic tenant check - check if any line belongs to user's company
            if (entry && entry.lines.some((l: any) => l.account.companyId !== user.companyId)) {
                return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
            }

            if (!entry) return NextResponse.json({ success: false, error: "Voucher not found" }, { status: 404 });
            return NextResponse.json({ success: true, data: entry });
        } catch (error: any) {
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }
    }

    /**
     * List all journal entries
     */
    static async listJournals(req: Request) {
        try {
            const user = await getAuthUser(req);
            if (!user?.companyId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

            const entries = await JournalService.getEntries(user.companyId, { type: 'JOURNAL' });
            return NextResponse.json({ success: true, data: entries });
        } catch (error: any) {
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }
    }
}
