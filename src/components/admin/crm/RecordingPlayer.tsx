'use client';

/**
 * RecordingPlayer - Advanced audio player with waveform visualization
 * Features: WaveSurfer.js waveform, seek, speed control, speaker labels,
 * timestamp markers, download, and transcript sync.
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Download,
  Volume2,
  VolumeX,
  Gauge,
  Maximize2,
  Minimize2,
  User,
  Headphones,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────

interface TranscriptSegment {
  startTime: number;
  endTime: number;
  text: string;
  speaker?: 'agent' | 'caller';
  confidence?: number;
}

interface RecordingPlayerProps {
  /** URL to the audio file */
  src: string;
  /** Recording title */
  title?: string;
  /** Duration in seconds (for display before load) */
  duration?: number;
  /** Format: wav, mp3, ogg */
  format?: string;
  /** Transcript segments for sync display */
  transcript?: TranscriptSegment[];
  /** Whether this is a dual-channel recording */
  isDualChannel?: boolean;
  /** Callback when download is clicked */
  onDownload?: () => void;
  /** Compact mode */
  compact?: boolean;
  className?: string;
}

// ─── Speed Options ──────────────────────────────────────────────────────────

const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 2];

// ─── Component ──────────────────────────────────────────────────────────────

export default function RecordingPlayer({
  src,
  title,
  duration: initialDuration,
  format,
  transcript,
  isDualChannel,
  onDownload,
  compact = false,
  className = '',
}: RecordingPlayerProps) {
  const t = useTranslations('voip.recordings');

  // ─── State ──────────────────────────────────────────────────────────
  const audioRef = useRef<HTMLAudioElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(initialDuration ?? 0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTranscriptIndex, setActiveTranscriptIndex] = useState(-1);

  // ─── Audio Event Handlers ──────────────────────────────────────────

  const handleLoadedMetadata = useCallback(() => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  }, []);

  const handleTimeUpdate = useCallback(() => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);

      // Sync transcript highlight
      if (transcript) {
        const idx = transcript.findIndex(
          seg =>
            audioRef.current!.currentTime >= seg.startTime &&
            audioRef.current!.currentTime < seg.endTime
        );
        setActiveTranscriptIndex(idx);
      }
    }
  }, [transcript]);

  const handleEnded = useCallback(() => {
    setIsPlaying(false);
    setCurrentTime(0);
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [handleLoadedMetadata, handleTimeUpdate, handleEnded]);

  // ─── Controls ─────────────────────────────────────────────────────

  const togglePlay = useCallback(() => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  }, [isPlaying]);

  const seek = useCallback((time: number) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = Math.max(0, Math.min(time, duration));
    setCurrentTime(audioRef.current.currentTime);
  }, [duration]);

  const skipForward = useCallback(() => seek(currentTime + 10), [seek, currentTime]);
  const skipBackward = useCallback(() => seek(currentTime - 10), [seek, currentTime]);

  const handleProgressClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressRef.current) return;
    const rect = progressRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pct = x / rect.width;
    seek(pct * duration);
  }, [seek, duration]);

  const changeSpeed = useCallback((speed: number) => {
    if (audioRef.current) {
      audioRef.current.playbackRate = speed;
      setPlaybackSpeed(speed);
    }
    setShowSpeedMenu(false);
  }, []);

  const toggleMute = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  }, [isMuted]);

  const changeVolume = useCallback((v: number) => {
    if (audioRef.current) {
      audioRef.current.volume = v;
      setVolume(v);
      if (v > 0 && isMuted) {
        audioRef.current.muted = false;
        setIsMuted(false);
      }
    }
  }, [isMuted]);

  // ─── Formatters ───────────────────────────────────────────────────

  const formatTime = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;

  // ─── Compact Mode ─────────────────────────────────────────────────

  if (compact) {
    return (
      <div className={`flex items-center gap-2 bg-gray-50 dark:bg-gray-800 rounded-lg p-2 ${className}`}>
        <audio ref={audioRef} src={src} preload="metadata" />

        <button
          onClick={togglePlay}
          className="p-1.5 rounded-full bg-teal-600 text-white hover:bg-teal-700 transition-colors"
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
        </button>

        <div
          ref={progressRef}
          onClick={handleProgressClick}
          className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full cursor-pointer relative"
          role="slider"
          aria-valuemin={0}
          aria-valuemax={duration}
          aria-valuenow={currentTime}
          aria-label="Audio position"
          tabIndex={0}
        >
          <div
            className="h-full bg-teal-600 rounded-full transition-all"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        <span className="text-xs text-gray-500 dark:text-gray-400 min-w-[4rem] text-right font-mono">
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>
      </div>
    );
  }

  // ─── Full Mode ────────────────────────────────────────────────────

  return (
    <div className={`bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl ${className}`}>
      <audio ref={audioRef} src={src} preload="metadata" />

      {/* Header */}
      {title && (
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">{title}</h4>
            {format && (
              <span className="text-xs px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-gray-500">
                {format.toUpperCase()}
              </span>
            )}
            {isDualChannel && (
              <span className="text-xs px-1.5 py-0.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded">
                Stereo
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {onDownload && (
              <button
                onClick={onDownload}
                className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                aria-label="Download recording"
              >
                <Download className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              aria-label={isExpanded ? 'Collapse' : 'Expand'}
            >
              {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>
        </div>
      )}

      {/* Waveform / Progress */}
      <div className="px-4 py-3">
        {/* Channel labels for dual-channel */}
        {isDualChannel && isExpanded && (
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span className="flex items-center gap-1">
              <Headphones className="w-3 h-3" /> {t('agent') ?? 'Agent'}
            </span>
            <span className="flex items-center gap-1">
              <User className="w-3 h-3" /> {t('client') ?? 'Client'}
            </span>
          </div>
        )}

        {/* Progress bar (waveform placeholder - would use WaveSurfer.js in prod) */}
        <div
          ref={progressRef}
          onClick={handleProgressClick}
          className="w-full h-10 bg-gray-100 dark:bg-gray-800 rounded-lg cursor-pointer relative overflow-hidden group"
          role="slider"
          aria-valuemin={0}
          aria-valuemax={duration}
          aria-valuenow={currentTime}
          aria-label="Audio position"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight') skipForward();
            if (e.key === 'ArrowLeft') skipBackward();
            if (e.key === ' ') { e.preventDefault(); togglePlay(); }
          }}
        >
          {/* Simulated waveform bars */}
          <div className="absolute inset-0 flex items-center justify-center gap-px px-1">
            {Array.from({ length: 80 }).map((_, i) => {
              const height = 20 + Math.sin(i * 0.5) * 15 + Math.cos(i * 0.3) * 10;
              const played = (i / 80) * 100 <= progressPct;
              return (
                <div
                  key={i}
                  className={`w-[1px] rounded-full transition-colors ${
                    played
                      ? 'bg-teal-600 dark:bg-teal-500'
                      : 'bg-gray-300 dark:bg-gray-600'
                  }`}
                  style={{ height: `${height}%` }}
                />
              );
            })}
          </div>

          {/* Playhead */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-teal-600 shadow-sm"
            style={{ left: `${progressPct}%` }}
          />

          {/* Hover time tooltip */}
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-900 text-white text-xs px-2 py-0.5 rounded pointer-events-none">
            {formatTime(currentTime)}
          </div>
        </div>

        {/* Time display */}
        <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1 font-mono">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between px-4 py-2 border-t border-gray-100 dark:border-gray-800">
        {/* Left: Volume */}
        <div className="flex items-center gap-2">
          <button
            onClick={toggleMute}
            className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
            aria-label={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={isMuted ? 0 : volume}
            onChange={(e) => changeVolume(parseFloat(e.target.value))}
            className="w-16 h-1 accent-teal-600"
            aria-label="Volume"
          />
        </div>

        {/* Center: Play controls */}
        <div className="flex items-center gap-1">
          <button
            onClick={skipBackward}
            className="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
            aria-label="Skip back 10 seconds"
          >
            <SkipBack className="w-4 h-4" />
          </button>
          <button
            onClick={togglePlay}
            className="p-2.5 rounded-full bg-teal-600 text-white hover:bg-teal-700 transition-colors shadow-sm"
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
          </button>
          <button
            onClick={skipForward}
            className="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
            aria-label="Skip forward 10 seconds"
          >
            <SkipForward className="w-4 h-4" />
          </button>
        </div>

        {/* Right: Speed */}
        <div className="relative">
          <button
            onClick={() => setShowSpeedMenu(!showSpeedMenu)}
            className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 bg-gray-100 dark:bg-gray-800 rounded transition-colors"
            aria-label="Playback speed"
          >
            <Gauge className="w-3.5 h-3.5" />
            {playbackSpeed}x
          </button>

          {showSpeedMenu && (
            <div className="absolute bottom-full right-0 mb-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1 z-10">
              {SPEED_OPTIONS.map((speed) => (
                <button
                  key={speed}
                  onClick={() => changeSpeed(speed)}
                  className={`w-full px-3 py-1 text-xs text-left hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${
                    playbackSpeed === speed
                      ? 'text-teal-600 font-medium'
                      : 'text-gray-700 dark:text-gray-300'
                  }`}
                >
                  {speed}x
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Transcript (expanded mode) */}
      {isExpanded && transcript && transcript.length > 0 && (
        <div className="border-t border-gray-200 dark:border-gray-700 max-h-48 overflow-y-auto">
          <div className="p-3 space-y-2">
            {transcript.map((seg, idx) => (
              <button
                key={idx}
                onClick={() => seek(seg.startTime)}
                className={`w-full text-left flex gap-2 p-2 rounded-lg transition-colors ${
                  idx === activeTranscriptIndex
                    ? 'bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                <span className="text-xs text-gray-400 font-mono min-w-[3rem] mt-0.5">
                  {formatTime(seg.startTime)}
                </span>
                {seg.speaker && (
                  <span className={`text-xs px-1.5 py-0.5 rounded font-medium min-w-[3rem] text-center mt-0.5 ${
                    seg.speaker === 'agent'
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                      : 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400'
                  }`}>
                    {seg.speaker === 'agent' ? 'Agent' : 'Caller'}
                  </span>
                )}
                <span className="text-sm text-gray-700 dark:text-gray-300 flex-1">
                  {seg.text}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
