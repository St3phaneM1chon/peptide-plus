'use client';

import { useState, useEffect } from 'react';
import {
  Megaphone, Plus, Send, Edit, Trash2, Calendar,
  BarChart3,
} from 'lucide-react';
import { useI18n } from '@/i18n/client';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { toast } from 'sonner';

interface Campaign {
  id: string;
  name: string;
  subject: string;
  status: string;
  scheduledAt: string | null;
  sentAt: string | null;
  stats: { sent: number; delivered: number; opened: number; clicked: number; bounced: number; revenue: number; totalRecipients?: number } | null;
  createdAt: string;
  updatedAt: string;
}

interface CampaignListProps {
  onEditCampaign: (id: string) => void;
}

export default function CampaignList({ onEditCampaign }: CampaignListProps) {
  const { t, locale } = useI18n();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [campaignToDelete, setCampaignToDelete] = useState<string | null>(null);
  const [campaignToSend, setCampaignToSend] = useState<string | null>(null);

  const statusConfig: Record<string, { label: string; color: string }> = {
    DRAFT: { label: t('admin.emails.campaigns.statusDraft'), color: 'bg-slate-100 text-slate-600' },
    SCHEDULED: { label: t('admin.emails.campaigns.statusScheduled'), color: 'bg-blue-100 text-blue-700' },
    SENDING: { label: t('admin.emails.campaigns.statusSending'), color: 'bg-yellow-100 text-yellow-700' },
    SENT: { label: t('admin.emails.campaigns.statusSent'), color: 'bg-green-100 text-green-700' },
    CANCELLED: { label: t('admin.emails.campaigns.statusCancelled'), color: 'bg-red-100 text-red-700' },
  };

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const fetchCampaigns = async () => {
    try {
      const res = await fetch('/api/admin/emails/campaigns');
      if (res.ok) {
        const data = await res.json();
        setCampaigns(data.campaigns || []);
      }
    } catch (error) {
      console.error(error);
      toast.error(t('common.errorOccurred'));
    } finally {
      setLoading(false);
    }
  };

  const createCampaign = async () => {
    setCreating(true);
    try {
      const res = await fetch('/api/admin/emails/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `${t('admin.emails.campaigns.campaignPrefix')} ${new Date().toLocaleDateString(locale)}`,
          subject: t('admin.emails.campaigns.newCampaignSubject'),
          htmlContent: '<h1>Hello {{prenom}}</h1><p>Campaign content here...</p>',
        }),
      });
      if (res.ok) {
        const data = await res.json();
        onEditCampaign(data.campaign.id);
      }
    } catch (error) {
      console.error(error);
      toast.error(t('common.errorOccurred'));
    } finally {
      setCreating(false);
    }
  };

  const deleteCampaign = async (id: string) => {
    setDeletingId(id);
    try {
      await fetch(`/api/admin/emails/campaigns/${id}`, { method: 'DELETE' });
      setCampaigns(campaigns.filter(c => c.id !== id));
    } catch (error) {
      console.error(error);
      toast.error(t('common.errorOccurred'));
    } finally {
      setDeletingId(null);
      setCampaignToDelete(null);
    }
  };

  const sendCampaign = async (id: string) => {
    setCampaignToSend(null);
    try {
      const res = await fetch(`/api/admin/emails/campaigns/${id}/send`, { method: 'POST' });
      if (res.ok) {
        fetchCampaigns();
      }
    } catch (error) {
      console.error(error);
      toast.error(t('common.errorOccurred'));
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-32" role="status" aria-label="Loading"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-sky-500" /><span className="sr-only">Loading...</span></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">{t('admin.emails.campaigns.title')}</h3>
          <p className="text-sm text-slate-500">{campaigns.length} {t('admin.emails.campaigns.campaignCount')}</p>
        </div>
        <button
          onClick={createCampaign}
          disabled={creating}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-sky-500 hover:bg-sky-600 rounded-lg disabled:opacity-50"
        >
          <Plus className="h-4 w-4" /> {t('admin.emails.campaigns.newCampaign')}
        </button>
      </div>

      {campaigns.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <Megaphone className="h-12 w-12 text-slate-300 mx-auto mb-3" />
          <h4 className="text-lg font-medium text-slate-900 mb-1">{t('admin.emails.campaigns.noCampaigns')}</h4>
          <p className="text-sm text-slate-500 mb-4">{t('admin.emails.campaigns.createFirstCampaign')}</p>
          <button onClick={createCampaign} className="px-4 py-2 text-sm font-medium text-white bg-sky-500 hover:bg-sky-600 rounded-lg">
            {t('admin.emails.campaigns.createCampaign')}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {campaigns.map((campaign) => {
            const cfg = statusConfig[campaign.status] || statusConfig.DRAFT;
            return (
              <div key={campaign.id} className="bg-white rounded-xl border border-slate-200 p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold text-slate-900 truncate">{campaign.name}</h4>
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${cfg.color}`}>
                        {cfg.label}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600 truncate">{t('admin.emails.campaigns.subject')}: {campaign.subject}</p>

                    {campaign.stats && campaign.status === 'SENT' && (
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mt-3 p-2 bg-slate-50 rounded-lg">
                        <div className="text-center">
                          <div className="text-sm font-semibold">{campaign.stats.sent || 0}</div>
                          <div className="text-[10px] text-slate-400">{t('admin.emails.campaigns.statsSent')}</div>
                        </div>
                        <div className="text-center">
                          <div className="text-sm font-semibold">{campaign.stats.opened || 0}</div>
                          <div className="text-[10px] text-slate-400">{t('admin.emails.campaigns.statsOpened')}</div>
                        </div>
                        <div className="text-center">
                          <div className="text-sm font-semibold">{campaign.stats.clicked || 0}</div>
                          <div className="text-[10px] text-slate-400">{t('admin.emails.campaigns.statsClicked')}</div>
                        </div>
                        <div className="text-center">
                          <div className="text-sm font-semibold text-red-600">{campaign.stats.bounced || 0}</div>
                          <div className="text-[10px] text-slate-400">{t('admin.emails.campaigns.statsBounced')}</div>
                        </div>
                        <div className="text-center">
                          <div className="text-sm font-semibold text-green-600">{campaign.stats.revenue || 0}$</div>
                          <div className="text-[10px] text-slate-400">{t('admin.emails.campaigns.statsRevenue')}</div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1 ml-3">
                    {campaign.status === 'DRAFT' && (
                      <>
                        <button
                          onClick={() => setCampaignToSend(campaign.id)}
                          className="p-1.5 rounded text-green-600 hover:bg-green-50"
                          title={t('admin.emails.campaigns.send')}
                          aria-label="Envoyer la campagne"
                        >
                          <Send className="h-4 w-4" />
                        </button>
                        <button onClick={() => onEditCampaign(campaign.id)} className="p-1.5 rounded text-slate-400 hover:bg-slate-50" aria-label="Modifier la campagne">
                          <Edit className="h-4 w-4" />
                        </button>
                        <button onClick={() => setCampaignToDelete(campaign.id)} disabled={deletingId === campaign.id} className="p-1.5 rounded text-slate-400 hover:bg-red-50 hover:text-red-500 disabled:opacity-50" aria-label="Supprimer la campagne">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </>
                    )}
                    {campaign.status === 'SENT' && (
                      <button className="p-1.5 rounded text-slate-400 hover:bg-slate-50" aria-label="Voir les statistiques">
                        <BarChart3 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
                  {campaign.scheduledAt && (
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {t('admin.emails.campaigns.scheduled')}: {new Date(campaign.scheduledAt).toLocaleString(locale)}
                    </span>
                  )}
                  {campaign.sentAt && (
                    <span className="flex items-center gap-1">
                      <Send className="h-3 w-3" />
                      {t('admin.emails.campaigns.sentAt')}: {new Date(campaign.sentAt).toLocaleString(locale)}
                    </span>
                  )}
                  <span>{t('admin.emails.campaigns.created')}: {new Date(campaign.createdAt).toLocaleDateString(locale)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Delete campaign ConfirmDialog (replaces native confirm()) */}
      <ConfirmDialog
        isOpen={campaignToDelete !== null}
        title={t('admin.emails.campaigns.deleteTitle') || 'Delete Campaign'}
        message={t('admin.emails.campaigns.confirmDelete')}
        confirmLabel={t('common.delete') || 'Delete'}
        cancelLabel={t('common.cancel')}
        onConfirm={() => { if (campaignToDelete) deleteCampaign(campaignToDelete); }}
        onCancel={() => setCampaignToDelete(null)}
        variant="danger"
      />

      {/* Send campaign ConfirmDialog (replaces native confirm()) */}
      <ConfirmDialog
        isOpen={campaignToSend !== null}
        title={t('admin.emails.campaigns.sendTitle') || 'Send Campaign'}
        message={t('admin.emails.campaigns.confirmSend')}
        confirmLabel={t('admin.emails.campaigns.send') || 'Send'}
        cancelLabel={t('common.cancel')}
        onConfirm={() => { if (campaignToSend) sendCampaign(campaignToSend); }}
        onCancel={() => setCampaignToSend(null)}
        variant="warning"
      />
    </div>
  );
}
