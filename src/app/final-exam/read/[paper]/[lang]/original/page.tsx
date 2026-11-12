import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import mammoth from 'mammoth';
import { AlertCircle, ArrowLeft, Download, FileText } from 'lucide-react';
import { findPaper, type ExamFile } from '@/lib/finalExam';
import { areFilesConfigured, getSignedBlobUrl } from '@/lib/finalExamFiles';
import { PdfViewer } from '@/components/final-exam/PdfViewer';
import { getBooklet } from '@/lib/bookletStore';

// The whole original booklet ("View original"): PDFs render in-app with pdf.js;
// the Word booklet (Shloka Samjuti) is converted to HTML on the server.
// The sectioned reader is the parent route.
export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ paper: string; lang: string }> };

function resolve(key: string, lang: string) {
    const paper = findPaper(key);
    const file = paper?.files.find((f) => f.lang === lang);
    return paper && file ? { paper, file } : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { paper, lang } = await params;
    const found = resolve(paper, lang);
    return {
        title: found ? `Original · ${found.paper.name} (${found.file.label}) · Final Exam · Visharad Sahayak` : 'Booklet · Visharad Sahayak',
    };
}

/** Word → HTML. mammoth escapes document text; we additionally neutralise script links. */
async function loadDocxHtml(file: ExamFile): Promise<string | null> {
    const url = getSignedBlobUrl(file);
    if (!url) return null;
    try {
        const res = await fetch(url, { next: { revalidate: 3600 } });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const { value } = await mammoth.convertToHtml({ buffer: Buffer.from(await res.arrayBuffer()) });
        return value.replace(/href="\s*(?:javascript|data|vbscript):[^"]*"/gi, 'href="#"');
    } catch (e) {
        console.error(`Could not convert ${file.blob}`, e);
        return null;
    }
}

export default async function ReadBookletPage({ params }: Props) {
    const { paper: key, lang } = await params;
    const found = resolve(key, lang);
    if (!found) notFound();
    const { paper, file } = found;

    const configured = areFilesConfigured();
    const src = `/final-exam/files/${paper.key}/${file.lang}`;
    const docxHtml = configured && file.format === 'docx' ? await loadDocxHtml(file) : null;
    const booklet = await getBooklet(paper.key, file.lang);
    // The booklet name without its "(English)" / "(Gujarati)" tag — the language is shown separately.
    const title = paper.document.replace(/\s*\((?:English|Gujarati)\)/, '');

    return (
        <div className="max-w-4xl mx-auto">
            <Link
                href={booklet ? `/final-exam/read/${paper.key}/${file.lang}` : `/final-exam#paper-${paper.number}`}
                className="mb-5 inline-flex items-center gap-1.5 rounded-full px-2 py-1 -ml-2 text-sm font-medium text-charcoal-500 hover:bg-charcoal-100 hover:text-charcoal-900 transition-colors"
            >
                <ArrowLeft size={15} />
                {booklet ? 'Contents' : 'Final Exam'}
            </Link>

            <header className="mb-5 flex flex-wrap items-end gap-x-6 gap-y-3">
                <div className="min-w-0 flex-1 basis-72">
                    <div className="text-[11px] font-bold uppercase tracking-[0.1em] text-saffron-600">
                        Paper {paper.number} · {paper.name}
                    </div>
                    <h1 className="mt-1.5 text-balance text-2xl md:text-3xl font-display font-extrabold tracking-tight text-charcoal-900">
                        {title}
                    </h1>
                </div>

                {paper.files.length === 1 && (
                    <span className={`rounded-full border border-charcoal-200 bg-card px-3.5 py-1.5 text-sm font-medium text-charcoal-600 ${file.lang === 'gu' ? 'font-gujarati' : ''}`}>
                        {file.label}
                    </span>
                )}
                {paper.files.length > 1 && (
                    <nav aria-label="Language" className="flex items-center gap-0.5 rounded-full border border-charcoal-200 bg-card p-1">
                        {paper.files.map((f) => {
                            const active = f.lang === file.lang;
                            return (
                                <Link
                                    key={f.lang}
                                    href={`/final-exam/read/${paper.key}/${f.lang}/original`}
                                    aria-current={active ? 'page' : undefined}
                                    className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${f.lang === 'gu' ? 'font-gujarati' : ''} ${active
                                        ? 'bg-saffron-50 text-saffron-700 ring-1 ring-saffron-200'
                                        : 'text-charcoal-500 hover:text-charcoal-900'
                                        }`}
                                >
                                    {f.label}
                                </Link>
                            );
                        })}
                    </nav>
                )}
            </header>

            {!configured ? (
                <Notice title="This booklet isn’t connected yet." body="The booklets are stored in Azure; the app’s FINAL_EXAM_SAS_URL setting is missing." />
            ) : file.format === 'pdf' ? (
                <PdfViewer src={src} downloadName={file.blob} />
            ) : docxHtml ? (
                <>
                    <div className="mb-4 flex items-center gap-2 text-sm text-charcoal-500">
                        <FileText size={15} />
                        Shown from the Word document.
                        <a href={src} download className="ml-auto inline-flex items-center gap-1.5 font-semibold text-saffron-700 hover:underline">
                            <Download size={14} />
                            Download .docx
                        </a>
                    </div>
                    <article
                        lang={file.lang === 'gu' ? 'gu' : 'en'}
                        className={`docx-content rounded-3xl border border-charcoal-100 bg-card p-5 sm:p-8 md:p-10 shadow-sm ${file.lang === 'gu' ? 'font-gujarati' : ''}`}
                        dangerouslySetInnerHTML={{ __html: docxHtml }}
                    />
                </>
            ) : (
                <Notice title="This booklet could not be opened." body="Please try again later, or download it." href={src} />
            )}
        </div>
    );
}

function Notice({ title, body, href }: { title: string; body: string; href?: string }) {
    return (
        <div className="rounded-2xl border border-charcoal-200 bg-card p-8 text-center">
            <AlertCircle size={32} className="mx-auto mb-3 text-charcoal-400" />
            <p className="font-semibold text-charcoal-900">{title}</p>
            <p className="mt-1 text-sm text-charcoal-500">{body}</p>
            {href && (
                <a href={href} download className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-saffron-700 hover:underline">
                    <Download size={14} />
                    Download
                </a>
            )}
        </div>
    );
}
