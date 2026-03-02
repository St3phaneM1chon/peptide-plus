'use client';

/**
 * AgentStatus
 * Dropdown to select agent availability status (Online, Busy, DND, Away, Offline).
 * Updates SIP extension status via API.
 */

import { useState, useCallback } from 'react';
import { Phone, PhoneOff, Ban, Coffee } from 'lucide-react';
import { useI18n } from '@/i18n/client';

type Status = 'ONLINE' | 'BUSY' | 'DND' | 'AWAY' | 'OFFLINE';

interface AgentStatusProps {
  initialStatus?: Status;
  onStatusChange?: (status: Status) => void;
}

const STATUS_CONFIG: Record<Status, { color: string; bg: string; icon: typeof Phone; labelKey: string }> = {
  ONLINE: { color: 'text-emerald-600', bg: 'bg-emerald-100', icon: Phone, labelKey: 'voip.status.online' },
  BUSY: { color: 'text-red-600', bg: 'bg-red-100', icon: Phone, labelKey: 'voip.status.busy' },
  DND: { color: 'text-orange-600', bg: 'bg-orange-100', icon: Ban, labelKey: 'voip.status.dnd' },
  AWAY: { color: 'text-yellow-600', bg: 'bg-yellow-100', icon: Coffee, labelKey: 'voip.status.away' },
  OFFLINE: { color: 'text-gray-500', bg: 'bg-gray-100', icon: PhoneOff, labelKey: 'voip.status.offline' },
};

export default function AgentStatus({ initialStatus = 'OFFLINE', onStatusChange }: AgentStatusProps) {
  const { t } = useI18n();
  const [status, setStatus] = useState<Status>(initialStatus);
  const [isOpen, setIsOpen] = useState(false);

  const handleChange = useCallback(async (newStatus: Status) => {
    setStatus(newStatus);
    setIsOpen(false);

    // Update via API
    try {
      await fetch('/api/admin/voip/extensions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update-status', status: newStatus }),
      });
      onStatusChange?.(newStatus);
    } catch {
      // Revert on error
      setStatus(status);
    }
  }, [status, onStatusChange]);

  const config = STATUS_CONFIG[status];
  const Icon = config.icon;

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${config.bg} ${config.color} hover:opacity-80 transition-opacity`}
      >
        <span className={`w-2 h-2 rounded-full ${status === 'ONLINE' ? 'bg-emerald-500 animate-pulse' : status === 'BUSY' ? 'bg-red-500' : status === 'DND' ? 'bg-orange-500' : status === 'AWAY' ? 'bg-yellow-500' : 'bg-gray-400'}`} />
        <Icon className="w-3.5 h-3.5" />
        <span>{t(config.labelKey)}</span>
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute top-full mt-1 end-0 z-50 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[160px]">
            {(Object.keys(STATUS_CONFIG) as Status[]).map((s) => {
              const c = STATUS_CONFIG[s];
              const SIcon = c.icon;
              return (
                <button
                  key={s}
                  onClick={() => handleChange(s)}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 ${s === status ? 'font-medium' : ''} ${c.color}`}
                >
                  <SIcon className="w-4 h-4" />
                  <span>{t(c.labelKey)}</span>
                  {s === status && <span className="ms-auto text-xs">&#10003;</span>}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
