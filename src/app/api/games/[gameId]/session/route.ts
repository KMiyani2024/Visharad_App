import { NextResponse } from 'next/server';
import { createGameProgressSession } from '@/lib/game-session';
import { AVAILABLE_GAMES } from '@/lib/games';

export const runtime = 'nodejs';

export async function POST(request: Request, { params }: { params: Promise<{ gameId: string }> }) {
    try {
        const { gameId } = await params;
        const game = AVAILABLE_GAMES.find(item => item.id === gameId);
        if (!game) return NextResponse.json({ error: 'Game not found' }, { status: 404 });

        const session = createGameProgressSession(gameId, 0);
        const response = NextResponse.json({ success: true });
        response.cookies.set(session.name, session.value, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            path: `/api/games/${gameId}`,
            maxAge: session.maxAge,
        });
        return response;
    } catch (error) {
        console.error('Unable to reset game:', error);
        return NextResponse.json({ error: 'Unable to restart this game' }, { status: 503 });
    }
}
