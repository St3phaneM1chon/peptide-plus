'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { ScanLine, CheckCircle2, AlertTriangle, Clock, X } from 'lucide-react';
import { useI18n } from '@/i18n/client';
import { toast } from 'sonner';
import { sectionThemes } from '@/lib/admin/section-themes';
import { SectionCard, StatCard } from '@/components/admin';
import { useRibbonAction } from '@/hooks/useRibbonAction';
import { addCSRFHeader } from '@/lib/csrf';

interface ExtractedInvoice {
  invoiceNumber?: string;
  invoiceDate?: string;
  dueDate?: string;
  supplierName?: string;
  supplierAddress?: string;
  subtotal?: number;
  taxTps?: number;
  taxTvq?: number;
  total?: number;
  items?: { description: string; quantity: number; unitPrice: number; total: number }[];
  confidence: number;
  needsReview: string[];
}

interface ScanHistory {
  id: string;
  fileName: string;
  supplierName: string;
  total: number;
  status: 'SUCCESS' | 'NEEDS_REVIEW' | 'FAILED';
  createdAt: Date;
}

interface ChartAccount {
  id: string;
  code: string;
  name: string;
  type: string;
}

// Editable review form state
interface ReviewFormData {
  invoiceNumber: string;
  supplierName: string;
  invoiceDate: string;
  dueDate: string;
  description: string;
  subtotal: number;
  taxTps: number;
  taxTvq: number;
  total: number;
  accountCode: string;
}

export default function OCRPage() {
  const { t, locale: _locale, formatCurrency } = useI18n();
  const theme = sectionThemes.entry;
  const [scanning, setScanning] = useState(false);
  const [extractedData, setExtractedData] = useState<ExtractedInvoice | null>(null);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [history, setHistory] = useState<ScanHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Review modal state
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewForm, setReviewForm] = useState<ReviewFormData>({
    invoiceNumber: '',
    supplierName: '',
    invoiceDate: '',
    dueDate: '',
    description: '',
    subtotal: 0,
    taxTps: 0,
    taxTvq: 0,
    total: 0,
    accountCode: '6310',
  });
  const [saving, setSaving] = useState(false);

  // Chart of accounts for account selector
  const [accounts, setAccounts] = useState<ChartAccount[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);

  useEffect(() => {
    loadHistory();
    loadAccounts();
  }, []);

  const loadHistory = async () => {
    setLoadingHistory(true);
    setError(null);
    try {
      const response = await fetch('/api/accounting/ocr/history');
      if (!response.ok) throw new Error(t('admin.ocrScan.apiError', { status: response.status }));
      const data = await response.json();
      setHistory(data.scans || data.history || data.data || []);
    } catch (err) {
      console.error('Error loading OCR history:', err);
      setError(t('admin.ocrScan.loadError'));
      setHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  const loadAccounts = async () => {
    setLoadingAccounts(true);
    try {
      const response = await fetch('/api/accounting/chart-of-accounts?limit=200');
      if (!response.ok) throw new Error('Failed to load accounts');
      const data = await response.json();
      const accountList = data.accounts || data.data || data || [];
      // Filter to expense and COGS accounts (5xxx, 6xxx) for the selector
      const expenseAccounts = accountList.filter((a: ChartAccount) =>
        a.code.startsWith('5') || a.code.startsWith('6')
      );
      setAccounts(expenseAccounts.length > 0 ? expenseAccounts : accountList);
    } catch (err) {
      console.error('Error loading accounts:', err);
      // Fallback to static options
      setAccounts([
        { id: '1', code: '6310', name: 'Hébergement Azure', type: 'EXPENSE' },
        { id: '2', code: '6330', name: 'Services SaaS', type: 'EXPENSE' },
        { id: '3', code: '6210', name: 'Marketing Google', type: 'EXPENSE' },
        { id: '4', code: '6010', name: 'Expédition Canada Post', type: 'EXPENSE' },
        { id: '5', code: '5010', name: 'Achats', type: 'EXPENSE' },
      ]);
    } finally {
      setLoadingAccounts(false);
    }
  };

  const handleFileSelect = async (file: File) => {
    if (!file) return;

    // Validate file type
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'application/pdf'];
    if (!validTypes.includes(file.type)) {
      toast.error(t('admin.ocrScan.unsupportedType'));
      return;
    }

    // Validate file size (max 20MB)
    if (file.size > 20 * 1024 * 1024) {
      toast.error(t('admin.ocrScan.fileTooLarge'));
      return;
    }

    // Show preview for images
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => setUploadedImage(e.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setUploadedImage(null);
    }

    // Start scanning via API
    setScanning(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/accounting/ocr/scan', {
        method: 'POST',
        body: formData,
      });
      if (!response.ok) throw new Error(t('admin.ocrScan.apiError', { status: response.status }));
      const data = await response.json();
      const extracted = data.data || data.extractedData || null;
      setExtractedData(extracted);

      // Auto-open review modal when scan completes
      if (extracted) {
        openReviewModal(extracted);
      }
    } catch (error) {
      console.error('Error scanning invoice:', error);
      setExtractedData(null);
    } finally {
      setScanning(false);
    }
  };

  const openReviewModal = (data: ExtractedInvoice) => {
    setReviewForm({
      invoiceNumber: data.invoiceNumber || '',
      supplierName: data.supplierName || '',
      invoiceDate: data.invoiceDate || new Date().toISOString().split('T')[0],
      dueDate: data.dueDate || '',
      description: data.items?.map(i => i.description).join(', ') || '',
      subtotal: data.subtotal || 0,
      taxTps: data.taxTps || 0,
      taxTvq: data.taxTvq || 0,
      total: data.total || 0,
      accountCode: '6310',
    });
    setShowReviewModal(true);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);

    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  };

  const updateReviewField = (field: keyof ReviewFormData, value: string | number) => {
    setReviewForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSaveAsJournalEntry = async () => {
    if (saving) return;

    // Validate required fields
    if (!reviewForm.supplierName.trim()) {
      toast.error(t('admin.ocrScan.supplierRequired') || 'Le nom du fournisseur est requis');
      return;
    }
    if (reviewForm.total <= 0) {
      toast.error(t('admin.ocrScan.totalRequired') || 'Le total doit être positif');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch('/api/accounting/ocr/save', {
        method: 'POST',
        headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          invoiceNumber: reviewForm.invoiceNumber || undefined,
          supplierName: reviewForm.supplierName,
          invoiceDate: reviewForm.invoiceDate || undefined,
          dueDate: reviewForm.dueDate || undefined,
          subtotal: reviewForm.subtotal || undefined,
          taxTps: reviewForm.taxTps || undefined,
          taxTvq: reviewForm.taxTvq || undefined,
          total: reviewForm.total,
          accountCode: reviewForm.accountCode,
          description: reviewForm.description || undefined,
          items: extractedData?.items || [],
        }),
      });
      if (!response.ok) throw new Error(t('admin.ocrScan.apiError', { status: response.status }));

      // Reset everything
      setExtractedData(null);
      setUploadedImage(null);
      setShowReviewModal(false);

      toast.success(t('admin.ocrScan.invoiceSaved'));
      await loadHistory();
    } catch (err) {
      console.error('Error saving invoice:', err);
      toast.error(t('admin.ocrScan.saveError'));
    } finally {
      setSaving(false);
    }
  };

  const handleDiscardReview = () => {
    setShowReviewModal(false);
    setExtractedData(null);
    setUploadedImage(null);
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.9) return 'text-emerald-600';
    if (confidence >= 0.7) return 'text-amber-500';
    return 'text-red-500';
  };

  const getConfidenceBg = (confidence: number) => {
    if (confidence >= 0.9) return 'bg-emerald-50 border-emerald-200';
    if (confidence >= 0.7) return 'bg-amber-50 border-amber-200';
    return 'bg-red-50 border-red-200';
  };

  // formatCurrency is now provided by useI18n()
  const fmtCurrency = (amount?: number) => formatCurrency(amount || 0);

  // -- Ribbon actions --
  const handleScanDocument = useCallback(() => { fileInputRef.current?.click(); }, []);
  const handleUpload = useCallback(() => { fileInputRef.current?.click(); }, []);
  const handleValidateReading = useCallback(() => {
    if (extractedData) {
      openReviewModal(extractedData);
    }
  }, [extractedData]);
  const handleCorrect = useCallback(() => {
    if (!extractedData) {
      toast.warning(t('admin.ocrScan.noDataToCorrect') || 'Aucune donnee a corriger. Scannez une facture d\'abord.');
      return;
    }
    openReviewModal(extractedData);
    toast.info(t('admin.ocrScan.correctMode') || 'Mode correction actif. Modifiez les champs necessaires.');
  }, [extractedData, t]);
  const handleScanHistory = useCallback(() => {
    loadHistory();
    const historySection = document.querySelector('[class*="recentScans"], [class*="divide-y"]');
    if (historySection) {
      historySection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    toast.info(t('admin.ocrScan.historyRefreshed') || 'Historique des scans actualise');
  }, [t]);

  useRibbonAction('scanDocument', handleScanDocument);
  useRibbonAction('upload', handleUpload);
  useRibbonAction('validateReading', handleValidateReading);
  useRibbonAction('correct', handleCorrect);
  useRibbonAction('scanHistory', handleScanHistory);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t('admin.ocrScan.title')}</h1>
          <p className="text-slate-500 mt-1">{t('admin.ocrScan.subtitle')}</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard label={t('admin.ocrScan.scannedInvoices')} value={history.length} icon={ScanLine} theme={theme} />
        <StatCard
          label={t('admin.ocrScan.successRate')}
          value={`${history.length > 0 ? Math.round(history.filter(h => h.status === 'SUCCESS').length / history.length * 100) : 0}%`}
          icon={CheckCircle2}
          theme={theme}
        />
        <StatCard label={t('admin.ocrScan.toReview')} value={history.filter(h => h.status === 'NEEDS_REVIEW').length} icon={AlertTriangle} theme={theme} />
        <StatCard label={t('admin.ocrScan.estimatedTimeSaved')} value={t('admin.ocrScan.minutesSuffix', { count: history.length * 5 })} icon={Clock} theme={theme} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upload Zone */}
        <div className="space-y-4">
          <div
            onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`bg-white rounded-xl p-8 border-2 border-dashed cursor-pointer transition-all ${
              dragActive
                ? 'border-emerald-500 bg-emerald-50'
                : 'border-slate-300 hover:border-slate-400'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/webp,application/pdf"
              onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
              className="hidden"
              aria-label="Upload invoice file"
            />

            {scanning ? (
              <div className="text-center py-8" role="status" aria-label="Loading">
                <div className="animate-spin h-12 w-12 border-4 border-emerald-500 border-t-transparent rounded-full mx-auto"></div>
                <p className="text-slate-900 font-medium mt-4">{t('admin.ocrScan.analyzing')}</p>
                <p className="text-sm text-slate-500 mt-1">{t('admin.ocrScan.aiExtraction')}</p>
                <span className="sr-only">Loading...</span>
              </div>
            ) : uploadedImage ? (
              <div className="text-center">
                <Image
                  src={uploadedImage}
                  alt="Preview"
                  width={400}
                  height={256}
                  className="max-h-64 mx-auto rounded-lg"
                  style={{ width: 'auto', height: 'auto', maxHeight: '16rem' }}
                  unoptimized
                />
                <p className="text-sm text-slate-500 mt-4">{t('admin.ocrScan.clickToChange')}</p>
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="text-5xl mb-4">&#128196;</div>
                <h3 className="text-lg font-medium text-slate-900 mb-2">{t('admin.ocrScan.dropInvoice')}</h3>
                <p className="text-sm text-slate-500 mb-4">{t('admin.ocrScan.orClickToSelect')}</p>
                <div className="flex justify-center gap-2">
                  <span className="px-2 py-1 bg-slate-100 rounded text-xs text-slate-600">PNG</span>
                  <span className="px-2 py-1 bg-slate-100 rounded text-xs text-slate-600">JPG</span>
                  <span className="px-2 py-1 bg-slate-100 rounded text-xs text-slate-600">PDF</span>
                </div>
                <p className="text-xs text-slate-400 mt-4">{t('admin.ocrScan.maxFileSize')}</p>
              </div>
            )}
          </div>

          {/* How it works */}
          <SectionCard title={`&#128161; ${t('admin.ocrScan.howItWorks')}`} theme={theme}>
            <ol className="space-y-3 text-sm">
              <li className="flex gap-3">
                <span className="w-6 h-6 bg-emerald-600 text-white rounded-full flex items-center justify-center text-xs font-bold shrink-0">1</span>
                <span className="text-slate-600">{t('admin.ocrScan.step1')}</span>
              </li>
              <li className="flex gap-3">
                <span className="w-6 h-6 bg-emerald-600 text-white rounded-full flex items-center justify-center text-xs font-bold shrink-0">2</span>
                <span className="text-slate-600">{t('admin.ocrScan.step2')}</span>
              </li>
              <li className="flex gap-3">
                <span className="w-6 h-6 bg-emerald-600 text-white rounded-full flex items-center justify-center text-xs font-bold shrink-0">3</span>
                <span className="text-slate-600">{t('admin.ocrScan.step3')}</span>
              </li>
              <li className="flex gap-3">
                <span className="w-6 h-6 bg-emerald-600 text-white rounded-full flex items-center justify-center text-xs font-bold shrink-0">4</span>
                <span className="text-slate-600">{t('admin.ocrScan.step4')}</span>
              </li>
            </ol>
          </SectionCard>
        </div>

        {/* Extracted Data Preview + Recent Scans */}
        <div className="space-y-4">
          {extractedData && !showReviewModal ? (
            <SectionCard
              title={t('admin.ocrScan.extractedData')}
              theme={theme}
              headerAction={
                <span className={`text-sm font-medium ${getConfidenceColor(extractedData.confidence)}`}>
                  {t('admin.ocrScan.confidence', { percent: Math.round(extractedData.confidence * 100) })}
                </span>
              }
            >
              <div className="space-y-3">
                <p className="text-sm text-slate-500">{t('admin.ocrScan.verifyAndCorrect')}</p>
                <div className="bg-slate-50 rounded-lg p-3 text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-500">{t('admin.ocrScan.supplier')}:</span>
                    <span className="font-medium text-slate-900">{extractedData.supplierName || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">{t('admin.ocrScan.total')}:</span>
                    <span className="font-bold text-slate-900">{fmtCurrency(extractedData.total)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">{t('admin.ocrScan.invoiceDate')}:</span>
                    <span className="text-slate-900">{extractedData.invoiceDate || '-'}</span>
                  </div>
                </div>
                {extractedData.needsReview && extractedData.needsReview.length > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <p className="text-xs font-medium text-amber-700 mb-1">
                      {t('admin.ocrScan.fieldsNeedReview') || 'Champs necessitant une verification'}:
                    </p>
                    <ul className="text-xs text-amber-600 space-y-0.5">
                      {extractedData.needsReview.map((field, i) => (
                        <li key={i}>- {field}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => openReviewModal(extractedData)}
                    className={`flex-1 px-4 py-2 ${theme.btnPrimary} border-transparent text-white rounded-lg text-sm font-medium`}
                  >
                    {t('admin.ocrScan.reviewAndSave') || 'Revoir et sauvegarder'}
                  </button>
                  <button
                    onClick={() => { setExtractedData(null); setUploadedImage(null); }}
                    className="px-4 py-2 text-slate-500 hover:text-slate-700 text-sm"
                  >
                    {t('admin.ocrScan.cancel')}
                  </button>
                </div>
              </div>
            </SectionCard>
          ) : !showReviewModal ? (
            <SectionCard theme={theme}>
              <div className="text-center py-4">
                <div className="text-4xl mb-4">&#128203;</div>
                <p className="text-slate-500">{t('admin.ocrScan.uploadPrompt')}</p>
              </div>
            </SectionCard>
          ) : null}

          {/* Recent scans */}
          <SectionCard title={t('admin.ocrScan.recentScans')} theme={theme} noPadding>
            {loadingHistory ? (
              <div className="p-4 text-center text-slate-400">{t('admin.ocrScan.loading')}</div>
            ) : error ? (
              <div className="p-4 text-center text-red-500">{error}</div>
            ) : history.length === 0 ? (
              <div className="p-4 text-center text-slate-400">{t('admin.ocrScan.noScansYet')}</div>
            ) : null}
            <div className="divide-y divide-slate-100">
              {history.slice(0, 5).map(scan => (
                <div key={scan.id} className="px-4 py-3 hover:bg-slate-50">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-sm font-medium text-slate-900">{scan.supplierName}</p>
                      <p className="text-xs text-slate-400">{scan.fileName}</p>
                    </div>
                    <div className="text-end">
                      <p className="text-sm font-semibold text-slate-900">{fmtCurrency(scan.total)}</p>
                      <span className={`text-xs font-medium ${
                        scan.status === 'SUCCESS' ? 'text-emerald-600' :
                        scan.status === 'NEEDS_REVIEW' ? 'text-amber-500' : 'text-red-500'
                      }`}>
                        {scan.status === 'SUCCESS' ? '&#10003;' : scan.status === 'NEEDS_REVIEW' ? '&#9888;' : '&#10007;'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
      </div>

      {/* ============================================================= */}
      {/* Review Modal - Shows after OCR scan with editable fields       */}
      {/* ============================================================= */}
      {showReviewModal && extractedData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) setShowReviewModal(false); }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto mx-4">
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {t('admin.ocrScan.reviewTitle') || 'Revue de la facture scannee'}
                </h2>
                <p className="text-sm text-slate-500 mt-0.5">
                  {t('admin.ocrScan.reviewSubtitle') || 'Verifiez et corrigez les donnees avant de sauvegarder'}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getConfidenceBg(extractedData.confidence)} ${getConfidenceColor(extractedData.confidence)}`}>
                  {t('admin.ocrScan.confidence', { percent: Math.round(extractedData.confidence * 100) })}
                </span>
                <button onClick={() => setShowReviewModal(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal body */}
            <div className="px-6 py-5 space-y-5">
              {/* Warning for fields needing review */}
              {extractedData.needsReview && extractedData.needsReview.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-medium text-amber-700">
                      {t('admin.ocrScan.fieldsNeedReview') || 'Champs necessitant une verification'}:
                    </p>
                    <p className="text-xs text-amber-600 mt-0.5">
                      {extractedData.needsReview.join(', ')}
                    </p>
                  </div>
                </div>
              )}

              {/* Vendor & Invoice Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">{t('admin.ocrScan.supplier')}</label>
                  <input
                    type="text"
                    value={reviewForm.supplierName}
                    onChange={e => updateReviewField('supplierName', e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    placeholder={t('admin.ocrScan.supplierPlaceholder') || 'Nom du fournisseur'}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">{t('admin.ocrScan.invoiceNumber')}</label>
                  <input
                    type="text"
                    value={reviewForm.invoiceNumber}
                    onChange={e => updateReviewField('invoiceNumber', e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    placeholder="INV-0001"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">{t('admin.ocrScan.invoiceDate')}</label>
                  <input
                    type="date"
                    value={reviewForm.invoiceDate}
                    onChange={e => updateReviewField('invoiceDate', e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">{t('admin.ocrScan.dueDate')}</label>
                  <input
                    type="date"
                    value={reviewForm.dueDate}
                    onChange={e => updateReviewField('dueDate', e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  {t('admin.ocrScan.description') || 'Description'}
                </label>
                <input
                  type="text"
                  value={reviewForm.description}
                  onChange={e => updateReviewField('description', e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  placeholder={t('admin.ocrScan.descriptionPlaceholder') || 'Description de la facture'}
                />
              </div>

              {/* Items table (read-only, from OCR) */}
              {extractedData.items && extractedData.items.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-2">{t('admin.ocrScan.items')}</label>
                  <div className="bg-slate-50 rounded-lg overflow-hidden overflow-x-auto border border-slate-200">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-100">
                        <tr>
                          <th scope="col" className="px-3 py-2 text-start text-xs font-medium text-slate-500 uppercase">{t('admin.ocrScan.description')}</th>
                          <th scope="col" className="px-3 py-2 text-end text-xs font-medium text-slate-500 uppercase">{t('admin.ocrScan.qty')}</th>
                          <th scope="col" className="px-3 py-2 text-end text-xs font-medium text-slate-500 uppercase">{t('admin.ocrScan.unitPrice')}</th>
                          <th scope="col" className="px-3 py-2 text-end text-xs font-medium text-slate-500 uppercase">{t('admin.ocrScan.total')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 bg-white">
                        {extractedData.items.map((item, i) => (
                          <tr key={i}>
                            <td className="px-3 py-2 text-slate-900">{item.description}</td>
                            <td className="px-3 py-2 text-end text-slate-600">{item.quantity}</td>
                            <td className="px-3 py-2 text-end text-slate-600">{formatCurrency(item.unitPrice)}</td>
                            <td className="px-3 py-2 text-end font-medium text-slate-900">{formatCurrency(item.total)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Amounts */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">{t('admin.ocrScan.subtotal')}</label>
                  <input
                    type="number"
                    step="0.01"
                    value={reviewForm.subtotal}
                    onChange={e => updateReviewField('subtotal', parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">{t('admin.ocrScan.tps')} (5%)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={reviewForm.taxTps}
                    onChange={e => updateReviewField('taxTps', parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">{t('admin.ocrScan.tvq')} (9.975%)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={reviewForm.taxTvq}
                    onChange={e => updateReviewField('taxTvq', parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">{t('admin.ocrScan.total')}</label>
                  <input
                    type="number"
                    step="0.01"
                    value={reviewForm.total}
                    onChange={e => updateReviewField('total', parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 font-bold text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Account Selector (ChartOfAccount) */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  {t('admin.ocrScan.expenseAccount') || 'Compte de depense'}
                </label>
                <select
                  aria-label="Expense account"
                  value={reviewForm.accountCode}
                  onChange={e => updateReviewField('accountCode', e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  disabled={loadingAccounts}
                >
                  {loadingAccounts ? (
                    <option>{t('admin.ocrScan.loadingAccounts') || 'Chargement des comptes...'}</option>
                  ) : (
                    accounts.map(acc => (
                      <option key={acc.code} value={acc.code}>
                        {acc.code} - {acc.name}
                      </option>
                    ))
                  )}
                </select>
              </div>
            </div>

            {/* Modal footer */}
            <div className="px-6 py-4 border-t border-slate-200 flex justify-between items-center bg-slate-50 rounded-b-2xl">
              <button
                onClick={handleDiscardReview}
                className="px-4 py-2 text-slate-600 hover:text-slate-800 text-sm font-medium hover:bg-slate-100 rounded-lg transition-colors"
                disabled={saving}
              >
                {t('admin.ocrScan.discard') || 'Annuler'}
              </button>
              <button
                onClick={handleSaveAsJournalEntry}
                disabled={saving}
                className={`px-6 py-2.5 ${theme.btnPrimary} border-transparent text-white rounded-lg text-sm font-medium flex items-center gap-2 disabled:opacity-60`}
              >
                {saving ? (
                  <>
                    <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                    {t('admin.ocrScan.saving') || 'Sauvegarde...'}
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    {t('admin.ocrScan.saveAsJournalEntry') || 'Sauvegarder comme ecriture'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
