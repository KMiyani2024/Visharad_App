import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';

// Admin gate: sign-in is Google OAuth, but only emails in ADMIN_EMAILS may in.
// Required env vars (see .env.local / Azure App Service Configuration):
//   AUTH_SECRET, AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET, ADMIN_EMAILS (comma-separated),
//   AUTH_URL (prod URL), AUTH_TRUST_HOST=true (behind Azure App Service's proxy)
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

export const { handlers, auth, signIn, signOut } = NextAuth({
    providers: [Google],
    session: { strategy: 'jwt' },
    pages: { signIn: '/admin/sign-in', error: '/admin/sign-in' },
    callbacks: {
        signIn({ profile }) {
            const email = profile?.email?.toLowerCase();
            return !!email && ADMIN_EMAILS.includes(email);
        },
    },
});
