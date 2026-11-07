'use client';

import { useMemo, useSyncExternalStore } from 'react';
import { Check, RotateCcw } from 'lucide-react';

const STORAGE_KEY = 'visharad_final_exam_topics_v1';
const EVENT = 'visharad-final-exam-topics';

// localStorage as an external store (the snapshot is the raw JSON string, so it compares by value).
let memoryFallback = '[]';
function readRaw() {
    try {
        return window.localStorage.getItem(STORAGE_KEY) ?? '[]';
    } catch {
        return memoryFallback;
    }
}
function subscribe(onChange: () => void) {
    const onStorage = (e: StorageEvent) => e.key === STORAGE_KEY && onChange();
    window.addEventListener(EVENT, onChange);
    window.addEventListener('storage', onStorage);
    return () => {
        window.removeEventListener(EVENT, onChange);
        window.removeEventListener('storage', onStorage);
    };
}

/**
 * Tick-off list for the 17 Vishay Prastuti topics. Kept in localStorage on this
 * device (the app has no accounts), like the class progress rings.
 */
export function TopicChecklist({ topics }: { topics: string[] }) {
    const raw = useSyncExternalStore(subscribe, readRaw, () => '[]');
    const done = useMemo<number[]>(() => {
        try {
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed.filter((n): n is number => typeof n === 'number') : [];
        } catch {
            return [];
        }
    }, [raw]);

    const save = (next: number[]) => {
        const json = JSON.stringify(next);
        memoryFallback = json;
        try {
            window.localStorage.setItem(STORAGE_KEY, json);
        } catch {
            /* storage blocked — keeps working for this visit */
        }
        window.dispatchEvent(new Event(EVENT));
    };

    const toggle = (n: number) => save(done.includes(n) ? done.filter((x) => x !== n) : [...done, n]);
    const pct = Math.round((done.length / topics.length) * 100);

    return (
        <div className="rounded-2xl border border-charcoal-100 bg-charcoal-50/60 p-4 sm:p-5">
            <div className="mb-3 flex items-center gap-3">
                <h4 className="text-sm font-semibold text-charcoal-800">The 17 topics</h4>
                <span className="text-xs font-medium text-charcoal-500">
                    {done.length} of {topics.length} revised
                </span>
                {done.length > 0 && (
                    <button
                        type="button"
                        onClick={() => save([])}
                        className="ml-auto flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium text-charcoal-500 hover:bg-charcoal-100 hover:text-charcoal-800 transition-colors"
                    >
                        <RotateCcw size={12} />
                        Reset
                    </button>
                )}
            </div>

            <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-charcoal-200" aria-hidden="true">
                <div className="h-full rounded-full bg-paper-3 transition-[width] duration-500 ease-out" style={{ width: `${pct}%` }} />
            </div>

            <ol className="grid gap-1.5 sm:grid-cols-2">
                {topics.map((topic, i) => {
                    const n = i + 1;
                    const checked = done.includes(n);
                    return (
                        <li key={n}>
                            <label
                                className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-2.5 text-sm transition-colors ${checked
                                    ? 'border-paper-3/30 bg-paper-3/10 text-charcoal-600'
                                    : 'border-charcoal-100 bg-card text-charcoal-800 hover:border-charcoal-200'
                                    }`}
                            >
                                <input
                                    type="checkbox"
                                    className="peer sr-only"
                                    checked={checked}
                                    onChange={() => toggle(n)}
                                />
                                <span
                                    aria-hidden="true"
                                    className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border text-[11px] font-semibold tabular-nums transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-paper-3/50 ${checked
                                        ? 'border-paper-3 bg-paper-3 text-card'
                                        : 'border-charcoal-300 text-charcoal-500'
                                        }`}
                                >
                                    {checked ? <Check size={13} strokeWidth={3} /> : n}
                                </span>
                                <span className="leading-snug">{topic}</span>
                            </label>
                        </li>
                    );
                })}
            </ol>
        </div>
    );
}
