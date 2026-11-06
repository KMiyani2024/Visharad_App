// Fire-and-forget usage tracking. Never throws, never blocks the UI.
export type AnalyticsEventType =
    | 'page_view'
    | 'shlok_read'
    | 'quiz_complete'
    | 'audio_play'
    | 'audio_complete';

export function trackEvent(type: AnalyticsEventType, payload: Record<string, unknown> = {}) {
    if (typeof window === 'undefined') return;

    try {
        const body = JSON.stringify({ type, ...payload });

        if (navigator.sendBeacon) {
            const blob = new Blob([body], { type: 'application/json' });
            navigator.sendBeacon('/api/analytics/event', blob);
        } else {
            fetch('/api/analytics/event', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body,
                keepalive: true,
            }).catch(() => { });
        }
    } catch {
        // Tracking must never break the app.
    }
}
