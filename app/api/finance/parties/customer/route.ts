
import { PartyController } from '@/controllers/party.controller';

export async function POST(req: Request) {
    return PartyController.createCustomer(req);
}
