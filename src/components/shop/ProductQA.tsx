'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useTranslations } from '@/hooks/useTranslations';
import Link from 'next/link';

interface Answer {
  id: string;
  userId: string;
  userName: string;
  content: string;
  helpful: number;
  isOfficial: boolean;
  createdAt: string;
}

interface Question {
  id: string;
  userId: string;
  userName: string;
  content: string;
  answers: Answer[];
  createdAt: string;
}

interface ProductQAProps {
  productId: string;
  productName: string;
}

// Q&A loaded from API (empty by default until Q&A system is implemented)

export default function ProductQA({ productId: _productId, productName }: ProductQAProps) {
  const { data: session } = useSession();
  const { t } = useTranslations();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [showAskQuestion, setShowAskQuestion] = useState(false);
  const [expandedQuestion, setExpandedQuestion] = useState<string | null>(null);
  const [newQuestion, setNewQuestion] = useState('');
  const [newAnswer, setNewAnswer] = useState<{ questionId: string; content: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Filter questions by search
  const filteredQuestions = questions.filter(q => 
    q.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
    q.answers.some(a => a.content.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleAskQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session || !newQuestion.trim()) return;
    
    setIsSubmitting(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const question: Question = {
      id: Date.now().toString(),
      userId: session.user?.email || '',
      userName: session.user?.name || 'Anonymous',
      content: newQuestion,
      answers: [],
      createdAt: new Date().toISOString(),
    };
    
    setQuestions(prev => [question, ...prev]);
    setIsSubmitting(false);
    setShowAskQuestion(false);
    setNewQuestion('');
  };

  const handleSubmitAnswer = async (questionId: string) => {
    if (!session || !newAnswer?.content.trim()) return;
    
    setIsSubmitting(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const answer: Answer = {
      id: Date.now().toString(),
      userId: session.user?.email || '',
      userName: session.user?.name || 'Anonymous',
      content: newAnswer.content,
      helpful: 0,
      isOfficial: false,
      createdAt: new Date().toISOString(),
    };
    
    setQuestions(prev => prev.map(q => 
      q.id === questionId ? { ...q, answers: [...q.answers, answer] } : q
    ));
    setIsSubmitting(false);
    setNewAnswer(null);
  };

  const handleHelpful = (questionId: string, answerId: string) => {
    setQuestions(prev => prev.map(q => 
      q.id === questionId ? {
        ...q,
        answers: q.answers.map(a => 
          a.id === answerId ? { ...a, helpful: a.helpful + 1 } : a
        ),
      } : q
    ));
  };

  return (
    <div className="mt-12 border-t pt-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold">{t('qa.questionsAnswers') || 'Questions & Answers'}</h2>
          <p className="text-neutral-500">{questions.length} {t('qa.questionsAbout') || 'questions about'} {productName}</p>
        </div>
        
        <button
          onClick={() => setShowAskQuestion(true)}
          className="px-6 py-3 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition-colors"
        >
          {t('qa.askQuestion') || 'Ask a Question'}
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t('qa.searchQuestions') || 'Search questions...'}
          className="w-full pl-12 pr-4 py-3 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
        />
      </div>

      {/* Questions List */}
      <div className="space-y-4">
        {filteredQuestions.length === 0 ? (
          <div className="text-center py-12 bg-neutral-50 rounded-xl">
            <span className="text-5xl mb-4 block">❓</span>
            <h3 className="text-lg font-bold mb-2">{t('qa.noQuestions') || 'No questions yet'}</h3>
            <p className="text-neutral-500 mb-4">{t('qa.beFirst') || 'Be the first to ask a question about this product!'}</p>
            <button
              onClick={() => setShowAskQuestion(true)}
              className="px-6 py-3 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600"
            >
              {t('qa.askQuestion') || 'Ask a Question'}
            </button>
          </div>
        ) : (
          filteredQuestions.map((question) => (
            <div key={question.id} className="border border-neutral-200 rounded-xl overflow-hidden">
              {/* Question */}
              <div 
                className="p-4 bg-neutral-50 cursor-pointer hover:bg-neutral-100 transition-colors"
                onClick={() => setExpandedQuestion(expandedQuestion === question.id ? null : question.id)}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-orange-500 font-bold text-lg">Q:</span>
                      <span className="text-xs text-neutral-500">
                        {question.userName} • {new Date(question.createdAt).toLocaleDateString('en-CA', { 
                          year: 'numeric', month: 'short', day: 'numeric' 
                        })}
                      </span>
                    </div>
                    <p className="font-medium">{question.content}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-neutral-500">
                      {question.answers.length} {question.answers.length === 1 ? 'answer' : 'answers'}
                    </span>
                    <svg 
                      className={`w-5 h-5 text-neutral-400 transition-transform ${expandedQuestion === question.id ? 'rotate-180' : ''}`} 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Answers */}
              {expandedQuestion === question.id && (
                <div className="border-t border-neutral-200">
                  {question.answers.length > 0 ? (
                    <div className="divide-y divide-neutral-200">
                      {question.answers.map((answer) => (
                        <div key={answer.id} className="p-4">
                          <div className="flex items-start gap-3">
                            <span className="text-green-600 font-bold text-lg">A:</span>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <span className={`text-sm font-medium ${answer.isOfficial ? 'text-orange-600' : 'text-neutral-600'}`}>
                                  {answer.userName}
                                </span>
                                {answer.isOfficial && (
                                  <span className="px-2 py-0.5 bg-orange-100 text-orange-700 text-xs font-medium rounded-full">
                                    Official
                                  </span>
                                )}
                                <span className="text-xs text-neutral-500">
                                  {new Date(answer.createdAt).toLocaleDateString('en-CA', { 
                                    year: 'numeric', month: 'short', day: 'numeric' 
                                  })}
                                </span>
                              </div>
                              <p className="text-neutral-600">{answer.content}</p>
                              <button
                                onClick={() => handleHelpful(question.id, answer.id)}
                                className="mt-2 text-sm text-neutral-500 hover:text-neutral-700 flex items-center gap-1"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
                                </svg>
                                Helpful ({answer.helpful})
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 text-center text-neutral-500">
                      {t('qa.noAnswersYet') || 'No answers yet. Be the first to answer!'}
                    </div>
                  )}

                  {/* Answer Form */}
                  <div className="p-4 bg-neutral-50 border-t border-neutral-200">
                    {newAnswer?.questionId === question.id ? (
                      <div className="space-y-3">
                        <textarea
                          value={newAnswer.content}
                          onChange={(e) => setNewAnswer({ ...newAnswer, content: e.target.value })}
                          placeholder={t('qa.writeAnswer') || 'Write your answer...'}
                          rows={3}
                          className="w-full px-4 py-3 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
                        />
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleSubmitAnswer(question.id)}
                            disabled={isSubmitting || !newAnswer.content.trim()}
                            className="px-4 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 disabled:opacity-50"
                          >
                            {isSubmitting ? 'Submitting...' : t('qa.submitAnswer') || 'Submit Answer'}
                          </button>
                          <button
                            onClick={() => setNewAnswer(null)}
                            className="px-4 py-2 text-neutral-600 hover:text-neutral-800"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : session ? (
                      <button
                        onClick={() => setNewAnswer({ questionId: question.id, content: '' })}
                        className="text-orange-600 hover:text-orange-700 font-medium"
                      >
                        + {t('qa.addAnswer') || 'Add an Answer'}
                      </button>
                    ) : (
                      <Link href="/auth/signin" className="text-orange-600 hover:text-orange-700 font-medium">
                        {t('qa.signInToAnswer') || 'Sign in to answer'}
                      </Link>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Ask Question Modal */}
      {showAskQuestion && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full">
            <div className="p-6 border-b">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold">{t('qa.askAbout') || 'Ask about'} {productName}</h3>
                <button onClick={() => setShowAskQuestion(false)} className="p-2 hover:bg-neutral-100 rounded-lg">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            
            {!session ? (
              <div className="p-6 text-center">
                <p className="text-neutral-600 mb-4">{t('qa.signInRequired') || 'Please sign in to ask a question'}</p>
                <Link
                  href="/auth/signin"
                  className="inline-block px-6 py-3 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600"
                >
                  {t('qa.signIn') || 'Sign In'}
                </Link>
              </div>
            ) : (
              <form onSubmit={handleAskQuestion} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">{t('qa.yourQuestion') || 'Your Question'}</label>
                  <textarea
                    value={newQuestion}
                    onChange={(e) => setNewQuestion(e.target.value)}
                    placeholder={t('qa.questionPlaceholder') || 'What would you like to know about this product?'}
                    rows={4}
                    className="w-full px-4 py-3 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
                    required
                  />
                </div>

                <div className="bg-blue-50 rounded-lg p-4 flex items-start gap-3">
                  <svg className="w-5 h-5 text-blue-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <p className="text-sm text-blue-800">{t('qa.tipTitle') || 'Tip: Be specific!'}</p>
                    <p className="text-sm text-blue-600">{t('qa.tipDesc') || 'Questions about reconstitution, storage, and shipping get answered fastest.'}</p>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting || !newQuestion.trim()}
                  className="w-full py-3 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      {t('qa.submitting') || 'Submitting...'}
                    </>
                  ) : (
                    t('qa.submitQuestion') || 'Submit Question'
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
