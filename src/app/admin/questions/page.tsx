'use client';

import { useState, useEffect } from 'react';

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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Questions produits</h1>
          <p className="text-gray-500">Répondez aux questions des clients</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <p className="text-sm text-gray-500">Total questions</p>
          <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
        </div>
        <div className="bg-yellow-50 rounded-xl p-4 border border-yellow-200">
          <p className="text-sm text-yellow-600">Sans réponse</p>
          <p className="text-2xl font-bold text-yellow-700">{stats.unanswered}</p>
        </div>
        <div className="bg-green-50 rounded-xl p-4 border border-green-200">
          <p className="text-sm text-green-600">Répondues</p>
          <p className="text-2xl font-bold text-green-700">{stats.answered}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl p-4 border border-gray-200">
        <div className="flex flex-wrap gap-4">
          <input
            type="text"
            placeholder="Rechercher..."
            className="flex-1 min-w-[200px] px-4 py-2 border border-gray-300 rounded-lg"
            value={filter.search}
            onChange={(e) => setFilter({ ...filter, search: e.target.value })}
          />
          <select
            className="px-4 py-2 border border-gray-300 rounded-lg"
            value={filter.answered}
            onChange={(e) => setFilter({ ...filter, answered: e.target.value })}
          >
            <option value="">Toutes</option>
            <option value="unanswered">Sans réponse</option>
            <option value="answered">Répondues</option>
          </select>
        </div>
      </div>

      {/* Questions List */}
      <div className="space-y-4">
        {filteredQuestions.map((question) => (
          <div 
            key={question.id} 
            className={`bg-white rounded-xl border p-6 ${
              !question.answer ? 'border-yellow-300 bg-yellow-50/30' : 'border-gray-200'
            }`}
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-sm text-gray-500 mb-1">
                  {question.userName} • {question.productName} • {new Date(question.createdAt).toLocaleDateString('fr-CA')}
                </p>
                {!question.answer && (
                  <span className="inline-block px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs rounded-full">
                    En attente de réponse
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => togglePublic(question.id, question.isPublic)}
                  className={`px-2 py-1 rounded text-xs ${
                    question.isPublic 
                      ? 'bg-green-100 text-green-700' 
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {question.isPublic ? 'Public' : 'Privé'}
                </button>
              </div>
            </div>

            <div className="mb-4">
              <p className="font-medium text-gray-900 flex items-start gap-2">
                <span className="text-amber-500">Q:</span>
                {question.question}
              </p>
            </div>

            {question.answer && (
              <div className="bg-green-50 rounded-lg p-4 mb-4">
                <p className="text-green-800 flex items-start gap-2">
                  <span className="text-green-600 font-bold">R:</span>
                  {question.answer}
                </p>
                <p className="text-xs text-green-600 mt-2">
                  {question.answeredBy} • {question.answeredAt && new Date(question.answeredAt).toLocaleDateString('fr-CA')}
                </p>
              </div>
            )}

            <div className="flex gap-2 pt-3 border-t border-gray-100">
              <button
                onClick={() => { setSelectedQuestion(question); setAnswerText(question.answer || ''); }}
                className="px-3 py-1 bg-amber-100 text-amber-700 rounded text-sm hover:bg-amber-200"
              >
                {question.answer ? 'Modifier réponse' : 'Répondre'}
              </button>
              <button
                onClick={() => deleteQuestion(question.id)}
                className="px-3 py-1 bg-red-100 text-red-700 rounded text-sm hover:bg-red-200"
              >
                Supprimer
              </button>
            </div>
          </div>
        ))}

        {filteredQuestions.length === 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-500">
            Aucune question trouvée
          </div>
        )}
      </div>

      {/* Answer Modal */}
      {selectedQuestion && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Répondre à la question</h3>
              <button onClick={() => setSelectedQuestion(null)} className="p-1 hover:bg-gray-100 rounded">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-sm text-gray-500 mb-1">{selectedQuestion.userName} - {selectedQuestion.productName}</p>
                <p className="font-medium text-gray-900">{selectedQuestion.question}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Votre réponse</label>
                <textarea
                  rows={4}
                  value={answerText}
                  onChange={(e) => setAnswerText(e.target.value)}
                  placeholder="Répondez à la question..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setSelectedQuestion(null)}
                  className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                >
                  Annuler
                </button>
                <button
                  onClick={() => submitAnswer(selectedQuestion.id)}
                  disabled={!answerText.trim()}
                  className="flex-1 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-50"
                >
                  Publier la réponse
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
