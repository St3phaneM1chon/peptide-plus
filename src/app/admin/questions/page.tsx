// TODO: F-093 - Add loading spinner on togglePublic badge while PATCH request is in-flight
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  MessageCircleQuestion,
  CheckCircle,
  AlertCircle,
  Trash2,
  Pencil,
  MessageSquare,
} from 'lucide-react';

import { Button } from '@/components/admin/Button';
import { Modal } from '@/components/admin/Modal';
import { StatCard } from '@/components/admin/StatCard';
import { FormField, Textarea } from '@/components/admin/FormField';
import {
  ContentList,
  DetailPane,
  MobileSplitLayout,
} from '@/components/admin/outlook';
import type { ContentListItem } from '@/components/admin/outlook';
import { useI18n } from '@/i18n/client';
import { toast } from 'sonner';
import { useRibbonAction } from '@/hooks/useRibbonAction';

// ── Types ─────────────────────────────────────────────────────

interface Question {
  id: string;
  productId: string;
  productName: string;
  userId?: string;
  userName?: string;
  userEmail?: string;
  question: string;
  answer?: string;
  answeredBy?: string;
  answeredAt?: string;
  isPublic: boolean;
  createdAt: string;
}

// ── Helpers ───────────────────────────────────────────────────

function answeredBadgeVariant(hasAnswer: boolean): 'success' | 'warning' {
  return hasAnswer ? 'success' : 'warning';
}

// ── Main Component ────────────────────────────────────────────

export default function QuestionsPage() {
  const { t, locale } = useI18n();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Filter state
  const [searchValue, setSearchValue] = useState('');
  const [answeredFilter, setAnsweredFilter] = useState('all');

  // Answer modal state
  const [showAnswerModal, setShowAnswerModal] = useState(false);
  const [answerText, setAnswerText] = useState('');

  // ─── Data fetching ──────────────────────────────────────────

  useEffect(() => {
    fetchQuestions();
  }, []);

  const fetchQuestions = async () => {
    try {
      const res = await fetch('/api/admin/questions');
      const data = await res.json();
      setQuestions(data.questions || []);
    } catch (err) {
      console.error('Error fetching questions:', err);
      toast.error(t('common.error'));
      setQuestions([]);
    }
    setLoading(false);
  };

  const submitAnswer = async (id: string) => {
    if (!answerText.trim()) return;
    try {
      const res = await fetch(`/api/admin/questions/${id}/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answer: answerText }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || t('common.saveFailed'));
        return;
      }
      setQuestions(prev => prev.map(q => q.id === id ? {
        ...q,
        answer: answerText,
        answeredBy: 'Admin BioCycle',
        answeredAt: new Date().toISOString(),
      } : q));
      setShowAnswerModal(false);
      setAnswerText('');
      toast.success(t('admin.questions.answerPublished') || 'Answer published');
    } catch (err) {
      console.error('Error submitting answer:', err);
      toast.error(t('common.networkError'));
    }
  };

  const togglePublic = async (id: string, isPublic: boolean) => {
    try {
      const response = await fetch(`/api/admin/questions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPublic: !isPublic }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        toast.error(data.error || t('common.updateFailed'));
        return;
      }
      setQuestions(prev => prev.map(q => q.id === id ? { ...q, isPublic: !isPublic } : q));
    } catch (err) {
      console.error('Error toggling question visibility:', err);
      toast.error(t('common.networkError'));
    }
  };

  // F-030 FIX: State for delete confirmation modal instead of native confirm()
  const [deleteModalId, setDeleteModalId] = useState<string | null>(null);

  const deleteQuestion = async (id: string) => {
    setDeleteModalId(null); // Close modal
    setDeletingId(id);
    try {
      const response = await fetch(`/api/admin/questions/${id}`, { method: 'DELETE' });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        toast.error(data.error || t('common.deleteFailed'));
        return;
      }
      setQuestions(prev => prev.filter(q => q.id !== id));
      if (selectedQuestionId === id) {
        setSelectedQuestionId(null);
      }
      toast.success(t('admin.questions.deleted') || 'Question deleted');
    } catch (err) {
      console.error('Error deleting question:', err);
      toast.error(t('common.networkError'));
    } finally {
      setDeletingId(null);
    }
  };

  // ─── Filtering ──────────────────────────────────────────────

  const filteredQuestions = useMemo(() => {
    return questions.filter(q => {
      if (answeredFilter === 'answered' && !q.answer) return false;
      if (answeredFilter === 'unanswered' && q.answer) return false;
      if (searchValue) {
        const search = searchValue.toLowerCase();
        if (!q.question.toLowerCase().includes(search) &&
            !q.productName.toLowerCase().includes(search)) {
          return false;
        }
      }
      return true;
    });
  }, [questions, answeredFilter, searchValue]);

  const stats = useMemo(() => ({
    total: questions.length,
    unanswered: questions.filter(q => !q.answer).length,
    answered: questions.filter(q => q.answer).length,
  }), [questions]);

  // ─── ContentList data ───────────────────────────────────────

  const filterTabs = useMemo(() => [
    { key: 'all', label: t('admin.questions.filterAll'), count: stats.total },
    { key: 'unanswered', label: t('admin.questions.filterUnanswered'), count: stats.unanswered },
    { key: 'answered', label: t('admin.questions.filterAnswered'), count: stats.answered },
  ], [t, stats]);

  const listItems: ContentListItem[] = useMemo(() => {
    return filteredQuestions.map((q) => ({
      id: q.id,
      avatar: { text: q.userName || 'U' },
      title: q.userName || t('admin.questions.anonymousUser'),
      subtitle: q.productName,
      preview: q.question.length > 80 ? q.question.slice(0, 80) + '...' : q.question,
      timestamp: q.createdAt,
      badges: [
        {
          text: q.answer ? t('admin.questions.filterAnswered') : t('admin.questions.awaitingAnswer'),
          variant: answeredBadgeVariant(!!q.answer),
        },
        ...(q.isPublic
          ? [{ text: t('admin.questions.public'), variant: 'info' as const }]
          : [{ text: t('admin.questions.private'), variant: 'neutral' as const }]),
      ],
    }));
  }, [filteredQuestions, t]);

  // ─── Selected question ──────────────────────────────────────

  const selectedQuestion = useMemo(() => {
    if (!selectedQuestionId) return null;
    return questions.find(q => q.id === selectedQuestionId) || null;
  }, [questions, selectedQuestionId]);

  const handleSelectQuestion = useCallback((id: string) => {
    setSelectedQuestionId(id);
  }, []);

  // ─── Ribbon action handlers ────────────────────────────────
  const handleRibbonRespond = useCallback(() => {
    if (!selectedQuestion) { toast.info(t('common.comingSoon')); return; }
    setAnswerText(selectedQuestion.answer || '');
    setShowAnswerModal(true);
  }, [selectedQuestion, t]);

  const handleRibbonMarkResolved = useCallback(() => {
    toast.info(t('common.comingSoon'));
  }, [t]);

  const handleRibbonArchive = useCallback(() => {
    toast.info(t('common.comingSoon'));
  }, [t]);

  const handleRibbonReportContent = useCallback(() => {
    toast.info(t('common.comingSoon'));
  }, [t]);

  const handleRibbonConvertFaq = useCallback(() => {
    toast.info(t('common.comingSoon'));
  }, [t]);

  const handleRibbonExport = useCallback(() => {
    toast.info(t('common.comingSoon'));
  }, [t]);

  useRibbonAction('respond', handleRibbonRespond);
  useRibbonAction('markResolved', handleRibbonMarkResolved);
  useRibbonAction('archive', handleRibbonArchive);
  useRibbonAction('reportContent', handleRibbonReportContent);
  useRibbonAction('convertFaq', handleRibbonConvertFaq);
  useRibbonAction('export', handleRibbonExport);

  // ─── Loading state ──────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64" role="status" aria-label="Loading">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-500" />
        <span className="sr-only">Loading...</span>
      </div>
    );
  }

  // ─── Render ─────────────────────────────────────────────────

  return (
    <div className="h-full flex flex-col">
      {/* Stat cards row */}
      <div className="p-4 lg:p-6 pb-0 flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900">{t('admin.questions.title')}</h1>
            <p className="text-sm text-slate-500 mt-0.5">{t('admin.questions.subtitle')}</p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
          <StatCard label={t('admin.questions.totalQuestions')} value={stats.total} icon={MessageCircleQuestion} />
          <StatCard label={t('admin.questions.unanswered')} value={stats.unanswered} icon={AlertCircle} />
          <StatCard label={t('admin.questions.answered')} value={stats.answered} icon={CheckCircle} />
        </div>
      </div>

      {/* Main content: list + detail */}
      <div className="flex-1 min-h-0">
        <MobileSplitLayout
          listWidth={400}
          showDetail={!!selectedQuestionId}
          list={
            <ContentList
              items={listItems}
              selectedId={selectedQuestionId}
              onSelect={handleSelectQuestion}
              filterTabs={filterTabs}
              activeFilter={answeredFilter}
              onFilterChange={setAnsweredFilter}
              searchValue={searchValue}
              onSearchChange={setSearchValue}
              searchPlaceholder={t('admin.questions.searchPlaceholder')}
              loading={loading}
              emptyIcon={MessageCircleQuestion}
              emptyTitle={t('admin.questions.emptyTitle')}
              emptyDescription={t('admin.questions.emptyDescription')}
            />
          }
          detail={
            selectedQuestion ? (
              <DetailPane
                header={{
                  title: selectedQuestion.userName || t('admin.questions.anonymousUser'),
                  subtitle: `${selectedQuestion.productName} - ${new Date(selectedQuestion.createdAt).toLocaleDateString(locale)}`,
                  avatar: { text: selectedQuestion.userName || 'U' },
                  onBack: () => setSelectedQuestionId(null),
                  backLabel: t('admin.questions.title'),
                  actions: (
                    <div className="flex items-center gap-2">
                      {/* FIX: F-076 - Added title tooltip to explain icon meaning */}
                      <Button
                        size="sm"
                        variant="ghost"
                        icon={selectedQuestion.answer ? Pencil : MessageSquare}
                        title={selectedQuestion.answer ? t('admin.questions.editAnswer') : t('admin.questions.answer')}
                        onClick={() => {
                          setAnswerText(selectedQuestion.answer || '');
                          setShowAnswerModal(true);
                        }}
                      >
                        {selectedQuestion.answer ? t('admin.questions.editAnswer') : t('admin.questions.answer')}
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        icon={Trash2}
                        disabled={deletingId === selectedQuestion.id}
                        onClick={() => deleteQuestion(selectedQuestion.id)}
                      >
                        {t('admin.questions.delete')}
                      </Button>
                    </div>
                  ),
                }}
              >
                <div className="space-y-6">
                  {/* Status badges */}
                  <div className="flex items-center gap-2">
                    {!selectedQuestion.answer && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-50 text-amber-700">
                        {t('admin.questions.awaitingAnswer')}
                      </span>
                    )}
                    <button onClick={() => togglePublic(selectedQuestion.id, selectedQuestion.isPublic)}>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium cursor-pointer ${
                        selectedQuestion.isPublic ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {selectedQuestion.isPublic ? t('admin.questions.public') : t('admin.questions.private')}
                      </span>
                    </button>
                  </div>

                  {/* Question */}
                  <div className="bg-slate-50 rounded-lg p-4">
                    <p className="font-medium text-slate-900 flex items-start gap-2">
                      <span className="text-sky-500 flex-shrink-0">Q:</span>
                      <span>{selectedQuestion.question}</span>
                    </p>
                    <p className="text-xs text-slate-500 mt-2">
                      {selectedQuestion.userName} - {selectedQuestion.productName} - {new Date(selectedQuestion.createdAt).toLocaleDateString(locale)}
                    </p>
                  </div>

                  {/* Answer */}
                  {selectedQuestion.answer ? (
                    <div className="bg-emerald-50 rounded-lg p-4">
                      <p className="text-emerald-800 flex items-start gap-2">
                        <span className="text-emerald-600 font-bold flex-shrink-0">R:</span>
                        <span>{selectedQuestion.answer}</span>
                      </p>
                      <p className="text-xs text-emerald-600 mt-2">
                        {selectedQuestion.answeredBy} &bull; {selectedQuestion.answeredAt && new Date(selectedQuestion.answeredAt).toLocaleDateString(locale)}
                      </p>
                    </div>
                  ) : (
                    <div className="border-2 border-dashed border-amber-200 rounded-lg p-6 text-center">
                      <AlertCircle className="w-8 h-8 text-amber-400 mx-auto mb-2" />
                      <p className="text-sm text-amber-700 font-medium">{t('admin.questions.awaitingAnswer')}</p>
                      <Button
                        size="sm"
                        variant="primary"
                        icon={MessageSquare}
                        className="mt-3"
                        onClick={() => {
                          setAnswerText('');
                          setShowAnswerModal(true);
                        }}
                      >
                        {t('admin.questions.answer')}
                      </Button>
                    </div>
                  )}

                  {/* Contact info */}
                  {selectedQuestion.userEmail && (
                    <div className="bg-slate-50 rounded-lg p-4">
                      <h4 className="font-semibold text-slate-900 mb-2">{t('admin.questions.contactInfo')}</h4>
                      <p className="text-sm text-slate-600">{selectedQuestion.userEmail}</p>
                    </div>
                  )}
                </div>
              </DetailPane>
            ) : (
              <DetailPane
                isEmpty
                emptyIcon={MessageCircleQuestion}
                emptyTitle={t('admin.questions.emptyTitle')}
                emptyDescription={t('admin.questions.emptyDescription')}
              />
            )
          }
        />
      </div>

      {/* ─── ANSWER MODAL ──────────────────────────────────────── */}
      <Modal
        isOpen={showAnswerModal}
        onClose={() => setShowAnswerModal(false)}
        title={t('admin.questions.modalTitle')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowAnswerModal(false)}>
              {t('admin.questions.cancel')}
            </Button>
            <Button
              variant="primary"
              disabled={!answerText.trim()}
              onClick={() => selectedQuestion && submitAnswer(selectedQuestion.id)}
            >
              {t('admin.questions.publishAnswer')}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="bg-slate-50 rounded-lg p-3">
            <p className="text-sm text-slate-500 mb-1">
              {selectedQuestion?.userName} - {selectedQuestion?.productName}
            </p>
            <p className="font-medium text-slate-900">{selectedQuestion?.question}</p>
          </div>
          <FormField label={t('admin.questions.yourAnswer')}>
            <Textarea
              rows={4}
              value={answerText}
              onChange={(e) => setAnswerText(e.target.value)}
              placeholder={t('admin.questions.answerPlaceholder')}
            />
          </FormField>
        </div>
      </Modal>
    </div>
  );
}
