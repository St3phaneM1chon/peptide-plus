'use client';

import { useState, useEffect } from 'react';
import {
  MessageCircleQuestion,
  CheckCircle,
  AlertCircle,
  Trash2,
  Pencil,
  MessageSquare,
} from 'lucide-react';

import { PageHeader } from '@/components/admin/PageHeader';
import { Button } from '@/components/admin/Button';
import { Modal } from '@/components/admin/Modal';
import { StatCard } from '@/components/admin/StatCard';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { EmptyState } from '@/components/admin/EmptyState';
import { FilterBar, SelectFilter } from '@/components/admin/FilterBar';
import { FormField, Textarea } from '@/components/admin/FormField';

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

export default function QuestionsPage() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ answered: '', search: '' });
  const [selectedQuestion, setSelectedQuestion] = useState<Question | null>(null);
  const [answerText, setAnswerText] = useState('');

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
      setQuestions([]);
    }
    setLoading(false);
  };

  const submitAnswer = async (id: string) => {
    if (!answerText.trim()) return;
    try {
      await fetch(`/api/admin/questions/${id}/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answer: answerText }),
      });
      setQuestions(questions.map(q => q.id === id ? {
        ...q,
        answer: answerText,
        answeredBy: 'Admin BioCycle',
        answeredAt: new Date().toISOString(),
      } : q));
      setSelectedQuestion(null);
      setAnswerText('');
    } catch (err) {
      console.error('Error submitting answer:', err);
    }
  };

  const togglePublic = async (id: string, isPublic: boolean) => {
    setQuestions(questions.map(q => q.id === id ? { ...q, isPublic: !isPublic } : q));
  };

  const deleteQuestion = async (id: string) => {
    if (!confirm('Supprimer cette question?')) return;
    setQuestions(questions.filter(q => q.id !== id));
  };

  const filteredQuestions = questions.filter(q => {
    if (filter.answered === 'answered' && !q.answer) return false;
    if (filter.answered === 'unanswered' && q.answer) return false;
    if (filter.search) {
      const search = filter.search.toLowerCase();
      if (!q.question.toLowerCase().includes(search) &&
          !q.productName.toLowerCase().includes(search)) {
        return false;
      }
    }
    return true;
  });

  const stats = {
    total: questions.length,
    unanswered: questions.filter(q => !q.answer).length,
    answered: questions.filter(q => q.answer).length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Questions produits"
        subtitle="Repondez aux questions des clients"
      />

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Total questions" value={stats.total} icon={MessageCircleQuestion} />
        <StatCard label="Sans reponse" value={stats.unanswered} icon={AlertCircle} />
        <StatCard label="Repondues" value={stats.answered} icon={CheckCircle} />
      </div>

      {/* Filters */}
      <FilterBar
        searchValue={filter.search}
        onSearchChange={(v) => setFilter({ ...filter, search: v })}
        searchPlaceholder="Rechercher..."
      >
        <SelectFilter
          label="Toutes"
          value={filter.answered}
          onChange={(v) => setFilter({ ...filter, answered: v })}
          options={[
            { value: 'unanswered', label: 'Sans reponse' },
            { value: 'answered', label: 'Repondues' },
          ]}
        />
      </FilterBar>

      {/* Questions List */}
      {filteredQuestions.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-lg">
          <EmptyState
            icon={MessageCircleQuestion}
            title="Aucune question trouvee"
            description="Aucune question ne correspond aux filtres selectionnes"
          />
        </div>
      ) : (
        <div className="space-y-4">
          {filteredQuestions.map((question) => (
            <div
              key={question.id}
              className={`bg-white rounded-xl border p-6 ${
                !question.answer ? 'border-yellow-300 bg-yellow-50/30' : 'border-slate-200'
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-sm text-slate-500 mb-1">
                    {question.userName} &bull; {question.productName} &bull; {new Date(question.createdAt).toLocaleDateString('fr-CA')}
                  </p>
                  {!question.answer && (
                    <StatusBadge variant="warning">
                      En attente de reponse
                    </StatusBadge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => togglePublic(question.id, question.isPublic)}
                  >
                    <StatusBadge variant={question.isPublic ? 'success' : 'neutral'}>
                      {question.isPublic ? 'Public' : 'Prive'}
                    </StatusBadge>
                  </button>
                </div>
              </div>

              <div className="mb-4">
                <p className="font-medium text-slate-900 flex items-start gap-2">
                  <span className="text-sky-500">Q:</span>
                  {question.question}
                </p>
              </div>

              {question.answer && (
                <div className="bg-emerald-50 rounded-lg p-4 mb-4">
                  <p className="text-emerald-800 flex items-start gap-2">
                    <span className="text-emerald-600 font-bold">R:</span>
                    {question.answer}
                  </p>
                  <p className="text-xs text-emerald-600 mt-2">
                    {question.answeredBy} &bull; {question.answeredAt && new Date(question.answeredAt).toLocaleDateString('fr-CA')}
                  </p>
                </div>
              )}

              <div className="flex gap-2 pt-3 border-t border-slate-100">
                <Button
                  variant="outline"
                  size="sm"
                  icon={question.answer ? Pencil : MessageSquare}
                  onClick={() => { setSelectedQuestion(question); setAnswerText(question.answer || ''); }}
                >
                  {question.answer ? 'Modifier reponse' : 'Repondre'}
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  icon={Trash2}
                  onClick={() => deleteQuestion(question.id)}
                >
                  Supprimer
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Answer Modal */}
      <Modal
        isOpen={!!selectedQuestion}
        onClose={() => setSelectedQuestion(null)}
        title="Repondre a la question"
        footer={
          <>
            <Button variant="secondary" onClick={() => setSelectedQuestion(null)}>
              Annuler
            </Button>
            <Button
              variant="primary"
              disabled={!answerText.trim()}
              onClick={() => selectedQuestion && submitAnswer(selectedQuestion.id)}
            >
              Publier la reponse
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
          <FormField label="Votre reponse">
            <Textarea
              rows={4}
              value={answerText}
              onChange={(e) => setAnswerText(e.target.value)}
              placeholder="Repondez a la question..."
            />
          </FormField>
        </div>
      </Modal>
    </div>
  );
}
