'use client';

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  type MouseEvent as ReactMouseEvent,
  type TouchEvent as ReactTouchEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { useTranslations } from '@/hooks/useTranslations';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface VideoPlayerProps {
  /** Video source URL */
  src: string;
  /** Lesson ID used when reporting progress */
  lessonId: string;
  /** Course ID for context */
  courseId: string;
  /** Resume position as a percentage 0-100 */
  initialProgress?: number;
  /** Callback fired with the current watch percentage (0-100) */
  onProgressUpdate?: (percent: number, timeSpent: number) => void;
  /** Optional poster / thumbnail image URL */
  poster?: string;
}

type PlaybackRate = 0.5 | 0.75 | 1 | 1.25 | 1.5 | 2;

const PLAYBACK_RATES: PlaybackRate[] = [0.5, 0.75, 1, 1.25, 1.5, 2];
const PROGRESS_REPORT_INTERVAL_MS = 10_000;
const COMPLETION_THRESHOLD = 90;
const SEEK_STEP_SECONDS = 10;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Format seconds into MM:SS */
function formatTime(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return '00:00';
  const mins = Math.floor(totalSeconds / 60);
  const secs = Math.floor(totalSeconds % 60);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

/** Clamp a number between min and max */
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function VideoPlayer({
  src,
  lessonId,
  courseId,
  initialProgress = 0,
  onProgressUpdate,
  poster,
}: VideoPlayerProps) {
  const { t } = useTranslations();

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const volumeBarRef = useRef<HTMLDivElement>(null);
  const reportTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionStartRef = useRef<number>(Date.now());
  const lastReportedPercentRef = useRef<number>(initialProgress);
  const hasRestoredRef = useRef(false);

  // State
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [previousVolume, setPreviousVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState<PlaybackRate>(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [bufferedPercent, setBufferedPercent] = useState(0);
  const [isSeeking, setIsSeeking] = useState(false);
  const [showCompleteButton, setShowCompleteButton] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [isMarkingComplete, setIsMarkingComplete] = useState(false);

  // Derived values
  const percent = duration > 0 ? (currentTime / duration) * 100 : 0;

  // -------------------------------------------------------------------------
  // Progress reporting
  // -------------------------------------------------------------------------

  const reportProgress = useCallback(() => {
    const pct = duration > 0 ? (currentTime / duration) * 100 : 0;
    const timeSpent = Math.floor((Date.now() - sessionStartRef.current) / 1000);
    if (onProgressUpdate && Math.abs(pct - lastReportedPercentRef.current) >= 0.5) {
      lastReportedPercentRef.current = pct;
      onProgressUpdate(Math.round(pct), timeSpent);
    }
  }, [currentTime, duration, onProgressUpdate]);

  // Start periodic reporting timer
  useEffect(() => {
    reportTimerRef.current = setInterval(() => {
      reportProgress();
    }, PROGRESS_REPORT_INTERVAL_MS);

    return () => {
      if (reportTimerRef.current) clearInterval(reportTimerRef.current);
    };
  }, [reportProgress]);

  // Report on tab visibility change
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        reportProgress();
        videoRef.current?.pause();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [reportProgress]);

  // Report on unmount
  useEffect(() => {
    return () => {
      reportProgress();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // -------------------------------------------------------------------------
  // Video event handlers
  // -------------------------------------------------------------------------

  const handleLoadedMetadata = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    setDuration(video.duration);

    // Restore position from initialProgress
    if (initialProgress > 0 && !hasRestoredRef.current) {
      const targetTime = (initialProgress / 100) * video.duration;
      video.currentTime = targetTime;
      hasRestoredRef.current = true;
    }
  }, [initialProgress]);

  const handleTimeUpdate = useCallback(() => {
    const video = videoRef.current;
    if (!video || isSeeking) return;
    setCurrentTime(video.currentTime);

    // Check completion threshold
    const pct = video.duration > 0 ? (video.currentTime / video.duration) * 100 : 0;
    if (pct >= COMPLETION_THRESHOLD && !showCompleteButton) {
      setShowCompleteButton(true);
    }
  }, [isSeeking, showCompleteButton]);

  const handleProgress = useCallback(() => {
    const video = videoRef.current;
    if (!video || !video.buffered.length) return;
    const buffEnd = video.buffered.end(video.buffered.length - 1);
    setBufferedPercent(video.duration > 0 ? (buffEnd / video.duration) * 100 : 0);
  }, []);

  const handlePlay = useCallback(() => setIsPlaying(true), []);
  const handlePause = useCallback(() => {
    setIsPlaying(false);
    reportProgress();
  }, [reportProgress]);
  const handleEnded = useCallback(() => {
    setIsPlaying(false);
    setShowCompleteButton(true);
    reportProgress();
  }, [reportProgress]);

  // -------------------------------------------------------------------------
  // Control actions
  // -------------------------------------------------------------------------

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  }, []);

  const seekTo = useCallback((timeSeconds: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = clamp(timeSeconds, 0, video.duration || 0);
    setCurrentTime(video.currentTime);
  }, []);

  const skipForward = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    seekTo(video.currentTime + SEEK_STEP_SECONDS);
  }, [seekTo]);

  const skipBackward = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    seekTo(video.currentTime - SEEK_STEP_SECONDS);
  }, [seekTo]);

  const changeVolume = useCallback((newVolume: number) => {
    const video = videoRef.current;
    if (!video) return;
    const clamped = clamp(newVolume, 0, 1);
    video.volume = clamped;
    setVolume(clamped);
    if (clamped > 0) {
      setIsMuted(false);
      video.muted = false;
      setPreviousVolume(clamped);
    }
  }, []);

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (isMuted) {
      video.muted = false;
      video.volume = previousVolume || 0.5;
      setVolume(previousVolume || 0.5);
      setIsMuted(false);
    } else {
      setPreviousVolume(volume);
      video.muted = true;
      setIsMuted(true);
    }
  }, [isMuted, previousVolume, volume]);

  const changePlaybackRate = useCallback((rate: PlaybackRate) => {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = rate;
    setPlaybackRate(rate);
    setShowSpeedMenu(false);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    const container = containerRef.current;
    if (!container) return;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await container.requestFullscreen();
      }
    } catch {
      // Fullscreen not supported or blocked
    }
  }, []);

  // -------------------------------------------------------------------------
  // Fullscreen change listener
  // -------------------------------------------------------------------------

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  // -------------------------------------------------------------------------
  // Controls auto-hide
  // -------------------------------------------------------------------------

  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetHideTimer = useCallback(() => {
    setShowControls(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => {
      if (videoRef.current && !videoRef.current.paused) {
        setShowControls(false);
        setShowSpeedMenu(false);
      }
    }, 3000);
  }, []);

  const handleContainerMouseMove = useCallback(() => {
    resetHideTimer();
  }, [resetHideTimer]);

  const handleContainerMouseLeave = useCallback(() => {
    if (videoRef.current && !videoRef.current.paused) {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      hideTimerRef.current = setTimeout(() => {
        setShowControls(false);
        setShowSpeedMenu(false);
      }, 1000);
    }
  }, []);

  // -------------------------------------------------------------------------
  // Progress bar seeking (mouse + touch)
  // -------------------------------------------------------------------------

  const handleProgressBarSeek = useCallback(
    (clientX: number) => {
      const bar = progressBarRef.current;
      const video = videoRef.current;
      if (!bar || !video) return;
      const rect = bar.getBoundingClientRect();
      const ratio = clamp((clientX - rect.left) / rect.width, 0, 1);
      seekTo(ratio * video.duration);
    },
    [seekTo]
  );

  const handleProgressMouseDown = useCallback(
    (e: ReactMouseEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsSeeking(true);
      handleProgressBarSeek(e.clientX);

      const onMouseMove = (ev: globalThis.MouseEvent) => {
        handleProgressBarSeek(ev.clientX);
      };
      const onMouseUp = (ev: globalThis.MouseEvent) => {
        handleProgressBarSeek(ev.clientX);
        setIsSeeking(false);
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
      };
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    },
    [handleProgressBarSeek]
  );

  const handleProgressTouchStart = useCallback(
    (e: ReactTouchEvent<HTMLDivElement>) => {
      setIsSeeking(true);
      const touch = e.touches[0];
      if (touch) handleProgressBarSeek(touch.clientX);
    },
    [handleProgressBarSeek]
  );

  const handleProgressTouchMove = useCallback(
    (e: ReactTouchEvent<HTMLDivElement>) => {
      const touch = e.touches[0];
      if (touch) handleProgressBarSeek(touch.clientX);
    },
    [handleProgressBarSeek]
  );

  const handleProgressTouchEnd = useCallback(() => {
    setIsSeeking(false);
  }, []);

  // -------------------------------------------------------------------------
  // Volume bar (mouse)
  // -------------------------------------------------------------------------

  const handleVolumeBarSeek = useCallback(
    (clientX: number) => {
      const bar = volumeBarRef.current;
      if (!bar) return;
      const rect = bar.getBoundingClientRect();
      const ratio = clamp((clientX - rect.left) / rect.width, 0, 1);
      changeVolume(ratio);
    },
    [changeVolume]
  );

  const handleVolumeMouseDown = useCallback(
    (e: ReactMouseEvent<HTMLDivElement>) => {
      e.preventDefault();
      handleVolumeBarSeek(e.clientX);

      const onMouseMove = (ev: globalThis.MouseEvent) => {
        handleVolumeBarSeek(ev.clientX);
      };
      const onMouseUp = () => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
      };
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    },
    [handleVolumeBarSeek]
  );

  // -------------------------------------------------------------------------
  // Keyboard shortcuts
  // -------------------------------------------------------------------------

  const handleKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLDivElement>) => {
      // Only handle if the event target is the container or the video itself
      // Avoid intercepting typing in inputs inside speed menu etc.
      const tag = (e.target as HTMLElement).tagName.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

      switch (e.key) {
        case ' ':
        case 'k':
          e.preventDefault();
          togglePlay();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          skipBackward();
          break;
        case 'ArrowRight':
          e.preventDefault();
          skipForward();
          break;
        case 'm':
        case 'M':
          e.preventDefault();
          toggleMute();
          break;
        case 'f':
        case 'F':
          e.preventDefault();
          toggleFullscreen();
          break;
      }
    },
    [togglePlay, skipBackward, skipForward, toggleMute, toggleFullscreen]
  );

  // -------------------------------------------------------------------------
  // Mark as complete
  // -------------------------------------------------------------------------

  const handleMarkComplete = useCallback(async () => {
    if (isCompleted || isMarkingComplete) return;
    setIsMarkingComplete(true);
    try {
      const timeSpent = Math.floor((Date.now() - sessionStartRef.current) / 1000);
      const res = await fetch('/api/lms/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lessonId,
          courseId,
          videoPercent: Math.round(percent),
          timeSpent,
          completed: true,
        }),
      });
      if (res.ok) {
        setIsCompleted(true);
      }
    } catch {
      // Silently fail - progress will be saved next interval
    } finally {
      setIsMarkingComplete(false);
    }
  }, [isCompleted, isMarkingComplete, lessonId, courseId, percent]);

  // -------------------------------------------------------------------------
  // Close speed menu when clicking outside
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (!showSpeedMenu) return;
    const handleClick = () => setShowSpeedMenu(false);
    const timer = setTimeout(() => {
      document.addEventListener('click', handleClick);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', handleClick);
    };
  }, [showSpeedMenu]);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  const volumeIcon = isMuted || volume === 0 ? 'muted' : volume < 0.5 ? 'low' : 'high';

  return (
    <div
      ref={containerRef}
      className="relative w-full select-none group overflow-hidden"
      style={{
        aspectRatio: '16 / 9',
        background: 'var(--k-bg-inset)',
        borderRadius: 'var(--k-radius-xl)',
        border: '1px solid var(--k-border-subtle)',
        boxShadow: 'var(--k-shadow-xl)',
      }}
      onMouseMove={handleContainerMouseMove}
      onMouseLeave={handleContainerMouseLeave}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="region"
      aria-label={t('lms.videoPlayer.playerRegion')}
    >
      {/* Video element */}
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        className="absolute inset-0 w-full h-full object-contain cursor-pointer"
        playsInline
        preload="metadata"
        onClick={togglePlay}
        onLoadedMetadata={handleLoadedMetadata}
        onTimeUpdate={handleTimeUpdate}
        onProgress={handleProgress}
        onPlay={handlePlay}
        onPause={handlePause}
        onEnded={handleEnded}
        aria-label={t('lms.videoPlayer.videoElement')}
      />

      {/* Overlay gradient for controls visibility */}
      <div
        className={`absolute inset-x-0 bottom-0 pointer-events-none transition-opacity duration-300 ${
          showControls ? 'opacity-100' : 'opacity-0'
        }`}
        style={{
          height: '40%',
          background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 50%, transparent 100%)',
        }}
      />

      {/* Big centered play button (shown when paused and controls visible) */}
      {!isPlaying && showControls && (
        <button
          onClick={togglePlay}
          className="absolute inset-0 flex items-center justify-center z-10"
          aria-label={t('lms.videoPlayer.play')}
        >
          <div
            className="w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center transition-all duration-200"
            style={{
              background: 'var(--k-glass-regular)',
              backdropFilter: 'blur(var(--k-blur-lg))',
              WebkitBackdropFilter: 'blur(var(--k-blur-lg))',
              border: '1px solid var(--k-border-default)',
              boxShadow: 'var(--k-glow-primary)',
            }}
          >
            <svg className="w-8 h-8 sm:w-10 sm:h-10 ml-1" fill="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--k-text-primary)' }}>
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </button>
      )}

      {/* Mark as complete button */}
      {showCompleteButton && !isCompleted && (
        <div className="absolute top-4 right-4 z-20">
          <button
            onClick={handleMarkComplete}
            disabled={isMarkingComplete}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium disabled:opacity-60 transition-all duration-200"
            style={{
              background: 'var(--k-accent-emerald-10)',
              color: 'var(--k-accent-emerald)',
              borderRadius: 'var(--k-radius-md)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              backdropFilter: 'blur(var(--k-blur-md))',
              WebkitBackdropFilter: 'blur(var(--k-blur-md))',
              boxShadow: 'var(--k-glow-success)',
            }}
            aria-label={t('lms.videoPlayer.markComplete')}
          >
            {isMarkingComplete ? (
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            )}
            {t('lms.videoPlayer.markComplete')}
          </button>
        </div>
      )}

      {/* Completed badge */}
      {isCompleted && (
        <div
          className="absolute top-4 right-4 z-20 flex items-center gap-2 px-4 py-2 text-sm font-medium"
          style={{
            background: 'var(--k-accent-emerald-10)',
            color: 'var(--k-accent-emerald)',
            borderRadius: 'var(--k-radius-md)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            backdropFilter: 'blur(var(--k-blur-md))',
            WebkitBackdropFilter: 'blur(var(--k-blur-md))',
            boxShadow: 'var(--k-glow-success)',
          }}
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clipRule="evenodd"
            />
          </svg>
          {t('lms.videoPlayer.completed')}
        </div>
      )}

      {/* Controls bar */}
      <div
        className={`absolute inset-x-0 bottom-0 z-20 px-4 pb-3 pt-8 transition-opacity duration-300 ${
          showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Progress bar */}
        <div
          ref={progressBarRef}
          className="relative w-full h-1 cursor-pointer mb-3 group/progress hover:h-2 transition-all"
          style={{ borderRadius: 'var(--k-radius-pill)' }}
          onMouseDown={handleProgressMouseDown}
          onTouchStart={handleProgressTouchStart}
          onTouchMove={handleProgressTouchMove}
          onTouchEnd={handleProgressTouchEnd}
          role="slider"
          aria-label={t('lms.videoPlayer.progressBar')}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(percent)}
          aria-valuetext={`${formatTime(currentTime)} / ${formatTime(duration)}`}
          tabIndex={0}
        >
          {/* Track bg */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: 'var(--k-glass-thin)',
              borderRadius: 'var(--k-radius-pill)',
            }}
          />
          {/* Buffered */}
          <div
            className="absolute inset-y-0 left-0 pointer-events-none"
            style={{
              width: `${bufferedPercent}%`,
              background: 'var(--k-glass-thick)',
              borderRadius: 'var(--k-radius-pill)',
            }}
          />
          {/* Played - gradient fill with glow trail */}
          <div
            className="absolute inset-y-0 left-0 pointer-events-none"
            style={{
              width: `${percent}%`,
              background: 'var(--k-gradient-primary)',
              borderRadius: 'var(--k-radius-pill)',
              boxShadow: '0 0 12px rgba(99, 102, 241, 0.4), 0 0 4px rgba(6, 182, 212, 0.3)',
            }}
          />
          {/* Thumb */}
          <div
            className="absolute top-1/2 w-3.5 h-3.5 rounded-full opacity-0 group-hover/progress:opacity-100 transition-opacity pointer-events-none"
            style={{
              left: `${percent}%`,
              transform: 'translate(-50%, -50%)',
              background: 'var(--k-text-primary)',
              boxShadow: 'var(--k-glow-primary)',
            }}
          />
        </div>

        {/* Bottom controls row */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Play/Pause */}
          <button
            onClick={togglePlay}
            className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-all duration-150"
            style={{
              background: 'var(--k-glass-thin)',
              border: '1px solid var(--k-border-subtle)',
              color: 'var(--k-text-primary)',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--k-glass-regular)'; e.currentTarget.style.boxShadow = 'var(--k-glow-primary)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--k-glass-thin)'; e.currentTarget.style.boxShadow = 'none'; }}
            aria-label={isPlaying ? t('lms.videoPlayer.pause') : t('lms.videoPlayer.play')}
          >
            {isPlaying ? (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>

          {/* Skip backward */}
          <button
            onClick={skipBackward}
            className="flex-shrink-0 w-8 h-8 hidden sm:flex items-center justify-center transition-colors duration-150"
            style={{ color: 'var(--k-text-secondary)' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--k-text-primary)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--k-text-secondary)'; }}
            aria-label={t('lms.videoPlayer.skipBackward')}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0019 16V8a1 1 0 00-1.6-.8l-5.333 4zM4.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0011 16V8a1 1 0 00-1.6-.8l-5.334 4z" />
            </svg>
            <span className="absolute text-[9px] font-bold mt-4" style={{ color: 'var(--k-text-primary)' }}>10</span>
          </button>

          {/* Skip forward */}
          <button
            onClick={skipForward}
            className="flex-shrink-0 w-8 h-8 hidden sm:flex items-center justify-center transition-colors duration-150"
            style={{ color: 'var(--k-text-secondary)' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--k-text-primary)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--k-text-secondary)'; }}
            aria-label={t('lms.videoPlayer.skipForward')}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.933 12.8a1 1 0 000-1.6L6.6 7.2A1 1 0 005 8v8a1 1 0 001.6.8l5.333-4zM19.933 12.8a1 1 0 000-1.6l-5.333-4A1 1 0 0013 8v8a1 1 0 001.6.8l5.333-4z" />
            </svg>
            <span className="absolute text-[9px] font-bold mt-4" style={{ color: 'var(--k-text-primary)' }}>10</span>
          </button>

          {/* Volume control */}
          <div className="flex-shrink-0 flex items-center gap-1 group/volume">
            <button
              onClick={toggleMute}
              className="w-8 h-8 flex items-center justify-center transition-colors duration-150"
              style={{ color: 'var(--k-text-secondary)' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--k-text-primary)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--k-text-secondary)'; }}
              aria-label={isMuted ? t('lms.videoPlayer.unmute') : t('lms.videoPlayer.mute')}
            >
              {volumeIcon === 'muted' && (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M16.5 12A4.5 4.5 0 0014 7.97v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51A8.796 8.796 0 0021 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06a8.99 8.99 0 003.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
                </svg>
              )}
              {volumeIcon === 'low' && (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M7 9v6h4l5 5V4l-5 5H7z" />
                </svg>
              )}
              {volumeIcon === 'high' && (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0014 7.97v8.05c1.48-.73 2.5-2.25 2.5-3.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77 0-4.28-2.99-7.86-7-8.77z" />
                </svg>
              )}
            </button>
            <div
              ref={volumeBarRef}
              className="w-0 group-hover/volume:w-20 overflow-hidden transition-all duration-200"
            >
              <div
                className="relative w-20 h-1 cursor-pointer"
                style={{ borderRadius: 'var(--k-radius-pill)' }}
                onMouseDown={handleVolumeMouseDown}
                role="slider"
                aria-label={t('lms.videoPlayer.volume')}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(isMuted ? 0 : volume * 100)}
                tabIndex={0}
              >
                {/* Volume track */}
                <div
                  className="absolute inset-0"
                  style={{
                    background: 'var(--k-glass-thin)',
                    borderRadius: 'var(--k-radius-pill)',
                  }}
                />
                <div
                  className="absolute inset-y-0 left-0 pointer-events-none"
                  style={{
                    width: `${isMuted ? 0 : volume * 100}%`,
                    background: 'var(--k-gradient-primary)',
                    borderRadius: 'var(--k-radius-pill)',
                  }}
                />
                <div
                  className="absolute top-1/2 w-3 h-3 rounded-full pointer-events-none"
                  style={{
                    left: `${isMuted ? 0 : volume * 100}%`,
                    transform: 'translate(-50%, -50%)',
                    background: 'var(--k-text-primary)',
                    boxShadow: 'var(--k-shadow-sm)',
                  }}
                />
              </div>
            </div>
          </div>

          {/* Time display */}
          <span
            className="text-xs sm:text-sm tabular-nums whitespace-nowrap select-none"
            style={{
              color: 'var(--k-text-secondary)',
              fontFamily: 'var(--k-font-mono)',
            }}
          >
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Playback speed */}
          <div className="relative flex-shrink-0">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowSpeedMenu((prev) => !prev);
              }}
              className="h-8 px-2.5 flex items-center justify-center text-xs sm:text-sm font-medium rounded-full transition-all duration-150"
              style={{
                color: 'var(--k-text-secondary)',
                background: 'var(--k-glass-ultra-thin)',
                border: '1px solid var(--k-border-subtle)',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--k-glass-regular)'; e.currentTarget.style.color = 'var(--k-text-primary)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--k-glass-ultra-thin)'; e.currentTarget.style.color = 'var(--k-text-secondary)'; }}
              aria-label={t('lms.videoPlayer.playbackSpeed')}
              aria-haspopup="listbox"
              aria-expanded={showSpeedMenu}
            >
              {playbackRate === 1 ? '1x' : `${playbackRate}x`}
            </button>

            {/* Speed menu */}
            {showSpeedMenu && (
              <div
                className="absolute bottom-full right-0 mb-2 py-1 min-w-[80px]"
                style={{
                  background: 'var(--k-glass-thick)',
                  backdropFilter: 'blur(var(--k-blur-xl))',
                  WebkitBackdropFilter: 'blur(var(--k-blur-xl))',
                  borderRadius: 'var(--k-radius-md)',
                  border: '1px solid var(--k-border-default)',
                  boxShadow: 'var(--k-shadow-xl)',
                }}
                role="listbox"
                aria-label={t('lms.videoPlayer.playbackSpeed')}
                onClick={(e) => e.stopPropagation()}
              >
                {PLAYBACK_RATES.map((rate) => (
                  <button
                    key={rate}
                    onClick={() => changePlaybackRate(rate)}
                    role="option"
                    aria-selected={rate === playbackRate}
                    className="w-full px-3 py-1.5 text-sm text-left transition-colors duration-150"
                    style={{
                      color: rate === playbackRate ? 'var(--k-text-primary)' : 'var(--k-text-tertiary)',
                      background: rate === playbackRate ? 'var(--k-accent-indigo-10)' : 'transparent',
                      fontWeight: rate === playbackRate ? 500 : 400,
                    }}
                    onMouseEnter={(e) => { if (rate !== playbackRate) { e.currentTarget.style.background = 'var(--k-glass-regular)'; e.currentTarget.style.color = 'var(--k-text-primary)'; } }}
                    onMouseLeave={(e) => { if (rate !== playbackRate) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--k-text-tertiary)'; } }}
                  >
                    {rate === 1 ? t('lms.videoPlayer.normalSpeed') : `${rate}x`}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Fullscreen */}
          <button
            onClick={toggleFullscreen}
            className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-all duration-150"
            style={{
              background: 'var(--k-glass-thin)',
              border: '1px solid var(--k-border-subtle)',
              color: 'var(--k-text-primary)',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--k-glass-regular)'; e.currentTarget.style.boxShadow = 'var(--k-glow-primary)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--k-glass-thin)'; e.currentTarget.style.boxShadow = 'none'; }}
            aria-label={isFullscreen ? t('lms.videoPlayer.exitFullscreen') : t('lms.videoPlayer.enterFullscreen')}
          >
            {isFullscreen ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
              </svg>
            )}
          </button>
        </div>

        {/* Keyboard shortcuts hint (only on desktop, shown once on focus) */}
        <div
          className="hidden sm:block absolute -top-8 right-3 text-[10px] opacity-0 group-focus-within:opacity-100 transition-opacity pointer-events-none"
          style={{ color: 'var(--k-text-muted)' }}
        >
          {t('lms.videoPlayer.keyboardHint')}
        </div>
      </div>
    </div>
  );
}
