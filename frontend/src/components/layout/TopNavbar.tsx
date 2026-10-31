/**
 * REVORA – TopNavbar
 * Full top navigation bar with sidebar toggle, breadcrumbs,
 * search, notifications dropdown, and profile dropdown.
 */

import React, { useState, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Menu,
  Search,
  Bell,
  ChevronDown,
  UserCircle,
  Settings,
  LogOut,
  HelpCircle,
  X,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/utils/cn';
import { useClickOutside } from '@/hooks/useClickOutside';
import { useSidebarContext } from '@/context/SidebarContext';
import { useAuth } from '@/context/AuthContext';
import { ROLE_LABELS } from '@/types/auth';
import { ROUTES } from '@/config/routes';

// ── Breadcrumbs ────────────────────────────────────────────────────────────────

const ROUTE_LABELS: Record<string, string> = {
  '/':                      'Overview',
  '/customers':             'Customers',
  '/products':              'Products',
  '/plans':                 'Subscription Plans',
  '/quotations':            'Quotations',
  '/subscriptions':         'Subscriptions',
  '/invoices':              'Invoices',
  '/discounts':             'Discounts',
  '/payments':              'Payments',
  '/customer-intelligence': 'Customer Intelligence',
  '/revenue-intelligence':  'Revenue Intelligence',
  '/revenue-rescue':        'Revenue Rescue Center',
  '/assistant':             'AI Operations Assistant',
  '/settings':              'Settings',
};

function Breadcrumbs() {
  const { pathname } = useLocation();
  const segments = pathname.split('/').filter(Boolean);

  if (pathname === '/') {
    return (
      <nav className="hidden sm:flex items-center gap-1.5 text-sm" aria-label="Breadcrumb">
        <span className="font-medium text-slate-900">Overview</span>
      </nav>
    );
  }

  return (
    <nav className="hidden sm:flex items-center gap-1.5 text-sm" aria-label="Breadcrumb">
      <Link to="/" className="text-slate-500 hover:text-slate-700 transition-colors">
        Home
      </Link>
      {segments.map((seg, idx) => {
        const path = '/' + segments.slice(0, idx + 1).join('/');
        const label = ROUTE_LABELS[path] ?? seg.charAt(0).toUpperCase() + seg.slice(1);
        const isLast = idx === segments.length - 1;
        return (
          <React.Fragment key={path}>
            <span className="text-slate-300">/</span>
            {isLast ? (
              <span className="font-medium text-slate-900 truncate max-w-[140px]">{label}</span>
            ) : (
              <Link to={path} className="text-slate-500 hover:text-slate-700 transition-colors truncate max-w-[120px]">
                {label}
              </Link>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}

// ── Search ─────────────────────────────────────────────────────────────────────

function SearchBar() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="hidden md:flex items-center gap-2 px-3 py-1.5 text-sm text-slate-400 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors w-48"
        aria-label="Open search"
      >
        <Search className="w-3.5 h-3.5 flex-shrink-0" />
        <span className="text-xs">Search…</span>
        <kbd className="ml-auto text-[10px] text-slate-400 bg-white border border-slate-200 rounded px-1">⌘K</kbd>
      </button>
    );
  }

  return (
    <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-white border border-indigo-300 ring-2 ring-indigo-100 rounded-lg w-64 transition-all">
      <Search className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
      <input
        autoFocus
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search customers, subscriptions…"
        className="flex-1 text-sm outline-none bg-transparent placeholder:text-slate-400"
        onBlur={() => { setOpen(false); setQuery(''); }}
        onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
      />
      {query && (
        <button onClick={() => setQuery('')} className="text-slate-400 hover:text-slate-600">
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}

// ── Notifications Dropdown ─────────────────────────────────────────────────────

function NotificationsDropdown() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null!);
  useClickOutside(ref, () => setOpen(false));

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'relative w-9 h-9 flex items-center justify-center rounded-lg',
          'text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors',
          open && 'bg-slate-100 text-slate-700',
        )}
        aria-label="Notifications"
        aria-expanded={open}
      >
        <Bell className="w-4 h-4" />
        <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white" />
      </button>

      {open && (
        <div className={cn(
          'absolute right-0 top-full mt-2 w-80 rounded-xl bg-white border border-slate-200',
          'shadow-[var(--shadow-modal)] z-50 overflow-hidden animate-fade-in',
        )}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <p className="text-sm font-semibold text-slate-800">Notifications</p>
            <button className="text-xs text-indigo-600 hover:text-indigo-700 font-medium">Mark all read</button>
          </div>
          <div className="p-4 flex flex-col items-center gap-3 py-8">
            <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-slate-400" />
            </div>
            <p className="text-sm text-slate-500 text-center">
              Notifications will appear here once the backend integration is complete.
            </p>
          </div>
          <div className="border-t border-slate-100 px-4 py-2.5">
            <button className="text-xs text-slate-500 hover:text-slate-700 w-full text-center transition-colors">
              View all notifications
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Profile Dropdown ───────────────────────────────────────────────────────────

const PROFILE_MENU = [
  { icon: UserCircle, label: 'Profile',  sublabel: 'View your profile' },
  { icon: Settings,   label: 'Settings', sublabel: 'Account preferences', href: ROUTES.SETTINGS },
  { icon: HelpCircle, label: 'Help',     sublabel: 'Documentation & support' },
];

function ProfileDropdown() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null!);
  useClickOutside(ref, () => setOpen(false));
  const { user, logout } = useAuth();

  const initials = user?.full_name
    .split(' ')
    .slice(0, 2)
    .map(n => n[0])
    .join('')
    .toUpperCase() ?? '?';

  const handleLogout = async () => {
    setOpen(false);
    await logout();
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex items-center gap-2 pl-3 border-l border-slate-200 h-8',
          'hover:opacity-80 transition-opacity',
          open && 'opacity-80',
        )}
        aria-label="User menu"
        aria-expanded={open}
      >
        <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center flex-shrink-0 text-white text-xs font-bold">
          {initials}
        </div>
        <div className="hidden md:block text-left">
          <p className="text-xs font-semibold text-slate-800 leading-none truncate max-w-[100px]">{user?.full_name}</p>
          <p className="text-[10px] text-slate-400 leading-none mt-0.5">{user ? ROLE_LABELS[user.role] : ''}</p>
        </div>
        <ChevronDown className={cn('w-3.5 h-3.5 text-slate-400 transition-transform duration-200 hidden md:block', open && 'rotate-180')} />
      </button>

      {open && (
        <div className={cn(
          'absolute right-0 top-full mt-2 w-64 rounded-xl bg-white border border-slate-200',
          'shadow-[var(--shadow-modal)] z-50 overflow-hidden animate-fade-in',
        )}>
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-100">
            <div className="w-9 h-9 rounded-full bg-indigo-600 flex items-center justify-center flex-shrink-0 text-white font-bold text-sm">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900 truncate">{user?.full_name}</p>
              <p className="text-xs text-slate-500 truncate">{user?.email}</p>
              {user && (
                <span className="inline-block mt-0.5 text-[10px] font-semibold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded-full">
                  {ROLE_LABELS[user.role]}
                </span>
              )}
            </div>
          </div>

          {/* Menu items */}
          <div className="py-1.5">
            {user?.role === 'admin' && (
              <Link
                to={ROUTES.SETTINGS}
                className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 transition-colors"
                onClick={() => setOpen(false)}
              >
                <Settings className="w-4 h-4 text-slate-500 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-slate-700">Settings</p>
                  <p className="text-xs text-slate-400">Account preferences</p>
                </div>
              </Link>
            )}
            <button
              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 transition-colors text-left"
              onClick={() => setOpen(false)}
            >
              <HelpCircle className="w-4 h-4 text-slate-500 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-slate-700">Help</p>
                <p className="text-xs text-slate-400">Documentation & support</p>
              </div>
            </button>
          </div>

          {/* Logout */}
          <div className="border-t border-slate-100 py-1.5">
            <button
              className="w-full flex items-center gap-3 px-4 py-2.5 text-red-600 hover:bg-red-50 transition-colors"
              onClick={handleLogout}
            >
              <LogOut className="w-4 h-4 flex-shrink-0" />
              <span className="text-sm font-medium">Sign out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── TopNavbar ──────────────────────────────────────────────────────────────────

export function TopNavbar() {
  const { toggleMobile } = useSidebarContext();

  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center gap-3 px-4 sm:px-6 flex-shrink-0 z-30">
      {/* Mobile menu toggle */}
      <button
        onClick={toggleMobile}
        className="lg:hidden w-9 h-9 flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 transition-colors flex-shrink-0"
        aria-label="Open navigation"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Breadcrumbs */}
      <div className="flex-1 min-w-0">
        <Breadcrumbs />
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <SearchBar />
        <NotificationsDropdown />
        <ProfileDropdown />
      </div>
    </header>
  );
}
