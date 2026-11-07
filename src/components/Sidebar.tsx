'use client';

import { useState, useEffect, useRef, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { X, Search, ChevronRight, FileQuestion, Library } from 'lucide-react';
import { ProgressRing } from './ProgressRing';
import { PathshalaSeal } from './nav/PathshalaSeal';
import { useClassProgress } from '@/lib/useClassProgress';

type ClassMeta = {
    filename: string;
    label: string;
    shloks: number[];
};

type SidebarProps = {
    classes: ClassMeta[];
    onLinkClick?: () => void;
    onClose?: () => void; // For the close button
};

export function Sidebar({ classes, onLinkClick, onClose }: SidebarProps) {
    const pathname = usePathname();
    const [searchTerm, setSearchTerm] = useState('');
    const [expanded, setExpanded] = useState<Record<string, boolean>>({
        [classes[0]?.filename]: true
    });

    const toggle = (fname: string) => {
        setExpanded(prev => ({ ...prev, [fname]: !prev[fname] }));
    };

    // Filter classes based on search term
    const filteredClasses = classes.filter(cls => {
        if (!searchTerm.trim()) return true;

        const term = searchTerm.toLowerCase();
        const classNumMatch = cls.filename.match(/(\d+)/);
        const classId = classNumMatch ? classNumMatch[0] : '';

        // 1. Text match on Label
        if (cls.label.toLowerCase().includes(term)) return true;

        // 2. Check for "Quiz <Number>" or just "Quiz" match
        if (term.includes('quiz')) {
            if (term.includes(classId)) return true; // e.g. "Quiz 5" matches Class 5
            // If just "quiz", maybe show all? Let's be specific for now or show all if plain "quiz"
            if (term.trim() === 'quiz') return true;
        }

        // 3. Check for Shlok Number match
        // Extract all numbers from search term
        const numbers = term.match(/\d+/g);
        if (numbers) {
            // Check if any number from search matches a shlok in this class
            const searchNum = parseInt(numbers[0], 10);
            if (cls.shloks.includes(searchNum)) return true;

            // Allow searching "Class 5" via number
            if (classId === numbers[0]) return true;
        }

        return false;
    });

    // Auto-expand if searching
    const displayClasses = searchTerm.trim() ? filteredClasses : classes;
    const isSearching = !!searchTerm.trim();

    return (
        <aside className="h-full flex flex-col bg-card md:bg-card/60 border-r border-charcoal-200/70 text-charcoal-700">
            {/* Header */}
            <div className="p-4 border-b border-charcoal-200/70 space-y-3 shrink-0">
                {/* Drawer title (phones only — on md+ the top bar carries the brand) */}
                <div className="flex items-center justify-between md:hidden">
                    <Link
                        href="/"
                        onClick={onLinkClick}
                        className="flex items-center gap-2.5 group"
                    >
                        <PathshalaSeal size={30} />
                        <span className="text-base font-display font-bold text-charcoal-900 tracking-tight group-hover:text-saffron-600 transition-colors">
                            Visharad Sahayak
                        </span>
                    </Link>
                    {onClose && (
                        <button
                            onClick={onClose}
                            className="p-1.5 rounded-md text-charcoal-500 hover:text-charcoal-900 hover:bg-charcoal-100 transition-all"
                            aria-label="Close class list"
                        >
                            <X size={20} />
                        </button>
                    )}
                </div>

                {/* Search Bar */}
                <div className="relative">
                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-charcoal-400 pointer-events-none" />
                    <input
                        type="text"
                        placeholder="Search Shlok, Class, Quiz..."
                        aria-label="Search shloks, classes and quizzes"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 bg-charcoal-50 border border-charcoal-200 focus:bg-card focus:border-saffron-400 focus:ring-2 focus:ring-saffron-500/15 rounded-lg text-sm text-charcoal-900 placeholder-charcoal-400 outline-none transition-all"
                    />
                </div>
            </div>

            {/* Navigation */}
            <nav aria-label="Classes" className="flex-1 p-3 space-y-1 overflow-y-auto scrollbar-thin">
                {!isSearching && (
                    <div className="flex items-center gap-1.5 px-2.5 pt-1 pb-2 text-[11px] font-semibold uppercase tracking-wider text-charcoal-400">
                        <Library size={13} />
                        Classes
                        <span className="ml-auto font-medium normal-case tracking-normal">{classes.length}</span>
                    </div>
                )}

                {displayClasses.length === 0 && (
                    <div className="text-center text-charcoal-500 text-sm py-4">
                        No results found
                    </div>
                )}

                {displayClasses.map((cls) => (
                    <ClassNavItem
                        key={cls.filename}
                        cls={cls}
                        isExpanded={isSearching || expanded[cls.filename]}
                        pathname={pathname}
                        searchTerm={searchTerm}
                        onToggle={() => toggle(cls.filename)}
                        onLinkClick={onLinkClick}
                    />
                ))}
            </nav>
        </aside>
    );
}

function ClassNavItem({
    cls,
    isExpanded,
    pathname,
    searchTerm,
    onToggle,
    onLinkClick,
}: {
    cls: ClassMeta;
    isExpanded: boolean;
    pathname: string;
    searchTerm: string;
    onToggle: () => void;
    onLinkClick?: () => void;
}) {
    const classNumMatch = cls.filename.match(/(\d+)/);
    const classId = classNumMatch ? classNumMatch[0] : '1';
    const progress = useClassProgress(classId, cls.shloks);

    return (
        <div className="group">
            <button
                onClick={onToggle}
                className="w-full flex items-center justify-between px-2.5 py-2 text-left text-charcoal-800 text-sm font-semibold hover:bg-charcoal-100 rounded-lg transition-colors"
                title={`${Math.round(progress * 100)}% complete`}
            >
                <span>{cls.label}</span>
                <div className="flex items-center gap-2">
                    <ProgressRing progress={progress} />
                    <ChevronRight
                        size={14}
                        className={`text-charcoal-400 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
                    />
                </div>
            </button>

            <AnimatePresence initial={false}>
                {isExpanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: 'easeOut' }}
                        className="overflow-hidden"
                    >
                        <div className="mt-1 mb-2 ml-4 space-y-0.5 border-l border-charcoal-200 pl-3">
                            {cls.shloks.map((shlokNum) => {
                                const href = `/class/${classId}/shlok/${shlokNum}`;
                                const isActive = pathname === href;

                                // Simple highlight logic if searching for specific number
                                const isMatch = searchTerm.match(/\d+/)
                                    && parseInt(searchTerm.match(/\d+/)![0]) === shlokNum;

                                return (
                                    <SearchMatchLink
                                        key={shlokNum}
                                        href={href}
                                        onClick={onLinkClick}
                                        isMatch={!!isMatch}
                                        className={`
                                          relative group/nav block px-2.5 py-1.5 text-sm rounded-md transition-all
                                          ${isActive
                                                ? 'bg-saffron-50 text-saffron-700 font-medium'
                                                : isMatch
                                                    ? 'bg-saffron-50/70 text-saffron-700'
                                                    : 'text-charcoal-500 hover:text-charcoal-900 hover:bg-charcoal-100'
                                            }
                                        `}
                                    >
                                        <span
                                            aria-hidden="true"
                                            className={`absolute left-0 top-1/2 -translate-y-1/2 w-[3px] rounded-r-full bg-saffron-500 transition-all duration-200 ease-out ${isActive || isMatch ? 'h-4/5' : 'h-0 group-hover/nav:h-3/5'
                                                }`}
                                        />
                                        Shlok {shlokNum}
                                    </SearchMatchLink>
                                );
                            })}

                            {/* Quiz Link */}
                            <SearchMatchLink
                                href={`/class/${classId}/quiz`}
                                onClick={onLinkClick}
                                isMatch={searchTerm.toLowerCase().includes('quiz')}
                                className={`
                                    relative group/nav flex items-center gap-1.5 px-2.5 py-1.5 text-sm rounded-md transition-all
                                    ${pathname === `/class/${classId}/quiz`
                                        ? 'bg-saffron-50 text-saffron-700 font-medium'
                                        : searchTerm.toLowerCase().includes('quiz')
                                            ? 'bg-saffron-50/70 text-saffron-700'
                                            : 'text-charcoal-500 hover:text-charcoal-900 hover:bg-charcoal-100'
                                    }
                                `}
                            >
                                <span
                                    aria-hidden="true"
                                    className={`absolute left-0 top-1/2 -translate-y-1/2 w-[3px] rounded-r-full bg-saffron-500 transition-all duration-200 ease-out ${pathname === `/class/${classId}/quiz` || searchTerm.toLowerCase().includes('quiz') ? 'h-4/5' : 'h-0 group-hover/nav:h-3/5'
                                        }`}
                                />
                                <FileQuestion size={13} />
                                Quiz {classId}
                            </SearchMatchLink>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

// A nav Link that, when it becomes a search match, smooth-scrolls itself into view
// within the sidebar's scroll container and plays a brief highlight flash.
function SearchMatchLink({
    href,
    isMatch,
    onClick,
    className,
    children,
}: {
    href: string;
    isMatch: boolean;
    onClick?: () => void;
    className: string;
    children: ReactNode;
}) {
    const ref = useRef<HTMLAnchorElement>(null);

    useEffect(() => {
        if (isMatch) {
            ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, [isMatch]);

    return (
        <Link
            ref={ref}
            href={href}
            onClick={onClick}
            className={`${className} ${isMatch ? 'animate-highlight-flash' : ''}`}
        >
            {children}
        </Link>
    );
}
