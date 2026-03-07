'use client';

import { useState, useEffect, useCallback } from 'react';
import { useI18n } from '@/i18n/client';
import { toast } from 'sonner';
import { GitMerge, Users, AlertTriangle, X, Loader2, Search } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type MatchType = 'email_exact' | 'phone_exact' | 'name_fuzzy' | 'name_company_fuzzy';

interface LeadInfo {
  id: string;
  contactName: string;
  email: string | null;
  phone: string | null;
  companyName: string | null;
}

interface DuplicatePair {
  leadA: LeadInfo;
  leadB: LeadInfo;
  matchType: MatchType;
  confidence: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MATCH_TYPE_CONFIG: Record<MatchType, { label: string; color: string }> = {
  email_exact: { label: 'Email Match', color: 'bg-green-100 text-green-700' },
  phone_exact: { label: 'Phone Match', color: 'bg-teal-100 text-teal-700' },
  name_fuzzy: { label: 'Name Fuzzy', color: 'bg-yellow-100 text-yellow-700' },
  name_company_fuzzy: { label: 'Name + Company', color: 'bg-orange-100 text-orange-700' },
};

// ---------------------------------------------------------------------------
// Merge Modal
// ---------------------------------------------------------------------------

interface MergeModalProps {
  pair: DuplicatePair;
  onClose: () => void;
  onMerged: () => void;
}

function MergeModal({ pair, onClose, onMerged }: MergeModalProps) {
  const { t } = useI18n();
  const [merging, setMerging] = useState(false);
  const [selectedSurvivor, setSelectedSurvivor] = useState<'A' | 'B' | null>(null);

  const handleMerge = async () => {
    if (!selectedSurvivor) {
      toast.error(t('admin.crm.duplicates.selectSurvivor') || 'Please select which lead to keep');
      return;
    }

    const survivorId = selectedSurvivor === 'A' ? pair.leadA.id : pair.leadB.id;
    const mergedId = selectedSurvivor === 'A' ? pair.leadB.id : pair.leadA.id;

    setMerging(true);
    try {
      const res = await fetch(`/api/admin/crm/duplicates/${survivorId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ survivorId, mergedId }),
      });
      const json = await res.json();

      if (!json.success) {
        throw new Error(json.error?.message || 'Merge failed');
      }

      toast.success(t('admin.crm.duplicates.mergeSuccess') || 'Leads merged successfully');
      onMerged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Merge failed');
    } finally {
      setMerging(false);
    }
  };

  const leadCardCls = (side: 'A' | 'B') =>
    `flex-1 p-4 rounded-xl border-2 cursor-pointer transition-all ${
      selectedSurvivor === side
        ? 'border-teal-500 bg-teal-50 ring-2 ring-teal-200'
        : 'border-gray-200 hover:border-gray-300 bg-white'
    }`;

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <GitMerge className="h-5 w-5 text-purple-600" />
            <h2 className="text-lg font-semibold text-gray-900">
              {t('admin.crm.duplicates.mergeTitle') || 'Merge Leads'}
            </h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          <p className="text-sm text-gray-500 mb-4">
            {t('admin.crm.duplicates.mergeDescription') ||
              'Select which lead to keep as the primary record. The other lead will be merged into it.'}
          </p>

          <div className="flex gap-4">
            {/* Lead A */}
            <div
              className={leadCardCls('A')}
              onClick={() => setSelectedSurvivor('A')}
            >
              <div className="flex items-center gap-2 mb-2">
                {selectedSurvivor === 'A' && (
                  <span className="text-xs font-bold text-teal-600 uppercase">
                    {t('admin.crm.duplicates.keeper') || 'Keep'}
                  </span>
                )}
              </div>
              <p className="font-semibold text-gray-900">{pair.leadA.contactName}</p>
              {pair.leadA.email && (
                <p className="text-sm text-gray-500 mt-1">{pair.leadA.email}</p>
              )}
              {pair.leadA.phone && (
                <p className="text-sm text-gray-500">{pair.leadA.phone}</p>
              )}
              {pair.leadA.companyName && (
                <p className="text-sm text-gray-400 mt-1">{pair.leadA.companyName}</p>
              )}
            </div>

            {/* VS separator */}
            <div className="flex items-center">
              <span className="text-sm font-bold text-gray-300">VS</span>
            </div>

            {/* Lead B */}
            <div
              className={leadCardCls('B')}
              onClick={() => setSelectedSurvivor('B')}
            >
              <div className="flex items-center gap-2 mb-2">
                {selectedSurvivor === 'B' && (
                  <span className="text-xs font-bold text-teal-600 uppercase">
                    {t('admin.crm.duplicates.keeper') || 'Keep'}
                  </span>
                )}
              </div>
              <p className="font-semibold text-gray-900">{pair.leadB.contactName}</p>
              {pair.leadB.email && (
                <p className="text-sm text-gray-500 mt-1">{pair.leadB.email}</p>
              )}
              {pair.leadB.phone && (
                <p className="text-sm text-gray-500">{pair.leadB.phone}</p>
              )}
              {pair.leadB.companyName && (
                <p className="text-sm text-gray-400 mt-1">{pair.leadB.companyName}</p>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t border-gray-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            {t('common.cancel') || 'Cancel'}
          </button>
          <button
            onClick={handleMerge}
            disabled={merging || !selectedSurvivor}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
          >
            <GitMerge className="h-4 w-4" />
            {merging
              ? (t('admin.crm.duplicates.merging') || 'Merging...')
              : (t('admin.crm.duplicates.merge') || 'Merge')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Duplicate Pair Card
// ---------------------------------------------------------------------------

interface DuplicateCardProps {
  pair: DuplicatePair;
  onMerge: (pair: DuplicatePair) => void;
}

function DuplicateCard({ pair, onMerge }: DuplicateCardProps) {
  const { t } = useI18n();
  const matchConf = MATCH_TYPE_CONFIG[pair.matchType] || {
    label: pair.matchType,
    color: 'bg-gray-100 text-gray-600',
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start gap-4">
        {/* Lead A */}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 truncate">{pair.leadA.contactName}</p>
          {pair.leadA.email && (
            <p className="text-sm text-gray-500 truncate">{pair.leadA.email}</p>
          )}
          {pair.leadA.phone && (
            <p className="text-sm text-gray-500">{pair.leadA.phone}</p>
          )}
          {pair.leadA.companyName && (
            <p className="text-xs text-gray-400 mt-1">{pair.leadA.companyName}</p>
          )}
        </div>

        {/* Middle: match info + merge button */}
        <div className="flex flex-col items-center gap-2 flex-shrink-0 pt-1">
          <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${matchConf.color}`}>
            {matchConf.label}
          </span>
          <span className="text-xs text-gray-500 font-medium">
            {pair.confidence}%
          </span>
          <button
            onClick={() => onMerge(pair)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors mt-1"
          >
            <GitMerge className="h-3.5 w-3.5" />
            {t('admin.crm.duplicates.merge') || 'Merge'}
          </button>
        </div>

        {/* Lead B */}
        <div className="flex-1 min-w-0 text-right">
          <p className="font-semibold text-gray-900 truncate">{pair.leadB.contactName}</p>
          {pair.leadB.email && (
            <p className="text-sm text-gray-500 truncate">{pair.leadB.email}</p>
          )}
          {pair.leadB.phone && (
            <p className="text-sm text-gray-500">{pair.leadB.phone}</p>
          )}
          {pair.leadB.companyName && (
            <p className="text-xs text-gray-400 mt-1">{pair.leadB.companyName}</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function DuplicatesPage() {
  const { t } = useI18n();
  const [duplicates, setDuplicates] = useState<DuplicatePair[]>([]);
  const [loading, setLoading] = useState(true);
  const [mergeTarget, setMergeTarget] = useState<DuplicatePair | null>(null);

  const fetchDuplicates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/crm/duplicates');
      const json = await res.json();

      if (json.success) {
        setDuplicates(json.data || []);
      }
    } catch {
      toast.error(t('admin.crm.duplicates.loadError') || 'Failed to load duplicates');
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchDuplicates();
  }, [fetchDuplicates]);

  const handleMerged = () => {
    setMergeTarget(null);
    fetchDuplicates();
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Users className="h-6 w-6 text-purple-600" />
            {t('admin.crm.duplicates.title') || 'Duplicate Detection'}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {t('admin.crm.duplicates.subtitle') ||
              'Find and merge duplicate leads to keep your CRM clean'}
          </p>
        </div>
        <button
          onClick={fetchDuplicates}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
        >
          <Search className="h-4 w-4" />
          {t('admin.crm.duplicates.rescan') || 'Rescan'}
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 text-purple-500 animate-spin" />
        </div>
      ) : duplicates.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <AlertTriangle className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">
            {t('admin.crm.duplicates.empty') || 'No duplicates found'}
          </p>
          <p className="text-sm text-gray-400 mt-1">
            {t('admin.crm.duplicates.emptyDesc') ||
              'Your lead database looks clean. No potential duplicates were detected.'}
          </p>
        </div>
      ) : (
        <>
          {/* Summary bar */}
          <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 mb-6 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-purple-600 flex-shrink-0" />
            <p className="text-sm text-purple-700">
              {t('admin.crm.duplicates.found') || 'Found'}{' '}
              <span className="font-bold">{duplicates.length}</span>{' '}
              {t('admin.crm.duplicates.potentialDuplicates') || 'potential duplicate pairs'}
            </p>
          </div>

          {/* Duplicate cards */}
          <div className="space-y-3">
            {duplicates.map((pair, idx) => (
              <DuplicateCard
                key={`${pair.leadA.id}-${pair.leadB.id}-${idx}`}
                pair={pair}
                onMerge={setMergeTarget}
              />
            ))}
          </div>
        </>
      )}

      {/* Merge modal */}
      {mergeTarget && (
        <MergeModal
          pair={mergeTarget}
          onClose={() => setMergeTarget(null)}
          onMerged={handleMerged}
        />
      )}
    </div>
  );
}
