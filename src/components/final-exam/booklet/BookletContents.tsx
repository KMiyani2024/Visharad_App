'use client';

import { useDeferredValue, useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronRight, Search, X } from 'lucide-react';

export type ContentsItem = { id: string; title: string; subtitle?: string; text: string };
export type ContentsGroup = { id: string; title: string; items: ContentsItem[] };

const COPY = {
    en: { search: 'Search this booklet', none: 'Nothing found for', results: (n: number) => `${n} section${n === 1 ? '' : 's'}`, sections: (n: number) => `${n} sections` },
    gu: { search: 'આ પુસ્તિકામાં શોધો', none: 'કંઈ મળ્યું નહીં:', results: (n: number) => `${n} વિભાગ`, sections: (n: number) => `${n} વિભાગ` },
};

/** Folds case and Latin diacritics so "bhagwan" finds "Bhagwān". Gujarati is left as is. */
const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function snippet(text: string, q: string) {
    const i = fold(text).indexOf(q);
    if (i < 0) return null;
    const start = Math.max(0, i - 50);
    const end = Math.min(text.length, i + q.length + 70);
    return {
        before: (start > 0 ? '…' : '') + text.slice(start, i),
        match: text.slice(i, i + q.length),
        after: text.slice(i + q.length, end) + (end < text.length ? '…' : ''),
    };
}

/** The last word of a title, e.g. "Shlok 12" → "12", "શ્લોક ૧૨" → "૧૨". */
const shortLabel = (title: string) => title.trim().split(/\s+/).pop() ?? title;

const GU_DIGITS = '૦૧૨૩૪૫૬૭૮૯';
/** The number in a section id ("shlok-106" → "106"), in Gujarati digits for Gujarati booklets. */
function idNumber(id: string, lang: 'en' | 'gu') {
    const n = id.match(/(\d+)$/)?.[1];
    if (!n) return null;
    return lang === 'gu' ? n.replace(/\d/g, (d) => GU_DIGITS[+d]) : n;
}

/** True when a title is just "<word> <number>" (e.g. "શ્લોક ૧૦૬"), so the badge already says it. */
const isBareNumberTitle = (title: string, num: string | null) => !!num && /^\S+\s+\S+$/.test(title.trim()) && title.trim().endsWith(num);

export function BookletContents({
    groups,
    hrefBase,
    lang,
    layout,
}: {
    groups: ContentsGroup[];
    hrefBase: string;
    lang: 'en' | 'gu';
    layout: 'grid' | 'list';
}) {
    const t = COPY[lang];
    const [query, setQuery] = useState('');
    const q = fold(useDeferredValue(query).trim());
    const total = groups.reduce((n, g) => n + g.items.length, 0);

    const results = useMemo(() => {
        if (q.length < 2) return null;
        return groups.flatMap((g) =>
            g.items
                .map((it) => {
                    const inTitle = fold(`${it.title} ${it.subtitle ?? ''}`).includes(q);
                    const snip = snippet(it.text, q);
                    return inTitle || snip ? { it, group: g, snip } : null;
                })
                .filter((x) => x !== null),
        );
    }, [groups, q]);

    const gu = lang === 'gu' ? 'font-gujarati' : '';

    return (
        <div>
            {/* Search */}
            <label className="relative mb-6 block">
                <span className="sr-only">{t.search}</span>
                <Search size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-charcoal-400" />
                <input
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={t.search}
                    className={`h-12 w-full rounded-2xl border border-charcoal-200 bg-card pl-11 pr-11 text-[15px] text-charcoal-900 shadow-sm outline-none placeholder:text-charcoal-400 focus:border-saffron-300 focus:ring-4 focus:ring-saffron-100 dark:focus:ring-saffron-900/40 ${gu}`}
                />
                {query && (
                    <button
                        type="button"
                        onClick={() => setQuery('')}
                        aria-label="Clear search"
                        className="absolute right-2 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full text-charcoal-400 hover:bg-charcoal-100 hover:text-charcoal-700"
                    >
                        <X size={16} />
                    </button>
                )}
            </label>

            {results ? (
                results.length === 0 ? (
                    <p className={`rounded-2xl border border-dashed border-charcoal-200 p-8 text-center text-charcoal-500 ${gu}`}>
                        {t.none} “{query.trim()}”
                    </p>
                ) : (
                    <>
                        <p className={`mb-3 text-xs font-semibold uppercase tracking-[0.1em] text-charcoal-400 ${gu}`}>{t.results(results.length)}</p>
                        <ul className="stagger space-y-2">
                            {results.slice(0, 60).map(({ it, group, snip }) => (
                                <li key={it.id}>
                                    <Link
                                        href={`${hrefBase}/${it.id}${snip ? `?q=${encodeURIComponent(query.trim())}` : ''}`}
                                        className="block rounded-2xl border border-charcoal-100 bg-card px-4 py-3.5 shadow-sm hover:border-saffron-200 hover:shadow-md"
                                    >
                                        <div className={`font-semibold text-charcoal-900 ${gu}`}>
                                            {group.title && <span className="text-charcoal-400">{group.title} · </span>}
                                            {it.title}
                                        </div>
                                        {snip && (
                                            <p className={`mt-1 line-clamp-2 text-sm text-charcoal-500 ${gu}`}>
                                                {snip.before}
                                                <mark className="rounded bg-saffron-100 px-0.5 text-charcoal-900 dark:bg-saffron-900/60">{snip.match}</mark>
                                                {snip.after}
                                            </p>
                                        )}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </>
                )
            ) : (
                <div className="stagger space-y-5">
                    {groups.map((g) => (
                        <section key={g.id} aria-labelledby={`grp-${g.id}`} className="rounded-3xl border border-charcoal-100 bg-card p-4 shadow-sm sm:p-6">
                            {(g.title || groups.length === 1) && (
                                <div className="mb-3 flex items-baseline justify-between gap-3 px-1">
                                    <h2 id={`grp-${g.id}`} className={`font-display text-lg font-bold text-charcoal-900 ${gu}`}>
                                        {g.title || t.sections(total)}
                                    </h2>
                                    {g.title && <span className={`text-xs font-medium text-charcoal-400 ${gu}`}>{t.sections(g.items.length)}</span>}
                                </div>
                            )}

                            {layout === 'grid' ? (
                                <ul className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8">
                                    {g.items.map((it) => (
                                        <li key={it.id}>
                                            <Link
                                                href={`${hrefBase}/${it.id}`}
                                                aria-label={it.title}
                                                title={it.title}
                                                className={`flex aspect-square flex-col items-center justify-center rounded-2xl border border-charcoal-100 bg-charcoal-50/60 text-charcoal-800 hover:-translate-y-0.5 hover:border-saffron-300 hover:bg-saffron-50 hover:text-saffron-800 hover:shadow-md dark:hover:bg-saffron-950/40 ${gu}`}
                                            >
                                                <span className="text-lg font-bold tabular-nums">{shortLabel(it.title)}</span>
                                            </Link>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <ol className="divide-y divide-charcoal-100">
                                    {g.items.map((it, i) => {
                                        const num = idNumber(it.id, lang) ?? String(i + 1);
                                        // "શ્લોક ૧૦૬" + its opening line: the badge shows the number, the line leads.
                                        const bare = isBareNumberTitle(it.title, num) && !!it.subtitle;
                                        const primary = bare ? it.subtitle! : it.title;
                                        const secondary = bare ? undefined : it.subtitle;
                                        return (
                                        <li key={it.id}>
                                            <Link
                                                href={`${hrefBase}/${it.id}`}
                                                aria-label={bare ? `${it.title}: ${it.subtitle}` : undefined}
                                                className="group -mx-2 flex items-center gap-3.5 rounded-xl px-2 py-3 hover:bg-charcoal-50"
                                            >
                                                <span className={`flex h-8 min-w-8 shrink-0 items-center justify-center rounded-full bg-saffron-50 px-2 text-sm font-bold tabular-nums text-saffron-700 ring-1 ring-saffron-100 dark:bg-saffron-950/50 dark:ring-saffron-900 ${gu}`}>
                                                    {num}
                                                </span>
                                                <span className="min-w-0 flex-1">
                                                    <span className={`block font-medium leading-snug text-charcoal-900 ${gu}`}>{primary}</span>
                                                    {secondary && <span className={`mt-0.5 block text-sm text-charcoal-500 ${gu}`}>{secondary}</span>}
                                                </span>
                                                <ChevronRight size={18} className="shrink-0 text-charcoal-300 transition-[translate,color] duration-200 group-hover:translate-x-0.5 group-hover:text-saffron-600" />
                                            </Link>
                                        </li>
                                        );
                                    })}
                                </ol>
                            )}
                        </section>
                    ))}
                </div>
            )}
        </div>
    );
}
