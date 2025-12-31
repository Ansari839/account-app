import { Request, Response } from "express";
import { JournalService } from "../services/journal.service";

export class VoucherController {
    /**
     * Create Manual Journal Entry
     */
    static async createJournal(req: Request, res: Response) {
        try {
            const entry = await JournalService.createEntry(req.body);
            res.json(entry);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }

    /**
     * Get Voucher Details
     */
    static async getVoucher(req: Request, res: Response) {
        try {
            const { number } = req.params;
            const entry = await JournalService.getEntryByNumber(number);
            if (!entry) return res.status(404).json({ error: "Voucher not found" });
            res.json(entry);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }

    /**
     * List all journal entries
     */
    static async listJournals(req: Request, res: Response) {
        try {
            const entries = await JournalService.getEntries({ type: 'JOURNAL' });
            res.json(entries);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }
}
