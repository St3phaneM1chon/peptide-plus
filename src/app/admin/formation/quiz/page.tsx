'use client';

import { useState, useEffect, useCallback, type FormEvent } from 'react';
import { useTranslations } from '@/hooks/useTranslations';
import {
  PageHeader,
  Button,
  DataTable,
  EmptyState,
  Modal,
  SectionCard,
  FormField,
  Input,
  Textarea,
  StatusBadge,
  type Column,
} from '@/components/admin';
import {
  Plus,
  FileQuestion,
  Trash2,
  Pencil,
  ChevronUp,
  ChevronDown,
  GripVertical,
  Eye,
  Save,
  ArrowLeft,
  X,
  Copy,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from 'lucide-react';

/* ─────────── Types ─────────── */

type QuestionType = 'MULTIPLE_CHOICE' | 'TRUE_FALSE' | 'FILL_IN' | 'MATCHING' | 'ORDERING';

interface QuizOption {
  id: string;
  text: string;
  isCorrect: boolean;
}

interface MatchingPair {
  left: string;
  right: string;
}

interface QuestionData {
  _uid: string; // client-side unique key
  id?: string;
  type: QuestionType;
  question: string;
  explanation: string;
  points: number;
  sortOrder: number;
  bloomLevel: number;
  options: QuizOption[];
  correctAnswer: string;
  caseSensitive: boolean;
  acceptVariants: boolean;
  matchingPairs: MatchingPair[];
  orderingItems: string[];
}

interface QuizRow {
  id: string;
  title: string;
  description: string | null;
  timeLimit: number | null;
  maxAttempts: number;
  passingScore: number;
  shuffleQuestions: boolean;
  showResults: boolean;
  createdAt: string;
  updatedAt: string;
  _count: { questions: number; attempts: number };
  lesson: {
    id: string;
    title: string;
    chapter: { course: { title: string } };
  } | null;
}

interface QuizDetail extends QuizRow {
  questions: Array<{
    id: string;
    type: QuestionType;
    question: string;
    explanation: string | null;
    points: number;
    sortOrder: number;
    options: QuizOption[] | unknown;
    correctAnswer: string | null;
    caseSensitive: boolean;
    matchingPairs: MatchingPair[] | null;
  }>;
}

/* ─────────── Helpers ─────────── */

const BLOOM_LABELS: Record<number, { en: string; fr: string }> = {
  1: { en: 'Remember', fr: 'Memoriser' },
  2: { en: 'Understand', fr: 'Comprendre' },
  3: { en: 'Apply', fr: 'Appliquer' },
  4: { en: 'Analyze', fr: 'Analyser' },
  5: { en: 'Evaluate/Create', fr: 'Evaluer/Creer' },
};

function uid(): string {
  return `q_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function createEmptyQuestion(sortOrder: number): QuestionData {
  return {
    _uid: uid(),
    type: 'MULTIPLE_CHOICE',
    question: '',
    explanation: '',
    points: 1,
    sortOrder,
    bloomLevel: 1,
    options: [
      { id: 'a', text: '', isCorrect: true },
      { id: 'b', text: '', isCorrect: false },
    ],
    correctAnswer: '',
    caseSensitive: false,
    acceptVariants: false,
    matchingPairs: [{ left: '', right: '' }],
    orderingItems: [''],
  };
}

const selectClass =
  'w-full h-9 px-3 rounded-lg border border-slate-300 text-sm text-[var(--k-text-primary)] bg-white/5 focus:outline-none focus:ring-2 focus:ring-indigo-700 focus:border-indigo-700 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100';

/* ═══════════════════════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════════════════════ */

export default function QuizBuilderPage() {
  const { t } = useTranslations();

  // ── View Mode ──
  const [mode, setMode] = useState<'list' | 'builder'>('list');
  const [editingQuizId, setEditingQuizId] = useState<string | null>(null);

  // ── List state ──
  const [quizzes, setQuizzes] = useState<QuizRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState('');

  // ── Builder state ──
  const [quizTitle, setQuizTitle] = useState('');
  const [quizDescription, setQuizDescription] = useState('');
  const [passingScore, setPassingScore] = useState(70);
  const [maxAttempts, setMaxAttempts] = useState(3);
  const [timeLimit, setTimeLimit] = useState<number | ''>('');
  const [shuffleQuestions, setShuffleQuestions] = useState(false);
  const [showResults, setShowResults] = useState(true);
  const [questions, setQuestions] = useState<QuestionData[]>([createEmptyQuestion(0)]);
  const [saving, setSaving] = useState(false);
  const [builderError, setBuilderError] = useState('');
  const [builderSuccess, setBuilderSuccess] = useState('');

  // ── Preview state ──
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewAnswers, setPreviewAnswers] = useState<Record<string, string | string[]>>({});
  const [previewSubmitted, setPreviewSubmitted] = useState(false);

  // ── Delete confirmation ──
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  /* ─────────── Data fetching ─────────── */

  const fetchQuizzes = useCallback(async () => {
    setListLoading(true);
    setListError('');
    try {
      const res = await fetch(`/api/admin/lms/quizzes?page=${page}&limit=20`);
      if (!res.ok) throw new Error('Failed to load quizzes');
      const data = await res.json();
      const payload = data.data ?? data;
      setQuizzes(payload.quizzes ?? []);
      setTotal(payload.total ?? 0);
    } catch (err) {
      setListError(err instanceof Error ? err.message : t('admin.lms.quiz.loadError'));
      setQuizzes([]);
    } finally {
      setListLoading(false);
    }
  }, [page, t]);

  useEffect(() => {
    if (mode === 'list') fetchQuizzes();
  }, [mode, fetchQuizzes]);

  /* ─────────── Load quiz for editing ─────────── */

  const loadQuizForEdit = useCallback(async (quizId: string) => {
    try {
      const res = await fetch(`/api/admin/lms/quizzes/${quizId}`);
      if (!res.ok) throw new Error('Failed to load quiz');
      const data = await res.json();
      const quiz: QuizDetail = data.data ?? data;

      setEditingQuizId(quiz.id);
      setQuizTitle(quiz.title);
      setQuizDescription(quiz.description ?? '');
      setPassingScore(quiz.passingScore);
      setMaxAttempts(quiz.maxAttempts);
      setTimeLimit(quiz.timeLimit ?? '');
      setShuffleQuestions(quiz.shuffleQuestions);
      setShowResults(quiz.showResults);

      if (quiz.questions && quiz.questions.length > 0) {
        setQuestions(
          quiz.questions.map((q) => {
            const opts = Array.isArray(q.options) ? (q.options as QuizOption[]) : [];
            const pairs = Array.isArray(q.matchingPairs)
              ? (q.matchingPairs as MatchingPair[])
              : [];

            // Derive ordering items from options for ORDERING type
            const orderingItems =
              q.type === 'ORDERING' ? opts.map((o) => o.text) : [''];

            return {
              _uid: uid(),
              id: q.id,
              type: q.type,
              question: q.question,
              explanation: q.explanation ?? '',
              points: q.points,
              sortOrder: q.sortOrder,
              bloomLevel: 1,
              options: opts.length > 0 ? opts : [
                { id: 'a', text: '', isCorrect: true },
                { id: 'b', text: '', isCorrect: false },
              ],
              correctAnswer: q.correctAnswer ?? '',
              caseSensitive: q.caseSensitive,
              acceptVariants: false,
              matchingPairs: pairs.length > 0 ? pairs : [{ left: '', right: '' }],
              orderingItems: orderingItems.length > 0 ? orderingItems : [''],
            };
          })
        );
      } else {
        setQuestions([createEmptyQuestion(0)]);
      }

      setMode('builder');
    } catch {
      setListError(t('admin.lms.quiz.loadError'));
    }
  }, [t]);

  /* ─────────── Reset builder ─────────── */

  const resetBuilder = useCallback(() => {
    setEditingQuizId(null);
    setQuizTitle('');
    setQuizDescription('');
    setPassingScore(70);
    setMaxAttempts(3);
    setTimeLimit('');
    setShuffleQuestions(false);
    setShowResults(true);
    setQuestions([createEmptyQuestion(0)]);
    setBuilderError('');
    setBuilderSuccess('');
  }, []);

  /* ─────────── Save quiz ─────────── */

  const handleSave = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!quizTitle.trim()) return;

    setSaving(true);
    setBuilderError('');
    setBuilderSuccess('');

    // Build questions payload
    const questionsPayload = questions
      .filter((q) => q.question.trim())
      .map((q, i) => {
        const base: Record<string, unknown> = {
          type: q.type,
          question: q.question.trim(),
          explanation: q.explanation.trim() || undefined,
          points: q.points,
          sortOrder: i,
        };

        switch (q.type) {
          case 'MULTIPLE_CHOICE':
            base.options = q.options.filter((o) => o.text.trim());
            break;
          case 'TRUE_FALSE':
            base.options = [
              { id: 'true', text: 'True', isCorrect: q.correctAnswer === 'true' },
              { id: 'false', text: 'False', isCorrect: q.correctAnswer === 'false' },
            ];
            base.correctAnswer = q.correctAnswer;
            break;
          case 'FILL_IN':
            base.correctAnswer = q.correctAnswer;
            base.caseSensitive = q.caseSensitive;
            break;
          case 'MATCHING':
            base.matchingPairs = q.matchingPairs.filter((p) => p.left.trim() && p.right.trim());
            break;
          case 'ORDERING':
            base.options = q.orderingItems
              .filter((item) => item.trim())
              .map((item, idx) => ({
                id: String(idx),
                text: item,
                isCorrect: true,
              }));
            break;
        }

        return base;
      });

    const body: Record<string, unknown> = {
      title: quizTitle.trim(),
      description: quizDescription.trim() || undefined,
      passingScore,
      maxAttempts,
      timeLimit: timeLimit || undefined,
      shuffleQuestions,
      showResults,
      questions: questionsPayload,
    };

    try {
      const url = editingQuizId
        ? `/api/admin/lms/quizzes/${editingQuizId}`
        : '/api/admin/lms/quizzes';
      const method = editingQuizId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || err.message || t('admin.lms.quiz.saveError'));
      }

      const data = await res.json();
      const saved = data.data ?? data;
      setEditingQuizId(saved.id);
      setBuilderSuccess(t('admin.lms.quiz.saveSuccess'));
      setTimeout(() => setBuilderSuccess(''), 3000);
    } catch (err) {
      setBuilderError(err instanceof Error ? err.message : t('admin.lms.quiz.saveError'));
    } finally {
      setSaving(false);
    }
  };

  /* ─────────── Delete quiz ─────────── */

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/lms/quizzes/${deleteId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      setDeleteId(null);
      fetchQuizzes();
    } catch {
      setListError(t('admin.lms.quiz.deleteError'));
    } finally {
      setDeleting(false);
    }
  };

  /* ─────────── Question mutations ─────────── */

  const updateQuestion = (uid: string, patch: Partial<QuestionData>) => {
    setQuestions((prev) =>
      prev.map((q) => (q._uid === uid ? { ...q, ...patch } : q))
    );
  };

  const removeQuestion = (uid: string) => {
    setQuestions((prev) => {
      const filtered = prev.filter((q) => q._uid !== uid);
      return filtered.length === 0 ? [createEmptyQuestion(0)] : filtered;
    });
  };

  const addQuestion = () => {
    setQuestions((prev) => [...prev, createEmptyQuestion(prev.length)]);
  };

  const duplicateQuestion = (uid: string) => {
    setQuestions((prev) => {
      const idx = prev.findIndex((q) => q._uid === uid);
      if (idx === -1) return prev;
      const clone: QuestionData = {
        ...JSON.parse(JSON.stringify(prev[idx])),
        _uid: `q_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        id: undefined,
      };
      const next = [...prev];
      next.splice(idx + 1, 0, clone);
      return next;
    });
  };

  const moveQuestion = (uid: string, direction: 'up' | 'down') => {
    setQuestions((prev) => {
      const idx = prev.findIndex((q) => q._uid === uid);
      if (idx === -1) return prev;
      const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (targetIdx < 0 || targetIdx >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[targetIdx]] = [next[targetIdx], next[idx]];
      return next;
    });
  };

  /* ─────────── Option mutations ─────────── */

  const addOption = (quid: string) => {
    setQuestions((prev) =>
      prev.map((q) => {
        if (q._uid !== quid) return q;
        const nextId = String.fromCharCode(97 + q.options.length); // a, b, c...
        return {
          ...q,
          options: [...q.options, { id: nextId, text: '', isCorrect: false }],
        };
      })
    );
  };

  const removeOption = (quid: string, optId: string) => {
    setQuestions((prev) =>
      prev.map((q) => {
        if (q._uid !== quid) return q;
        return { ...q, options: q.options.filter((o) => o.id !== optId) };
      })
    );
  };

  const updateOption = (quid: string, optId: string, patch: Partial<QuizOption>) => {
    setQuestions((prev) =>
      prev.map((q) => {
        if (q._uid !== quid) return q;
        return {
          ...q,
          options: q.options.map((o) => (o.id === optId ? { ...o, ...patch } : o)),
        };
      })
    );
  };

  const toggleCorrectOption = (quid: string, optId: string) => {
    setQuestions((prev) =>
      prev.map((q) => {
        if (q._uid !== quid) return q;
        return {
          ...q,
          options: q.options.map((o) =>
            o.id === optId ? { ...o, isCorrect: !o.isCorrect } : o
          ),
        };
      })
    );
  };

  /* ─────────── Matching pair mutations ─────────── */

  const addMatchingPair = (quid: string) => {
    setQuestions((prev) =>
      prev.map((q) =>
        q._uid === quid
          ? { ...q, matchingPairs: [...q.matchingPairs, { left: '', right: '' }] }
          : q
      )
    );
  };

  const removeMatchingPair = (quid: string, idx: number) => {
    setQuestions((prev) =>
      prev.map((q) =>
        q._uid === quid
          ? { ...q, matchingPairs: q.matchingPairs.filter((_, i) => i !== idx) }
          : q
      )
    );
  };

  const updateMatchingPair = (quid: string, idx: number, side: 'left' | 'right', val: string) => {
    setQuestions((prev) =>
      prev.map((q) => {
        if (q._uid !== quid) return q;
        const pairs = [...q.matchingPairs];
        pairs[idx] = { ...pairs[idx], [side]: val };
        return { ...q, matchingPairs: pairs };
      })
    );
  };

  /* ─────────── Ordering item mutations ─────────── */

  const addOrderingItem = (quid: string) => {
    setQuestions((prev) =>
      prev.map((q) =>
        q._uid === quid ? { ...q, orderingItems: [...q.orderingItems, ''] } : q
      )
    );
  };

  const removeOrderingItem = (quid: string, idx: number) => {
    setQuestions((prev) =>
      prev.map((q) =>
        q._uid === quid
          ? { ...q, orderingItems: q.orderingItems.filter((_, i) => i !== idx) }
          : q
      )
    );
  };

  const updateOrderingItem = (quid: string, idx: number, val: string) => {
    setQuestions((prev) =>
      prev.map((q) => {
        if (q._uid !== quid) return q;
        const items = [...q.orderingItems];
        items[idx] = val;
        return { ...q, orderingItems: items };
      })
    );
  };

  const moveOrderingItem = (quid: string, idx: number, direction: 'up' | 'down') => {
    setQuestions((prev) =>
      prev.map((q) => {
        if (q._uid !== quid) return q;
        const items = [...q.orderingItems];
        const target = direction === 'up' ? idx - 1 : idx + 1;
        if (target < 0 || target >= items.length) return q;
        [items[idx], items[target]] = [items[target], items[idx]];
        return { ...q, orderingItems: items };
      })
    );
  };

  /* ─────────── Preview scoring ─────────── */

  const computePreviewScore = (): { correct: number; total: number; pct: number } => {
    let correctPts = 0;
    let totalPts = 0;
    for (const q of questions) {
      if (!q.question.trim()) continue;
      totalPts += q.points;
      const ans = previewAnswers[q._uid];
      if (!ans) continue;

      switch (q.type) {
        case 'MULTIPLE_CHOICE': {
          const correctIds = q.options.filter((o) => o.isCorrect).map((o) => o.id);
          const selected = Array.isArray(ans) ? ans : [ans];
          if (
            correctIds.length === selected.length &&
            correctIds.every((id) => selected.includes(id))
          ) {
            correctPts += q.points;
          }
          break;
        }
        case 'TRUE_FALSE':
          if (ans === q.correctAnswer) correctPts += q.points;
          break;
        case 'FILL_IN': {
          const userAns = typeof ans === 'string' ? ans : '';
          const correct = q.correctAnswer;
          if (q.caseSensitive ? userAns === correct : userAns.toLowerCase() === correct.toLowerCase()) {
            correctPts += q.points;
          }
          break;
        }
        default:
          break;
      }
    }
    return {
      correct: correctPts,
      total: totalPts,
      pct: totalPts > 0 ? Math.round((correctPts / totalPts) * 100) : 0,
    };
  };

  /* ═════════════════════════════════════════════
     RENDER
     ═════════════════════════════════════════════ */

  /* ─────────── LIST VIEW ─────────── */

  if (mode === 'list') {
    const columns: Column<QuizRow>[] = [
      {
        key: 'title',
        header: t('admin.lms.quiz.title'),
        render: (row) => (
          <div>
            <span className="font-medium text-[var(--k-text-primary)] dark:text-slate-100">{row.title}</span>
            {row.lesson && (
              <p className="text-xs text-slate-500 mt-0.5">
                {row.lesson.chapter.course.title}
              </p>
            )}
          </div>
        ),
      },
      {
        key: 'questions',
        header: t('admin.lms.quiz.questionsCount'),
        render: (row) => String(row._count.questions),
      },
      {
        key: 'passingScore',
        header: t('admin.lms.quiz.passingScoreShort'),
        render: (row) => `${row.passingScore}%`,
      },
      {
        key: 'maxAttempts',
        header: t('admin.lms.quiz.maxAttemptsShort'),
        render: (row) => String(row.maxAttempts),
      },
      {
        key: 'attempts',
        header: t('admin.lms.quiz.totalAttempts'),
        render: (row) => String(row._count.attempts),
      },
      {
        key: 'actions',
        header: '',
        render: (row) => (
          <div className="flex items-center gap-1 justify-end">
            <button
              onClick={() => loadQuizForEdit(row.id)}
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-indigo-600 transition-colors"
              title={t('admin.lms.quiz.edit')}
            >
              <Pencil className="w-4 h-4" />
            </button>
            <button
              onClick={() => setDeleteId(row.id)}
              className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-500 hover:text-red-600 transition-colors"
              title={t('admin.lms.quiz.delete')}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ),
      },
    ];

    return (
      <div className="space-y-6">
        <PageHeader
          title={t('admin.lms.quiz.pageTitle')}
          subtitle={`${total} ${t('admin.lms.quiz.quizzesTotal')}`}
          backHref="/admin/formation"
          actions={
            <Button
              onClick={() => {
                resetBuilder();
                setMode('builder');
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              {t('admin.lms.quiz.createQuiz')}
            </Button>
          }
        />

        {listError && (
          <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800 p-4 text-sm text-red-700 dark:text-red-400 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {listError}
          </div>
        )}

        {!listLoading && quizzes.length === 0 && !listError ? (
          <EmptyState
            icon={FileQuestion}
            title={t('admin.lms.quiz.noQuizzes')}
            description={t('admin.lms.quiz.noQuizzesDesc')}
            action={
              <Button
                onClick={() => {
                  resetBuilder();
                  setMode('builder');
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                {t('admin.lms.quiz.createQuiz')}
              </Button>
            }
          />
        ) : (
          <DataTable
            columns={columns}
            data={quizzes}
            keyExtractor={(q) => q.id}
            loading={listLoading}
            emptyTitle={t('admin.lms.quiz.noQuizzes')}
          />
        )}

        {total > 20 && (
          <div className="flex items-center justify-center gap-2">
            <Button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
              {t('admin.lms.quiz.prevPage')}
            </Button>
            <span className="text-sm text-slate-500">
              {t('admin.lms.quiz.pageOf', { page: String(page), total: String(Math.ceil(total / 20)) })}
            </span>
            <Button onClick={() => setPage((p) => p + 1)} disabled={page * 20 >= total}>
              {t('admin.lms.quiz.nextPage')}
            </Button>
          </div>
        )}

        {/* Delete confirmation modal */}
        <Modal
          isOpen={!!deleteId}
          onClose={() => setDeleteId(null)}
          title={t('admin.lms.quiz.confirmDelete')}
          footer={
            <>
              <Button onClick={() => setDeleteId(null)}>
                {t('admin.lms.quiz.cancel')}
              </Button>
              <Button onClick={handleDelete} disabled={deleting}>
                {deleting ? t('admin.lms.quiz.deleting') : t('admin.lms.quiz.deleteConfirm')}
              </Button>
            </>
          }
        >
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {t('admin.lms.quiz.deleteWarning')}
          </p>
        </Modal>
      </div>
    );
  }

  /* ─────────── BUILDER VIEW ─────────── */

  const validQuestionCount = questions.filter((q) => q.question.trim()).length;
  const totalPoints = questions.reduce((sum, q) => sum + (q.question.trim() ? q.points : 0), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title={editingQuizId ? t('admin.lms.quiz.editQuiz') : t('admin.lms.quiz.createQuiz')}
        subtitle={t('admin.lms.quiz.builderSubtitle')}
        backHref="/admin/formation/quiz"
        actions={
          <div className="flex items-center gap-2">
            <Button
              onClick={() => {
                setPreviewAnswers({});
                setPreviewSubmitted(false);
                setPreviewOpen(true);
              }}
              disabled={validQuestionCount === 0}
            >
              <Eye className="mr-2 h-4 w-4" />
              {t('admin.lms.quiz.preview')}
            </Button>
            <Button onClick={handleSave} disabled={saving || !quizTitle.trim()}>
              <Save className="mr-2 h-4 w-4" />
              {saving ? t('admin.lms.quiz.saving') : t('admin.lms.quiz.save')}
            </Button>
          </div>
        }
      />

      <button
        onClick={() => setMode('list')}
        className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        {t('admin.lms.quiz.backToList')}
      </button>

      {/* Status messages */}
      {builderError && (
        <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800 p-4 text-sm text-red-700 dark:text-red-400 flex items-center gap-2">
          <XCircle className="w-4 h-4 flex-shrink-0" />
          {builderError}
        </div>
      )}
      {builderSuccess && (
        <div className="rounded-lg border border-green-200 bg-green-50 dark:bg-green-900/20 dark:border-green-800 p-4 text-sm text-green-700 dark:text-green-400 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          {builderSuccess}
        </div>
      )}

      {/* ── Quiz Metadata ── */}
      <SectionCard title={t('admin.lms.quiz.metadata')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label={t('admin.lms.quiz.quizTitle')} htmlFor="quizTitle" required>
            <Input
              id="quizTitle"
              value={quizTitle}
              onChange={(e) => setQuizTitle(e.target.value)}
              placeholder={t('admin.lms.quiz.quizTitlePlaceholder')}
              required
            />
          </FormField>

          <FormField label={t('admin.lms.quiz.passingScoreLabel')} htmlFor="passingScore">
            <Input
              id="passingScore"
              type="number"
              min={0}
              max={100}
              value={String(passingScore)}
              onChange={(e) => setPassingScore(parseInt(e.target.value, 10) || 0)}
            />
          </FormField>
        </div>

        <div className="mt-4">
          <FormField label={t('admin.lms.quiz.quizDescription')} htmlFor="quizDesc">
            <Textarea
              id="quizDesc"
              value={quizDescription}
              onChange={(e) => setQuizDescription(e.target.value)}
              placeholder={t('admin.lms.quiz.quizDescPlaceholder')}
              rows={2}
            />
          </FormField>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <FormField label={t('admin.lms.quiz.maxAttemptsLabel')} htmlFor="maxAttempts">
            <Input
              id="maxAttempts"
              type="number"
              min={1}
              max={100}
              value={String(maxAttempts)}
              onChange={(e) => setMaxAttempts(parseInt(e.target.value, 10) || 1)}
            />
          </FormField>

          <FormField label={t('admin.lms.quiz.timeLimitLabel')} htmlFor="timeLimit" hint={t('admin.lms.quiz.timeLimitHint')}>
            <Input
              id="timeLimit"
              type="number"
              min={1}
              value={String(timeLimit)}
              onChange={(e) => setTimeLimit(e.target.value ? parseInt(e.target.value, 10) : '')}
              placeholder={t('admin.lms.quiz.unlimited')}
            />
          </FormField>

          <div className="space-y-3 pt-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={shuffleQuestions}
                onChange={(e) => setShuffleQuestions(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-indigo-700 focus:ring-indigo-700"
              />
              <span className="text-sm text-slate-700 dark:text-slate-300">
                {t('admin.lms.quiz.shuffleQuestions')}
              </span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showResults}
                onChange={(e) => setShowResults(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-indigo-700 focus:ring-indigo-700"
              />
              <span className="text-sm text-slate-700 dark:text-slate-300">
                {t('admin.lms.quiz.showResults')}
              </span>
            </label>
          </div>
        </div>
      </SectionCard>

      {/* ── Summary bar ── */}
      <div className="flex items-center justify-between bg-white/5 dark:bg-slate-800/50 rounded-xl p-4 border border-[var(--k-border-subtle)] dark:border-slate-700">
        <div className="flex items-center gap-6 text-sm text-slate-600 dark:text-slate-400">
          <span>
            <strong className="text-[var(--k-text-primary)] dark:text-slate-100">{validQuestionCount}</strong>{' '}
            {t('admin.lms.quiz.questionsLabel')}
          </span>
          <span>
            <strong className="text-[var(--k-text-primary)] dark:text-slate-100">{totalPoints}</strong>{' '}
            {t('admin.lms.quiz.pointsTotal')}
          </span>
          <span>
            {t('admin.lms.quiz.passingAt')} <strong className="text-[var(--k-text-primary)] dark:text-slate-100">{passingScore}%</strong>
          </span>
        </div>
        <Button onClick={addQuestion}>
          <Plus className="mr-1 h-4 w-4" />
          {t('admin.lms.quiz.addQuestion')}
        </Button>
      </div>

      {/* ── Questions ── */}
      {questions.map((q, qIdx) => (
        <SectionCard
          key={q._uid}
          title={`${t('admin.lms.quiz.questionLabel')} ${qIdx + 1}`}
        >
          <div className="space-y-4">
            {/* Top bar with reorder + actions */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                <GripVertical className="w-4 h-4 text-slate-400" />
                <button
                  onClick={() => moveQuestion(q._uid, 'up')}
                  disabled={qIdx === 0}
                  className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 transition-colors"
                  title={t('admin.lms.quiz.moveUp')}
                >
                  <ChevronUp className="w-4 h-4" />
                </button>
                <button
                  onClick={() => moveQuestion(q._uid, 'down')}
                  disabled={qIdx === questions.length - 1}
                  className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 transition-colors"
                  title={t('admin.lms.quiz.moveDown')}
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => duplicateQuestion(q._uid)}
                  className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-700 transition-colors"
                  title={t('admin.lms.quiz.duplicate')}
                >
                  <Copy className="w-4 h-4" />
                </button>
                <button
                  onClick={() => removeQuestion(q._uid)}
                  className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-500 hover:text-red-600 transition-colors"
                  title={t('admin.lms.quiz.removeQuestion')}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Question text */}
            <FormField label={t('admin.lms.quiz.questionText')} htmlFor={`q-text-${q._uid}`} required>
              <Textarea
                id={`q-text-${q._uid}`}
                value={q.question}
                onChange={(e) => updateQuestion(q._uid, { question: e.target.value })}
                placeholder={t('admin.lms.quiz.questionPlaceholder')}
                rows={2}
              />
            </FormField>

            {/* Type + Bloom + Points row */}
            <div className="grid gap-4 sm:grid-cols-3">
              <FormField label={t('admin.lms.quiz.questionType')} htmlFor={`q-type-${q._uid}`}>
                <select
                  id={`q-type-${q._uid}`}
                  value={q.type}
                  onChange={(e) =>
                    updateQuestion(q._uid, { type: e.target.value as QuestionType })
                  }
                  className={selectClass}
                >
                  <option value="MULTIPLE_CHOICE">{t('admin.lms.quiz.typeMultipleChoice')}</option>
                  <option value="TRUE_FALSE">{t('admin.lms.quiz.typeTrueFalse')}</option>
                  <option value="FILL_IN">{t('admin.lms.quiz.typeFillIn')}</option>
                  <option value="MATCHING">{t('admin.lms.quiz.typeMatching')}</option>
                  <option value="ORDERING">{t('admin.lms.quiz.typeOrdering')}</option>
                </select>
              </FormField>

              <FormField label={t('admin.lms.quiz.bloomLevel')} htmlFor={`q-bloom-${q._uid}`}>
                <select
                  id={`q-bloom-${q._uid}`}
                  value={q.bloomLevel}
                  onChange={(e) =>
                    updateQuestion(q._uid, { bloomLevel: parseInt(e.target.value, 10) })
                  }
                  className={selectClass}
                >
                  {[1, 2, 3, 4, 5].map((lvl) => (
                    <option key={lvl} value={lvl}>
                      {lvl} - {BLOOM_LABELS[lvl].fr}
                    </option>
                  ))}
                </select>
              </FormField>

              <FormField label={t('admin.lms.quiz.points')} htmlFor={`q-pts-${q._uid}`}>
                <Input
                  id={`q-pts-${q._uid}`}
                  type="number"
                  min={1}
                  value={String(q.points)}
                  onChange={(e) =>
                    updateQuestion(q._uid, { points: parseInt(e.target.value, 10) || 1 })
                  }
                />
              </FormField>
            </div>

            {/* ── Type-specific editors ── */}

            {/* MULTIPLE_CHOICE */}
            {q.type === 'MULTIPLE_CHOICE' && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                  {t('admin.lms.quiz.optionsLabel')}
                </p>
                {q.options.map((opt) => (
                  <div key={opt.id} className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => toggleCorrectOption(q._uid, opt.id)}
                      className={`flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                        opt.isCorrect
                          ? 'border-green-500 bg-green-500 text-white'
                          : 'border-slate-300 hover:border-green-400'
                      }`}
                      title={t('admin.lms.quiz.markCorrect')}
                    >
                      {opt.isCorrect && <CheckCircle2 className="w-3 h-3" />}
                    </button>
                    <Input
                      value={opt.text}
                      onChange={(e) => updateOption(q._uid, opt.id, { text: e.target.value })}
                      placeholder={`${t('admin.lms.quiz.option')} ${opt.id.toUpperCase()}`}
                      className="flex-1"
                    />
                    {q.options.length > 2 && (
                      <button
                        onClick={() => removeOption(q._uid, opt.id)}
                        className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-400 hover:text-red-500 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  onClick={() => addOption(q._uid)}
                  className="text-sm text-indigo-600 hover:text-indigo-700 font-medium mt-1"
                >
                  + {t('admin.lms.quiz.addOption')}
                </button>
              </div>
            )}

            {/* TRUE_FALSE */}
            {q.type === 'TRUE_FALSE' && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                  {t('admin.lms.quiz.correctAnswerLabel')}
                </p>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name={`tf-${q._uid}`}
                      value="true"
                      checked={q.correctAnswer === 'true'}
                      onChange={() => updateQuestion(q._uid, { correctAnswer: 'true' })}
                      className="w-4 h-4 text-indigo-700 focus:ring-indigo-700"
                    />
                    <span className="text-sm">{t('admin.lms.quiz.answerTrue')}</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name={`tf-${q._uid}`}
                      value="false"
                      checked={q.correctAnswer === 'false'}
                      onChange={() => updateQuestion(q._uid, { correctAnswer: 'false' })}
                      className="w-4 h-4 text-indigo-700 focus:ring-indigo-700"
                    />
                    <span className="text-sm">{t('admin.lms.quiz.answerFalse')}</span>
                  </label>
                </div>
              </div>
            )}

            {/* FILL_IN */}
            {q.type === 'FILL_IN' && (
              <div className="space-y-3">
                <FormField label={t('admin.lms.quiz.correctAnswerLabel')} htmlFor={`fill-${q._uid}`}>
                  <Input
                    id={`fill-${q._uid}`}
                    value={q.correctAnswer}
                    onChange={(e) => updateQuestion(q._uid, { correctAnswer: e.target.value })}
                    placeholder={t('admin.lms.quiz.correctAnswerPlaceholder')}
                  />
                </FormField>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={q.caseSensitive}
                      onChange={(e) => updateQuestion(q._uid, { caseSensitive: e.target.checked })}
                      className="w-4 h-4 rounded border-slate-300 text-indigo-700 focus:ring-indigo-700"
                    />
                    <span className="text-sm text-slate-700 dark:text-slate-300">
                      {t('admin.lms.quiz.caseSensitive')}
                    </span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={q.acceptVariants}
                      onChange={(e) => updateQuestion(q._uid, { acceptVariants: e.target.checked })}
                      className="w-4 h-4 rounded border-slate-300 text-indigo-700 focus:ring-indigo-700"
                    />
                    <span className="text-sm text-slate-700 dark:text-slate-300">
                      {t('admin.lms.quiz.acceptVariants')}
                    </span>
                  </label>
                </div>
              </div>
            )}

            {/* MATCHING */}
            {q.type === 'MATCHING' && (
              <div className="space-y-2">
                <div className="grid grid-cols-[1fr_auto_1fr_auto] gap-2 items-center">
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                    {t('admin.lms.quiz.leftItem')}
                  </p>
                  <span />
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                    {t('admin.lms.quiz.rightItem')}
                  </p>
                  <span />
                  {q.matchingPairs.map((pair, pIdx) => (
                    <div key={pIdx} className="contents">
                      <Input
                        value={pair.left}
                        onChange={(e) => updateMatchingPair(q._uid, pIdx, 'left', e.target.value)}
                        placeholder={`${t('admin.lms.quiz.leftItem')} ${pIdx + 1}`}
                      />
                      <span className="text-slate-400 text-center">&harr;</span>
                      <Input
                        value={pair.right}
                        onChange={(e) => updateMatchingPair(q._uid, pIdx, 'right', e.target.value)}
                        placeholder={`${t('admin.lms.quiz.rightItem')} ${pIdx + 1}`}
                      />
                      {q.matchingPairs.length > 1 && (
                        <button
                          onClick={() => removeMatchingPair(q._uid, pIdx)}
                          className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-400 hover:text-red-500"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                      {q.matchingPairs.length <= 1 && <span />}
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => addMatchingPair(q._uid)}
                  className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                >
                  + {t('admin.lms.quiz.addPair')}
                </button>
              </div>
            )}

            {/* ORDERING */}
            {q.type === 'ORDERING' && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                  {t('admin.lms.quiz.correctOrder')}
                </p>
                {q.orderingItems.map((item, iIdx) => (
                  <div key={iIdx} className="flex items-center gap-2">
                    <span className="text-xs font-mono text-slate-400 w-6 text-center">{iIdx + 1}</span>
                    <div className="flex flex-col gap-0.5">
                      <button
                        onClick={() => moveOrderingItem(q._uid, iIdx, 'up')}
                        disabled={iIdx === 0}
                        className="p-0.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30"
                      >
                        <ChevronUp className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => moveOrderingItem(q._uid, iIdx, 'down')}
                        disabled={iIdx === q.orderingItems.length - 1}
                        className="p-0.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30"
                      >
                        <ChevronDown className="w-3 h-3" />
                      </button>
                    </div>
                    <Input
                      value={item}
                      onChange={(e) => updateOrderingItem(q._uid, iIdx, e.target.value)}
                      placeholder={`${t('admin.lms.quiz.item')} ${iIdx + 1}`}
                      className="flex-1"
                    />
                    {q.orderingItems.length > 1 && (
                      <button
                        onClick={() => removeOrderingItem(q._uid, iIdx)}
                        className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-400 hover:text-red-500"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  onClick={() => addOrderingItem(q._uid)}
                  className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                >
                  + {t('admin.lms.quiz.addItem')}
                </button>
              </div>
            )}

            {/* Explanation */}
            <FormField label={t('admin.lms.quiz.explanation')} htmlFor={`q-exp-${q._uid}`} hint={t('admin.lms.quiz.explanationHint')}>
              <Textarea
                id={`q-exp-${q._uid}`}
                value={q.explanation}
                onChange={(e) => updateQuestion(q._uid, { explanation: e.target.value })}
                placeholder={t('admin.lms.quiz.explanationPlaceholder')}
                rows={2}
              />
            </FormField>
          </div>
        </SectionCard>
      ))}

      {/* ── Bottom action bar ── */}
      <div className="flex items-center justify-between">
        <Button onClick={addQuestion}>
          <Plus className="mr-1 h-4 w-4" />
          {t('admin.lms.quiz.addQuestion')}
        </Button>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => {
              setPreviewAnswers({});
              setPreviewSubmitted(false);
              setPreviewOpen(true);
            }}
            disabled={validQuestionCount === 0}
          >
            <Eye className="mr-2 h-4 w-4" />
            {t('admin.lms.quiz.preview')}
          </Button>
          <Button onClick={handleSave} disabled={saving || !quizTitle.trim()}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? t('admin.lms.quiz.saving') : t('admin.lms.quiz.save')}
          </Button>
        </div>
      </div>

      {/* ═══ PREVIEW MODAL ═══ */}
      <Modal
        isOpen={previewOpen}
        onClose={() => setPreviewOpen(false)}
        title={t('admin.lms.quiz.previewTitle')}
        subtitle={quizTitle}
        size="xl"
        footer={
          <>
            <Button onClick={() => setPreviewOpen(false)}>
              {t('admin.lms.quiz.closePreview')}
            </Button>
            {!previewSubmitted && (
              <Button onClick={() => setPreviewSubmitted(true)} disabled={validQuestionCount === 0}>
                {t('admin.lms.quiz.submitPreview')}
              </Button>
            )}
          </>
        }
      >
        <div className="space-y-6">
          {quizDescription && (
            <p className="text-sm text-slate-600 dark:text-slate-400">{quizDescription}</p>
          )}

          {previewSubmitted && (() => {
            const score = computePreviewScore();
            const passed = score.pct >= passingScore;
            return (
              <div
                className={`rounded-xl p-4 border ${
                  passed
                    ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800'
                    : 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800'
                }`}
              >
                <div className="flex items-center gap-2">
                  {passed ? (
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-600" />
                  )}
                  <span className="font-semibold text-sm">
                    {passed ? t('admin.lms.quiz.previewPassed') : t('admin.lms.quiz.previewFailed')}
                  </span>
                </div>
                <p className="text-sm mt-1">
                  {t('admin.lms.quiz.previewScore', {
                    correct: String(score.correct),
                    total: String(score.total),
                    pct: String(score.pct),
                  })}
                </p>
              </div>
            );
          })()}

          {questions
            .filter((q) => q.question.trim())
            .map((q, idx) => (
              <div key={q._uid} className="border border-[var(--k-border-subtle)] dark:border-slate-700 rounded-xl p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <p className="font-medium text-sm">
                    {idx + 1}. {q.question}
                  </p>
                  <StatusBadge variant="neutral">{q.points} pt{q.points > 1 ? 's' : ''}</StatusBadge>
                </div>

                {/* MC preview */}
                {q.type === 'MULTIPLE_CHOICE' &&
                  q.options
                    .filter((o) => o.text.trim())
                    .map((opt) => {
                      const selected = (previewAnswers[q._uid] as string[] | undefined)?.includes(opt.id);
                      const showResult = previewSubmitted;
                      return (
                        <label
                          key={opt.id}
                          className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer border transition-colors ${
                            showResult && opt.isCorrect
                              ? 'border-green-300 bg-green-50 dark:bg-green-900/20'
                              : showResult && selected && !opt.isCorrect
                                ? 'border-red-300 bg-red-50 dark:bg-red-900/20'
                                : selected
                                  ? 'border-indigo-300 bg-indigo-50 dark:bg-indigo-900/20'
                                  : 'border-[var(--k-border-subtle)] dark:border-slate-700 hover:border-slate-300'
                          }`}
                        >
                          <input
                            type="checkbox"
                            disabled={previewSubmitted}
                            checked={!!selected}
                            onChange={() => {
                              const current = (previewAnswers[q._uid] as string[]) ?? [];
                              const next = selected
                                ? current.filter((id) => id !== opt.id)
                                : [...current, opt.id];
                              setPreviewAnswers({ ...previewAnswers, [q._uid]: next });
                            }}
                            className="w-4 h-4 rounded border-slate-300 text-indigo-700"
                          />
                          <span className="text-sm">{opt.text}</span>
                        </label>
                      );
                    })}

                {/* TF preview */}
                {q.type === 'TRUE_FALSE' && (
                  <div className="flex gap-4">
                    {['true', 'false'].map((val) => {
                      const selected = previewAnswers[q._uid] === val;
                      const isCorrect = q.correctAnswer === val;
                      return (
                        <label
                          key={val}
                          className={`flex items-center gap-2 p-2 px-4 rounded-lg cursor-pointer border transition-colors ${
                            previewSubmitted && isCorrect
                              ? 'border-green-300 bg-green-50 dark:bg-green-900/20'
                              : previewSubmitted && selected && !isCorrect
                                ? 'border-red-300 bg-red-50 dark:bg-red-900/20'
                                : selected
                                  ? 'border-indigo-300 bg-indigo-50 dark:bg-indigo-900/20'
                                  : 'border-[var(--k-border-subtle)] dark:border-slate-700 hover:border-slate-300'
                          }`}
                        >
                          <input
                            type="radio"
                            name={`preview-tf-${q._uid}`}
                            disabled={previewSubmitted}
                            checked={selected}
                            onChange={() =>
                              setPreviewAnswers({ ...previewAnswers, [q._uid]: val })
                            }
                            className="w-4 h-4 text-indigo-700"
                          />
                          <span className="text-sm">
                            {val === 'true' ? t('admin.lms.quiz.answerTrue') : t('admin.lms.quiz.answerFalse')}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}

                {/* FILL_IN preview */}
                {q.type === 'FILL_IN' && (
                  <div>
                    <Input
                      value={(previewAnswers[q._uid] as string) ?? ''}
                      onChange={(e) =>
                        setPreviewAnswers({ ...previewAnswers, [q._uid]: e.target.value })
                      }
                      disabled={previewSubmitted}
                      placeholder={t('admin.lms.quiz.typeYourAnswer')}
                    />
                    {previewSubmitted && (
                      <p className="text-xs text-slate-500 mt-1">
                        {t('admin.lms.quiz.correctAnswerWas')}: <strong>{q.correctAnswer}</strong>
                      </p>
                    )}
                  </div>
                )}

                {/* MATCHING preview (read-only display) */}
                {q.type === 'MATCHING' && (
                  <div className="text-sm text-slate-500">
                    {q.matchingPairs
                      .filter((p) => p.left.trim() && p.right.trim())
                      .map((pair, pIdx) => (
                        <div key={pIdx} className="flex items-center gap-2 py-1">
                          <span className="font-medium">{pair.left}</span>
                          <span className="text-slate-400">&rarr;</span>
                          <span>{pair.right}</span>
                        </div>
                      ))}
                    <p className="text-xs text-slate-400 mt-1 italic">
                      {t('admin.lms.quiz.matchingPreviewNote')}
                    </p>
                  </div>
                )}

                {/* ORDERING preview (read-only display) */}
                {q.type === 'ORDERING' && (
                  <div className="text-sm text-slate-500">
                    {q.orderingItems
                      .filter((item) => item.trim())
                      .map((item, iIdx) => (
                        <div key={iIdx} className="flex items-center gap-2 py-1">
                          <span className="font-mono text-xs text-slate-400">{iIdx + 1}.</span>
                          <span>{item}</span>
                        </div>
                      ))}
                    <p className="text-xs text-slate-400 mt-1 italic">
                      {t('admin.lms.quiz.orderingPreviewNote')}
                    </p>
                  </div>
                )}

                {/* Explanation after submit */}
                {previewSubmitted && q.explanation && (
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 text-sm text-blue-700 dark:text-blue-400">
                    <strong>{t('admin.lms.quiz.explanation')}:</strong> {q.explanation}
                  </div>
                )}
              </div>
            ))}
        </div>
      </Modal>
    </div>
  );
}
