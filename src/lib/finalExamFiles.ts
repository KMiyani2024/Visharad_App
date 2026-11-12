import 'server-only';
import type { ExamFile } from './finalExam';

/**
 * Final Exam booklets are served from the private Azure Blob container
 * `documents` in the `examfinal` storage account.
 *
 * Set FINAL_EXAM_SAS_URL (server-side only, NOT NEXT_PUBLIC_) to a read-only
 * container SAS URL:
 *   https://examfinal.blob.core.windows.net/documents?sp=r&se=…&sig=…
 * in .env.local for development and in Azure App Service → Configuration for
 * production. It is read at request time, so the token can be rotated without a
 * rebuild, and it never reaches the browser: /final-exam/files/… streams the file.
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

export function areFilesConfigured(): boolean {
    return containerSas() !== null;
}

/** Signed blob URL for a booklet (server-side only), or null if not configured. */
export function getSignedBlobUrl(file: ExamFile): string | null {
    const container = containerSas();
    if (!container) return null;
    const blobPath = file.blob.split('/').map(encodeURIComponent).join('/');
    return `${container.baseUrl}/${blobPath}${container.sas}`;
}
