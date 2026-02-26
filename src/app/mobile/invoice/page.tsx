'use client';

import { useState } from 'react';
import { Plus, Trash2, Send, Check } from 'lucide-react';
import { addCSRFHeader } from '@/lib/csrf';

interface LineItem { description: string; amount: string; }

export default function MobileInvoice() {
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [lines, setLines] = useState<LineItem[]>([{ description: '', amount: '' }]);
  const [taxEnabled, setTaxEnabled] = useState(true);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const addLine = () => setLines([...lines, { description: '', amount: '' }]);
  const removeLine = (i: number) => setLines(lines.filter((_, idx) => idx !== i));
  const updateLine = (i: number, field: keyof LineItem, value: string) => {
    const updated = [...lines];
    updated[i] = { ...updated[i], [field]: value };
    setLines(updated);
  };

  const subtotal = lines.reduce((s, l) => s + (parseFloat(l.amount) || 0), 0);
  const tps = taxEnabled ? subtotal * 0.05 : 0;
  const tvq = taxEnabled ? subtotal * 0.09975 : 0;
  const total = subtotal + tps + tvq;

  const fmt = (n: number) => new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD' }).format(n);

  const handleSend = async () => {
    if (!clientName || lines.every(l => !l.description || !l.amount)) return;
    setSending(true);
    try {
      const res = await fetch('/api/accounting/customer-invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...addCSRFHeader() },
        body: JSON.stringify({
          clientName, clientEmail: clientEmail || undefined,
          items: lines.filter(l => l.description && l.amount).map(l => ({ description: l.description, quantity: 1, unitPrice: parseFloat(l.amount) })),
          taxRate: taxEnabled ? 14.975 : 0,
        }),
      });
      if (res.ok) setSent(true);
    } catch { /* offline */ }
    setSending(false);
  };

  if (sent) return (
    <div className="flex flex-col items-center justify-center h-64 space-y-4">
      <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center"><Check className="w-8 h-8 text-green-600" /></div>
      <p className="text-lg font-semibold text-green-700">Facture créée!</p>
      <button onClick={() => { setSent(false); setClientName(''); setClientEmail(''); setLines([{ description: '', amount: '' }]); }} className="bg-purple-600 text-white px-6 py-2.5 rounded-xl font-medium">Nouvelle facture</button>
    </div>
  );

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-gray-900">Nouvelle Facture</h2>

      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 space-y-3">
        <input type="text" value={clientName} onChange={e => setClientName(e.target.value)} placeholder="Nom du client *" className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm" />
        <input type="email" value={clientEmail} onChange={e => setClientEmail(e.target.value)} placeholder="Email du client" className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm" />
      </div>

      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 space-y-3">
        <h3 className="text-sm font-semibold text-gray-700">Lignes</h3>
        {lines.map((line, i) => (
          <div key={i} className="flex gap-2 items-start">
            <input type="text" value={line.description} onChange={e => updateLine(i, 'description', e.target.value)} placeholder="Description" className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            <input type="number" value={line.amount} onChange={e => updateLine(i, 'amount', e.target.value)} placeholder="$" className="w-24 border border-gray-200 rounded-lg px-3 py-2 text-sm" inputMode="decimal" />
            {lines.length > 1 && <button onClick={() => removeLine(i)} className="p-2 text-gray-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>}
          </div>
        ))}
        <button onClick={addLine} className="flex items-center gap-1 text-sm text-purple-600 font-medium"><Plus className="w-4 h-4" /> Ajouter ligne</button>
      </div>

      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
        <label className="flex items-center justify-between cursor-pointer">
          <span className="text-sm text-gray-700">TPS/TVQ (14.975%)</span>
          <input type="checkbox" checked={taxEnabled} onChange={e => setTaxEnabled(e.target.checked)} className="w-5 h-5 accent-purple-600" />
        </label>
        <div className="mt-3 space-y-1 text-sm">
          <div className="flex justify-between text-gray-500"><span>Sous-total</span><span>{fmt(subtotal)}</span></div>
          {taxEnabled && <><div className="flex justify-between text-gray-500"><span>TPS (5%)</span><span>{fmt(tps)}</span></div>
          <div className="flex justify-between text-gray-500"><span>TVQ (9.975%)</span><span>{fmt(tvq)}</span></div></>}
          <div className="flex justify-between font-bold text-gray-900 text-base pt-2 border-t"><span>Total</span><span>{fmt(total)}</span></div>
        </div>
      </div>

      <button onClick={handleSend} disabled={sending || !clientName} className="w-full bg-purple-600 text-white py-3.5 rounded-xl font-semibold flex items-center justify-center gap-2 disabled:opacity-50">
        <Send className="w-4 h-4" /> {sending ? 'Envoi...' : 'Créer la facture'}
      </button>
    </div>
  );
}
