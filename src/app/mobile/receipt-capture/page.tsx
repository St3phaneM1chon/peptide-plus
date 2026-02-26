'use client';

import { useState, useRef } from 'react';
import { Camera, Upload, FileText, Check, Edit3 } from 'lucide-react';
import { addCSRFHeader } from '@/lib/csrf';

interface ParsedReceipt {
  vendor: string;
  amount: string;
  date: string;
  category: string;
}

export default function ReceiptCapture() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [parsed, setParsed] = useState<ParsedReceipt | null>(null);
  const [saved, setSaved] = useState(false);
  const [editing, setEditing] = useState(false);

  const handleFile = async (file: File) => {
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);

    setProcessing(true);
    // Simulate OCR - in production, send to OCR API
    await new Promise(r => setTimeout(r, 1500));
    setParsed({
      vendor: file.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' '),
      amount: (Math.random() * 200 + 10).toFixed(2),
      date: new Date().toISOString().split('T')[0],
      category: '5000',
    });
    setProcessing(false);
    setEditing(true);
  };

  const handleSave = async () => {
    if (!parsed) return;
    setProcessing(true);
    try {
      const res = await fetch('/api/mobile/receipts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...addCSRFHeader() },
        body: JSON.stringify({ vendor: parsed.vendor, amount: parseFloat(parsed.amount), date: parsed.date, category: parsed.category }),
      });
      if (res.ok) { setSaved(true); setEditing(false); }
    } catch { /* offline */ }
    setProcessing(false);
  };

  const reset = () => { setImagePreview(null); setParsed(null); setSaved(false); setEditing(false); };

  if (saved) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center"><Check className="w-8 h-8 text-green-600" /></div>
        <p className="text-lg font-semibold text-green-700">Reçu enregistré!</p>
        <button onClick={reset} className="bg-purple-600 text-white px-6 py-2.5 rounded-xl font-medium">Nouveau reçu</button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-gray-900">Capture de Reçu</h2>

      {!imagePreview ? (
        <div className="space-y-3">
          <button onClick={() => fileRef.current?.click()} className="w-full bg-purple-600 text-white py-4 rounded-2xl flex items-center justify-center gap-3 text-lg font-semibold shadow-lg">
            <Camera className="w-6 h-6" /> Prendre Photo
          </button>
          <button onClick={() => fileRef.current?.click()} className="w-full bg-white text-purple-700 py-4 rounded-2xl flex items-center justify-center gap-3 text-lg font-semibold border-2 border-purple-200">
            <Upload className="w-6 h-6" /> Téléverser
          </button>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
          <p className="text-center text-sm text-gray-400 mt-4">Prenez une photo de votre reçu pour extraction automatique</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Preview */}
          <div className="bg-gray-100 rounded-xl overflow-hidden">
            <img src={imagePreview} alt="Reçu" className="w-full max-h-48 object-contain" />
          </div>

          {processing && (
            <div className="flex items-center justify-center gap-2 py-4">
              <FileText className="w-5 h-5 animate-pulse text-purple-600" />
              <span className="text-purple-600 font-medium">Traitement OCR...</span>
            </div>
          )}

          {/* Parsed fields */}
          {parsed && editing && (
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 space-y-3">
              <div className="flex items-center gap-2 text-sm text-purple-600 font-medium mb-2"><Edit3 className="w-4 h-4" /> Vérifiez les informations</div>
              <div>
                <label className="text-xs text-gray-500">Fournisseur</label>
                <input type="text" value={parsed.vendor} onChange={e => setParsed({ ...parsed, vendor: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs text-gray-500">Montant ($)</label>
                <input type="number" value={parsed.amount} onChange={e => setParsed({ ...parsed, amount: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" inputMode="decimal" />
              </div>
              <div>
                <label className="text-xs text-gray-500">Date</label>
                <input type="date" value={parsed.date} onChange={e => setParsed({ ...parsed, date: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div className="flex gap-2 mt-4">
                <button onClick={handleSave} disabled={processing} className="flex-1 bg-purple-600 text-white py-3 rounded-xl font-semibold disabled:opacity-50">Sauvegarder</button>
                <button onClick={reset} className="px-4 py-3 rounded-xl border border-gray-200 text-gray-600">Annuler</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
