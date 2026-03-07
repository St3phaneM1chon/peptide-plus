'use client';

/**
 * ConferenceClient - Video conference lobby
 * Lists active rooms, allows creating new rooms and joining.
 */

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Video,
  Plus,
  Users,
  Clock,
  Trash2,
  LogIn,
  Circle,
} from 'lucide-react';
import { useI18n } from '@/i18n/client';
import { PageHeader, Button, EmptyState } from '@/components/admin';
import { toast } from 'sonner';
import { addCSRFHeader } from '@/lib/csrf';

interface VideoRoomData {
  id: string;
  name: string;
  displayName: string;
  maxParticipants: number;
  isRecording: boolean;
  status: string;
  startedAt: string;
  participantCount: number;
  createdBy: {
    id: string;
    name: string | null;
    email: string;
  };
}

export default function ConferenceClient() {
  const { t } = useI18n();
  const router = useRouter();
  const [rooms, setRooms] = useState<VideoRoomData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomMax, setNewRoomMax] = useState(10);
  const [isCreating, setIsCreating] = useState(false);

  const loadRooms = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/voip/video-conference');
      const data = await res.json();
      setRooms(data.rooms || []);
    } catch {
      toast.error(t('common.errorOccurred'));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadRooms();
    const interval = setInterval(loadRooms, 15000);
    return () => clearInterval(interval);
  }, [loadRooms]);

  const createRoom = async () => {
    if (!newRoomName.trim()) return;
    setIsCreating(true);

    try {
      const res = await fetch('/api/admin/voip/video-conference', {
        method: 'POST',
        headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          displayName: newRoomName.trim(),
          maxParticipants: newRoomMax,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create room');
      }

      const data = await res.json();
      toast.success(t('admin.telephonie.conference.created'));
      setShowCreateModal(false);
      setNewRoomName('');
      setNewRoomMax(10);
      router.push(`/admin/telephonie/conference/${data.room.name}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('common.errorOccurred'));
    } finally {
      setIsCreating(false);
    }
  };

  const endRoom = async (roomName: string) => {
    if (!confirm(t('admin.telephonie.conference.confirmEnd'))) return;

    try {
      const res = await fetch(`/api/admin/voip/video-conference/${roomName}`, {
        method: 'DELETE',
        headers: addCSRFHeader({}),
      });

      if (res.ok) {
        toast.success(t('admin.telephonie.conference.ended'));
        loadRooms();
      } else {
        toast.error(t('common.errorOccurred'));
      }
    } catch {
      toast.error(t('common.errorOccurred'));
    }
  };

  const formatDuration = (startedAt: string) => {
    const diff = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
    const h = Math.floor(diff / 3600);
    const m = Math.floor((diff % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  return (
    <div>
      <PageHeader
        title={t('admin.telephonie.conference.title')}
        subtitle={t('admin.telephonie.conference.subtitle')}
        actions={
          <Button variant="primary" icon={Plus} onClick={() => setShowCreateModal(true)}>
            {t('admin.telephonie.conference.create')}
          </Button>
        }
      />

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full" />
        </div>
      ) : rooms.length === 0 ? (
        <EmptyState
          icon={Video}
          title={t('admin.telephonie.conference.noRooms')}
          description={t('admin.telephonie.conference.noRoomsDesc')}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {rooms.map((room) => (
            <div
              key={room.id}
              className="bg-white border border-slate-200 rounded-xl p-5 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-slate-900">{room.displayName}</h3>
                  <p className="text-sm text-slate-500">
                    {t('admin.telephonie.conference.createdBy')} {room.createdBy.name || room.createdBy.email}
                  </p>
                </div>
                {room.isRecording && (
                  <span className="flex items-center gap-1 px-2 py-0.5 bg-red-50 text-red-600 text-xs font-medium rounded-full">
                    <Circle className="w-2 h-2 fill-red-500" />
                    REC
                  </span>
                )}
              </div>

              <div className="flex items-center gap-4 text-sm text-slate-600 mb-4">
                <span className="flex items-center gap-1">
                  <Users className="w-4 h-4" />
                  {room.participantCount}/{room.maxParticipants}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {formatDuration(room.startedAt)}
                </span>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="primary"
                  size="sm"
                  icon={LogIn}
                  onClick={() => router.push(`/admin/telephonie/conference/${room.name}`)}
                  className="flex-1"
                >
                  {t('admin.telephonie.conference.join')}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  icon={Trash2}
                  onClick={() => endRoom(room.name)}
                  className="text-red-600 hover:bg-red-50"
                >
                  {t('admin.telephonie.conference.end')}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Room Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">
              {t('admin.telephonie.conference.createTitle')}
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {t('admin.telephonie.conference.roomName')}
                </label>
                <input
                  type="text"
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  placeholder={t('admin.telephonie.conference.roomNamePlaceholder')}
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {t('admin.telephonie.conference.maxParticipants')}
                </label>
                <input
                  type="number"
                  value={newRoomMax}
                  onChange={(e) => setNewRoomMax(Number(e.target.value))}
                  min={2}
                  max={50}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <Button variant="secondary" onClick={() => setShowCreateModal(false)}>
                {t('common.cancel')}
              </Button>
              <Button
                variant="primary"
                onClick={createRoom}
                loading={isCreating}
                disabled={!newRoomName.trim()}
              >
                {t('admin.telephonie.conference.create')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
