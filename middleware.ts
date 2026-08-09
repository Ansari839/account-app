import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { AuthUtils } from "./lib/auth-utils";


// Routes that don't need auth
const PUBLIC_ROUTES = ["/api/auth/login", "/api/public", "/api/test-db"];

// Routes that need auth but NOT a company context
const NO_COMPANY_ROUTES = ["/api/auth/change-password", "/api/user/companies"];

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
    if (payload.mustChangePass && !path.includes("/change-password")) {
        return NextResponse.json(
            { error: "Password change required." },
            { status: 403 }
        );
    }

    // 4. Inject user info into headers
    const response = NextResponse.next();
    response.headers.set("x-user-id", payload.userId);

    // 5. Company Context Validation
    // Skip company validation for routes that don't need it
    if (NO_COMPANY_ROUTES.some((route) => path.startsWith(route))) {
        return response;
    }

    const companyId = request.headers.get("x-company-id");
    if (companyId) {
        // Pass company ID through to downstream handlers
        response.headers.set("x-company-id", companyId);
    }

    // Note: Deep company access validation (DB check) is done at the service layer
    // because Edge middleware cannot reliably access the database.
    // The middleware only passes through the header; controllers verify access.

    return response;
}

export const config = {
    matcher: "/api/:path*",
};
