import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ChevronLeft, ChevronRight, LayoutList } from 'lucide-react';
import { flatSections } from '@/lib/booklet';
import { bookletsFor, bookletTitle, readerHref, resolveBooklet } from '@/lib/bookletView';
import { getBooklet } from '@/lib/bookletStore';
import { BookletHeader } from '@/components/final-exam/booklet/BookletHeader';
import { BookletBlocks } from '@/components/final-exam/booklet/BookletBlocks';
import { FindHighlight, KeyNav, SectionJump, TextSize, type JumpGroup } from '@/components/final-exam/booklet/SectionControls';

// One section of a booklet (a shlok, topic or question) on its own page, with
// previous / next, a "go to" menu and a reading-size control.
export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ paper: string; lang: string; section: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { paper, lang, section } = await params;
    const found = resolveBooklet(paper, lang);
    const booklet = found ? await getBooklet(found.paper.key, found.file.lang) : null;
    const hit = booklet && flatSections(booklet).find((x) => x.section.id === decodeURIComponent(section));
    return {
        title: found && hit ? `${hit.section.title} · ${found.paper.name} · Visharad Sahayak` : 'Booklet · Visharad Sahayak',
    };
}

export default async function BookletSectionPage({ params }: Props) {
    const { paper: key, lang, section: rawId } = await params;
    const found = resolveBooklet(key, lang);
    if (!found) notFound();
    const { paper, file } = found;

    const booklets = await bookletsFor(paper.key, paper.files.map((f) => f.lang));
    const booklet = booklets[file.lang];
    if (!booklet) redirect(`${readerHref(paper.key, file.lang)}/original`);

    const id = decodeURIComponent(rawId);
    const flat = flatSections(booklet);
    const index = flat.findIndex((x) => x.section.id === id);
    if (index < 0) notFound();
    const { group, section } = flat[index];
    const prev = flat[index - 1];
    const next = flat[index + 1];

    const base = readerHref(paper.key, file.lang);
    const langHrefs = Object.fromEntries(
        paper.files.map((f) => {
            const other = booklets[f.lang];
            const href = !other
                ? `${readerHref(paper.key, f.lang)}/original`
                : flatSections(other).some((x) => x.section.id === id)
                    ? readerHref(paper.key, f.lang, id)
                    : readerHref(paper.key, f.lang);
            return [f.lang, href];
        }),
    );
    const jump: JumpGroup[] = booklet.groups.map((g) => ({ title: g.title, items: g.sections.map((s) => ({ id: s.id, title: s.title })) }));
    const gu = file.lang === 'gu' ? 'font-gujarati' : '';
    const pdfSrc = `/final-exam/files/${paper.key}/${file.lang}`;
    const isCrop = section.blocks.some((b) => b.t === 'crop');

    return (
        <div className="mx-auto max-w-3xl">
            <KeyNav prev={prev && readerHref(paper.key, file.lang, prev.section.id)} next={next && readerHref(paper.key, file.lang, next.section.id)} />
            <BookletHeader
                paper={paper}
                file={file}
                title={bookletTitle(paper.document)}
                back={{ href: base, label: file.lang === 'gu' ? 'અનુક્રમણિકા' : 'Contents' }}
                langHrefs={langHrefs}
                compact
            />

            {/* Sticky reading bar */}
            <div className="glass-bar sticky top-14 z-20 -mx-4 mb-6 flex items-center gap-2 border-y border-charcoal-200/70 px-4 py-2 md:top-[60px] md:mx-0 md:rounded-2xl md:border">
                <Link
                    href={base}
                    aria-label="Contents"
                    className="flex size-9 shrink-0 items-center justify-center rounded-full border border-charcoal-200 bg-card text-charcoal-600 hover:text-charcoal-900"
                >
                    <LayoutList size={16} />
                </Link>
                <SectionJump groups={jump} current={section.id} hrefBase={base} lang={file.lang} />
                <span className="hidden shrink-0 text-xs font-medium tabular-nums text-charcoal-400 sm:inline">
                    {index + 1} / {flat.length}
                </span>
                <div className="hidden flex-1 sm:block" />
                <TextSize />
                <NavArrow href={prev && readerHref(paper.key, file.lang, prev.section.id)} dir="prev" />
                <NavArrow href={next && readerHref(paper.key, file.lang, next.section.id)} dir="next" />
            </div>

            <article aria-labelledby="section-title" className="rounded-3xl border border-charcoal-100 bg-card p-5 shadow-sm sm:p-8">
                {group.title && <div className={`text-xs font-bold uppercase tracking-[0.1em] text-saffron-600 ${gu}`}>{group.title}</div>}
                <h2 id="section-title" className={`mt-1 text-balance font-display text-2xl font-bold tracking-tight text-charcoal-900 sm:text-3xl ${gu}`}>
                    {section.title}
                </h2>
                {section.subtitle && <p className={`mt-1.5 text-sm font-medium text-charcoal-500 ${gu}`}>{section.subtitle}</p>}
                {isCrop && (
                    <p className="mt-3 text-xs text-charcoal-400">
                        {file.lang === 'gu' ? 'મૂળ પુસ્તિકાના પાનામાંથી.' : 'Shown from the original booklet pages.'}
                    </p>
                )}
                <div id="section-body" className="mt-6">
                    <FindHighlight containerId="section-body" />
                    <BookletBlocks blocks={section.blocks} pdfSrc={pdfSrc} lang={file.lang} label={section.title} />
                </div>
            </article>

            {/* Previous / next */}
            <nav aria-label="Sections" className="mt-6 grid grid-cols-2 gap-3">
                {prev ? (
                    <PrevNextCard href={readerHref(paper.key, file.lang, prev.section.id)} dir="prev" title={prev.section.title} group={prev.group.title} gu={gu} />
                ) : (
                    <span />
                )}
                {next ? (
                    <PrevNextCard href={readerHref(paper.key, file.lang, next.section.id)} dir="next" title={next.section.title} group={next.group.title} gu={gu} />
                ) : (
                    <Link href={base} className="flex items-center justify-end rounded-2xl border border-charcoal-100 bg-card p-4 text-right text-sm font-semibold text-charcoal-700 shadow-sm hover:border-saffron-200 hover:shadow-md">
                        {file.lang === 'gu' ? 'અનુક્રમણિકા' : 'Back to contents'}
                    </Link>
                )}
            </nav>
        </div>
    );
}

function NavArrow({ href, dir }: { href?: string; dir: 'prev' | 'next' }) {
    const Icon = dir === 'prev' ? ChevronLeft : ChevronRight;
    const label = dir === 'prev' ? 'Previous section' : 'Next section';
    const cls = 'flex size-9 shrink-0 items-center justify-center rounded-full border border-charcoal-200 bg-card text-charcoal-600';
    return href ? (
        <Link href={href} aria-label={label} className={`${cls} hover:border-saffron-300 hover:text-saffron-700`}>
            <Icon size={18} />
        </Link>
    ) : (
        <span aria-hidden="true" className={`${cls} opacity-35`}>
            <Icon size={18} />
        </span>
    );
}

function PrevNextCard({ href, dir, title, group, gu }: { href: string; dir: 'prev' | 'next'; title: string; group: string; gu: string }) {
    const next = dir === 'next';
    return (
        <Link
            href={href}
            className={`group flex min-w-0 items-center gap-2 rounded-2xl border border-charcoal-100 bg-card p-4 shadow-sm hover:border-saffron-200 hover:shadow-md ${next ? 'justify-end text-right' : ''}`}
        >
            {!next && <ChevronLeft size={18} className="shrink-0 text-charcoal-400 transition-[translate,color] duration-200 group-hover:-translate-x-0.5 group-hover:text-saffron-600" />}
            <span className="min-w-0">
                <span className="block text-[11px] font-semibold uppercase tracking-[0.1em] text-charcoal-400">{next ? 'Next' : 'Previous'}</span>
                <span className={`mt-0.5 block truncate font-semibold text-charcoal-900 ${gu}`}>
                    {group && <span className="text-charcoal-400">{group} · </span>}
                    {title}
                </span>
            </span>
            {next && <ChevronRight size={18} className="shrink-0 text-charcoal-400 transition-[translate,color] duration-200 group-hover:translate-x-0.5 group-hover:text-saffron-600" />}
        </Link>
    );
}
