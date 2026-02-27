'use client';

/**
 * Public Consent Form Page
 * Clients access this via a unique token sent by email
 */

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import { useI18n } from '@/i18n/client';
import {
  FileCheck, Loader2, CheckCircle, AlertCircle, Send,
} from 'lucide-react';
import { toast } from 'sonner';

interface ConsentData {
  id: string;
  type: string;
  clientName: string | null;
  videoTitle: string | null;
  videoThumbnail: string | null;
  template: {
    name: string;
    description: string | null;
    questions: Array<{
      id: string;
      question: string;
      type: 'checkbox' | 'text' | 'signature';
      required: boolean;
    }>;
    legalText: string | null;
  } | null;
}

export default function ConsentFormPage() {
  const { t } = useI18n();
  const params = useParams();
  const token = params.token as string;

  const [consent, setConsent] = useState<ConsentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [responses, setResponses] = useState<Record<string, string | boolean>>({});

  useEffect(() => {
    async function fetchConsent() {
      try {
        const res = await fetch(`/api/consent/${token}`);
        if (!res.ok) {
          const data = await res.json();
          setError(data.error || 'Consent request not found');
          return;
        }
        const data = await res.json();
        setConsent(data.consent);

        // Init responses
        if (data.consent.template?.questions) {
          const init: Record<string, string | boolean> = {};
          for (const q of data.consent.template.questions) {
            init[q.id] = q.type === 'checkbox' ? false : '';
          }
          setResponses(init);
        }
      } catch {
        setError('Failed to load consent form');
      } finally {
        setLoading(false);
      }
    }
    fetchConsent();
  }, [token]);

  const handleSubmit = async () => {
    if (!consent?.template?.questions) return;

    // Validate required fields
    for (const q of consent.template.questions) {
      if (q.required) {
        const answer = responses[q.id];
        if (q.type === 'checkbox' && answer !== true) {
          toast.error(`Please check: "${q.question}"`);
          return;
        }
        if ((q.type === 'text' || q.type === 'signature') && (!answer || String(answer).trim() === '')) {
          toast.error(`Please fill in: "${q.question}"`);
          return;
        }
      }
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/consent/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ responses }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Submission failed');
      }

      setSubmitted(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-orange-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-900 mb-2">
            {t('consent.error') !== 'consent.error' ? t('consent.error') : 'Error'}
          </h1>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md text-center">
          <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-900 mb-2">
            {t('consent.thankYou') !== 'consent.thankYou' ? t('consent.thankYou') : 'Thank You!'}
          </h1>
          <p className="text-gray-600">
            {t('consent.submitted') !== 'consent.submitted' ? t('consent.submitted') : 'Your consent has been recorded. You will receive a confirmation email shortly.'}
          </p>
        </div>
      </div>
    );
  }

  if (!consent) return null;

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="bg-gradient-to-r from-orange-500 to-orange-600 p-6 text-white">
            <div className="flex items-center gap-3 mb-2">
              <FileCheck className="h-6 w-6" />
              <h1 className="text-xl font-bold">
                {t('consent.title') !== 'consent.title' ? t('consent.title') : 'Consent Form'}
              </h1>
            </div>
            {consent.template && (
              <p className="text-orange-100 text-sm">{consent.template.name}</p>
            )}
          </div>

          <div className="p-6 space-y-6">
            {/* Welcome message */}
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <p className="text-sm text-gray-700">
                {t('consent.hello') !== 'consent.hello' ? t('consent.hello') : 'Hello'}{' '}
                <strong>{consent.clientName || 'Client'}</strong>,
              </p>
              <p className="text-sm text-gray-600 mt-1">
                {t('consent.intro') !== 'consent.intro'
                  ? t('consent.intro')
                  : 'We are requesting your consent regarding the following content. Please review the details and respond to each question below.'}
              </p>
            </div>

            {/* Video preview */}
            {consent.videoTitle && (
              <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                {consent.videoThumbnail ? (
                  <Image
                    src={consent.videoThumbnail}
                    alt={consent.videoTitle}
                    width={120}
                    height={68}
                    className="rounded object-cover"
                  />
                ) : (
                  <div className="w-[120px] h-[68px] bg-gray-200 rounded flex items-center justify-center">
                    <FileCheck className="h-6 w-6 text-gray-400" />
                  </div>
                )}
                <div>
                  <p className="text-sm font-medium text-gray-700">
                    {t('consent.relatedContent') !== 'consent.relatedContent' ? t('consent.relatedContent') : 'Related Content'}
                  </p>
                  <p className="text-sm text-gray-900 font-semibold">{consent.videoTitle}</p>
                </div>
              </div>
            )}

            {/* Template description */}
            {consent.template?.description && (
              <p className="text-sm text-gray-600">{consent.template.description}</p>
            )}

            {/* Questions */}
            {consent.template?.questions && (
              <div className="space-y-4">
                {consent.template.questions.map(q => (
                  <div key={q.id} className="space-y-1.5">
                    <label className="flex items-start gap-2 text-sm text-gray-800">
                      {q.type === 'checkbox' ? (
                        <input
                          type="checkbox"
                          checked={responses[q.id] === true}
                          onChange={e => setResponses(r => ({ ...r, [q.id]: e.target.checked }))}
                          className="mt-0.5 h-4 w-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                        />
                      ) : null}
                      <span>
                        {q.question}
                        {q.required && <span className="text-red-500 ml-0.5">*</span>}
                      </span>
                    </label>
                    {q.type === 'text' && (
                      <textarea
                        value={String(responses[q.id] || '')}
                        onChange={e => setResponses(r => ({ ...r, [q.id]: e.target.value }))}
                        className="w-full border rounded-lg px-3 py-2 text-sm"
                        rows={3}
                        placeholder="Your answer..."
                      />
                    )}
                    {q.type === 'signature' && (
                      <div>
                        <input
                          type="text"
                          value={String(responses[q.id] || '')}
                          onChange={e => setResponses(r => ({ ...r, [q.id]: e.target.value }))}
                          className="w-full border rounded-lg px-3 py-2 text-sm font-cursive italic"
                          placeholder="Type your full name as electronic signature"
                        />
                        <p className="text-xs text-gray-400 mt-0.5">
                          {t('consent.signatureNote') !== 'consent.signatureNote'
                            ? t('consent.signatureNote')
                            : 'By typing your name, you agree this constitutes an electronic signature.'}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Legal text */}
            {consent.template?.legalText && (
              <div className="bg-gray-50 border rounded-lg p-4 max-h-48 overflow-y-auto">
                <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">
                  {t('consent.legalTerms') !== 'consent.legalTerms' ? t('consent.legalTerms') : 'Terms & Conditions'}
                </h3>
                <div className="text-xs text-gray-600 whitespace-pre-wrap">{consent.template.legalText}</div>
              </div>
            )}

            {/* Submit */}
            <div className="pt-4 border-t">
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-medium disabled:opacity-50"
              >
                {submitting ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Send className="h-5 w-5" />
                )}
                {t('consent.submit') !== 'consent.submit' ? t('consent.submit') : 'Submit Consent'}
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-gray-400 mt-6">
          BioCycle Peptides · biocyclepeptides.com
        </p>
      </div>
    </div>
  );
}
