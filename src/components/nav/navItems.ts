import { BookOpen, GraduationCap, House, ListChecks, type LucideIcon } from 'lucide-react';

/**
 * The app's top-level destinations, shared by the desktop top bar and the
 * phone's bottom tab bar. "Study" points at the first shlok; its href is
 * filled in at runtime from the class list.
 */
export type NavItem = {
    key: 'home' | 'study' | 'test' | 'final';
    label: string;
    /** Shorter label for the phone's bottom bar. */
    short: string;
    icon: LucideIcon;
    href: string;
    isActive: (pathname: string) => boolean;
};

export function getNavItems(studyHref: string): NavItem[] {
    return [
        {
            key: 'home',
            label: 'Home',
            short: 'Home',
            icon: House,
            href: '/',
            isActive: (p) => p === '/',
        },
        {
            key: 'study',
            label: 'Study',
            short: 'Study',
            icon: BookOpen,
            href: studyHref,
            isActive: (p) => p.startsWith('/class/'),
        },
        {
            key: 'test',
            label: 'Test Yourself',
            short: 'Test',
            icon: ListChecks,
            href: '/test-yourself',
            isActive: (p) => p.startsWith('/test-yourself'),
        },
        {
            key: 'final',
            label: 'Final Exam',
            short: 'Final Exam',
            icon: GraduationCap,
            href: '/final-exam',
            isActive: (p) => p.startsWith('/final-exam'),
        },
    ];
}
