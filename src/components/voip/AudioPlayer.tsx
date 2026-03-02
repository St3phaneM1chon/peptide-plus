'use client';

/**
 * AudioPlayer
 * Inline audio player for call recordings.
 * Styled to match the admin dashboard design.
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { Play, Pause, Volume2, VolumeX, Download } from 'lucide-react';

interface AudioPlayerProps {
  src: string;
  duration?: number;
  filename?: string;
  compact?: boolean;
}

export default function AudioPlayer({ src, duration: initialDuration, filename, compact = false }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(initialDuration || 0);
  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleDurationChange = () => {
      if (audio.duration && isFinite(audio.duration)) {
        setDuration(audio.duration);
      }
    };
    const handleEnded = () => setIsPlaying(false);

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('durationchange', handleDurationChange);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('durationchange', handleDurationChange);
      audio.removeEventListener('ended', handleEnded);
    };
  }, []);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
    setIsPlaying(!isPlaying);
  }, [isPlaying]);

  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;
    const time = parseFloat(e.target.value);
    audio.currentTime = time;
    setCurrentTime(time);
  }, []);

  const toggleMute = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.muted = !isMuted;
    setIsMuted(!isMuted);
  }, [isMuted]);

  const formatTime = (sec: number) => {
    if (!sec || !isFinite(sec)) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <audio ref={audioRef} src={src} preload="metadata" />
        <button
          onClick={togglePlay}
          className="p-1.5 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
        >
          {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
        </button>
        <span className="text-xs text-gray-500 tabular-nums">
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 bg-gray-50 rounded-lg px-3 py-2">
      <audio ref={audioRef} src={src} preload="metadata" />

      {/* Play/Pause */}
      <button
        onClick={togglePlay}
        className="p-2 rounded-full bg-sky-500 text-white hover:bg-sky-600 transition-colors flex-shrink-0"
      >
        {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
      </button>

      {/* Progress bar */}
      <div className="flex-1 flex items-center gap-2">
        <span className="text-xs text-gray-500 tabular-nums w-10 text-end">
          {formatTime(currentTime)}
        </span>
        <input
          type="range"
          min={0}
          max={duration || 0}
          step={0.1}
          value={currentTime}
          onChange={handleSeek}
          className="flex-1 h-1.5 bg-gray-200 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-sky-500 [&::-webkit-slider-thumb]:rounded-full"
        />
        <span className="text-xs text-gray-500 tabular-nums w-10">
          {formatTime(duration)}
        </span>
      </div>

      {/* Volume */}
      <button
        onClick={toggleMute}
        className="p-1.5 rounded text-gray-500 hover:text-gray-700 transition-colors"
      >
        {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
      </button>

      {/* Download */}
      {filename && (
        <a
          href={src}
          download={filename}
          className="p-1.5 rounded text-gray-500 hover:text-sky-600 transition-colors"
        >
          <Download className="w-4 h-4" />
        </a>
      )}
    </div>
  );
}
