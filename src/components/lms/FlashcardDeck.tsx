'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useTranslations } from '@/hooks/useTranslations';

// ── Types ────────────────────────────────────────────────────

export interface FlashcardData {
  front: string;
  back: string;
  conceptId: string;
  difficulty: number; // 0-1
}

export interface FlashcardResult {
  conceptId: string;
  rating: 1 | 2 | 3 | 4; // Again, Hard, Good, Easy
}

export interface FlashcardDeckProps {
  cards: FlashcardData[];
  onComplete: (results: FlashcardResult[]) => void;
  /** Allow shuffle on mount */
  shuffleOnStart?: boolean;
}

type SessionStatus = 'learning' | 'complete';

// ── Fisher-Yates shuffle ────────────────────────────────────

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── Component ───────────────────────────────────────────────

export default function FlashcardDeck({
  cards,
  onComplete,
  shuffleOnStart = false,
}: FlashcardDeckProps) {
  const { t } = useTranslations();

  const [deck, setDeck] = useState<FlashcardData[]>(() =>
    shuffleOnStart ? shuffle(cards) : [...cards]
  );
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [results, setResults] = useState<FlashcardResult[]>([]);
  const [status, setStatus] = useState<SessionStatus>('learning');
  const [isShuffled, setIsShuffled] = useState(shuffleOnStart);

  // Touch handling
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const cardRef = useRef<HTMLDivElement>(null);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | null>(null);

  const currentCard = deck[currentIndex];
  const total = deck.length;
  const progressPercent = total > 0 ? ((currentIndex) / total) * 100 : 0;

  // ── Stats ─────────────────────────────────────────────────

  const stats = {
    mastered: results.filter(r => r.rating >= 3).length,
    learning: results.filter(r => r.rating === 2).length,
    review: results.filter(r => r.rating === 1).length,
  };

  // ── Actions ───────────────────────────────────────────────

  const flipCard = useCallback(() => {
    setIsFlipped(prev => !prev);
  }, []);

  const handleRate = useCallback((rating: 1 | 2 | 3 | 4) => {
    if (!currentCard) return;

    const result: FlashcardResult = {
      conceptId: currentCard.conceptId,
      rating,
    };

    const newResults = [...results, result];
    setResults(newResults);
    setIsFlipped(false);
    setSwipeOffset(0);
    setSwipeDirection(null);

    if (currentIndex + 1 >= total) {
      setStatus('complete');
      onComplete(newResults);
    } else {
      // Small delay for the un-flip animation
      setTimeout(() => {
        setCurrentIndex(prev => prev + 1);
      }, 150);
    }
  }, [currentCard, currentIndex, total, results, onComplete]);

  const handleShuffle = useCallback(() => {
    setDeck(shuffle(cards));
    setCurrentIndex(0);
    setIsFlipped(false);
    setResults([]);
    setStatus('learning');
    setIsShuffled(true);
  }, [cards]);

  const handleRestart = useCallback(() => {
    setDeck(isShuffled ? shuffle(cards) : [...cards]);
    setCurrentIndex(0);
    setIsFlipped(false);
    setResults([]);
    setStatus('learning');
  }, [cards, isShuffled]);

  // ── Keyboard ──────────────────────────────────────────────

  useEffect(() => {
    if (status !== 'learning') return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault();
        flipCard();
      } else if (isFlipped) {
        if (e.key === '1') handleRate(1);
        else if (e.key === '2') handleRate(2);
        else if (e.key === '3') handleRate(3);
        else if (e.key === '4') handleRate(4);
      }
      if (e.key === 'ArrowLeft' && currentIndex > 0) {
        setCurrentIndex(prev => prev - 1);
        setIsFlipped(false);
      }
      if (e.key === 'ArrowRight' && currentIndex < total - 1) {
        setCurrentIndex(prev => prev + 1);
        setIsFlipped(false);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [status, isFlipped, flipCard, handleRate, currentIndex, total]);

  // ── Touch/Swipe ───────────────────────────────────────────

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const dx = e.touches[0].clientX - touchStartX.current;
    const dy = e.touches[0].clientY - touchStartY.current;
    // Only track horizontal swipes
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 10) {
      setSwipeOffset(dx);
      setSwipeDirection(dx > 0 ? 'right' : 'left');
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    const threshold = 80;
    if (Math.abs(swipeOffset) > threshold && isFlipped) {
      // Swipe right = Good (3), Swipe left = Again (1)
      handleRate(swipeDirection === 'right' ? 3 : 1);
    }
    setSwipeOffset(0);
    setSwipeDirection(null);
  }, [swipeOffset, swipeDirection, isFlipped, handleRate]);

  // ── Difficulty indicator ──────────────────────────────────

  function getDifficultyColor(d: number): string {
    if (d < 0.33) return 'var(--k-accent-emerald)';
    if (d < 0.66) return 'var(--k-accent-amber)';
    return 'var(--k-accent-rose)';
  }

  function getDifficultyLabel(d: number): string {
    if (d < 0.33) return t('learn.flashcards.difficultyEasy');
    if (d < 0.66) return t('learn.flashcards.difficultyMedium');
    return t('learn.flashcards.difficultyHard');
  }

  // ── Complete Screen ───────────────────────────────────────

  if (status === 'complete') {
    return (
      <div className="w-full max-w-lg mx-auto px-4 py-8">
        <div
          className="p-8 text-center"
          style={{
            background: 'var(--k-glass-regular)',
            backdropFilter: 'blur(var(--k-blur-xl))',
            WebkitBackdropFilter: 'blur(var(--k-blur-xl))',
            border: '1px solid var(--k-border-subtle)',
            borderRadius: 'var(--k-radius-2xl)',
            boxShadow: 'var(--k-shadow-xl)',
          }}
        >
          {/* Trophy icon */}
          <div
            className="w-20 h-20 mx-auto mb-6 rounded-full flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, #f59e0b, #d97706)',
              boxShadow: '0 0 30px rgba(245, 158, 11, 0.4)',
            }}
          >
            <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
            </svg>
          </div>

          <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--k-text-primary)' }}>
            {t('learn.flashcards.sessionComplete')}
          </h2>
          <p className="mb-8" style={{ color: 'var(--k-text-secondary)' }}>
            {t('learn.flashcards.reviewedCards', { count: total })}
          </p>

          {/* Stats grid */}
          <div className="grid grid-cols-3 gap-4 mb-8">
            <div
              className="p-4"
              style={{
                background: 'var(--k-accent-emerald-10)',
                border: '1px solid rgba(16, 185, 129, 0.2)',
                borderRadius: 'var(--k-radius-lg)',
              }}
            >
              <div className="text-2xl font-bold" style={{ color: 'var(--k-accent-emerald)' }}>{stats.mastered}</div>
              <div className="text-xs font-medium mt-1" style={{ color: 'rgba(16, 185, 129, 0.8)' }}>
                {t('learn.flashcards.statsMastered')}
              </div>
            </div>
            <div
              className="p-4"
              style={{
                background: 'var(--k-accent-amber-10)',
                border: '1px solid rgba(245, 158, 11, 0.2)',
                borderRadius: 'var(--k-radius-lg)',
              }}
            >
              <div className="text-2xl font-bold" style={{ color: 'var(--k-accent-amber)' }}>{stats.learning}</div>
              <div className="text-xs font-medium mt-1" style={{ color: 'rgba(245, 158, 11, 0.8)' }}>
                {t('learn.flashcards.statsLearning')}
              </div>
            </div>
            <div
              className="p-4"
              style={{
                background: 'var(--k-accent-rose-10)',
                border: '1px solid rgba(244, 63, 94, 0.2)',
                borderRadius: 'var(--k-radius-lg)',
              }}
            >
              <div className="text-2xl font-bold" style={{ color: 'var(--k-accent-rose)' }}>{stats.review}</div>
              <div className="text-xs font-medium mt-1" style={{ color: 'rgba(244, 63, 94, 0.8)' }}>
                {t('learn.flashcards.statsReview')}
              </div>
            </div>
          </div>

          <button
            onClick={handleRestart}
            className="inline-flex items-center gap-2 px-6 py-3 font-semibold transition-all active:scale-95"
            style={{
              background: 'var(--k-gradient-primary)',
              color: 'var(--k-text-primary)',
              borderRadius: 'var(--k-radius-lg)',
              boxShadow: 'var(--k-glow-primary)',
            }}
            aria-label={t('learn.flashcards.studyAgain')}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {t('learn.flashcards.studyAgain')}
          </button>
        </div>
      </div>
    );
  }

  // ── Learning Screen ───────────────────────────────────────

  return (
    <div className="w-full max-w-lg mx-auto px-4 py-6">
      {/* Header: progress + shuffle */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-medium" style={{ color: 'var(--k-text-secondary)' }}>
          {t('learn.flashcards.cardOf', { current: currentIndex + 1, total })}
        </span>
        <button
          onClick={handleShuffle}
          className="inline-flex items-center gap-1.5 text-sm transition-all"
          style={{ color: 'var(--k-text-tertiary)' }}
          aria-label={t('learn.flashcards.shuffle')}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12c0-1.232-.046-2.453-.138-3.662a4.006 4.006 0 00-3.7-3.7 48.678 48.678 0 00-7.324 0 4.006 4.006 0 00-3.7 3.7c-.017.22-.032.441-.046.662M19.5 12l3-3m-3 3l-3-3m-12 3c0 1.232.046 2.453.138 3.662a4.006 4.006 0 003.7 3.7 48.656 48.656 0 007.324 0 4.006 4.006 0 003.7-3.7c.017-.22.032-.441.046-.662M4.5 12l3 3m-3-3l-3 3" />
          </svg>
          {t('learn.flashcards.shuffle')}
        </button>
      </div>

      {/* Progress bar */}
      <div
        className="w-full h-2 mb-6 overflow-hidden"
        style={{
          background: 'rgba(255, 255, 255, 0.08)',
          borderRadius: 'var(--k-radius-pill)',
        }}
        role="progressbar"
        aria-valuenow={currentIndex + 1}
        aria-valuemin={1}
        aria-valuemax={total}
      >
        <div
          className="h-full transition-all duration-500 ease-out"
          style={{
            width: `${progressPercent}%`,
            background: 'var(--k-gradient-primary)',
            borderRadius: 'var(--k-radius-pill)',
          }}
        />
      </div>

      {/* Difficulty badge */}
      {currentCard && (
        <div className="flex items-center gap-2 mb-4">
          <span
            className="w-2.5 h-2.5 rounded-full"
            style={{ background: getDifficultyColor(currentCard.difficulty) }}
          />
          <span className="text-xs font-medium" style={{ color: 'var(--k-text-tertiary)' }}>
            {getDifficultyLabel(currentCard.difficulty)}
          </span>
        </div>
      )}

      {/* ── Card ──────────────────────────────────────────── */}
      <div
        ref={cardRef}
        className="relative w-full cursor-pointer select-none"
        style={{ perspective: '1200px' }}
        onClick={flipCard}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        role="button"
        tabIndex={0}
        aria-label={isFlipped ? t('learn.flashcards.cardBack') : t('learn.flashcards.cardFront')}
        onKeyDown={(e) => {
          if (e.key === 'Enter') flipCard();
        }}
      >
        <div
          className="relative w-full transition-transform duration-500 ease-in-out"
          style={{
            transformStyle: 'preserve-3d',
            transform: `${isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)'} translateX(${swipeOffset}px)`,
            minHeight: '280px',
          }}
        >
          {/* Front — glass-regular */}
          <div
            className="absolute inset-0 p-8 flex flex-col items-center justify-center"
            style={{
              backfaceVisibility: 'hidden',
              background: 'var(--k-glass-regular)',
              backdropFilter: 'blur(var(--k-blur-xl))',
              WebkitBackdropFilter: 'blur(var(--k-blur-xl))',
              border: '1px solid var(--k-border-default)',
              borderRadius: 'var(--k-radius-2xl)',
              boxShadow: 'var(--k-shadow-xl)',
            }}
          >
            <div className="text-xs uppercase tracking-wider mb-4 font-medium" style={{ color: 'var(--k-text-muted)' }}>
              {t('learn.flashcards.question')}
            </div>
            <div className="text-xl font-semibold text-center leading-relaxed" style={{ color: 'var(--k-text-primary)' }}>
              {currentCard?.front}
            </div>
            <div className="mt-6 text-sm flex items-center gap-1.5" style={{ color: 'var(--k-text-muted)' }}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
              </svg>
              {t('learn.flashcards.tapToFlip')}
            </div>
          </div>

          {/* Back — glass-chromatic */}
          <div
            className="absolute inset-0 p-8 flex flex-col items-center justify-center"
            style={{
              backfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)',
              background: 'var(--k-glass-chromatic)',
              backdropFilter: 'blur(var(--k-blur-xl))',
              WebkitBackdropFilter: 'blur(var(--k-blur-xl))',
              border: '1px solid rgba(99, 102, 241, 0.2)',
              borderRadius: 'var(--k-radius-2xl)',
              boxShadow: 'var(--k-shadow-xl), var(--k-glow-primary)',
            }}
          >
            <div className="text-xs uppercase tracking-wider mb-4 font-medium" style={{ color: 'var(--k-accent-indigo)' }}>
              {t('learn.flashcards.answer')}
            </div>
            <div className="text-lg text-center leading-relaxed" style={{ color: 'var(--k-text-primary)' }}>
              {currentCard?.back}
            </div>
          </div>
        </div>
      </div>

      {/* Swipe hint on mobile (only when flipped) */}
      {isFlipped && (
        <div className="flex items-center justify-center gap-6 mt-3 sm:hidden">
          <span className="text-xs flex items-center gap-1" style={{ color: 'var(--k-text-muted)' }}>
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            {t('learn.flashcards.swipeLeftAgain')}
          </span>
          <span className="text-xs flex items-center gap-1" style={{ color: 'var(--k-text-muted)' }}>
            {t('learn.flashcards.swipeRightGood')}
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </span>
        </div>
      )}

      {/* ── FSRS Rating Buttons — Glass pills with color coding ── */}
      <div
        className={`mt-6 grid grid-cols-4 gap-2 transition-all duration-300 ${
          isFlipped ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
        }`}
      >
        <button
          onClick={(e) => { e.stopPropagation(); handleRate(1); }}
          className="flex flex-col items-center gap-1 py-3 transition-all active:scale-95"
          style={{
            background: 'var(--k-accent-rose-10)',
            border: '1px solid rgba(244, 63, 94, 0.25)',
            borderRadius: 'var(--k-radius-pill)',
            color: 'var(--k-accent-rose)',
          }}
          aria-label={t('learn.flashcards.ratingAgain')}
        >
          <span className="text-sm font-bold">1</span>
          <span className="text-xs font-medium">{t('learn.flashcards.ratingAgain')}</span>
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); handleRate(2); }}
          className="flex flex-col items-center gap-1 py-3 transition-all active:scale-95"
          style={{
            background: 'var(--k-accent-amber-10)',
            border: '1px solid rgba(245, 158, 11, 0.25)',
            borderRadius: 'var(--k-radius-pill)',
            color: 'var(--k-accent-amber)',
          }}
          aria-label={t('learn.flashcards.ratingHard')}
        >
          <span className="text-sm font-bold">2</span>
          <span className="text-xs font-medium">{t('learn.flashcards.ratingHard')}</span>
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); handleRate(3); }}
          className="flex flex-col items-center gap-1 py-3 transition-all active:scale-95"
          style={{
            background: 'var(--k-accent-emerald-10)',
            border: '1px solid rgba(16, 185, 129, 0.25)',
            borderRadius: 'var(--k-radius-pill)',
            color: 'var(--k-accent-emerald)',
          }}
          aria-label={t('learn.flashcards.ratingGood')}
        >
          <span className="text-sm font-bold">3</span>
          <span className="text-xs font-medium">{t('learn.flashcards.ratingGood')}</span>
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); handleRate(4); }}
          className="flex flex-col items-center gap-1 py-3 transition-all active:scale-95"
          style={{
            background: 'var(--k-accent-cyan-10)',
            border: '1px solid rgba(6, 182, 212, 0.25)',
            borderRadius: 'var(--k-radius-pill)',
            color: 'var(--k-accent-cyan)',
          }}
          aria-label={t('learn.flashcards.ratingEasy')}
        >
          <span className="text-sm font-bold">4</span>
          <span className="text-xs font-medium">{t('learn.flashcards.ratingEasy')}</span>
        </button>
      </div>

      {/* ── Keyboard shortcuts legend ────────────────────── */}
      <div className="mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs" style={{ color: 'var(--k-text-muted)' }}>
        <span className="hidden sm:inline-flex items-center gap-1">
          <kbd
            className="px-1.5 py-0.5 font-mono text-[10px]"
            style={{
              background: 'var(--k-glass-thin)',
              border: '1px solid var(--k-border-subtle)',
              borderRadius: 'var(--k-radius-sm)',
              color: 'var(--k-text-tertiary)',
            }}
          >Space</kbd>
          {t('learn.flashcards.shortcutFlip')}
        </span>
        <span className="hidden sm:inline-flex items-center gap-1">
          <kbd
            className="px-1.5 py-0.5 font-mono text-[10px]"
            style={{
              background: 'var(--k-glass-thin)',
              border: '1px solid var(--k-border-subtle)',
              borderRadius: 'var(--k-radius-sm)',
              color: 'var(--k-text-tertiary)',
            }}
          >1-4</kbd>
          {t('learn.flashcards.shortcutRate')}
        </span>
        <span className="hidden sm:inline-flex items-center gap-1">
          <kbd
            className="px-1.5 py-0.5 font-mono text-[10px]"
            style={{
              background: 'var(--k-glass-thin)',
              border: '1px solid var(--k-border-subtle)',
              borderRadius: 'var(--k-radius-sm)',
              color: 'var(--k-text-tertiary)',
            }}
          >&larr; &rarr;</kbd>
          {t('learn.flashcards.shortcutNavigate')}
        </span>
      </div>
    </div>
  );
}
