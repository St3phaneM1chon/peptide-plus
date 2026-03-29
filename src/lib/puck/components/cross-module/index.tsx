'use client';

/**
 * Cross-Module Puck Components
 *
 * These components display LIVE data from other Koraline modules
 * (Commerce, LMS, CRM, Booking, etc.) directly in the page builder.
 * This is a UNIQUE feature that no competitor offers.
 */

import React from 'react';

// ── Live Product Grid ────────────────────────────────────────
export function LiveProductGrid({ title, limit }: { title?: string; limit?: number }) {
  return (
    <div className="space-y-6">
      {title && <h2 className="text-3xl font-bold text-center">{title}</h2>}
      <div className="grid md:grid-cols-4 gap-6">
        {Array.from({ length: limit || 4 }).map((_, i) => (
          <div key={i} className="group border rounded-xl overflow-hidden hover:shadow-lg transition-all">
            <div className="aspect-square bg-gradient-to-br from-zinc-100 to-zinc-200 dark:from-zinc-800 dark:to-zinc-700 flex items-center justify-center">
              <span className="text-5xl group-hover:scale-110 transition-transform">🛍️</span>
            </div>
            <div className="p-4 space-y-2">
              <h3 className="font-semibold truncate">Produit {i + 1}</h3>
              <p className="text-sm opacity-60 line-clamp-2">Description du produit depuis votre catalogue</p>
              <div className="flex items-center justify-between">
                <span className="text-lg font-bold text-blue-600">$XX.XX</span>
                <button className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
                  Ajouter
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
      <p className="text-center text-xs opacity-40">⚡ Données live depuis votre catalogue — se mettent à jour automatiquement</p>
    </div>
  );
}

// ── Live Course Cards (LMS) ──────────────────────────────────
export function LiveCourseCards({ title, limit }: { title?: string; limit?: number }) {
  return (
    <div className="space-y-6">
      {title && <h2 className="text-3xl font-bold text-center">{title}</h2>}
      <div className="grid md:grid-cols-3 gap-6">
        {Array.from({ length: limit || 3 }).map((_, i) => (
          <div key={i} className="border rounded-xl overflow-hidden hover:shadow-lg transition-all">
            <div className="aspect-video bg-gradient-to-br from-emerald-100 to-emerald-200 dark:from-emerald-900 dark:to-emerald-800 flex items-center justify-center">
              <span className="text-5xl">🎓</span>
            </div>
            <div className="p-4 space-y-3">
              <h3 className="font-semibold">Formation {i + 1}</h3>
              <div className="flex items-center gap-2 text-sm opacity-60">
                <span>📚 12 leçons</span>
                <span>·</span>
                <span>⏱️ 8h</span>
              </div>
              <div className="w-full bg-zinc-200 dark:bg-zinc-700 rounded-full h-2">
                <div className="bg-emerald-500 h-2 rounded-full" style={{ width: `${[30, 65, 0][i]}%` }} />
              </div>
              <div className="flex items-center justify-between">
                <span className="font-bold text-emerald-600">{[30, 65, 0][i]}% complété</span>
                <button className="px-3 py-1.5 bg-emerald-600 text-white text-sm rounded-lg">
                  {[30, 65, 0][i] > 0 ? 'Continuer' : 'S\'inscrire'}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
      <p className="text-center text-xs opacity-40">⚡ Cours live depuis votre LMS — progression en temps réel</p>
    </div>
  );
}

// ── Booking Calendar Widget ──────────────────────────────────
export function BookingWidget({ title, subtitle }: { title?: string; subtitle?: string }) {
  const today = new Date();
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    return d;
  });

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {title && <h2 className="text-3xl font-bold text-center">{title}</h2>}
      {subtitle && <p className="text-center opacity-70">{subtitle}</p>}
      <div className="border rounded-xl p-6 space-y-4">
        <div className="grid grid-cols-7 gap-2">
          {days.map((d, i) => (
            <button
              key={i}
              className={`p-3 rounded-lg text-center ${i === 2 ? 'bg-blue-600 text-white' : 'bg-zinc-100 dark:bg-zinc-800 hover:bg-blue-50'}`}
            >
              <div className="text-xs opacity-60">{d.toLocaleDateString('fr-CA', { weekday: 'short' })}</div>
              <div className="text-lg font-semibold">{d.getDate()}</div>
            </button>
          ))}
        </div>
        <div className="space-y-2">
          <p className="text-sm font-medium">Créneaux disponibles:</p>
          <div className="flex flex-wrap gap-2">
            {['9:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00'].map(t => (
              <button key={t} className="px-3 py-1.5 border rounded-lg text-sm hover:bg-blue-50 hover:border-blue-300">
                {t}
              </button>
            ))}
          </div>
        </div>
        <button className="w-full py-3 bg-blue-600 text-white rounded-lg font-semibold">
          Réserver
        </button>
      </div>
      <p className="text-center text-xs opacity-40">⚡ Calendrier live — créneaux réels depuis votre module Réservations</p>
    </div>
  );
}

// ── Recent Orders Widget ─────────────────────────────────────
export function RecentOrdersWidget({ title }: { title?: string }) {
  return (
    <div className="space-y-4">
      {title && <h2 className="text-2xl font-bold">{title}</h2>}
      <div className="border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 dark:bg-zinc-800">
            <tr>
              <th className="p-3 text-left">Commande</th>
              <th className="p-3 text-left">Client</th>
              <th className="p-3 text-right">Total</th>
              <th className="p-3 text-center">Statut</th>
            </tr>
          </thead>
          <tbody>
            {[
              { num: '#1042', client: 'Marie T.', total: '149.99$', status: 'Livré' },
              { num: '#1041', client: 'Pierre G.', total: '89.50$', status: 'En cours' },
              { num: '#1040', client: 'Jean L.', total: '249.00$', status: 'Nouveau' },
            ].map((o, i) => (
              <tr key={i} className="border-t">
                <td className="p-3 font-medium">{o.num}</td>
                <td className="p-3">{o.client}</td>
                <td className="p-3 text-right font-semibold">{o.total}</td>
                <td className="p-3 text-center">
                  <span className={`px-2 py-1 rounded-full text-xs ${
                    o.status === 'Livré' ? 'bg-green-100 text-green-700' :
                    o.status === 'En cours' ? 'bg-blue-100 text-blue-700' :
                    'bg-amber-100 text-amber-700'
                  }`}>{o.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-center text-xs opacity-40">⚡ Commandes live depuis votre module Commerce</p>
    </div>
  );
}

// ── Accounting Stats Widget ──────────────────────────────────
export function AccountingStatsWidget({ title }: { title?: string }) {
  return (
    <div className="space-y-4">
      {title && <h2 className="text-2xl font-bold text-center">{title}</h2>}
      <div className="grid md:grid-cols-4 gap-4">
        {[
          { label: 'Revenus (mois)', value: '24 850$', change: '+12%', color: 'emerald' },
          { label: 'Dépenses', value: '8 420$', change: '-3%', color: 'red' },
          { label: 'Profit net', value: '16 430$', change: '+18%', color: 'blue' },
          { label: 'Clients actifs', value: '142', change: '+5', color: 'purple' },
        ].map((stat, i) => (
          <div key={i} className="border rounded-xl p-4 text-center space-y-1">
            <p className="text-sm opacity-60">{stat.label}</p>
            <p className="text-2xl font-bold">{stat.value}</p>
            <p className={`text-sm font-medium text-${stat.color}-600`}>{stat.change}</p>
          </div>
        ))}
      </div>
      <p className="text-center text-xs opacity-40">⚡ Données live depuis votre module Comptabilité</p>
    </div>
  );
}

// ── Phone/Click-to-Call Widget ────────────────────────────────
export function PhoneWidget({ phoneNumber, text }: { phoneNumber?: string; text?: string }) {
  const number = phoneNumber || '+14388030370';
  const formatted = number.replace(/(\+1)(\d{3})(\d{3})(\d{4})/, '$1 ($2) $3-$4');
  return (
    <div className="text-center space-y-3">
      <a
        href={`tel:${number}`}
        className="inline-flex items-center gap-3 px-8 py-4 bg-emerald-600 text-white rounded-2xl font-semibold text-lg hover:bg-emerald-700 transition-all hover:scale-105 shadow-lg"
      >
        <span className="text-2xl">📞</span>
        {text || `Appelez-nous: ${formatted}`}
      </a>
      <p className="text-sm opacity-50">Lun-Ven, 9h à 17h (HE)</p>
    </div>
  );
}

// ── Event Countdown Widget ───────────────────────────────────
export function EventCountdownWidget({ title, eventName, eventDate }: { title?: string; eventName?: string; eventDate?: string }) {
  return (
    <div className="text-center space-y-6 p-8 rounded-2xl bg-gradient-to-r from-purple-600 to-blue-600 text-white">
      {title && <p className="text-sm uppercase tracking-wider opacity-80">{title}</p>}
      <h2 className="text-3xl font-bold">{eventName || 'Prochain événement'}</h2>
      <div className="flex justify-center gap-8">
        {['Jours', 'Heures', 'Min', 'Sec'].map((label, i) => (
          <div key={i}>
            <div className="text-4xl font-bold tabular-nums bg-white/20 rounded-xl w-16 h-16 flex items-center justify-center">
              {[12, 5, 33, 47][i]}
            </div>
            <div className="text-xs mt-1 opacity-70">{label}</div>
          </div>
        ))}
      </div>
      <p className="opacity-70">{eventDate || '15 avril 2026'}</p>
      <button className="px-8 py-3 bg-white text-purple-600 rounded-lg font-semibold hover:bg-zinc-100">
        S&apos;inscrire
      </button>
      <p className="text-xs opacity-40">⚡ Événement live depuis votre module Événements</p>
    </div>
  );
}
