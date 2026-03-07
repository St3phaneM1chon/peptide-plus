'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import PipelineKanban from '@/components/admin/crm/PipelineKanban';
import { useI18n } from '@/i18n/client';
import { toast } from 'sonner';
import { X, List, LayoutGrid } from 'lucide-react';

export default function PipelinePage() {
  const { t } = useI18n();
  const router = useRouter();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createStageId, setCreateStageId] = useState('');
  const [formData, setFormData] = useState({ title: '', value: '', assignedToId: '', expectedCloseDate: '' });
  const [creating, setCreating] = useState(false);
  const [agents, setAgents] = useState<Array<{ id: string; name: string | null; email: string }>>([]);

  const handleDealClick = useCallback((dealId: string) => {
    router.push(`/admin/crm/deals/${dealId}`);
  }, [router]);

  const handleCreateDeal = useCallback(async (stageId: string) => {
    setCreateStageId(stageId);
    setFormData({ title: '', value: '', assignedToId: '', expectedCloseDate: '' });
    setShowCreateModal(true);

    // Fetch agents for assignment
    try {
      const res = await fetch('/api/admin/users?role=EMPLOYEE');
      const json = await res.json();
      setAgents(json.users || []);
    } catch {
      // ignore
    }
  }, []);

  const submitCreate = async () => {
    if (!formData.title.trim()) {
      toast.error('Title is required');
      return;
    }
    if (!formData.assignedToId) {
      toast.error('Please assign an agent');
      return;
    }

    setCreating(true);
    try {
      // Get pipeline for this stage
      const pipelinesRes = await fetch('/api/admin/crm/pipelines');
      const pipelinesJson = await pipelinesRes.json();
      const pipeline = pipelinesJson.data?.find((p: { stages: Array<{ id: string }> }) =>
        p.stages.some((s: { id: string }) => s.id === createStageId)
      );

      if (!pipeline) {
        toast.error('Pipeline not found');
        return;
      }

      const body: Record<string, unknown> = {
        title: formData.title.trim(),
        stageId: createStageId,
        pipelineId: pipeline.id,
        assignedToId: formData.assignedToId,
      };
      if (formData.value) body.value = parseFloat(formData.value);
      if (formData.expectedCloseDate) body.expectedCloseDate = formData.expectedCloseDate;

      const res = await fetch('/api/admin/crm/deals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();

      if (json.success) {
        toast.success('Deal created');
        setShowCreateModal(false);
        // Trigger reload by navigating to self
        router.refresh();
      } else {
        toast.error(json.error?.message || 'Failed to create deal');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col">
      {/* View Toggle */}
      <div className="flex items-center justify-end px-4 pt-3 pb-1">
        <div className="flex items-center border border-gray-300 rounded-md overflow-hidden">
          <button
            onClick={() => router.push('/admin/crm/deals')}
            className="flex items-center gap-1 px-2.5 py-1.5 text-sm text-gray-500 hover:bg-gray-50 border-r border-gray-300"
            title={t('admin.crm.listView') || 'List View'}
          >
            <List className="h-4 w-4" />
          </button>
          <button
            className="flex items-center gap-1 px-2.5 py-1.5 text-sm bg-teal-50 text-teal-700"
            title={t('admin.crm.kanbanView') || 'Kanban View'}
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
        </div>
      </div>
      <PipelineKanban onDealClick={handleDealClick} onCreateDeal={handleCreateDeal} />

      {/* Create Deal Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold">{t('admin.crm.newDeal') || 'New Deal'}</h2>
              <button onClick={() => setShowCreateModal(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.crm.dealTitle') || 'Title'}</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-teal-500 focus:border-teal-500"
                  placeholder="e.g. Enterprise Contract - Acme Inc"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.crm.dealValue') || 'Value (CAD)'}</label>
                <input
                  type="number"
                  value={formData.value}
                  onChange={(e) => setFormData((prev) => ({ ...prev, value: e.target.value }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-teal-500 focus:border-teal-500"
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.crm.assignedTo') || 'Assigned To'}</label>
                <select
                  value={formData.assignedToId}
                  onChange={(e) => setFormData((prev) => ({ ...prev, assignedToId: e.target.value }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-teal-500 focus:border-teal-500"
                >
                  <option value="">{t('common.select') || 'Select...'}</option>
                  {agents.map((a) => (
                    <option key={a.id} value={a.id}>{a.name || a.email}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.crm.expectedCloseDate') || 'Expected Close Date'}</label>
                <input
                  type="date"
                  value={formData.expectedCloseDate}
                  onChange={(e) => setFormData((prev) => ({ ...prev, expectedCloseDate: e.target.value }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-teal-500 focus:border-teal-500"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 p-4 border-t">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                {t('common.cancel') || 'Cancel'}
              </button>
              <button
                onClick={submitCreate}
                disabled={creating}
                className="px-4 py-2 text-sm text-white bg-teal-600 rounded-md hover:bg-teal-700 disabled:opacity-50"
              >
                {creating ? '...' : t('common.create') || 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
