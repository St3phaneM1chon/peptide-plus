'use client';

/**
 * ContactCard - Rich contact display during calls
 * Shows: photo, name, company, call history, active deals, notes, timeline.
 */

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import {
  User,
  Building2,
  Phone,
  Mail,
  TrendingUp,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  ExternalLink,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────

interface CallHistoryItem {
  id: string;
  date: string;
  duration: number;
  direction: 'inbound' | 'outbound';
  status: string;
  disposition?: string;
}

interface DealInfo {
  id: string;
  title: string;
  value: number;
  stage: string;
  probability: number;
}

interface ContactData {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  title?: string;
  photoUrl?: string;
  entityType: 'lead' | 'deal' | 'customer';
  entityId: string;
  totalCalls: number;
  lastCallDate?: string;
  callHistory: CallHistoryItem[];
  deals: DealInfo[];
  notes?: string;
  tags: string[];
  createdAt: string;
}

interface ContactCardProps {
  entityType: 'lead' | 'deal' | 'customer';
  entityId: string;
  phone?: string;
  compact?: boolean;
  className?: string;
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function ContactCard({
  entityType,
  entityId,
  phone,
  compact = false,
  className = '',
}: ContactCardProps) {
  const [contact, setContact] = useState<ContactData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  // ─── Fetch Contact Data ──────────────────────────────────────────

  const fetchContact = useCallback(async () => {
    setLoading(true);
    try {
      // Try to fetch from CRM leads API
      const searchParam = entityId || phone || '';
      const res = await fetch(
        `/api/admin/crm/leads/${encodeURIComponent(searchParam)}`
      );
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          const lead = json.data;
          setContact({
            id: lead.id,
            name: lead.contactName ?? lead.company ?? 'Unknown',
            email: lead.email,
            phone: lead.phone ?? phone,
            company: lead.company,
            title: lead.title,
            entityType,
            entityId: lead.id,
            totalCalls: lead._count?.activities ?? 0,
            lastCallDate: lead.lastContactedAt,
            callHistory: [],
            deals: (lead.deals ?? []).map((d: { id: string; title: string; value: number; stage: string; probability: number }) => ({
              id: d.id,
              title: d.title,
              value: d.value,
              stage: d.stage,
              probability: d.probability,
            })),
            notes: lead.notes,
            tags: lead.tags ?? [],
            createdAt: lead.createdAt,
            photoUrl: undefined,
          });
        }
      }
    } catch {
      // Non-critical
    } finally {
      setLoading(false);
    }
  }, [entityId, entityType, phone]);

  useEffect(() => {
    fetchContact();
  }, [fetchContact]);

  // ─── Helpers ────────────────────────────────────────────────────

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(amount);
  };

  // ─── Loading ────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className={`animate-pulse bg-gray-50 dark:bg-gray-800 rounded-lg p-3 ${className}`}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-full" />
          <div className="flex-1">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24 mb-1" />
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-32" />
          </div>
        </div>
      </div>
    );
  }

  if (!contact) {
    return (
      <div className={`bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-center ${className}`}>
        <User className="w-6 h-6 text-gray-400 mx-auto mb-1" />
        <p className="text-xs text-gray-500">{phone ?? 'Unknown caller'}</p>
      </div>
    );
  }

  // ─── Compact Mode ─────────────────────────────────────────────

  if (compact) {
    return (
      <div className={`flex items-center gap-2 bg-gray-50 dark:bg-gray-800 rounded-lg p-2 ${className}`}>
        <div className="w-8 h-8 rounded-full bg-teal-100 dark:bg-teal-900 flex items-center justify-center text-sm font-medium text-teal-600 dark:text-teal-400">
          {contact.name.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{contact.name}</p>
          <p className="text-xs text-gray-500 truncate">{contact.company ?? contact.email}</p>
        </div>
        {contact.totalCalls > 0 && (
          <span className="text-xs text-gray-400">{contact.totalCalls} calls</span>
        )}
      </div>
    );
  }

  // ─── Full Mode ────────────────────────────────────────────────

  return (
    <div className={`bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden ${className}`}>
      {/* Header */}
      <div className="p-3 bg-gray-50 dark:bg-gray-800">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-teal-100 dark:bg-teal-900 flex items-center justify-center text-lg font-semibold text-teal-600 dark:text-teal-400 shrink-0">
            {contact.photoUrl ? (
              <Image src={contact.photoUrl} alt={contact.name} width={48} height={48} className="w-12 h-12 rounded-full object-cover" />
            ) : (
              contact.name.charAt(0).toUpperCase()
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{contact.name}</p>
            {contact.title && (
              <p className="text-xs text-gray-500 truncate">{contact.title}</p>
            )}
            {contact.company && (
              <p className="text-xs text-gray-500 flex items-center gap-1">
                <Building2 className="w-3 h-3" /> {contact.company}
              </p>
            )}
          </div>
          <div className="flex flex-col items-end gap-0.5">
            {contact.tags.slice(0, 2).map((tag) => (
              <span key={tag} className="text-[10px] px-1.5 py-0.5 bg-teal-50 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 rounded-full">
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Info */}
      <div className="px-3 py-2 grid grid-cols-3 gap-2 border-b border-gray-100 dark:border-gray-800 text-center">
        <div>
          <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{contact.totalCalls}</p>
          <p className="text-[10px] text-gray-500">Calls</p>
        </div>
        <div>
          <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{contact.deals.length}</p>
          <p className="text-[10px] text-gray-500">Deals</p>
        </div>
        <div>
          <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
            {contact.lastCallDate
              ? new Date(contact.lastCallDate).toLocaleDateString('fr-CA', { month: 'short', day: 'numeric' })
              : '—'}
          </p>
          <p className="text-[10px] text-gray-500">Last Call</p>
        </div>
      </div>

      {/* Contact details */}
      <div className="px-3 py-2 space-y-1">
        {contact.phone && (
          <p className="text-xs text-gray-600 dark:text-gray-400 flex items-center gap-1.5">
            <Phone className="w-3 h-3 text-gray-400" /> {contact.phone}
          </p>
        )}
        {contact.email && (
          <p className="text-xs text-gray-600 dark:text-gray-400 flex items-center gap-1.5">
            <Mail className="w-3 h-3 text-gray-400" /> {contact.email}
          </p>
        )}
      </div>

      {/* Expandable section */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-3 py-1.5 flex items-center justify-center gap-1 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 border-t border-gray-100 dark:border-gray-800 transition-colors"
      >
        {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        {expanded ? 'Less' : 'More details'}
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-3">
          {/* Active Deals */}
          {contact.deals.length > 0 && (
            <div>
              <h5 className="text-xs font-medium text-gray-500 mb-1 flex items-center gap-1">
                <TrendingUp className="w-3 h-3" /> Active Deals
              </h5>
              <div className="space-y-1">
                {contact.deals.map((deal) => (
                  <div key={deal.id} className="flex items-center justify-between bg-gray-50 dark:bg-gray-800 rounded-md px-2 py-1.5">
                    <div>
                      <p className="text-xs font-medium text-gray-700 dark:text-gray-300">{deal.title}</p>
                      <p className="text-[10px] text-gray-500">{deal.stage}</p>
                    </div>
                    <span className="text-xs font-medium text-green-600">{formatCurrency(deal.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          {contact.notes && (
            <div>
              <h5 className="text-xs font-medium text-gray-500 mb-1 flex items-center gap-1">
                <MessageSquare className="w-3 h-3" /> Notes
              </h5>
              <p className="text-xs text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 rounded-md p-2">
                {contact.notes.length > 200 ? contact.notes.substring(0, 200) + '...' : contact.notes}
              </p>
            </div>
          )}

          {/* View in CRM link */}
          <a
            href={`/admin/crm/leads/${contact.entityId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1 text-xs text-teal-600 hover:text-teal-700 transition-colors"
          >
            <ExternalLink className="w-3 h-3" />
            Open in CRM
          </a>
        </div>
      )}
    </div>
  );
}
