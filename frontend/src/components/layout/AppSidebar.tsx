/**
 * REVORA – AppSidebar (Role-Aware)
 * Navigation items are filtered based on the authenticated user's role.
 * Admin sees everything, Staff sees business modules, Customer sees only their data.
 */

import React from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Package,
  Layers,
  FileText,
  RefreshCw,
  Receipt,
  Tag,
  CreditCard,
  Brain,
  TrendingUp,
  Zap,
  Bot,
  Settings,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  X,
  LogOut,
  ShieldCheck,
  UserCircle2,
} from 'lucide-react';
import { ROUTES } from '@/config/routes';
import { cn } from '@/utils/cn';
import { useSidebarContext } from '@/context/SidebarContext';
import { useAuth } from '@/context/AuthContext';
import type { UserRole } from '@/types/auth';
import { ROLE_LABELS } from '@/types/auth';

// ── Nav item type ──────────────────────────────────────────────────────────────

interface NavItem {
  id:    string;
  label: string;
  path:  string;
  icon:  React.ElementType;
  badge?: string;
  roles: UserRole[];   // which roles can see this item
}

interface NavSection {
  title: string;
  roles: UserRole[];
  items: NavItem[];
}

// ── Navigation structure ───────────────────────────────────────────────────────

const ALL_ROLES: UserRole[]      = ['admin', 'staff', 'customer'];
const ADMIN_STAFF: UserRole[]    = ['admin', 'staff'];
const ADMIN_ONLY: UserRole[]     = ['admin'];

const NAV: NavSection[] = [
  {
    title: 'Overview',
    roles: ALL_ROLES,
    items: [
      { id: 'dashboard', label: 'Overview', path: ROUTES.DASHBOARD, icon: LayoutDashboard, roles: ALL_ROLES },
    ],
  },
  {
    title: 'Operations',
    roles: ADMIN_STAFF,
    items: [
      { id: 'customers',     label: 'Customers',          path: ROUTES.CUSTOMERS,     icon: Users,      roles: ADMIN_STAFF },
      { id: 'products',      label: 'Products',           path: ROUTES.PRODUCTS,      icon: Package,    roles: ADMIN_STAFF },
      { id: 'plans',         label: 'Subscription Plans', path: ROUTES.PLANS,         icon: Layers,     roles: ADMIN_STAFF },
      { id: 'quotations',    label: 'Quotations',         path: ROUTES.QUOTATIONS,    icon: FileText,   roles: ADMIN_STAFF },
      { id: 'subscriptions', label: 'Subscriptions',      path: ROUTES.SUBSCRIPTIONS, icon: RefreshCw,  roles: ADMIN_STAFF },
    ],
  },
  {
    title: 'My Account',
    roles: ['customer'],
    items: [
      { id: 'my-plans',          label: 'Available Plans',   path: ROUTES.PLANS,          icon: Layers,    roles: ['customer'] },
      { id: 'my-subscriptions',  label: 'My Subscriptions',  path: ROUTES.SUBSCRIPTIONS,  icon: RefreshCw, roles: ['customer'] },
      { id: 'my-invoices',       label: 'My Invoices',       path: ROUTES.INVOICES,       icon: Receipt,   roles: ['customer'] },
      { id: 'my-payments',       label: 'My Payments',       path: ROUTES.PAYMENTS,       icon: CreditCard,roles: ['customer'] },
    ],
  },
  {
    title: 'Finance',
    roles: ADMIN_STAFF,
    items: [
      { id: 'invoices',  label: 'Invoices',  path: ROUTES.INVOICES,  icon: Receipt,    roles: ADMIN_STAFF },
      { id: 'discounts', label: 'Discounts', path: ROUTES.DISCOUNTS, icon: Tag,        roles: ADMIN_ONLY },
      { id: 'payments',  label: 'Payments',  path: ROUTES.PAYMENTS,  icon: CreditCard, roles: ADMIN_STAFF },
    ],
  },
  {
    title: 'Intelligence',
    roles: ADMIN_STAFF,
    items: [
      { id: 'customer-intel', label: 'Customer Intelligence',  path: ROUTES.CUSTOMER_INTELLIGENCE, icon: Brain,      badge: 'AI', roles: ADMIN_STAFF },
      { id: 'revenue-intel',  label: 'Revenue Intelligence',   path: ROUTES.REVENUE_INTELLIGENCE,  icon: TrendingUp, badge: 'AI', roles: ADMIN_STAFF },
      { id: 'rescue',         label: 'Revenue Rescue Center',  path: ROUTES.REVENUE_RESCUE,         icon: Zap,        badge: 'AI', roles: ADMIN_STAFF },
      { id: 'assistant',      label: 'AI Operations Assistant',path: ROUTES.AI_ASSISTANT,           icon: Bot,        badge: 'AI', roles: ADMIN_STAFF },
    ],
  },
];

// ── Tooltip wrapper for collapsed state ────────────────────────────────────────

function NavTooltip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="relative group/tip">
      {children}
      <div className={cn(
        'pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3 z-50',
        'whitespace-nowrap rounded-md bg-slate-900 text-white text-xs font-medium px-2.5 py-1.5',
        'opacity-0 group-hover/tip:opacity-100 transition-opacity duration-150 shadow-lg',
      )}>
        {label}
        <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-slate-900" />
      </div>
    </div>
  );
}

// ── Single nav link ────────────────────────────────────────────────────────────

function NavLinkItem({
  item, collapsed, onClick,
}: {
  item: NavItem;
  collapsed: boolean;
  onClick?: () => void;
}) {
  const location = useLocation();
  const Icon = item.icon;
  const isActive =
    item.path === ROUTES.DASHBOARD
      ? location.pathname === '/'
      : location.pathname === item.path || location.pathname.startsWith(item.path + '/');

  const link = (
    <NavLink
      to={item.path}
      onClick={onClick}
      className={cn(
        'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium',
        'transition-all duration-150 select-none',
        isActive
          ? 'bg-indigo-600 text-white shadow-sm'
          : 'text-slate-300 hover:bg-white/10 hover:text-white',
        collapsed && 'justify-center px-0',
      )}
    >
      <Icon className="w-4 h-4 flex-shrink-0" />
      {!collapsed && (
        <>
          <span className="flex-1 truncate">{item.label}</span>
          {item.badge && (
            <span className="flex-shrink-0 text-[10px] font-bold leading-none px-1.5 py-0.5 rounded-full bg-teal-500/20 text-teal-300 ring-1 ring-teal-500/30">
              {item.badge}
            </span>
          )}
        </>
      )}
    </NavLink>
  );

  return collapsed ? <NavTooltip label={item.label}>{link}</NavTooltip> : link;
}

// ── User avatar (initials) ─────────────────────────────────────────────────────

function UserAvatar({ name, role }: { name: string; role: UserRole }) {
  const initials = name
    .split(' ')
    .slice(0, 2)
    .map(n => n[0])
    .join('')
    .toUpperCase();

  const colorMap: Record<UserRole, string> = {
    admin:    'bg-indigo-500',
    staff:    'bg-teal-500',
    customer: 'bg-amber-500',
  };

  return (
    <div className={cn(
      'w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold text-white',
      colorMap[role],
    )}>
      {initials || <UserCircle2 className="w-4 h-4" />}
    </div>
  );
}

// ── Role badge ─────────────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: UserRole }) {
  const styles: Record<UserRole, string> = {
    admin:    'text-indigo-300 bg-indigo-500/20',
    staff:    'text-teal-300 bg-teal-500/20',
    customer: 'text-amber-300 bg-amber-500/20',
  };
  return (
    <span className={cn('inline-flex items-center gap-0.5 text-[9px] font-semibold px-1.5 py-0.5 rounded-full', styles[role])}>
      <ShieldCheck className="w-2.5 h-2.5" />
      {ROLE_LABELS[role]}
    </span>
  );
}

// ── Main Sidebar ───────────────────────────────────────────────────────────────

interface AppSidebarProps {
  onNavClick?: () => void;
}

export function AppSidebar({ onNavClick }: AppSidebarProps) {
  const { collapsed, toggle } = useSidebarContext();
  const { user, logout }      = useAuth();
  const navigate              = useNavigate();

  const role = user?.role ?? 'customer';

  // Filter sections and items to those the current role can see
  const visibleNav = NAV
    .filter(section => section.roles.includes(role))
    .map(section => ({
      ...section,
      items: section.items.filter(item => item.roles.includes(role)),
    }))
    .filter(section => section.items.length > 0);

  const handleLogout = async () => {
    await logout();
  };

  return (
    <aside className={cn(
      'flex flex-col h-full bg-[#14213D] text-white overflow-hidden',
      'transition-all duration-300 ease-in-out',
      collapsed ? 'w-[64px]' : 'w-[240px]',
    )}>
      {/* Brand */}
      <div className={cn(
        'flex items-center border-b border-white/10 h-16 flex-shrink-0',
        collapsed ? 'justify-center px-0' : 'gap-3 px-4',
      )}>
        <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center flex-shrink-0">
          <Sparkles className="w-4 h-4 text-white" />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="font-bold text-base leading-none text-white tracking-tight">REVORA</p>
            <p className="text-[10px] text-slate-400 mt-0.5 leading-none">Subscription Intelligence</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto scrollbar-thin py-3 px-2 space-y-5">
        {visibleNav.map((section) => (
          <div key={section.title}>
            {!collapsed && (
              <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-widest text-slate-500 select-none">
                {section.title}
              </p>
            )}
            {collapsed && <div className="my-2 border-t border-white/10" />}
            <ul className="space-y-0.5">
              {section.items.map((item) => (
                <li key={item.id}>
                  <NavLinkItem item={item} collapsed={collapsed} onClick={onNavClick} />
                </li>
              ))}
            </ul>
          </div>
        ))}

        {/* Settings – Admin only */}
        {(role === 'admin') && (
          <div>
            {!collapsed && (
              <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-widest text-slate-500 select-none">
                Administration
              </p>
            )}
            {collapsed && <div className="my-2 border-t border-white/10" />}
            <ul className="space-y-0.5">
              <li>
                <NavLinkItem
                  item={{ id: 'settings', label: 'Settings', path: ROUTES.SETTINGS, icon: Settings, roles: ADMIN_ONLY }}
                  collapsed={collapsed}
                  onClick={onNavClick}
                />
              </li>
            </ul>
          </div>
        )}
      </nav>

      {/* Bottom: User profile + logout */}
      <div className="flex-shrink-0 border-t border-white/10 p-2 space-y-1">
        {user && (
          !collapsed ? (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/10 transition-colors group">
              <UserAvatar name={user.full_name} role={user.role} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-white truncate">{user.full_name}</p>
                <RoleBadge role={user.role} />
              </div>
              <button
                onClick={handleLogout}
                title="Sign out"
                className="p-1 rounded text-slate-400 opacity-0 group-hover:opacity-100 hover:text-white hover:bg-white/10 transition-all"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <NavTooltip label={`${user.full_name} (${ROLE_LABELS[user.role]})`}>
              <div className="flex justify-center py-2 cursor-pointer" onClick={handleLogout}>
                <UserAvatar name={user.full_name} role={user.role} />
              </div>
            </NavTooltip>
          )
        )}

        {/* Collapse toggle */}
        <button
          onClick={toggle}
          className={cn(
            'w-full flex items-center gap-2 rounded-lg px-3 py-2',
            'text-xs font-medium text-slate-500 hover:text-slate-300 hover:bg-white/10',
            'transition-all duration-150',
            collapsed && 'justify-center px-0',
          )}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : (
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

// ── Mobile Drawer ──────────────────────────────────────────────────────────────

export function MobileSidebar() {
  const { mobileOpen, closeMobile } = useSidebarContext();

  return (
    <>
      {/* Overlay */}
      <div
        className={cn(
          'fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-sm transition-opacity duration-300 lg:hidden',
          mobileOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none',
        )}
        onClick={closeMobile}
      />
      {/* Drawer */}
      <div className={cn(
        'fixed top-0 left-0 z-50 h-full transition-transform duration-300 ease-in-out lg:hidden',
        mobileOpen ? 'translate-x-0' : '-translate-x-full',
      )}>
        <div className="relative h-full">
          <button
            onClick={closeMobile}
            className="absolute top-4 right-[-44px] z-10 w-9 h-9 bg-white rounded-full flex items-center justify-center shadow-lg"
            aria-label="Close navigation"
          >
            <X className="w-4 h-4 text-slate-700" />
          </button>
          <div className="h-full" style={{ width: 240 }}>
            <AppSidebar onNavClick={closeMobile} />
          </div>
        </div>
      </div>
    </>
  );
}
