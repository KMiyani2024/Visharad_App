'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Gamepad2 } from 'lucide-react';
import type { PublicGame } from '@/lib/games';

export function GamesHub() {
    const [games, setGames] = useState<PublicGame[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        fetch('/api/games', { cache: 'no-store' })
            .then(async response => {
                if (!response.ok) throw new Error('Games are temporarily unavailable.');
                setGames(await response.json() as PublicGame[]);
            })
            .catch(reason => setError(reason instanceof Error ? reason.message : 'Unable to load games.'))
            .finally(() => setLoading(false));
    }, []);

    return (
        <div className="space-y-8">
            <header className="relative overflow-hidden rounded-3xl bg-charcoal-900 px-6 py-10 text-white sm:px-10">
                <div className="absolute -right-10 -top-20 h-64 w-64 rounded-full bg-saffron-500/20 blur-3xl" />
                <h1 className="relative font-display text-4xl font-bold tracking-tight sm:text-5xl">Games</h1>
            </header>

            <section aria-labelledby="games-heading">
                <h2 id="games-heading" className="mb-4 font-display text-2xl font-bold text-charcoal-900">Available games</h2>

                {loading && <p className="rounded-2xl border border-charcoal-200 bg-white p-6 text-charcoal-500">Loading games…</p>}
                {error && <p role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-800">{error}</p>}
                {!loading && !error && games.length === 0 && (
                    <div className="rounded-2xl border border-dashed border-charcoal-300 bg-white p-10 text-center">
                        <Gamepad2 className="mx-auto text-saffron-500" size={30} />
                        <h3 className="mt-3 font-semibold text-charcoal-900">No games published yet</h3>
                        <p className="mt-1 text-sm text-charcoal-500">Check back soon for more games.</p>
                    </div>
                )}
                {!loading && !error && games.length > 0 && (
                    <div className="grid gap-4 sm:grid-cols-2">
                        {games.map(game => (
                            <Link key={game.id} href={`/games/${game.id}`} className="group rounded-2xl border border-charcoal-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-saffron-400 hover:shadow-md">
                                <span className="inline-flex rounded-lg bg-saffron-50 p-2 text-saffron-700"><Gamepad2 size={20} /></span>
                                <h3 className="mt-4 font-display text-xl font-bold text-charcoal-900 group-hover:text-saffron-700">{game.title}</h3>
                                {game.clue && <p className="mt-2 line-clamp-2 text-sm text-charcoal-600">{game.clue}</p>}
                                {game.source && <p className="mt-3 text-xs text-charcoal-400">From: {game.source}</p>}
                                <span className="mt-5 inline-block text-sm font-semibold text-saffron-700">Play Wordle →</span>
                            </Link>
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
}
