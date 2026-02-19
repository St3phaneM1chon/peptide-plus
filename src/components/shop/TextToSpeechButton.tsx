'use client';

import { useTextToSpeech } from '@/hooks/useTextToSpeech';
import { useI18n } from '@/i18n/client';

/**
 * Floating Text-to-Speech button.
 * Reads the main content of the page aloud using the browser's best voices.
 * Automatically adapts to the customer's selected language.
 */
export default function TextToSpeechButton() {
  const { t, locale } = useI18n();
  const { status, isSupported, progress, toggle, stop } = useTextToSpeech({
    locale,
    rate: 0.92,
    pitch: 1.02,
    contentSelector: 'main',
  });

  if (!isSupported) return null;

  const label =
    status === 'idle'
      ? t('tts.listen') || 'Listen to this page'
      : status === 'speaking'
        ? t('tts.pause') || 'Pause'
        : status === 'paused'
          ? t('tts.resume') || 'Resume'
          : t('tts.loading') || 'Loading...';

  return (
    <div className="fixed bottom-6 start-6 z-40 flex items-center gap-2">
      {/* Main button */}
      <button
        onClick={toggle}
        aria-label={label}
        title={label}
        className={`
          group relative w-12 h-12 rounded-full shadow-lg transition-all duration-300
          flex items-center justify-center
          ${status === 'speaking'
            ? 'bg-orange-500 text-white shadow-orange-500/30'
            : status === 'paused'
              ? 'bg-orange-400 text-white shadow-orange-400/20'
              : 'bg-white text-gray-700 hover:bg-orange-50 hover:text-orange-600 shadow-gray-200/50 hover:shadow-orange-200/50'
          }
        `}
      >
        {status === 'idle' && <SpeakerIcon />}
        {status === 'speaking' && <PauseIcon />}
        {status === 'paused' && <PlayIcon />}
        {status === 'loading' && <LoadingSpinner />}

        {/* Progress ring */}
        {(status === 'speaking' || status === 'paused') && (
          <svg className="absolute inset-0 w-12 h-12 -rotate-90" viewBox="0 0 48 48">
            <circle
              cx="24" cy="24" r="22"
              fill="none"
              stroke="rgba(255,255,255,0.3)"
              strokeWidth="2"
            />
            <circle
              cx="24" cy="24" r="22"
              fill="none"
              stroke="white"
              strokeWidth="2"
              strokeDasharray={`${2 * Math.PI * 22}`}
              strokeDashoffset={`${2 * Math.PI * 22 * (1 - progress / 100)}`}
              strokeLinecap="round"
              className="transition-all duration-500"
            />
          </svg>
        )}
      </button>

      {/* Stop button (visible when playing or paused) */}
      {(status === 'speaking' || status === 'paused') && (
        <button
          onClick={stop}
          aria-label={t('tts.stop') || 'Stop'}
          title={t('tts.stop') || 'Stop'}
          className="w-8 h-8 rounded-full bg-white text-gray-500 hover:text-red-500 shadow-md flex items-center justify-center transition-all duration-200 hover:scale-110"
        >
          <StopIcon />
        </button>
      )}

      {/* Tooltip on hover (idle state) */}
      {status === 'idle' && (
        <span className="hidden group-hover:block absolute start-14 bg-gray-900 text-white text-xs px-3 py-1.5 rounded-lg whitespace-nowrap shadow-lg pointer-events-none">
          {label}
        </span>
      )}
    </div>
  );
}

// ============================================
// ICONS
// ============================================

function SpeakerIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <rect x="6" y="4" width="4" height="16" rx="1" />
      <rect x="14" y="4" width="4" height="16" rx="1" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <polygon points="8 5 20 12 8 19 8 5" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <rect x="4" y="4" width="16" height="16" rx="2" />
    </svg>
  );
}

function LoadingSpinner() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin">
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  );
}
