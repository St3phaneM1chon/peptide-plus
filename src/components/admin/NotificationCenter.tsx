'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Bell, Package, AlertTriangle, Star, ShoppingCart, X, CheckCheck } from 'lucide-react';

export interface AdminNotification {
  id: string;
  type: 'order' | 'stock' | 'review' | 'error' | 'system';
  title: string;
  message: string;
  link?: string;
  read: boolean;
  createdAt: Date;
}

const typeIcons: Record<string, React.ReactNode> = {
  order: <ShoppingCart className="w-4 h-4 text-blue-500" />,
  stock: <Package className="w-4 h-4 text-orange-500" />,
  review: <Star className="w-4 h-4 text-yellow-500" />,
  error: <AlertTriangle className="w-4 h-4 text-red-500" />,
  system: <Bell className="w-4 h-4 text-slate-500" />,
};

const typeBg: Record<string, string> = {
  order: 'bg-blue-500/5',
  stock: 'bg-orange-500/5',
  review: 'bg-yellow-500/5',
  error: 'bg-red-500/5',
  system: 'bg-white/5',
};

export default function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const ref = useRef<HTMLDivElement>(null);

  // Sample notifications - in production these come from API/SSE
  useEffect(() => {
    setNotifications([
      { id: '1', type: 'order', title: 'Nouvelle commande', message: 'Commande #1247 - $234.50', read: false, createdAt: new Date() },
      { id: '2', type: 'stock', title: 'Stock bas', message: 'BPC-157 5mg: 3 restants', read: false, createdAt: new Date(Date.now() - 3600000) },
      { id: '3', type: 'review', title: 'Nouvel avis', message: '5 étoiles sur TB-500', read: true, createdAt: new Date(Date.now() - 7200000) },
    ]);
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const filtered = filter === 'all' ? notifications : notifications.filter((n) => n.type === filter);

  const markAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const dismiss = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const timeAgo = (date: Date) => {
    const mins = Math.floor((Date.now() - date.getTime()) / 60000);
    if (mins < 1) return 'À l\'instant';
    if (mins < 60) return `${mins}min`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    return `${Math.floor(hrs / 24)}j`;
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative p-1.5 text-[var(--k-text-tertiary)] hover:text-[var(--k-text-secondary)] hover:bg-[var(--k-glass-thin)] rounded-md transition-colors"
        aria-label="Notifications"
      >
        <Bell className="w-4.5 h-4.5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -end-0.5 min-w-[16px] h-4 bg-gradient-to-r from-rose-500 to-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute end-0 top-full mt-2 w-96 bg-[var(--k-bg-surface-overlay)] backdrop-blur-xl rounded-xl shadow-2xl border border-[var(--k-border-default)] z-50 max-h-[480px] flex flex-col">
          <div className="px-4 py-3 border-b border-[var(--k-border-subtle)] flex items-center justify-between">
            <h3 className="font-semibold text-[var(--k-text-primary)]">Notifications</h3>
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="text-xs text-[#818cf8] hover:text-[#a5b4fc] flex items-center gap-1">
                <CheckCheck className="w-3.5 h-3.5" /> Tout marquer lu
              </button>
            )}
          </div>

          <div className="px-3 py-2 border-b border-[var(--k-border-subtle)] flex gap-1 overflow-x-auto">
            {['all', 'order', 'stock', 'review', 'error'].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-2.5 py-1 text-xs rounded-full whitespace-nowrap transition-colors ${
                  filter === f ? 'bg-[#6366f1]/20 text-[#818cf8] font-medium' : 'text-[var(--k-text-tertiary)] hover:bg-[var(--k-glass-thin)]'
                }`}
              >
                {f === 'all' ? 'Tout' : f === 'order' ? 'Commandes' : f === 'stock' ? 'Stock' : f === 'review' ? 'Avis' : 'Erreurs'}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="py-8 text-center text-[var(--k-text-muted)] text-sm">Aucune notification</div>
            ) : (
              filtered.map((n) => (
                <div
                  key={n.id}
                  className={`px-4 py-3 border-b border-[var(--k-border-subtle)] flex items-start gap-3 hover:bg-[var(--k-glass-thin)] transition-colors ${
                    !n.read ? typeBg[n.type] : ''
                  }`}
                >
                  <div className="mt-0.5">{typeIcons[n.type]}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={`text-sm ${!n.read ? 'font-semibold text-[var(--k-text-primary)]' : 'text-[var(--k-text-secondary)]'}`}>{n.title}</p>
                      {!n.read && <span className="w-2 h-2 bg-[#6366f1] rounded-full flex-shrink-0" />}
                    </div>
                    <p className="text-xs text-[var(--k-text-tertiary)] truncate">{n.message}</p>
                    <p className="text-[10px] text-[var(--k-text-muted)] mt-0.5">{timeAgo(n.createdAt)}</p>
                  </div>
                  <button onClick={() => dismiss(n.id)} className="p-1 text-[var(--k-text-muted)] hover:text-[var(--k-text-tertiary)] rounded">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
