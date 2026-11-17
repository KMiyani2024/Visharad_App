import { NextResponse } from 'next/server';
import { createGameProgressSession, getGameProgressAttempts } from '@/lib/game-session';
import { AVAILABLE_GAMES, toPublicGame } from '@/lib/games';

export const runtime = 'nodejs';

type RouteParams = { params: Promise<{ gameId: string }> };

export async function GET(request: Request, { params }: RouteParams) {
    try {
        const { gameId } = await params;
        const game = AVAILABLE_GAMES.find(item => item.id === gameId);
        if (!game) return NextResponse.json({ error: 'Game not found' }, { status: 404 });
        const response = NextResponse.json(toPublicGame(game), { headers: { 'Cache-Control': 'no-store' } });
        if (getGameProgressAttempts(request, gameId) === null) {
            const session = createGameProgressSession(gameId, 0);
            response.cookies.set(session.name, session.value, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict',
                path: `/api/games/${gameId}`,
                maxAge: session.maxAge,
            });
        }
        return response;
    } catch (error) {
        console.error('Unable to read game:', error);
        return NextResponse.json({ error: 'Games are temporarily unavailable' }, { status: 503 });
    }
}
