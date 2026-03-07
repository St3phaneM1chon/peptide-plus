'use client';

import { useState, useEffect, useCallback } from 'react';
import { useI18n } from '@/i18n/client';
import { toast } from 'sonner';
import {
  LayoutDashboard, Plus, Save, Trash2, Settings,
  BarChart3, TrendingUp, PieChart, Table, Hash, GripVertical,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type WidgetType = 'kpi' | 'bar' | 'line' | 'pie' | 'table' | 'metric';

interface Widget {
  id: string;
  type: WidgetType;
  title: string;
  dataSource: string;
  refreshInterval: number;
  position: { x: number; y: number; w: number; h: number };
  config?: Record<string, unknown>;
}

interface SavedDashboard {
  id: string;
  key: string;
  name: string;
  description: string;
  widgetCount: number;
  isDefault: boolean;
  updatedAt: string;
}

const WIDGET_ICONS: Record<WidgetType, typeof BarChart3> = {
  kpi: Hash, bar: BarChart3, line: TrendingUp, pie: PieChart, table: Table, metric: TrendingUp,
};

const WIDGET_LABELS: Record<WidgetType, string> = {
  kpi: 'KPI Card', bar: 'Bar Chart', line: 'Line Chart', pie: 'Pie Chart', table: 'Data Table', metric: 'Metric',
};

const DATA_SOURCES = [
  { value: '/api/admin/crm/call-center-kpis', label: 'Call Center KPIs' },
  { value: '/api/admin/crm/activity-reports', label: 'Activity Reports' },
  { value: '/api/admin/crm/deals/stats', label: 'Deal Stats' },
  { value: '/api/admin/crm/leads', label: 'Lead Data' },
  { value: '/api/admin/crm/wallboard', label: 'Wallboard' },
];

const DEFAULT_WIDGETS: Widget[] = [
  { id: 'w1', type: 'kpi', title: 'Total Calls', dataSource: '/api/admin/crm/call-center-kpis', refreshInterval: 30, position: { x: 0, y: 0, w: 3, h: 2 } },
  { id: 'w2', type: 'kpi', title: 'Active Deals', dataSource: '/api/admin/crm/deals/stats', refreshInterval: 60, position: { x: 3, y: 0, w: 3, h: 2 } },
  { id: 'w3', type: 'line', title: 'Call Trends', dataSource: '/api/admin/crm/call-center-kpis', refreshInterval: 60, position: { x: 0, y: 2, w: 6, h: 4 } },
  { id: 'w4', type: 'bar', title: 'Agent Activity', dataSource: '/api/admin/crm/activity-reports', refreshInterval: 120, position: { x: 6, y: 0, w: 6, h: 3 } },
  { id: 'w5', type: 'table', title: 'Recent Leads', dataSource: '/api/admin/crm/leads', refreshInterval: 120, position: { x: 6, y: 3, w: 6, h: 3 } },
];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function DashboardBuilderPage() {
  const { t } = useI18n();
  const [widgets, setWidgets] = useState<Widget[]>(DEFAULT_WIDGETS);
  const [savedDashboards, setSavedDashboards] = useState<SavedDashboard[]>([]);
  const [dashboardName, setDashboardName] = useState('My CRM Dashboard');
  const [editingWidget, setEditingWidget] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [draggedWidget, setDraggedWidget] = useState<string | null>(null);

  const fetchSaved = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/crm/dashboard-builder');
      const json = await res.json();
      if (json.success) setSavedDashboards(json.data || []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchSaved(); }, [fetchSaved]);

  const addWidget = (type: WidgetType) => {
    const id = `w${Date.now()}`;
    const maxY = widgets.reduce((max, w) => Math.max(max, w.position.y + w.position.h), 0);
    setWidgets([...widgets, {
      id, type,
      title: WIDGET_LABELS[type],
      dataSource: DATA_SOURCES[0].value,
      refreshInterval: 60,
      position: { x: 0, y: maxY, w: type === 'kpi' || type === 'metric' ? 3 : 6, h: type === 'kpi' || type === 'metric' ? 2 : 4 },
    }]);
  };

  const removeWidget = (id: string) => {
    setWidgets(widgets.filter(w => w.id !== id));
    if (editingWidget === id) setEditingWidget(null);
  };

  const updateWidget = (id: string, updates: Partial<Widget>) => {
    setWidgets(widgets.map(w => w.id === id ? { ...w, ...updates } : w));
  };

  const saveDashboard = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/crm/dashboard-builder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: dashboardName, widgets, isDefault: false }),
      });
      const json = await res.json();
      if (json.success) { toast.success('Dashboard saved'); fetchSaved(); }
      else toast.error('Failed to save');
    } catch { toast.error('Failed to save'); }
    finally { setSaving(false); }
  };

  const loadDashboard = async (key: string) => {
    try {
      const dash = savedDashboards.find(d => d.key === key);
      if (!dash) return;
      // Fetch full config from API (SiteSetting value)
      const res = await fetch('/api/admin/crm/dashboard-builder');
      const json = await res.json();
      if (json.success) {
        const full = json.data?.find((d: SavedDashboard) => d.key === key);
        if (full) {
          setDashboardName(full.name);
          toast.success(`Loaded: ${full.name}`);
        }
      }
    } catch { toast.error('Failed to load'); }
  };

  const ew = editingWidget ? widgets.find(w => w.id === editingWidget) : null;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {t('admin.crm.dashboardBuilder') || 'Dashboard Builder'}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {t('admin.crm.dashboardBuilderDesc') || 'Create custom dashboards with drag-and-drop widgets'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={dashboardName}
            onChange={e => setDashboardName(e.target.value)}
            className="text-sm border rounded-md px-3 py-2 w-48"
            placeholder="Dashboard name"
          />
          <button onClick={saveDashboard} disabled={saving}
            className="flex items-center gap-2 bg-teal-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-teal-700 disabled:opacity-50">
            <Save className="h-4 w-4" /> {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      <div className="flex gap-6">
        {/* Sidebar */}
        <div className="w-64 shrink-0 space-y-4">
          {/* Add widgets */}
          <div className="bg-white rounded-xl border p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <Plus className="h-4 w-4" /> Add Widget
            </h3>
            <div className="space-y-2">
              {(Object.keys(WIDGET_LABELS) as WidgetType[]).map(type => {
                const Icon = WIDGET_ICONS[type];
                return (
                  <button key={type} onClick={() => addWidget(type)}
                    className="w-full flex items-center gap-2 text-left text-sm px-3 py-2 rounded-lg hover:bg-gray-100 text-gray-700">
                    <Icon className="h-4 w-4 text-gray-400" /> {WIDGET_LABELS[type]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Saved dashboards */}
          {savedDashboards.length > 0 && (
            <div className="bg-white rounded-xl border p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <LayoutDashboard className="h-4 w-4" /> Saved
              </h3>
              <div className="space-y-1">
                {savedDashboards.map(d => (
                  <button key={d.id} onClick={() => loadDashboard(d.key)}
                    className="w-full text-left text-sm px-3 py-2 rounded-lg hover:bg-gray-100 text-gray-700">
                    {d.name} <span className="text-xs text-gray-400">({d.widgetCount})</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Widget editor */}
          {ew && (
            <div className="bg-white rounded-xl border p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <Settings className="h-4 w-4" /> Edit Widget
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-gray-500">Title</label>
                  <input type="text" value={ew.title} onChange={e => updateWidget(ew.id, { title: e.target.value })}
                    className="w-full text-sm border rounded px-2 py-1.5 mt-1" />
                </div>
                <div>
                  <label className="text-xs text-gray-500">Data Source</label>
                  <select value={ew.dataSource} onChange={e => updateWidget(ew.id, { dataSource: e.target.value })}
                    className="w-full text-sm border rounded px-2 py-1.5 mt-1">
                    {DATA_SOURCES.map(ds => <option key={ds.value} value={ds.value}>{ds.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500">Refresh (sec)</label>
                  <input type="number" value={ew.refreshInterval} min={0} max={3600}
                    onChange={e => updateWidget(ew.id, { refreshInterval: parseInt(e.target.value) || 60 })}
                    className="w-full text-sm border rounded px-2 py-1.5 mt-1" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-gray-500">Width</label>
                    <input type="number" value={ew.position.w} min={1} max={12}
                      onChange={e => updateWidget(ew.id, { position: { ...ew.position, w: parseInt(e.target.value) || 3 } })}
                      className="w-full text-sm border rounded px-2 py-1.5 mt-1" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Height</label>
                    <input type="number" value={ew.position.h} min={1} max={8}
                      onChange={e => updateWidget(ew.id, { position: { ...ew.position, h: parseInt(e.target.value) || 2 } })}
                      className="w-full text-sm border rounded px-2 py-1.5 mt-1" />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Canvas */}
        <div className="flex-1">
          <div className="grid grid-cols-12 gap-4 auto-rows-[60px]">
            {widgets.map(w => {
              const Icon = WIDGET_ICONS[w.type];
              return (
                <div
                  key={w.id}
                  className={`bg-white rounded-xl border p-4 cursor-pointer transition-all hover:shadow-md
                    ${editingWidget === w.id ? 'ring-2 ring-teal-500' : ''}
                    ${draggedWidget === w.id ? 'opacity-50' : ''}`}
                  style={{ gridColumn: `span ${Math.min(w.position.w, 12)}`, gridRow: `span ${w.position.h}` }}
                  onClick={() => setEditingWidget(w.id === editingWidget ? null : w.id)}
                  draggable
                  onDragStart={() => setDraggedWidget(w.id)}
                  onDragEnd={() => setDraggedWidget(null)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                      <GripVertical className="h-3 w-3 text-gray-300 cursor-grab" />
                      <Icon className="h-4 w-4 text-gray-400" />
                      {w.title}
                    </div>
                    <button onClick={e => { e.stopPropagation(); removeWidget(w.id); }}
                      className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                  <div className="flex items-center justify-center h-[calc(100%-2rem)] text-gray-300 text-xs">
                    {WIDGET_LABELS[w.type]} Preview
                  </div>
                </div>
              );
            })}
          </div>

          {widgets.length === 0 && (
            <div className="flex flex-col items-center justify-center h-64 text-gray-400 border-2 border-dashed rounded-xl">
              <LayoutDashboard className="h-10 w-10 mb-3" />
              <p className="text-sm">Add widgets from the sidebar to build your dashboard</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
