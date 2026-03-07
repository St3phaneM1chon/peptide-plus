'use client';

import { useState, useEffect, useCallback } from 'react';
import { useI18n } from '@/i18n/client';
import { toast } from 'sonner';
import {
  Camera, Clock, GitCompare, Plus,
  Loader2, RefreshCw, ChevronDown, ChevronUp,
  CheckCircle2, ArrowUpRight, ArrowDownRight, Minus,
  Settings,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SnapshotMeta {
  id: string;
  name: string;
  description: string | null;
  entities: string[];
  takenAt: string;
  takenBy: string | null;
  isAutomatic: boolean;
}

interface SnapshotDiffChange {
  entity: string;
  field: string;
  oldValue: number;
  newValue: number;
  change: number;
  changePercent: number;
}

interface SnapshotDiff {
  snapshotId1: string;
  snapshotId2: string;
  snapshot1Date: string;
  snapshot2Date: string;
  changes: SnapshotDiffChange[];
  summary: {
    improved: number;
    declined: number;
    unchanged: number;
  };
}

type SnapshotFrequency = 'daily' | 'weekly' | 'monthly';

const ENTITY_OPTIONS = [
  { value: 'pipeline', label: 'Pipeline' },
  { value: 'leads', label: 'Leads' },
  { value: 'deals', label: 'Deals' },
  { value: 'revenue', label: 'Revenue' },
  { value: 'activities', label: 'Activities' },
  { value: 'customers', label: 'Customers' },
];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SnapshotsPage() {
  const { t } = useI18n();
  const [snapshots, setSnapshots] = useState<SnapshotMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [taking, setTaking] = useState(false);

  // Compare mode
  const [compareMode, setCompareMode] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [diff, setDiff] = useState<SnapshotDiff | null>(null);
  const [comparing, setComparing] = useState(false);

  // New snapshot dialog
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [snapshotName, setSnapshotName] = useState('');
  const [selectedEntities, setSelectedEntities] = useState<string[]>(['pipeline', 'leads', 'deals', 'revenue']);

  // Auto-schedule dialog
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [scheduleFrequency, setScheduleFrequency] = useState<SnapshotFrequency>('daily');
  const [scheduleEntities, setScheduleEntities] = useState<string[]>(['pipeline', 'deals', 'revenue']);

  const fetchSnapshots = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/crm/deals/stats?metric=snapshots_list');
      const json = await res.json();

      if (json.success && json.data?.snapshots) {
        setSnapshots(json.data.snapshots);
      } else {
        setSnapshots([]);
      }
    } catch {
      toast.error('Failed to load snapshots');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSnapshots();
  }, [fetchSnapshots]);

  const handleTakeSnapshot = useCallback(async () => {
    if (!snapshotName.trim()) {
      toast.error('Please enter a snapshot name');
      return;
    }
    if (selectedEntities.length === 0) {
      toast.error('Please select at least one entity');
      return;
    }

    setTaking(true);
    try {
      const res = await fetch('/api/admin/crm/deals/stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'take_snapshot',
          name: snapshotName,
          entities: selectedEntities,
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success('Snapshot taken successfully');
        setShowNewDialog(false);
        setSnapshotName('');
        fetchSnapshots();
      } else {
        toast.error(json.error || 'Failed to take snapshot');
      }
    } catch {
      toast.error('Failed to take snapshot');
    } finally {
      setTaking(false);
    }
  }, [snapshotName, selectedEntities, fetchSnapshots]);

  const handleCompare = useCallback(async () => {
    if (selected.length !== 2) {
      toast.error('Select exactly 2 snapshots to compare');
      return;
    }

    setComparing(true);
    try {
      const res = await fetch(
        `/api/admin/crm/deals/stats?metric=snapshot_compare&id1=${selected[0]}&id2=${selected[1]}`,
      );
      const json = await res.json();

      if (json.success && json.data) {
        setDiff(json.data);
      } else {
        toast.error('Failed to compare snapshots');
      }
    } catch {
      toast.error('Failed to compare snapshots');
    } finally {
      setComparing(false);
    }
  }, [selected]);

  const handleSchedule = useCallback(async () => {
    if (scheduleEntities.length === 0) {
      toast.error('Please select at least one entity');
      return;
    }

    try {
      const res = await fetch('/api/admin/crm/deals/stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'schedule_snapshot',
          frequency: scheduleFrequency,
          entities: scheduleEntities,
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(`Auto-snapshot scheduled: ${scheduleFrequency}`);
        setShowScheduleDialog(false);
      } else {
        toast.error(json.error || 'Failed to schedule snapshot');
      }
    } catch {
      toast.error('Failed to schedule snapshot');
    }
  }, [scheduleFrequency, scheduleEntities]);

  const toggleEntitySelection = (
    entity: string,
    list: string[],
    setter: (v: string[]) => void,
  ) => {
    setter(
      list.includes(entity) ? list.filter((e) => e !== entity) : [...list, entity],
    );
  };

  const toggleSnapshotSelection = (id: string) => {
    if (selected.includes(id)) {
      setSelected(selected.filter((s) => s !== id));
    } else if (selected.length < 2) {
      setSelected([...selected, id]);
    } else {
      // Replace oldest selection
      setSelected([selected[1], id]);
    }
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('en-CA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {t('admin.crm.snapshots') || 'Historical Snapshots'}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Capture and compare point-in-time views of your pipeline and metrics
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowScheduleDialog(true)}
            className="flex items-center gap-2 px-3 py-2 text-sm border rounded-lg hover:bg-gray-50"
          >
            <Settings className="h-4 w-4" />
            Auto-Schedule
          </button>
          <button
            onClick={() => setShowNewDialog(true)}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700"
          >
            <Plus className="h-4 w-4" />
            Take Snapshot
          </button>
          <button
            onClick={fetchSnapshots}
            className="p-2 rounded-lg hover:bg-gray-100"
            title="Refresh"
          >
            <RefreshCw className="h-4 w-4 text-gray-500" />
          </button>
        </div>
      </div>

      {/* Compare Mode Toggle */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => {
            setCompareMode(!compareMode);
            setSelected([]);
            setDiff(null);
          }}
          className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg border transition-colors ${
            compareMode
              ? 'bg-purple-50 border-purple-300 text-purple-700'
              : 'hover:bg-gray-50'
          }`}
        >
          <GitCompare className="h-4 w-4" />
          Compare Mode
        </button>
        {compareMode && selected.length === 2 && (
          <button
            onClick={handleCompare}
            disabled={comparing}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
          >
            {comparing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <GitCompare className="h-4 w-4" />
            )}
            Compare ({selected.length}/2)
          </button>
        )}
        {compareMode && selected.length < 2 && (
          <span className="text-sm text-gray-500">
            Select {2 - selected.length} more snapshot{selected.length === 1 ? '' : 's'}
          </span>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-teal-500" />
        </div>
      ) : (
        <>
          {/* Snapshot List */}
          <div className="bg-white rounded-xl border overflow-hidden mb-8">
            <div className="px-6 py-4 border-b">
              <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <Camera className="h-4 w-4" /> Snapshots ({snapshots.length})
              </h3>
            </div>
            <div className="divide-y">
              {snapshots.map((snap) => (
                <div
                  key={snap.id}
                  className={`px-6 py-4 flex items-center gap-4 transition-colors ${
                    compareMode ? 'cursor-pointer hover:bg-gray-50' : ''
                  } ${selected.includes(snap.id) ? 'bg-purple-50' : ''}`}
                  onClick={compareMode ? () => toggleSnapshotSelection(snap.id) : undefined}
                >
                  {compareMode && (
                    <div
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                        selected.includes(snap.id)
                          ? 'border-purple-600 bg-purple-600'
                          : 'border-gray-300'
                      }`}
                    >
                      {selected.includes(snap.id) && (
                        <CheckCircle2 className="h-3 w-3 text-white" />
                      )}
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-900 truncate">{snap.name}</p>
                      {snap.isAutomatic && (
                        <span className="px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-500">
                          Auto
                        </span>
                      )}
                    </div>
                    {snap.description && (
                      <p className="text-xs text-gray-400 mt-0.5 truncate">{snap.description}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-wrap justify-end">
                    {snap.entities.map((entity) => (
                      <span
                        key={entity}
                        className="px-2 py-0.5 rounded-full text-xs bg-teal-50 text-teal-600"
                      >
                        {entity}
                      </span>
                    ))}
                  </div>

                  <div className="text-right min-w-[160px]">
                    <p className="text-sm text-gray-700 flex items-center gap-1 justify-end">
                      <Clock className="h-3 w-3" />
                      {formatDate(snap.takenAt)}
                    </p>
                    {snap.takenBy && (
                      <p className="text-xs text-gray-400 mt-0.5">by {snap.takenBy}</p>
                    )}
                  </div>
                </div>
              ))}
              {snapshots.length === 0 && (
                <div className="px-6 py-12 text-center text-gray-400">
                  No snapshots yet. Take your first snapshot to start tracking changes.
                </div>
              )}
            </div>
          </div>

          {/* Comparison Results */}
          {diff && (
            <div className="bg-white rounded-xl border overflow-hidden mb-8">
              <div className="px-6 py-4 border-b">
                <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <GitCompare className="h-4 w-4" /> Comparison Results
                </h3>
                <p className="text-xs text-gray-400 mt-1">
                  {formatDate(diff.snapshot1Date)} vs {formatDate(diff.snapshot2Date)}
                </p>
              </div>

              {/* Summary */}
              <div className="grid grid-cols-3 gap-4 p-6 border-b">
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 text-green-600 mb-1">
                    <ArrowUpRight className="h-4 w-4" />
                    <span className="text-2xl font-bold">{diff.summary.improved}</span>
                  </div>
                  <span className="text-xs text-gray-500">Improved</span>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 text-red-600 mb-1">
                    <ArrowDownRight className="h-4 w-4" />
                    <span className="text-2xl font-bold">{diff.summary.declined}</span>
                  </div>
                  <span className="text-xs text-gray-500">Declined</span>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 text-gray-500 mb-1">
                    <Minus className="h-4 w-4" />
                    <span className="text-2xl font-bold">{diff.summary.unchanged}</span>
                  </div>
                  <span className="text-xs text-gray-500">Unchanged</span>
                </div>
              </div>

              {/* Changes Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-6 py-3 text-gray-500 font-medium">Entity</th>
                      <th className="text-left px-6 py-3 text-gray-500 font-medium">Metric</th>
                      <th className="text-right px-6 py-3 text-gray-500 font-medium">Before</th>
                      <th className="text-right px-6 py-3 text-gray-500 font-medium">After</th>
                      <th className="text-right px-6 py-3 text-gray-500 font-medium">Change</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {diff.changes.map((change, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-6 py-3">
                          <span className="px-2 py-0.5 rounded-full text-xs bg-teal-50 text-teal-600">
                            {change.entity}
                          </span>
                        </td>
                        <td className="px-6 py-3 text-gray-700">{change.field}</td>
                        <td className="text-right px-6 py-3 text-gray-500">
                          {typeof change.oldValue === 'number'
                            ? change.oldValue.toLocaleString()
                            : change.oldValue}
                        </td>
                        <td className="text-right px-6 py-3 font-medium text-gray-900">
                          {typeof change.newValue === 'number'
                            ? change.newValue.toLocaleString()
                            : change.newValue}
                        </td>
                        <td className="text-right px-6 py-3">
                          <span
                            className={`inline-flex items-center gap-1 text-xs font-medium ${
                              change.change > 0
                                ? 'text-green-600'
                                : change.change < 0
                                  ? 'text-red-600'
                                  : 'text-gray-400'
                            }`}
                          >
                            {change.change > 0 ? (
                              <ChevronUp className="h-3 w-3" />
                            ) : change.change < 0 ? (
                              <ChevronDown className="h-3 w-3" />
                            ) : null}
                            {change.change > 0 ? '+' : ''}
                            {change.changePercent}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* New Snapshot Dialog */}
      {showNewDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Take Snapshot</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Snapshot Name
                </label>
                <input
                  type="text"
                  value={snapshotName}
                  onChange={(e) => setSnapshotName(e.target.value)}
                  placeholder="e.g., End of Q1 2026"
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Entities to Capture
                </label>
                <div className="flex flex-wrap gap-2">
                  {ENTITY_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() =>
                        toggleEntitySelection(opt.value, selectedEntities, setSelectedEntities)
                      }
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                        selectedEntities.includes(opt.value)
                          ? 'bg-teal-600 text-white border-teal-600'
                          : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowNewDialog(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleTakeSnapshot}
                disabled={taking}
                className="px-4 py-2 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 flex items-center gap-2"
              >
                {taking && <Loader2 className="h-4 w-4 animate-spin" />}
                <Camera className="h-4 w-4" />
                Take Snapshot
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Auto-Schedule Dialog */}
      {showScheduleDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Auto-Schedule Snapshots</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Frequency
                </label>
                <select
                  value={scheduleFrequency}
                  onChange={(e) => setScheduleFrequency(e.target.value as SnapshotFrequency)}
                  className="w-full border rounded-lg px-3 py-2 text-sm bg-white"
                >
                  <option value="daily">Daily (midnight)</option>
                  <option value="weekly">Weekly (Monday)</option>
                  <option value="monthly">Monthly (1st)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Entities to Capture
                </label>
                <div className="flex flex-wrap gap-2">
                  {ENTITY_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() =>
                        toggleEntitySelection(opt.value, scheduleEntities, setScheduleEntities)
                      }
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                        scheduleEntities.includes(opt.value)
                          ? 'bg-purple-600 text-white border-purple-600'
                          : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowScheduleDialog(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleSchedule}
                className="px-4 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2"
              >
                <Settings className="h-4 w-4" />
                Save Schedule
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
