import 'server-only';
import type { ExamPaper } from './finalExam';

/**
 * Final Exam PDFs are served from an Azure Blob container.
 *
 * Set FINAL_EXAM_SAS_URL (server-side only, NOT NEXT_PUBLIC_) to the container's
 * read-only SAS URL, e.g.
 *   https://<account>.blob.core.windows.net/<container>?sp=r&se=…&sig=…
 * in .env.local for development and in Azure App Service → Configuration for production.
 * It is read at request time, so the token can be rotated without a rebuild.
 */
function containerSas(): { baseUrl: string; sas: string } | null {
    const raw = process.env.FINAL_EXAM_SAS_URL;
    if (!raw) return null;
    try {
        const url = new URL(raw);
        return { baseUrl: `${url.origin}${url.pathname.replace(/\/$/, '')}`, sas: url.search };
    } catch {
        console.error('FINAL_EXAM_SAS_URL is not a valid URL');
        return null;
    }
}

export function isPdfAvailable(paper: ExamPaper): boolean {
    return Boolean(paper.pdf) && containerSas() !== null;
}

/** Signed blob URL for a paper's PDF, or null if not configured. */
export function getPdfUrl(paper: ExamPaper): string | null {
    const container = containerSas();
    if (!container || !paper.pdf) return null;
    const blobPath = paper.pdf.split('/').map(encodeURIComponent).join('/');
    return `${container.baseUrl}/${blobPath}${container.sas}`;
}
