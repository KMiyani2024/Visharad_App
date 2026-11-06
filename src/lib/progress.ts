// Per-class study progress, tracked client-side in localStorage (no backend/auth exists).
// Read progress = shlok pages the user has visited; quiz progress = the class quiz completed once.

import { trackEvent } from './analytics';

const STORAGE_KEY = 'visharad_progress_v1';
export const PROGRESS_EVENT = 'visharad-progress-updated';

type ClassProgress = { shloks: number[]; quizDone: boolean };
type ProgressStore = Record<string, ClassProgress>;

function readStore(): ProgressStore {
    if (typeof window === 'undefined') return {};
    try {
        return JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '{}');
    } catch {
        return {};
    }
}

function writeStore(store: ProgressStore) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    // Notify listeners in this tab (the native `storage` event only fires in other tabs).
    window.dispatchEvent(new Event(PROGRESS_EVENT));
}

export function getClassProgress(classId: string): ClassProgress {
    return readStore()[classId] || { shloks: [], quizDone: false };
}

export function markShlokRead(classId: string, shlokNumber: number) {
    const store = readStore();
    const entry = store[classId] || { shloks: [], quizDone: false };
    if (!entry.shloks.includes(shlokNumber)) {
        store[classId] = { ...entry, shloks: [...entry.shloks, shlokNumber] };
        writeStore(store);
        trackEvent('shlok_read', { classId, shlokNumber });
    }
}

export function markQuizDone(classId: string) {
    const store = readStore();
    const entry = store[classId] || { shloks: [], quizDone: false };
    if (!entry.quizDone) {
        store[classId] = { ...entry, quizDone: true };
        writeStore(store);
    }
}
