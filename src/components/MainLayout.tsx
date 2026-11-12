'use client';

import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Sidebar } from './Sidebar';
import { usePathname } from 'next/navigation';
import { ReadingModeProvider, useReadingMode } from '@/lib/readingMode';
import { AudioPlayerProvider } from '@/lib/audioPlayer';
import { NowPlayingBar } from './NowPlayingBar';
import { TopNav } from './nav/TopNav';
import { BottomTabBar } from './nav/BottomTabBar';

type MainLayoutProps = {
    classes: {
        filename: string;
        label: string;
        shloks: number[];
    }[];
    children: React.ReactNode;
};

export function MainLayout(props: MainLayoutProps) {
    return (
        <ReadingModeProvider>
            <AudioPlayerProvider>
                <MainLayoutInner {...props} />
            </AudioPlayerProvider>
        </ReadingModeProvider>
    );
}

/** First shlok of the first class — where "Study" starts. */
function getStudyHref(classes: MainLayoutProps['classes']) {
    const first = classes[0];
    if (!first || first.shloks.length === 0) return '/';
    const classId = first.filename.match(/(\d+)/)?.[0] || '1';
    return `/class/${classId}/shlok/${first.shloks[0]}`;
}

function MainLayoutInner({ classes, children }: MainLayoutProps) {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const pathname = usePathname();
    const { readingMode } = useReadingMode();
    const studyHref = getStudyHref(classes);

    const closeMenu = () => setIsMobileMenuOpen(false);

    // Close the mobile drawer automatically on route changes
    useEffect(() => {
        closeMenu();
    }, [pathname]);

    return (
        <div className="min-h-screen text-charcoal-900 font-sans flex flex-col">
            <TopNav studyHref={studyHref} onOpenMenu={() => setIsMobileMenuOpen(true)} />

            {/* Mobile Overlay Backdrop */}
            <AnimatePresence>
                {isMobileMenuOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm"
                        onClick={closeMenu}
                        aria-hidden="true"
                    />
                )}
            </AnimatePresence>

            <div className="flex flex-1">
                {/* Class list: a drawer on phones, a sticky rail under the top bar on md+ */}
                <div className={`
                    fixed inset-y-0 left-0 z-50 w-72 transform transition-all duration-300 ease-out
                    md:sticky md:top-[60px] md:z-0 md:h-[calc(100dvh-60px)] md:translate-x-0 md:shrink-0
                    ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
                    ${readingMode ? 'md:opacity-40 md:hover:opacity-100' : ''}
                `}>
                    <Sidebar
                        classes={classes}
                        onLinkClick={closeMenu}
                        onClose={closeMenu}
                    />
                </div>

                {/* Main Content (bottom padding clears the phone's tab bar) */}
                <main className="relative z-10 flex-1 min-w-0 w-full max-w-5xl mx-auto md:px-8 px-4 pt-6 md:pt-10 pb-32 md:pb-12">
                    <AnimatePresence mode="wait" initial={false}>
                        <motion.div
                            key={pathname}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            transition={{ duration: 0.2, ease: 'easeInOut' }}
                        >
                            {children}
                        </motion.div>
                    </AnimatePresence>
                </main>
            </div>

            <BottomTabBar studyHref={studyHref} />
            <NowPlayingBar />
        </div>
    );
}
