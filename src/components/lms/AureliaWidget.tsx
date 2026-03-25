'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { X, Mic, MicOff, Send, Sparkles, Volume2, VolumeX, Loader2 } from 'lucide-react';

/**
 * AURELIA WIDGET — Omnipresente sur chaque page etudiant
 *
 * Bouton flottant en bas a droite. Un clic ouvre la conversation.
 * Aurelia connait la page actuelle (cours, lecon, quiz) et adapte ses reponses.
 * Supporte texte ET voix (Deepgram STT + ElevenLabs TTS).
 */

interface AureliaWidgetProps {
  /** Contexte de la page actuelle — injecte dans chaque message a Aurelia */
  context?: {
    pageType: 'course' | 'lesson' | 'quiz' | 'dashboard' | 'catalog' | 'certificate' | 'general';
    courseId?: string;
    courseTitle?: string;
    lessonId?: string;
    lessonTitle?: string;
    lessonType?: string;
    conceptId?: string;
    conceptName?: string;
    quizId?: string;
    currentScore?: number;
    masteryLevel?: number;
  };
  /** Nom de l'etudiant pour personnalisation */
  studentName?: string;
  /** Province de l'etudiant (null = pas encore definie) */
  studentProvince?: string | null;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const PROVINCE_OPTIONS = [
  { code: 'AB', label: 'Alberta' },
  { code: 'BC', label: 'Colombie-Britannique' },
  { code: 'MB', label: 'Manitoba' },
  { code: 'NB', label: 'Nouveau-Brunswick' },
  { code: 'NL', label: 'Terre-Neuve-et-Labrador' },
  { code: 'NS', label: 'Nouvelle-Ecosse' },
  { code: 'NT', label: 'Territoires du Nord-Ouest' },
  { code: 'NU', label: 'Nunavut' },
  { code: 'ON', label: 'Ontario' },
  { code: 'PE', label: 'Ile-du-Prince-Edouard' },
  { code: 'QC', label: 'Quebec' },
  { code: 'SK', label: 'Saskatchewan' },
  { code: 'YT', label: 'Yukon' },
];

export default function AureliaWidget({ context, studentName, studentProvince }: AureliaWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [showPulse, setShowPulse] = useState(true);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const [loadingTtsId, setLoadingTtsId] = useState<string | null>(null);
  const [autoSpeak, setAutoSpeak] = useState(false);
  const [showProvincePrompt, setShowProvincePrompt] = useState(!studentProvince);
  const [selectedProvince, setSelectedProvince] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const autoSpeakRef = useRef(autoSpeak);

  // Auto-scroll au dernier message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input quand ouvert
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Keep autoSpeakRef in sync
  useEffect(() => {
    autoSpeakRef.current = autoSpeak;
  }, [autoSpeak]);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  /** Stop any currently playing TTS audio */
  const stopSpeaking = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    setSpeakingMessageId(null);
  }, []);

  /** Speak a message via ElevenLabs TTS */
  const speakMessage = useCallback(async (messageId: string, text: string) => {
    // If already speaking this message, stop it
    if (speakingMessageId === messageId) {
      stopSpeaking();
      return;
    }

    // Stop any current playback
    stopSpeaking();

    // Strip markdown formatting for cleaner speech
    const cleanText = text
      .replace(/#{1,6}\s/g, '')        // headings
      .replace(/\*\*(.+?)\*\*/g, '$1') // bold
      .replace(/\*(.+?)\*/g, '$1')     // italic
      .replace(/`(.+?)`/g, '$1')       // inline code
      .replace(/\[(.+?)\]\(.+?\)/g, '$1') // links
      .replace(/^[-*]\s/gm, '')        // list markers
      .replace(/^\d+\.\s/gm, '')       // numbered lists
      .trim();

    if (!cleanText) return;

    setLoadingTtsId(messageId);

    try {
      const res = await fetch('/api/lms/tutor/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: cleanText.slice(0, 5000) }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        console.error('[TTS] Error:', errorData.error || res.statusText);
        return;
      }

      const audioBlob = await res.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);

      audio.onended = () => {
        setSpeakingMessageId(null);
        URL.revokeObjectURL(audioUrl);
        audioRef.current = null;
      };

      audio.onerror = () => {
        setSpeakingMessageId(null);
        URL.revokeObjectURL(audioUrl);
        audioRef.current = null;
      };

      audioRef.current = audio;
      setSpeakingMessageId(messageId);
      await audio.play();
    } catch (err) {
      console.error('[TTS] Failed to speak:', err);
      setSpeakingMessageId(null);
    } finally {
      setLoadingTtsId(null);
    }
  }, [speakingMessageId, stopSpeaking]);

  // Message d'accueil contextuel
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      const greeting = showProvincePrompt
        ? `Bonjour${studentName ? `, ${studentName}` : ''}! Je suis Aurelia, ta tutrice personnelle. Avant de commencer, j'ai besoin de savoir dans quelle province tu travailles — les lois et regulateurs varient d'une province a l'autre au Canada.`
        : getContextualGreeting();
      setMessages([{
        id: 'greeting',
        role: 'assistant',
        content: greeting,
        timestamp: new Date(),
      }]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  function getContextualGreeting(): string {
    const name = studentName ? `, ${studentName}` : '';

    switch (context?.pageType) {
      case 'lesson':
        return `Salut${name}! Tu es sur la leçon "${context.lessonTitle}". Si tu as des questions sur le contenu, je suis là pour t'expliquer. 😊`;
      case 'quiz':
        return `Hey${name}! Tu es dans un quiz. Je ne peux pas te donner les réponses, mais je peux t'aider à comprendre les concepts si tu bloques. Demande-moi!`;
      case 'course':
        return `Bonjour${name}! Tu regardes le cours "${context.courseTitle}". Tu veux que je t'explique le contenu ou que je te recommande par où commencer?`;
      case 'dashboard':
        return `Salut${name}! Comment ça va aujourd'hui? Je vois ton tableau de bord — tu veux qu'on révise tes points faibles ou qu'on continue où tu en étais?`;
      case 'certificate':
        return `Félicitations${name}! 🎉 Tu as un certificat ici. Si tu veux revoir la matière ou préparer la suite, je suis là.`;
      default:
        return `Bonjour${name}! Je suis Aurélia, ta tutrice personnelle. Pose-moi n'importe quelle question sur ta formation. 💡`;
    }
  }

  async function sendMessage(content: string) {
    if (!content.trim() || isLoading) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: content.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setShowPulse(false);

    try {
      const res = await fetch('/api/lms/tutor/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: content.trim(),
          context,
          conversationHistory: messages.slice(-10).map(m => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      const data = await res.json();

      const assistantId = `assistant-${Date.now()}`;
      const assistantContent = data.response || 'Désolée, je n\'ai pas pu traiter ta demande.';

      setMessages(prev => [...prev, {
        id: assistantId,
        role: 'assistant',
        content: assistantContent,
        timestamp: new Date(),
      }]);

      // Auto-speak if enabled
      if (autoSpeakRef.current) {
        // Small delay to let the state update propagate
        setTimeout(() => speakMessage(assistantId, assistantContent), 100);
      }
    } catch {
      setMessages(prev => [...prev, {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: 'Oops, problème de connexion. Réessaie dans un instant!',
        timestamp: new Date(),
      }]);
    } finally {
      setIsLoading(false);
    }
  }

  async function toggleVoice() {
    if (isListening) {
      setIsListening(false);
      // Stop recording — handled by browser MediaRecorder
      return;
    }

    setIsListening(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];

      mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunks, { type: 'audio/webm' });

        // Envoyer a Deepgram pour STT
        const formData = new FormData();
        formData.append('audio', blob);

        try {
          const res = await fetch('/api/lms/tutor/stt', { method: 'POST', body: formData });
          const data = await res.json();
          if (data.text) {
            setInput(data.text);
            sendMessage(data.text);
          }
        } catch {
          // Fallback silencieux
        }
        setIsListening(false);
      };

      mediaRecorder.start();
      // Auto-stop apres 30 secondes
      setTimeout(() => {
        if (mediaRecorder.state === 'recording') {
          mediaRecorder.stop();
        }
      }, 30000);
    } catch {
      setIsListening(false);
    }
  }

  return (
    <>
      {/* Widget flottant */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full bg-blue-600 px-5 py-3 text-white shadow-lg hover:bg-blue-700 transition-all hover:scale-105"
          aria-label="Parler avec Aurélia"
        >
          {showPulse && (
            <span className="absolute -top-1 -right-1 flex h-4 w-4">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-4 w-4 bg-yellow-400" />
            </span>
          )}
          <Sparkles className="h-5 w-5" />
          <span className="text-sm font-medium">Aurélia</span>
        </button>
      )}

      {/* Fenetre de chat */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 z-50 w-96 h-[32rem] flex flex-col rounded-2xl border bg-background shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-blue-600 text-white">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              <div>
                <p className="font-semibold text-sm">Aurélia</p>
                <p className="text-xs opacity-80">Tutrice personnelle</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setAutoSpeak(prev => !prev)}
                className={`p-1 rounded transition-colors ${autoSpeak ? 'bg-blue-500' : 'hover:bg-blue-700 opacity-60'}`}
                aria-label={autoSpeak ? 'Désactiver la lecture automatique' : 'Activer la lecture automatique'}
                title={autoSpeak ? 'Lecture auto activée' : 'Lecture auto désactivée'}
              >
                {autoSpeak ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
              </button>
              <button onClick={() => setIsOpen(false)} aria-label="Fermer" className="p-1 hover:bg-blue-700 rounded">
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Context banner */}
          {context?.courseTitle && (
            <div className="px-3 py-1.5 bg-blue-50 text-xs text-blue-700 border-b">
              📖 {context.courseTitle} {context.lessonTitle ? `→ ${context.lessonTitle}` : ''}
            </div>
          )}

          {/* Province selector (shown once if province not set) */}
          {showProvincePrompt && !selectedProvince && (
            <div className="px-3 py-2 bg-amber-50 border-b border-amber-100">
              <p className="text-xs text-amber-700 font-medium mb-2">Dans quelle province travailles-tu?</p>
              <select
                value=""
                onChange={async (e) => {
                  const code = e.target.value;
                  if (!code) return;
                  setSelectedProvince(code);
                  setShowProvincePrompt(false);
                  // Save to profile
                  try {
                    await fetch('/api/lms/preferences', {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ workProvince: code }),
                    });
                  } catch { /* silent */ }
                  const prov = PROVINCE_OPTIONS.find(p => p.code === code);
                  setMessages(prev => [
                    ...prev,
                    {
                      id: `province-${Date.now()}`,
                      role: 'assistant',
                      content: `Parfait! J'ai note que tu travailles en ${prov?.label || code}. Je vais adapter mes reponses aux lois et regulateurs de ta province. Pose-moi ta premiere question!`,
                      timestamp: new Date(),
                    },
                  ]);
                }}
                className="w-full px-2 py-1.5 border border-amber-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-label="Province de travail"
              >
                <option value="">Selectionner...</option>
                {PROVINCE_OPTIONS.map(p => (
                  <option key={p.code} value={p.code}>{p.label} ({p.code})</option>
                ))}
              </select>
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className="flex flex-col gap-1 max-w-[80%]">
                  <div className={`rounded-2xl px-4 py-2 text-sm ${
                    msg.role === 'user'
                      ? 'bg-blue-600 text-white rounded-br-md'
                      : 'bg-muted rounded-bl-md'
                  }`}>
                    {msg.content}
                  </div>
                  {msg.role === 'assistant' && msg.id !== 'greeting' && (
                    <div className="flex items-center gap-1 px-1">
                      <button
                        onClick={() => speakMessage(msg.id, msg.content)}
                        disabled={loadingTtsId === msg.id}
                        className={`p-1 rounded-full transition-colors text-muted-foreground hover:text-blue-600 hover:bg-blue-50 disabled:opacity-50 ${
                          speakingMessageId === msg.id ? 'text-blue-600 bg-blue-50' : ''
                        }`}
                        aria-label={
                          loadingTtsId === msg.id
                            ? 'Chargement audio...'
                            : speakingMessageId === msg.id
                              ? 'Arrêter la lecture'
                              : 'Écouter ce message'
                        }
                        title={
                          loadingTtsId === msg.id
                            ? 'Chargement...'
                            : speakingMessageId === msg.id
                              ? 'Arrêter'
                              : 'Écouter'
                        }
                      >
                        {loadingTtsId === msg.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : speakingMessageId === msg.id ? (
                          <VolumeX className="h-3.5 w-3.5" />
                        ) : (
                          <Volume2 className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-2 text-sm">
                  <span className="animate-pulse">Aurélia réfléchit...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="border-t px-3 py-2 flex items-center gap-2">
            <button
              onClick={toggleVoice}
              className={`p-2 rounded-full transition-colors ${
                isListening ? 'bg-red-100 text-red-600 animate-pulse' : 'hover:bg-muted text-muted-foreground'
              }`}
              aria-label={isListening ? 'Arrêter l\'écoute' : 'Parler'}
            >
              {isListening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            </button>
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendMessage(input)}
              placeholder="Pose ta question..."
              className="flex-1 text-sm bg-muted rounded-full px-4 py-2 outline-none focus-visible:outline-2 focus-visible:outline-blue-500"
              aria-label="Message pour Aurélia"
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || isLoading}
              className="p-2 text-blue-600 hover:bg-blue-50 rounded-full disabled:opacity-30"
              aria-label="Envoyer"
            >
              <Send className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
