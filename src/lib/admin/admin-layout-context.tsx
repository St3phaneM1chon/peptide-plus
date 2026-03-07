'use client';

import { createContext, useContext, useState, useCallback, useEffect, useMemo, type ReactNode } from 'react';

export type DensityMode = 'compact' | 'standard' | 'focus';

interface AdminLayoutState {
  activeRailId: string;
  folderPaneOpen: boolean;
  selectedItemId: string | null;
  searchQuery: string;
  density: DensityMode;
  // Methods
  setActiveRail: (id: string) => void;
  toggleFolderPane: () => void;
  setFolderPaneOpen: (open: boolean) => void;
  selectItem: (id: string | null) => void;
  setSearchQuery: (q: string) => void;
  setDensity: (d: DensityMode) => void;
}

const AdminLayoutContext = createContext<AdminLayoutState | null>(null);

const DENSITY_KEY = 'admin-density';
const VALID_DENSITIES: DensityMode[] = ['compact', 'standard', 'focus'];

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
  const [density, setDensityState] = useState<DensityMode>('standard');

  // Load density preference from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(DENSITY_KEY);
    if (stored && VALID_DENSITIES.includes(stored as DensityMode)) {
      setDensityState(stored as DensityMode);
      document.documentElement.dataset.density = stored;
    } else {
      document.documentElement.dataset.density = 'standard';
    }
  }, []);

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

  const setDensity = useCallback((d: DensityMode) => {
    setDensityState(d);
    localStorage.setItem(DENSITY_KEY, d);
    document.documentElement.dataset.density = d;
  }, []);

  const value = useMemo(() => ({
    activeRailId,
    folderPaneOpen,
    selectedItemId,
    searchQuery,
    density,
    setActiveRail,
    toggleFolderPane,
    setFolderPaneOpen,
    selectItem,
    setSearchQuery,
    setDensity,
  }), [activeRailId, folderPaneOpen, selectedItemId, searchQuery, density, setActiveRail, toggleFolderPane, setFolderPaneOpen, selectItem, setDensity]);

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
