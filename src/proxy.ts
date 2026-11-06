import { auth } from '@/auth';
import { NextResponse } from 'next/server';

export default auth((req) => {
    if (req.nextUrl.pathname.startsWith('/admin/sign-in')) return;

    if (!req.auth) {
        const signInUrl = new URL('/admin/sign-in', req.nextUrl.origin);
        signInUrl.searchParams.set('callbackUrl', req.nextUrl.pathname);
        return NextResponse.redirect(signInUrl);
    }
});

export const config = {
    matcher: ['/admin/:path*'],
};
