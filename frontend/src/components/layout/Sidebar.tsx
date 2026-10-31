/**
 * REVORA – Sidebar navigation component.
 * Professional enterprise SaaS sidebar with icon + label navigation.
 */

import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Package,
  RefreshCw,
  FileText,
  CreditCard,
  BarChart3,
  Zap,
  Settings,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { ROUTES } from '@/config/routes';
import { APP_NAME } from '@/config/app';
import { cn } from '@/utils/cn';

interface NavItem {
  label: string;
  path: string;
  icon: React.ElementType;
  badge?: string;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    title: 'Overview',
    items: [
      { label: 'Dashboard', path: ROUTES.DASHBOARD, icon: LayoutDashboard },
    ],
  },
  {
    title: 'Management',
    items: [
      { label: 'Customers', path: ROUTES.CUSTOMERS, icon: Users },
      { label: 'Products & Plans', path: ROUTES.PRODUCTS, icon: Package },
      { label: 'Subscriptions', path: ROUTES.SUBSCRIPTIONS, icon: RefreshCw },
    ],
  },
  {
    title: 'Finance',
    items: [
      { label: 'Invoices', path: ROUTES.INVOICES, icon: FileText },
      { label: 'Payments', path: ROUTES.PAYMENTS, icon: CreditCard },
    ],
  },
  {
    title: 'Intelligence',
    items: [
      { label: 'Analytics', path: ROUTES.ANALYTICS, icon: BarChart3 },
      { label: 'Revenue Rescue', path: ROUTES.REVENUE_RESCUE, icon: Zap, badge: 'AI' },
    ],
  },
  {
    title: 'System',
    items: [
      { label: 'Settings', path: ROUTES.SETTINGS, icon: Settings },
    ],
  },
];

interface SidebarProps {
  className?: string;
}

export function Sidebar({ className }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();

  return (
    <aside
      className={cn(
        'relative flex flex-col bg-[#14213D] text-white transition-all duration-300 ease-in-out',
        collapsed ? 'w-16' : 'w-64',
        className,
      )}
    >
      {/* Logo */}
      <div className={cn(
        'flex items-center gap-3 border-b border-white/10 h-16 px-4',
        collapsed && 'justify-center px-0',
      )}>
        <div className="flex-shrink-0 w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center">
          <Sparkles className="w-4 h-4 text-white" />
        </div>
        {!collapsed && (
          <span className="font-bold text-lg tracking-tight">{APP_NAME}</span>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto scrollbar-thin py-4 px-2 space-y-6">
        {NAV_SECTIONS.map((section) => (
          <div key={section.title}>
            {!collapsed && (
              <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-white/40">
                {section.title}
              </p>
            )}
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const isActive =
                  item.path === '/'
                    ? location.pathname === '/'
                    : location.pathname.startsWith(item.path);
                const Icon = item.icon;
                return (
                  <li key={item.path}>
                    <NavLink
                      to={item.path}
                      title={collapsed ? item.label : undefined}
                      className={cn(
                        'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
                        isActive
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'text-white/70 hover:bg-white/10 hover:text-white',
                        collapsed && 'justify-center px-0',
                      )}
                    >
                      <Icon className="w-4 h-4 flex-shrink-0" />
                      {!collapsed && (
                        <>
                          <span className="flex-1">{item.label}</span>
                          {item.badge && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 bg-teal-500 text-white rounded-full">
                              {item.badge}
                            </span>
                          )}
                        </>
                      )}
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Collapse toggle */}
      <div className="border-t border-white/10 p-2">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium',
            'text-white/50 hover:text-white hover:bg-white/10 transition-all duration-150',
            collapsed && 'justify-center',
          )}
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <>
              <ChevronLeft className="w-4 h-4" />
              <span>Collapse</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
