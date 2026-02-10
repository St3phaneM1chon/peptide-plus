'use client';

import { useState } from 'react';

interface ExportJob {
  id: string;
  type: string;
  format: string;
  dateRange: string;
  status: 'COMPLETED' | 'PROCESSING' | 'FAILED';
  createdAt: Date;
  fileUrl?: string;
  records: number;
}

export default function ExportsPage() {
  const [, setActiveExport] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportConfig, setExportConfig] = useState({
    format: 'quickbooks',
    dateFrom: new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0],
    dateTo: new Date().toISOString().split('T')[0],
    includePosted: true,
    includeDraft: false,
  });

  const [history, setHistory] = useState<ExportJob[]>([
    {
      id: 'exp-1',
      type: 'Journal Entries',
      format: 'QuickBooks Online',
      dateRange: 'Jan 2026',
      status: 'COMPLETED',
      createdAt: new Date(Date.now() - 3600000),
      fileUrl: '#',
      records: 45,
    },
    {
      id: 'exp-2',
      type: 'Chart of Accounts',
      format: 'Sage 50 CSV',
      dateRange: 'Tous',
      status: 'COMPLETED',
      createdAt: new Date(Date.now() - 86400000),
      fileUrl: '#',
      records: 55,
    },
  ]);

  const exportFormats = [
    {
      id: 'quickbooks',
      name: 'QuickBooks Online',
      icon: '📊',
      description: 'Format JSON pour import direct dans QBO',
      fileType: 'JSON',
    },
    {
      id: 'sage',
      name: 'Sage 50',
      icon: '📈',
      description: 'Format CSV compatible Sage 50 Canada',
      fileType: 'CSV',
    },
    {
      id: 'iif',
      name: 'QuickBooks Desktop (IIF)',
      icon: '💾',
      description: 'Format IIF pour versions desktop',
      fileType: 'IIF',
    },
    {
      id: 'excel',
      name: 'Excel',
      icon: '📗',
      description: 'Tableur Excel avec toutes les données',
      fileType: 'XLSX',
    },
    {
      id: 'csv',
      name: 'CSV Générique',
      icon: '📄',
      description: 'Format CSV standard',
      fileType: 'CSV',
    },
  ];

  const dataTypes = [
    { id: 'entries', name: 'Écritures de journal', count: 156 },
    { id: 'accounts', name: 'Plan comptable', count: 55 },
    { id: 'customers', name: 'Factures clients', count: 89 },
    { id: 'suppliers', name: 'Factures fournisseurs', count: 34 },
    { id: 'transactions', name: 'Transactions bancaires', count: 245 },
  ];

  const handleExport = async () => {
    setExporting(true);
    
    // Simulate export
    await new Promise(resolve => setTimeout(resolve, 2500));
    
    const newExport: ExportJob = {
      id: `exp-${Date.now()}`,
      type: 'Journal Entries',
      format: exportFormats.find(f => f.id === exportConfig.format)?.name || '',
      dateRange: `${exportConfig.dateFrom} à ${exportConfig.dateTo}`,
      status: 'COMPLETED',
      createdAt: new Date(),
      fileUrl: '#',
      records: Math.floor(Math.random() * 100) + 20,
    };
    
    setHistory(prev => [newExport, ...prev]);
    setExporting(false);
    setActiveExport(null);
    
    // Trigger download
    alert('Export terminé! Téléchargement en cours...');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white">Exports comptables</h1>
          <p className="text-neutral-400 mt-1">Exportez vos données vers QuickBooks, Sage et autres</p>
        </div>
      </div>

      {/* Format Selection */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {exportFormats.map(format => (
          <button
            key={format.id}
            onClick={() => {
              setExportConfig(prev => ({ ...prev, format: format.id }));
              setActiveExport(format.id);
            }}
            className={`p-4 rounded-xl border transition-all text-left ${
              exportConfig.format === format.id
                ? 'bg-amber-600/20 border-amber-500'
                : 'bg-neutral-800 border-neutral-700 hover:border-neutral-600'
            }`}
          >
            <div className="text-2xl mb-2">{format.icon}</div>
            <h3 className="font-medium text-white">{format.name}</h3>
            <p className="text-xs text-neutral-400 mt-1">{format.description}</p>
            <span className="inline-block mt-2 px-2 py-0.5 bg-neutral-700 rounded text-xs text-neutral-300">
              .{format.fileType.toLowerCase()}
            </span>
          </button>
        ))}
      </div>

      {/* Export Configuration */}
      <div className="bg-neutral-800 rounded-xl border border-neutral-700 p-6">
        <h2 className="text-lg font-medium text-white mb-4">Configuration de l'export</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Data to export */}
          <div>
            <h3 className="text-sm font-medium text-neutral-300 mb-3">Données à exporter</h3>
            <div className="space-y-2">
              {dataTypes.map(type => (
                <label key={type.id} className="flex items-center justify-between p-3 bg-neutral-700/50 rounded-lg cursor-pointer hover:bg-neutral-700">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      defaultChecked={type.id === 'entries'}
                      className="rounded border-neutral-600 bg-neutral-700 text-amber-500"
                    />
                    <span className="text-white">{type.name}</span>
                  </div>
                  <span className="text-sm text-neutral-400">{type.count} enr.</span>
                </label>
              ))}
            </div>
          </div>

          {/* Options */}
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-medium text-neutral-300 mb-3">Période</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-neutral-400 mb-1">Du</label>
                  <input
                    type="date"
                    value={exportConfig.dateFrom}
                    onChange={e => setExportConfig(prev => ({ ...prev, dateFrom: e.target.value }))}
                    className="w-full px-3 py-2 bg-neutral-700 border border-neutral-600 rounded-lg text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-neutral-400 mb-1">Au</label>
                  <input
                    type="date"
                    value={exportConfig.dateTo}
                    onChange={e => setExportConfig(prev => ({ ...prev, dateTo: e.target.value }))}
                    className="w-full px-3 py-2 bg-neutral-700 border border-neutral-600 rounded-lg text-white"
                  />
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-medium text-neutral-300 mb-3">Options</h3>
              <div className="space-y-2">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={exportConfig.includePosted}
                    onChange={e => setExportConfig(prev => ({ ...prev, includePosted: e.target.checked }))}
                    className="rounded border-neutral-600 bg-neutral-700 text-amber-500"
                  />
                  <span className="text-neutral-300">Inclure les écritures validées</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={exportConfig.includeDraft}
                    onChange={e => setExportConfig(prev => ({ ...prev, includeDraft: e.target.checked }))}
                    className="rounded border-neutral-600 bg-neutral-700 text-amber-500"
                  />
                  <span className="text-neutral-300">Inclure les brouillons</span>
                </label>
              </div>
            </div>

            <button
              onClick={handleExport}
              disabled={exporting}
              className="w-full py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-medium disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {exporting ? (
                <>
                  <span className="animate-spin">⏳</span>
                  Export en cours...
                </>
              ) : (
                <>
                  📥 Générer l'export
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* API Integration */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-neutral-800 rounded-xl border border-neutral-700 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-green-900/30 rounded-lg flex items-center justify-center text-xl">📊</div>
            <div>
              <h3 className="font-medium text-white">QuickBooks Online</h3>
              <p className="text-xs text-neutral-400">Synchronisation en temps réel</p>
            </div>
          </div>
          <p className="text-sm text-neutral-400 mb-4">
            Connectez votre compte QuickBooks pour une synchronisation automatique des écritures.
          </p>
          <button className="w-full py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm">
            Connecter QuickBooks
          </button>
        </div>

        <div className="bg-neutral-800 rounded-xl border border-neutral-700 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-blue-900/30 rounded-lg flex items-center justify-center text-xl">📈</div>
            <div>
              <h3 className="font-medium text-white">Sage 50</h3>
              <p className="text-xs text-neutral-400">Export manuel</p>
            </div>
          </div>
          <p className="text-sm text-neutral-400 mb-4">
            Exportez vos données au format CSV compatible Sage 50 Canada.
          </p>
          <button className="w-full py-2 bg-neutral-700 hover:bg-neutral-600 text-white rounded-lg text-sm">
            Exporter pour Sage
          </button>
        </div>
      </div>

      {/* Export History */}
      <div className="bg-neutral-800 rounded-xl border border-neutral-700 overflow-hidden">
        <div className="p-4 border-b border-neutral-700">
          <h2 className="font-medium text-white">Historique des exports</h2>
        </div>
        <table className="w-full">
          <thead className="bg-neutral-900/50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-neutral-400 uppercase">Date</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-neutral-400 uppercase">Type</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-neutral-400 uppercase">Format</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-neutral-400 uppercase">Période</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-neutral-400 uppercase">Enregistrements</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-neutral-400 uppercase">Statut</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-neutral-400 uppercase">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-700">
            {history.map(job => (
              <tr key={job.id} className="hover:bg-neutral-700/30">
                <td className="px-4 py-3 text-neutral-300">
                  {job.createdAt.toLocaleDateString('fr-CA')} {job.createdAt.toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' })}
                </td>
                <td className="px-4 py-3 text-white">{job.type}</td>
                <td className="px-4 py-3 text-neutral-300">{job.format}</td>
                <td className="px-4 py-3 text-neutral-300">{job.dateRange}</td>
                <td className="px-4 py-3 text-right text-white">{job.records}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`px-2 py-1 rounded text-xs ${
                    job.status === 'COMPLETED' ? 'bg-green-900/30 text-green-400' :
                    job.status === 'PROCESSING' ? 'bg-amber-900/30 text-amber-400' :
                    'bg-red-900/30 text-red-400'
                  }`}>
                    {job.status === 'COMPLETED' ? 'Terminé' : job.status === 'PROCESSING' ? 'En cours' : 'Échoué'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  {job.status === 'COMPLETED' && (
                    <button className="px-3 py-1 bg-neutral-700 hover:bg-neutral-600 text-white text-sm rounded">
                      📥 Télécharger
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
