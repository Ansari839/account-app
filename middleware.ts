import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { AuthUtils } from "./lib/auth-utils";
import { jwtVerify } from "jose";

const JWT_SECRET = process.env.JWT_SECRET || 'default_secret_CHANGE_ME_IN_PROD';

// Routes that don't need auth
const PUBLIC_ROUTES = [
    "/auth/login",
    "/auth/register",
    "/_next/",
    "/favicon.ico",
    "/api/auth/login",
    "/api/auth/register",
    "/api/test-db"
];

// Paths that need auth JWT but NOT company session
const NO_COMPANY_ROUTES = [
    "/auth/select-company",
    "/api/user/companies",
    "/api/auth/company-session",
    "/api/auth/clear-session",
    "/api/auth/change-password",
    "/api/auth/logout"
];

const MODULE_ROUTES: Record<string, string> = {
    '/finance/coa': 'chart-of-accounts',
    '/finance/vouchers': 'vouchers',
    '/finance/purchase': 'purchase',
    '/finance/sales': 'sales',
    '/inventory': 'inventory',
    '/finance/reports': 'reports'
};

export async function middleware(request: NextRequest) {
    const path = request.nextUrl.pathname;

    // 1. If public path → skip
    if (PUBLIC_ROUTES.some((route) => path.startsWith(route) || path === route)) {
        return NextResponse.next();
    }

    // 2. For API routes (/api/*): existing logic (check Authorization header JWT)
    if (path.startsWith('/api/')) {
        const token = request.headers.get("Authorization")?.split(" ")[1];
        if (!token) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const payload = await AuthUtils.verifyToken(token);
        if (!payload) {
            return NextResponse.json({ error: "Invalid Token" }, { status: 401 });
        }

        /* Temporarily disable until change-password is implemented
        if (payload.mustChangePass && !path.includes("/change-password")) {
            return NextResponse.json(
                { error: "Password change required." },
                { status: 403 }
            );
        }
        */

        const response = NextResponse.next();
        response.headers.set("x-user-id", payload.userId);

        if (NO_COMPANY_ROUTES.some((route) => path.startsWith(route))) {
            return response;
        }

        const companyId = request.headers.get("x-company-id");
        if (companyId) {
            response.headers.set("x-company-id", companyId);
        }
        return response;
    }

    // 3. For page routes (non-/api):
    const sessionCookie = request.cookies.get('__session')?.value;

    if (!sessionCookie && !path.startsWith('/auth/')) {
        return NextResponse.redirect(new URL('/auth/login', request.url));
    }

    if (!sessionCookie && path.startsWith('/auth/')) {
        return NextResponse.next();
    }

    if (sessionCookie) {
        try {
            const secret = new TextEncoder().encode(JWT_SECRET);
            const { payload } = await jwtVerify(sessionCookie, secret);
            const { role, permissions } = payload as { 
                userId: string; 
                companyId: string; 
                role: string; 
                permissions: string[] | null; 
            };

            // /admin/settings* → requires ADMIN/OWNER/SUPER_ADMIN role
            if (path.startsWith('/admin/settings')) {
                if (role !== 'ADMIN' && role !== 'OWNER' && role !== 'SUPER_ADMIN') {
                    return NextResponse.redirect(new URL('/finance/dashboard?error=access_denied', request.url));
                }
                return NextResponse.next();
            }

            // /admin/* → requires SUPER_ADMIN
            if (path.startsWith('/admin/')) {
                if (role !== 'SUPER_ADMIN') {
                    return NextResponse.redirect(new URL('/finance/dashboard?error=access_denied', request.url));
                }
                return NextResponse.next();
            }

            // check required module
            let requiredModule: string | null = null;
            for (const [route, moduleName] of Object.entries(MODULE_ROUTES)) {
                if (path.startsWith(route)) {
                    requiredModule = moduleName;
                    break;
                }
            }

            if (requiredModule) {
                if (role === 'SUPER_ADMIN' || role === 'ADMIN' || role === 'OWNER') {
                    return NextResponse.next();
                }

                if (role === 'USER') {
                    const requiredPermission = `${requiredModule}.VIEW`;
                    const hasAccess = Array.isArray(permissions) && (
                        permissions.includes(requiredPermission) || 
                        permissions.some(p => p.startsWith(`${requiredModule}.`) && p.endsWith('.VIEW'))
                    );
                    
                    if (!hasAccess) {
                        return NextResponse.redirect(new URL('/finance/dashboard?error=access_denied', request.url));
                    }
                }
            }

            return NextResponse.next();
        } catch (error) {
            console.error('JWT verify error:', error);
            // If cookie is invalid, redirect to login
            return NextResponse.redirect(new URL('/auth/login', request.url));
        }
    }

    return NextResponse.next();
}

export const config = {
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico).*)',
    ],
};
