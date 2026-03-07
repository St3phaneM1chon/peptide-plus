'use client';

/**
 * CallControls (S4A)
 * In-call control buttons with two rows:
 *   Row 1 (primary): Mute, Hold, Park, Conference, Transfer, Hangup
 *   Row 2 (secondary): DTMF, Recording, Noise Cancel, Screen Share, Flip
 * Expandable panels: DTMF keypad, Transfer input, Conference input (mutual exclusive).
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Mic,
  MicOff,
  Pause,
  Play,
  PhoneOff,
  PhoneForwarded,
  Hash,
  X,
  ParkingSquare,
  UserPlus,
  ArrowLeftRight,
  Circle,
  AudioLines,
  Monitor,
  Smartphone,
  LaptopMinimal,
  Phone,
  Video,
  VideoOff,
} from 'lucide-react';
import { useI18n } from '@/i18n/client';
import type { VoipCall } from '@/hooks/useVoip';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface CallControlsProps {
  call: VoipCall;
  onMute: () => void;
  onHold: () => void;
  onHangup: () => void;
  onDtmf: (digit: string) => void;
  onTransfer: (number: string) => void;
  // S4A additions
  onPark?: () => void;
  onConference?: (number: string) => void;
  onFlip?: (deviceType: string) => void;
  onToggleRecording?: () => void;
  onToggleNoiseCancel?: () => void;
  onScreenShare?: () => void;
  onToggleVideo?: () => void;
  isRecording?: boolean;
  isNoiseCancelActive?: boolean;
  isScreenSharing?: boolean;
  isVideoEnabled?: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DTMF_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'];

type ExpandedPanel = 'none' | 'dtmf' | 'transfer' | 'conference' | 'flip';

const FLIP_DEVICES = [
  { id: 'web', labelKey: 'voip.call.flipWeb', Icon: LaptopMinimal },
  { id: 'desk', labelKey: 'voip.call.flipDesk', Icon: Phone },
  { id: 'mobile', labelKey: 'voip.call.flipMobile', Icon: Smartphone },
] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Format elapsed seconds as MM:SS */
function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CallControls({
  call,
  onMute,
  onHold,
  onHangup,
  onDtmf,
  onTransfer,
  onPark,
  onConference,
  onFlip,
  onToggleRecording,
  onToggleNoiseCancel,
  onScreenShare,
  onToggleVideo,
  isRecording = false,
  isNoiseCancelActive = false,
  isScreenSharing = false,
  isVideoEnabled = false,
}: CallControlsProps) {
  const { t } = useI18n();

  // -- Local state ----------------------------------------------------------

  const [expandedPanel, setExpandedPanel] = useState<ExpandedPanel>('none');
  const [transferNumber, setTransferNumber] = useState('');
  const [conferenceNumber, setConferenceNumber] = useState('');
  const [recordingSeconds, setRecordingSeconds] = useState(0);

  // -- Toggle a panel (close others) ----------------------------------------

  const togglePanel = useCallback((panel: ExpandedPanel) => {
    setExpandedPanel((prev) => (prev === panel ? 'none' : panel));
  }, []);

  // -- Recording timer ------------------------------------------------------

  useEffect(() => {
    if (!isRecording) {
      setRecordingSeconds(0);
      return;
    }
    const interval = setInterval(() => {
      setRecordingSeconds((s) => s + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [isRecording]);

  // -- Render helpers -------------------------------------------------------

  const isPanelOpen = (panel: ExpandedPanel) => expandedPanel === panel;

  // Common button style builder
  const btnClass = (
    active: boolean,
    activeColors = 'bg-teal-100 text-teal-600',
    inactiveColors = 'bg-gray-100 text-gray-700 hover:bg-gray-200',
  ) =>
    `p-3 rounded-full transition-colors ${active ? activeColors : inactiveColors}`;

  const btnClassSm = (
    active: boolean,
    activeColors = 'bg-teal-100 text-teal-600',
    inactiveColors = 'bg-gray-100 text-gray-700 hover:bg-gray-200',
  ) =>
    `p-2 rounded-full transition-colors ${active ? activeColors : inactiveColors}`;

  // =========================================================================
  // RENDER
  // =========================================================================

  return (
    <div className="flex flex-col gap-2">
      {/* ----------------------------------------------------------------- */}
      {/* Recording indicator                                               */}
      {/* ----------------------------------------------------------------- */}
      {isRecording && (
        <div className="flex items-center justify-center gap-2 py-1">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
          </span>
          <span className="text-xs font-semibold text-red-600 uppercase tracking-wide">
            {t('voip.call.rec')}
          </span>
          <span className="text-xs text-red-500 tabular-nums">
            {formatDuration(recordingSeconds)}
          </span>
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* ROW 1 - Primary controls                                         */}
      {/* ----------------------------------------------------------------- */}
      <div className="flex items-center justify-center gap-3">
        {/* Mute */}
        <button
          onClick={onMute}
          className={btnClass(
            call.isMuted,
            'bg-red-100 text-red-600 hover:bg-red-200',
          )}
          title={call.isMuted ? t('voip.call.unmute') : t('voip.call.mute')}
        >
          {call.isMuted ? (
            <MicOff className="w-5 h-5" />
          ) : (
            <Mic className="w-5 h-5" />
          )}
        </button>

        {/* Hold */}
        <button
          onClick={onHold}
          className={btnClass(
            call.isOnHold,
            'bg-yellow-100 text-yellow-700 hover:bg-yellow-200',
          )}
          title={call.isOnHold ? t('voip.call.resume') : t('voip.call.hold')}
        >
          {call.isOnHold ? (
            <Play className="w-5 h-5" />
          ) : (
            <Pause className="w-5 h-5" />
          )}
        </button>

        {/* Park */}
        {onPark && (
          <button
            onClick={onPark}
            className={btnClass(false, 'bg-purple-100 text-purple-600')}
            title={t('voip.call.park')}
          >
            <ParkingSquare className="w-5 h-5" />
          </button>
        )}

        {/* Conference */}
        {onConference && (
          <button
            onClick={() => togglePanel('conference')}
            className={btnClass(
              isPanelOpen('conference'),
              'bg-teal-100 text-teal-600',
            )}
            title={t('voip.call.conference')}
          >
            <UserPlus className="w-5 h-5" />
          </button>
        )}

        {/* Transfer */}
        <button
          onClick={() => togglePanel('transfer')}
          className={btnClass(isPanelOpen('transfer'))}
          title={t('voip.call.transfer')}
        >
          <PhoneForwarded className="w-5 h-5" />
        </button>

        {/* Hangup */}
        <button
          onClick={onHangup}
          className="p-3 rounded-full bg-red-500 text-white hover:bg-red-600 transition-colors"
          title={t('voip.call.hangup')}
        >
          <PhoneOff className="w-5 h-5" />
        </button>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* ROW 2 - Secondary controls (smaller)                             */}
      {/* ----------------------------------------------------------------- */}
      <div className="flex items-center justify-center gap-2">
        {/* DTMF Keypad */}
        <button
          onClick={() => togglePanel('dtmf')}
          className={btnClassSm(isPanelOpen('dtmf'))}
          title={t('voip.call.keypad')}
        >
          <Hash className="w-4 h-4" />
        </button>

        {/* Recording */}
        {onToggleRecording && (
          <button
            onClick={onToggleRecording}
            className={btnClassSm(
              isRecording,
              'bg-red-100 text-red-600 hover:bg-red-200',
            )}
            title={
              isRecording
                ? t('voip.call.stopRecording')
                : t('voip.call.startRecording')
            }
          >
            <Circle
              className={`w-4 h-4 ${isRecording ? 'fill-red-500' : ''}`}
            />
          </button>
        )}

        {/* Noise Cancel */}
        {onToggleNoiseCancel && (
          <button
            onClick={onToggleNoiseCancel}
            className={btnClassSm(
              isNoiseCancelActive,
              'bg-green-100 text-green-600 hover:bg-green-200',
            )}
            title={
              isNoiseCancelActive
                ? t('voip.call.noiseCancelOff')
                : t('voip.call.noiseCancelOn')
            }
          >
            <AudioLines className="w-4 h-4" />
          </button>
        )}

        {/* Screen Share */}
        {onScreenShare && (
          <button
            onClick={onScreenShare}
            className={btnClassSm(
              isScreenSharing,
              'bg-indigo-100 text-indigo-600 hover:bg-indigo-200',
            )}
            title={
              isScreenSharing
                ? t('voip.call.stopScreenShare')
                : t('voip.call.startScreenShare')
            }
          >
            <Monitor className="w-4 h-4" />
          </button>
        )}

        {/* Video Toggle */}
        {onToggleVideo && (
          <button
            onClick={onToggleVideo}
            className={btnClassSm(
              isVideoEnabled,
              'bg-blue-100 text-blue-600 hover:bg-blue-200',
            )}
            title={isVideoEnabled ? t('voip.softphone.video.disable') : t('voip.softphone.video.enable')}
          >
            {isVideoEnabled ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
          </button>
        )}

        {/* Call Flip */}
        {onFlip && (
          <button
            onClick={() => togglePanel('flip')}
            className={btnClassSm(isPanelOpen('flip'))}
            title={t('voip.call.flip')}
          >
            <ArrowLeftRight className="w-4 h-4" />
          </button>
        )}


      </div>

      {/* ----------------------------------------------------------------- */}
      {/* EXPANDABLE PANELS (only one open at a time)                      */}
      {/* ----------------------------------------------------------------- */}

      {/* DTMF Keypad */}
      {isPanelOpen('dtmf') && (
        <div className="grid grid-cols-3 gap-1 max-w-[180px] mx-auto mt-2">
          {DTMF_KEYS.map((key) => (
            <button
              key={key}
              onClick={() => onDtmf(key)}
              className="w-14 h-10 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium text-lg transition-colors"
            >
              {key}
            </button>
          ))}
        </div>
      )}

      {/* Transfer Input */}
      {isPanelOpen('transfer') && (
        <div className="flex items-center gap-2 mt-2 max-w-[240px] mx-auto">
          <input
            type="text"
            value={transferNumber}
            onChange={(e) => setTransferNumber(e.target.value)}
            placeholder={t('voip.call.transferTo')}
            className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && transferNumber) {
                onTransfer(transferNumber);
                setTransferNumber('');
                setExpandedPanel('none');
              }
            }}
          />
          <button
            onClick={() => {
              if (transferNumber) {
                onTransfer(transferNumber);
                setTransferNumber('');
                setExpandedPanel('none');
              }
            }}
            className="px-3 py-1.5 bg-teal-500 text-white rounded-lg text-sm hover:bg-teal-600"
          >
            {t('voip.call.transferBtn')}
          </button>
          <button
            onClick={() => setExpandedPanel('none')}
            className="p-1.5 text-gray-500 hover:text-gray-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Conference Input */}
      {isPanelOpen('conference') && onConference && (
        <div className="flex items-center gap-2 mt-2 max-w-[240px] mx-auto">
          <input
            type="text"
            value={conferenceNumber}
            onChange={(e) => setConferenceNumber(e.target.value)}
            placeholder={t('voip.call.conferenceNumber')}
            className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && conferenceNumber) {
                onConference(conferenceNumber);
                setConferenceNumber('');
                setExpandedPanel('none');
              }
            }}
          />
          <button
            onClick={() => {
              if (conferenceNumber) {
                onConference(conferenceNumber);
                setConferenceNumber('');
                setExpandedPanel('none');
              }
            }}
            className="px-3 py-1.5 bg-teal-500 text-white rounded-lg text-sm hover:bg-teal-600"
          >
            {t('voip.call.addParticipant')}
          </button>
          <button
            onClick={() => setExpandedPanel('none')}
            className="p-1.5 text-gray-500 hover:text-gray-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Flip Device Selector */}
      {isPanelOpen('flip') && onFlip && (
        <div className="flex items-center justify-center gap-2 mt-2">
          {FLIP_DEVICES.map(({ id, labelKey, Icon }) => (
            <button
              key={id}
              onClick={() => {
                onFlip(id);
                setExpandedPanel('none');
              }}
              className="flex flex-col items-center gap-1 px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs transition-colors"
            >
              <Icon className="w-5 h-5" />
              <span>{t(labelKey)}</span>
            </button>
          ))}
          <button
            onClick={() => setExpandedPanel('none')}
            className="p-1.5 text-gray-500 hover:text-gray-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
