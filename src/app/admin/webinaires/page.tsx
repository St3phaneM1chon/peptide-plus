'use client';

import { useState, useEffect } from 'react';
import {
  Plus,
  User,
  CalendarDays,
  Clock,
  Users,
  Video,
  CheckCircle,
  BarChart3,
} from 'lucide-react';

import { PageHeader } from '@/components/admin/PageHeader';
import { Button } from '@/components/admin/Button';
import { Modal } from '@/components/admin/Modal';
import { StatCard } from '@/components/admin/StatCard';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { EmptyState } from '@/components/admin/EmptyState';
import { FormField, Input, Textarea } from '@/components/admin/FormField';

interface Webinar {
  id: string;
  title: string;
  description: string;
  host: string;
  scheduledAt: string;
  duration: number;
  meetingUrl?: string;
  recordingUrl?: string;
  maxAttendees: number;
  registeredCount: number;
  attendedCount: number;
  status: 'DRAFT' | 'SCHEDULED' | 'LIVE' | 'COMPLETED' | 'CANCELLED';
  createdAt: string;
}

const statusVariant: Record<string, 'neutral' | 'info' | 'error' | 'success'> = {
  DRAFT: 'neutral',
  SCHEDULED: 'info',
  LIVE: 'error',
  COMPLETED: 'success',
  CANCELLED: 'neutral',
};

export default function WebinairesPage() {
  const [webinars, setWebinars] = useState<Webinar[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_editingWebinar, _setEditingWebinar] = useState<Webinar | null>(null);

  useEffect(() => {
    fetchWebinars();
  }, []);

  const fetchWebinars = async () => {
    setWebinars([]);
    setLoading(false);
  };

  const stats = {
    upcoming: webinars.filter(w => w.status === 'SCHEDULED').length,
    completed: webinars.filter(w => w.status === 'COMPLETED').length,
    totalRegistered: webinars.filter(w => w.status === 'SCHEDULED').reduce((sum, w) => sum + w.registeredCount, 0),
    avgAttendance: webinars.filter(w => w.status === 'COMPLETED' && w.registeredCount > 0)
      .reduce((sum, w) => sum + (w.attendedCount / w.registeredCount * 100), 0) /
      webinars.filter(w => w.status === 'COMPLETED' && w.registeredCount > 0).length || 0,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Webinaires"
        subtitle="Planifiez et g&eacute;rez vos webinaires"
        actions={
          <Button variant="primary" icon={Plus} onClick={() => setShowForm(true)}>
            Nouveau webinaire
          </Button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="A venir" value={stats.upcoming} icon={CalendarDays} />
        <StatCard label="Completes" value={stats.completed} icon={CheckCircle} />
        <StatCard label="Inscrits (a venir)" value={stats.totalRegistered} icon={Users} />
        <StatCard label="Taux presence moy." value={`${stats.avgAttendance.toFixed(0)}%`} icon={BarChart3} />
      </div>

      {/* Webinars List */}
      {webinars.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-lg">
          <EmptyState
            icon={Video}
            title="Aucun webinaire"
            description="Commencez par creer votre premier webinaire"
            action={
              <Button variant="primary" icon={Plus} onClick={() => setShowForm(true)}>
                Nouveau webinaire
              </Button>
            }
          />
        </div>
      ) : (
        <div className="space-y-4">
          {webinars.map((webinar) => (
            <div key={webinar.id} className="bg-white rounded-xl border border-slate-200 p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-bold text-slate-900 text-lg">{webinar.title}</h3>
                    <StatusBadge variant={statusVariant[webinar.status]} dot>
                      {webinar.status}
                    </StatusBadge>
                  </div>
                  <p className="text-slate-600 mb-3">{webinar.description}</p>
                  <div className="flex flex-wrap gap-4 text-sm text-slate-500">
                    <span className="flex items-center gap-1">
                      <User className="w-4 h-4" />
                      {webinar.host}
                    </span>
                    <span className="flex items-center gap-1">
                      <CalendarDays className="w-4 h-4" />
                      {new Date(webinar.scheduledAt).toLocaleDateString('fr-CA')} a {new Date(webinar.scheduledAt).toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      {webinar.duration} min
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="w-4 h-4" />
                      {webinar.registeredCount}/{webinar.maxAttendees} inscrits
                      {webinar.status === 'COMPLETED' && ` (${webinar.attendedCount} presents)`}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col gap-2 ml-4">
                  {webinar.status === 'SCHEDULED' && (
                    <>
                      <Button variant="outline" size="sm">Modifier</Button>
                      <Button variant="danger" size="sm">Annuler</Button>
                    </>
                  )}
                  {webinar.recordingUrl && (
                    <a
                      href={webinar.recordingUrl}
                      target="_blank"
                      className="px-3 py-1 bg-purple-100 text-purple-700 rounded text-sm hover:bg-purple-200 text-center"
                    >
                      Voir replay
                    </a>
                  )}
                  <Button variant="ghost" size="sm">Voir inscrits</Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Form Modal */}
      <Modal
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        title="Nouveau webinaire"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowForm(false)}>
              Annuler
            </Button>
            <Button variant="primary">
              Creer
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <FormField label="Titre" required>
            <Input type="text" />
          </FormField>
          <FormField label="Description" required>
            <Textarea rows={3} />
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Date et heure" required>
              <Input type="datetime-local" />
            </FormField>
            <FormField label="Duree (min)" required>
              <Input type="number" defaultValue={60} />
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Hote" required>
              <Input type="text" />
            </FormField>
            <FormField label="Places max">
              <Input type="number" defaultValue={100} />
            </FormField>
          </div>
          <FormField label="Lien de la reunion">
            <Input type="url" placeholder="https://zoom.us/j/..." />
          </FormField>
        </div>
      </Modal>
    </div>
  );
}
