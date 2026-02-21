'use client';

import { useState, useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { Toaster } from 'sonner';
import CsrfInit from '@/components/admin/CsrfInit';
import { IconRail, FolderPane, OutlookTopBar } from '@/components/admin/outlook';
import { AdminLayoutProvider, useAdminLayout } from '@/lib/admin/admin-layout-context';
import { getActiveRailId } from '@/lib/admin/outlook-nav';
import { useI18n } from '@/i18n/client';

export default function AdminLayoutClient({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const initialRailId = getActiveRailId(pathname);

  return (
    <AdminLayoutProvider initialRailId={initialRailId}>
      <AdminLayoutShell>{children}</AdminLayoutShell>
    </AdminLayoutProvider>
  );
}

function AdminLayoutShell({ children }: { children: React.ReactNode }) {
  const { folderPaneOpen, toggleFolderPane, setActiveRail } = useAdminLayout();
  const { t, dir } = useI18n();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Sync rail selection with pathname on navigation
  useEffect(() => {
    setActiveRail(getActiveRailId(pathname));
  }, [pathname, setActiveRail]);

  // Close mobile menu on navigation
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  // Keyboard shortcuts: Escape, Ctrl+B (toggle folder), Ctrl+K (focus search)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && mobileMenuOpen) {
        setMobileMenuOpen(false);
        return;
      }
      // Ctrl+B or Cmd+B → toggle folder pane
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault();
        toggleFolderPane();
        return;
      }
      // Ctrl+K or Cmd+K → focus search
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        const searchInput = document.querySelector<HTMLInputElement>('.admin-outlook input[type="text"]');
        searchInput?.focus();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [mobileMenuOpen, toggleFolderPane]);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  const handleToggleMobileMenu = useCallback(() => {
    setMobileMenuOpen((prev) => !prev);
  }, []);

  const handleCloseMobileMenu = useCallback(() => {
    setMobileMenuOpen(false);
  }, []);

  return (
    <div className="admin-outlook min-h-screen bg-slate-50">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:start-2 focus:z-[100] focus:bg-white focus:text-sky-700 focus:px-4 focus:py-2 focus:rounded-lg focus:shadow-lg focus:ring-2 focus:ring-sky-500"
      >
        {t('admin.skipToContent')}
      </a>
      <CsrfInit />

      {/* Top bar - 48px height */}
      <OutlookTopBar onMobileMenuToggle={handleToggleMobileMenu} />

      {/* Mobile overlay backdrop */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={handleCloseMobileMenu}
          aria-hidden="true"
        />
      )}

      {/* Main layout: IconRail + FolderPane + Content */}
      <div className="flex" style={{ height: 'calc(100vh - 48px)' }}>
        {/* Icon Rail - always visible on desktop, hidden on mobile */}
        <div className="hidden lg:block">
          <IconRail />
        </div>

        {/* Folder Pane - desktop: animated, mobile: overlay */}
        <div
          className={`hidden lg:block transition-all duration-200 ease-out overflow-hidden ${
            folderPaneOpen ? 'w-[260px]' : 'w-0'
          }`}
        >
          <FolderPane />
        </div>

        {/* Mobile folder pane (overlay) */}
        {mobileMenuOpen && (
          <aside
            className="fixed top-12 start-0 bottom-0 z-50 flex lg:hidden"
            role="navigation"
            aria-label="Admin navigation"
          >
            <IconRail />
            <FolderPane />
          </aside>
        )}

        {/* Main content area */}
        <main id="main-content" className="flex-1 overflow-y-auto outlook-scroll">
          <div className="p-4 lg:p-6">
            {children}
          </div>
        </main>
      </div>

      <Toaster position={dir === 'rtl' ? 'top-left' : 'top-right'} richColors closeButton dir={dir} />
    </div>
  );
}
