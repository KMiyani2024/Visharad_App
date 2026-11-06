import { NextResponse } from 'next/server';
import { appendRecord } from '@/lib/azureBlob';

const FEEDBACK_BLOB = 'feedback.ndjson';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const newEntry = {
            timestamp: new Date().toISOString(),
            ...body,
        };

        await appendRecord(FEEDBACK_BLOB, newEntry);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error saving feedback:', error);
        if (error instanceof Error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
