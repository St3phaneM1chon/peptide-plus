'use client';

import { useState, useEffect } from 'react';
import { useI18n } from '@/i18n/client';
import {
  User,
  Mail,
  Phone,
  CalendarDays,
  Loader2,
} from 'lucide-react';

// ── Types ───────────────────────────────────────────────────────

interface AgentInfo {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  role: string;
  createdAt: string;
  image?: string | null;
}

interface RepProfileHeaderProps {
  agentId: string;
}

// ── Avatar color palette ────────────────────────────────────────

const AVATAR_COLORS = [
  'bg-cyan-600',
  'bg-emerald-600',
  'bg-violet-600',
  'bg-amber-600',
  'bg-rose-600',
  'bg-indigo-600',
  'bg-teal-600',
  'bg-orange-600',
] as const;

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((part) => part.charAt(0).toUpperCase())
    .slice(0, 2)
    .join('');
}

// ── Role badge ──────────────────────────────────────────────────

function RoleBadge({ role }: { role: string }) {
  const colorMap: Record<string, string> = {
    EMPLOYEE: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    OWNER: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
    ADMIN: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    MANAGER: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  };
  const colors = colorMap[role] ?? 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors}`}>
      {role}
    </span>
  );
}

// ── Component ───────────────────────────────────────────────────

export default function RepProfileHeader({ agentId }: RepProfileHeaderProps) {
  const { t } = useI18n();
  const [agent, setAgent] = useState<AgentInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchAgent() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/admin/crm/reps?id=${agentId}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!cancelled) {
          // API may return a single agent or array
          const agentData = Array.isArray(data) ? data.find((a: AgentInfo) => a.id === agentId) : data;
          setAgent(agentData ?? null);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load agent');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchAgent();
    return () => { cancelled = true; };
  }, [agentId]);

  // Loading state
  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
        <span className="ml-2 text-gray-500 dark:text-gray-400">{t('common.loading') || 'Loading...'}</span>
      </div>
    );
  }

  // Error state
  if (error || !agent) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6">
        <div className="flex items-center text-red-500">
          <User className="w-5 h-5 mr-2" />
          <span>{error || t('common.notFound') || 'Agent not found'}</span>
        </div>
      </div>
    );
  }

  const memberSince = new Date(agent.createdAt).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6">
      <div className="flex items-center gap-5">
        {/* Avatar */}
        <div
          className={`flex-shrink-0 w-16 h-16 rounded-full ${getAvatarColor(agent.name)} flex items-center justify-center text-white text-xl font-bold`}
        >
          {getInitials(agent.name)}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 truncate">
              {agent.name}
            </h2>
            <RoleBadge role={agent.role} />
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-gray-500 dark:text-gray-400">
            <span className="inline-flex items-center gap-1.5">
              <Mail className="w-4 h-4" />
              {agent.email}
            </span>

            {agent.phone && (
              <span className="inline-flex items-center gap-1.5">
                <Phone className="w-4 h-4" />
                {agent.phone}
              </span>
            )}

            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="w-4 h-4" />
              {t('admin.crm.memberSince') || 'Member since'} {memberSince}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
