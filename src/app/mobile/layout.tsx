'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { LayoutDashboard, Receipt, Camera, Clock, Settings } from 'lucide-react';
import { useState, useEffect } from 'react';
import { isOnline, onOnlineStatusChange, registerServiceWorker } from '@/lib/accounting/pwa.service';

const NAV_ITEMS = [
  { href: '/mobile/dashboard', icon: LayoutDashboard, label: 'Tableau' },
  { href: '/mobile/expenses', icon: Receipt, label: 'Dépenses' },
  { href: '/mobile/receipt-capture', icon: Camera, label: 'Reçus' },
  { href: '/mobile/time-tracker', icon: Clock, label: 'Chrono' },
  { href: '/mobile/settings', icon: Settings, label: 'Plus' },
];

export default function MobileLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [online, setOnline] = useState(true);

  useEffect(() => {
    setOnline(isOnline());
    const unsub = onOnlineStatusChange(setOnline);
    registerServiceWorker();
    return unsub;
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Offline banner */}
      {!online && (
        <div className="bg-amber-500 text-white text-center text-sm py-1.5 px-4 font-medium">
          Mode hors-ligne — les modifications seront synchronisées
        </div>
      )}

      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between sticky top-0 z-40">
        <h1 className="text-lg font-bold text-purple-700">BioCycle Compta</h1>
        <div className={`w-2.5 h-2.5 rounded-full ${online ? 'bg-green-500' : 'bg-amber-500'}`} />
      </header>

      {/* Content */}
      <main className="px-4 py-4 max-w-lg mx-auto">
        {children}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50">
        <div className="flex justify-around items-center h-16 max-w-lg mx-auto">
          {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`flex flex-col items-center gap-0.5 py-1 px-3 rounded-lg transition-colors ${
                  active ? 'text-purple-700' : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                <Icon className={`w-5 h-5 ${active ? 'stroke-[2.5]' : ''}`} />
                <span className="text-[10px] font-medium">{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
