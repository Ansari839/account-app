import { NextRequest } from "next/server";
import { SettingsController } from "@/controllers/settings.controller";

export async function GET(req: NextRequest) {
    return SettingsController.getCompanyProfile(req);
}

export async function PUT(req: NextRequest) {
    return SettingsController.updateCompanyProfile(req);
}
