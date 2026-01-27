import { useLocation, Link, useNavigate } from 'react-router-dom';
import {
  Home,
  PlusCircle,
  ListTodo,
  CheckSquare,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  User,
  UserPen,
  Shield,
  Calendar,
  LayoutGrid,
  Mail,
  Bell,
  SlidersHorizontal,
  Plus,
  HelpCircle,
  Sparkles,
  Search,
  FileText,
  Database,
  Clock,
  PenLine,
  X,
  PhoneCall,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';

interface NavItem {
  title: string;
  href: string;
  icon: React.ElementType;
  roles: string[];
  badge?: number;
}

const navItems: NavItem[] = [
  {
    title: 'Dashboard',
    href: '/dashboard',
    icon: Home,
    roles: ['designer', 'staff', 'treasurer'],
  },
  {
    title: 'New Request',
    href: '/new-request',
    icon: PlusCircle,
    roles: ['staff', 'treasurer'],
  },
  {
    title: 'All Tasks',
    href: '/tasks',
    icon: ListTodo,
    roles: ['designer'],
  },
  {
    title: 'Designer Availability',
    href: '/designer-availability',
    icon: Calendar,
    roles: ['designer', 'staff', 'treasurer', 'admin'],
  },
  {
    title: 'My Requests',
    href: '/my-requests',
    icon: ListTodo,
    roles: ['staff'],
  },
  {
    title: 'Pending Approvals',
    href: '/approvals',
    icon: CheckSquare,
    roles: ['treasurer'],
  },
];

export function AppSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (!user) {
      document.documentElement.style.removeProperty('--app-sidebar-width');
      return;
    }
    const width = collapsed ? '5rem' : '18rem';
    document.documentElement.style.setProperty('--app-sidebar-width', width);
    return () => {
      document.documentElement.style.removeProperty('--app-sidebar-width');
    };
  }, [collapsed, user]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!user) return;
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setCollapsed(true);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [user]);

  if (!user) return null;

  const quickAccessItems = [
    { label: 'Submission Guidelines', icon: FileText, action: 'open-guidelines' as const },
    { label: 'Edit Profile', icon: UserPen, href: '/settings#profile' },
    { label: 'Search', icon: Search, action: 'open-search' as const },
    { label: 'Contact Design Coordinate Executive', icon: PhoneCall, href: 'tel:+919003776002' },
  ];

  const filteredNavItems = navItems.filter((item) =>
    item.roles.includes(user.role)
  );

  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      designer: 'Designer',
      staff: 'Staff',
      treasurer: 'Treasurer',
    };
    return labels[role] || role;
  };

  const getRoleIcon = (role: string) => {
    if (role === 'treasurer') {
      return <Shield className="h-3 w-3" />;
    }
    return <User className="h-3 w-3" />;
  };

  const getNavLinkClass = (path: string | null) => {
    const isActive = path ? location.pathname === path : false;
    return cn(
      'flex w-full items-center gap-3 px-3 py-2.5 rounded-xl border border-transparent transition-all duration-200',
      isActive
        ? 'bg-primary/75 bg-gradient-to-br from-white/20 via-primary/80 to-primary/90 text-primary-foreground border border-white/40 shadow-[0_22px_44px_-26px_hsl(var(--primary)/0.5)] backdrop-blur-2xl ring-1 ring-white/30 dark:bg-primary/70 dark:text-primary-foreground dark:border-border'
        : 'text-[#475569] hover:border hover:border-[#CFE0FF] hover:bg-[#EEF4FF]/90 hover:text-[#1E2A5A] hover:shadow-[0_16px_34px_-22px_rgba(30,58,138,0.35)] hover:backdrop-blur-xl dark:text-muted-foreground dark:hover:bg-muted dark:hover:text-foreground dark:hover:border-border',
      collapsed && 'justify-center px-2'
    );
  };

  const renderCollapsedTooltip = (label: string) => {
    if (!collapsed) return null;
    return (
      <span className="pointer-events-none absolute left-full top-1/2 ml-2 -translate-y-1/2 whitespace-nowrap rounded-full border border-[#D9E6FF] bg-[#F5F8FF] dark:bg-card dark:border-border px-3 py-1 text-[11px] font-semibold text-[#2F3A56] dark:text-foreground opacity-0 shadow-sm transition-all duration-150 group-hover:opacity-100 max-w-[140px] overflow-hidden text-ellipsis">
        {label}
      </span>
    );
  };

  return (
    <aside
      className={cn(
        'flex flex-col rounded-[28px] border border-[#D9E6FF] bg-gradient-to-br from-white via-[#F3F7FF] to-[#E7EFFF] text-[#475569] dark:bg-card/95 dark:bg-none dark:text-foreground dark:border-border shadow-[0_24px_60px_-40px_rgba(15,23,42,0.4)] transition-all duration-300 h-full fixed top-4 md:top-6 left-4 md:left-6 h-auto',
        collapsed ? 'w-20' : 'w-72'
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-[#D9E6FF]/70 dark:border-border">
        {!collapsed && (
          <button
            type="button"
            onClick={() => {
              navigate('/dashboard');
            }}
            className="animate-fade-in flex items-center gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 rounded-md"
          >
            <img
              src="/favicon.png"
              alt="DesignDesk"
              className="h-9 w-9 rounded-xl object-contain p-1 bg-gradient-to-br from-white/85 via-[#EAF2FF]/80 to-[#DDE9FF]/70 dark:bg-muted/60 dark:border-border border border-[#C9D7FF] shadow-[0_10px_24px_-18px_rgba(15,23,42,0.35)] backdrop-blur"
            />
            <div>
              <h1 className="text-lg font-bold text-[#1E2A5A] dark:text-foreground">
                DesignDesk
              </h1>
              <p className="text-xs text-[#6B7A99] dark:text-muted-foreground">Task Portal</p>
            </div>
          </button>
        )}
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setCollapsed(!collapsed)}
          className="text-[#6B7A99] dark:text-muted-foreground hover:bg-white/70 dark:hover:bg-muted hover:text-[#1E2A5A] dark:hover:text-foreground"
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* User Info */}
      {!collapsed && (
        <div className="p-4 border-b border-[#D9E6FF]/70 dark:border-border animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold">
              {user.name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[#1E2A5A] dark:text-foreground truncate">
                {user.name}
              </p>
              <div className="flex items-center gap-1 text-xs text-[#6B7A99] dark:text-muted-foreground">
                {getRoleIcon(user.role)}
                <span>{getRoleLabel(user.role)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav
        className={cn(
          "flex-1 p-3 space-y-1.5 scrollbar-thin",
          collapsed ? "overflow-visible" : "overflow-y-auto overflow-x-hidden"
        )}
      >
        {filteredNavItems.map((item) => {
          const isActive = location.pathname === item.href;
          return (
            <div key={item.href} className="relative group">
              {renderCollapsedTooltip(item.title)}
              <Link
                to={item.href}
                aria-label={item.title}
                className={cn(
                  getNavLinkClass(item.href)
                )}
              >
                <item.icon className="h-5 w-5 flex-shrink-0" />
                {!collapsed && (
                  <span className="text-sm font-medium animate-fade-in">
                    {item.title}
                  </span>
                )}
                {!collapsed && item.badge && item.badge > 0 && (
                  <Badge variant="urgent" className="ml-auto text-xs">
                    {item.badge}
                  </Badge>
                )}
              </Link>
            </div>
          );
        })}
      </nav>

      {!collapsed && (
        <div className="px-3 pb-3">
          <div className="rounded-2xl border border-[#D9E6FF] bg-white/85 dark:bg-card/85 dark:border-border px-3 py-2 shadow-[0_12px_30px_-24px_rgba(15,23,42,0.35)]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8A97B2] dark:text-muted-foreground">
              Quick Access
            </p>
            <div className="mt-2 flex items-center gap-2">
              {quickAccessItems.map((item) => {
                const tooltip = (
                  <span className="pointer-events-none absolute -top-9 left-1/2 -translate-x-[35%] whitespace-nowrap rounded-full border border-[#D9E6FF] bg-[#F5F8FF] dark:bg-card dark:border-border pl-4 pr-3 py-1 text-[11px] font-semibold text-[#2F3A56] dark:text-foreground opacity-0 shadow-sm transition-all duration-150 group-hover:opacity-100 group-hover:-translate-y-0.5">
                    {item.label}
                  </span>
                );

                if (item.href) {
                  const isExternal = item.href.startsWith('tel:') || item.href.startsWith('http');
                  return (
                    <div key={item.label} className="relative group">
                      {tooltip}
                      {isExternal ? (
                        <a
                          href={item.href}
                          aria-label={item.label}
                          className="group flex h-9 w-9 items-center justify-center rounded-full border border-[#E1E9FF] bg-[#F5F8FF] dark:bg-muted dark:border-border text-[#6B7A99] dark:text-muted-foreground transition hover:border-[#C8D7FF] hover:text-[#1E2A5A] dark:hover:text-foreground"
                        >
                          <item.icon className="h-4 w-4" />
                        </a>
                      ) : (
                        <Link
                          to={item.href}
                          aria-label={item.label}
                          className="group flex h-9 w-9 items-center justify-center rounded-full border border-[#E1E9FF] bg-[#F5F8FF] dark:bg-muted dark:border-border text-[#6B7A99] dark:text-muted-foreground transition hover:border-[#C8D7FF] hover:text-[#1E2A5A] dark:hover:text-foreground"
                        >
                          <item.icon className="h-4 w-4" />
                        </Link>
                      )}
                    </div>
                  );
                }

                if (item.action === 'open-search') {
                  return (
                    <div key={item.label} className="relative group">
                      {tooltip}
                      <button
                        type="button"
                        aria-label={item.label}
                        onClick={() => {
                          window.dispatchEvent(new CustomEvent('designhub:open-search'));
                        }}
                        className="group flex h-9 w-9 items-center justify-center rounded-full border border-[#E1E9FF] bg-[#F5F8FF] dark:bg-muted dark:border-border text-[#6B7A99] dark:text-muted-foreground transition hover:border-[#C8D7FF] hover:text-[#1E2A5A] dark:hover:text-foreground"
                      >
                        <item.icon className="h-4 w-4" />
                      </button>
                    </div>
                  );
                }

                if (item.action === 'open-guidelines') {
                  return (
                    <div key={item.label} className="relative group">
                      {tooltip}
                      <button
                        type="button"
                        aria-label={item.label}
                        onClick={() => {
                          window.dispatchEvent(new CustomEvent('designhub:open-guidelines'));
                        }}
                        className="group flex h-9 w-9 items-center justify-center rounded-full border border-[#E1E9FF] bg-[#F5F8FF] dark:bg-muted dark:border-border text-[#6B7A99] dark:text-muted-foreground transition hover:border-[#C8D7FF] hover:text-[#1E2A5A] dark:hover:text-foreground"
                      >
                        <item.icon className="h-4 w-4" />
                      </button>
                    </div>
                  );
                }

                return (
                  <div key={item.label} className="relative group">
                    {tooltip}
                    <button
                      type="button"
                      aria-label={item.label}
                      className="group flex h-9 w-9 items-center justify-center rounded-full border border-[#E1E9FF] bg-[#F5F8FF] dark:bg-muted dark:border-border text-[#6B7A99] dark:text-muted-foreground transition hover:border-[#C8D7FF] hover:text-[#1E2A5A] dark:hover:text-foreground"
                    >
                      <item.icon className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {(user.role === 'staff' || user.role === 'treasurer') && (
            <div className="relative group">
              <span className="pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-[#D9E6FF] bg-[#F5F8FF] dark:bg-card dark:border-border px-3 py-1 text-[11px] font-semibold text-[#2F3A56] dark:text-foreground opacity-0 shadow-sm transition-all duration-150 group-hover:opacity-100 group-hover:-translate-y-0.5">
                Create new task
              </span>
              <Link
                to="/new-request"
                className="mt-3 flex flex-col items-center gap-2 rounded-2xl border border-[#D9E6FF] bg-white/90 dark:bg-card/90 dark:border-border px-3 py-4 text-center shadow-[0_18px_40px_-28px_rgba(15,23,42,0.35)] transition hover:shadow-[0_20px_44px_-28px_rgba(15,23,42,0.45)]"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-[0_12px_22px_-16px_hsl(var(--primary)/0.7)]">
                  <Plus className="h-6 w-6" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-[#1E2A5A] dark:text-foreground">Create new task</p>
                  <p className="text-xs text-[#6B7A99] dark:text-muted-foreground">Or use invite link</p>
                </div>
              </Link>
            </div>
          )}
        </div>
      )}

      {collapsed && (
        <div className="px-3 pb-3 space-y-3">
          <div className="rounded-2xl border border-[#D9E6FF] bg-white/85 dark:bg-card/85 dark:border-border px-2 py-2 shadow-[0_12px_30px_-24px_rgba(15,23,42,0.35)]">
            {quickAccessItems.map((item) => {
              const tooltip = (
                <span className="pointer-events-none absolute left-full top-1/2 ml-3 -translate-y-1/2 whitespace-nowrap rounded-full border border-[#D9E6FF] bg-[#F5F8FF] dark:bg-card dark:border-border px-3 py-1 text-[11px] font-semibold text-[#2F3A56] dark:text-foreground opacity-0 shadow-sm transition-all duration-150 group-hover:opacity-100">
                  {item.label}
                </span>
              );

              if (item.href) {
                const isExternal = item.href.startsWith('tel:') || item.href.startsWith('http');
                return (
                  <div key={`quick-collapsed-${item.label}`} className="relative group">
                    {tooltip}
                    {isExternal ? (
                      <a
                        href={item.href}
                        aria-label={item.label}
                        className="group mx-auto my-1 flex h-8 w-8 items-center justify-center rounded-full border border-[#E1E9FF] bg-[#F5F8FF] dark:bg-muted dark:border-border text-[#6B7A99] dark:text-muted-foreground"
                      >
                        <item.icon className="h-4 w-4" />
                      </a>
                    ) : (
                      <Link
                        to={item.href}
                        aria-label={item.label}
                        className="group mx-auto my-1 flex h-8 w-8 items-center justify-center rounded-full border border-[#E1E9FF] bg-[#F5F8FF] dark:bg-muted dark:border-border text-[#6B7A99] dark:text-muted-foreground"
                      >
                        <item.icon className="h-4 w-4" />
                      </Link>
                    )}
                  </div>
                );
              }

              if (item.action === 'open-search') {
                return (
                  <div key={`quick-collapsed-${item.label}`} className="relative group">
                    {tooltip}
                    <button
                      type="button"
                      aria-label={item.label}
                      onClick={() => {
                        window.dispatchEvent(new CustomEvent('designhub:open-search'));
                      }}
                      className="group mx-auto my-1 flex h-8 w-8 items-center justify-center rounded-full border border-[#E1E9FF] bg-[#F5F8FF] dark:bg-muted dark:border-border text-[#6B7A99] dark:text-muted-foreground"
                    >
                      <item.icon className="h-4 w-4" />
                    </button>
                  </div>
                );
              }

              if (item.action === 'open-guidelines') {
                return (
                  <div key={`quick-collapsed-${item.label}`} className="relative group">
                    {tooltip}
                    <button
                      type="button"
                      aria-label={item.label}
                      onClick={() => {
                        window.dispatchEvent(new CustomEvent('designhub:open-guidelines'));
                      }}
                      className="group mx-auto my-1 flex h-8 w-8 items-center justify-center rounded-full border border-[#E1E9FF] bg-[#F5F8FF] dark:bg-muted dark:border-border text-[#6B7A99] dark:text-muted-foreground"
                    >
                      <item.icon className="h-4 w-4" />
                    </button>
                  </div>
                );
              }

              return (
                <div key={`quick-collapsed-${item.label}`} className="relative group">
                  {tooltip}
                  <div className="group mx-auto my-1 flex h-8 w-8 items-center justify-center rounded-full border border-[#E1E9FF] bg-[#F5F8FF] dark:bg-muted dark:border-border text-[#6B7A99] dark:text-muted-foreground">
                    <item.icon className="h-4 w-4" />
                  </div>
                </div>
              );
            })}
          </div>
          {(user.role === 'staff' || user.role === 'treasurer') && (
            <div className="relative group">
              <span className="pointer-events-none absolute left-full top-1/2 ml-3 -translate-y-1/2 whitespace-nowrap rounded-full border border-[#D9E6FF] bg-[#F5F8FF] dark:bg-card dark:border-border px-3 py-1 text-[11px] font-semibold text-[#2F3A56] dark:text-foreground opacity-0 shadow-sm transition-all duration-150 group-hover:opacity-100">
                Create new task
              </span>
              <Link
                to="/new-request"
                className="flex h-12 w-full items-center justify-center rounded-2xl border border-[#D9E6FF] bg-white/90 dark:bg-card/90 dark:border-border text-[#1E2A5A] dark:text-foreground shadow-[0_18px_40px_-28px_rgba(15,23,42,0.35)]"
              >
                <Plus className="h-5 w-5" />
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="p-3 border-t border-[#D9E6FF]/70 space-y-1">
        <div className="relative group">
          {renderCollapsedTooltip('Settings')}
          <Link
            to="/settings"
            aria-label="Settings"
            className={cn(
              getNavLinkClass('/settings'),
              "group"
            )}
          >
            <Settings className="h-5 w-5" />
            {!collapsed && <span className="text-sm font-medium">Settings</span>}
          </Link>
        </div>
        <div className="relative group">
          {renderCollapsedTooltip('Help Center')}
          <Link
            to="/help"
            aria-label="Help Center"
            className={cn(
              getNavLinkClass('/help'),
              "group"
            )}
          >
            <HelpCircle className="h-5 w-5" />
            {!collapsed && <span className="text-sm font-medium">Help Center</span>}
          </Link>
        </div>
        <div className="relative group">
          {renderCollapsedTooltip('Logout')}
          <button
            onClick={() => {
              logout();
              navigate('/', { replace: true });
              setTimeout(() => {
                window.location.href = '/';
              }, 0);
            }}
            aria-label="Logout"
            className={cn(
              getNavLinkClass(null),
              "group"
            )}
          >
            <LogOut className="h-5 w-5" />
            {!collapsed && <span className="text-sm font-medium">Logout</span>}
          </button>
        </div>
      </div>
    </aside>
  );
}

