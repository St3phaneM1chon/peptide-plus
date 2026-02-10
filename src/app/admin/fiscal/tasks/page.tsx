'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { getAllCountriesWithCompliance } from '@/lib/countryObligations';

interface TaskWithCountry {
  id: string;
  name: string;
  nameFr: string;
  description: string;
  descriptionFr: string;
  dueDate: string;
  frequency: string;
  countryCode: string;
  countryName: string;
  status: 'pending' | 'completed' | 'overdue';
}

export default function FiscalTasksPage() {
  const countries = getAllCountriesWithCompliance();
  
  // Flatten all tasks from all countries
  const allTasks = useMemo(() => {
    const tasks: TaskWithCountry[] = [];
    countries.forEach(country => {
      country.annualTasks.forEach(task => {
        tasks.push({
          ...task,
          countryCode: country.code,
          countryName: country.name,
          status: task.status || 'pending',
        });
      });
    });
    return tasks;
  }, [countries]);
  
  const [tasks, setTasks] = useState<TaskWithCountry[]>(allTasks);
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'completed' | 'overdue'>('all');
  const [filterFrequency, setFilterFrequency] = useState<string>('all');
  const [filterCountry, setFilterCountry] = useState<string>('all');
  
  // Filter tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      const matchesStatus = filterStatus === 'all' || task.status === filterStatus;
      const matchesFrequency = filterFrequency === 'all' || task.frequency === filterFrequency;
      const matchesCountry = filterCountry === 'all' || task.countryCode === filterCountry;
      return matchesStatus && matchesFrequency && matchesCountry;
    });
  }, [tasks, filterStatus, filterFrequency, filterCountry]);
  
  // Group tasks by due date period
  const groupedTasks = useMemo(() => {
    const groups: Record<string, TaskWithCountry[]> = {
      'urgent': [],
      'thisMonth': [],
      'thisQuarter': [],
      'later': [],
    };
    
    // For demo, we'll just distribute them
    filteredTasks.forEach((task, index) => {
      if (index % 4 === 0) groups.urgent.push(task);
      else if (index % 4 === 1) groups.thisMonth.push(task);
      else if (index % 4 === 2) groups.thisQuarter.push(task);
      else groups.later.push(task);
    });
    
    return groups;
  }, [filteredTasks]);
  
  const toggleTaskStatus = (taskId: string) => {
    setTasks(prev => prev.map(t => 
      t.id === taskId 
        ? { ...t, status: t.status === 'completed' ? 'pending' : 'completed' as const }
        : t
    ));
  };
  
  const stats = useMemo(() => ({
    total: tasks.length,
    pending: tasks.filter(t => t.status === 'pending').length,
    completed: tasks.filter(t => t.status === 'completed').length,
    overdue: tasks.filter(t => t.status === 'overdue').length,
  }), [tasks]);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-2">
            <Link href="/admin/fiscal" className="text-gray-500 hover:text-gray-700">
              ← Obligations Fiscales
            </Link>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Tâches & Échéances Fiscales
              </h1>
              <p className="text-gray-600 mt-1">
                Suivi des déclarations et obligations pour tous les pays
              </p>
            </div>
            <button className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600">
              + Ajouter une tâche
            </button>
          </div>
        </div>
        
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <div className="text-3xl font-bold text-blue-600">{stats.total}</div>
            <div className="text-sm text-gray-600">Tâches totales</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <div className="text-3xl font-bold text-yellow-600">{stats.pending}</div>
            <div className="text-sm text-gray-600">En attente</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <div className="text-3xl font-bold text-green-600">{stats.completed}</div>
            <div className="text-sm text-gray-600">Complétées</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <div className="text-3xl font-bold text-red-600">{stats.overdue}</div>
            <div className="text-sm text-gray-600">En retard</div>
          </div>
        </div>
        
        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6 border border-gray-100">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Statut</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as typeof filterStatus)}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg"
              >
                <option value="all">Tous les statuts</option>
                <option value="pending">En attente</option>
                <option value="completed">Complétées</option>
                <option value="overdue">En retard</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fréquence</label>
              <select
                value={filterFrequency}
                onChange={(e) => setFilterFrequency(e.target.value)}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg"
              >
                <option value="all">Toutes</option>
                <option value="monthly">Mensuelle</option>
                <option value="quarterly">Trimestrielle</option>
                <option value="annually">Annuelle</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Pays</label>
              <select
                value={filterCountry}
                onChange={(e) => setFilterCountry(e.target.value)}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg"
              >
                <option value="all">Tous les pays</option>
                {countries.map(c => (
                  <option key={c.code} value={c.code}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
        
        {/* Task Groups */}
        <div className="space-y-6">
          {/* Urgent */}
          {groupedTasks.urgent.length > 0 && (
            <TaskGroup 
              title="🚨 Urgent - Cette semaine"
              tasks={groupedTasks.urgent}
              onToggle={toggleTaskStatus}
              bgColor="bg-red-50"
              borderColor="border-red-200"
            />
          )}
          
          {/* This Month */}
          {groupedTasks.thisMonth.length > 0 && (
            <TaskGroup 
              title="📅 Ce mois-ci"
              tasks={groupedTasks.thisMonth}
              onToggle={toggleTaskStatus}
              bgColor="bg-orange-50"
              borderColor="border-orange-200"
            />
          )}
          
          {/* This Quarter */}
          {groupedTasks.thisQuarter.length > 0 && (
            <TaskGroup 
              title="📆 Ce trimestre"
              tasks={groupedTasks.thisQuarter}
              onToggle={toggleTaskStatus}
              bgColor="bg-yellow-50"
              borderColor="border-yellow-200"
            />
          )}
          
          {/* Later */}
          {groupedTasks.later.length > 0 && (
            <TaskGroup 
              title="📋 Plus tard"
              tasks={groupedTasks.later}
              onToggle={toggleTaskStatus}
              bgColor="bg-gray-50"
              borderColor="border-gray-200"
            />
          )}
        </div>
        
        {filteredTasks.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            Aucune tâche trouvée avec ces critères
          </div>
        )}
      </div>
    </div>
  );
}

function TaskGroup({ 
  title, 
  tasks, 
  onToggle,
  bgColor,
  borderColor
}: { 
  title: string; 
  tasks: TaskWithCountry[]; 
  onToggle: (id: string) => void;
  bgColor: string;
  borderColor: string;
}) {
  return (
    <div className={`rounded-xl ${bgColor} border ${borderColor} overflow-hidden`}>
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="font-semibold text-gray-900">{title}</h3>
      </div>
      <div className="divide-y divide-gray-200">
        {tasks.map((task) => (
          <div key={task.id} className="px-6 py-4 bg-white hover:bg-gray-50">
            <div className="flex items-start gap-4">
              <button
                onClick={() => onToggle(task.id)}
                className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                  task.status === 'completed'
                    ? 'bg-green-500 border-green-500 text-white'
                    : 'border-gray-300 hover:border-green-500'
                }`}
              >
                {task.status === 'completed' && (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
              
              <div className="flex-grow">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{getCountryFlag(task.countryCode)}</span>
                    <h4 className={`font-semibold ${task.status === 'completed' ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                      {task.name}
                    </h4>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      task.frequency === 'monthly' ? 'bg-blue-100 text-blue-700' :
                      task.frequency === 'quarterly' ? 'bg-purple-100 text-purple-700' :
                      'bg-orange-100 text-orange-700'
                    }`}>
                      {task.frequency === 'monthly' ? 'Mensuel' :
                       task.frequency === 'quarterly' ? 'Trimestriel' : 'Annuel'}
                    </span>
                    <Link 
                      href={`/admin/fiscal/country/${task.countryCode}`}
                      className="text-blue-600 hover:text-blue-800 text-sm"
                    >
                      {task.countryName} →
                    </Link>
                  </div>
                </div>
                <p className="text-sm text-gray-600 mt-1">{task.description}</p>
                <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                  <span>📅 Échéance: {task.dueDate}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function getCountryFlag(code: string): string {
  const flags: Record<string, string> = {
    CA: '🇨🇦', US: '🇺🇸', EU: '🇪🇺', GB: '🇬🇧', JP: '🇯🇵', 
    AU: '🇦🇺', AE: '🇦🇪', IL: '🇮🇱', CL: '🇨🇱', PE: '🇵🇪',
  };
  return flags[code] || '🌍';
}
