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
                    user: {
                        id: result.user.id,
                        email: result.user.email,
                        fullName: result.user.fullName,
                    }
                }
            });
        } catch (error: any) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }
    }
}
