'use client';

import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from 'react';

interface AdminLayoutState {
  activeRailId: string;
  folderPaneOpen: boolean;
  selectedItemId: string | null;
  searchQuery: string;
  // Methods
  setActiveRail: (id: string) => void;
  toggleFolderPane: () => void;
  setFolderPaneOpen: (open: boolean) => void;
  selectItem: (id: string | null) => void;
  setSearchQuery: (q: string) => void;
}

const AdminLayoutContext = createContext<AdminLayoutState | null>(null);

export function AdminLayoutProvider({
  children,
  initialRailId = 'dashboard',
}: {
  children: ReactNode;
  initialRailId?: string;
}) {
  const [activeRailId, setActiveRailId] = useState(initialRailId);
  const [folderPaneOpen, setFolderPaneOpenState] = useState(initialRailId !== 'dashboard');
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const setActiveRail = useCallback((id: string) => {
    setActiveRailId(id);
    setSelectedItemId(null);
  }, []);

  const toggleFolderPane = useCallback(() => {
    setFolderPaneOpenState(prev => !prev);
  }, []);

  const setFolderPaneOpen = useCallback((open: boolean) => {
    setFolderPaneOpenState(open);
  }, []);

  const selectItem = useCallback((id: string | null) => {
    setSelectedItemId(id);
  }, []);

  const value = useMemo(() => ({
    activeRailId,
    folderPaneOpen,
    selectedItemId,
    searchQuery,
    setActiveRail,
    toggleFolderPane,
    setFolderPaneOpen,
    selectItem,
    setSearchQuery,
  }), [activeRailId, folderPaneOpen, selectedItemId, searchQuery, setActiveRail, toggleFolderPane, setFolderPaneOpen, selectItem]);

  return (
    <AdminLayoutContext.Provider value={value}>
      {children}
    </AdminLayoutContext.Provider>
  );
}

export function useAdminLayout(): AdminLayoutState {
  const ctx = useContext(AdminLayoutContext);
  if (!ctx) throw new Error('useAdminLayout must be used within AdminLayoutProvider');
  return ctx;
}
