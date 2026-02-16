'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

export type TTSStatus = 'idle' | 'loading' | 'speaking' | 'paused';

// Chatterbox TTS server URL (self-hosted on Mac Studio)
const TTS_API_URL = process.env.NEXT_PUBLIC_TTS_API_URL || 'http://localhost:8003';

// Languages supported by Chatterbox multilingual model
const CHATTERBOX_LANGUAGES = new Set([
  'ar', 'da', 'de', 'el', 'en', 'es', 'fi', 'fr', 'he', 'hi',
  'it', 'ja', 'ko', 'ms', 'nl', 'no', 'pl', 'pt', 'ru', 'sv',
  'sw', 'tr', 'zh',
]);

/**
 * Mapping locale -> BCP-47 language tag for Web Speech API fallback.
 */
const LOCALE_TO_LANG: Record<string, string> = {
  en: 'en-US', fr: 'fr-CA', ar: 'ar-SA', 'ar-dz': 'ar-DZ',
  'ar-lb': 'ar-LB', 'ar-ma': 'ar-MA', zh: 'zh-CN', de: 'de-DE',
  es: 'es-ES', tl: 'fil-PH', hi: 'hi-IN', it: 'it-IT', ko: 'ko-KR',
  pl: 'pl-PL', pt: 'pt-BR', pa: 'pa-IN', ru: 'ru-RU', sv: 'sv-SE',
  ta: 'ta-IN', vi: 'vi-VN', ht: 'fr-HT', gcr: 'fr-FR',
};

const PREFERRED_VOICES: Record<string, string[]> = {
  'en': ['Google US English', 'Samantha', 'Microsoft Aria', 'Karen'],
  'fr': ['Google français', 'Thomas', 'Amelie', 'Microsoft Denise'],
  'ar': ['Google العربية', 'Majed', 'Microsoft Hoda'],
  'zh': ['Google 普通话', 'Ting-Ting', 'Microsoft Xiaoxiao'],
  'de': ['Google Deutsch', 'Anna', 'Microsoft Katja'],
  'es': ['Google español', 'Monica', 'Microsoft Elena'],
  'hi': ['Google हिन्दी', 'Lekha', 'Microsoft Swara'],
  'it': ['Google italiano', 'Alice', 'Microsoft Elsa'],
  'ko': ['Google 한국의', 'Yuna', 'Microsoft SunHi'],
  'pl': ['Google polski', 'Zosia', 'Microsoft Paulina'],
  'pt': ['Google português do Brasil', 'Luciana', 'Microsoft Francisca'],
  'ru': ['Google русский', 'Milena', 'Microsoft Irina'],
  'sv': ['Google svenska', 'Alva', 'Microsoft Hillevi'],
  'ta': ['Google தமிழ்', 'Microsoft Pallavi'],
  'vi': ['Google Tiếng Việt', 'Microsoft HoaiMy'],
  'tl': ['Google Filipino'],
  'pa': ['Google ਪੰਜਾਬੀ'],
};

function findBestVoice(voices: SpeechSynthesisVoice[], locale: string): SpeechSynthesisVoice | null {
  if (!voices.length) return null;
  const langTag = LOCALE_TO_LANG[locale] || locale;
  const baseLang = langTag.split('-')[0];

  const preferredNames = PREFERRED_VOICES[baseLang] || [];
  for (const name of preferredNames) {
    const match = voices.find(v => v.name.includes(name));
    if (match) return match;
  }

  const exactMatch = voices.find(v => v.lang === langTag);
  if (exactMatch) return exactMatch;

  const baseMatch = voices.find(v => v.lang.startsWith(baseLang));
  if (baseMatch) return baseMatch;

  if (locale === 'ht' || locale === 'gcr') {
    const frVoice = voices.find(v => v.lang.startsWith('fr'));
    if (frVoice) return frVoice;
  }

  return null;
}

/**
 * Extract readable text from a DOM element, skipping nav, buttons, scripts, etc.
 */
function extractReadableText(element: HTMLElement): string {
  const SKIP_TAGS = new Set([
    'NAV', 'BUTTON', 'SCRIPT', 'STYLE', 'NOSCRIPT', 'SVG', 'IFRAME',
    'INPUT', 'SELECT', 'TEXTAREA', 'FORM', 'HEADER', 'FOOTER',
  ]);
  const SKIP_CLASSES = ['tts-ignore', 'sr-only', 'hidden'];

  function walk(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent?.trim() || '';
    if (node.nodeType !== Node.ELEMENT_NODE) return '';
    const el = node as HTMLElement;
    if (SKIP_TAGS.has(el.tagName)) return '';
    if (SKIP_CLASSES.some(cls => el.classList.contains(cls))) return '';
    if (el.getAttribute('aria-hidden') === 'true') return '';
    if (el.getAttribute('role') === 'navigation') return '';

    const parts: string[] = [];
    for (const child of Array.from(el.childNodes)) {
      const text = walk(child);
      if (text) parts.push(text);
    }
    const blockTags = new Set(['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'DIV', 'SECTION', 'ARTICLE', 'TR']);
    const joined = parts.join(' ');
    return blockTags.has(el.tagName) ? joined + '. ' : joined;
  }

  return walk(element).replace(/\s+/g, ' ').replace(/\.\s*\./g, '.').trim();
}

/**
 * Check if locale is supported by Chatterbox
 */
function isChatterboxSupported(locale: string): boolean {
  const baseLang = locale.split('-')[0];
  return CHATTERBOX_LANGUAGES.has(baseLang);
}

interface UseTextToSpeechOptions {
  locale?: string;
  rate?: number;
  pitch?: number;
  contentSelector?: string;
}

export function useTextToSpeech(options: UseTextToSpeechOptions = {}) {
  const {
    locale = 'en',
    rate = 0.95,
    pitch = 1.0,
    contentSelector = 'main',
  } = options;

  const [status, setStatus] = useState<TTSStatus>('idle');
  const [isSupported, setIsSupported] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [progress, setProgress] = useState(0);
  const [chatterboxAvailable, setChatterboxAvailable] = useState<boolean | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const abortRef = useRef(false);

  // Check browser support + Chatterbox server health
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Web Speech API is always a fallback
    if (window.speechSynthesis) {
      setIsSupported(true);
      const loadVoices = () => {
        const v = window.speechSynthesis.getVoices();
        if (v.length > 0) setVoices(v);
      };
      loadVoices();
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }

    // Check Chatterbox server
    fetch(`${TTS_API_URL}/health`, { signal: AbortSignal.timeout(3000) })
      .then(r => r.json())
      .then(data => {
        setChatterboxAvailable(data.status === 'ok' && data.model_loaded);
        setIsSupported(true);
      })
      .catch(() => setChatterboxAvailable(false));

    return () => {
      if (window.speechSynthesis) window.speechSynthesis.onvoiceschanged = null;
    };
  }, []);

  /**
   * Split text into chunks for Chatterbox (larger chunks OK) or Web Speech API
   */
  const splitIntoChunks = useCallback((text: string, maxLen: number): string[] => {
    const sentences = text.split(/(?<=[.!?。！？])\s+/);
    const chunks: string[] = [];
    let current = '';
    for (const sentence of sentences) {
      if ((current + ' ' + sentence).length > maxLen && current) {
        chunks.push(current.trim());
        current = sentence;
      } else {
        current = current ? current + ' ' + sentence : sentence;
      }
    }
    if (current.trim()) chunks.push(current.trim());
    return chunks;
  }, []);

  /**
   * Speak via Chatterbox API (returns audio blob)
   */
  const speakViaChatterbox = useCallback(async (text: string): Promise<boolean> => {
    try {
      const res = await fetch(`${TTS_API_URL}/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, locale }),
      });
      if (!res.ok) return false;

      const data = await res.json();
      const audioUrl = `${TTS_API_URL}${data.audio_url}`;

      return new Promise<boolean>((resolve) => {
        const audio = new Audio(audioUrl);
        audioRef.current = audio;
        audio.onended = () => resolve(true);
        audio.onerror = () => resolve(false);
        audio.play().catch(() => resolve(false));
      });
    } catch {
      return false;
    }
  }, [locale]);

  /**
   * Speak via Web Speech API (browser-native fallback)
   */
  const speakViaWebSpeech = useCallback((text: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      const utterance = new SpeechSynthesisUtterance(text);
      const voice = findBestVoice(voices, locale);
      if (voice) utterance.voice = voice;
      utterance.rate = rate;
      utterance.pitch = pitch;
      utterance.volume = 1.0;
      utterance.lang = LOCALE_TO_LANG[locale] || locale;
      utterance.onend = () => resolve();
      utterance.onerror = (e) => {
        if (e.error === 'canceled' || e.error === 'interrupted') resolve();
        else reject(e);
      };
      window.speechSynthesis.speak(utterance);
    });
  }, [locale, rate, pitch, voices]);

  /**
   * Main speak function - tries Chatterbox first, falls back to Web Speech API
   */
  const speak = useCallback(async (customText?: string) => {
    if (!isSupported) return;
    abortRef.current = false;

    // Cancel any ongoing speech
    window.speechSynthesis?.cancel();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    // Get text
    let text = customText;
    if (!text) {
      const el = document.querySelector(contentSelector) as HTMLElement;
      if (!el) return;
      text = extractReadableText(el);
    }
    if (!text) return;

    const useChatterbox = chatterboxAvailable && isChatterboxSupported(locale);
    const chunks = splitIntoChunks(text, useChatterbox ? 2000 : 180);

    setStatus('speaking');

    try {
      for (let i = 0; i < chunks.length; i++) {
        if (abortRef.current) break;
        setProgress(Math.round((i / chunks.length) * 100));

        if (useChatterbox) {
          // Try Chatterbox first
          setStatus('loading');
          const success = await speakViaChatterbox(chunks[i]);
          if (!success) {
            // Fallback to Web Speech for this chunk
            setStatus('speaking');
            await speakViaWebSpeech(chunks[i]);
          } else {
            setStatus('speaking');
          }
        } else {
          // Web Speech API only
          await speakViaWebSpeech(chunks[i]);
          if (!window.speechSynthesis.speaking && i < chunks.length - 1) break;
        }
      }
    } catch {
      // Interrupted
    }

    setStatus('idle');
    setProgress(0);
  }, [isSupported, chatterboxAvailable, locale, contentSelector, splitIntoChunks, speakViaChatterbox, speakViaWebSpeech]);

  const pause = useCallback(() => {
    if (audioRef.current && !audioRef.current.paused) {
      audioRef.current.pause();
      setStatus('paused');
    } else if (window.speechSynthesis?.speaking) {
      window.speechSynthesis.pause();
      setStatus('paused');
    }
  }, []);

  const resume = useCallback(() => {
    if (audioRef.current?.paused) {
      audioRef.current.play();
      setStatus('speaking');
    } else if (window.speechSynthesis?.paused) {
      window.speechSynthesis.resume();
      setStatus('speaking');
    }
  }, []);

  const stop = useCallback(() => {
    abortRef.current = true;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    window.speechSynthesis?.cancel();
    setStatus('idle');
    setProgress(0);
  }, []);

  const toggle = useCallback(() => {
    if (status === 'idle') speak();
    else if (status === 'speaking') pause();
    else if (status === 'paused') resume();
  }, [status, speak, pause, resume]);

  return {
    status,
    isSupported,
    progress,
    speak,
    pause,
    resume,
    stop,
    toggle,
    chatterboxAvailable,
    hasVoiceForLocale: isChatterboxSupported(locale) || findBestVoice(voices, locale) !== null,
  };
}
