/**
 * REVORA – useSidebar hook.
 * Manages sidebar collapsed/expanded state with localStorage persistence.
 */

import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'revora_sidebar_collapsed';

export function useSidebar() {
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'false');
    } catch {
      return false;
    }
  });

  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(collapsed));
  }, [collapsed]);

  // Close mobile sidebar on resize to desktop
  useEffect(() => {
    const handler = () => {
      if (window.innerWidth >= 1024) setMobileOpen(false);
    };
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  const toggle        = useCallback(() => setCollapsed((c) => !c), []);
  const openMobile    = useCallback(() => setMobileOpen(true), []);
  const closeMobile   = useCallback(() => setMobileOpen(false), []);
  const toggleMobile  = useCallback(() => setMobileOpen((o) => !o), []);

  return { collapsed, toggle, mobileOpen, openMobile, closeMobile, toggleMobile };
}
