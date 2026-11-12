import Link from 'next/link';
import { ArrowLeft, FileText } from 'lucide-react';
import type { ExamFile, ExamPaper } from '@/lib/finalExam';

/**
 * Top of every reader page: back link, paper label, booklet title, the language
 * switch (to the same place in the other language where it exists) and a link
 * to the whole original booklet.
 */
export function BookletHeader({
    paper,
    file,
    title,
    back,
    langHrefs,
    originalHref,
    compact = false,
}: {
    paper: ExamPaper;
    file: ExamFile;
    title: string;
    back: { href: string; label: string };
    /** lang → href for each language edition. */
    langHrefs: Record<string, string>;
    originalHref?: string;
    /** Section pages: a smaller title, so the reading starts higher up on a phone. */
    compact?: boolean;
}) {
    return (
        <>
            <Link
                href={back.href}
                className={`${compact ? 'mb-3' : 'mb-5'} -ml-2 inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-sm font-medium text-charcoal-500 hover:bg-charcoal-100 hover:text-charcoal-900`}
            >
                <ArrowLeft size={15} />
                {back.label}
            </Link>

            <header className={`flex flex-wrap items-end gap-x-6 gap-y-3 ${compact ? 'mb-4' : 'mb-6'}`}>
                <div className="min-w-0 flex-1 basis-72">
                    <div className="text-[11px] font-bold uppercase tracking-[0.1em] text-saffron-600">
                        Paper {paper.number} · {paper.name}
                    </div>
                    <h1 className={`text-balance font-display font-extrabold tracking-tight text-charcoal-900 ${compact ? 'mt-1 text-lg md:text-xl' : 'mt-1.5 text-2xl md:text-3xl'}`}>
                        {title}
                    </h1>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    {paper.files.length > 1 ? (
                        <nav aria-label="Language" className="flex items-center gap-0.5 rounded-full border border-charcoal-200 bg-card p-1">
                            {paper.files.map((f) => {
                                const active = f.lang === file.lang;
                                return (
                                    <Link
                                        key={f.lang}
                                        href={langHrefs[f.lang]}
                                        aria-current={active ? 'page' : undefined}
                                        className={`rounded-full px-3.5 py-1.5 text-sm font-medium ${f.lang === 'gu' ? 'font-gujarati' : ''} ${active
                                            ? 'bg-saffron-50 text-saffron-700 ring-1 ring-saffron-200'
                                            : 'text-charcoal-500 hover:text-charcoal-900'
                                            }`}
                                    >
                                        {f.label}
                                    </Link>
                                );
                            })}
                        </nav>
                    ) : (
                        <span className={`rounded-full border border-charcoal-200 bg-card px-3.5 py-1.5 text-sm font-medium text-charcoal-600 ${file.lang === 'gu' ? 'font-gujarati' : ''}`}>
                            {file.label}
                        </span>
                    )}
                    {originalHref && (
                        <Link
                            href={originalHref}
                            className="inline-flex items-center gap-1.5 rounded-full border border-charcoal-200 bg-card px-3.5 py-1.5 text-sm font-medium text-charcoal-600 hover:border-charcoal-300 hover:text-charcoal-900"
                        >
                            <FileText size={14} />
                            View original
                        </Link>
                    )}
                </div>
            </header>
        </>
    );
}
