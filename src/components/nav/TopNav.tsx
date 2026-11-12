'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu } from 'lucide-react';
import { PathshalaSeal } from './PathshalaSeal';
import { getNavItems } from './navItems';
import { ThemeToggle } from '../ThemeToggle';
import { FeedbackButton } from '../FeedbackButton';

type TopNavProps = {
    studyHref: string;
    onOpenMenu: () => void;
};

/**
 * Sticky glass top bar: Pathshala seal + wordmark, the four destinations as a
 * pill group (md+), then feedback and the theme toggle. On phones the pills
 * move to the bottom tab bar and a menu button opens the class list.
 */
export function TopNav({ studyHref, onOpenMenu }: TopNavProps) {
    const pathname = usePathname();
    const items = getNavItems(studyHref);

    return (
        <header className="glass-bar sticky top-0 z-30 border-b border-charcoal-200/70 pt-[env(safe-area-inset-top)]">
            <div className="flex h-14 md:h-[60px] items-center gap-2 px-3 md:px-6">
                <button
                    type="button"
                    onClick={onOpenMenu}
                    className="md:hidden -ml-1 flex size-9 items-center justify-center rounded-full text-charcoal-600 hover:bg-charcoal-100 hover:text-charcoal-900 transition-colors"
                    aria-label="Open class list"
                >
                    <Menu size={21} />
                </button>

                <Link href="/" className="flex min-w-0 items-center gap-2.5 group" aria-label="Visharad Sahayak home">
                    <PathshalaSeal size={34} />
                    <span className="flex min-w-0 flex-col leading-tight">
                        <span className="truncate text-[15px] md:text-base font-display font-bold tracking-tight text-charcoal-900 group-hover:text-saffron-600 transition-colors">
                            Visharad Sahayak
                        </span>
                        <span className="hidden sm:block truncate text-[11px] font-medium text-charcoal-500">
                            Akshar-Purushottam Sanskrit Pathshala
                        </span>
                    </span>
                </Link>

                {/* Destinations (md+) */}
                <nav aria-label="Main" className="hidden md:flex flex-1 justify-center">
                    <div className="flex items-center gap-0.5 rounded-full border border-charcoal-200 bg-card p-1 shadow-sm">
                        {items.map(({ key, label, href, icon: Icon, isActive }) => {
                            const active = isActive(pathname);
                            return (
                                <Link
                                    key={key}
                                    href={href}
                                    aria-current={active ? 'page' : undefined}
                                    className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13.5px] font-medium whitespace-nowrap transition-all ${active
                                        ? 'bg-saffron-50 text-saffron-700 ring-1 ring-saffron-200'
                                        : 'text-charcoal-500 hover:bg-charcoal-50 hover:text-charcoal-900'
                                        }`}
                                >
                                    <Icon size={15} strokeWidth={active ? 2.2 : 1.9} />
                                    {label}
                                </Link>
                            );
                        })}
                    </div>
                </nav>

                <div className="flex-1 md:hidden" />

                <div className="flex shrink-0 items-center gap-1.5">
                    <FeedbackButton />
                    <ThemeToggle />
                </div>
            </div>
        </header>
    );
}
