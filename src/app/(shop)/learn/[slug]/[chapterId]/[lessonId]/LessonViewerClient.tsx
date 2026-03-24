'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useTranslations } from '@/hooks/useTranslations';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface SupplementaryText {
  title: string;
  content: string;
  source?: string;
}

interface LessonData {
  id: string;
  title: string;
  type: string;
  textContent: string | null;
  videoUrl: string | null;
  quizId: string | null;
  description: string | null;
  estimatedMinutes: number | null;
  // 4 volets contenu par notion
  manualText?: string | null;
  visualAnchorUrl?: string | null;
  visualAnchorAlt?: string | null;
  videoExplainerUrl?: string | null;
  videoExplainerDuration?: number | null;
  supplementaryTexts?: SupplementaryText[] | null;
}

interface ChapterData {
  id: string;
  title: string;
}

interface NavigationData {
  prev: { id: string; title: string; chapterId: string } | null;
  next: { id: string; title: string; chapterId: string } | null;
  currentIndex: number;
  totalLessons: number;
}

interface OutlineLesson {
  id: string;
  title: string;
  type: string;
  chapterId: string;
  estimatedMinutes: number | null;
  videoDuration: number | null;
}

interface OutlineChapter {
  id: string;
  title: string;
  lessons: OutlineLesson[];
}

interface Props {
  courseSlug: string;
  courseTitle: string;
  enrollmentId: string;
  lesson: LessonData;
  chapter: ChapterData;
  navigation: NavigationData;
  isCompleted: boolean;
  courseOutline?: OutlineChapter[];
  completedLessonIds?: string[];
  courseProgress?: number;
  totalEstimatedMinutes?: number;
  requireSequentialCompletion?: boolean;
}

/* ------------------------------------------------------------------ */
/*  Study Timer                                                        */
/* ------------------------------------------------------------------ */

function StudyTimer({ t }: { t: (k: string, p?: Record<string, string | number>) => string }) {
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [running]);

  const fmt = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return h > 0
      ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
      : `${m}:${String(sec).padStart(2, '0')}`;
  };

  return (
    <div className="flex items-center gap-2 text-sm">
      <button
        onClick={() => setRunning(!running)}
        className="p-1 rounded hover:bg-gray-100 transition-colors"
        title={running ? t('learn.lessonViewer.pauseTimer') : t('learn.lessonViewer.resumeTimer')}
        aria-label={running ? t('learn.lessonViewer.pauseTimer') : t('learn.lessonViewer.resumeTimer')}
      >
        {running ? (
          <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        ) : (
          <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )}
      </button>
      <span className="font-mono text-gray-600 tabular-nums" aria-live="off">
        {fmt(seconds)}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Notes Panel                                                        */
/* ------------------------------------------------------------------ */

function NotesPanel({
  lessonId,
  t,
  onClose,
}: {
  lessonId: string;
  t: (k: string, p?: Record<string, string | number>) => string;
  onClose: () => void;
}) {
  const storageKey = `lms-notes-${lessonId}`;
  const [notes, setNotes] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) setNotes(saved);
  }, [storageKey]);

  const handleSave = useCallback(() => {
    localStorage.setItem(storageKey, notes);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }, [storageKey, notes]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (notes) localStorage.setItem(storageKey, notes);
    }, 1000);
    return () => clearTimeout(timer);
  }, [notes, storageKey]);

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-4 w-full">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-900 text-sm flex items-center gap-2">
          <svg className="w-4 h-4 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          {t('learn.lessonViewer.myNotes')}
        </h3>
        <div className="flex items-center gap-2">
          {saved && (
            <span className="text-xs text-green-600">{t('learn.lessonViewer.notesSaved')}</span>
          )}
          <button
            onClick={handleSave}
            className="text-xs px-2 py-1 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 transition-colors"
          >
            {t('learn.lessonViewer.saveNotes')}
          </button>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label={t('learn.lessonViewer.closeNotes')}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        className="w-full h-48 p-3 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        placeholder={t('learn.lessonViewer.notesPlaceholder')}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

export default function LessonViewerClient({
  courseSlug,
  courseTitle,
  enrollmentId,
  lesson,
  chapter,
  navigation,
  isCompleted: initialCompleted,
  courseOutline = [],
  completedLessonIds = [],
  courseProgress = 0,
  totalEstimatedMinutes: _totalEstimatedMinutes = 0,
  requireSequentialCompletion = true,
}: Props) {
  const { t } = useTranslations();
  const [completed, setCompleted] = useState(initialCompleted);
  const [marking, setMarking] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [showAureliaWidget, setShowAureliaWidget] = useState(false);

  // Reading time estimate for text lessons
  const readingTime = lesson.estimatedMinutes || (lesson.textContent ? Math.max(1, Math.ceil(lesson.textContent.split(/\s+/).length / 200)) : null);

  const handleMarkComplete = async () => {
    setMarking(true);
    try {
      const res = await fetch('/api/lms/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enrollmentId,
          lessonId: lesson.id,
          isCompleted: true,
        }),
      });
      if (res.ok) {
        setCompleted(true);
      }
    } catch {
      // silent fail
    } finally {
      setMarking(false);
    }
  };

  // Simple markdown to HTML for text content
  const renderMarkdown = (md: string) => {
    return md
      .replace(/^### (.+)$/gm, '<h3 class="text-lg font-semibold text-gray-900 mt-6 mb-2">$1</h3>')
      .replace(/^## (.+)$/gm, '<h2 class="text-xl font-bold text-gray-900 mt-8 mb-3">$1</h2>')
      .replace(/^# (.+)$/gm, '<h1 class="text-2xl font-bold text-gray-900 mt-8 mb-4">$1</h1>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`(.+?)`/g, '<code class="bg-gray-100 px-1 py-0.5 rounded text-sm">$1</code>')
      .replace(/^- (.+)$/gm, '<li class="ml-4 list-disc text-gray-600">$1</li>')
      .replace(/^(\d+)\. (.+)$/gm, '<li class="ml-4 list-decimal text-gray-600">$2</li>')
      .replace(/\n\n/g, '</p><p class="text-gray-600 leading-relaxed mb-4">')
      .replace(/^/, '<p class="text-gray-600 leading-relaxed mb-4">')
      .replace(/$/, '</p>');
  };

  const lessonTypeIcon = (type: string) => {
    switch (type) {
      case 'VIDEO':
        return (
          <svg className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'QUIZ':
        return (
          <svg className="w-3.5 h-3.5 text-purple-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      default:
        return (
          <svg className="w-3.5 h-3.5 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Bar */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            {/* Sidebar toggle (mobile) */}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
              aria-label={t('learn.lessonViewer.toggleOutline')}
            >
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <Link
              href={`/learn/${courseSlug}`}
              className="flex items-center gap-1 text-gray-500 hover:text-gray-900 text-sm flex-shrink-0"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              <span className="hidden sm:inline">{t('learn.lessonViewer.backToCourse')}</span>
            </Link>
            <span className="text-gray-300 hidden sm:inline">|</span>
            <span className="text-sm text-gray-500 truncate hidden sm:inline">{courseTitle}</span>
          </div>

          <div className="flex items-center gap-4">
            {/* Course Progress Bar */}
            <div className="hidden md:flex items-center gap-2">
              <div className="w-32 bg-gray-200 rounded-full h-1.5">
                <div
                  className="bg-green-500 h-1.5 rounded-full transition-all duration-500"
                  style={{ width: `${courseProgress}%` }}
                />
              </div>
              <span className="text-xs text-gray-500 whitespace-nowrap">{courseProgress}%</span>
            </div>

            {/* Study Timer */}
            <div className="hidden sm:block">
              <StudyTimer t={t} />
            </div>

            {/* Lesson counter */}
            <span className="text-sm text-gray-400 flex-shrink-0">
              {t('learn.lessonViewer.lessonOf', {
                current: navigation.currentIndex,
                total: navigation.totalLessons,
              })}
            </span>
          </div>
        </div>
      </div>

      <div className="flex max-w-screen-2xl mx-auto">
        {/* ---------------------------------------------------------- */}
        {/*  Sidebar: Course Outline                                     */}
        {/* ---------------------------------------------------------- */}
        {courseOutline.length > 0 && (
          <>
            {/* Mobile overlay */}
            {sidebarOpen && (
              <div
                className="fixed inset-0 bg-black/30 z-20 lg:hidden"
                onClick={() => setSidebarOpen(false)}
              />
            )}

            <aside
              className={`fixed lg:sticky top-[49px] lg:top-[49px] left-0 z-20 h-[calc(100vh-49px)] w-72 bg-white border-r border-gray-200 overflow-y-auto transition-transform lg:transition-none lg:translate-x-0 ${
                sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
              }`}
            >
              <div className="p-4 border-b border-gray-100">
                <h2 className="font-semibold text-gray-900 text-sm truncate">{courseTitle}</h2>
                <div className="flex items-center gap-2 mt-2">
                  <div className="flex-1 bg-gray-200 rounded-full h-1.5">
                    <div
                      className="bg-green-500 h-1.5 rounded-full transition-all duration-500"
                      style={{ width: `${courseProgress}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-500">{courseProgress}%</span>
                </div>
              </div>

              <nav className="py-2" aria-label={t('learn.lessonViewer.courseOutline')}>
                {courseOutline.map((ch, ci) => {
                  // Build flat ordered list for sequential gate
                  const allOutlineLessons = courseOutline.flatMap(c => c.lessons);
                  return (
                  <div key={ch.id}>
                    <div className="px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      {ci + 1}. {ch.title}
                    </div>
                    <ul>
                      {ch.lessons.map((ol) => {
                        const isCurrent = ol.id === lesson.id;
                        const isDone = completedLessonIds.includes(ol.id);

                        // Sequential gate: check if previous lesson is completed
                        const globalIndex = allOutlineLessons.findIndex(l => l.id === ol.id);
                        const isLocked = requireSequentialCompletion && globalIndex > 0 &&
                          !completedLessonIds.includes(allOutlineLessons[globalIndex - 1].id) &&
                          !isCurrent && !isDone;

                        if (isLocked) {
                          return (
                            <li key={ol.id}>
                              <div className="flex items-center gap-2 px-4 py-2 text-sm text-gray-400 cursor-not-allowed" title="Completez la lecon precedente d'abord">
                                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                                <span className="truncate">{ol.title}</span>
                              </div>
                            </li>
                          );
                        }

                        return (
                          <li key={ol.id}>
                            <Link
                              href={`/learn/${courseSlug}/${ol.chapterId}/${ol.id}`}
                              onClick={() => setSidebarOpen(false)}
                              className={`flex items-center gap-2 px-4 py-2 text-sm transition-colors ${
                                isCurrent
                                  ? 'bg-blue-50 text-blue-700 font-medium border-l-2 border-blue-600'
                                  : isDone
                                    ? 'text-gray-500 hover:bg-gray-50'
                                    : 'text-gray-700 hover:bg-gray-50'
                              }`}
                            >
                              {isDone ? (
                                <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                              ) : isCurrent ? (
                                <div className="w-4 h-4 rounded-full border-2 border-blue-600 flex items-center justify-center flex-shrink-0">
                                  <div className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                                </div>
                              ) : (
                                lessonTypeIcon(ol.type)
                              )}
                              <span className={`truncate ${isDone && !isCurrent ? 'line-through' : ''}`}>
                                {ol.title}
                              </span>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                  );
                })}
              </nav>
            </aside>
          </>
        )}

        {/* ---------------------------------------------------------- */}
        {/*  Main content                                                */}
        {/* ---------------------------------------------------------- */}
        <main className="flex-1 min-w-0">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {/* Chapter / Lesson Header */}
            <div className="mb-6">
              <div className="flex items-center gap-3 flex-wrap mb-1">
                <p className="text-sm text-blue-600 font-medium">
                  {t('learn.lessonViewer.chapterProgress', { chapter: chapter.title })}
                </p>
                {readingTime && (
                  <span className="text-xs text-gray-400 flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {t('learn.lessonViewer.estimatedTime', { minutes: readingTime })}
                  </span>
                )}
              </div>
              <h1 className="text-2xl font-bold text-gray-900">{lesson.title}</h1>
              {lesson.description && (
                <p className="text-gray-500 mt-1">{lesson.description}</p>
              )}
            </div>

            {/* Toolbar */}
            <div className="flex items-center gap-2 mb-4 flex-wrap">
              <button
                onClick={() => setNotesOpen(!notesOpen)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                  notesOpen
                    ? 'bg-yellow-50 border-yellow-300 text-yellow-700'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                {t('learn.lessonViewer.takeNotes')}
              </button>
              <button
                onClick={() => setShowAureliaWidget(!showAureliaWidget)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                  showAureliaWidget
                    ? 'bg-purple-50 border-purple-300 text-purple-700'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
                {t('learn.lessonViewer.askAurelia')}
              </button>
              <div className="sm:hidden ml-auto">
                <StudyTimer t={t} />
              </div>
            </div>

            {/* Notes Panel (collapsible) */}
            {notesOpen && (
              <div className="mb-6">
                <NotesPanel lessonId={lesson.id} t={t} onClose={() => setNotesOpen(false)} />
              </div>
            )}

            {/* Aurelia Widget (collapsible) */}
            {showAureliaWidget && (
              <div className="mb-6 bg-gradient-to-br from-purple-50 to-blue-50 border border-purple-200 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-purple-900 text-sm flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-purple-500 flex items-center justify-center text-white text-xs font-bold">A</span>
                    {t('learn.lessonViewer.aureliaTitle')}
                  </h3>
                  <button onClick={() => setShowAureliaWidget(false)} className="text-purple-400 hover:text-purple-600" aria-label={t('learn.lessonViewer.closeAurelia')}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <p className="text-sm text-purple-700 mb-3">{t('learn.lessonViewer.aureliaContext', { lesson: lesson.title })}</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    className="flex-1 px-3 py-2 border border-purple-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white"
                    placeholder={t('learn.lessonViewer.aureliaPlaceholder')}
                  />
                  <button className="px-4 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 transition-colors">
                    {t('learn.lessonViewer.aureliaSend')}
                  </button>
                </div>
                <p className="text-xs text-purple-500 mt-2">{t('learn.lessonViewer.aureliaDisclaimer')}</p>
              </div>
            )}

            {/* Content Area */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-8">
              {lesson.type === 'VIDEO' && lesson.videoUrl && (
                <div className="aspect-video bg-black">
                  <iframe
                    src={lesson.videoUrl}
                    className="w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    title={lesson.title}
                  />
                </div>
              )}

              {lesson.type === 'TEXT' && lesson.textContent && (
                <div className="p-6 md:p-8">
                  <div
                    className="prose prose-gray max-w-none"
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(lesson.textContent) }}
                  />
                </div>
              )}

              {/* ── 4 VOLETS CONTENU PAR NOTION ── */}
              {(lesson.manualText || lesson.visualAnchorUrl || lesson.videoExplainerUrl || (lesson.supplementaryTexts && lesson.supplementaryTexts.length > 0)) && (
                <div className="p-6 md:p-8 space-y-6 border-t border-gray-100">
                  {/* Volet 1: Texte du manuel */}
                  {lesson.manualText && (
                    <div>
                      <h3 className="text-sm font-semibold uppercase tracking-wide text-blue-600 mb-3 flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                        Texte du manuel
                      </h3>
                      <div className="bg-blue-50 dark:bg-blue-950/20 rounded-lg p-5 border border-blue-100 dark:border-blue-900">
                        <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: renderMarkdown(lesson.manualText) }} />
                      </div>
                    </div>
                  )}

                  {/* Volet 2: Ancre visuel */}
                  {lesson.visualAnchorUrl && (
                    <div>
                      <h3 className="text-sm font-semibold uppercase tracking-wide text-emerald-600 mb-3 flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                        Ancre visuel
                      </h3>
                      <div className="bg-emerald-50 dark:bg-emerald-950/20 rounded-lg p-4 border border-emerald-100 dark:border-emerald-900 text-center">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={lesson.visualAnchorUrl}
                          alt={lesson.visualAnchorAlt ?? `Ancre visuel — ${lesson.title}`}
                          className="max-w-full rounded-lg mx-auto"
                        />
                      </div>
                    </div>
                  )}

                  {/* Volet 3: Video explicative */}
                  {lesson.videoExplainerUrl && (
                    <div>
                      <h3 className="text-sm font-semibold uppercase tracking-wide text-purple-600 mb-3 flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        Video explicative
                        {lesson.videoExplainerDuration && (
                          <span className="text-xs font-normal text-purple-400">({Math.ceil(lesson.videoExplainerDuration / 60)} min)</span>
                        )}
                      </h3>
                      <div className="bg-purple-50 dark:bg-purple-950/20 rounded-lg overflow-hidden border border-purple-100 dark:border-purple-900">
                        <div className="relative w-full" style={{ paddingTop: '56.25%' }}>
                          <iframe
                            className="absolute inset-0 w-full h-full"
                            src={lesson.videoExplainerUrl}
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                            title={`Video — ${lesson.title}`}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Volet 4: Textes complementaires */}
                  {lesson.supplementaryTexts && lesson.supplementaryTexts.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold uppercase tracking-wide text-amber-600 mb-3 flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                        Textes complementaires
                      </h3>
                      <div className="space-y-3">
                        {lesson.supplementaryTexts.map((text, i) => (
                          <details key={i} className="bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-100 dark:border-amber-900 group">
                            <summary className="p-4 cursor-pointer font-medium text-sm flex items-center justify-between hover:bg-amber-100/50 dark:hover:bg-amber-900/30 rounded-lg transition-colors">
                              {text.title}
                              <svg className="w-4 h-4 transform group-open:rotate-180 transition-transform text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                            </summary>
                            <div className="px-4 pb-4">
                              <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: renderMarkdown(text.content) }} />
                              {text.source && (
                                <p className="text-xs text-amber-500 mt-2 italic">Source: {text.source}</p>
                              )}
                            </div>
                          </details>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {lesson.type === 'QUIZ' && lesson.quizId && (
                <div className="p-6 md:p-8 text-center">
                  <svg className="w-16 h-16 text-purple-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <h2 className="text-xl font-bold text-gray-900 mb-2">{t('learn.lessonViewer.quizLesson')}</h2>
                  <p className="text-gray-500 mb-6">{lesson.description || t('lms.quiz.title')}</p>
                  <Link
                    href={`/learn/${courseSlug}/${chapter.id}/${lesson.id}/quiz`}
                    className="inline-flex items-center px-6 py-3 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 transition-colors"
                  >
                    {t('learn.lessonViewer.takeQuiz')}
                  </Link>
                </div>
              )}

              {/* Fallback for other lesson types */}
              {!['VIDEO', 'TEXT', 'QUIZ'].includes(lesson.type) && (
                <div className="p-6 md:p-8 text-center text-gray-500">
                  <p>{lesson.description || lesson.title}</p>
                </div>
              )}
            </div>

            {/* Mark Complete + Navigation */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white rounded-xl border border-gray-200 p-4">
              {/* Mark Complete */}
              <div>
                {completed ? (
                  <span className="inline-flex items-center gap-2 text-green-600 font-medium">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    {t('learn.lessonViewer.markedComplete')}
                  </span>
                ) : (
                  <button
                    onClick={handleMarkComplete}
                    disabled={marking}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                  >
                    {marking ? (
                      <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                    {t('learn.lessonViewer.markComplete')}
                  </button>
                )}
              </div>

              {/* Navigation */}
              <div className="flex items-center gap-3">
                {navigation.prev && (
                  <Link
                    href={`/learn/${courseSlug}/${navigation.prev.chapterId}/${navigation.prev.id}`}
                    className="inline-flex items-center gap-1 px-4 py-2.5 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors text-sm"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    {t('learn.lessonViewer.previousLesson')}
                  </Link>
                )}
                {navigation.next ? (
                  <Link
                    href={`/learn/${courseSlug}/${navigation.next.chapterId}/${navigation.next.id}`}
                    className="inline-flex items-center gap-1 px-4 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors text-sm"
                  >
                    {t('learn.lessonViewer.nextLesson')}
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                ) : completed ? (
                  <Link
                    href={`/learn/${courseSlug}/complete`}
                    className="inline-flex items-center gap-1 px-4 py-2.5 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors text-sm"
                  >
                    {t('learn.lessonViewer.finishCourse')}
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </Link>
                ) : null}
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Floating Ask Aurelia button (always visible, bottom-right) */}
      {!showAureliaWidget && (
        <button
          onClick={() => {
            setShowAureliaWidget(true);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className="fixed bottom-6 right-6 z-40 w-12 h-12 bg-purple-600 text-white rounded-full shadow-lg hover:bg-purple-700 hover:scale-105 transition-all flex items-center justify-center"
          title={t('learn.lessonViewer.askAurelia')}
          aria-label={t('learn.lessonViewer.askAurelia')}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
        </button>
      )}
    </div>
  );
}
