import { findPaper } from '@/lib/finalExam';
import { getSignedBlobUrl } from '@/lib/finalExamFiles';

// /final-exam/files/<paper>/<lang> — streams a booklet from Azure Blob storage.
// Proxying (rather than redirecting) keeps the SAS token server-side and gives
// the file a friendly name; PDFs open inline in the browser.
export const dynamic = 'force-dynamic';

const CONTENT_TYPE = {
    pdf: 'application/pdf',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
} as const;

export async function GET(
    _req: Request,
    { params }: { params: Promise<{ paper: string; lang: string }> },
) {
    const { paper: key, lang } = await params;
    const file = findPaper(key)?.files.find((f) => f.lang === lang);
    if (!file) {
        return new Response('Not found', { status: 404 });
    }

    const url = getSignedBlobUrl(file);
    if (!url) {
        return new Response('This booklet is not available yet.', { status: 404 });
    }

    const upstream = await fetch(url, { cache: 'no-store' });
    if (!upstream.ok || !upstream.body) {
        console.error(`Final exam file fetch failed: ${upstream.status} for ${file.blob}`);
        return new Response('This booklet could not be loaded. Please try again later.', { status: 502 });
    }

    // RFC 5987 so Gujarati file names survive; ASCII fallback for old clients.
    const asciiName = file.blob.replace(/[^\x20-\x7E]/g, '_').replace(/"/g, '');
    const disposition = file.format === 'pdf' ? 'inline' : 'attachment';

    const headers = new Headers({
        'Content-Type': CONTENT_TYPE[file.format],
        'Content-Disposition': `${disposition}; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(file.blob)}`,
        'Cache-Control': 'public, max-age=3600',
        'X-Content-Type-Options': 'nosniff',
    });
    const length = upstream.headers.get('content-length');
    if (length) headers.set('Content-Length', length);

    return new Response(upstream.body, { status: 200, headers });
}
