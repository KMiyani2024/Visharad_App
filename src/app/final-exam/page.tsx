import type { Metadata } from 'next';
import Link from 'next/link';
import {
    ArrowRight,
    Ban,
    BookOpen,
    FileText,
    GraduationCap,
    Mic,
    PenLine,
    Presentation,
    ShieldCheck,
    type LucideIcon,
} from 'lucide-react';
import { getAllClassesMetadata } from '@/lib/data';
import {
    EXAM_PAPERS,
    FAQ_EXAMPLES,
    FINAL_EXAM_TOTAL,
    MUKHPATH_RULES,
    SUBJECT_TOPICS,
    paperMarks,
    type ExamPaper,
} from '@/lib/finalExam';
import { areFilesConfigured } from '@/lib/finalExamFiles';
import { TopicChecklist } from '@/components/final-exam/TopicChecklist';

export const metadata: Metadata = {
    title: 'Final Exam · Visharad Sahayak',
    description: 'The Visharad Final Exam: four papers, 100 marks — what to revise and how each paper is marked.',
};

// Booklet links depend on FINAL_EXAM_SAS_URL, read at request time.
export const dynamic = 'force-dynamic';

// Static class names per paper (Tailwind needs them spelled out).
const TONE: Record<ExamPaper['number'], { text: string; bg: string; soft: string; ring: string }> = {
    1: { text: 'text-paper-1', bg: 'bg-paper-1', soft: 'bg-paper-1/10', ring: 'ring-paper-1/30' },
    2: { text: 'text-paper-2', bg: 'bg-paper-2', soft: 'bg-paper-2/10', ring: 'ring-paper-2/30' },
    3: { text: 'text-paper-3', bg: 'bg-paper-3', soft: 'bg-paper-3/10', ring: 'ring-paper-3/30' },
    4: { text: 'text-paper-4', bg: 'bg-paper-4', soft: 'bg-paper-4/10', ring: 'ring-paper-4/30' },
};

function typeIcon(type: string): LucideIcon {
    if (type.startsWith('Oral')) return Mic;
    if (type.startsWith('Presentation')) return Presentation;
    return PenLine;
}

export default async function FinalExamPage() {
    const classes = await getAllClassesMetadata();

    // shlok number → its page in the app
    const shlokHref = new Map<number, string>();
    for (const cls of classes) {
        const classId = cls.filename.match(/(\d+)/)?.[0];
        if (!classId) continue;
        for (const n of cls.shloks) {
            if (!shlokHref.has(n)) shlokHref.set(n, `/class/${classId}/shlok/${n}`);
        }
    }
    const firstShlok = classes[0]?.shloks[0];
    const studyHref = firstShlok ? shlokHref.get(firstShlok) ?? '/' : '/';

    const filesReady = areFilesConfigured();
    const mukhpathMarks = EXAM_PAPERS.filter((p) => p.section === 'Mukhpath').reduce((s, p) => s + paperMarks(p), 0);
    const presentationMarks = FINAL_EXAM_TOTAL - mukhpathMarks;

    return (
        <div className="max-w-4xl mx-auto space-y-6 md:space-y-8">
            {/* Header */}
            <header>
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full mb-5 bg-saffron-50 text-saffron-700 ring-1 ring-saffron-200 text-xs font-semibold tracking-wide uppercase">
                    <GraduationCap size={14} />
                    Visharad · Final Exam
                </div>
                <h1 className="text-balance text-4xl md:text-5xl font-display font-extrabold tracking-tight text-charcoal-900">
                    Final Exam
                </h1>
                <p className="mt-3 max-w-2xl text-lg leading-relaxed text-charcoal-500">
                    Four papers worth {FINAL_EXAM_TOTAL} marks: {mukhpathMarks} for the Mukhpath oral and{' '}
                    {presentationMarks} across three presentation papers.
                </p>
            </header>

            {/* How the marks split */}
            <section aria-labelledby="marks-heading" className="rounded-3xl border border-charcoal-100 bg-card p-5 sm:p-7 shadow-sm">
                <div className="mb-5 flex items-baseline justify-between gap-4">
                    <h2 id="marks-heading" className="text-lg font-display font-bold text-charcoal-900">
                        How the {FINAL_EXAM_TOTAL} marks split
                    </h2>
                    <span className="text-sm font-medium text-charcoal-500 tabular-nums">{FINAL_EXAM_TOTAL} marks</span>
                </div>

                {/* Section brackets */}
                <div className="mb-2 flex gap-1 text-xs font-semibold text-charcoal-500">
                    <div style={{ flex: `${mukhpathMarks} 1 0` }} className="border-b-2 border-charcoal-300 pb-1.5">
                        Mukhpath · {mukhpathMarks}
                    </div>
                    <div style={{ flex: `${presentationMarks} 1 0` }} className="border-b-2 border-charcoal-300 pb-1.5">
                        Presentation · {presentationMarks}
                    </div>
                </div>

                {/* The bar */}
                <div
                    className="flex h-11 gap-1"
                    role="img"
                    aria-label={EXAM_PAPERS.map((p) => `${p.name} ${paperMarks(p)} marks`).join(', ')}
                >
                    {EXAM_PAPERS.map((p, i) => (
                        <div
                            key={p.key}
                            style={{ flex: `${paperMarks(p)} 1 0` }}
                            className={`flex items-center justify-center text-sm font-bold text-card tabular-nums ${TONE[p.number].bg} ${i === 0 ? 'rounded-l-xl' : ''} ${i === EXAM_PAPERS.length - 1 ? 'rounded-r-xl' : ''}`}
                        >
                            {paperMarks(p)}
                        </div>
                    ))}
                </div>

                {/* Legend: jump to each paper */}
                <ul className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    {EXAM_PAPERS.map((p) => (
                        <li key={p.key}>
                            <a
                                href={`#paper-${p.number}`}
                                className="group flex h-full items-start gap-2.5 rounded-xl border border-charcoal-100 px-3 py-2.5 hover:border-charcoal-200 hover:bg-charcoal-50 transition-colors"
                            >
                                <span className={`mt-1 size-2.5 shrink-0 rounded-full ${TONE[p.number].bg}`} />
                                <span className="min-w-0">
                                    <span className="block text-sm font-semibold text-charcoal-800 group-hover:text-charcoal-900">
                                        {p.name}
                                    </span>
                                    <span className="block text-xs text-charcoal-500">
                                        {p.type} · {p.marks.count} × {p.marks.each} = {paperMarks(p)}
                                    </span>
                                </span>
                            </a>
                        </li>
                    ))}
                </ul>
            </section>

            {/* The four papers */}
            {EXAM_PAPERS.map((p) => {
                const tone = TONE[p.number];
                const TypeIcon = typeIcon(p.type);

                return (
                    <article
                        key={p.key}
                        id={`paper-${p.number}`}
                        aria-labelledby={`paper-${p.number}-title`}
                        className="relative scroll-mt-24 overflow-hidden rounded-3xl border border-charcoal-100 bg-card shadow-sm"
                    >
                        <div aria-hidden="true" className={`absolute inset-y-0 left-0 w-1.5 ${tone.bg}`} />

                        <div className="p-5 pl-6 sm:p-7 sm:pl-8">
                            {/* Title row */}
                            <div className="flex items-start justify-between gap-4">
                                <div className="min-w-0">
                                    <div className={`text-[11px] font-bold uppercase tracking-[0.1em] ${tone.text}`}>
                                        Paper {p.number} · {p.section}
                                    </div>
                                    <h2
                                        id={`paper-${p.number}-title`}
                                        className="mt-1.5 text-balance text-xl sm:text-2xl font-display font-bold tracking-tight text-charcoal-900"
                                    >
                                        {p.examTitle}
                                    </h2>
                                    <span className={`mt-2.5 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${tone.soft} ${tone.text} ${tone.ring}`}>
                                        <TypeIcon size={13} />
                                        {p.type}
                                    </span>
                                </div>

                                <div className="shrink-0 text-right">
                                    <div className={`text-4xl sm:text-5xl font-display font-extrabold leading-none tabular-nums ${tone.text}`}>
                                        {paperMarks(p)}
                                    </div>
                                    <div className="mt-1 text-xs font-semibold uppercase tracking-wide text-charcoal-400">marks</div>
                                    <div className="mt-1 text-xs text-charcoal-500 tabular-nums">
                                        {p.marks.count} × {p.marks.each}
                                    </div>
                                </div>
                            </div>

                            {/* Booklet + PDF */}
                            <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl border border-charcoal-100 bg-charcoal-50/60 px-4 py-3">
                                <FileText size={20} className="shrink-0 text-charcoal-400" />
                                <div className="min-w-0 flex-1 basis-56">
                                    <div className="text-[11px] font-semibold uppercase tracking-wider text-charcoal-400">Booklet</div>
                                    <div className="text-sm font-semibold text-charcoal-800">{p.document}</div>
                                </div>
                                {filesReady ? (
                                    <div className="flex flex-wrap gap-2">
                                        {p.files.map((f, i) => (
                                            <Link
                                                key={f.lang}
                                                href={`/final-exam/read/${p.key}/${f.lang}`}
                                                className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-semibold transition-colors ${i === 0
                                                    ? 'bg-saffron-500 text-white shadow-sm hover:bg-saffron-600'
                                                    : 'border border-charcoal-200 bg-card text-charcoal-700 hover:bg-charcoal-50'
                                                    }`}
                                            >
                                                <BookOpen size={14} />
                                                <span className={f.lang === 'gu' ? 'font-gujarati' : undefined}>{f.label}</span>
                                                <span className={i === 0 ? 'text-white/80' : 'text-charcoal-400'}>
                                                    {f.format === 'pdf' ? 'PDF' : 'Word'}
                                                </span>
                                            </Link>
                                        ))}
                                    </div>
                                ) : (
                                    <span className="rounded-full border border-dashed border-charcoal-300 px-3 py-1.5 text-xs font-medium text-charcoal-500">
                                        Booklet coming soon
                                    </span>
                                )}
                            </div>

                            {/* Purpose / revise / assessed */}
                            <dl className="mt-6 grid gap-5 sm:grid-cols-3">
                                <div>
                                    <dt className="text-[11px] font-semibold uppercase tracking-wider text-charcoal-400">Purpose</dt>
                                    <dd className="mt-1.5 text-sm leading-relaxed text-charcoal-700">{p.purpose}</dd>
                                </div>
                                <div>
                                    <dt className="text-[11px] font-semibold uppercase tracking-wider text-charcoal-400">What to revise</dt>
                                    <dd className="mt-1.5 text-sm leading-relaxed text-charcoal-700">{p.revise}</dd>
                                </div>
                                <div>
                                    <dt className="text-[11px] font-semibold uppercase tracking-wider text-charcoal-400">What&rsquo;s assessed</dt>
                                    <dd className="mt-1.5 text-sm leading-relaxed text-charcoal-700">{p.assessed}</dd>
                                </div>
                            </dl>

                            {/* Paper-specific extras */}
                            {p.key === 'mukhpath' && (
                                <div className="mt-6 rounded-2xl border border-charcoal-100 bg-charcoal-50/60 p-4 sm:p-5">
                                    <h3 className="mb-3 text-sm font-semibold text-charcoal-800">How each vachan is marked</h3>
                                    <ul className="space-y-2.5">
                                        {MUKHPATH_RULES.map((rule, i) => {
                                            const Icon = [Mic, ShieldCheck, Ban][i] ?? Mic;
                                            return (
                                                <li key={rule} className="flex items-start gap-3 text-sm leading-relaxed text-charcoal-700">
                                                    <span className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-lg ${tone.soft} ${tone.text}`}>
                                                        <Icon size={14} />
                                                    </span>
                                                    {rule}
                                                </li>
                                            );
                                        })}
                                    </ul>
                                </div>
                            )}

                            {p.key === 'shlok-explanations' && (
                                <Link
                                    href={studyHref}
                                    className="mt-6 group flex items-center gap-3 rounded-2xl border border-charcoal-100 px-4 py-3 text-sm hover:border-charcoal-200 hover:bg-charcoal-50 transition-colors"
                                >
                                    <span className={`flex size-8 shrink-0 items-center justify-center rounded-xl ${tone.soft} ${tone.text}`}>
                                        <BookOpen size={16} />
                                    </span>
                                    <span className="flex-1 text-charcoal-700">
                                        <span className="font-semibold text-charcoal-900">Revise in the app:</span> every shlok page lists its
                                        Vachanamrut and Swamini Vato references.
                                    </span>
                                    <ArrowRight size={16} className="shrink-0 text-charcoal-400 group-hover:translate-x-0.5 transition-transform" />
                                </Link>
                            )}

                            {p.key === 'subject-explanations' && (
                                <div className="mt-6">
                                    <TopicChecklist topics={SUBJECT_TOPICS} />
                                </div>
                            )}

                            {p.key === 'faq' && (
                                <div className="mt-6 rounded-2xl border border-charcoal-100 bg-charcoal-50/60 p-4 sm:p-5">
                                    <h3 className="mb-1 text-sm font-semibold text-charcoal-800">Each answer is tied to a shlok</h3>
                                    <p className="mb-3 text-xs text-charcoal-500">For example:</p>
                                    <ul className="space-y-2">
                                        {FAQ_EXAMPLES.map((ex) => {
                                            const href = shlokHref.get(ex.shlok);
                                            const body = (
                                                <>
                                                    <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-xs font-bold tabular-nums ${tone.soft} ${tone.text}`}>
                                                        Q{ex.q}
                                                    </span>
                                                    <span className="flex-1 text-charcoal-700">
                                                        <span className="font-semibold text-charcoal-900">Shlok {ex.shlok}</span> · {ex.topic}
                                                    </span>
                                                    {href && <ArrowRight size={15} className="shrink-0 text-charcoal-400 group-hover:translate-x-0.5 transition-transform" />}
                                                </>
                                            );
                                            return (
                                                <li key={ex.q}>
                                                    {href ? (
                                                        <Link href={href} className="group flex items-center gap-3 rounded-xl bg-card border border-charcoal-100 px-3 py-2.5 text-sm hover:border-charcoal-200 transition-colors">
                                                            {body}
                                                        </Link>
                                                    ) : (
                                                        <div className="flex items-center gap-3 rounded-xl bg-card border border-charcoal-100 px-3 py-2.5 text-sm">{body}</div>
                                                    )}
                                                </li>
                                            );
                                        })}
                                    </ul>
                                </div>
                            )}
                        </div>
                    </article>
                );
            })}
        </div>
    );
}
