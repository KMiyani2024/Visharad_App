'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState, type FormEvent, type KeyboardEvent } from 'react';
import { ArrowLeft, RotateCcw } from 'lucide-react';
import type { PublicGame } from '@/lib/games';

type LetterResult = 'correct' | 'present' | 'absent';
type Attempt = { word: string; result: LetterResult[] };
type SavedGame = { attempts: Attempt[]; answer?: string; finished: boolean };
type GuessResponse = { result: LetterResult[]; solved: boolean; lost: boolean; answer?: string; error?: string };

const MAX_ATTEMPTS = 6;
const STORAGE_PREFIX = 'visharad-wordle-';
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

export function WordleGame({ gameId }: { gameId: string }) {
    const [game, setGame] = useState<PublicGame | null>(null);
    const [attempts, setAttempts] = useState<Attempt[]>([]);
    const [answer, setAnswer] = useState('');
    const [finished, setFinished] = useState(false);
    const [guess, setGuess] = useState('');
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const storageKey = `${STORAGE_PREFIX}${gameId}`;

    useEffect(() => {
        let active = true;
        fetch(`/api/games/${gameId}`, { cache: 'no-store' })
            .then(async response => {
                if (!response.ok) throw new Error('This game could not be found.');
                const loaded = await response.json() as PublicGame;
                if (active) setGame(loaded);
                const saved = window.localStorage.getItem(storageKey);
                if (saved && active) {
                    try {
                        const state = JSON.parse(saved) as SavedGame;
                        if (Array.isArray(state.attempts) && state.attempts.length <= MAX_ATTEMPTS) {
                            setAttempts(state.attempts);
                            setAnswer(typeof state.answer === 'string' ? state.answer : '');
                            setFinished(state.finished === true);
                        }
                    } catch {
                        window.localStorage.removeItem(storageKey);
                    }
                }
            })
            .catch(reason => setError(reason instanceof Error ? reason.message : 'Unable to load game.'))
            .finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, [gameId, storageKey]);

    const submitGuess = useCallback(async (event?: FormEvent) => {
        event?.preventDefault();
        if (guess.length !== 5 || submitting || finished) return;
        setSubmitting(true);
        setError('');
        try {
            const response = await fetch(`/api/games/${gameId}/guess`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ guess, attempt: attempts.length + 1 }),
            });
            const data = await response.json() as GuessResponse;
            if (!response.ok) throw new Error(data.error || 'Unable to check this guess.');
            const updatedAttempts = [...attempts, { word: guess, result: data.result }];
            setAttempts(updatedAttempts);
            setGuess('');
            setAnswer(data.answer || '');
            setFinished(data.solved || data.lost);
            window.localStorage.setItem(storageKey, JSON.stringify({
                attempts: updatedAttempts,
                answer: data.answer || '',
                finished: data.solved || data.lost,
            } satisfies SavedGame));
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : 'Unable to check this guess.');
        } finally {
            setSubmitting(false);
        }
    }, [attempts, finished, gameId, guess, storageKey, submitting]);

    const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            void submitGuess();
        }
    };

    if (loading) return <p className="rounded-2xl bg-white p-6 text-charcoal-500">Loading game…</p>;
    if (error && !game) return <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-800">{error}</div>;
    if (!game) return null;

    const letterColors = new Map<string, LetterResult>();
    attempts.forEach(attempt => attempt.word.split('').forEach((letter, index) => {
        const result = attempt.result[index];
        const current = letterColors.get(letter);
        if (result === 'correct' || (result === 'present' && current !== 'correct') || !current) {
            letterColors.set(letter, result);
        }
    }));

    const restart = async () => {
        setError('');
        try {
            const response = await fetch(`/api/games/${gameId}/session`, { method: 'POST' });
            if (!response.ok) throw new Error('Unable to restart this game.');
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : 'Unable to restart this game.');
            return;
        }
        setAttempts([]);
        setAnswer('');
        setFinished(false);
        setGuess('');
        window.localStorage.removeItem(storageKey);
    };

    return (
        <div className="mx-auto max-w-xl space-y-6">
            <Link href="/games" className="inline-flex items-center gap-2 text-sm font-semibold text-charcoal-600 hover:text-saffron-700">
                <ArrowLeft size={16} /> All games
            </Link>
            <header className="text-center">
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-saffron-700">Visharad Wordle</p>
                <h1 className="mt-2 font-display text-3xl font-bold text-charcoal-900">{game.title}</h1>
                {game.clue && <p className="mx-auto mt-3 max-w-md text-charcoal-600">{game.clue}</p>}
                {game.source && <p className="mt-2 text-xs text-charcoal-400">From: {game.source}</p>}
            </header>

            <div className="grid grid-cols-5 gap-2 sm:gap-3" aria-label="Wordle board">
                {Array.from({ length: MAX_ATTEMPTS }, (_, row) => {
                    const attempt = attempts[row];
                    return Array.from({ length: 5 }, (_, column) => {
                        const letter = attempt?.word[column] || (row === attempts.length ? guess[column] || '' : '');
                        const result = attempt?.result[column];
                        const color = result === 'correct' ? 'border-emerald-600 bg-emerald-600 text-white'
                            : result === 'present' ? 'border-amber-500 bg-amber-500 text-white'
                                : attempt ? 'border-charcoal-600 bg-charcoal-600 text-white' : 'border-charcoal-200 bg-white text-charcoal-900';
                        return (
                            <div key={`${row}-${column}`} className={`flex aspect-square items-center justify-center rounded-xl border-2 font-display text-2xl font-bold sm:text-3xl ${color}`}>
                                {letter}
                            </div>
                        );
                    });
                })}
            </div>

            <form onSubmit={submitGuess} className="flex gap-2">
                <input
                    aria-label="Your five-letter guess"
                    autoComplete="off"
                    maxLength={5}
                    value={guess}
                    disabled={finished || submitting}
                    onChange={event => setGuess(event.target.value.replace(/[^a-z]/gi, '').toUpperCase())}
                    onKeyDown={handleKeyDown}
                    className="min-w-0 flex-1 rounded-xl border border-charcoal-300 bg-white px-4 py-3 text-center text-lg font-bold tracking-[0.35em] outline-none focus:border-saffron-500 focus:ring-2 focus:ring-saffron-100 disabled:bg-charcoal-50"
                    placeholder="TYPE A WORD"
                />
                <button disabled={guess.length !== 5 || submitting || finished} className="rounded-xl bg-saffron-600 px-5 py-3 font-semibold text-white hover:bg-saffron-700 disabled:cursor-not-allowed disabled:opacity-40">
                    {submitting ? 'Checking…' : 'Guess'}
                </button>
            </form>
            <button onClick={() => void restart()} className="mx-auto block text-sm font-medium text-charcoal-500 hover:text-saffron-700">
                Restart game
            </button>

            <div className="grid grid-cols-13 gap-1" aria-label="Letter guide">
                {LETTERS.map(letter => {
                    const color = letterColors.get(letter);
                    return <span key={letter} className={`flex h-8 items-center justify-center rounded text-[10px] font-bold sm:text-xs ${color === 'correct' ? 'bg-emerald-600 text-white' : color === 'present' ? 'bg-amber-500 text-white' : color === 'absent' ? 'bg-charcoal-600 text-white' : 'bg-charcoal-100 text-charcoal-700'}`}>{letter}</span>;
                })}
            </div>

            {error && <p role="alert" className="text-center text-sm text-red-700">{error}</p>}
            {finished && (
                <div role="status" className="rounded-2xl border border-saffron-200 bg-saffron-50 p-5 text-center">
                    <p className="font-semibold text-charcoal-900">{attempts.at(-1)?.word === answer ? 'You got it!' : 'Nice try!'}</p>
                    <p className="mt-1 text-sm text-charcoal-600">The word was <strong>{answer}</strong>.</p>
                    <button onClick={() => void restart()} className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-saffron-700 hover:text-saffron-900">
                        <RotateCcw size={15} /> Play again
                    </button>
                </div>
            )}
            <p className="text-center text-xs text-charcoal-400">Green = right letter and place · Amber = in the word · Dark = not in the word</p>
        </div>
    );
}
