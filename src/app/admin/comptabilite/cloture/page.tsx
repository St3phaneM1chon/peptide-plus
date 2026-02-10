'use client';

import { useState } from 'react';

interface Period {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: 'OPEN' | 'IN_REVIEW' | 'CLOSED' | 'LOCKED';
  tasks: CloseTask[];
}

interface CloseTask {
  id: string;
  name: string;
  description: string;
  status: 'TODO' | 'IN_PROGRESS' | 'DONE' | 'SKIPPED';
  required: boolean;
}

export default function CloturePage() {
  const [selectedPeriod, setSelectedPeriod] = useState('2026-01');

  const periods: Period[] = [
    {
      id: '1',
      name: 'Janvier 2026',
      startDate: '2026-01-01',
      endDate: '2026-01-31',
      status: 'OPEN',
      tasks: [
        { id: '1', name: 'Rapprochement bancaire', description: 'Rapprocher tous les comptes bancaires', status: 'IN_PROGRESS', required: true },
        { id: '2', name: 'Vérifier comptes clients', description: 'Analyser les créances et provisions', status: 'TODO', required: true },
        { id: '3', name: 'Vérifier comptes fournisseurs', description: 'S\'assurer que toutes les factures sont enregistrées', status: 'TODO', required: true },
        { id: '4', name: 'Inventaire', description: 'Valider la valeur des stocks', status: 'TODO', required: true },
        { id: '5', name: 'Écritures d\'amortissement', description: 'Passer les écritures mensuelles', status: 'DONE', required: true },
        { id: '6', name: 'Cut-off revenus', description: 'Vérifier les revenus à la bonne période', status: 'TODO', required: true },
        { id: '7', name: 'Cut-off charges', description: 'Vérifier les charges à la bonne période', status: 'TODO', required: true },
        { id: '8', name: 'Taxes TPS/TVQ', description: 'Calculer et vérifier les taxes', status: 'TODO', required: true },
        { id: '9', name: 'Balance de vérification', description: 'Vérifier l\'équilibre des comptes', status: 'TODO', required: true },
        { id: '10', name: 'Révision états financiers', description: 'Vérifier les états financiers préliminaires', status: 'TODO', required: false },
      ]
    },
    {
      id: '2',
      name: 'Décembre 2025',
      startDate: '2025-12-01',
      endDate: '2025-12-31',
      status: 'IN_REVIEW',
      tasks: [
        { id: '1', name: 'Rapprochement bancaire', description: '', status: 'DONE', required: true },
        { id: '2', name: 'Vérifier comptes clients', description: '', status: 'DONE', required: true },
        { id: '3', name: 'Vérifier comptes fournisseurs', description: '', status: 'DONE', required: true },
        { id: '4', name: 'Inventaire', description: '', status: 'DONE', required: true },
        { id: '5', name: 'Écritures d\'amortissement', description: '', status: 'DONE', required: true },
        { id: '6', name: 'Cut-off revenus', description: '', status: 'DONE', required: true },
        { id: '7', name: 'Cut-off charges', description: '', status: 'DONE', required: true },
        { id: '8', name: 'Taxes TPS/TVQ', description: '', status: 'DONE', required: true },
        { id: '9', name: 'Balance de vérification', description: '', status: 'DONE', required: true },
        { id: '10', name: 'Révision états financiers', description: '', status: 'IN_PROGRESS', required: false },
      ]
    },
    {
      id: '3',
      name: 'Novembre 2025',
      startDate: '2025-11-01',
      endDate: '2025-11-30',
      status: 'LOCKED',
      tasks: []
    },
  ];

  const currentPeriod = periods.find(p => p.id === '1') || periods[0];
  const completedTasks = currentPeriod.tasks.filter(t => t.status === 'DONE').length;
  const requiredTasks = currentPeriod.tasks.filter(t => t.required).length;
  const completedRequired = currentPeriod.tasks.filter(t => t.required && t.status === 'DONE').length;

  const statusColors: Record<string, { label: string; color: string; bg: string }> = {
    OPEN: { label: 'Ouverte', color: 'text-blue-800', bg: 'bg-blue-100' },
    IN_REVIEW: { label: 'En révision', color: 'text-yellow-800', bg: 'bg-yellow-100' },
    CLOSED: { label: 'Fermée', color: 'text-green-800', bg: 'bg-green-100' },
    LOCKED: { label: 'Verrouillée', color: 'text-gray-800', bg: 'bg-gray-100' },
  };

  const taskStatusColors: Record<string, { label: string; color: string }> = {
    TODO: { label: 'À faire', color: 'bg-gray-100 text-gray-800' },
    IN_PROGRESS: { label: 'En cours', color: 'bg-blue-100 text-blue-800' },
    DONE: { label: 'Terminé', color: 'bg-green-100 text-green-800' },
    SKIPPED: { label: 'Ignoré', color: 'bg-gray-100 text-gray-500' },
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clôture de période</h1>
          <p className="text-gray-500">Gérez la clôture des périodes comptables</p>
        </div>
      </div>

      {/* Period Cards */}
      <div className="grid grid-cols-3 gap-4">
        {periods.map((period) => (
          <div
            key={period.id}
            onClick={() => setSelectedPeriod(period.id)}
            className={`bg-white rounded-xl p-5 border cursor-pointer transition-all hover:shadow-md ${
              selectedPeriod === period.id ? 'border-emerald-500 ring-2 ring-emerald-100' : 'border-gray-200'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900">{period.name}</h3>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[period.status].bg} ${statusColors[period.status].color}`}>
                {statusColors[period.status].label}
              </span>
            </div>
            <p className="text-sm text-gray-500 mb-3">
              {new Date(period.startDate).toLocaleDateString('fr-CA')} - {new Date(period.endDate).toLocaleDateString('fr-CA')}
            </p>
            {period.tasks.length > 0 && (
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-emerald-500 rounded-full"
                    style={{ width: `${(period.tasks.filter(t => t.status === 'DONE').length / period.tasks.length) * 100}%` }}
                  />
                </div>
                <span className="text-xs text-gray-500">
                  {period.tasks.filter(t => t.status === 'DONE').length}/{period.tasks.length}
                </span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Current Period Details */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200 bg-emerald-50">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-emerald-900">{currentPeriod.name}</h2>
              <p className="text-emerald-700">Checklist de clôture</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-emerald-600">Progression</p>
              <p className="text-2xl font-bold text-emerald-900">{completedTasks}/{currentPeriod.tasks.length}</p>
              <p className="text-xs text-emerald-600">{completedRequired}/{requiredTasks} obligatoires</p>
            </div>
          </div>
        </div>

        <div className="p-6">
          <div className="space-y-3">
            {currentPeriod.tasks.map((task) => (
              <div 
                key={task.id}
                className={`flex items-center gap-4 p-4 rounded-lg border ${
                  task.status === 'DONE' ? 'bg-green-50 border-green-200' :
                  task.status === 'IN_PROGRESS' ? 'bg-blue-50 border-blue-200' :
                  'bg-gray-50 border-gray-200'
                }`}
              >
                <div className="flex-shrink-0">
                  {task.status === 'DONE' ? (
                    <span className="w-8 h-8 flex items-center justify-center bg-green-500 text-white rounded-full">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </span>
                  ) : task.status === 'IN_PROGRESS' ? (
                    <span className="w-8 h-8 flex items-center justify-center bg-blue-500 text-white rounded-full">
                      <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    </span>
                  ) : (
                    <span className="w-8 h-8 flex items-center justify-center bg-gray-300 text-white rounded-full">
                      <span className="text-sm font-bold">{task.id}</span>
                    </span>
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium text-gray-900">{task.name}</h4>
                    {task.required && (
                      <span className="px-1.5 py-0.5 bg-red-100 text-red-700 rounded text-xs">Obligatoire</span>
                    )}
                  </div>
                  {task.description && (
                    <p className="text-sm text-gray-500 mt-0.5">{task.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${taskStatusColors[task.status].color}`}>
                    {taskStatusColors[task.status].label}
                  </span>
                  {task.status !== 'DONE' && task.status !== 'SKIPPED' && (
                    <button className="p-1.5 text-emerald-600 hover:bg-emerald-100 rounded">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="p-6 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
          <p className="text-sm text-gray-600">
            {completedRequired === requiredTasks ? (
              <span className="text-green-600">✓ Toutes les tâches obligatoires sont complétées</span>
            ) : (
              <span className="text-yellow-600">⚠ {requiredTasks - completedRequired} tâche(s) obligatoire(s) restante(s)</span>
            )}
          </p>
          <div className="flex gap-3">
            <button className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300">
              Sauvegarder
            </button>
            <button 
              disabled={completedRequired !== requiredTasks}
              className={`px-4 py-2 rounded-lg ${
                completedRequired === requiredTasks
                  ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              Clôturer la période
            </button>
          </div>
        </div>
      </div>

      {/* Tips */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
        <h3 className="font-semibold text-blue-900 mb-2">Conseils pour la clôture</h3>
        <ul className="space-y-2 text-sm text-blue-800">
          <li className="flex items-start gap-2">
            <span className="text-blue-500">•</span>
            Effectuez le rapprochement bancaire avant les autres tâches
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-500">•</span>
            Vérifiez les factures fournisseurs non enregistrées (cut-off)
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-500">•</span>
            Passez les écritures d'amortissement et de provisions
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-500">•</span>
            Une fois verrouillée, la période ne peut plus être modifiée sans autorisation
          </li>
        </ul>
      </div>
    </div>
  );
}
