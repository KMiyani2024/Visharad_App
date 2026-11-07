'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';
import {
    THEME_ORDER,
    applyTheme,
    readThemeChoice,
    saveThemeChoice,
    subscribeThemeChoice,
    type ThemeChoice,
} from '@/lib/theme';

const LABEL: Record<ThemeChoice, string> = {
    system: 'Theme: match device',
    light: 'Theme: light',
    dark: 'Theme: dark',
};

/** Cycles system → light → dark. The boot script in layout.tsx has already applied the saved choice. */
export function ThemeToggle({ className = '' }: { className?: string }) {
    const choice = useSyncExternalStore(subscribeThemeChoice, readThemeChoice, () => 'system' as const);

    // While on "system", follow the device if it switches (e.g. at sunset).
    useEffect(() => {
        if (choice !== 'system') return;
        const media = window.matchMedia('(prefers-color-scheme: dark)');
        const onChange = () => applyTheme('system');
        media.addEventListener('change', onChange);
        return () => media.removeEventListener('change', onChange);
    }, [choice]);

    const cycle = () => {
        const next = THEME_ORDER[(THEME_ORDER.indexOf(choice) + 1) % THEME_ORDER.length];
        saveThemeChoice(next);
        applyTheme(next);
    };

    const Icon = choice === 'light' ? Sun : choice === 'dark' ? Moon : Monitor;

    return (
        <button
            type="button"
            onClick={cycle}
            aria-label={`${LABEL[choice]}. Click to change.`}
            title={LABEL[choice]}
            className={`flex size-9 items-center justify-center rounded-full border border-charcoal-200 bg-card text-charcoal-600 transition-all hover:bg-charcoal-50 hover:text-charcoal-900 active:scale-90 ${className}`}
        >
            <Icon size={17} strokeWidth={1.9} />
        </button>
    );
}
