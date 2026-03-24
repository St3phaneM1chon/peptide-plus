'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useTranslations } from '@/hooks/useTranslations';

// ── Badge category types ──
type BadgeCategory = 'course' | 'quiz' | 'streak' | 'community' | 'special';

interface Badge {
  id: string;
  category: BadgeCategory;
  iconPath: string;
  criteria: number;
  color: string;
  bgColor: string;
}

// ── Badge definitions (30 badges across 5 categories) ──
const allBadges: Badge[] = [
  // Course completion badges
  { id: 'firstCourse', category: 'course', iconPath: 'M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5', criteria: 1, color: 'text-blue-600', bgColor: 'bg-blue-100' },
  { id: 'fiveCourses', category: 'course', iconPath: 'M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5', criteria: 5, color: 'text-blue-700', bgColor: 'bg-blue-100' },
  { id: 'tenCourses', category: 'course', iconPath: 'M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5', criteria: 10, color: 'text-blue-800', bgColor: 'bg-blue-200' },
  { id: 'allChapters', category: 'course', iconPath: 'M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25', criteria: 1, color: 'text-indigo-600', bgColor: 'bg-indigo-100' },
  { id: 'speedLearner', category: 'course', iconPath: 'M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z', criteria: 1, color: 'text-yellow-600', bgColor: 'bg-yellow-100' },
  { id: 'perfectLesson', category: 'course', iconPath: 'M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z', criteria: 1, color: 'text-amber-600', bgColor: 'bg-amber-100' },

  // Quiz mastery badges
  { id: 'firstQuiz', category: 'quiz', iconPath: 'M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z', criteria: 1, color: 'text-green-600', bgColor: 'bg-green-100' },
  { id: 'quizAce', category: 'quiz', iconPath: 'M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z', criteria: 10, color: 'text-green-700', bgColor: 'bg-green-100' },
  { id: 'perfectScore', category: 'quiz', iconPath: 'M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 002.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 012.916.52 6.003 6.003 0 01-5.395 4.972m0 0a6.726 6.726 0 01-2.749 1.35m0 0a6.772 6.772 0 01-3.044 0', criteria: 1, color: 'text-emerald-600', bgColor: 'bg-emerald-100' },
  { id: 'conceptMaster', category: 'quiz', iconPath: 'M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z', criteria: 25, color: 'text-teal-600', bgColor: 'bg-teal-100' },
  { id: 'reviewChamp', category: 'quiz', iconPath: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15', criteria: 50, color: 'text-cyan-600', bgColor: 'bg-cyan-100' },
  { id: 'diagnosticPro', category: 'quiz', iconPath: 'M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6', criteria: 1, color: 'text-violet-600', bgColor: 'bg-violet-100' },

  // Streak badges
  { id: 'streak3', category: 'streak', iconPath: 'M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z', criteria: 3, color: 'text-orange-500', bgColor: 'bg-orange-100' },
  { id: 'streak7', category: 'streak', iconPath: 'M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z', criteria: 7, color: 'text-orange-600', bgColor: 'bg-orange-100' },
  { id: 'streak14', category: 'streak', iconPath: 'M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z', criteria: 14, color: 'text-red-500', bgColor: 'bg-red-100' },
  { id: 'streak30', category: 'streak', iconPath: 'M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z', criteria: 30, color: 'text-red-600', bgColor: 'bg-red-200' },
  { id: 'streak100', category: 'streak', iconPath: 'M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z', criteria: 100, color: 'text-red-700', bgColor: 'bg-red-200' },
  { id: 'weekendWarrior', category: 'streak', iconPath: 'M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5', criteria: 4, color: 'text-pink-600', bgColor: 'bg-pink-100' },

  // Community badges
  { id: 'firstNote', category: 'community', iconPath: 'M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10', criteria: 1, color: 'text-purple-600', bgColor: 'bg-purple-100' },
  { id: 'helpfulReview', category: 'community', iconPath: 'M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z', criteria: 1, color: 'text-purple-500', bgColor: 'bg-purple-100' },
  { id: 'roleplayPro', category: 'community', iconPath: 'M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z', criteria: 5, color: 'text-fuchsia-600', bgColor: 'bg-fuchsia-100' },
  { id: 'teamPlayer', category: 'community', iconPath: 'M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z', criteria: 1, color: 'text-violet-600', bgColor: 'bg-violet-100' },
  { id: 'aureliaFriend', category: 'community', iconPath: 'M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z', criteria: 20, color: 'text-indigo-600', bgColor: 'bg-indigo-100' },
  { id: 'flashcardNinja', category: 'community', iconPath: 'M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 00-1.883 2.542l.857 6a2.25 2.25 0 002.227 1.932H19.05a2.25 2.25 0 002.227-1.932l.857-6a2.25 2.25 0 00-1.883-2.542m-16.5 0V6A2.25 2.25 0 016 3.75h3.879a1.5 1.5 0 011.06.44l2.122 2.12a1.5 1.5 0 001.06.44H18A2.25 2.25 0 0120.25 9v.776', criteria: 100, color: 'text-sky-600', bgColor: 'bg-sky-100' },

  // Special badges
  { id: 'earlyAdopter', category: 'special', iconPath: 'M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z', criteria: 1, color: 'text-yellow-500', bgColor: 'bg-yellow-100' },
  { id: 'nightOwl', category: 'special', iconPath: 'M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z', criteria: 5, color: 'text-slate-600', bgColor: 'bg-slate-100' },
  { id: 'explorer', category: 'special', iconPath: 'M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z', criteria: 1, color: 'text-emerald-600', bgColor: 'bg-emerald-100' },
  { id: 'compliance', category: 'special', iconPath: 'M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z', criteria: 1, color: 'text-blue-600', bgColor: 'bg-blue-100' },
  { id: 'dedicatedLearner', category: 'special', iconPath: 'M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5', criteria: 100, color: 'text-gold-600', bgColor: 'bg-amber-100' },
  { id: 'ufcComplete', category: 'special', iconPath: 'M11.35 3.836c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m8.9-4.414c.376.023.75.05 1.124.08 1.131.094 1.976 1.057 1.976 2.192V16.5A2.25 2.25 0 0118 18.75h-2.25m-7.5-10.5H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V18.75m-7.5-10.5h6.375c.621 0 1.125.504 1.125 1.125v9.375m-8.25-3l1.5 1.5 3-3.75', criteria: 30, color: 'text-blue-700', bgColor: 'bg-blue-200' },
];

// ── Simulated user progress (in real app, fetched from API) ──
const userProgress = {
  totalPoints: 2450,
  earnedBadgeIds: new Set(['firstCourse', 'firstQuiz', 'streak3', 'streak7', 'firstNote', 'earlyAdopter', 'explorer']),
  earnedDates: {
    firstCourse: '2026-03-10',
    firstQuiz: '2026-03-11',
    streak3: '2026-03-13',
    streak7: '2026-03-17',
    firstNote: '2026-03-12',
    earlyAdopter: '2026-03-10',
    explorer: '2026-03-15',
  } as Record<string, string>,
  coursesCompleted: 2,
  quizzesPassed: 4,
  currentStreak: 8,
  conceptsMastered: 12,
  reviewsDone: 18,
  notesCreated: 7,
  roleplaysDone: 2,
  aureliaQuestions: 15,
  flashcardsReviewed: 45,
  hoursStudied: 22,
};

// ── Leaderboard data (simulated team data) ──
const leaderboard = [
  { team: 'equipe-alpha', points: 12850, members: 6 },
  { team: 'equipe-bravo', points: 11200, members: 5 },
  { team: 'equipe-charlie', points: 9780, members: 7 },
  { team: 'equipe-delta', points: 8450, members: 4 },
  { team: 'equipe-echo', points: 7120, members: 6 },
];

const categoryOrder: BadgeCategory[] = ['course', 'quiz', 'streak', 'community', 'special'];

const categoryColors: Record<BadgeCategory, string> = {
  course: 'from-blue-500 to-indigo-500',
  quiz: 'from-green-500 to-emerald-500',
  streak: 'from-orange-500 to-red-500',
  community: 'from-purple-500 to-fuchsia-500',
  special: 'from-yellow-500 to-amber-500',
};

export default function AchievementsPage() {
  const { t } = useTranslations();
  const [selectedCategory, setSelectedCategory] = useState<BadgeCategory | 'all'>('all');

  const filteredBadges = useMemo(() => {
    if (selectedCategory === 'all') return allBadges;
    return allBadges.filter((b) => b.category === selectedCategory);
  }, [selectedCategory]);

  const earnedCount = allBadges.filter((b) => userProgress.earnedBadgeIds.has(b.id)).length;
  const totalCount = allBadges.length;

  // Compute progress for a specific badge
  const getBadgeProgress = (badge: Badge): { current: number; max: number } => {
    switch (badge.category) {
      case 'course':
        if (badge.id === 'allChapters' || badge.id === 'speedLearner' || badge.id === 'perfectLesson') return { current: userProgress.coursesCompleted, max: badge.criteria };
        return { current: userProgress.coursesCompleted, max: badge.criteria };
      case 'quiz':
        if (badge.id === 'conceptMaster') return { current: userProgress.conceptsMastered, max: badge.criteria };
        if (badge.id === 'reviewChamp') return { current: userProgress.reviewsDone, max: badge.criteria };
        return { current: userProgress.quizzesPassed, max: badge.criteria };
      case 'streak':
        if (badge.id === 'weekendWarrior') return { current: 2, max: badge.criteria };
        return { current: userProgress.currentStreak, max: badge.criteria };
      case 'community':
        if (badge.id === 'firstNote') return { current: userProgress.notesCreated, max: badge.criteria };
        if (badge.id === 'roleplayPro') return { current: userProgress.roleplaysDone, max: badge.criteria };
        if (badge.id === 'aureliaFriend') return { current: userProgress.aureliaQuestions, max: badge.criteria };
        if (badge.id === 'flashcardNinja') return { current: userProgress.flashcardsReviewed, max: badge.criteria };
        return { current: 1, max: badge.criteria };
      case 'special':
        if (badge.id === 'dedicatedLearner') return { current: Math.round(userProgress.hoursStudied), max: badge.criteria };
        if (badge.id === 'ufcComplete') return { current: 12, max: badge.criteria };
        return { current: userProgress.earnedBadgeIds.has(badge.id) ? 1 : 0, max: badge.criteria };
      default:
        return { current: 0, max: badge.criteria };
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('fr-CA', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero */}
      <section className="bg-[#143C78] text-white py-12 md:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <Link
            href="/learn"
            className="inline-flex items-center text-sm text-blue-200 hover:text-white mb-4 transition-colors"
          >
            <svg className="w-4 h-4 mr-1 rtl:mr-0 rtl:ml-1 rtl:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            {t('learn.backToLearning')}
          </Link>
          <h1 className="text-3xl md:text-4xl font-bold mb-3">
            {t('learn.achievements.title')}
          </h1>
          <p className="text-lg text-blue-200 max-w-2xl mx-auto">
            {t('learn.achievements.subtitle')}
          </p>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        {/* Stats overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-xl shadow-sm p-5 text-center">
            <div className="text-3xl font-bold text-blue-600">{userProgress.totalPoints}</div>
            <div className="text-sm text-gray-500 mt-1">{t('learn.achievements.totalPoints')}</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-5 text-center">
            <div className="text-3xl font-bold text-green-600">{earnedCount}/{totalCount}</div>
            <div className="text-sm text-gray-500 mt-1">{t('learn.achievements.badgesEarned')}</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-5 text-center">
            <div className="text-3xl font-bold text-orange-600">{userProgress.currentStreak}</div>
            <div className="text-sm text-gray-500 mt-1">{t('learn.achievements.currentStreak')}</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-5 text-center">
            <div className="text-3xl font-bold text-purple-600">{userProgress.hoursStudied}h</div>
            <div className="text-sm text-gray-500 mt-1">{t('learn.achievements.hoursStudied')}</div>
          </div>
        </div>

        {/* Progress bar overall */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-8">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-gray-900">{t('learn.achievements.overallProgress')}</h3>
            <span className="text-sm text-gray-500">{Math.round((earnedCount / totalCount) * 100)}%</span>
          </div>
          <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-500"
              style={{ width: `${(earnedCount / totalCount) * 100}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 mt-2">
            {t('learn.achievements.progressDesc', { earned: earnedCount, total: totalCount, remaining: totalCount - earnedCount })}
          </p>
        </div>

        {/* Category filter */}
        <div className="flex flex-wrap gap-2 mb-6">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              selectedCategory === 'all'
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {t('learn.achievements.allCategories')} ({totalCount})
          </button>
          {categoryOrder.map((cat) => {
            const count = allBadges.filter((b) => b.category === cat).length;
            const earned = allBadges.filter((b) => b.category === cat && userProgress.earnedBadgeIds.has(b.id)).length;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  selectedCategory === cat
                    ? 'bg-gray-900 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {t(`learn.achievements.category.${cat}`)} ({earned}/{count})
              </button>
            );
          })}
        </div>

        {/* Badges grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-12">
          {filteredBadges.map((badge) => {
            const isEarned = userProgress.earnedBadgeIds.has(badge.id);
            const earnedDate = userProgress.earnedDates[badge.id];
            const progress = getBadgeProgress(badge);
            const progressPct = Math.min(100, Math.round((progress.current / progress.max) * 100));

            return (
              <div
                key={badge.id}
                className={`bg-white rounded-xl shadow-sm overflow-hidden transition-all ${
                  isEarned ? 'ring-2 ring-blue-200 hover:shadow-md' : 'opacity-75 hover:opacity-100'
                }`}
              >
                <div className={`h-1.5 bg-gradient-to-r ${categoryColors[badge.category]}`} />
                <div className="p-5">
                  <div className="flex items-start gap-4">
                    {/* Badge icon */}
                    <div className={`relative w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      isEarned ? badge.bgColor : 'bg-gray-100'
                    }`}>
                      <svg
                        className={`w-7 h-7 ${isEarned ? badge.color : 'text-gray-300'}`}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={1.5}
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d={badge.iconPath} />
                      </svg>
                      {!isEarned && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <svg className="w-6 h-6 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                          </svg>
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className={`font-semibold text-sm ${isEarned ? 'text-gray-900' : 'text-gray-500'}`}>
                          {t(`learn.achievements.badge.${badge.id}.name`)}
                        </h3>
                        {isEarned && (
                          <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                      <p className={`text-xs mt-0.5 ${isEarned ? 'text-gray-600' : 'text-gray-400'}`}>
                        {t(`learn.achievements.badge.${badge.id}.desc`)}
                      </p>

                      {/* Progress or earned date */}
                      {isEarned && earnedDate ? (
                        <p className="text-xs text-green-600 mt-2 font-medium">
                          {t('learn.achievements.earnedOn', { date: formatDate(earnedDate) })}
                        </p>
                      ) : (
                        <div className="mt-2">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-gray-400">
                              {progress.current}/{progress.max}
                            </span>
                            <span className="text-xs text-gray-400">{progressPct}%</span>
                          </div>
                          <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full bg-gradient-to-r ${categoryColors[badge.category]} rounded-full transition-all`}
                              style={{ width: `${progressPct}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Leaderboard */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {t('learn.achievements.leaderboardTitle')}
          </h2>
          <p className="text-gray-600 mb-6">
            {t('learn.achievements.leaderboardSubtitle')}
          </p>

          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="divide-y divide-gray-100">
              {leaderboard.map((team, idx) => (
                <div
                  key={team.team}
                  className={`flex items-center gap-4 px-6 py-4 ${idx === 0 ? 'bg-yellow-50' : ''}`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                    idx === 0
                      ? 'bg-yellow-400 text-yellow-900'
                      : idx === 1
                        ? 'bg-gray-300 text-gray-700'
                        : idx === 2
                          ? 'bg-orange-300 text-orange-800'
                          : 'bg-gray-100 text-gray-500'
                  }`}>
                    {idx + 1}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 text-sm">
                      {t(`learn.achievements.leaderboard.${team.team}`)}
                    </h3>
                    <p className="text-xs text-gray-500">
                      {t('learn.achievements.memberCount', { count: team.members })}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-gray-900">{team.points.toLocaleString()}</span>
                    <span className="text-xs text-gray-500 ml-1">{t('learn.achievements.pts')}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Share / CTA */}
        <section className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-8 md:p-12 text-white text-center">
          <h2 className="text-2xl font-bold mb-3">
            {t('learn.achievements.shareTitle')}
          </h2>
          <p className="text-blue-100 mb-6 max-w-xl mx-auto">
            {t('learn.achievements.shareSubtitle')}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => {
                if (navigator.share) {
                  navigator.share({
                    title: t('learn.achievements.title'),
                    text: t('learn.achievements.shareText', { badges: earnedCount, points: userProgress.totalPoints }),
                    url: window.location.href,
                  }).catch(() => {});
                }
              }}
              className="px-8 py-3 bg-white text-purple-700 font-semibold rounded-lg hover:bg-purple-50 transition-colors"
            >
              {t('learn.achievements.shareProfile')}
            </button>
            <Link
              href="/learn/dashboard"
              className="px-8 py-3 border border-white/50 text-white font-semibold rounded-lg hover:bg-white/10 transition-colors"
            >
              {t('learn.achievements.backToDashboard')}
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
