import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { AuthUtils } from "./lib/auth-utils";


// Routes that don't need auth
const PUBLIC_ROUTES = ["/api/auth/login", "/api/public"];

export async function middleware(request: NextRequest) {
    const path = request.nextUrl.pathname;

    // 1. Skip Public Routes
    if (PUBLIC_ROUTES.some((route) => path.startsWith(route))) {
        return NextResponse.next();
    }

    // 2. Auth Check (JWT)
    const token = request.headers.get("Authorization")?.split(" ")[1];
    if (!token) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = await AuthUtils.verifyToken(token);
    if (!payload) {
        return NextResponse.json({ error: "Invalid Token" }, { status: 401 });
    }

    // 3. Force Password Change Guard
    // Allow only change-password route if flag is set
    if (payload.mustChangePass && !path.includes("/change-password")) {
        return NextResponse.json(
            { error: "Password change required." },
            { status: 403 }
        );
    }

    // 4. Financial Year Lock (Moved to Service Layer)
    // Middleware should not call DB directly in Edge Runtime.


    // Inject user info into headers for downstream processing (optional)
    const response = NextResponse.next();
    response.headers.set("x-user-id", payload.userId);
    return response;
}

export const config = {
    matcher: "/api/:path*",
};
