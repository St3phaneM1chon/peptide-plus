'use client';

/**
 * ConferenceRoomClient - In-room video conference view
 * Uses LiveKit React components for video/audio/screen sharing.
 */

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  Monitor,
  PhoneOff,
  Circle,
  Square,
  Users,
  UserMinus,
  VolumeX,
} from 'lucide-react';
import { useI18n } from '@/i18n/client';
import { Button } from '@/components/admin';
import { toast } from 'sonner';
import { addCSRFHeader } from '@/lib/csrf';

interface ConferenceRoomClientProps {
  roomName: string;
}

interface Participant {
  identity: string;
  name: string;
  state: number;
}

export default function ConferenceRoomClient({ roomName }: ConferenceRoomClientProps) {
  const { t } = useI18n();
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [liveKitUrl, setLiveKitUrl] = useState<string>('');
  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [error, setError] = useState<string | null>(null);

  // LiveKit component state (managed by LiveKit SDK when connected)
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [isAudioOn, setIsAudioOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  // Get join token
  useEffect(() => {
    async function joinRoom() {
      try {
        const res = await fetch(`/api/admin/voip/video-conference/${roomName}/token`, {
          method: 'POST',
          headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Failed to get token');
        }

        const data = await res.json();
        setToken(data.token);
        setLiveKitUrl(data.url);
        setIsConnected(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Connection failed');
      }
    }

    joinRoom();
  }, [roomName]);

  // Poll room status
  useEffect(() => {
    if (!isConnected) return;

    const pollStatus = async () => {
      try {
        const res = await fetch(`/api/admin/voip/video-conference/${roomName}`);
        if (res.ok) {
          const data = await res.json();
          setParticipants(data.room?.participants || []);
          setIsRecording(data.room?.isRecording || false);
        }
      } catch { /* ignore */ }
    };

    pollStatus();
    const interval = setInterval(pollStatus, 5000);
    return () => clearInterval(interval);
  }, [roomName, isConnected]);

  const toggleRecording = useCallback(async () => {
    try {
      const method = isRecording ? 'DELETE' : 'POST';
      const res = await fetch(`/api/admin/voip/video-conference/${roomName}/recording`, {
        method,
        headers: addCSRFHeader({}),
      });

      if (res.ok) {
        setIsRecording(!isRecording);
        toast.success(
          isRecording
            ? t('admin.telephonie.conference.recordingStopped')
            : t('admin.telephonie.conference.recordingStarted')
        );
      } else {
        const data = await res.json();
        toast.error(data.error || t('common.errorOccurred'));
      }
    } catch {
      toast.error(t('common.errorOccurred'));
    }
  }, [isRecording, roomName, t]);

  const kickParticipant = useCallback(async (identity: string) => {
    if (!confirm(t('admin.telephonie.conference.confirmKick'))) return;

    try {
      const res = await fetch(
        `/api/admin/voip/video-conference/${roomName}/participants/${encodeURIComponent(identity)}`,
        { method: 'DELETE', headers: addCSRFHeader({}) }
      );

      if (res.ok) {
        toast.success(t('admin.telephonie.conference.participantKicked'));
      }
    } catch {
      toast.error(t('common.errorOccurred'));
    }
  }, [roomName, t]);

  const muteParticipant = useCallback(async (identity: string) => {
    try {
      const res = await fetch(
        `/api/admin/voip/video-conference/${roomName}/participants/${encodeURIComponent(identity)}`,
        {
          method: 'PUT',
          headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ muted: true }),
        }
      );

      if (res.ok) {
        toast.success(t('admin.telephonie.conference.participantMuted'));
      }
    } catch {
      toast.error(t('common.errorOccurred'));
    }
  }, [roomName, t]);

  const leaveRoom = useCallback(() => {
    router.push('/admin/telephonie/conference');
  }, [router]);

  if (error) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-200px)]">
        <div className="text-center">
          <Video className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-slate-900 mb-2">{t('admin.telephonie.conference.connectionError')}</h2>
          <p className="text-slate-500 mb-4">{error}</p>
          <Button variant="primary" onClick={leaveRoom}>
            {t('admin.telephonie.conference.backToLobby')}
          </Button>
        </div>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-200px)]">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-slate-500">{t('admin.telephonie.conference.connecting')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-200px)]">
      {/* Top bar */}
      <div className="flex items-center justify-between bg-slate-900 text-white px-4 py-2 rounded-t-xl">
        <div className="flex items-center gap-3">
          <Video className="w-5 h-5" />
          <span className="font-medium">{roomName}</span>
          <span className="flex items-center gap-1 text-sm text-slate-400">
            <Users className="w-4 h-4" />
            {participants.length}
          </span>
          {isRecording && (
            <span className="flex items-center gap-1 px-2 py-0.5 bg-red-500/20 text-red-400 text-xs font-medium rounded-full animate-pulse">
              <Circle className="w-2 h-2 fill-red-400" />
              REC
            </span>
          )}
        </div>
      </div>

      {/* Video area - LiveKit will render here */}
      <div className="flex-1 bg-slate-950 relative flex items-center justify-center">
        {/*
          When LiveKit SDK is installed, this div will be replaced with:
          <LiveKitRoom token={token} serverUrl={liveKitUrl} connect={true}>
            <VideoConference />
          </LiveKitRoom>

          For now, show a placeholder indicating LiveKit needs to be configured.
        */}
        <div className="text-center text-white">
          <Video className="w-24 h-24 text-slate-600 mx-auto mb-4" />
          <p className="text-lg font-medium text-slate-400 mb-2">{t('admin.telephonie.conference.liveKitReady')}</p>
          <p className="text-sm text-slate-500 max-w-md">
            {t('admin.telephonie.conference.liveKitConfig')}
          </p>
          <p className="text-xs text-slate-600 mt-4 font-mono">
            Token: {token.slice(0, 20)}... | URL: {liveKitUrl || 'Not configured'}
          </p>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-3 bg-slate-900 px-4 py-3 rounded-b-xl">
        <button
          onClick={() => setIsAudioOn(!isAudioOn)}
          className={`p-3 rounded-full transition-colors ${
            isAudioOn ? 'bg-slate-700 text-white hover:bg-slate-600' : 'bg-red-500 text-white hover:bg-red-600'
          }`}
          title={isAudioOn ? t('voip.call.mute') : t('voip.call.unmute')}
        >
          {isAudioOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
        </button>

        <button
          onClick={() => setIsVideoOn(!isVideoOn)}
          className={`p-3 rounded-full transition-colors ${
            isVideoOn ? 'bg-slate-700 text-white hover:bg-slate-600' : 'bg-red-500 text-white hover:bg-red-600'
          }`}
          title={isVideoOn ? t('voip.softphone.video.disable') : t('voip.softphone.video.enable')}
        >
          {isVideoOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
        </button>

        <button
          onClick={() => setIsScreenSharing(!isScreenSharing)}
          className={`p-3 rounded-full transition-colors ${
            isScreenSharing ? 'bg-teal-500 text-white' : 'bg-slate-700 text-white hover:bg-slate-600'
          }`}
          title={t('voip.softphone.screenShare.start')}
        >
          <Monitor className="w-5 h-5" />
        </button>

        <button
          onClick={toggleRecording}
          className={`p-3 rounded-full transition-colors ${
            isRecording ? 'bg-red-500 text-white animate-pulse' : 'bg-slate-700 text-white hover:bg-slate-600'
          }`}
          title={isRecording ? t('voip.softphone.recording.stop') : t('voip.softphone.recording.start')}
        >
          {isRecording ? <Square className="w-5 h-5" /> : <Circle className="w-5 h-5" />}
        </button>

        <div className="w-px h-8 bg-slate-600 mx-2" />

        <button
          onClick={leaveRoom}
          className="p-3 rounded-full bg-red-500 text-white hover:bg-red-600 transition-colors"
          title={t('admin.telephonie.conference.leave')}
        >
          <PhoneOff className="w-5 h-5" />
        </button>
      </div>

      {/* Participants sidebar (small) */}
      {participants.length > 0 && (
        <div className="mt-4 bg-white border border-slate-200 rounded-xl p-4">
          <h3 className="font-medium text-slate-900 mb-3 flex items-center gap-2">
            <Users className="w-4 h-4" />
            {t('admin.telephonie.conference.participants')} ({participants.length})
          </h3>
          <div className="space-y-2">
            {participants.map((p) => (
              <div key={p.identity} className="flex items-center justify-between py-1">
                <span className="text-sm text-slate-700">{p.name || p.identity}</span>
                <div className="flex gap-1">
                  <button
                    onClick={() => muteParticipant(p.identity)}
                    className="p-1 text-slate-400 hover:text-orange-500 transition-colors"
                    title={t('admin.telephonie.conference.mute')}
                  >
                    <VolumeX className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => kickParticipant(p.identity)}
                    className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                    title={t('admin.telephonie.conference.kick')}
                  >
                    <UserMinus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
