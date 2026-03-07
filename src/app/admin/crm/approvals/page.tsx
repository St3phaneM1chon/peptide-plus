'use client';

import { useState, useEffect, useCallback } from 'react';
import { useI18n } from '@/i18n/client';
import { toast } from 'sonner';
import { CheckCircle, XCircle, Clock, Shield, Loader2, FileText } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ApprovalUser {
  id: string;
  name: string | null;
  email: string | null;
}

interface Approval {
  id: string;
  entityType: string;
  entityId: string;
  reason: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  requestedBy: ApprovalUser;
  approver: ApprovalUser | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  rejectionNote: string | null;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Status Badge
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: Approval['status'] }) {
  const config = {
    PENDING: { label: 'Pending', color: 'bg-yellow-100 text-yellow-700', icon: Clock },
    APPROVED: { label: 'Approved', color: 'bg-green-100 text-green-700', icon: CheckCircle },
    REJECTED: { label: 'Rejected', color: 'bg-red-100 text-red-700', icon: XCircle },
  };

  const { label, color, icon: Icon } = config[status];

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${color}`}>
      <Icon className="h-3.5 w-3.5" />
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Entity Type Badge
// ---------------------------------------------------------------------------

function EntityTypeBadge({ entityType }: { entityType: string }) {
  const colorMap: Record<string, string> = {
    deal: 'bg-teal-100 text-teal-700',
    quote: 'bg-purple-100 text-purple-700',
    discount: 'bg-orange-100 text-orange-700',
  };

  const color = colorMap[entityType.toLowerCase()] || 'bg-gray-100 text-gray-700';

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize ${color}`}>
      {entityType}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Action Modal
// ---------------------------------------------------------------------------

interface ActionModalProps {
  approval: Approval;
  action: 'approve' | 'reject';
  onClose: () => void;
  onComplete: () => void;
}

function ActionModal({ approval, action, onClose, onComplete }: ActionModalProps) {
  const { t } = useI18n();
  const [note, setNote] = useState('');
  const [processing, setProcessing] = useState(false);

  const handleSubmit = async () => {
    setProcessing(true);
    try {
      const res = await fetch(`/api/admin/crm/approvals/${approval.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, note: note || undefined }),
      });
      const json = await res.json();

      if (!json.success) {
        throw new Error(json.error?.message || `Failed to ${action}`);
      }

      toast.success(
        action === 'approve'
          ? (t('admin.crm.approvals.approvedSuccess') || 'Approval granted')
          : (t('admin.crm.approvals.rejectedSuccess') || 'Approval rejected')
      );
      onComplete();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `Failed to ${action}`);
    } finally {
      setProcessing(false);
    }
  };

  const isApprove = action === 'approve';

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div className="flex items-center gap-2">
            {isApprove ? (
              <CheckCircle className="h-5 w-5 text-green-600" />
            ) : (
              <XCircle className="h-5 w-5 text-red-600" />
            )}
            <h2 className="text-lg font-semibold text-gray-900">
              {isApprove
                ? (t('admin.crm.approvals.confirmApprove') || 'Confirm Approval')
                : (t('admin.crm.approvals.confirmReject') || 'Confirm Rejection')}
            </h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <XCircle className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          <div className="mb-4">
            <p className="text-sm text-gray-600">
              {isApprove
                ? (t('admin.crm.approvals.approveMessage') || 'Are you sure you want to approve this request?')
                : (t('admin.crm.approvals.rejectMessage') || 'Are you sure you want to reject this request?')}
            </p>
            <div className="mt-3 p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <EntityTypeBadge entityType={approval.entityType} />
                <span className="text-xs text-gray-500 font-mono">{approval.entityId.slice(0, 12)}...</span>
              </div>
              {approval.reason && (
                <p className="text-sm text-gray-700 mt-1">{approval.reason}</p>
              )}
              <p className="text-xs text-gray-400 mt-1">
                {t('admin.crm.approvals.requestedBy') || 'Requested by'}: {approval.requestedBy.name || approval.requestedBy.email}
              </p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              {t('admin.crm.approvals.note') || 'Note'} ({t('common.optional') || 'optional'})
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              maxLength={2000}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
              placeholder={
                isApprove
                  ? (t('admin.crm.approvals.approveNotePlaceholder') || 'Add an optional note...')
                  : (t('admin.crm.approvals.rejectNotePlaceholder') || 'Reason for rejection...')
              }
            />
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
            onClick={handleSubmit}
            disabled={processing}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50 ${
              isApprove
                ? 'bg-green-600 hover:bg-green-700'
                : 'bg-red-600 hover:bg-red-700'
            }`}
          >
            {isApprove ? (
              <CheckCircle className="h-4 w-4" />
            ) : (
              <XCircle className="h-4 w-4" />
            )}
            {processing
              ? (t('common.processing') || 'Processing...')
              : isApprove
                ? (t('admin.crm.approvals.approve') || 'Approve')
                : (t('admin.crm.approvals.reject') || 'Reject')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Approval Card
// ---------------------------------------------------------------------------

function ApprovalCard({
  approval,
  onAction,
}: {
  approval: Approval;
  onAction: (approval: Approval, action: 'approve' | 'reject') => void;
}) {
  const { t } = useI18n();
  const isPending = approval.status === 'PENDING';

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          {/* Entity info */}
          <div className="flex items-center gap-2 mb-2">
            <EntityTypeBadge entityType={approval.entityType} />
            <StatusBadge status={approval.status} />
          </div>

          {/* Reason */}
          {approval.reason && (
            <p className="text-sm text-gray-700 mb-2 line-clamp-2">{approval.reason}</p>
          )}

          {/* Metadata */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
            <span>
              {t('admin.crm.approvals.requestedBy') || 'Requested by'}:{' '}
              <span className="font-medium text-gray-700">
                {approval.requestedBy.name || approval.requestedBy.email || 'Unknown'}
              </span>
            </span>
            <span>
              {new Date(approval.createdAt).toLocaleDateString(undefined, {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
            {approval.approver && (
              <span>
                {approval.status === 'APPROVED'
                  ? (t('admin.crm.approvals.approvedBy') || 'Approved by')
                  : (t('admin.crm.approvals.rejectedBy') || 'Rejected by')}:{' '}
                <span className="font-medium text-gray-700">
                  {approval.approver.name || approval.approver.email || 'Unknown'}
                </span>
              </span>
            )}
          </div>

          {/* Rejection note */}
          {approval.rejectionNote && (
            <div className="mt-2 p-2 bg-red-50 rounded-lg border border-red-100">
              <p className="text-xs text-red-700">
                <span className="font-medium">{t('admin.crm.approvals.rejectionReason') || 'Rejection reason'}:</span>{' '}
                {approval.rejectionNote}
              </p>
            </div>
          )}
        </div>

        {/* Actions */}
        {isPending && (
          <div className="flex flex-col gap-2 flex-shrink-0">
            <button
              onClick={() => onAction(approval, 'approve')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <CheckCircle className="h-3.5 w-3.5" />
              {t('admin.crm.approvals.approve') || 'Approve'}
            </button>
            <button
              onClick={() => onAction(approval, 'reject')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              <XCircle className="h-3.5 w-3.5" />
              {t('admin.crm.approvals.reject') || 'Reject'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function ApprovalsPage() {
  const { t } = useI18n();
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');
  const [actionModal, setActionModal] = useState<{
    approval: Approval;
    action: 'approve' | 'reject';
  } | null>(null);

  const fetchApprovals = useCallback(async () => {
    setLoading(true);
    try {
      const statusFilter = activeTab === 'pending' ? '?status=PENDING' : '';
      const res = await fetch(`/api/admin/crm/approvals${statusFilter}`);
      const json = await res.json();

      if (json.success) {
        const data = json.data || json.items || [];
        if (activeTab === 'history') {
          // Filter out pending for history tab
          setApprovals(data.filter((a: Approval) => a.status !== 'PENDING'));
        } else {
          setApprovals(data);
        }
      }
    } catch {
      toast.error(t('admin.crm.approvals.loadError') || 'Failed to load approvals');
    } finally {
      setLoading(false);
    }
  }, [t, activeTab]);

  useEffect(() => {
    fetchApprovals();
  }, [fetchApprovals]);

  const handleAction = (approval: Approval, action: 'approve' | 'reject') => {
    setActionModal({ approval, action });
  };

  const handleActionComplete = () => {
    setActionModal(null);
    fetchApprovals();
  };

  const pendingCount = approvals.filter(a => a.status === 'PENDING').length;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Shield className="h-6 w-6 text-teal-600" />
            {t('admin.crm.approvals.title') || 'Approvals'}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {t('admin.crm.approvals.subtitle') || 'Review and manage approval requests for deals, quotes, and discounts'}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 mb-6 max-w-xs">
        <button
          onClick={() => setActiveTab('pending')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            activeTab === 'pending'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Clock className="h-4 w-4" />
          {t('admin.crm.approvals.pendingTab') || 'Pending'}
          {activeTab === 'pending' && pendingCount > 0 && (
            <span className="bg-yellow-100 text-yellow-700 text-xs font-bold px-1.5 py-0.5 rounded-full">
              {pendingCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            activeTab === 'history'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <FileText className="h-4 w-4" />
          {t('admin.crm.approvals.historyTab') || 'History'}
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 text-teal-500 animate-spin" />
        </div>
      ) : approvals.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          {activeTab === 'pending' ? (
            <>
              <CheckCircle className="h-12 w-12 text-green-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">
                {t('admin.crm.approvals.noPending') || 'No pending approvals'}
              </p>
              <p className="text-sm text-gray-400 mt-1">
                {t('admin.crm.approvals.noPendingDesc') || 'All approval requests have been processed'}
              </p>
            </>
          ) : (
            <>
              <FileText className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">
                {t('admin.crm.approvals.noHistory') || 'No approval history'}
              </p>
              <p className="text-sm text-gray-400 mt-1">
                {t('admin.crm.approvals.noHistoryDesc') || 'Processed approvals will appear here'}
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {approvals.map((approval) => (
            <ApprovalCard
              key={approval.id}
              approval={approval}
              onAction={handleAction}
            />
          ))}
        </div>
      )}

      {/* Action Modal */}
      {actionModal && (
        <ActionModal
          approval={actionModal.approval}
          action={actionModal.action}
          onClose={() => setActionModal(null)}
          onComplete={handleActionComplete}
        />
      )}
    </div>
  );
}
