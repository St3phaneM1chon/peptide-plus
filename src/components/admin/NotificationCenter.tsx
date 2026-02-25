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
  order: 'bg-blue-50',
  stock: 'bg-orange-50',
  review: 'bg-yellow-50',
  error: 'bg-red-50',
  system: 'bg-slate-50',
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
        className="relative p-2 text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute end-0 top-full mt-2 w-96 bg-white rounded-xl shadow-xl border border-slate-200 z-50 max-h-[480px] flex flex-col">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-semibold text-slate-800">Notifications</h3>
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="text-xs text-sky-600 hover:text-sky-800 flex items-center gap-1">
                <CheckCheck className="w-3.5 h-3.5" /> Tout marquer lu
              </button>
            )}
          </div>

          <div className="px-3 py-2 border-b border-slate-100 flex gap-1 overflow-x-auto">
            {['all', 'order', 'stock', 'review', 'error'].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-2.5 py-1 text-xs rounded-full whitespace-nowrap transition-colors ${
                  filter === f ? 'bg-sky-100 text-sky-700 font-medium' : 'text-slate-500 hover:bg-slate-100'
                }`}
              >
                {f === 'all' ? 'Tout' : f === 'order' ? 'Commandes' : f === 'stock' ? 'Stock' : f === 'review' ? 'Avis' : 'Erreurs'}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-sm">Aucune notification</div>
            ) : (
              filtered.map((n) => (
                <div
                  key={n.id}
                  className={`px-4 py-3 border-b border-slate-50 flex items-start gap-3 hover:bg-slate-50 transition-colors ${
                    !n.read ? typeBg[n.type] : ''
                  }`}
                >
                  <div className="mt-0.5">{typeIcons[n.type]}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={`text-sm ${!n.read ? 'font-semibold text-slate-800' : 'text-slate-600'}`}>{n.title}</p>
                      {!n.read && <span className="w-2 h-2 bg-sky-500 rounded-full flex-shrink-0" />}
                    </div>
                    <p className="text-xs text-slate-500 truncate">{n.message}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">{timeAgo(n.createdAt)}</p>
                  </div>
                  <button onClick={() => dismiss(n.id)} className="p-1 text-slate-300 hover:text-slate-500 rounded">
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
