import { NextResponse } from 'next/server';
import { createGameProgressSession, getGameProgressAttempts } from '@/lib/game-session';
import { AVAILABLE_GAMES } from '@/lib/games';

export const runtime = 'nodejs';

type RouteParams = { params: Promise<{ gameId: string }> };

export async function POST(request: Request, { params }: RouteParams) {
    const { gameId } = await params;
    const body: unknown = await request.json();
    const guess = body && typeof body === 'object' && 'guess' in body && typeof body.guess === 'string'
        ? body.guess.toUpperCase() : '';
    const attempt = body && typeof body === 'object' && 'attempt' in body && typeof body.attempt === 'number'
        ? body.attempt : 0;
    if (!/^[A-Z]{5}$/.test(guess) || !Number.isInteger(attempt) || attempt < 1 || attempt > 6) {
        return NextResponse.json({ error: 'Enter a five-letter word and a valid attempt number' }, { status: 400 });
    }
    if (getGameProgressAttempts(request, gameId) !== attempt - 1) {
        return NextResponse.json({ error: 'Game progress is out of sync. Restart this game to continue.' }, { status: 409 });
    }

    try {
        const game = AVAILABLE_GAMES.find(item => item.id === gameId);
        if (!game) return NextResponse.json({ error: 'Game not found' }, { status: 404 });

        const answer = game.answer;
        const result: ('correct' | 'present' | 'absent')[] = Array(5).fill('absent');
        const remaining = answer.split('');
        for (let index = 0; index < guess.length; index++) {
            if (guess[index] === answer[index]) {
                result[index] = 'correct';
                remaining[index] = '';
            }
        }
        for (let index = 0; index < guess.length; index++) {
            if (result[index] === 'correct') continue;
            const letterIndex = remaining.indexOf(guess[index]);
            if (letterIndex !== -1) {
                result[index] = 'present';
                remaining[letterIndex] = '';
            }
        }

        const solved = guess === answer;
        const lost = !solved && attempt === 6;
        const response = NextResponse.json({
            result,
            solved,
            lost,
            ...(solved || lost ? { answer } : {}),
        }, { headers: { 'Cache-Control': 'no-store' } });
        const session = createGameProgressSession(gameId, attempt);
        response.cookies.set(session.name, session.value, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            path: `/api/games/${gameId}`,
            maxAge: session.maxAge,
        });
        return response;
    } catch (error) {
        console.error('Unable to check game guess:', error);
        return NextResponse.json({ error: 'Games are temporarily unavailable' }, { status: 503 });
    }
}
