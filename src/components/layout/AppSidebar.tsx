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
  Shield,
  Calendar,
  LayoutGrid,
  Mail,
  Bell,
  SlidersHorizontal,
  Plus,
  HelpCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useState } from 'react';
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
    roles: ['staff', 'treasurer'],
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

  if (!user) return null;

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

  return (
    <aside
      className={cn(
        'flex flex-col rounded-[28px] border border-[#D9E6FF] bg-gradient-to-br from-white via-[#F3F7FF] to-[#E7EFFF] text-[#475569] shadow-[0_24px_60px_-40px_rgba(15,23,42,0.4)] transition-all duration-300 h-full sticky top-4',
        collapsed ? 'w-20' : 'w-72'
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-[#D9E6FF]/70">
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
              className="h-9 w-9 rounded-xl object-contain p-1 bg-gradient-to-br from-white/85 via-[#EAF2FF]/80 to-[#DDE9FF]/70 border border-[#C9D7FF] shadow-[0_10px_24px_-18px_rgba(15,23,42,0.35)] backdrop-blur"
            />
            <div>
              <h1 className="text-lg font-bold text-[#1E2A5A]">
                DesignDesk
              </h1>
              <p className="text-xs text-[#6B7A99]">Task Portal</p>
            </div>
          </button>
        )}
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setCollapsed(!collapsed)}
          className="text-[#6B7A99] hover:bg-white/70 hover:text-[#1E2A5A]"
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
        <div className="p-4 border-b border-[#D9E6FF]/70 animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold">
              {user.name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[#1E2A5A] truncate">
                {user.name}
              </p>
              <div className="flex items-center gap-1 text-xs text-[#6B7A99]">
                {getRoleIcon(user.role)}
                <span>{getRoleLabel(user.role)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1.5 overflow-y-auto scrollbar-thin">
        {filteredNavItems.map((item) => {
          const isActive = location.pathname === item.href;
          return (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200',
                isActive
                  ? 'bg-primary/75 bg-gradient-to-br from-white/20 via-primary/80 to-primary/90 text-primary-foreground border border-white/40 shadow-[0_22px_44px_-26px_hsl(var(--primary)/0.5)] backdrop-blur-2xl ring-1 ring-white/30'
                  : 'text-[#475569] hover:border hover:border-[#CFE0FF] hover:bg-[#EEF4FF]/90 hover:text-[#1E2A5A] hover:shadow-[0_16px_34px_-22px_rgba(30,58,138,0.35)] hover:backdrop-blur-xl',
                collapsed && 'justify-center px-2'
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
          );
        })}
      </nav>

      {!collapsed && (
        <div className="px-3 pb-3">
          <div className="rounded-2xl border border-[#D9E6FF] bg-white/85 px-3 py-2 shadow-[0_12px_30px_-24px_rgba(15,23,42,0.35)]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8A97B2]">
              Settings
            </p>
            <div className="mt-2 flex items-center gap-2">
              {[LayoutGrid, Mail, Bell, SlidersHorizontal, Settings].map((Icon, index) => (
                <button
                  key={`quick-${index}`}
                  type="button"
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-[#E1E9FF] bg-[#F5F8FF] text-[#6B7A99] transition hover:border-[#C8D7FF] hover:text-[#1E2A5A]"
                >
                  <Icon className="h-4 w-4" />
                </button>
              ))}
            </div>
          </div>

          {(user.role === 'staff' || user.role === 'treasurer') && (
            <Link
              to="/new-request"
              className="mt-3 flex flex-col items-center gap-2 rounded-2xl border border-[#D9E6FF] bg-white/90 px-3 py-4 text-center shadow-[0_18px_40px_-28px_rgba(15,23,42,0.35)] transition hover:shadow-[0_20px_44px_-28px_rgba(15,23,42,0.45)]"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-[0_12px_22px_-16px_hsl(var(--primary)/0.7)]">
                <Plus className="h-6 w-6" />
              </span>
              <div>
                <p className="text-sm font-semibold text-[#1E2A5A]">Create new task</p>
                <p className="text-xs text-[#6B7A99]">Or use invite link</p>
              </div>
            </Link>
          )}
        </div>
      )}

      {collapsed && (
        <div className="px-3 pb-3 space-y-3">
          <div className="rounded-2xl border border-[#D9E6FF] bg-white/85 px-2 py-2 shadow-[0_12px_30px_-24px_rgba(15,23,42,0.35)]">
            {[LayoutGrid, Mail, Bell, SlidersHorizontal, Settings].map((Icon, index) => (
              <div
                key={`quick-collapsed-${index}`}
                className="mx-auto my-1 flex h-8 w-8 items-center justify-center rounded-full border border-[#E1E9FF] bg-[#F5F8FF] text-[#6B7A99]"
              >
                <Icon className="h-4 w-4" />
              </div>
            ))}
          </div>
          {(user.role === 'staff' || user.role === 'treasurer') && (
            <Link
              to="/new-request"
              className="flex h-12 w-full items-center justify-center rounded-2xl border border-[#D9E6FF] bg-white/90 text-[#1E2A5A] shadow-[0_18px_40px_-28px_rgba(15,23,42,0.35)]"
            >
              <Plus className="h-5 w-5" />
            </Link>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="p-3 border-t border-[#D9E6FF]/70 space-y-1">
        <Link
          to="/settings"
          className={cn(
            'flex items-center gap-3 px-3 py-2.5 rounded-xl text-[#475569] transition-all duration-200 hover:border hover:border-[#CFE0FF] hover:bg-[#EEF4FF]/90 hover:text-[#1E2A5A] hover:shadow-[0_16px_34px_-22px_rgba(30,58,138,0.35)] hover:backdrop-blur-xl',
            collapsed && 'justify-center px-2'
          )}
        >
          <Settings className="h-5 w-5" />
          {!collapsed && <span className="text-sm font-medium">Settings</span>}
        </Link>
        <Link
          to="/help"
          className={cn(
            'flex items-center gap-3 px-3 py-2.5 rounded-xl text-[#475569] transition-all duration-200 hover:border hover:border-[#CFE0FF] hover:bg-[#EEF4FF]/90 hover:text-[#1E2A5A] hover:shadow-[0_16px_34px_-22px_rgba(30,58,138,0.35)] hover:backdrop-blur-xl',
            collapsed && 'justify-center px-2'
          )}
        >
          <HelpCircle className="h-5 w-5" />
          {!collapsed && <span className="text-sm font-medium">Help Center</span>}
        </Link>
        <button
          onClick={() => {
            logout();
            navigate('/', { replace: true });
            setTimeout(() => {
              window.location.href = '/';
            }, 0);
          }}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[#475569] transition-all duration-200 hover:border hover:border-[#CFE0FF] hover:bg-[#EEF4FF]/90 hover:text-[#1E2A5A] hover:shadow-[0_16px_34px_-22px_rgba(30,58,138,0.35)] hover:backdrop-blur-xl',
            collapsed && 'justify-center px-2'
          )}
        >
          <LogOut className="h-5 w-5" />
          {!collapsed && <span className="text-sm font-medium">Logout</span>}
        </button>
      </div>
    </aside>
  );
}
