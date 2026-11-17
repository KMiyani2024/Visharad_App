import { NextResponse } from 'next/server';
import { AVAILABLE_GAMES, toPublicGame } from '@/lib/games';

export const runtime = 'nodejs';

export async function GET() {
    return NextResponse.json(AVAILABLE_GAMES.map(toPublicGame), {
        headers: { 'Cache-Control': 'no-store' },
    });
}
