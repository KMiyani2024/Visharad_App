import { auth, signOut } from '@/auth';
import { readRecords } from '@/lib/azureBlob';

type AnalyticsEvent = {
    type: 'page_view' | 'shlok_read' | 'quiz_complete' | 'audio_play' | 'audio_complete';
    ts: string;
    path?: string;
    classId?: string | number;
    shlokNumber?: number;
    quizType?: string;
    score?: number;
    total?: number;
    reference?: string;
};

type FeedbackEntry = {
    timestamp: string;
    pageUrl?: string;
    responses?: {
        overallRating?: number;
        confusingParts?: string;
        featureRequest?: string;
        navRating?: number;
        generalComment?: string;
    };
};

function topCounts(entries: [string, number][], limit = 10) {
    return entries.sort((a, b) => b[1] - a[1]).slice(0, limit);
}

function countBy<T>(items: T[], key: (item: T) => string | undefined) {
    const counts = new Map<string, number>();
    for (const item of items) {
        const k = key(item);
        if (!k) continue;
        counts.set(k, (counts.get(k) || 0) + 1);
    }
    return [...counts.entries()];
}

function BarList({ rows, total }: { rows: [string, number][]; total: number }) {
    if (rows.length === 0) {
        return <p className="text-sm text-charcoal-400">No data yet.</p>;
    }
    const max = Math.max(...rows.map(([, count]) => count), 1);
    return (
        <div className="space-y-2">
            {rows.map(([label, count]) => (
                <div key={label} className="flex items-center gap-3 text-sm">
                    <span className="w-32 shrink-0 truncate text-charcoal-600" title={label}>{label}</span>
                    <div className="flex-1 h-2 rounded-full bg-charcoal-100 overflow-hidden">
                        <div
                            className="h-2 rounded-full bg-gradient-to-r from-saffron-400 to-saffron-600"
                            style={{ width: `${(count / max) * 100}%` }}
                        />
                    </div>
                    <span className="w-10 shrink-0 text-right font-semibold text-charcoal-800">{count}</span>
                </div>
            ))}
            <p className="text-xs text-charcoal-400 pt-1">{total} total</p>
        </div>
    );
}

function StatTile({ label, value }: { label: string; value: number | string }) {
    return (
        <div className="bg-white rounded-2xl border border-charcoal-100 p-5 shadow-sm">
            <div className="text-3xl font-display font-extrabold text-charcoal-900">{value}</div>
            <div className="text-sm text-charcoal-500 mt-1">{label}</div>
        </div>
    );
}

export default async function AdminDashboardPage() {
    const session = await auth();

    const [events, feedback] = await Promise.all([
        readRecords<AnalyticsEvent>('analytics-events.ndjson'),
        readRecords<FeedbackEntry>('feedback.ndjson'),
    ]);

    const pageViews = events.filter((e) => e.type === 'page_view');
    const shlokReads = events.filter((e) => e.type === 'shlok_read');
    const quizCompletions = events.filter((e) => e.type === 'quiz_complete');
    const audioPlays = events.filter((e) => e.type === 'audio_play');
    const audioCompletes = events.filter((e) => e.type === 'audio_complete');

    const topPages = topCounts(countBy(pageViews, (e) => e.path));
    const topShlokClasses = topCounts(countBy(shlokReads, (e) => e.classId ? `Class ${e.classId}` : undefined));
    const topAudio = topCounts(countBy(audioPlays, (e) => e.reference));

    const quizByClass = new Map<string, { count: number; scoreSum: number; totalSum: number }>();
    for (const q of quizCompletions) {
        const key = q.classId ? `Class ${q.classId}` : 'Unknown';
        const entry = quizByClass.get(key) || { count: 0, scoreSum: 0, totalSum: 0 };
        entry.count += 1;
        entry.scoreSum += q.score || 0;
        entry.totalSum += q.total || 0;
        quizByClass.set(key, entry);
    }
    const quizRows: [string, number][] = [...quizByClass.entries()].map(([classLabel, stats]) => [
        `${classLabel} (${stats.totalSum > 0 ? Math.round((stats.scoreSum / stats.totalSum) * 100) : 0}% avg)`,
        stats.count,
    ]);

    const recentFeedback = [...feedback]
        .sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''))
        .slice(0, 15);

    return (
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-10">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-display font-bold text-charcoal-900">Admin Analytics</h1>
                    <p className="text-sm text-charcoal-500 mt-1">Signed in as {session?.user?.email}</p>
                </div>
                <form
                    action={async () => {
                        'use server';
                        await signOut({ redirectTo: '/admin/sign-in' });
                    }}
                >
                    <button
                        type="submit"
                        className="px-4 py-2 text-sm bg-white border border-charcoal-200 text-charcoal-700 rounded-full font-semibold hover:bg-charcoal-50 transition-all"
                    >
                        Sign out
                    </button>
                </form>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatTile label="Page views" value={pageViews.length} />
                <StatTile label="Shlok reads" value={shlokReads.length} />
                <StatTile label="Quizzes completed" value={quizCompletions.length} />
                <StatTile label="Audio plays" value={audioPlays.length} />
            </div>

            <div className="grid md:grid-cols-2 gap-6">
                <section className="bg-white rounded-2xl border border-charcoal-100 p-6 shadow-sm">
                    <h2 className="font-display font-bold text-charcoal-900 mb-4">Top pages</h2>
                    <BarList rows={topPages} total={pageViews.length} />
                </section>

                <section className="bg-white rounded-2xl border border-charcoal-100 p-6 shadow-sm">
                    <h2 className="font-display font-bold text-charcoal-900 mb-4">Most-read classes</h2>
                    <BarList rows={topShlokClasses} total={shlokReads.length} />
                </section>

                <section className="bg-white rounded-2xl border border-charcoal-100 p-6 shadow-sm">
                    <h2 className="font-display font-bold text-charcoal-900 mb-4">Quiz completions by class</h2>
                    <BarList rows={quizRows} total={quizCompletions.length} />
                </section>

                <section className="bg-white rounded-2xl border border-charcoal-100 p-6 shadow-sm">
                    <h2 className="font-display font-bold text-charcoal-900 mb-4">
                        Most-played audio
                        <span className="text-xs font-normal text-charcoal-400 ml-2">
                            {audioCompletes.length} completions
                        </span>
                    </h2>
                    <BarList rows={topAudio} total={audioPlays.length} />
                </section>
            </div>

            <section className="bg-white rounded-2xl border border-charcoal-100 p-6 shadow-sm">
                <h2 className="font-display font-bold text-charcoal-900 mb-4">Recent feedback</h2>
                {recentFeedback.length === 0 ? (
                    <p className="text-sm text-charcoal-400">No feedback yet.</p>
                ) : (
                    <div className="space-y-4">
                        {recentFeedback.map((f, i) => (
                            <div key={i} className="border-b border-charcoal-100 last:border-0 pb-4 last:pb-0">
                                <div className="flex items-center justify-between text-xs text-charcoal-400 mb-1">
                                    <span>{f.pageUrl}</span>
                                    <span>{f.timestamp}</span>
                                </div>
                                <div className="text-sm text-charcoal-700 space-y-1">
                                    {f.responses?.overallRating != null && (
                                        <p><span className="font-semibold">Overall:</span> {f.responses.overallRating}/5</p>
                                    )}
                                    {f.responses?.navRating != null && (
                                        <p><span className="font-semibold">Navigation:</span> {f.responses.navRating}/5</p>
                                    )}
                                    {f.responses?.confusingParts && (
                                        <p><span className="font-semibold">Confusing:</span> {f.responses.confusingParts}</p>
                                    )}
                                    {f.responses?.featureRequest && (
                                        <p><span className="font-semibold">Requested:</span> {f.responses.featureRequest}</p>
                                    )}
                                    {f.responses?.generalComment && (
                                        <p><span className="font-semibold">Comment:</span> {f.responses.generalComment}</p>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
}
