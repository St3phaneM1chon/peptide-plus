'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import {
  CheckCircle, XCircle, Clock, AlertTriangle,
  FileText, ArrowRight, Loader2,
} from 'lucide-react';
import { useI18n } from '@/i18n/client';
import { useCurrency } from '@/contexts/CurrencyContext';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EstimateItem {
  productName: string;
  description?: string | null;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  lineTotal: number;
  sortOrder: number;
}

interface EstimateData {
  estimateNumber: string;
  customerName: string;
  customerAddress?: string | null;
  customerPhone?: string | null;
  status: string;
  issueDate: string;
  validUntil: string;
  acceptedAt?: string | null;
  acceptedBy?: string | null;
  declinedAt?: string | null;
  declineReason?: string | null;
  subtotal: number;
  discountAmount: number;
  discountPercent: number;
  taxGst: number;
  taxQst: number;
  taxTotal: number;
  total: number;
  currency: string;
  notes?: string | null;
  termsConditions?: string | null;
  items: EstimateItem[];
}

// ---------------------------------------------------------------------------
// Signature Pad Component
// ---------------------------------------------------------------------------

function SignaturePad({
  onSignatureChange,
  t,
}: {
  onSignatureChange: (data: string | null) => void;
  t: (key: string) => string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  const getCoords = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    if ('touches' in e) {
      const touch = e.touches[0];
      return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }, []);

  const startDrawing = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCoords(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  }, [getCoords]);

  const draw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCoords(e);
    ctx.lineTo(x, y);
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
    setHasDrawn(true);
  }, [isDrawing, getCoords]);

  const stopDrawing = useCallback(() => {
    setIsDrawing(false);
    if (hasDrawn && canvasRef.current) {
      onSignatureChange(canvasRef.current.toDataURL('image/png'));
    }
  }, [hasDrawn, onSignatureChange]);

  const clearSignature = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !canvas) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
    onSignatureChange(null);
  }, [onSignatureChange]);

  return (
    <div className="space-y-2">
      <div className="relative border-2 border-dashed border-gray-300 rounded-lg bg-white">
        <canvas
          ref={canvasRef}
          width={600}
          height={200}
          className="w-full touch-none cursor-crosshair"
          style={{ height: '150px' }}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
        {!hasDrawn && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-gray-400 text-sm">{t('estimate.signHere')}</p>
          </div>
        )}
      </div>
      {hasDrawn && (
        <button
          onClick={clearSignature}
          className="text-sm text-red-500 hover:text-red-700 underline"
        >
          {t('estimate.clearSignature')}
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Status Badge
// ---------------------------------------------------------------------------

function EstimateStatusBadge({ status, t }: { status: string; t: (key: string) => string }) {
  const config: Record<string, { label: string; bg: string; text: string; icon: React.ReactNode }> = {
    DRAFT: { label: t('estimate.statusDraft'), bg: 'bg-gray-100', text: 'text-gray-700', icon: <Clock className="w-4 h-4" /> },
    SENT: { label: t('estimate.statusSent'), bg: 'bg-blue-100', text: 'text-blue-700', icon: <FileText className="w-4 h-4" /> },
    VIEWED: { label: t('estimate.statusViewed'), bg: 'bg-blue-100', text: 'text-blue-700', icon: <Clock className="w-4 h-4" /> },
    ACCEPTED: { label: t('estimate.statusAccepted'), bg: 'bg-green-100', text: 'text-green-700', icon: <CheckCircle className="w-4 h-4" /> },
    DECLINED: { label: t('estimate.statusDeclined'), bg: 'bg-red-100', text: 'text-red-700', icon: <XCircle className="w-4 h-4" /> },
    EXPIRED: { label: t('estimate.statusExpired'), bg: 'bg-primary-100', text: 'text-primary-700', icon: <AlertTriangle className="w-4 h-4" /> },
    CONVERTED: { label: t('estimate.statusConverted'), bg: 'bg-green-100', text: 'text-green-700', icon: <CheckCircle className="w-4 h-4" /> },
  };

  const c = config[status] || config.DRAFT;
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${c.bg} ${c.text}`}>
      {c.icon}
      {c.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export default function EstimateClientPortalPage() {
  const params = useParams();
  const token = params?.token as string;
  const { t } = useI18n();
  const { formatPrice } = useCurrency();

  const [estimate, setEstimate] = useState<EstimateData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Accept/Decline state
  const [showAcceptForm, setShowAcceptForm] = useState(false);
  const [showDeclineForm, setShowDeclineForm] = useState(false);
  const [acceptedBy, setAcceptedBy] = useState('');
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [declineReason, setDeclineReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [actionResult, setActionResult] = useState<{ success: boolean; message: string } | null>(null);

  // Fetch estimate
  useEffect(() => {
    if (!token) return;
    async function fetchEstimate() {
      try {
        const response = await fetch(`/api/estimates/${token}`);
        if (!response.ok) {
          if (response.status === 404) {
            setError(t('estimate.notFoundError'));
          } else {
            setError(t('estimate.loadError'));
          }
          return;
        }
        const data = await response.json();
        setEstimate(data.estimate);
      } catch {
        setError(t('estimate.connectionError'));
      } finally {
        setLoading(false);
      }
    }
    fetchEstimate();
  }, [token]);

  // Accept
  async function handleAccept() {
    if (!acceptedBy.trim()) {
      setActionResult({ success: false, message: t('estimate.enterName') });
      return;
    }
    if (!signatureData) {
      setActionResult({ success: false, message: t('estimate.pleaseSign') });
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(`/api/estimates/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'accept',
          acceptedBy: acceptedBy.trim(),
          signatureData,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        setActionResult({ success: false, message: data.error || t('estimate.genericError') });
        return;
      }

      setEstimate(data.estimate);
      setShowAcceptForm(false);
      setActionResult({ success: true, message: t('estimate.acceptedSuccess') });
    } catch {
      setActionResult({ success: false, message: t('estimate.connectionErrorShort') });
    } finally {
      setSubmitting(false);
    }
  }

  // Decline
  async function handleDecline() {
    setSubmitting(true);
    try {
      const response = await fetch(`/api/estimates/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'decline',
          declineReason: declineReason.trim() || undefined,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        setActionResult({ success: false, message: data.error || t('estimate.genericError') });
        return;
      }

      setEstimate(data.estimate);
      setShowDeclineForm(false);
      setActionResult({ success: true, message: t('estimate.declinedSuccess') });
    } catch {
      setActionResult({ success: false, message: t('estimate.connectionErrorShort') });
    } finally {
      setSubmitting(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Loading / Error states
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="min-h-screen bg-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">{t('estimate.loading')}</p>
        </div>
      </div>
    );
  }

  if (error || !estimate) {
    return (
      <div className="min-h-screen bg-indigo-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <AlertTriangle className="w-12 h-12 text-primary-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-900 mb-2">{t('estimate.notFound')}</h1>
          <p className="text-gray-600">{error || t('estimate.invalidLink')}</p>
        </div>
      </div>
    );
  }

  const formatDate = (d: string) => new Date(d).toLocaleDateString('fr-CA', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  const canAct = ['SENT', 'VIEWED'].includes(estimate.status);

  return (
    <div className="min-h-screen bg-indigo-50 py-8 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          {/* Company Banner */}
          <div className="bg-indigo-600 px-8 py-6 text-white">
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-2xl font-bold">BioCycle Peptides</h1>
                <p className="text-indigo-200 text-sm mt-1">Research-grade peptides</p>
              </div>
              <div className="text-end">
                <p className="text-sm text-indigo-200">{t('estimate.estimateNumber')}</p>
                <p className="text-lg font-bold">{estimate.estimateNumber}</p>
              </div>
            </div>
          </div>

          {/* Status Banner */}
          <div className="px-8 py-4 border-b bg-gray-50 flex items-center justify-between flex-wrap gap-3">
            <EstimateStatusBadge status={estimate.status} t={t} />
            <div className="text-sm text-gray-500">
              {t('estimate.validUntil')} <strong>{formatDate(estimate.validUntil)}</strong>
            </div>
          </div>

          {/* Action Result */}
          {actionResult && (
            <div className={`px-8 py-3 ${actionResult.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'} text-sm font-medium`}>
              {actionResult.success ? <CheckCircle className="inline w-4 h-4 me-2" /> : <XCircle className="inline w-4 h-4 me-2" />}
              {actionResult.message}
            </div>
          )}

          {/* Client Info */}
          <div className="px-8 py-6 border-b">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">{t('estimate.client')}</p>
                <p className="font-semibold text-gray-900">{estimate.customerName}</p>
                {estimate.customerAddress && (
                  <p className="text-sm text-gray-600 mt-1">{estimate.customerAddress}</p>
                )}
                {estimate.customerPhone && (
                  <p className="text-sm text-gray-600">{estimate.customerPhone}</p>
                )}
              </div>
              <div className="md:text-end">
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">{t('estimate.dates')}</p>
                <p className="text-sm text-gray-700">
                  {t('estimate.issuedOn')} <strong>{formatDate(estimate.issueDate)}</strong>
                </p>
                <p className="text-sm text-gray-700">
                  {t('estimate.validUntilLabel')} <strong>{formatDate(estimate.validUntil)}</strong>
                </p>
              </div>
            </div>
          </div>

          {/* Items Table */}
          <div className="px-8 py-6">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-gray-200">
                    <th className="text-start py-3 font-semibold text-gray-700">{t('estimate.article')}</th>
                    <th className="text-end py-3 font-semibold text-gray-700">{t('estimate.qty')}</th>
                    <th className="text-end py-3 font-semibold text-gray-700">{t('estimate.unitPrice')}</th>
                    {estimate.items.some(i => i.discountPercent > 0) && (
                      <th className="text-end py-3 font-semibold text-gray-700">{t('estimate.discount')}</th>
                    )}
                    <th className="text-end py-3 font-semibold text-gray-700">{t('estimate.total')}</th>
                  </tr>
                </thead>
                <tbody>
                  {estimate.items
                    .sort((a, b) => a.sortOrder - b.sortOrder)
                    .map((item, idx) => (
                      <tr key={idx} className="border-b border-gray-100">
                        <td className="py-3">
                          <p className="font-medium text-gray-900">{item.productName}</p>
                          {item.description && (
                            <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>
                          )}
                        </td>
                        <td className="py-3 text-end text-gray-700">{item.quantity}</td>
                        <td className="py-3 text-end text-gray-700">{formatPrice(item.unitPrice)}</td>
                        {estimate.items.some(i => i.discountPercent > 0) && (
                          <td className="py-3 text-end text-gray-700">
                            {item.discountPercent > 0 ? `${item.discountPercent}%` : '-'}
                          </td>
                        )}
                        <td className="py-3 text-end font-medium text-gray-900">{formatPrice(item.lineTotal)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div className="mt-6 flex justify-end">
              <div className="w-72">
                <div className="flex justify-between py-1.5 text-sm">
                  <span className="text-gray-600">{t('estimate.subtotal')}</span>
                  <span className="text-gray-900">{formatPrice(estimate.subtotal)}</span>
                </div>
                {estimate.discountAmount > 0 && (
                  <div className="flex justify-between py-1.5 text-sm text-primary-600">
                    <span>{t('estimate.discountLabel')} ({estimate.discountPercent}%)</span>
                    <span>-{formatPrice(estimate.discountAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between py-1.5 text-sm">
                  <span className="text-gray-500">{t('estimate.gst')}</span>
                  <span className="text-gray-700">{formatPrice(estimate.taxGst)}</span>
                </div>
                <div className="flex justify-between py-1.5 text-sm">
                  <span className="text-gray-500">{t('estimate.qst')}</span>
                  <span className="text-gray-700">{formatPrice(estimate.taxQst)}</span>
                </div>
                <div className="flex justify-between py-3 border-t-2 border-gray-200 text-lg font-bold">
                  <span className="text-gray-900">{t('estimate.total')}</span>
                  <span className="text-indigo-600">{formatPrice(estimate.total)} {estimate.currency}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Notes */}
          {estimate.notes && (
            <div className="px-8 py-4 border-t bg-gray-50">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">{t('estimate.notes')}</p>
              <p className="text-sm text-gray-700 whitespace-pre-line">{estimate.notes}</p>
            </div>
          )}

          {/* Terms & Conditions */}
          {estimate.termsConditions && (
            <div className="px-8 py-4 border-t bg-gray-50">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">{t('estimate.termsConditions')}</p>
              <p className="text-sm text-gray-600 whitespace-pre-line">{estimate.termsConditions}</p>
            </div>
          )}

          {/* Action Buttons */}
          {canAct && !showAcceptForm && !showDeclineForm && (
            <div className="px-8 py-6 border-t bg-white flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={() => setShowAcceptForm(true)}
                className="flex items-center justify-center gap-2 px-8 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-semibold transition-colors shadow-lg shadow-green-200"
              >
                <CheckCircle className="w-5 h-5" />
                {t('estimate.acceptEstimate')}
              </button>
              <button
                onClick={() => setShowDeclineForm(true)}
                className="flex items-center justify-center gap-2 px-8 py-3 bg-white hover:bg-gray-50 text-gray-700 rounded-xl font-semibold transition-colors border-2 border-gray-300"
              >
                <XCircle className="w-5 h-5" />
                {t('estimate.decline')}
              </button>
            </div>
          )}

          {/* Accept Form */}
          {showAcceptForm && (
            <div className="px-8 py-6 border-t bg-green-50">
              <h3 className="text-lg font-bold text-green-900 mb-4">{t('estimate.acceptTitle')}</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-green-800 mb-1">
                    {t('estimate.fullName')}
                  </label>
                  <input
                    type="text"
                    value={acceptedBy}
                    onChange={(e) => setAcceptedBy(e.target.value)}
                    placeholder={t('estimate.namePlaceholder')}
                    className="w-full px-4 py-2.5 border border-green-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-green-800 mb-1">
                    {t('estimate.signatureLabel')}
                  </label>
                  <SignaturePad onSignatureChange={setSignatureData} t={t} />
                </div>
                <p className="text-xs text-green-700">
                  {t('estimate.signatureDisclaimer')}
                </p>
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={handleAccept}
                    disabled={submitting}
                    className="flex items-center gap-2 px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition-colors disabled:opacity-50"
                  >
                    {submitting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <ArrowRight className="w-4 h-4" />
                    )}
                    {submitting ? t('estimate.sending') : t('estimate.confirmAccept')}
                  </button>
                  <button
                    onClick={() => setShowAcceptForm(false)}
                    className="px-6 py-2.5 text-gray-600 hover:text-gray-800 font-medium"
                  >
                    {t('estimate.cancel')}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Decline Form */}
          {showDeclineForm && (
            <div className="px-8 py-6 border-t bg-red-50">
              <h3 className="text-lg font-bold text-red-900 mb-4">{t('estimate.declineTitle')}</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-red-800 mb-1">
                    {t('estimate.declineReasonLabel')}
                  </label>
                  <textarea
                    value={declineReason}
                    onChange={(e) => setDeclineReason(e.target.value)}
                    rows={3}
                    placeholder={t('estimate.declineReasonPlaceholder')}
                    className="w-full px-4 py-2.5 border border-red-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 bg-white"
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={handleDecline}
                    disabled={submitting}
                    className="flex items-center gap-2 px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold transition-colors disabled:opacity-50"
                  >
                    {submitting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <XCircle className="w-4 h-4" />
                    )}
                    {submitting ? t('estimate.sending') : t('estimate.confirmDecline')}
                  </button>
                  <button
                    onClick={() => setShowDeclineForm(false)}
                    className="px-6 py-2.5 text-gray-600 hover:text-gray-800 font-medium"
                  >
                    {t('estimate.cancel')}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Accepted confirmation */}
          {estimate.status === 'ACCEPTED' && (
            <div className="px-8 py-6 border-t bg-green-50">
              <div className="text-center">
                <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
                <h3 className="text-lg font-bold text-green-900 mb-1">{t('estimate.estimateAccepted')}</h3>
                <p className="text-sm text-green-700">
                  {t('estimate.acceptedBy')} <strong>{estimate.acceptedBy}</strong>
                  {estimate.acceptedAt && (
                    <span> {t('estimate.onDate')} {formatDate(estimate.acceptedAt)}</span>
                  )}
                </p>
              </div>
            </div>
          )}

          {/* Declined confirmation */}
          {estimate.status === 'DECLINED' && (
            <div className="px-8 py-6 border-t bg-red-50">
              <div className="text-center">
                <XCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
                <h3 className="text-lg font-bold text-red-900 mb-1">{t('estimate.estimateDeclined')}</h3>
                {estimate.declineReason && (
                  <p className="text-sm text-red-700 mt-2">
                    {t('estimate.reason')} {estimate.declineReason}
                  </p>
                )}
                {estimate.declinedAt && (
                  <p className="text-xs text-red-500 mt-1">
                    {t('estimate.declinedOn')} {formatDate(estimate.declinedAt)}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Expired */}
          {estimate.status === 'EXPIRED' && (
            <div className="px-8 py-6 border-t bg-primary-50">
              <div className="text-center">
                <AlertTriangle className="w-12 h-12 text-primary-500 mx-auto mb-3" />
                <h3 className="text-lg font-bold text-primary-900 mb-1">{t('estimate.estimateExpired')}</h3>
                <p className="text-sm text-primary-700">
                  {t('estimate.expiredMessage').replace('{date}', formatDate(estimate.validUntil))}
                </p>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="px-8 py-4 bg-gray-50 border-t text-center">
            <p className="text-xs text-gray-400">
              {t('estimate.footer')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
