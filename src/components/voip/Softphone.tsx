'use client';

/**
 * Softphone
 * Main softphone component: fixed bar at the bottom of the admin dashboard.
 * Includes dialpad, call status, and controls.
 */

import { useState, useEffect } from 'react';
import {
  Phone, ChevronUp, ChevronDown,
} from 'lucide-react';
import { useI18n } from '@/i18n/client';
import { useSoftphone } from './SoftphoneProvider';
import CallControls from './CallControls';
import IncomingCallModal from './IncomingCallModal';
import AgentStatus from './AgentStatus';

const DIALPAD_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'];

export default function Softphone() {
  const { t } = useI18n();
  const {
    status,
    currentCall,
    error,
    register,
    unregister,
    makeCall,
    answerCall,
    hangup,
    toggleMute,
    toggleHold,
    sendDtmf,
    transfer,
  } = useSoftphone();

  const [isExpanded, setIsExpanded] = useState(false);
  const [dialNumber, setDialNumber] = useState('');
  const [callTimer, setCallTimer] = useState(0);

  // Call timer
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    if (currentCall?.state === 'in_progress' && currentCall.answerTime) {
      interval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - currentCall.answerTime!.getTime()) / 1000);
        setCallTimer(elapsed);
      }, 1000);
    } else {
      setCallTimer(0);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [currentCall?.state, currentCall?.answerTime]);

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleDial = () => {
    if (dialNumber.length > 0) {
      makeCall(dialNumber);
      setDialNumber('');
    }
  };

  // Show incoming call modal
  if (currentCall?.direction === 'inbound' && currentCall.state === 'ringing') {
    return (
      <IncomingCallModal
        call={currentCall}
        onAnswer={answerCall}
        onReject={hangup}
      />
    );
  }

  return (
    <div className="fixed bottom-0 start-0 end-0 z-50 pointer-events-none">
      <div className="max-w-md mx-auto pointer-events-auto">
        {/* Softphone Bar */}
        <div className={`bg-white border border-gray-200 rounded-t-xl shadow-2xl transition-all duration-300 ${isExpanded ? 'pb-4' : ''}`}>
          {/* Header bar */}
          <div
            className="flex items-center justify-between px-4 py-2 cursor-pointer hover:bg-gray-50 rounded-t-xl"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            <div className="flex items-center gap-3">
              {/* Connection status dot */}
              <span className={`w-2.5 h-2.5 rounded-full ${
                status === 'registered' ? 'bg-emerald-500' :
                status === 'connecting' ? 'bg-yellow-500 animate-pulse' :
                status === 'error' ? 'bg-red-500' :
                'bg-gray-400'
              }`} />

              {/* Call state or phone label */}
              {currentCall ? (
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-emerald-600 animate-pulse" />
                  <span className="text-sm font-medium">
                    {currentCall.remoteNumber}
                  </span>
                  {currentCall.state === 'in_progress' && (
                    <span className="text-xs text-gray-500 tabular-nums">{formatTimer(callTimer)}</span>
                  )}
                  {currentCall.state === 'calling' && (
                    <span className="text-xs text-yellow-600">{t('voip.call.dialing')}...</span>
                  )}
                </div>
              ) : (
                <span className="text-sm text-gray-600">{t('voip.softphone.title')}</span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {status === 'registered' && <AgentStatus initialStatus="ONLINE" />}
              {isExpanded ? (
                <ChevronDown className="w-4 h-4 text-gray-400" />
              ) : (
                <ChevronUp className="w-4 h-4 text-gray-400" />
              )}
            </div>
          </div>

          {/* Expanded content */}
          {isExpanded && (
            <div className="px-4 pt-2">
              {/* Connection controls */}
              {status === 'disconnected' && (
                <button
                  onClick={register}
                  className="w-full py-2 bg-sky-500 text-white rounded-lg text-sm font-medium hover:bg-sky-600 transition-colors mb-3"
                >
                  {t('voip.softphone.connect')}
                </button>
              )}

              {status === 'connecting' && (
                <div className="text-center text-sm text-yellow-600 py-2 mb-3">
                  {t('voip.softphone.connecting')}...
                </div>
              )}

              {error && (
                <div className="text-center text-sm text-red-600 py-2 mb-3">
                  {error}
                </div>
              )}

              {/* Active call controls */}
              {currentCall && currentCall.state !== 'ended' && (
                <CallControls
                  call={currentCall}
                  onMute={toggleMute}
                  onHold={toggleHold}
                  onHangup={hangup}
                  onDtmf={sendDtmf}
                  onTransfer={transfer}
                />
              )}

              {/* Dialpad (when no active call and registered) */}
              {!currentCall && status === 'registered' && (
                <div>
                  {/* Number input */}
                  <div className="flex items-center gap-2 mb-3">
                    <input
                      type="text"
                      value={dialNumber}
                      onChange={(e) => setDialNumber(e.target.value.replace(/[^0-9+*#]/g, ''))}
                      onKeyDown={(e) => e.key === 'Enter' && handleDial()}
                      placeholder={t('voip.softphone.enterNumber')}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-center text-lg font-mono focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                    <button
                      onClick={handleDial}
                      disabled={!dialNumber}
                      className="p-2.5 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <Phone className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Dialpad grid */}
                  <div className="grid grid-cols-3 gap-1.5 max-w-[220px] mx-auto">
                    {DIALPAD_KEYS.map((key) => (
                      <button
                        key={key}
                        onClick={() => setDialNumber((prev) => prev + key)}
                        className="w-full h-11 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium text-lg transition-colors active:bg-gray-300"
                      >
                        {key}
                      </button>
                    ))}
                  </div>

                  {/* Disconnect */}
                  <button
                    onClick={unregister}
                    className="w-full mt-3 py-1.5 text-sm text-gray-500 hover:text-red-600 transition-colors"
                  >
                    {t('voip.softphone.disconnect')}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
