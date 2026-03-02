'use client';

/**
 * IncomingCallModal
 * Popup shown when an incoming call is detected.
 * Shows caller ID info and client lookup.
 */

import { useEffect, useState } from 'react';
import { Phone, PhoneOff, User } from 'lucide-react';
import { useI18n } from '@/i18n/client';
import type { VoipCall } from '@/hooks/useVoip';

interface IncomingCallModalProps {
  call: VoipCall;
  onAnswer: () => void;
  onReject: () => void;
}

interface CallerInfo {
  name: string | null;
  email: string | null;
  isClient: boolean;
}

export default function IncomingCallModal({ call, onAnswer, onReject }: IncomingCallModalProps) {
  const { t } = useI18n();
  const [callerInfo, setCallerInfo] = useState<CallerInfo | null>(null);

  // Lookup caller in CRM
  useEffect(() => {
    if (call.remoteNumber) {
      fetch(`/api/admin/voip/call-logs?search=${encodeURIComponent(call.remoteNumber)}&limit=1`)
        .then((res) => res.json())
        .then((data) => {
          const recent = data.callLogs?.[0];
          if (recent?.client) {
            setCallerInfo({
              name: recent.client.name,
              email: recent.client.email,
              isClient: true,
            });
          }
        })
        .catch(() => {});
    }
  }, [call.remoteNumber]);

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-[340px] animate-bounce-gentle">
        {/* Caller Info */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 rounded-full bg-sky-100 flex items-center justify-center mx-auto mb-3">
            <User className="w-8 h-8 text-sky-600" />
          </div>

          <div className="text-lg font-semibold text-gray-900">
            {call.remoteName || callerInfo?.name || t('voip.call.unknownCaller')}
          </div>
          <div className="text-sm text-gray-500 mt-1">
            {call.remoteNumber}
          </div>

          {callerInfo?.isClient && (
            <div className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs font-medium rounded-full">
              {t('voip.call.existingClient')}
            </div>
          )}

          <div className="text-sm text-gray-400 mt-2 animate-pulse">
            {t('voip.call.incomingCall')}...
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-center gap-6">
          <button
            onClick={onReject}
            className="w-16 h-16 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 transition-colors shadow-lg"
            title={t('voip.call.reject')}
          >
            <PhoneOff className="w-7 h-7" />
          </button>

          <button
            onClick={onAnswer}
            className="w-16 h-16 rounded-full bg-emerald-500 text-white flex items-center justify-center hover:bg-emerald-600 transition-colors shadow-lg animate-pulse"
            title={t('voip.call.answer')}
          >
            <Phone className="w-7 h-7" />
          </button>
        </div>
      </div>
    </div>
  );
}
