import { NextResponse } from 'next/server';
import { JournalService } from "../services/journal.service";
import { AuthUtils } from '@/lib/auth-utils';

export class VoucherController {
    /**
     * Create Manual Journal Entry
     */
    static async createJournal(req: Request) {
        try {
            const { companyId, error } = AuthUtils.getCompanyId(req);
            if (error) return error;

            const body = await req.json();
            const entry = await JournalService.createEntry({ ...body, companyId });
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
            const { companyId, error } = AuthUtils.getCompanyId(req);
            if (error) return error;

            const { number } = params;
            const entry = await JournalService.getEntryByNumber(companyId, number);

            // Tenant check - verify the journal entry belongs to this company
            if (entry && entry.companyId !== companyId) {
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
            const { companyId, error } = AuthUtils.getCompanyId(req);
            if (error) return error;

            // Extract type from query params
            const { searchParams } = new URL(req.url);
            const type = searchParams.get('type') || 'JOURNAL';

            const entries = await JournalService.getEntries(companyId, { type: type.toUpperCase() as any });
            return NextResponse.json({ success: true, data: entries });
        } catch (error: any) {
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }
    }
}
