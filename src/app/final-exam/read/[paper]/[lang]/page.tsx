import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { BookletHeader } from '@/components/final-exam/booklet/BookletHeader';
import { BookletContents, type ContentsGroup } from '@/components/final-exam/booklet/BookletContents';
import { bookletsFor, bookletTitle, contentsLayout, readerHref, resolveBooklet, sectionText } from '@/lib/bookletView';

// A booklet's contents: every section (shlok, topic, question) as its own sub-page,
// with search across the whole booklet. Booklets that haven't been sectioned yet
// open the whole original instead.
export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ paper: string; lang: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { paper, lang } = await params;
    const found = resolveBooklet(paper, lang);
    return { title: found ? `${found.paper.name} (${found.file.label}) · Final Exam · Visharad Sahayak` : 'Booklet · Visharad Sahayak' };
}

export default async function BookletContentsPage({ params }: Props) {
    const { paper: key, lang } = await params;
    const found = resolveBooklet(key, lang);
    if (!found) notFound();
    const { paper, file } = found;

    const booklets = await bookletsFor(paper.key, paper.files.map((f) => f.lang));
    const booklet = booklets[file.lang];
    if (!booklet) redirect(`${readerHref(paper.key, file.lang)}/original`);

    const groups: ContentsGroup[] = booklet.groups.map((g) => ({
        id: g.id,
        title: g.title,
        items: g.sections.map((s) => ({ id: s.id, title: s.title, subtitle: s.subtitle, text: sectionText(s) })),
    }));

    const langHrefs = Object.fromEntries(
        paper.files.map((f) => [f.lang, booklets[f.lang] ? readerHref(paper.key, f.lang) : `${readerHref(paper.key, f.lang)}/original`]),
    );

    return (
        <div className="mx-auto max-w-4xl">
            <BookletHeader
                paper={paper}
                file={file}
                title={bookletTitle(paper.document)}
                back={{ href: `/final-exam#paper-${paper.number}`, label: 'Final Exam' }}
                langHrefs={langHrefs}
                originalHref={`${readerHref(paper.key, file.lang)}/original`}
            />
            <BookletContents groups={groups} hrefBase={readerHref(paper.key, file.lang)} lang={file.lang} layout={contentsLayout(booklet)} />
        </div>
    );
}
