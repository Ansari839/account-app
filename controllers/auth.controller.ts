import { NextResponse } from "next/server";
import { AuthService } from "@/services/auth.service";

export class AuthController {
    static async login(req: Request) {
        try {
            const { email, password } = await req.json();

            if (!email || !password) {
                return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
            }

            const result = await AuthService.login(email, password);

            if (!result) {
                return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
            }

            return NextResponse.json({
                success: true,
                data: {
                    token: result.token,
                    user: result.user,
                    companies: result.companies,
                }
            });
        } catch (error: any) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }
    }
}
