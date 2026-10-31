/**
 * REVORA – Sidebar Context.
 * Provides sidebar state to all child components without prop-drilling.
 */

import React, { createContext, useContext, ReactNode } from 'react';
import { useSidebar } from '@/hooks/useSidebar';

interface SidebarContextValue {
  collapsed: boolean;
  toggle: () => void;
  mobileOpen: boolean;
  openMobile: () => void;
  closeMobile: () => void;
  toggleMobile: () => void;
}

const SidebarContext = createContext<SidebarContextValue | null>(null);

export function SidebarProvider({ children }: { children: ReactNode }) {
  const sidebar = useSidebar();
  return (
    <SidebarContext.Provider value={sidebar}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebarContext(): SidebarContextValue {
  const ctx = useContext(SidebarContext);
  if (!ctx) throw new Error('useSidebarContext must be used inside SidebarProvider');
  return ctx;
}
