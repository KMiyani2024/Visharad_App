import { signIn } from '@/auth';

type Props = {
    searchParams: Promise<{ error?: string; callbackUrl?: string }>;
};

export default async function AdminSignInPage({ searchParams }: Props) {
    const { error, callbackUrl } = await searchParams;

    return (
        <div className="max-w-sm mx-auto mt-24 p-8 bg-white rounded-3xl shadow-xl border border-charcoal-100 text-center">
            <h1 className="text-xl font-display font-bold text-charcoal-900 mb-2">Admin Sign In</h1>
            <p className="text-sm text-charcoal-500 mb-6">Restricted to authorized accounts.</p>

            {error && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2 mb-6">
                    That Google account isn&apos;t authorized for admin access.
                </p>
            )}

            <form
                action={async () => {
                    'use server';
                    await signIn('google', { redirectTo: callbackUrl || '/admin' });
                }}
            >
                <button
                    type="submit"
                    className="w-full px-6 py-3 bg-saffron-500 text-white rounded-full font-bold hover:bg-saffron-600 hover:scale-105 transition-all shadow-md hover:shadow-lg"
                >
                    Sign in with Google
                </button>
            </form>
        </div>
    );
}
