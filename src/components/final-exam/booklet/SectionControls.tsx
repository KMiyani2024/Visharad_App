'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown } from 'lucide-react';

export type JumpGroup = { title: string; items: { id: string; title: string }[] };

/** "Go to" menu listing every section, grouped (e.g. by unit). */
export function SectionJump({ groups, current, hrefBase, lang }: { groups: JumpGroup[]; current: string; hrefBase: string; lang: 'en' | 'gu' }) {
    const router = useRouter();
    return (
        <label className="relative flex min-w-0 flex-1 items-center sm:max-w-xs">
            <span className="sr-only">{lang === 'gu' ? 'વિભાગ પસંદ કરો' : 'Go to section'}</span>
            <select
                value={current}
                onChange={(e) => router.push(`${hrefBase}/${e.target.value}`)}
                className={`h-9 w-full min-w-0 appearance-none truncate rounded-full border border-charcoal-200 bg-card pl-3.5 pr-8 text-sm font-medium text-charcoal-800 outline-none hover:border-charcoal-300 focus:border-saffron-300 focus:ring-4 focus:ring-saffron-100 dark:focus:ring-saffron-900/40 ${lang === 'gu' ? 'font-gujarati' : ''}`}
            >
                {groups.map((g, gi) =>
                    g.title ? (
                        <optgroup key={gi} label={g.title}>
                            {g.items.map((it) => (
                                <option key={it.id} value={it.id}>
                                    {it.title}
                                </option>
                            ))}
                        </optgroup>
                    ) : (
                        g.items.map((it) => (
                            <option key={it.id} value={it.id}>
                                {it.title}
                            </option>
                        ))
                    ),
                )}
            </select>
            <ChevronDown size={15} className="pointer-events-none absolute right-3 text-charcoal-400" />
        </label>
    );
}

/** ← / → move between sections (ignored while typing). */
export function KeyNav({ prev, next }: { prev?: string; next?: string }) {
    const router = useRouter();
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.metaKey || e.ctrlKey || e.altKey) return;
            const el = e.target as HTMLElement | null;
            if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
            if (e.key === 'ArrowLeft' && prev) router.push(prev);
            if (e.key === 'ArrowRight' && next) router.push(next);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [prev, next, router]);
    return null;
}

// Reading size, remembered on this device. Applied as html[data-reading-size].
const SIZES = ['md', 'lg', 'xl'] as const;
type Size = (typeof SIZES)[number];
const KEY = 'visharad-reading-size';
const EVT = 'visharad-reading-size';

function readSize(): Size {
    try {
        const v = localStorage.getItem(KEY);
        if (v === 'lg' || v === 'xl') return v;
    } catch {}
    return 'md';
}
function subscribe(cb: () => void) {
    window.addEventListener(EVT, cb);
    return () => window.removeEventListener(EVT, cb);
}

/** The reader's chosen text size; page slices scale with it too. */
export function useReadingSize() {
    return useSyncExternalStore(subscribe, readSize, () => 'md' as Size);
}

export function TextSize() {
    const size = useReadingSize();
    useEffect(() => {
        document.documentElement.dataset.readingSize = size;
    }, [size]);
    const set = (s: Size) => {
        try {
            localStorage.setItem(KEY, s);
        } catch {}
        window.dispatchEvent(new Event(EVT));
    };
    const i = SIZES.indexOf(size);
    return (
        <div className="flex shrink-0 items-center rounded-full border border-charcoal-200 bg-card" role="group" aria-label="Text size">
            <button
                type="button"
                onClick={() => set(SIZES[Math.max(0, i - 1)])}
                disabled={i === 0}
                aria-label="Smaller text"
                className="flex h-9 w-9 items-center justify-center rounded-full text-[13px] font-semibold text-charcoal-600 hover:bg-charcoal-100 disabled:opacity-35"
            >
                A
            </button>
            <button
                type="button"
                onClick={() => set(SIZES[Math.min(SIZES.length - 1, i + 1)])}
                disabled={i === SIZES.length - 1}
                aria-label="Larger text"
                className="flex h-9 w-9 items-center justify-center rounded-full text-[17px] font-semibold text-charcoal-600 hover:bg-charcoal-100 disabled:opacity-35"
            >
                A
            </button>
        </div>
    );
}

/**
 * Arriving from a search result (?q=…): highlight every match in the section and
 * scroll to the first, using the CSS Custom Highlight API (no DOM changes).
 */
export function FindHighlight({ containerId }: { containerId: string }) {
    useEffect(() => {
        const q = new URLSearchParams(window.location.search).get('q')?.trim();
        const root = document.getElementById(containerId);
        const reg = (CSS as unknown as { highlights?: Map<string, unknown> }).highlights;
        if (!q || q.length < 2 || !root || !reg || typeof Highlight === 'undefined') return;
        const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
        const needle = fold(q);
        const ranges: Range[] = [];
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        for (let n = walker.nextNode(); n; n = walker.nextNode()) {
            const text = n.textContent ?? '';
            // Map folded offsets back to the original string (diacritics drop out when folding).
            const map: number[] = [];
            let folded = '';
            for (let i = 0; i < text.length; i++) {
                const f = fold(text[i]);
                for (let k = 0; k < f.length; k++) map.push(i);
                folded += f;
            }
            map.push(text.length);
            for (let at = folded.indexOf(needle); at >= 0; at = folded.indexOf(needle, at + needle.length)) {
                const r = new Range();
                r.setStart(n, map[at]);
                r.setEnd(n, map[at + needle.length] ?? text.length);
                ranges.push(r);
            }
        }
        if (!ranges.length) return;
        // Injected here: the CSS build step does not parse ::highlight() yet.
        if (!document.getElementById('booklet-find-style')) {
            const style = document.createElement('style');
            style.id = 'booklet-find-style';
            style.textContent = '::highlight(booklet-find){background-color:var(--color-saffron-200);color:var(--color-charcoal-950)}';
            document.head.appendChild(style);
        }
        reg.set('booklet-find', new Highlight(...ranges));
        const rect = ranges[0].getBoundingClientRect();
        window.scrollTo({ top: window.scrollY + rect.top - window.innerHeight / 3, behavior: 'smooth' });
        return () => void reg.delete('booklet-find');
    }, [containerId]);
    return null;
}
