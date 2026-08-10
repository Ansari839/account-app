import { NextResponse } from 'next/server';

export async function POST() {
    const response = NextResponse.json({ success: true });
    response.cookies.set('__session', '', { maxAge: 0 });
    return response;
}
