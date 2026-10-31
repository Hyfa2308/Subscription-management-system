/**
 * REVORA – Top navigation bar.
 * Shows page context, user info, and connection status.
 */

import React from 'react';
import { Bell, Search, User, ChevronDown } from 'lucide-react';
import { ConnectionStatusBadge } from '@/components/common/ConnectionStatusBadge';
import { cn } from '@/utils/cn';

interface TopbarProps {
  title?: string;
  className?: string;
}

export function Topbar({ title = 'Dashboard', className }: TopbarProps) {
  return (
    <header
      className={cn(
        'h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0',
        className,
      )}
    >
      {/* Left: page title */}
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-semibold text-slate-900">{title}</h1>
      </div>

      {/* Right: actions */}
      <div className="flex items-center gap-3">
        {/* Connection status */}
        <ConnectionStatusBadge />

        {/* Search – placeholder */}
        <button className="btn-ghost btn-sm btn hidden sm:flex" aria-label="Search">
          <Search className="w-4 h-4" />
        </button>

        {/* Notifications – placeholder */}
        <button className="btn-ghost btn-sm btn relative" aria-label="Notifications">
          <Bell className="w-4 h-4" />
          <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-red-500 rounded-full" />
        </button>

        {/* User menu – placeholder */}
        <button className="flex items-center gap-2 pl-3 border-l border-slate-200 hover:opacity-80 transition-opacity">
          <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center">
            <User className="w-4 h-4 text-indigo-600" />
          </div>
          <span className="hidden md:block text-sm font-medium text-slate-700">Admin</span>
          <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
        </button>
      </div>
    </header>
  );
}
