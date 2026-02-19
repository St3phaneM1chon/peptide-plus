'use client';

/**
 * PAGE SUIVI DES PROTOCOLES DE RECHERCHE - BioCycle Peptides
 * Aide les chercheurs à suivre leurs protocoles pour maximiser les résultats
 */

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/i18n/client';

// Types
interface ProtocolEntry {
  id: string;
  date: string;
  peptide: string;
  dosage: number;
  unit: 'mcg' | 'mg' | 'IU';
  frequency: string;
  time: string;
  notes: string;
  sideEffects: string[];
  effectiveness: number; // 1-5
  bodyWeight?: number;
  photos?: string[];
}

interface Protocol {
  id: string;
  name: string;
  description: string;
  peptides: string[];
  startDate: string;
  endDate?: string;
  status: 'active' | 'completed' | 'paused';
  goal: string;
  entries: ProtocolEntry[];
  createdAt: string;
}

interface ProtocolTemplate {
  id: string;
  name: string;
  description: string;
  peptides: string[];
  duration: string;
  goal: string;
  instructions: string;
}

// Templates de protocoles populaires - function to allow i18n
function getProtocolTemplates(t: (key: string) => string): ProtocolTemplate[] {
  return [
    {
      id: 'recovery',
      name: t('protocols.templateRecoveryName'),
      description: t('protocols.templateRecoveryDesc'),
      peptides: ['BPC-157', 'TB-500'],
      duration: t('protocols.templateRecoveryDuration'),
      goal: t('protocols.templateRecoveryGoal'),
      instructions: t('protocols.templateRecoveryInstructions'),
    },
    {
      id: 'weight-loss',
      name: t('protocols.templateWeightLossName'),
      description: t('protocols.templateWeightLossDesc'),
      peptides: ['Semaglutide', 'Tirzepatide'],
      duration: t('protocols.templateWeightLossDuration'),
      goal: t('protocols.templateWeightLossGoal'),
      instructions: t('protocols.templateWeightLossInstructions'),
    },
    {
      id: 'anti-aging',
      name: t('protocols.templateAntiAgingName'),
      description: t('protocols.templateAntiAgingDesc'),
      peptides: ['GHK-Cu', 'Epithalon', 'NAD+'],
      duration: t('protocols.templateAntiAgingDuration'),
      goal: t('protocols.templateAntiAgingGoal'),
      instructions: t('protocols.templateAntiAgingInstructions'),
    },
    {
      id: 'cognitive',
      name: t('protocols.templateCognitiveName'),
      description: t('protocols.templateCognitiveDesc'),
      peptides: ['Semax', 'Selank', 'Dihexa'],
      duration: t('protocols.templateCognitiveDuration'),
      goal: t('protocols.templateCognitiveGoal'),
      instructions: t('protocols.templateCognitiveInstructions'),
    },
    {
      id: 'muscle-growth',
      name: t('protocols.templateMuscleGrowthName'),
      description: t('protocols.templateMuscleGrowthDesc'),
      peptides: ['CJC-1295', 'Ipamorelin', 'GHRP-6'],
      duration: t('protocols.templateMuscleGrowthDuration'),
      goal: t('protocols.templateMuscleGrowthGoal'),
      instructions: t('protocols.templateMuscleGrowthInstructions'),
    },
  ];
}

export default function ProtocolsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { t } = useI18n();

  // Memoized templates with translations
  const PROTOCOL_TEMPLATES = useMemo(() => getProtocolTemplates(t), [t]);

  // State
  const [protocols, setProtocols] = useState<Protocol[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'my-protocols' | 'templates' | 'new'>('my-protocols');
  const [selectedProtocol, setSelectedProtocol] = useState<Protocol | null>(null);
  const [_showNewEntry, _setShowNewEntry] = useState(false);
  const [showNewProtocol, setShowNewProtocol] = useState(false);

  // Auth check
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin?callbackUrl=/account/protocols');
    }
  }, [status, router]);

  // Load protocols from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('research_protocols');
      if (saved) {
        setProtocols(JSON.parse(saved));
      }
      setLoading(false);
    }
  }, []);

  // Save protocols
  const saveProtocols = (newProtocols: Protocol[]) => {
    setProtocols(newProtocols);
    localStorage.setItem('research_protocols', JSON.stringify(newProtocols));
  };

  // Create new protocol
  const createProtocol = (template?: ProtocolTemplate) => {
    const newProtocol: Protocol = {
      id: `protocol_${Date.now()}`,
      name: template?.name || t('protocols.newProtocolDefault'),
      description: template?.description || '',
      peptides: template?.peptides || [],
      startDate: new Date().toISOString(),
      status: 'active',
      goal: template?.goal || '',
      entries: [],
      createdAt: new Date().toISOString(),
    };
    saveProtocols([...protocols, newProtocol]);
    setSelectedProtocol(newProtocol);
    setActiveTab('my-protocols');
  };

  // Add entry to protocol
  const addEntry = (protocolId: string, entry: Omit<ProtocolEntry, 'id'>) => {
    const newEntry: ProtocolEntry = {
      ...entry,
      id: `entry_${Date.now()}`,
    };
    const updated = protocols.map(p => {
      if (p.id === protocolId) {
        return { ...p, entries: [...p.entries, newEntry] };
      }
      return p;
    });
    saveProtocols(updated);
    setSelectedProtocol(updated.find(p => p.id === protocolId) || null);
  };

  // Update protocol status
  const updateProtocolStatus = (protocolId: string, status: Protocol['status']) => {
    const updated = protocols.map(p => {
      if (p.id === protocolId) {
        return { 
          ...p, 
          status,
          endDate: status === 'completed' ? new Date().toISOString() : p.endDate 
        };
      }
      return p;
    });
    saveProtocols(updated);
  };

  // Delete protocol
  const deleteProtocol = (protocolId: string) => {
    if (confirm(t('protocols.confirmDelete'))) {
      saveProtocols(protocols.filter(p => p.id !== protocolId));
      setSelectedProtocol(null);
    }
  };

  // Stats
  const stats = useMemo(() => {
    const active = protocols.filter(p => p.status === 'active').length;
    const completed = protocols.filter(p => p.status === 'completed').length;
    const totalEntries = protocols.reduce((sum, p) => sum + p.entries.length, 0);
    const uniquePeptides = new Set(protocols.flatMap(p => p.peptides)).size;
    return { active, completed, totalEntries, uniquePeptides };
  }, [protocols]);

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <nav className="text-sm text-gray-500 mb-2">
            <Link href="/" className="hover:text-orange-600">{t('account.home')}</Link>
            <span className="mx-2">/</span>
            <Link href="/account" className="hover:text-orange-600">{t('account.myAccount')}</Link>
            <span className="mx-2">/</span>
            <span className="text-gray-900">{t('protocols.title')}</span>
          </nav>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{t('protocols.pageTitle')}</h1>
              <p className="text-gray-600 mt-1">{t('protocols.pageSubtitle')}</p>
            </div>
            <button
              onClick={() => setShowNewProtocol(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium transition-colors"
            >
              {t('protocols.newProtocol')}
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard icon="🔬" label={t('protocols.activeProtocols')} value={stats.active} color="green" />
          <StatCard icon="✅" label={t('protocols.completed')} value={stats.completed} color="blue" />
          <StatCard icon="📝" label={t('protocols.totalEntries')} value={stats.totalEntries} color="purple" />
          <StatCard icon="🧪" label={t('protocols.peptidesUsed')} value={stats.uniquePeptides} color="orange" />
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6">
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setActiveTab('my-protocols')}
              className={`flex-1 py-4 text-sm font-medium transition-colors ${
                activeTab === 'my-protocols'
                  ? 'bg-orange-50 text-orange-600 border-b-2 border-orange-500'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              {t('protocols.myProtocols')} ({protocols.length})
            </button>
            <button
              onClick={() => setActiveTab('templates')}
              className={`flex-1 py-4 text-sm font-medium transition-colors ${
                activeTab === 'templates'
                  ? 'bg-orange-50 text-orange-600 border-b-2 border-orange-500'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              {t('protocols.suggestedProtocols')}
            </button>
          </div>

          <div className="p-6">
            {/* My Protocols Tab */}
            {activeTab === 'my-protocols' && (
              <>
                {protocols.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-20 h-20 mx-auto mb-6 bg-gray-100 rounded-full flex items-center justify-center">
                      <span className="text-4xl">📋</span>
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('protocols.noProtocols')}</h3>
                    <p className="text-gray-600 mb-6">
                      {t('protocols.noProtocolsDesc')}
                    </p>
                    <button
                      onClick={() => setActiveTab('templates')}
                      className="inline-block bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-lg font-medium transition-colors"
                    >
                      {t('protocols.viewSuggested')}
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {protocols.map(protocol => (
                      <ProtocolCard
                        key={protocol.id}
                        protocol={protocol}
                        onClick={() => setSelectedProtocol(protocol)}
                        onStatusChange={(status) => updateProtocolStatus(protocol.id, status)}
                      />
                    ))}
                  </div>
                )}
              </>
            )}

            {/* Templates Tab */}
            {activeTab === 'templates' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {PROTOCOL_TEMPLATES.map(template => (
                  <TemplateCard
                    key={template.id}
                    template={template}
                    onStart={() => createProtocol(template)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Selected Protocol Detail */}
        {selectedProtocol && (
          <ProtocolDetailModal
            protocol={selectedProtocol}
            onClose={() => setSelectedProtocol(null)}
            onAddEntry={(entry) => addEntry(selectedProtocol.id, entry)}
            onDelete={() => deleteProtocol(selectedProtocol.id)}
            onStatusChange={(status) => {
              updateProtocolStatus(selectedProtocol.id, status);
              setSelectedProtocol({ ...selectedProtocol, status });
            }}
          />
        )}

        {/* New Protocol Modal */}
        {showNewProtocol && (
          <NewProtocolModal
            onClose={() => setShowNewProtocol(false)}
            onCreate={(protocol) => {
              saveProtocols([...protocols, protocol]);
              setShowNewProtocol(false);
              setSelectedProtocol(protocol);
            }}
          />
        )}

        {/* Tips Section */}
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-200">
          <h3 className="font-bold text-blue-900 mb-4 flex items-center gap-2">
            {t('protocols.tipsTitle')}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <TipCard
              icon="📅"
              title={t('protocols.tipConsistencyTitle')}
              text={t('protocols.tipConsistencyText')}
            />
            <TipCard
              icon="📝"
              title={t('protocols.tipDocumentationTitle')}
              text={t('protocols.tipDocumentationText')}
            />
            <TipCard
              icon="⚖️"
              title={t('protocols.tipDosageTitle')}
              text={t('protocols.tipDosageText')}
            />
            <TipCard
              icon="🍎"
              title={t('protocols.tipNutritionTitle')}
              text={t('protocols.tipNutritionText')}
            />
            <TipCard
              icon="😴"
              title={t('protocols.tipRecoveryTitle')}
              text={t('protocols.tipRecoveryText')}
            />
            <TipCard
              icon="💧"
              title={t('protocols.tipHydrationTitle')}
              text={t('protocols.tipHydrationText')}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// COMPOSANTS
// ============================================

function StatCard({ icon, label, value, color }: { icon: string; label: string; value: number; color: string }) {
  const colors: Record<string, string> = {
    green: 'bg-green-100 text-green-800',
    blue: 'bg-blue-100 text-blue-800',
    purple: 'bg-purple-100 text-purple-800',
    orange: 'bg-orange-100 text-orange-800',
  };
  return (
    <div className="bg-white rounded-xl p-4 border border-gray-200">
      <div className="flex items-center gap-3">
        <span className="text-2xl">{icon}</span>
        <div>
          <p className={`text-2xl font-bold ${colors[color]?.split(' ')[1] || 'text-gray-900'}`}>{value}</p>
          <p className="text-xs text-gray-500">{label}</p>
        </div>
      </div>
    </div>
  );
}

function TipCard({ icon, title, text }: { icon: string; title: string; text: string }) {
  return (
    <div className="bg-white/60 rounded-lg p-4">
      <div className="flex items-start gap-3">
        <span className="text-xl">{icon}</span>
        <div>
          <p className="font-medium text-blue-900">{title}</p>
          <p className="text-sm text-blue-700">{text}</p>
        </div>
      </div>
    </div>
  );
}

function ProtocolCard({
  protocol,
  onClick,
  onStatusChange
}: {
  protocol: Protocol;
  onClick: () => void;
  onStatusChange: (status: Protocol['status']) => void;
}) {
  const { t } = useI18n();
  const statusColors: Record<string, string> = {
    active: 'bg-green-100 text-green-800',
    completed: 'bg-blue-100 text-blue-800',
    paused: 'bg-yellow-100 text-yellow-800',
  };
  const statusLabels: Record<string, string> = {
    active: t('protocols.statusActive'),
    completed: t('protocols.statusCompleted'),
    paused: t('protocols.statusPaused'),
  };

  const daysSinceStart = Math.floor(
    (Date.now() - new Date(protocol.startDate).getTime()) / (1000 * 60 * 60 * 24)
  );

  return (
    <div 
      className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
      onClick={onClick}
    >
      <div className="p-4">
        <div className="flex items-start justify-between mb-3">
          <h3 className="font-semibold text-gray-900 line-clamp-1">{protocol.name}</h3>
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[protocol.status]}`}>
            {statusLabels[protocol.status]}
          </span>
        </div>
        
        {protocol.description && (
          <p className="text-sm text-gray-600 line-clamp-2 mb-3">{protocol.description}</p>
        )}

        <div className="flex flex-wrap gap-1 mb-3">
          {protocol.peptides.slice(0, 3).map(p => (
            <span key={p} className="px-2 py-0.5 bg-orange-50 text-orange-700 rounded text-xs">
              {p}
            </span>
          ))}
          {protocol.peptides.length > 3 && (
            <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
              +{protocol.peptides.length - 3}
            </span>
          )}
        </div>

        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>📅 {t('protocols.day')} {daysSinceStart}</span>
          <span>📝 {protocol.entries.length} {t('protocols.entries')}</span>
        </div>
      </div>

      <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 flex gap-2" onClick={e => e.stopPropagation()}>
        {protocol.status === 'active' && (
          <>
            <button
              onClick={() => onStatusChange('paused')}
              className="flex-1 py-2 text-xs font-medium text-yellow-600 hover:bg-yellow-50 rounded transition-colors"
            >
              {t('protocols.pause')}
            </button>
            <button
              onClick={() => onStatusChange('completed')}
              className="flex-1 py-2 text-xs font-medium text-green-600 hover:bg-green-50 rounded transition-colors"
            >
              {t('protocols.finish')}
            </button>
          </>
        )}
        {protocol.status === 'paused' && (
          <button
            onClick={() => onStatusChange('active')}
            className="flex-1 py-2 text-xs font-medium text-green-600 hover:bg-green-50 rounded transition-colors"
          >
            {t('protocols.resume')}
          </button>
        )}
        {protocol.status === 'completed' && (
          <button
            onClick={() => onStatusChange('active')}
            className="flex-1 py-2 text-xs font-medium text-orange-600 hover:bg-orange-50 rounded transition-colors"
          >
            {t('protocols.restart')}
          </button>
        )}
      </div>
    </div>
  );
}

function TemplateCard({ template, onStart }: { template: ProtocolTemplate; onStart: () => void }) {
  const { t } = useI18n();
  const [showDetails, setShowDetails] = useState(false);

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-2">{template.name}</h3>
        <p className="text-gray-600 text-sm mb-4">{template.description}</p>
        
        <div className="flex flex-wrap gap-2 mb-4">
          {template.peptides.map(p => (
            <span key={p} className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-sm font-medium">
              {p}
            </span>
          ))}
        </div>

        <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
          <span>⏱️ {template.duration}</span>
          <span>🎯 {template.goal}</span>
        </div>

        {showDetails && (
          <div className="bg-gray-50 rounded-lg p-4 mb-4">
            <h4 className="font-medium text-gray-900 mb-2">{t('protocols.detailedInstructions')}</h4>
            <div className="text-sm text-gray-700 whitespace-pre-line">
              {template.instructions}
            </div>
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="flex-1 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            {showDetails ? t('protocols.hide') : t('protocols.viewDetails')}
          </button>
          <button
            onClick={onStart}
            className="flex-1 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium transition-colors"
          >
            {t('protocols.startProtocol')}
          </button>
        </div>
      </div>
    </div>
  );
}

function ProtocolDetailModal({
  protocol,
  onClose,
  onAddEntry,
  onDelete,
  onStatusChange: _onStatusChange,
}: {
  protocol: Protocol;
  onClose: () => void;
  onAddEntry: (entry: Omit<ProtocolEntry, 'id'>) => void;
  onDelete: () => void;
  onStatusChange: (status: Protocol['status']) => void;
}) {
  const { t, locale } = useI18n();
  const [activeTab, setActiveTab] = useState<'journal' | 'stats' | 'add'>('journal');
  const [newEntry, setNewEntry] = useState({
    date: new Date().toISOString().split('T')[0],
    peptide: protocol.peptides[0] || '',
    dosage: 0,
    unit: 'mcg' as 'mcg' | 'mg' | 'IU',
    frequency: 'daily',
    time: '08:00',
    notes: '',
    sideEffects: [] as string[],
    effectiveness: 3,
    bodyWeight: undefined as number | undefined,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAddEntry({
      ...newEntry,
      date: new Date(newEntry.date).toISOString(),
    });
    setActiveTab('journal');
    setNewEntry({
      ...newEntry,
      notes: '',
      sideEffects: [],
      effectiveness: 3,
    });
  };

  // Calculate stats
  const stats = useMemo(() => {
    if (protocol.entries.length === 0) return null;
    
    const avgEffectiveness = protocol.entries.reduce((sum, e) => sum + e.effectiveness, 0) / protocol.entries.length;
    const totalDoses = protocol.entries.length;
    const uniqueDays = new Set(protocol.entries.map(e => e.date.split('T')[0])).size;
    const sideEffectCounts = protocol.entries.flatMap(e => e.sideEffects).reduce((acc, se) => {
      acc[se] = (acc[se] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return { avgEffectiveness, totalDoses, uniqueDays, sideEffectCounts };
  }, [protocol.entries]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900">{protocol.name}</h2>
              <p className="text-sm text-gray-500 mt-1">{protocol.description}</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">✕</button>
          </div>
          <div className="flex flex-wrap gap-2 mt-4">
            {protocol.peptides.map(p => (
              <span key={p} className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-sm">
                {p}
              </span>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 flex-shrink-0">
          <button
            onClick={() => setActiveTab('journal')}
            className={`flex-1 py-3 text-sm font-medium ${
              activeTab === 'journal' ? 'text-orange-600 border-b-2 border-orange-500' : 'text-gray-500'
            }`}
          >
            {t('protocols.journal')} ({protocol.entries.length})
          </button>
          <button
            onClick={() => setActiveTab('stats')}
            className={`flex-1 py-3 text-sm font-medium ${
              activeTab === 'stats' ? 'text-orange-600 border-b-2 border-orange-500' : 'text-gray-500'
            }`}
          >
            {t('protocols.statistics')}
          </button>
          <button
            onClick={() => setActiveTab('add')}
            className={`flex-1 py-3 text-sm font-medium ${
              activeTab === 'add' ? 'text-orange-600 border-b-2 border-orange-500' : 'text-gray-500'
            }`}
          >
            {t('protocols.newEntry')}
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Journal Tab */}
          {activeTab === 'journal' && (
            <>
              {protocol.entries.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-500 mb-4">{t('protocols.noEntries')}</p>
                  <button
                    onClick={() => setActiveTab('add')}
                    className="text-orange-600 hover:text-orange-700 font-medium"
                  >
                    {t('protocols.addEntry')}
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {[...protocol.entries].reverse().map(entry => (
                    <div key={entry.id} className="bg-gray-50 rounded-lg p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-medium text-gray-900">{entry.peptide}</p>
                          <p className="text-sm text-gray-500">
                            {new Date(entry.date).toLocaleDateString(locale, { 
                              weekday: 'long', 
                              day: 'numeric', 
                              month: 'long' 
                            })} {t('protocols.at')} {entry.time}
                          </p>
                        </div>
                        <span className="px-3 py-1 bg-white border border-gray-200 rounded-full text-sm">
                          {entry.dosage} {entry.unit}
                        </span>
                      </div>
                      
                      {entry.notes && (
                        <p className="text-sm text-gray-600 mb-2">📝 {entry.notes}</p>
                      )}
                      
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1">
                          <span className="text-sm text-gray-500">{t('protocols.effectiveness')}:</span>
                          {[1, 2, 3, 4, 5].map(star => (
                            <span key={star} className={entry.effectiveness >= star ? 'text-yellow-400' : 'text-gray-300'}>
                              ★
                            </span>
                          ))}
                        </div>
                        {entry.sideEffects.length > 0 && (
                          <div className="flex items-center gap-1">
                            <span className="text-sm text-gray-500">{t('protocols.effects')}:</span>
                            {entry.sideEffects.map(se => (
                              <span key={se} className="px-2 py-0.5 bg-red-50 text-red-600 rounded text-xs">
                                {se}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Stats Tab */}
          {activeTab === 'stats' && (
            <>
              {!stats ? (
                <div className="text-center py-12">
                  <p className="text-gray-500">{t('protocols.notEnoughData')}</p>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-gray-50 rounded-lg p-4 text-center">
                      <p className="text-2xl font-bold text-gray-900">{stats.totalDoses}</p>
                      <p className="text-xs text-gray-500">{t('protocols.totalDoses')}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4 text-center">
                      <p className="text-2xl font-bold text-gray-900">{stats.uniqueDays}</p>
                      <p className="text-xs text-gray-500">{t('protocols.activeDays')}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4 text-center">
                      <p className="text-2xl font-bold text-yellow-600">{stats.avgEffectiveness.toFixed(1)}/5</p>
                      <p className="text-xs text-gray-500">{t('protocols.avgEffectiveness')}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4 text-center">
                      <p className="text-2xl font-bold text-gray-900">
                        {Object.keys(stats.sideEffectCounts).length}
                      </p>
                      <p className="text-xs text-gray-500">{t('protocols.notedEffects')}</p>
                    </div>
                  </div>

                  {Object.keys(stats.sideEffectCounts).length > 0 && (
                    <div>
                      <h4 className="font-medium text-gray-900 mb-3">{t('protocols.reportedSideEffects')}</h4>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(stats.sideEffectCounts).map(([effect, count]) => (
                          <span key={effect} className="px-3 py-1 bg-red-50 text-red-700 rounded-full text-sm">
                            {effect} ({count}x)
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* Add Entry Tab */}
          {activeTab === 'add' && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('protocols.date')}</label>
                  <input
                    type="date"
                    value={newEntry.date}
                    onChange={e => setNewEntry({ ...newEntry, date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('protocols.time')}</label>
                  <input
                    type="time"
                    value={newEntry.time}
                    onChange={e => setNewEntry({ ...newEntry, time: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('protocols.peptide')}</label>
                <select
                  value={newEntry.peptide}
                  onChange={e => setNewEntry({ ...newEntry, peptide: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                  required
                >
                  {protocol.peptides.map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                  <option value="other">{t('protocols.other')}</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('protocols.dosage')}</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newEntry.dosage || ''}
                    onChange={e => setNewEntry({ ...newEntry, dosage: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('protocols.unit')}</label>
                  <select
                    value={newEntry.unit}
                    onChange={e => setNewEntry({ ...newEntry, unit: e.target.value as 'mcg' | 'mg' | 'IU' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                  >
                    <option value="mcg">{t('protocols.unitMcg')}</option>
                    <option value="mg">{t('protocols.unitMg')}</option>
                    <option value="IU">{t('protocols.unitIU')}</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('protocols.perceivedEffectiveness')}: {newEntry.effectiveness}/5
                </label>
                <input
                  type="range"
                  min="1"
                  max="5"
                  value={newEntry.effectiveness}
                  onChange={e => setNewEntry({ ...newEntry, effectiveness: parseInt(e.target.value) })}
                  className="w-full accent-orange-500"
                />
                <div className="flex justify-between text-xs text-gray-500">
                  <span>{t('protocols.noEffect')}</span>
                  <span>{t('protocols.veryEffective')}</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('protocols.sideEffects')}</label>
                <div className="flex flex-wrap gap-2">
                  {[t('protocols.effectNausea'), t('protocols.effectFatigue'), t('protocols.effectHeadache'), t('protocols.effectRedness'), t('protocols.effectInjectionPain'), t('protocols.effectOther')].map(effect => (
                    <button
                      key={effect}
                      type="button"
                      onClick={() => {
                        const effects = newEntry.sideEffects.includes(effect)
                          ? newEntry.sideEffects.filter(e => e !== effect)
                          : [...newEntry.sideEffects, effect];
                        setNewEntry({ ...newEntry, sideEffects: effects });
                      }}
                      className={`px-3 py-1 rounded-full text-sm border transition-colors ${
                        newEntry.sideEffects.includes(effect)
                          ? 'bg-red-100 border-red-300 text-red-700'
                          : 'bg-gray-50 border-gray-300 text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      {effect}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('protocols.notes')}</label>
                <textarea
                  value={newEntry.notes}
                  onChange={e => setNewEntry({ ...newEntry, notes: e.target.value })}
                  placeholder={t('protocols.notesPlaceholder')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 resize-none"
                  rows={3}
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium transition-colors"
              >
                {t('protocols.saveEntry')}
              </button>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 flex gap-3 flex-shrink-0">
          <button
            onClick={onDelete}
            className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg text-sm font-medium transition-colors"
          >
            {t('protocols.delete')}
          </button>
          <div className="flex-1"></div>
          <button
            onClick={onClose}
            className="px-6 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            {t('protocols.close')}
          </button>
        </div>
      </div>
    </div>
  );
}

function NewProtocolModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (protocol: Protocol) => void;
}) {
  const { t } = useI18n();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [goal, setGoal] = useState('');
  const [peptides, setPeptides] = useState<string[]>([]);
  const [newPeptide, setNewPeptide] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const protocol: Protocol = {
      id: `protocol_${Date.now()}`,
      name,
      description,
      goal,
      peptides,
      startDate: new Date().toISOString(),
      status: 'active',
      entries: [],
      createdAt: new Date().toISOString(),
    };
    onCreate(protocol);
  };

  const addPeptide = () => {
    if (newPeptide && !peptides.includes(newPeptide)) {
      setPeptides([...peptides, newPeptide]);
      setNewPeptide('');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">{t('protocols.createNewProtocol')}</h2>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('protocols.protocolName')} *</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder={t('protocols.protocolNamePlaceholder')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('protocols.objective')}</label>
            <input
              type="text"
              value={goal}
              onChange={e => setGoal(e.target.value)}
              placeholder={t('protocols.objectivePlaceholder')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('protocols.description')}</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder={t('protocols.descriptionPlaceholder')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 resize-none"
              rows={3}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('protocols.peptidesUsedLabel')}</label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={newPeptide}
                onChange={e => setNewPeptide(e.target.value)}
                placeholder={t('protocols.peptideNamePlaceholder')}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                onKeyPress={e => e.key === 'Enter' && (e.preventDefault(), addPeptide())}
              />
              <button
                type="button"
                onClick={addPeptide}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                {t('protocols.add')}
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {peptides.map(p => (
                <span
                  key={p}
                  className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-sm flex items-center gap-2"
                >
                  {p}
                  <button
                    type="button"
                    onClick={() => setPeptides(peptides.filter(x => x !== p))}
                    className="text-orange-500 hover:text-orange-700"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              {t('protocols.cancel')}
            </button>
            <button
              type="submit"
              disabled={!name || peptides.length === 0}
              className="flex-1 py-2 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 text-white rounded-lg text-sm font-medium transition-colors"
            >
              {t('protocols.createProtocol')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
