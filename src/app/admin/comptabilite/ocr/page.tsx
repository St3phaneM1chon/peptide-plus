'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { useI18n } from '@/i18n/client';
import { toast } from 'sonner';

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

export default function OCRPage() {
  const { t, locale } = useI18n();
  const [scanning, setScanning] = useState(false);
  const [extractedData, setExtractedData] = useState<ExtractedInvoice | null>(null);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [history, setHistory] = useState<ScanHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadHistory();
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
      setExtractedData(data.data || data.extractedData || null);
    } catch (error) {
      console.error('Error scanning invoice:', error);
      setExtractedData(null);
    } finally {
      setScanning(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);

    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  };

  const handleSaveInvoice = async () => {
    if (!extractedData) return;

    try {
      const response = await fetch('/api/accounting/ocr/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(extractedData),
      });
      if (!response.ok) throw new Error(t('admin.ocrScan.apiError', { status: response.status }));

      // Reset
      setExtractedData(null);
      setUploadedImage(null);

      toast.success(t('admin.ocrScan.invoiceSaved'));
      await loadHistory();
    } catch (err) {
      console.error('Error saving invoice:', err);
      toast.error(t('admin.ocrScan.saveError'));
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.9) return 'text-green-400';
    if (confidence >= 0.7) return 'text-yellow-400';
    return 'text-red-400';
  };

  const formatCurrency = (amount?: number) =>
    (amount || 0).toLocaleString(locale, { style: 'currency', currency: 'CAD' });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white">{t('admin.ocrScan.title')}</h1>
          <p className="text-neutral-400 mt-1">{t('admin.ocrScan.subtitle')}</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-neutral-800 rounded-xl p-4 border border-neutral-700">
          <p className="text-sm text-neutral-400">{t('admin.ocrScan.scannedInvoices')}</p>
          <p className="text-2xl font-bold text-white mt-1">{history.length}</p>
        </div>
        <div className="bg-neutral-800 rounded-xl p-4 border border-neutral-700">
          <p className="text-sm text-neutral-400">{t('admin.ocrScan.successRate')}</p>
          <p className="text-2xl font-bold text-green-400 mt-1">
            {history.length > 0 ? Math.round(history.filter(h => h.status === 'SUCCESS').length / history.length * 100) : 0}%
          </p>
        </div>
        <div className="bg-neutral-800 rounded-xl p-4 border border-neutral-700">
          <p className="text-sm text-neutral-400">{t('admin.ocrScan.toReview')}</p>
          <p className="text-2xl font-bold text-yellow-400 mt-1">
            {history.filter(h => h.status === 'NEEDS_REVIEW').length}
          </p>
        </div>
        <div className="bg-neutral-800 rounded-xl p-4 border border-neutral-700">
          <p className="text-sm text-neutral-400">{t('admin.ocrScan.estimatedTimeSaved')}</p>
          <p className="text-2xl font-bold text-white mt-1">{t('admin.ocrScan.minutesSuffix', { count: history.length * 5 })}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upload Zone */}
        <div className="space-y-4">
          <div
            onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`bg-neutral-800 rounded-xl p-8 border-2 border-dashed cursor-pointer transition-all ${
              dragActive
                ? 'border-sky-500 bg-sky-500/10'
                : 'border-neutral-600 hover:border-neutral-500'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/webp,application/pdf"
              onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
              className="hidden"
            />

            {scanning ? (
              <div className="text-center py-8">
                <div className="animate-spin h-12 w-12 border-4 border-sky-500 border-t-transparent rounded-full mx-auto"></div>
                <p className="text-white mt-4">{t('admin.ocrScan.analyzing')}</p>
                <p className="text-sm text-neutral-400 mt-1">{t('admin.ocrScan.aiExtraction')}</p>
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
                <p className="text-sm text-neutral-400 mt-4">{t('admin.ocrScan.clickToChange')}</p>
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="text-5xl mb-4">&#128196;</div>
                <h3 className="text-lg font-medium text-white mb-2">{t('admin.ocrScan.dropInvoice')}</h3>
                <p className="text-sm text-neutral-400 mb-4">{t('admin.ocrScan.orClickToSelect')}</p>
                <div className="flex justify-center gap-2">
                  <span className="px-2 py-1 bg-neutral-700 rounded text-xs text-neutral-300">PNG</span>
                  <span className="px-2 py-1 bg-neutral-700 rounded text-xs text-neutral-300">JPG</span>
                  <span className="px-2 py-1 bg-neutral-700 rounded text-xs text-neutral-300">PDF</span>
                </div>
                <p className="text-xs text-neutral-500 mt-4">{t('admin.ocrScan.maxFileSize')}</p>
              </div>
            )}
          </div>

          {/* How it works */}
          <div className="bg-neutral-800 rounded-xl p-6 border border-neutral-700">
            <h3 className="font-medium text-white mb-4">&#128161; {t('admin.ocrScan.howItWorks')}</h3>
            <ol className="space-y-3 text-sm">
              <li className="flex gap-3">
                <span className="w-6 h-6 bg-sky-600 rounded-full flex items-center justify-center text-xs font-bold">1</span>
                <span className="text-neutral-300">{t('admin.ocrScan.step1')}</span>
              </li>
              <li className="flex gap-3">
                <span className="w-6 h-6 bg-sky-600 rounded-full flex items-center justify-center text-xs font-bold">2</span>
                <span className="text-neutral-300">{t('admin.ocrScan.step2')}</span>
              </li>
              <li className="flex gap-3">
                <span className="w-6 h-6 bg-sky-600 rounded-full flex items-center justify-center text-xs font-bold">3</span>
                <span className="text-neutral-300">{t('admin.ocrScan.step3')}</span>
              </li>
              <li className="flex gap-3">
                <span className="w-6 h-6 bg-sky-600 rounded-full flex items-center justify-center text-xs font-bold">4</span>
                <span className="text-neutral-300">{t('admin.ocrScan.step4')}</span>
              </li>
            </ol>
          </div>
        </div>

        {/* Extracted Data */}
        <div className="space-y-4">
          {extractedData ? (
            <div className="bg-neutral-800 rounded-xl border border-neutral-700 overflow-hidden">
              <div className="p-4 border-b border-neutral-700 flex justify-between items-center">
                <div>
                  <h3 className="font-medium text-white">{t('admin.ocrScan.extractedData')}</h3>
                  <p className="text-sm text-neutral-400">{t('admin.ocrScan.verifyAndCorrect')}</p>
                </div>
                <div className="text-end">
                  <span className={`text-sm font-medium ${getConfidenceColor(extractedData.confidence)}`}>
                    {t('admin.ocrScan.confidence', { percent: Math.round(extractedData.confidence * 100) })}
                  </span>
                </div>
              </div>

              <div className="p-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-neutral-400 mb-1">{t('admin.ocrScan.invoiceNumber')}</label>
                    <input
                      type="text"
                      defaultValue={extractedData.invoiceNumber}
                      className="w-full px-3 py-2 bg-neutral-700 border border-neutral-600 rounded-lg text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-neutral-400 mb-1">{t('admin.ocrScan.supplier')}</label>
                    <input
                      type="text"
                      defaultValue={extractedData.supplierName}
                      className="w-full px-3 py-2 bg-neutral-700 border border-neutral-600 rounded-lg text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-neutral-400 mb-1">{t('admin.ocrScan.invoiceDate')}</label>
                    <input
                      type="date"
                      defaultValue={extractedData.invoiceDate}
                      className="w-full px-3 py-2 bg-neutral-700 border border-neutral-600 rounded-lg text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-neutral-400 mb-1">{t('admin.ocrScan.dueDate')}</label>
                    <input
                      type="date"
                      defaultValue={extractedData.dueDate}
                      className="w-full px-3 py-2 bg-neutral-700 border border-neutral-600 rounded-lg text-white"
                    />
                  </div>
                </div>

                {/* Items */}
                {extractedData.items && extractedData.items.length > 0 && (
                  <div>
                    <label className="block text-xs text-neutral-400 mb-2">{t('admin.ocrScan.items')}</label>
                    <div className="bg-neutral-900 rounded-lg overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-neutral-700/50">
                          <tr>
                            <th className="px-3 py-2 text-start text-xs text-neutral-400">{t('admin.ocrScan.description')}</th>
                            <th className="px-3 py-2 text-end text-xs text-neutral-400">{t('admin.ocrScan.qty')}</th>
                            <th className="px-3 py-2 text-end text-xs text-neutral-400">{t('admin.ocrScan.unitPrice')}</th>
                            <th className="px-3 py-2 text-end text-xs text-neutral-400">{t('admin.ocrScan.total')}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-700">
                          {extractedData.items.map((item, i) => (
                            <tr key={i}>
                              <td className="px-3 py-2 text-white">{item.description}</td>
                              <td className="px-3 py-2 text-end text-neutral-300">{item.quantity}</td>
                              <td className="px-3 py-2 text-end text-neutral-300">{formatCurrency(item.unitPrice)}</td>
                              <td className="px-3 py-2 text-end text-white">{formatCurrency(item.total)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Totals */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-neutral-400 mb-1">{t('admin.ocrScan.subtotal')}</label>
                    <input
                      type="number"
                      step="0.01"
                      defaultValue={extractedData.subtotal}
                      className="w-full px-3 py-2 bg-neutral-700 border border-neutral-600 rounded-lg text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-neutral-400 mb-1">{t('admin.ocrScan.tps')}</label>
                    <input
                      type="number"
                      step="0.01"
                      defaultValue={extractedData.taxTps}
                      className="w-full px-3 py-2 bg-neutral-700 border border-neutral-600 rounded-lg text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-neutral-400 mb-1">{t('admin.ocrScan.tvq')}</label>
                    <input
                      type="number"
                      step="0.01"
                      defaultValue={extractedData.taxTvq}
                      className="w-full px-3 py-2 bg-neutral-700 border border-neutral-600 rounded-lg text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-neutral-400 mb-1">{t('admin.ocrScan.total')}</label>
                    <input
                      type="number"
                      step="0.01"
                      defaultValue={extractedData.total}
                      className="w-full px-3 py-2 bg-neutral-700 border border-neutral-600 rounded-lg text-white font-bold"
                    />
                  </div>
                </div>

                {/* Category */}
                <div>
                  <label className="block text-xs text-neutral-400 mb-1">{t('admin.ocrScan.expenseCategory')}</label>
                  <select className="w-full px-3 py-2 bg-neutral-700 border border-neutral-600 rounded-lg text-white">
                    <option value="6310">{t('admin.ocrScan.opt6310')}</option>
                    <option value="6330">{t('admin.ocrScan.opt6330')}</option>
                    <option value="6210">{t('admin.ocrScan.opt6210')}</option>
                    <option value="6010">{t('admin.ocrScan.opt6010')}</option>
                    <option value="5010">{t('admin.ocrScan.opt5010')}</option>
                  </select>
                </div>
              </div>

              <div className="p-4 border-t border-neutral-700 flex justify-between">
                <button
                  onClick={() => { setExtractedData(null); setUploadedImage(null); }}
                  className="px-4 py-2 text-neutral-400 hover:text-white"
                >
                  {t('admin.ocrScan.cancel')}
                </button>
                <button
                  onClick={handleSaveInvoice}
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg"
                >
                  &#10003; {t('admin.ocrScan.saveInvoice')}
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-neutral-800 rounded-xl p-8 border border-neutral-700 text-center">
              <div className="text-4xl mb-4">&#128203;</div>
              <p className="text-neutral-400">{t('admin.ocrScan.uploadPrompt')}</p>
            </div>
          )}

          {/* Recent scans */}
          <div className="bg-neutral-800 rounded-xl border border-neutral-700 overflow-hidden">
            <div className="p-4 border-b border-neutral-700">
              <h3 className="font-medium text-white">{t('admin.ocrScan.recentScans')}</h3>
            </div>
            {loadingHistory ? (
              <div className="p-4 text-center text-neutral-400">{t('admin.ocrScan.loading')}</div>
            ) : error ? (
              <div className="p-4 text-center text-red-400">{error}</div>
            ) : history.length === 0 ? (
              <div className="p-4 text-center text-neutral-400">{t('admin.ocrScan.noScansYet')}</div>
            ) : null}
            <div className="divide-y divide-neutral-700">
              {history.slice(0, 5).map(scan => (
                <div key={scan.id} className="p-3 hover:bg-neutral-700/30">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-sm text-white">{scan.supplierName}</p>
                      <p className="text-xs text-neutral-500">{scan.fileName}</p>
                    </div>
                    <div className="text-end">
                      <p className="text-sm font-medium text-white">{formatCurrency(scan.total)}</p>
                      <span className={`text-xs ${
                        scan.status === 'SUCCESS' ? 'text-green-400' :
                        scan.status === 'NEEDS_REVIEW' ? 'text-yellow-400' : 'text-red-400'
                      }`}>
                        {scan.status === 'SUCCESS' ? '&#10003;' : scan.status === 'NEEDS_REVIEW' ? '&#9888;' : '&#10007;'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
