'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function RapportsComptablesPage() {
  const [selectedYear, setSelectedYear] = useState('2026');

  const taxReports = [
    { id: '1', name: 'TPS/TVQ - Janvier 2026', period: '2026-01', status: 'generated', dueDate: '2026-02-28', tpsCollected: 1420.00, tvqCollected: 2830.00, tpsPaid: 450.00, tvqPaid: 895.00 },
    { id: '2', name: 'TPS/TVQ - Q4 2025', period: '2025-Q4', status: 'filed', dueDate: '2026-01-31', tpsCollected: 4200.00, tvqCollected: 8370.00, tpsPaid: 1350.00, tvqPaid: 2685.00 },
    { id: '3', name: 'TPS/TVQ - Q3 2025', period: '2025-Q3', status: 'paid', dueDate: '2025-10-31', tpsCollected: 3850.00, tvqCollected: 7670.00, tpsPaid: 1200.00, tvqPaid: 2390.00 },
  ];

  const managementReports = [
    { id: '1', name: 'Analyse des ventes par produit', icon: '📊', description: 'Répartition du CA par produit et catégorie' },
    { id: '2', name: 'Analyse des ventes par région', icon: '🌍', description: 'Performance par zone géographique' },
    { id: '3', name: 'Analyse de rentabilité', icon: '💰', description: 'Marge par produit et coût d\'acquisition' },
    { id: '4', name: 'Analyse des dépenses', icon: '📉', description: 'Répartition et tendances des dépenses' },
    { id: '5', name: 'Rapport de performance', icon: '🎯', description: 'KPIs et indicateurs clés' },
    { id: '6', name: 'Rapport de trésorerie', icon: '💵', description: 'Entrées, sorties et prévisions' },
  ];

  const statusColors: Record<string, { label: string; color: string }> = {
    draft: { label: 'Brouillon', color: 'bg-gray-100 text-gray-800' },
    generated: { label: 'Généré', color: 'bg-blue-100 text-blue-800' },
    filed: { label: 'Déclaré', color: 'bg-yellow-100 text-yellow-800' },
    paid: { label: 'Payé', color: 'bg-green-100 text-green-800' },
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Rapports comptables</h1>
          <p className="text-gray-500">Rapports fiscaux et de gestion</p>
        </div>
        <select
          value={selectedYear}
          onChange={(e) => setSelectedYear(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg bg-white"
        >
          <option value="2026">2026</option>
          <option value="2025">2025</option>
          <option value="2024">2024</option>
        </select>
      </div>

      {/* Tax Reports Section */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200 bg-amber-50 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-amber-900">Rapports de taxes</h2>
            <p className="text-sm text-amber-700">TPS/TVQ et déclarations fiscales</p>
          </div>
          <Link href="/admin/fiscal" className="text-sm text-amber-600 hover:text-amber-700">
            Module fiscal complet →
          </Link>
        </div>
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Rapport</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">TPS collectée</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">TVQ collectée</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">CTI/RTI</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Net à payer</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Échéance</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Statut</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {taxReports.map((report) => {
              const netTps = report.tpsCollected - report.tpsPaid;
              const netTvq = report.tvqCollected - report.tvqPaid;
              const totalNet = netTps + netTvq;
              return (
                <tr key={report.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{report.name}</p>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-900">{report.tpsCollected.toFixed(2)} $</td>
                  <td className="px-4 py-3 text-right text-gray-900">{report.tvqCollected.toFixed(2)} $</td>
                  <td className="px-4 py-3 text-right text-red-600">-{(report.tpsPaid + report.tvqPaid).toFixed(2)} $</td>
                  <td className="px-4 py-3 text-right font-bold text-emerald-600">{totalNet.toFixed(2)} $</td>
                  <td className="px-4 py-3 text-center text-sm text-gray-600">{new Date(report.dueDate).toLocaleDateString('fr-CA')}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[report.status].color}`}>
                      {statusColors[report.status].label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs hover:bg-gray-200">
                        PDF
                      </button>
                      {report.status === 'generated' && (
                        <button className="px-2 py-1 bg-amber-100 text-amber-700 rounded text-xs hover:bg-amber-200">
                          Déclarer
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Management Reports Grid */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Rapports de gestion</h2>
        <div className="grid grid-cols-3 gap-4">
          {managementReports.map((report) => (
            <div key={report.id} className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow cursor-pointer">
              <div className="flex items-start gap-4">
                <span className="text-3xl">{report.icon}</span>
                <div className="flex-1">
                  <h3 className="font-medium text-gray-900">{report.name}</h3>
                  <p className="text-sm text-gray-500 mt-1">{report.description}</p>
                  <button className="mt-3 text-sm text-emerald-600 hover:text-emerald-700 font-medium">
                    Générer le rapport →
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Annual Reports */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="font-semibold text-gray-900 mb-4">Rapports annuels</h2>
        <div className="grid grid-cols-4 gap-4">
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-sm text-blue-600">T2 - Déclaration fédérale</p>
            <p className="font-bold text-blue-900 mt-1">2025</p>
            <p className="text-xs text-blue-600 mt-2">Échéance: 30 juin 2026</p>
            <button className="mt-3 text-sm text-blue-700 hover:underline">Préparer →</button>
          </div>
          <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
            <p className="text-sm text-purple-600">CO-17 - Déclaration Québec</p>
            <p className="font-bold text-purple-900 mt-1">2025</p>
            <p className="text-xs text-purple-600 mt-2">Échéance: 30 juin 2026</p>
            <button className="mt-3 text-sm text-purple-700 hover:underline">Préparer →</button>
          </div>
          <div className="p-4 bg-green-50 rounded-lg border border-green-200">
            <p className="text-sm text-green-600">États financiers</p>
            <p className="font-bold text-green-900 mt-1">2025</p>
            <p className="text-xs text-green-600 mt-2">À réviser</p>
            <button className="mt-3 text-sm text-green-700 hover:underline">Générer →</button>
          </div>
          <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
            <p className="text-sm text-amber-600">Rapport d'audit</p>
            <p className="font-bold text-amber-900 mt-1">2025</p>
            <p className="text-xs text-amber-600 mt-2">Optionnel</p>
            <button className="mt-3 text-sm text-amber-700 hover:underline">Demander →</button>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 rounded-xl p-6 text-white">
        <h3 className="font-semibold text-emerald-100 mb-4">Résumé fiscal {selectedYear}</h3>
        <div className="grid grid-cols-4 gap-6">
          <div>
            <p className="text-emerald-200 text-sm">TPS collectée</p>
            <p className="text-2xl font-bold">9,470 $</p>
          </div>
          <div>
            <p className="text-emerald-200 text-sm">TVQ collectée</p>
            <p className="text-2xl font-bold">18,870 $</p>
          </div>
          <div>
            <p className="text-emerald-200 text-sm">CTI/RTI réclamés</p>
            <p className="text-2xl font-bold">5,970 $</p>
          </div>
          <div>
            <p className="text-emerald-200 text-sm">Net à remettre</p>
            <p className="text-2xl font-bold">22,370 $</p>
          </div>
        </div>
      </div>
    </div>
  );
}
