import { NextResponse } from 'next/server';
import { findPaper } from '@/lib/finalExam';
import { getPdfUrl } from '@/lib/finalExamPdf';

// Stable app URL for each booklet (/final-exam/pdf/mukhpath …) that redirects
// to the signed Azure Blob URL, so the SAS can be rotated without touching links.
export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ paper: string }> }) {
    const { paper: key } = await params;
    const paper = findPaper(key);
    if (!paper) {
        return new NextResponse('Unknown paper', { status: 404 });
    }

    const url = getPdfUrl(paper);
    if (!url) {
        return new NextResponse('This PDF is not available yet.', { status: 404 });
    }

    return NextResponse.redirect(url, 302);
}
