// Light / dark theme, after Smruti: system → light → dark, persisted in localStorage.
// The boot script (THEME_BOOT_SCRIPT) runs in <head> before first paint so there is no flash.

export type ThemeChoice = 'system' | 'light' | 'dark';

export const THEME_STORAGE_KEY = 'visharad-theme';
export const THEME_ORDER: ThemeChoice[] = ['system', 'light', 'dark'];

export const THEME_BOOT_SCRIPT = `try{var t=localStorage.getItem('${THEME_STORAGE_KEY}');var d=t?t==='dark':matchMedia('(prefers-color-scheme: dark)').matches;if(d)document.documentElement.classList.add('dark')}catch(e){}`;

export function readThemeChoice(): ThemeChoice {
    try {
        const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
        if (saved === 'light' || saved === 'dark') return saved;
    } catch {
        /* storage blocked — fall back to system */
    }
    return 'system';
}

export function applyTheme(choice: ThemeChoice) {
    const dark =
        choice === 'dark' ||
        (choice === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', dark);
}

const THEME_EVENT = 'visharad-theme-change';

export function saveThemeChoice(choice: ThemeChoice) {
    try {
        if (choice === 'system') window.localStorage.removeItem(THEME_STORAGE_KEY);
        else window.localStorage.setItem(THEME_STORAGE_KEY, choice);
    } catch {
        /* storage blocked — applies for this session only */
    }
    window.dispatchEvent(new Event(THEME_EVENT));
}

/** For useSyncExternalStore: fires on changes in this tab and in other tabs. */
export function subscribeThemeChoice(onChange: () => void) {
    const onStorage = (e: StorageEvent) => {
        if (e.key === THEME_STORAGE_KEY) {
            applyTheme(readThemeChoice());
            onChange();
        }
    };
    window.addEventListener(THEME_EVENT, onChange);
    window.addEventListener('storage', onStorage);
    return () => {
        window.removeEventListener(THEME_EVENT, onChange);
        window.removeEventListener('storage', onStorage);
    };
}
