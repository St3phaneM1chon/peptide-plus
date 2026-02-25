// F093 FIX: Added loading spinner on togglePublic badge while PATCH request is in-flight
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
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
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

  // F093 FIX: Track which question is currently toggling public/private for loading state
  const [togglingPublicId, setTogglingPublicId] = useState<string | null>(null);

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

  // F093 FIX: Add loading state around togglePublic to show spinner on the badge
  const togglePublic = async (id: string, isPublic: boolean) => {
    setTogglingPublicId(id);
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
    } finally {
      setTogglingPublicId(null);
    }
  };

  // F-030 FIX: ConfirmDialog state for delete confirmation
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const deleteQuestion = async (id: string) => {
    setDeleteConfirmId(null); // Close dialog
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

  // A-057: Keyboard shortcut - Ctrl+Enter to submit answer when modal is open
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && showAnswerModal && selectedQuestion && answerText.trim()) {
        e.preventDefault();
        submitAnswer(selectedQuestion.id);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showAnswerModal, selectedQuestion, answerText]);

  const handleSelectQuestion = useCallback((id: string) => {
    setSelectedQuestionId(id);
  }, []);

  // ─── Auto-select first item ────────────────────────────────

  useEffect(() => {
    if (!loading && filteredQuestions.length > 0) {
      const currentStillVisible = selectedQuestionId &&
        filteredQuestions.some(q => q.id === selectedQuestionId);
      if (!currentStillVisible) {
        handleSelectQuestion(filteredQuestions[0].id);
      }
    }
  }, [filteredQuestions, loading, selectedQuestionId, handleSelectQuestion]);

  // ─── Ribbon action handlers ────────────────────────────────
  const handleRibbonRespond = useCallback(() => {
    if (!selectedQuestion) { toast.info(t('admin.questions.selectQuestionFirst') || 'Select a question first'); return; }
    setAnswerText(selectedQuestion.answer || '');
    setShowAnswerModal(true);
  }, [selectedQuestion, t]);

  const handleRibbonMarkResolved = useCallback(() => {
    if (!selectedQuestion) {
      toast.info(t('admin.questions.selectQuestionFirst') || 'Select a question first');
      return;
    }
    if (!selectedQuestion.answer) {
      toast.info(t('admin.questions.answerBeforeResolving') || 'Please answer the question before marking it as resolved');
      return;
    }
    // Mark as public (resolved = answered + public)
    if (!selectedQuestion.isPublic) {
      togglePublic(selectedQuestion.id, selectedQuestion.isPublic);
      toast.success(t('admin.questions.markedResolved') || 'Question marked as resolved and made public');
    } else {
      toast.info(t('admin.questions.alreadyResolved') || 'This question is already answered and public');
    }
  }, [selectedQuestion, t]);

  const handleRibbonArchive = useCallback(() => {
    if (!selectedQuestion) {
      toast.info(t('admin.questions.selectQuestionFirst') || 'Select a question first');
      return;
    }
    // Archive = delete the question
    setDeleteConfirmId(selectedQuestion.id);
  }, [selectedQuestion, t]);

  const handleRibbonReportContent = useCallback(() => {
    if (!selectedQuestion) {
      toast.info(t('admin.questions.selectQuestionFirst') || 'Select a question first');
      return;
    }
    // Make question private if it contains inappropriate content
    if (selectedQuestion.isPublic) {
      togglePublic(selectedQuestion.id, selectedQuestion.isPublic);
      toast.success(t('admin.questions.contentReported') || 'Question hidden from public view');
    } else {
      toast.info(t('admin.questions.alreadyPrivate') || 'This question is already private');
    }
  }, [selectedQuestion, t]);

  const handleRibbonConvertFaq = useCallback(() => {
    if (!selectedQuestion) {
      toast.info(t('admin.questions.selectQuestionFirst') || 'Select a question first');
      return;
    }
    if (!selectedQuestion.answer) {
      toast.info(t('admin.questions.answerFirstForFaq') || 'Answer the question before converting to FAQ');
      return;
    }
    // Copy Q&A to clipboard for easy pasting into FAQ section
    const faqText = `Q: ${selectedQuestion.question}\nA: ${selectedQuestion.answer}`;
    navigator.clipboard.writeText(faqText);
    toast.success(t('admin.questions.faqCopied') || 'Q&A copied to clipboard. Paste it into your FAQ section.');
  }, [selectedQuestion, t]);

  const handleRibbonExport = useCallback(() => {
    if (questions.length === 0) {
      toast.info(t('admin.questions.noQuestionsToExport') || 'No questions to export');
      return;
    }
    const BOM = '\uFEFF';
    const headers = ['Product', 'User', 'Question', 'Answer', 'Status', 'Public', 'Date'];
    const rows = questions.map(q => [
      q.productName,
      q.userName || q.userEmail || 'Anonymous',
      q.question,
      q.answer || '',
      q.answer ? 'Answered' : 'Pending',
      q.isPublic ? 'Yes' : 'No',
      new Date(q.createdAt).toLocaleDateString(locale),
    ]);
    const csv = BOM + [headers, ...rows]
      .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `questions-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(t('common.exported') || 'Exported successfully');
  }, [questions, locale, t]);

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
                        onClick={() => setDeleteConfirmId(selectedQuestion.id)}
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
                    {/* F093 FIX: Show spinner on togglePublic badge while PATCH is in-flight */}
                    <button
                      onClick={() => togglePublic(selectedQuestion.id, selectedQuestion.isPublic)}
                      disabled={togglingPublicId === selectedQuestion.id}
                    >
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium cursor-pointer ${
                        selectedQuestion.isPublic ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'
                      } ${togglingPublicId === selectedQuestion.id ? 'opacity-60' : ''}`}>
                        {togglingPublicId === selectedQuestion.id && (
                          <span className="inline-block w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        )}
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
            {/* A-057: Keyboard shortcut hint */}
            <p className="text-xs text-slate-400 mt-1">{'\u2318'}+Enter / Ctrl+Enter {t('common.toSubmit') || 'to submit'}</p>
          </FormField>
        </div>
      </Modal>

      {/* ─── DELETE CONFIRM DIALOG ─────────────────────────────── */}
      <ConfirmDialog
        isOpen={!!deleteConfirmId}
        title={t('admin.questions.deleteTitle') || 'Delete Question'}
        message={t('admin.questions.deleteMessage') || 'Are you sure you want to delete this question? This action cannot be undone.'}
        variant="danger"
        confirmLabel={t('admin.questions.delete') || 'Delete'}
        onConfirm={() => deleteConfirmId && deleteQuestion(deleteConfirmId)}
        onCancel={() => setDeleteConfirmId(null)}
      />
    </div>
  );
}
