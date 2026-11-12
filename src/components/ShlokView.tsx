'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefItem } from '@/lib/types';
import { ChevronDown, ChevronUp, ArrowLeft, ArrowRight, Sparkles, Type } from 'lucide-react';
import { markShlokRead } from '@/lib/progress';
import { useReadingMode } from '@/lib/readingMode';

export function ReadingModeToggle() {
    const { readingMode, toggleReadingMode } = useReadingMode();

    return (
        <button
            onClick={toggleReadingMode}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all ${readingMode
                ? 'bg-saffron-100 text-saffron-800 border-saffron-200'
                : 'bg-charcoal-100 text-charcoal-700 border-transparent hover:bg-charcoal-200'
                }`}
            title={readingMode ? 'Exit reading mode' : 'Reading mode: larger text, dimmed sidebar'}
        >
            <Type size={13} />
            Reading Mode
        </button>
    );
}

export function ExplanationPlaceholder() {
    return (
        <div className="bg-card border border-charcoal-100 rounded-2xl p-5 mb-8 shadow-sm">
            <h3 className="text-sm font-semibold text-charcoal-400 uppercase tracking-wide mb-2">
                Explanation
            </h3>
            <p className="text-charcoal-400 italic">Coming soon</p>
        </div>
    );
}

// --- Content Components ---

export function ShlokCard({
    shlokSanskrit,
    shlokTransliteration,
    shlokNumber,
    classId
}: {
    shlokSanskrit: string | null;
    shlokTransliteration: string | null;
    shlokNumber: number;
    classId?: string;
}) {
    // Helper to format shlok text: separate multiple shloks by line
    // Look for "॥ <digits> ॥" or "(<digits>)" and append newline
    const formatShlokText = (text: string | null) => {
        if (!text) return null;
        return text
            .replace(/(॥\s*\d+(?:-\d+)?\s*॥)/g, '$1\n')
            .replace(/(\(\d+(?:-\d+)?\))/g, '$1\n');
    };

    useEffect(() => {
        if (classId) {
            markShlokRead(classId, shlokNumber);
        }
    }, [classId, shlokNumber]);

    const { readingMode } = useReadingMode();

    return (
        <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            className="relative mb-8 text-center py-10 px-4 md:px-8 bg-card rounded-3xl border border-charcoal-100 shadow-sm overflow-hidden"
        >
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-saffron-400 via-saffron-500 to-saffron-600" />

            <div className="inline-flex items-center gap-1.5 mb-6 px-3 py-1 rounded-full bg-saffron-50 text-saffron-700 text-xs font-bold uppercase tracking-wider">
                <Sparkles size={12} />
                Shlok {shlokNumber}
            </div>

            {shlokSanskrit && (
                <h2
                    className={`font-devanagari text-charcoal-900 whitespace-pre-wrap ${readingMode ? 'text-3xl md:text-4xl leading-loose mb-6' : 'text-2xl md:text-3xl leading-relaxed mb-4'}`}
                    dangerouslySetInnerHTML={{ __html: formatShlokText(shlokSanskrit) || '' }}
                />
            )}

            {shlokTransliteration && (
                <p
                    className={`whitespace-pre-wrap ${readingMode ? 'leading-loose' : 'leading-relaxed'} ${shlokSanskrit
                        ? `${readingMode ? 'text-xl' : 'text-lg'} text-charcoal-500 italic`
                        : `font-devanagari text-charcoal-900 ${readingMode ? 'text-3xl' : 'text-2xl'}`
                        }`}
                    dangerouslySetInnerHTML={{ __html: formatShlokText(shlokTransliteration) || '' }}
                />
            )}
        </motion.div>
    );
}

import { AudioPlayer } from './AudioPlayer';

// Type for the JSON structure provided by user
type TranslationData = {
    shlok?: number;
    references: {
        id: string;
        text: string;
        source: string;
    }[];
};

export function ReferenceItem({
    item,
    classId,
    source,
    shlokNumber,
    indexInSource,
    expandSignal
}: {
    item: RefItem;
    source?: string;
    classId?: string;
    shlokNumber: number;
    indexInSource: number;
    expandSignal?: { expand: boolean; timestamp: number } | null;
}) {

    const formattedText = item.text;
    const [translation, setTranslation] = useState<string | null>(null);
    const [isExpanded, setIsExpanded] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const { readingMode } = useReadingMode();

    const handleRefClick = async () => {
        setIsExpanded(prev => !prev);
    };

    // React to master toggle signal
    useEffect(() => {
        if (expandSignal) {
            setIsExpanded(expandSignal.expand);
        }
    }, [expandSignal]);

    // Fetch translation when expanded
    useEffect(() => {
        if (isExpanded && !translation && !isLoading) {
            (async () => {
                setIsLoading(true);
                try {
                    const res = await fetch('/reference_translations_v2.json');
                    if (!res.ok) throw new Error('Failed to load translations');

                    const data = await res.json();

                    // 1. Find the shlok data
                    let shlokData;
                    if (Array.isArray(data)) {
                        shlokData = data.find((d: any) => {
                            const shlokStr = String(d.shlok);
                            // 1. Exact match
                            if (shlokStr === String(shlokNumber)) return true;
                            // 2. Range match (e.g., "129-130")
                            if (shlokStr.includes('-')) {
                                const parts = shlokStr.split('-');
                                if (parts.length === 2) {
                                    const start = parseInt(parts[0], 10);
                                    const end = parseInt(parts[1], 10);
                                    const target = parseInt(String(shlokNumber), 10);
                                    if (!isNaN(start) && !isNaN(end) && !isNaN(target)) {
                                        if (target >= start && target <= end) return true;
                                    }
                                }
                            }
                            return false;
                        });
                    } else if (String(data.shlok) === String(shlokNumber)) {
                        // Single object case (legacy support for simple structure if needed)
                        shlokData = data;
                    }

                    if (!shlokData || !shlokData.references) {
                        setTranslation("Translation not found for this Shlok.");
                        return;
                    }

                    // 2. Find the reference by ID
                    let match;
                    if (item.id) {
                        match = shlokData.references.find((r: any) => r.id === item.id);
                    }

                    // Fallback to source-based matching ONLY if ID is missing (legacy compat)
                    if (!match && !item.id) {
                        // Normalize strings for comparison (remove spaces, punctuation, lowercase)
                        const normalize = (s: string) => s.replace(/[\s\.]/g, '').toLowerCase();
                        const targetRef = normalize(item.displayRef || item.ref);

                        const matchingRefs = shlokData.references.filter((r: any) =>
                            normalize(r.source) === targetRef
                        );

                        // Determine the exact occurrence index from the parser's deduplication logic (e.g. "Vach. (2)")
                        let occurrenceIndex = 0;
                        const matchParen = item.ref.match(/\((\d+)\)$/);
                        if (matchParen) {
                            occurrenceIndex = parseInt(matchParen[1], 10) - 1;
                        }

                        // Use the occurrence index, or default to the first exact match
                        match = matchingRefs[occurrenceIndex] || matchingRefs[0];
                    }

                    if (match) {
                        setTranslation(match.text);
                    } else {
                        setTranslation("Translation not available.");
                    }
                } catch (error) {
                    console.error(error);
                    setTranslation("Error loading translation.");
                } finally {
                    setIsLoading(false);
                }
            })();
        }
    }, [isExpanded, translation, isLoading, item, shlokNumber, indexInSource]); // Dependencies for fetching


    return (
        <div className="mb-5 p-4 md:p-5 rounded-2xl border border-charcoal-100 bg-card hover:border-charcoal-200 transition-colors reference-block">
            <div className="mb-3">
                <AudioPlayer
                    reference={item.ref}
                    displayRef={item.displayRef || item.ref}
                    classId={classId}
                />
            </div>
            <div>
                <div className="flex flex-wrap justify-between items-center gap-2 mb-3">
                    <span className="text-charcoal-700 text-sm font-bold">
                        {item.displayRef || item.ref}
                    </span>
                    <button
                        onClick={handleRefClick}
                        className={`flex items-center gap-1.5 px-3 py-1.5 border text-xs font-semibold rounded-full transition-colors ${isExpanded
                            ? 'bg-saffron-100 text-saffron-800 border-saffron-200'
                            : 'bg-card text-charcoal-600 border-charcoal-200 hover:bg-charcoal-50'
                            }`}
                        title={isExpanded ? "Hide English Translation" : "Show English Translation"}
                    >
                        <span>{isExpanded ? "Hide Translation" : "English Translation"}</span>
                        {isExpanded ? (
                            <ChevronUp className="w-3 h-3" />
                        ) : (
                            <ChevronDown className="w-3 h-3" />
                        )}
                    </button>

                </div>

                {/* Gujarati Text */}
                <p className={`font-gujarati text-charcoal-700 whitespace-pre-wrap ${readingMode ? 'text-lg leading-loose' : 'leading-relaxed'}`}>
                    {formattedText}
                </p>

                {/* Inline English Translation */}
                <AnimatePresence initial={false}>
                    {isExpanded && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2, ease: 'easeOut' }}
                            className="overflow-hidden"
                        >
                            <div className="mt-4 pt-4 border-t border-dashed border-charcoal-200">
                                {isLoading ? (
                                    <div className="bg-charcoal-50 rounded-xl p-3 border border-charcoal-100 space-y-2">
                                        <div className="h-3 w-full rounded bg-shimmer" />
                                        <div className="h-3 w-5/6 rounded bg-shimmer" />
                                        <div className="h-3 w-2/3 rounded bg-shimmer" />
                                    </div>
                                ) : (
                                    <div className={`bg-charcoal-50 rounded-xl p-3 text-charcoal-800 border border-charcoal-100 ${readingMode ? 'font-serif text-base leading-loose' : 'text-sm leading-relaxed'}`}>
                                        <p className="whitespace-pre-wrap">{translation}</p>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}




export function ReferenceSection({
    shlokReferences,
    classId,
    shlokNumber
}: {
    shlokReferences: Record<string, RefItem[]>;
    classId: string;
    shlokNumber: number;
}) {
    // 1. Flatten and Group Logic (moved from page.tsx)
    const allRefs: { source: string; item: RefItem }[] = [];
    Object.entries(shlokReferences).forEach(([source, items]) => {
        items.forEach(item => allRefs.push({ source, item }));
    });

    type GroupObj = { title?: string; itemsBySource: Record<string, RefItem[]> };
    const groups = new Map<string, GroupObj>();

    allRefs.forEach(({ source, item }) => {
        const key = item.title || 'Untitled';
        if (!groups.has(key)) {
            groups.set(key, { title: item.title, itemsBySource: {} });
        }
        const group = groups.get(key)!;
        if (!group.itemsBySource[source]) {
            group.itemsBySource[source] = [];
        }
        group.itemsBySource[source].push(item);
    });

    // Expand/Collapse All State using a signal object
    // We use an object { expand: boolean, timestamp: number } to ensure even if we click same button twice (e.g. ensure all expanded), it triggers.
    const [expandSignal, setExpandSignal] = useState<{ expand: boolean; timestamp: number } | null>(null);

    return (
        <div className="space-y-8">
            {/* Master Controls */}
            <div className="flex justify-end gap-3 mb-4">
                <button
                    onClick={() => setExpandSignal({ expand: true, timestamp: Date.now() })}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-charcoal-100 text-charcoal-700 text-xs font-semibold rounded-lg hover:bg-charcoal-200 hover:scale-105 hover:shadow-md transition-all"
                >
                    <ChevronDown className="w-3 h-3" />
                    Expand All
                </button>
                <button
                    onClick={() => setExpandSignal({ expand: false, timestamp: Date.now() })}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-charcoal-100 text-charcoal-700 text-xs font-semibold rounded-lg hover:bg-charcoal-200 hover:scale-105 hover:shadow-md transition-all"
                >
                    <ChevronUp className="w-3 h-3" />
                    Collapse All
                </button>
            </div>

            {Array.from(groups.values()).map((group, groupIdx) => (
                <div key={`group-${groupIdx}`} className="mb-10">
                    {/* Title (Topic) Header */}
                    {group.title && (
                        <h3 className={`text-xl font-display font-bold mb-6 pb-3 border-b border-charcoal-100 ${group.title === 'Memorize all the details of any TWO incidents from this letter. Understand the other incidents for further reinforcement.'
                            ? 'text-saffron-600'
                            : 'text-charcoal-800'
                            }`}>
                            {group.title}
                        </h3>
                    )}

                    {/* Render Sources within this Group */}
                    {Object.entries(group.itemsBySource).map(([source, items], sourceIdx) => (
                        <div key={`source-${sourceIdx}`} className="mb-6 last:mb-0">
                            {/* Source Sub-header */}
                            <h4 className="text-sm font-bold text-charcoal-500 uppercase tracking-wider mb-3">
                                {source}
                            </h4>

                            {items.map((ref, refIdx) => (
                                <ReferenceItem
                                    key={`${source}-${refIdx}`}
                                    item={ref}
                                    classId={classId}
                                    source={source}
                                    shlokNumber={shlokNumber}
                                    indexInSource={refIdx}
                                    expandSignal={expandSignal}
                                />
                            ))}
                        </div>
                    ))}
                </div>
            ))}
        </div>
    );
}

export function NavButtons({

    prevHref,
    nextHref,
    nextLabel = "Next Shlok"
}: {
    prevHref: string | null;
    nextHref: string | null;
    nextLabel?: string;
}) {
    return (
        <div className="flex flex-row justify-between items-center mt-12 pt-4 md:pt-6 border-t border-charcoal-100 sticky bottom-[calc(max(0.75rem,env(safe-area-inset-bottom))+4.75rem)] md:bottom-0 bg-background/90 backdrop-blur-md pb-4 md:pb-6 gap-3 md:gap-4 z-10">
            {prevHref ? (
                <Link
                    href={prevHref}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 sm:px-6 py-2.5 border border-charcoal-200 rounded-full text-charcoal-600 hover:bg-charcoal-50 hover:text-charcoal-900 hover:border-charcoal-300 hover:scale-105 hover:shadow-md transition-all text-sm font-medium"
                >
                    <ArrowLeft size={15} />
                    <span className="sm:hidden">Previous</span>
                    <span className="hidden sm:inline">Previous Shlok</span>
                </Link>
            ) : (
                <span className="flex-1 sm:flex-none text-center px-4 sm:px-6 py-2.5 border border-charcoal-100 rounded-full text-charcoal-300 text-sm font-medium cursor-not-allowed">
                    Previous
                </span>
            )}

            {nextHref ? (
                <Link
                    href={nextHref}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 sm:px-6 py-2.5 bg-saffron-500 hover:bg-saffron-600 rounded-full text-white transition-all text-sm font-semibold shadow-md shadow-saffron-900/15 hover:-translate-y-0.5"
                >
                    {nextLabel}
                    <ArrowRight size={15} />
                </Link>
            ) : (
                <span className="flex-1 sm:flex-none text-center px-4 sm:px-6 py-2.5 border border-charcoal-100 rounded-full text-charcoal-300 text-sm font-medium cursor-not-allowed">
                    Next
                </span>
            )}
        </div>
    );
}
