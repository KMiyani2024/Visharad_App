import { NextResponse } from 'next/server';
import { appendRecord } from '@/lib/azureBlob';

const EVENTS_BLOB = 'analytics-events.ndjson';
const ALLOWED_TYPES = new Set([
    'page_view',
    'shlok_read',
    'quiz_complete',
    'audio_play',
    'audio_complete',
]);
const MAX_PAYLOAD_BYTES = 4096;

export async function POST(request: Request) {
    try {
        const raw = await request.text();
        if (Buffer.byteLength(raw) > MAX_PAYLOAD_BYTES) {
            return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
        }

        const body = JSON.parse(raw);
        const { type, ...payload } = body;

        if (typeof type !== 'string' || !ALLOWED_TYPES.has(type)) {
            return NextResponse.json({ error: 'Unknown event type' }, { status: 400 });
        }

        await appendRecord(EVENTS_BLOB, {
            type,
            ts: new Date().toISOString(),
            ...payload,
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error recording analytics event:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
