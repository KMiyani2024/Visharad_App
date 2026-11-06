'use client';

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { trackEvent } from './analytics';

export type Track = {
    url: string;
    displayRef: string;
    reference: string;
    classId?: string | number;
};

type AudioPlayerContextValue = {
    currentTrack: Track | null;
    isPlaying: boolean;
    isLooping: boolean;
    metadataLoaded: boolean;
    currentTime: number;
    duration: number;
    playTrack: (track: Track) => void;
    togglePlay: () => void;
    toggleLoop: () => void;
    seek: (time: number) => void;
    close: () => void;
};

const AudioPlayerContext = createContext<AudioPlayerContextValue | null>(null);

export function AudioPlayerProvider({ children }: { children: ReactNode }) {
    const audioRef = useRef<HTMLAudioElement>(null);
    const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isLooping, setIsLooping] = useState(false);
    const [metadataLoaded, setMetadataLoaded] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);

    // Load + play whenever the track changes.
    useEffect(() => {
        const audio = audioRef.current;
        if (!audio || !currentTrack) return;
        setMetadataLoaded(false);
        setCurrentTime(0);
        setDuration(0);
        audio.src = currentTrack.url;
        audio.play().catch(() => { });
    }, [currentTrack]);

    // Keep the element in sync with play/pause requests that don't change the track.
    useEffect(() => {
        const audio = audioRef.current;
        if (!audio || !currentTrack) return;
        if (isPlaying) {
            audio.play().catch(() => { });
        } else {
            audio.pause();
        }
    }, [isPlaying, currentTrack]);

    useEffect(() => {
        const audio = audioRef.current;
        if (audio) audio.loop = isLooping;
    }, [isLooping]);

    const playTrack = (track: Track) => {
        if (currentTrack?.url === track.url) {
            setIsPlaying((p) => {
                const next = !p;
                if (next) trackEvent('audio_play', { reference: track.reference, classId: track.classId });
                return next;
            });
        } else {
            setCurrentTrack(track);
            setIsPlaying(true);
            trackEvent('audio_play', { reference: track.reference, classId: track.classId });
        }
    };

    const togglePlay = () => setIsPlaying((p) => !p);
    const toggleLoop = () => setIsLooping((p) => !p);

    const seek = (time: number) => {
        const audio = audioRef.current;
        if (audio && Number.isFinite(time)) {
            audio.currentTime = time;
            setCurrentTime(time);
        }
    };

    const close = () => {
        audioRef.current?.pause();
        setIsPlaying(false);
        setCurrentTrack(null);
    };

    return (
        <AudioPlayerContext.Provider
            value={{
                currentTrack,
                isPlaying,
                isLooping,
                metadataLoaded,
                currentTime,
                duration,
                playTrack,
                togglePlay,
                toggleLoop,
                seek,
                close,
            }}
        >
            {children}
            <audio
                ref={audioRef}
                className="hidden"
                onLoadedMetadata={(e) => {
                    setMetadataLoaded(true);
                    setDuration(e.currentTarget.duration);
                }}
                onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                onEnded={() => {
                    setIsPlaying(false);
                    if (currentTrack) {
                        trackEvent('audio_complete', { reference: currentTrack.reference, classId: currentTrack.classId });
                    }
                }}
            />
        </AudioPlayerContext.Provider>
    );
}

export function useAudioPlayer() {
    const ctx = useContext(AudioPlayerContext);
    if (!ctx) {
        throw new Error('useAudioPlayer must be used within an AudioPlayerProvider');
    }
    return ctx;
}
