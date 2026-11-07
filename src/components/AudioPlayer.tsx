'use client';

import { getAudioUrl } from '@/lib/audioUtils';
import { Loader2, Pause, Play, Repeat } from 'lucide-react';
import { useAudioPlayer } from '@/lib/audioPlayer';
import { PulsingBars } from './PulsingBars';

interface AudioPlayerProps {
    reference: string;
    displayRef?: string;
    classId?: string | number;
}

export function AudioPlayer({ reference, displayRef, classId }: AudioPlayerProps) {
    const audioUrl = getAudioUrl(reference, classId);
    const { currentTrack, isPlaying, isLooping, metadataLoaded, playTrack, toggleLoop } = useAudioPlayer();

    const isActive = !!audioUrl && currentTrack?.url === audioUrl;
    const isActivePlaying = isActive && isPlaying;
    const isBuffering = isActive && isPlaying && !metadataLoaded;

    if (!audioUrl) {
        return (
            <div className="bg-charcoal-50 border border-charcoal-100 rounded-xl p-3 mb-4 flex flex-col items-center justify-center text-center">
                <div className="text-xs font-semibold text-charcoal-400 uppercase tracking-wider mb-1">
                    {`Audio for ${displayRef || reference}`}
                </div>
                <div className="text-sm text-charcoal-400">Coming soon</div>
            </div>
        );
    }

    return (
        <div className="w-full mt-2 mb-2 flex items-center gap-3 bg-charcoal-50 p-2.5 rounded-xl border border-charcoal-100">
            <button
                onClick={() => playTrack({ url: audioUrl, displayRef: displayRef || reference, reference, classId })}
                className={`shrink-0 flex items-center justify-center w-9 h-9 rounded-full transition-all hover:scale-105 ${isActivePlaying
                    ? 'bg-saffron-500 text-white'
                    : 'bg-card text-saffron-600 border border-saffron-200 hover:bg-saffron-50'
                    }`}
                aria-label={isActivePlaying ? 'Pause' : 'Play'}
            >
                {isBuffering ? (
                    <Loader2 size={16} className="animate-spin" />
                ) : isActivePlaying ? (
                    <Pause size={16} />
                ) : (
                    <Play size={16} className="ml-0.5" />
                )}
            </button>

            <div className="flex-1 flex items-center gap-2.5 min-w-0">
                <PulsingBars active={isActivePlaying} />
                <span className="text-xs text-charcoal-500 truncate">{displayRef || reference}</span>
            </div>

            <button
                onClick={toggleLoop}
                disabled={!isActive}
                className={`shrink-0 p-2 rounded-full transition-all hover:scale-110 active:scale-95 disabled:opacity-30 disabled:hover:scale-100 ${isActive && isLooping
                    ? 'bg-saffron-100 text-saffron-600 hover:bg-saffron-200'
                    : 'bg-charcoal-200 text-charcoal-500 hover:bg-charcoal-300'
                    }`}
                title={isActive && isLooping ? 'Disable Loop' : 'Enable Loop'}
                aria-label={isActive && isLooping ? 'Disable Loop' : 'Enable Loop'}
            >
                <Repeat size={16} />
            </button>
        </div>
    );
}
