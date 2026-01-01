import { NextRequest } from "next/server";
import { SettingsController } from "@/controllers/settings.controller";

export async function GET(req: NextRequest) {
    return SettingsController.getGlobalSettings(req);
}

export async function PUT(req: NextRequest) {
    return SettingsController.updateGlobalSettings(req);
}
