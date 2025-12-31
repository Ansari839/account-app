import { NextResponse } from 'next/server';
import { JournalService } from "../services/journal.service";

export class VoucherController {
    /**
     * Create Manual Journal Entry
     */
    static async createJournal(req: Request) {
        try {
            const body = await req.json();
            const entry = await JournalService.createEntry(body);
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
            const { number } = params;
            const entry = await JournalService.getEntryByNumber(number);
            if (!entry) return NextResponse.json({ success: false, error: "Voucher not found" }, { status: 404 });
            return NextResponse.json({ success: true, data: entry });
        } catch (error: any) {
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }
    }

    /**
     * List all journal entries
     */
    static async listJournals() {
        try {
            const entries = await JournalService.getEntries({ type: 'JOURNAL' });
            return NextResponse.json({ success: true, data: entries });
        } catch (error: any) {
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }
    }
}
