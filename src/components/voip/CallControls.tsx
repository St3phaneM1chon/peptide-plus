'use client';

/**
 * CallControls
 * In-call control buttons: mute, hold, DTMF keypad, transfer, hangup.
 */

import { useState } from 'react';
import {
  Mic, MicOff, Pause, Play, PhoneOff, PhoneForwarded,
  Hash, X,
} from 'lucide-react';
import { useI18n } from '@/i18n/client';
import type { VoipCall } from '@/hooks/useVoip';

interface CallControlsProps {
  call: VoipCall;
  onMute: () => void;
  onHold: () => void;
  onHangup: () => void;
  onDtmf: (digit: string) => void;
  onTransfer: (number: string) => void;
}

const DTMF_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'];

export default function CallControls({
  call,
  onMute,
  onHold,
  onHangup,
  onDtmf,
  onTransfer,
}: CallControlsProps) {
  const { t } = useI18n();
  const [showKeypad, setShowKeypad] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [transferNumber, setTransferNumber] = useState('');

  return (
    <div className="flex flex-col gap-2">
      {/* Main controls */}
      <div className="flex items-center justify-center gap-3">
        {/* Mute */}
        <button
          onClick={onMute}
          className={`p-3 rounded-full transition-colors ${
            call.isMuted
              ? 'bg-red-100 text-red-600 hover:bg-red-200'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
          title={call.isMuted ? t('voip.call.unmute') : t('voip.call.mute')}
        >
          {call.isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        </button>

        {/* Hold */}
        <button
          onClick={onHold}
          className={`p-3 rounded-full transition-colors ${
            call.isOnHold
              ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
          title={call.isOnHold ? t('voip.call.resume') : t('voip.call.hold')}
        >
          {call.isOnHold ? <Play className="w-5 h-5" /> : <Pause className="w-5 h-5" />}
        </button>

        {/* DTMF Keypad */}
        <button
          onClick={() => { setShowKeypad(!showKeypad); setShowTransfer(false); }}
          className={`p-3 rounded-full transition-colors ${
            showKeypad ? 'bg-sky-100 text-sky-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
          title={t('voip.call.keypad')}
        >
          <Hash className="w-5 h-5" />
        </button>

        {/* Transfer */}
        <button
          onClick={() => { setShowTransfer(!showTransfer); setShowKeypad(false); }}
          className={`p-3 rounded-full transition-colors ${
            showTransfer ? 'bg-sky-100 text-sky-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
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

      {/* DTMF Keypad */}
      {showKeypad && (
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

      {/* Transfer */}
      {showTransfer && (
        <div className="flex items-center gap-2 mt-2 max-w-[240px] mx-auto">
          <input
            type="text"
            value={transferNumber}
            onChange={(e) => setTransferNumber(e.target.value)}
            placeholder={t('voip.call.transferTo')}
            className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
          <button
            onClick={() => {
              if (transferNumber) {
                onTransfer(transferNumber);
                setTransferNumber('');
                setShowTransfer(false);
              }
            }}
            className="px-3 py-1.5 bg-sky-500 text-white rounded-lg text-sm hover:bg-sky-600"
          >
            {t('voip.call.transferBtn')}
          </button>
          <button onClick={() => setShowTransfer(false)} className="p-1.5 text-gray-500 hover:text-gray-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
