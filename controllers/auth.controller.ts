import { NextResponse } from "next/server";
import { AuthService } from "@/services/auth.service";

export class AuthController {
    static async login(req: Request) {
        try {
            const body = await req.json();
            const email = body?.email;
            const password = body?.password;

            if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
                return NextResponse.json({ error: "Email and password are required and must be strings" }, { status: 400 });
            }

            const result = await AuthService.login(email.trim(), password);

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
