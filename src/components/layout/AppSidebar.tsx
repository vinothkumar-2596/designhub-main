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
        'flex flex-col bg-sidebar text-sidebar-foreground transition-all duration-300 h-screen sticky top-0',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-sidebar-border">
        {!collapsed && (
          <button
            type="button"
            onClick={() => {
              navigate('/dashboard');
            }}
            className="animate-fade-in flex items-center gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-primary/40 rounded-md"
          >
            <img
              src="/favicon.png"
              alt="DesignDesk"
              className="h-9 w-9 rounded-xl object-contain p-1"
              style={{ backgroundColor: 'rgb(21, 30, 60)' }}
            />
            <div>
              <h1 className="text-lg font-bold text-sidebar-primary-foreground">
                DesignDesk
              </h1>
              <p className="text-xs text-sidebar-foreground/60">Task Portal</p>
            </div>
          </button>
        )}
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setCollapsed(!collapsed)}
          className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
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
        <div className="p-4 border-b border-sidebar-border animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-sidebar-primary flex items-center justify-center text-sidebar-primary-foreground font-semibold">
              {user.name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-sidebar-primary-foreground truncate">
                {user.name}
              </p>
              <div className="flex items-center gap-1 text-xs text-sidebar-foreground/60">
                {getRoleIcon(user.role)}
                <span>{getRoleLabel(user.role)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 p-2 space-y-1 overflow-y-auto scrollbar-thin">
        {filteredNavItems.map((item) => {
          const isActive = location.pathname === item.href;
          return (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200',
                isActive
                  ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                  : 'text-sidebar-foreground hover:bg-sidebar-primary/15 hover:text-sidebar-primary-foreground',
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

      {/* Footer */}
      <div className="p-2 border-t border-sidebar-border space-y-1">
        <Link
          to="/settings"
          className={cn(
            'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sidebar-foreground hover:bg-sidebar-primary/15 hover:text-sidebar-primary-foreground transition-all duration-200',
            collapsed && 'justify-center px-2'
          )}
        >
          <Settings className="h-5 w-5" />
          {!collapsed && <span className="text-sm font-medium">Settings</span>}
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
            'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sidebar-foreground hover:bg-destructive/20 hover:text-destructive transition-all duration-200',
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
