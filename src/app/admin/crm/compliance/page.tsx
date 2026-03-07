'use client';

import { useState, useEffect, useCallback } from 'react';
import { useI18n } from '@/i18n/client';
import { toast } from 'sonner';
import {
  Shield,
  Phone,
  Clock,
  FileText,
  Upload,
  Plus,
  Ban,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Settings,
} from 'lucide-react';

interface ComplianceStats {
  internalDncCount: number;
  nationalDnclCount: number;
  consentRecords: number;
  activeConsents: number;
  revokedConsents: number;
  callingRules: number;
}

interface CallingRule {
  id: string;
  name: string;
  timezone: string;
  startHour: number;
  endHour: number;
  endMinute: number;
  weekendAllowed: boolean;
  maxAttemptsPerDay: number;
  maxAttemptsTotal: number;
  retryIntervalMin: number;
  isActive: boolean;
}

type Tab = 'overview' | 'dnc' | 'consent' | 'rules';

export default function CompliancePage() {
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>('overview');
  const [stats, setStats] = useState<ComplianceStats | null>(null);
  const [rules, setRules] = useState<CallingRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDnc, setShowAddDnc] = useState(false);
  const [dncPhone, setDncPhone] = useState('');
  const [dncReason, setDncReason] = useState('');
  const [showAddRule, setShowAddRule] = useState(false);
  const [newRule, setNewRule] = useState({
    name: '', timezone: 'America/Toronto', startHour: 9, endHour: 21, endMinute: 30,
    weekendAllowed: false, maxAttemptsPerDay: 3, maxAttemptsTotal: 10, retryIntervalMin: 60,
  });

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/crm/compliance?section=stats');
      const json = await res.json();
      if (json.success) setStats(json.data);
    } catch { /* ignore */ }
  }, []);

  const fetchRules = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/crm/compliance?section=calling-rules');
      const json = await res.json();
      if (json.success) setRules(json.data);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    Promise.all([fetchStats(), fetchRules()]).finally(() => setLoading(false));
  }, [fetchStats, fetchRules]);

  const handleAddDnc = async () => {
    if (!dncPhone.trim()) return;
    try {
      const res = await fetch('/api/admin/crm/compliance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add-dnc', phone: dncPhone, reason: dncReason }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success('Number added to DNC list');
        setDncPhone('');
        setDncReason('');
        setShowAddDnc(false);
        fetchStats();
      }
    } catch { toast.error('Failed to add'); }
  };

  const handleImportDncl = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv,.txt';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const text = await file.text();
      const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      // Skip header if present
      const phoneNumbers = lines.filter(l => /^\+?\d/.test(l));

      toast.info(`Importing ${phoneNumbers.length} numbers...`);
      try {
        const res = await fetch('/api/admin/crm/compliance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'import-dncl', phoneNumbers, source: file.name }),
        });
        const json = await res.json();
        if (json.success) {
          toast.success(`Imported: ${json.data.imported}, Skipped: ${json.data.skipped}`);
          fetchStats();
        }
      } catch { toast.error('Import failed'); }
    };
    input.click();
  };

  const handleCreateRule = async () => {
    if (!newRule.name.trim()) { toast.error('Name required'); return; }
    try {
      const res = await fetch('/api/admin/crm/compliance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create-calling-rule', ...newRule }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success('Calling rule created');
        setShowAddRule(false);
        fetchRules();
      }
    } catch { toast.error('Failed to create rule'); }
  };

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'overview', label: t('admin.crm.overview') || 'Overview', icon: <Shield className="h-4 w-4" /> },
    { key: 'dnc', label: 'DNC Lists', icon: <Ban className="h-4 w-4" /> },
    { key: 'consent', label: 'Consent', icon: <CheckCircle2 className="h-4 w-4" /> },
    { key: 'rules', label: 'Calling Rules', icon: <Clock className="h-4 w-4" /> },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Shield className="h-6 w-6 text-teal-600" />
            {t('admin.crm.compliance') || 'Compliance Center'}
          </h1>
          <p className="text-sm text-gray-500 mt-1">CRTC / TCPA / CASL compliance management</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b">
        {tabs.map(({ key, label, icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === key ? 'border-teal-600 text-teal-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {icon} {label}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {tab === 'overview' && stats && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <StatCard icon={<Ban className="h-5 w-5 text-red-500" />} label="Internal DNC" value={stats.internalDncCount} />
            <StatCard icon={<Phone className="h-5 w-5 text-orange-500" />} label="National DNCL" value={stats.nationalDnclCount} />
            <StatCard icon={<FileText className="h-5 w-5 text-teal-500" />} label="Consent Records" value={stats.consentRecords} />
            <StatCard icon={<CheckCircle2 className="h-5 w-5 text-green-500" />} label="Active Consents" value={stats.activeConsents} />
            <StatCard icon={<XCircle className="h-5 w-5 text-gray-500" />} label="Revoked" value={stats.revokedConsents} />
            <StatCard icon={<Settings className="h-5 w-5 text-purple-500" />} label="Calling Rules" value={stats.callingRules} />
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
              <div>
                <h3 className="font-medium text-yellow-800">CRTC/TCPA Compliance Reminders</h3>
                <ul className="mt-2 text-sm text-yellow-700 space-y-1">
                  <li>Calling hours: 9:00 AM - 9:30 PM local time (CRTC)</li>
                  <li>No calls on statutory holidays (CRTC)</li>
                  <li>Maintain internal DNC list updated within 31 days</li>
                  <li>Scrub against national DNCL before each campaign</li>
                  <li>TCPA: Manual touch required for cell phones (US)</li>
                  <li>Recording consent must be announced at call start</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DNC Tab */}
      {tab === 'dnc' && (
        <div className="space-y-4">
          <div className="flex gap-2">
            <button onClick={() => setShowAddDnc(!showAddDnc)} className="flex items-center gap-2 px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700">
              <Plus className="h-4 w-4" /> Add to DNC
            </button>
            <button onClick={handleImportDncl} className="flex items-center gap-2 px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">
              <Upload className="h-4 w-4" /> Import DNCL (CSV)
            </button>
          </div>

          {showAddDnc && (
            <div className="bg-white border rounded-lg p-4 flex gap-3 items-end">
              <div className="flex-1">
                <label className="block text-xs text-gray-500 mb-1">Phone Number</label>
                <input type="tel" value={dncPhone} onChange={e => setDncPhone(e.target.value)}
                  placeholder="+1 555 000 0000" className="w-full border rounded-md px-3 py-2 text-sm" />
              </div>
              <div className="flex-1">
                <label className="block text-xs text-gray-500 mb-1">Reason</label>
                <input type="text" value={dncReason} onChange={e => setDncReason(e.target.value)}
                  placeholder="Customer request" className="w-full border rounded-md px-3 py-2 text-sm" />
              </div>
              <button onClick={handleAddDnc} className="px-4 py-2 text-sm bg-red-600 text-white rounded-md hover:bg-red-700">Add</button>
            </div>
          )}

          <div className="bg-white border rounded-lg">
            <div className="p-4 border-b">
              <h3 className="font-medium">DNC Lists Summary</h3>
            </div>
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between py-2 border-b">
                <div className="flex items-center gap-3">
                  <Ban className="h-4 w-4 text-red-500" />
                  <span className="text-sm">Internal DNC (opt-outs, requests)</span>
                </div>
                <span className="font-bold text-red-600">{stats?.internalDncCount || 0}</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <div className="flex items-center gap-3">
                  <Phone className="h-4 w-4 text-orange-500" />
                  <span className="text-sm">National DNCL (CRTC)</span>
                </div>
                <span className="font-bold text-orange-600">{stats?.nationalDnclCount || 0}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Consent Tab */}
      {tab === 'consent' && (
        <div className="space-y-4">
          <div className="bg-white border rounded-lg p-6 text-center text-gray-500">
            <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>Consent records are automatically tracked when leads are created via web forms or import.</p>
            <p className="text-sm mt-1">Active: {stats?.activeConsents || 0} | Revoked: {stats?.revokedConsents || 0}</p>
          </div>
        </div>
      )}

      {/* Rules Tab */}
      {tab === 'rules' && (
        <div className="space-y-4">
          <button onClick={() => setShowAddRule(!showAddRule)} className="flex items-center gap-2 px-4 py-2 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700">
            <Plus className="h-4 w-4" /> New Calling Rule
          </button>

          {showAddRule && (
            <div className="bg-white border rounded-lg p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Rule Name</label>
                  <input type="text" value={newRule.name} onChange={e => setNewRule(r => ({ ...r, name: e.target.value }))}
                    className="w-full border rounded-md px-3 py-2 text-sm" placeholder="Default CRTC" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Timezone</label>
                  <select value={newRule.timezone} onChange={e => setNewRule(r => ({ ...r, timezone: e.target.value }))}
                    className="w-full border rounded-md px-3 py-2 text-sm">
                    <option value="America/Toronto">America/Toronto (ET)</option>
                    <option value="America/Vancouver">America/Vancouver (PT)</option>
                    <option value="America/Chicago">America/Chicago (CT)</option>
                    <option value="America/Denver">America/Denver (MT)</option>
                    <option value="America/Halifax">America/Halifax (AT)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Start Hour</label>
                  <input type="number" min={0} max={23} value={newRule.startHour}
                    onChange={e => setNewRule(r => ({ ...r, startHour: parseInt(e.target.value) }))}
                    className="w-full border rounded-md px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">End Hour</label>
                  <input type="number" min={0} max={23} value={newRule.endHour}
                    onChange={e => setNewRule(r => ({ ...r, endHour: parseInt(e.target.value) }))}
                    className="w-full border rounded-md px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Max Attempts/Day</label>
                  <input type="number" min={1} max={20} value={newRule.maxAttemptsPerDay}
                    onChange={e => setNewRule(r => ({ ...r, maxAttemptsPerDay: parseInt(e.target.value) }))}
                    className="w-full border rounded-md px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Max Attempts Total</label>
                  <input type="number" min={1} max={100} value={newRule.maxAttemptsTotal}
                    onChange={e => setNewRule(r => ({ ...r, maxAttemptsTotal: parseInt(e.target.value) }))}
                    className="w-full border rounded-md px-3 py-2 text-sm" />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={newRule.weekendAllowed}
                  onChange={e => setNewRule(r => ({ ...r, weekendAllowed: e.target.checked }))} className="rounded" />
                <label className="text-sm">Allow weekend calls</label>
              </div>
              <button onClick={handleCreateRule} className="px-4 py-2 text-sm bg-teal-600 text-white rounded-md hover:bg-teal-700">
                Create Rule
              </button>
            </div>
          )}

          <div className="space-y-3">
            {rules.map(rule => (
              <div key={rule.id} className="bg-white border rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium text-gray-900">{rule.name}</h3>
                    <p className="text-sm text-gray-500">
                      {rule.timezone} | {rule.startHour}:00 - {rule.endHour}:{String(rule.endMinute).padStart(2, '0')} | Max {rule.maxAttemptsPerDay}/day, {rule.maxAttemptsTotal} total
                    </p>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${rule.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {rule.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
            ))}
            {rules.length === 0 && (
              <div className="text-center text-gray-400 py-8">No calling rules configured. Create one to enforce compliance.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="bg-white border rounded-lg p-4">
      <div className="flex items-center gap-3">
        {icon}
        <div>
          <p className="text-2xl font-bold text-gray-900">{value.toLocaleString()}</p>
          <p className="text-xs text-gray-500">{label}</p>
        </div>
      </div>
    </div>
  );
}
