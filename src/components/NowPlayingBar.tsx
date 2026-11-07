'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Pause, Play, Repeat, X } from 'lucide-react';
import { useAudioPlayer } from '@/lib/audioPlayer';
import { PulsingBars } from './PulsingBars';

export function NowPlayingBar() {
    const { currentTrack, isPlaying, isLooping, currentTime, duration, togglePlay, toggleLoop, seek, close } = useAudioPlayer();

    const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

    return (
        <AnimatePresence>
            {currentTrack && (
                <motion.div
                    initial={{ y: 20, opacity: 0, scale: 0.95 }}
                    animate={{ y: 0, opacity: 1, scale: 1 }}
                    exit={{ y: 20, opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.25, ease: 'easeOut' }}
                    className="scale-fixed fixed bottom-[calc(max(0.75rem,env(safe-area-inset-bottom))+5rem)] md:bottom-4 right-4 md:right-8 z-50 w-[calc(100%-2rem)] max-w-sm"
                >
                    <div className="bg-charcoal-900 text-white rounded-2xl shadow-2xl shadow-black/30 border border-white/10 overflow-hidden">
                        {/* Scrub bar */}
                        <div
                            className="h-1 bg-white/10 cursor-pointer"
                            onClick={(e) => {
                                const rect = e.currentTarget.getBoundingClientRect();
                                const ratio = (e.clientX - rect.left) / rect.width;
                                seek(ratio * duration);
                            }}
                        >
                            <div className="h-full bg-saffron-400" style={{ width: `${progress}%` }} />
                        </div>

                        <div className="flex items-center gap-3 px-3 py-2.5">
                            <button
                                onClick={togglePlay}
                                className="shrink-0 flex items-center justify-center w-9 h-9 rounded-full bg-saffron-500 hover:bg-saffron-400 hover:scale-105 transition-all"
                                aria-label={isPlaying ? 'Pause' : 'Play'}
                            >
                                {isPlaying ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
                            </button>

                            <PulsingBars active={isPlaying} />

                            <div className="flex-1 min-w-0">
                                <div className="text-sm font-semibold truncate">{currentTrack.displayRef}</div>
                                <div className="text-[11px] text-charcoal-400">Now Playing</div>
                            </div>

                            <button
                                onClick={toggleLoop}
                                className={`shrink-0 p-2 rounded-full transition-all hover:scale-110 ${isLooping ? 'bg-saffron-500/20 text-saffron-300' : 'text-charcoal-400 hover:bg-white/10'
                                    }`}
                                title={isLooping ? 'Disable Loop' : 'Enable Loop'}
                            >
                                <Repeat size={15} />
                            </button>

                            <button
                                onClick={close}
                                className="shrink-0 p-2 rounded-full text-charcoal-400 hover:bg-white/10 hover:text-white hover:scale-110 transition-all"
                                aria-label="Close player"
                            >
                                <X size={16} />
                            </button>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
