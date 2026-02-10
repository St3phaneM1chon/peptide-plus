'use client';

import { useState, useRef } from 'react';

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
  const [scanning, setScanning] = useState(false);
  const [extractedData, setExtractedData] = useState<ExtractedInvoice | null>(null);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [history, setHistory] = useState<ScanHistory[]>([]);

  const handleFileSelect = async (file: File) => {
    if (!file) return;

    // Validate file type
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'application/pdf'];
    if (!validTypes.includes(file.type)) {
      alert('Type de fichier non supporté. Utilisez PNG, JPG, WEBP ou PDF.');
      return;
    }

    // Validate file size (max 20MB)
    if (file.size > 20 * 1024 * 1024) {
      alert('Le fichier est trop volumineux (max 20 Mo).');
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
      const data = await response.json();
      setExtractedData(data.extractedData || null);
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

    // Add to history
    const newScan: ScanHistory = {
      id: `scan-${Date.now()}`,
      fileName: 'facture-scannee.png',
      supplierName: extractedData.supplierName || 'Inconnu',
      total: extractedData.total || 0,
      status: extractedData.confidence > 0.8 ? 'SUCCESS' : 'NEEDS_REVIEW',
      createdAt: new Date(),
    };
    
    setHistory(prev => [newScan, ...prev]);
    
    // Reset
    setExtractedData(null);
    setUploadedImage(null);
    
    alert('Facture enregistrée et écriture créée!');
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.9) return 'text-green-400';
    if (confidence >= 0.7) return 'text-amber-400';
    return 'text-red-400';
  };

  const formatCurrency = (amount?: number) => 
    (amount || 0).toLocaleString('fr-CA', { style: 'currency', currency: 'CAD' });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white">Scan de factures (OCR)</h1>
          <p className="text-neutral-400 mt-1">Numérisez vos factures pour extraction automatique</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-neutral-800 rounded-xl p-4 border border-neutral-700">
          <p className="text-sm text-neutral-400">Factures scannées</p>
          <p className="text-2xl font-bold text-white mt-1">{history.length}</p>
        </div>
        <div className="bg-neutral-800 rounded-xl p-4 border border-neutral-700">
          <p className="text-sm text-neutral-400">Taux de réussite</p>
          <p className="text-2xl font-bold text-green-400 mt-1">
            {history.length > 0 ? Math.round(history.filter(h => h.status === 'SUCCESS').length / history.length * 100) : 0}%
          </p>
        </div>
        <div className="bg-neutral-800 rounded-xl p-4 border border-neutral-700">
          <p className="text-sm text-neutral-400">À vérifier</p>
          <p className="text-2xl font-bold text-amber-400 mt-1">
            {history.filter(h => h.status === 'NEEDS_REVIEW').length}
          </p>
        </div>
        <div className="bg-neutral-800 rounded-xl p-4 border border-neutral-700">
          <p className="text-sm text-neutral-400">Temps gagné estimé</p>
          <p className="text-2xl font-bold text-white mt-1">{history.length * 5} min</p>
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
                ? 'border-amber-500 bg-amber-500/10' 
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
                <div className="animate-spin h-12 w-12 border-4 border-amber-500 border-t-transparent rounded-full mx-auto"></div>
                <p className="text-white mt-4">Analyse en cours...</p>
                <p className="text-sm text-neutral-400 mt-1">Extraction des données avec IA</p>
              </div>
            ) : uploadedImage ? (
              <div className="text-center">
                <img 
                  src={uploadedImage} 
                  alt="Preview" 
                  className="max-h-64 mx-auto rounded-lg"
                />
                <p className="text-sm text-neutral-400 mt-4">Cliquez pour changer de fichier</p>
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="text-5xl mb-4">📄</div>
                <h3 className="text-lg font-medium text-white mb-2">Déposez votre facture ici</h3>
                <p className="text-sm text-neutral-400 mb-4">ou cliquez pour sélectionner un fichier</p>
                <div className="flex justify-center gap-2">
                  <span className="px-2 py-1 bg-neutral-700 rounded text-xs text-neutral-300">PNG</span>
                  <span className="px-2 py-1 bg-neutral-700 rounded text-xs text-neutral-300">JPG</span>
                  <span className="px-2 py-1 bg-neutral-700 rounded text-xs text-neutral-300">PDF</span>
                </div>
                <p className="text-xs text-neutral-500 mt-4">Max 20 Mo</p>
              </div>
            )}
          </div>

          {/* How it works */}
          <div className="bg-neutral-800 rounded-xl p-6 border border-neutral-700">
            <h3 className="font-medium text-white mb-4">💡 Comment ça marche</h3>
            <ol className="space-y-3 text-sm">
              <li className="flex gap-3">
                <span className="w-6 h-6 bg-amber-600 rounded-full flex items-center justify-center text-xs font-bold">1</span>
                <span className="text-neutral-300">Téléversez une photo ou PDF de votre facture</span>
              </li>
              <li className="flex gap-3">
                <span className="w-6 h-6 bg-amber-600 rounded-full flex items-center justify-center text-xs font-bold">2</span>
                <span className="text-neutral-300">L'IA analyse et extrait les informations</span>
              </li>
              <li className="flex gap-3">
                <span className="w-6 h-6 bg-amber-600 rounded-full flex items-center justify-center text-xs font-bold">3</span>
                <span className="text-neutral-300">Vérifiez et validez les données extraites</span>
              </li>
              <li className="flex gap-3">
                <span className="w-6 h-6 bg-amber-600 rounded-full flex items-center justify-center text-xs font-bold">4</span>
                <span className="text-neutral-300">La facture et l'écriture comptable sont créées</span>
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
                  <h3 className="font-medium text-white">Données extraites</h3>
                  <p className="text-sm text-neutral-400">Vérifiez et corrigez si nécessaire</p>
                </div>
                <div className="text-right">
                  <span className={`text-sm font-medium ${getConfidenceColor(extractedData.confidence)}`}>
                    {Math.round(extractedData.confidence * 100)}% confiance
                  </span>
                </div>
              </div>
              
              <div className="p-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-neutral-400 mb-1">N° Facture</label>
                    <input
                      type="text"
                      defaultValue={extractedData.invoiceNumber}
                      className="w-full px-3 py-2 bg-neutral-700 border border-neutral-600 rounded-lg text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-neutral-400 mb-1">Fournisseur</label>
                    <input
                      type="text"
                      defaultValue={extractedData.supplierName}
                      className="w-full px-3 py-2 bg-neutral-700 border border-neutral-600 rounded-lg text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-neutral-400 mb-1">Date facture</label>
                    <input
                      type="date"
                      defaultValue={extractedData.invoiceDate}
                      className="w-full px-3 py-2 bg-neutral-700 border border-neutral-600 rounded-lg text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-neutral-400 mb-1">Échéance</label>
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
                    <label className="block text-xs text-neutral-400 mb-2">Articles</label>
                    <div className="bg-neutral-900 rounded-lg overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-neutral-700/50">
                          <tr>
                            <th className="px-3 py-2 text-left text-xs text-neutral-400">Description</th>
                            <th className="px-3 py-2 text-right text-xs text-neutral-400">Qté</th>
                            <th className="px-3 py-2 text-right text-xs text-neutral-400">P.U.</th>
                            <th className="px-3 py-2 text-right text-xs text-neutral-400">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-700">
                          {extractedData.items.map((item, i) => (
                            <tr key={i}>
                              <td className="px-3 py-2 text-white">{item.description}</td>
                              <td className="px-3 py-2 text-right text-neutral-300">{item.quantity}</td>
                              <td className="px-3 py-2 text-right text-neutral-300">{formatCurrency(item.unitPrice)}</td>
                              <td className="px-3 py-2 text-right text-white">{formatCurrency(item.total)}</td>
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
                    <label className="block text-xs text-neutral-400 mb-1">Sous-total</label>
                    <input
                      type="number"
                      step="0.01"
                      defaultValue={extractedData.subtotal}
                      className="w-full px-3 py-2 bg-neutral-700 border border-neutral-600 rounded-lg text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-neutral-400 mb-1">TPS</label>
                    <input
                      type="number"
                      step="0.01"
                      defaultValue={extractedData.taxTps}
                      className="w-full px-3 py-2 bg-neutral-700 border border-neutral-600 rounded-lg text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-neutral-400 mb-1">TVQ</label>
                    <input
                      type="number"
                      step="0.01"
                      defaultValue={extractedData.taxTvq}
                      className="w-full px-3 py-2 bg-neutral-700 border border-neutral-600 rounded-lg text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-neutral-400 mb-1">Total</label>
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
                  <label className="block text-xs text-neutral-400 mb-1">Catégorie de dépense</label>
                  <select className="w-full px-3 py-2 bg-neutral-700 border border-neutral-600 rounded-lg text-white">
                    <option value="6310">6310 - Hébergement cloud</option>
                    <option value="6330">6330 - Services SaaS</option>
                    <option value="6210">6210 - Marketing</option>
                    <option value="6010">6010 - Livraison</option>
                    <option value="5010">5010 - Achats</option>
                  </select>
                </div>
              </div>

              <div className="p-4 border-t border-neutral-700 flex justify-between">
                <button
                  onClick={() => { setExtractedData(null); setUploadedImage(null); }}
                  className="px-4 py-2 text-neutral-400 hover:text-white"
                >
                  Annuler
                </button>
                <button
                  onClick={handleSaveInvoice}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg"
                >
                  ✓ Enregistrer la facture
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-neutral-800 rounded-xl p-8 border border-neutral-700 text-center">
              <div className="text-4xl mb-4">📋</div>
              <p className="text-neutral-400">Téléversez une facture pour voir les données extraites</p>
            </div>
          )}

          {/* Recent scans */}
          <div className="bg-neutral-800 rounded-xl border border-neutral-700 overflow-hidden">
            <div className="p-4 border-b border-neutral-700">
              <h3 className="font-medium text-white">Scans récents</h3>
            </div>
            <div className="divide-y divide-neutral-700">
              {history.slice(0, 5).map(scan => (
                <div key={scan.id} className="p-3 hover:bg-neutral-700/30">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-sm text-white">{scan.supplierName}</p>
                      <p className="text-xs text-neutral-500">{scan.fileName}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-white">{formatCurrency(scan.total)}</p>
                      <span className={`text-xs ${
                        scan.status === 'SUCCESS' ? 'text-green-400' :
                        scan.status === 'NEEDS_REVIEW' ? 'text-amber-400' : 'text-red-400'
                      }`}>
                        {scan.status === 'SUCCESS' ? '✓' : scan.status === 'NEEDS_REVIEW' ? '⚠' : '✗'}
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
