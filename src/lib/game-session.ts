import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const GAME_PROGRESS_MAX_AGE = 60 * 60 * 24;

function getSessionSecret() {
    const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
    if (!secret) throw new Error('AUTH_SECRET is not configured');
    return secret;
}

function getCookieValue(request: Request, name: string) {
    const cookieHeader = request.headers.get('cookie') || '';
    return cookieHeader.split(';').map(part => part.trim())
        .find(part => part.startsWith(`${name}=`))
        ?.slice(name.length + 1);
}

function getProgressCookieName(gameId: string) {
    const id = createHash('sha256').update(gameId).digest('hex').slice(0, 20);
    return `visharad_wordle_${id}`;
}

export function getGameProgressAttempts(request: Request, gameId: string) {
    const value = getCookieValue(request, getProgressCookieName(gameId));
    if (!value) return null;

    const [attemptCount, expiresAt, nonce, signature, extra] = value.split('.');
    if (!attemptCount || !expiresAt || !nonce || !signature || extra
        || !/^\d+$/.test(attemptCount) || !/^\d+$/.test(expiresAt)) return null;
    const attempts = Number(attemptCount);
    if (!Number.isInteger(attempts) || attempts < 0 || attempts > 6
        || Number(expiresAt) <= Math.floor(Date.now() / 1000)) return null;

    const payload = `${gameId}:${attemptCount}.${expiresAt}.${nonce}`;
    const expected = createHmac('sha256', getSessionSecret()).update(payload).digest();
    const actual = Buffer.from(signature, 'base64url');
    return expected.length === actual.length && timingSafeEqual(expected, actual) ? attempts : null;
}

export function createGameProgressSession(gameId: string, attempts: number) {
    const expiresAt = Math.floor(Date.now() / 1000) + GAME_PROGRESS_MAX_AGE;
    const nonce = randomBytes(12).toString('hex');
    const payload = `${gameId}:${attempts}.${expiresAt}.${nonce}`;
    const signature = createHmac('sha256', getSessionSecret()).update(payload).digest('base64url');
    return {
        name: getProgressCookieName(gameId),
        value: `${attempts}.${expiresAt}.${nonce}.${signature}`,
        maxAge: GAME_PROGRESS_MAX_AGE,
    };
}
