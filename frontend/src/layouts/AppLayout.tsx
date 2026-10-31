/**
 * REVORA – AppLayout
 * Main authenticated shell: sidebar + topbar + content area.
 */

import React from 'react';
import { Outlet } from 'react-router-dom';
import { SidebarProvider } from '@/context/SidebarContext';
import { AppSidebar, MobileSidebar } from '@/components/layout/AppSidebar';
import { TopNavbar } from '@/components/layout/TopNavbar';
import { useSidebarContext } from '@/context/SidebarContext';

function LayoutInner() {
  return (
    <div className="flex h-screen overflow-hidden bg-[#F8FAFC]">
      {/* Desktop sidebar */}
      <div className="hidden lg:flex flex-shrink-0">
        <AppSidebar />
      </div>

      {/* Mobile drawer */}
      <MobileSidebar />

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopNavbar />

        <main className="flex-1 overflow-y-auto scrollbar-thin">
          <div className="px-4 sm:px-6 py-6 max-w-screen-2xl mx-auto animate-fade-in">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

export function AppLayout() {
  return (
    <SidebarProvider>
      <LayoutInner />
    </SidebarProvider>
  );
}
