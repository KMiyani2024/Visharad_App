'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { getNavItems } from './navItems';

/**
 * The phone's floating glass capsule (after Smruti's tab bar): the active tab
 * sits in a recessed pill at full contrast; the rest stay quiet.
 */
export function BottomTabBar({ studyHref }: { studyHref: string }) {
    const pathname = usePathname();
    const items = getNavItems(studyHref);

    return (
        <nav
            aria-label="Sections"
            className="liquid-glass-nav md:hidden fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-30 mx-auto flex max-w-md items-center justify-around rounded-[26px] p-1.5"
        >
            {items.map(({ key, short, href, icon: Icon, isActive }) => {
                const active = isActive(pathname);
                return (
                    <Link
                        key={key}
                        href={href}
                        aria-current={active ? 'page' : undefined}
                        className="relative flex flex-1 flex-col items-center justify-center gap-0.5 py-1.5 transition-transform duration-200 ease-out active:scale-90"
                    >
                        <span
                            aria-hidden="true"
                            className={`absolute inset-y-0 left-1/2 w-[4.5rem] max-w-full -translate-x-1/2 rounded-[18px] transition-opacity duration-300 ease-out ${active
                                ? 'bg-black/[0.06] opacity-100 shadow-[inset_0_1px_0_rgb(255_255_255_/_0.28)] dark:bg-black/40'
                                : 'opacity-0'
                                }`}
                        />
                        <Icon
                            size={22}
                            strokeWidth={active ? 2.1 : 1.7}
                            className={`relative transition-colors duration-300 ${active ? 'text-saffron-600' : 'text-charcoal-500'}`}
                        />
                        <span
                            className={`relative text-[10px] transition-colors duration-300 ${active ? 'font-semibold text-charcoal-900' : 'font-medium text-charcoal-500'}`}
                        >
                            {short}
                        </span>
                    </Link>
                );
            })}
        </nav>
    );
}
