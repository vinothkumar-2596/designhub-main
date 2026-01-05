import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { AppSidebar } from './AppSidebar';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  Bell,
  ArrowUpRight,
  FileText,
  HelpCircle,
  LayoutGrid,
  ListTodo,
  Search,
  User,
  Users,
  X,
} from 'lucide-react';
import { useGlobalSearch } from '@/contexts/GlobalSearchContext';
import { Link } from 'react-router-dom';
import {
  clearScheduleNotifications,
  loadScheduleNotifications,
  SCHEDULE_NOTIFICATIONS_PREFIX,
} from '@/lib/designerSchedule';
import { mockTasks } from '@/data/mockTasks';
import { mergeLocalTasks } from '@/lib/taskStorage';

interface DashboardLayoutProps {
  children: ReactNode;
  headerActions?: ReactNode;
}

export function DashboardLayout({ children, headerActions }: DashboardLayoutProps) {
  const { isAuthenticated, user } = useAuth();
  const apiUrl =
    (import.meta.env.VITE_API_URL as string | undefined) ||
    (typeof window !== 'undefined' && window.location.hostname === 'localhost'
      ? 'http://localhost:4000'
      : undefined);
  const [tasks, setTasks] = useState(mockTasks);
  const [storageTick, setStorageTick] = useState(0);
  const [useLocalData, setUseLocalData] = useState(!apiUrl);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const notificationsRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!user) return;
    const emitNotifications = () => {
      const notifications = loadScheduleNotifications(user.id);
      if (notifications.length === 0) return;
      notifications.forEach((note) => {
        toast.message(note.message, {
          description: format(note.createdAt, 'MMM d, h:mm a'),
        });
      });
      clearScheduleNotifications(user.id);
    };
    emitNotifications();
    const onStorage = (event: StorageEvent) => {
      if (!event.key) return;
      if (!event.key.startsWith(SCHEDULE_NOTIFICATIONS_PREFIX)) return;
      emitNotifications();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [user]);

  useEffect(() => {
    if (!useLocalData) return;
    const onStorage = (event: StorageEvent) => {
      if (event.key && event.key.startsWith('designhub.task.')) {
        setStorageTick((prev) => prev + 1);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [useLocalData]);

  useEffect(() => {
    if (!apiUrl) return;
    const loadTasks = async () => {
      try {
        const response = await fetch(`${apiUrl}/api/tasks`);
        if (!response.ok) {
          throw new Error('Failed to load tasks');
        }
        const data = await response.json();
        const hydrated = data.map((task: any) => ({
          ...task,
          id: task.id || task._id,
          deadline: new Date(task.deadline),
          createdAt: new Date(task.createdAt),
          updatedAt: new Date(task.updatedAt),
          proposedDeadline: task.proposedDeadline ? new Date(task.proposedDeadline) : undefined,
          deadlineApprovedAt: task.deadlineApprovedAt ? new Date(task.deadlineApprovedAt) : undefined,
          files: task.files?.map((file: any) => ({
            ...file,
            uploadedAt: new Date(file.uploadedAt),
          })),
          comments: task.comments?.map((comment: any) => ({
            ...comment,
            createdAt: new Date(comment.createdAt),
          })),
          changeHistory: task.changeHistory?.map((entry: any) => ({
            ...entry,
            createdAt: new Date(entry.createdAt),
          })),
        }));
        setTasks(hydrated);
        setUseLocalData(false);
      } catch {
        setUseLocalData(true);
      }
    };
    loadTasks();
  }, [apiUrl]);

  const hydratedTasks = useMemo(() => {
    if (!useLocalData) return tasks;
    if (typeof window === 'undefined') return mockTasks;
    return mergeLocalTasks(mockTasks);
  }, [useLocalData, storageTick, tasks]);

  const getLatestEntry = (entries: any[]) => {
    if (entries.length === 0) return null;
    return entries.reduce((latest, current) => {
      const latestTime = new Date(latest.createdAt ?? 0).getTime();
      const currentTime = new Date(current.createdAt ?? 0).getTime();
      return currentTime > latestTime ? current : latest;
    }, entries[0]);
  };

  const staffNotifications = useMemo(() => {
    if (!user || user.role !== 'staff') return [];
    return hydratedTasks
      .filter((task) => task.requesterId === user.id)
      .flatMap((task) =>
        (task.changeHistory || [])
          .filter((entry: any) => {
            const isDesignerCompletion =
              entry.userRole === 'designer' &&
              entry.field === 'status' &&
              (entry.newValue === 'Completed' || entry.newValue === 'completed');
            const isDesignerDeadlineApproval =
              entry.userRole === 'designer' &&
              entry.field === 'deadline_request' &&
              entry.newValue === 'Approved';
            const isTreasurerApproval =
              entry.userRole === 'treasurer' && entry.field === 'approval_status';
            const isEmergencyApproval =
              entry.userRole === 'designer' && entry.field === 'emergency_approval';
            return (
              isDesignerCompletion ||
              isDesignerDeadlineApproval ||
              isTreasurerApproval ||
              isEmergencyApproval
            );
          })
          .map((entry: any) => ({ ...entry, taskId: task.id, taskTitle: task.title, task }))
      )
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 3);
  }, [hydratedTasks, user]);

  const designerNotifications = useMemo(() => {
    if (!user || user.role !== 'designer') return [];
    return hydratedTasks
      .flatMap((task) => {
        const history = task.changeHistory || [];
        const treasurerEntries = history.filter(
          (entry: any) => entry.userRole === 'treasurer' && entry.field === 'approval_status'
        );
        if (treasurerEntries.length > 0) {
          const latestTreasurer = getLatestEntry(treasurerEntries);
          return latestTreasurer
            ? [{ ...latestTreasurer, taskId: task.id, taskTitle: task.title, task }]
            : [];
        }
        const staffEntries = history.filter(
          (entry: any) =>
            entry.userRole === 'staff' &&
            [
              'description',
              'files',
              'deadline_request',
              'status',
              'staff_note',
              'created',
            ].includes(entry.field)
        );
        const latestStaff = getLatestEntry(staffEntries);
        return latestStaff
          ? [{ ...latestStaff, taskId: task.id, taskTitle: task.title, task }]
          : [];
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 3);
  }, [hydratedTasks, user]);

  const treasurerNotifications = useMemo(() => {
    if (!user || user.role !== 'treasurer') return [];
    return hydratedTasks
      .flatMap((task) => {
        const history = task.changeHistory || [];
        const createdEntries = history.filter(
          (entry: any) => entry.userRole === 'staff' && entry.field === 'created'
        );
        if (createdEntries.length === 0) {
          return [];
        }
        const latestCreated = getLatestEntry(createdEntries);
        return latestCreated
          ? [{ ...latestCreated, taskId: task.id, taskTitle: task.title, task }]
          : [];
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 3);
  }, [hydratedTasks, user]);

  const activeNotifications =
    user?.role === 'staff'
      ? staffNotifications
      : user?.role === 'designer'
        ? designerNotifications
        : user?.role === 'treasurer'
          ? treasurerNotifications
          : [];

  const hasNotifications = activeNotifications.length > 0;
  const canShowNotifications =
    user?.role === 'staff' || user?.role === 'designer' || user?.role === 'treasurer';

  useEffect(() => {
    if (!notificationsOpen) return;
    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      if (!notificationsRef.current) return;
      if (notificationsRef.current.contains(event.target as Node)) return;
      setNotificationsOpen(false);
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
    };
  }, [notificationsOpen]);

  const getNotificationTitle = (entry: any) => {
    if (entry.field === 'created') {
      return `New request: ${entry.taskTitle}`;
    }
    if (user?.role === 'staff') {
      if (entry.userRole === 'treasurer' && entry.field === 'approval_status') {
        const decision = `${entry.newValue || ''}`.toLowerCase().includes('reject')
          ? 'rejected'
          : 'approved';
        return `Treasurer ${decision} ${entry.taskTitle}`;
      }
      return `Designer completed ${entry.taskTitle}`;
    }
    if (entry.userRole === 'treasurer' && entry.field === 'approval_status') {
      const decision = `${entry.newValue || ''}`.toLowerCase().includes('reject')
        ? 'rejected'
        : 'approved';
      return `Treasurer ${decision} ${entry.taskTitle}`;
    }
    return `Staff updated ${entry.taskTitle}`;
  };

  const getNotificationNote = (entry: any) => {
    if (entry.field === 'created') {
      return entry.note || `Submitted by ${entry.userName}`;
    }
    if (user?.role === 'staff') {
      if (entry.userRole === 'treasurer' && entry.field === 'approval_status') {
        const decision = `${entry.newValue || ''}`.toLowerCase().includes('reject')
          ? 'rejected'
          : 'approved';
        return entry.note || `Approval ${decision}`;
      }
      return entry.note || 'Status updated to completed';
    }
    if (entry.userRole === 'treasurer' && entry.field === 'approval_status') {
      const decision = `${entry.newValue || ''}`.toLowerCase().includes('reject')
        ? 'rejected'
        : 'approved';
      return entry.note || `Approval ${decision}`;
    }
    return entry.note || `${entry.userName} updated ${entry.field}`;
  };

  const notificationAction = canShowNotifications ? (
    <div className="relative" ref={notificationsRef}>
      <button
        type="button"
        className="relative h-9 w-9 rounded-full border border-[#D9E6FF] bg-white/90 text-muted-foreground hover:text-foreground shadow-sm flex items-center justify-center"
        onClick={() => setNotificationsOpen((prev) => !prev)}
        aria-label="Notifications"
      >
        <Bell className="h-4 w-4" />
        {hasNotifications && (
          <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-primary" />
        )}
      </button>
      {notificationsOpen && hasNotifications && (
        <div className="absolute right-0 mt-2 w-72 rounded-xl border border-[#C9D7FF] bg-[#F2F6FF]/95 backdrop-blur-xl p-3 shadow-lg z-50 animate-dropdown origin-top-right">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-primary/70">
              Notifications
            </span>
            <button
              className="text-primary/60 hover:text-primary"
              onClick={() => setNotificationsOpen(false)}
              type="button"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-3 space-y-2">
            {activeNotifications.map((entry: any) => (
              <Link
                key={entry.id}
                to={`/task/${entry.taskId}`}
                state={{ task: entry.task, highlightChangeId: entry.id }}
                onClick={() => setNotificationsOpen(false)}
                className="block rounded-lg border border-primary/15 bg-primary/5 px-3 py-2 transition hover:bg-primary/10"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-foreground">
                    {getNotificationTitle(entry)}
                  </p>
                  <ArrowUpRight className="mt-0.5 h-4 w-4 text-muted-foreground" />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {getNotificationNote(entry)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {format(new Date(entry.createdAt), 'MMM d, yyyy h:mm a')}
                </p>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  ) : null;

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return (
    <DashboardShell
      userInitial={user?.name?.charAt(0) || 'U'}
      headerActions={
        notificationAction || headerActions ? (
          <>
            {notificationAction}
            {headerActions}
          </>
        ) : null
      }
    >
      {children}
    </DashboardShell>
  );
}

function DashboardShell({
  children,
  userInitial,
  headerActions,
}: {
  children: ReactNode;
  userInitial: string;
  headerActions?: ReactNode;
}) {
  const { query, setQuery, items, scopeLabel } = useGlobalSearch();
  const [activeFilter, setActiveFilter] = useState<'all' | 'tasks' | 'people' | 'files' | 'categories' | 'more'>('all');
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isSearchDismissed, setIsSearchDismissed] = useState(false);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const searchValue = query.trim().toLowerCase();
  const filteredItems = useMemo(() => {
    if (!searchValue) return [];
    return items.filter((item) => {
      const haystack = [item.label, item.description, item.meta]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return searchValue
        .split(/\s+/)
        .filter(Boolean)
        .every((token) => haystack.includes(token));
    });
  }, [items, searchValue]);

  const groupedResults = useMemo(() => {
    const groups = {
      tasks: [] as typeof items,
      people: [] as typeof items,
      files: [] as typeof items,
      categories: [] as typeof items,
      more: [] as typeof items,
    };
    filteredItems.forEach((item) => {
      switch (item.kind) {
        case 'person':
          groups.people.push(item);
          break;
        case 'file':
          groups.files.push(item);
          break;
        case 'category':
          groups.categories.push(item);
          break;
        case 'task':
          groups.tasks.push(item);
          break;
        default:
          groups.more.push(item);
          break;
      }
    });
    return groups;
  }, [filteredItems, items]);

  const totalCount = filteredItems.length;
  const showPanel = (isSearchOpen || query.trim().length > 0) && !isSearchDismissed;
  const showPlaceholder = query.length === 0;
  const visibleGroups = useMemo(() => {
    if (activeFilter === 'people') return { People: groupedResults.people };
    if (activeFilter === 'files') return { Files: groupedResults.files };
    if (activeFilter === 'tasks') return { Requests: groupedResults.tasks };
    if (activeFilter === 'categories') return { Categories: groupedResults.categories };
    if (activeFilter === 'more') return { More: groupedResults.more };
    return {
      Requests: groupedResults.tasks,
      People: groupedResults.people,
      Files: groupedResults.files,
      Categories: groupedResults.categories,
      ...(groupedResults.more.length ? { More: groupedResults.more } : {}),
    };
  }, [activeFilter, groupedResults]);

  useEffect(() => {
    if (!query.trim()) {
      setActiveFilter('all');
    }
  }, [query]);

  const handleFocus = () => {
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current);
    }
    setIsSearchDismissed(false);
    setIsSearchOpen(true);
  };

  const handleBlur = () => {
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current);
    }
    blurTimeoutRef.current = setTimeout(() => {
      setIsSearchOpen(false);
    }, 160);
  };

  const handleContentScroll = () => {
    setIsSearchDismissed(true);
    setIsSearchOpen(false);
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'f') {
        return;
      }
      event.preventDefault();
      setIsSearchDismissed(false);
      setIsSearchOpen(true);
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const renderItem = (item: (typeof items)[number]) => {
    const content = (
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 rounded-full bg-[#EEF3FF] text-primary flex items-center justify-center">
          {item.kind === 'person' && <User className="h-4 w-4" />}
          {item.kind === 'file' && <FileText className="h-4 w-4" />}
          {item.kind === 'category' && <LayoutGrid className="h-4 w-4" />}
          {item.kind === 'task' && <ListTodo className="h-4 w-4" />}
          {(!item.kind || item.kind === 'activity' || item.kind === 'other') && (
            <ListTodo className="h-4 w-4" />
          )}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">{item.label}</p>
          {item.description && (
            <p className="text-xs text-muted-foreground truncate">{item.description}</p>
          )}
          {item.meta && (
            <p className="text-[11px] text-muted-foreground mt-0.5">{item.meta}</p>
          )}
        </div>
      </div>
    );

    if (!item.href) {
      return (
        <div
          key={item.id}
          className="px-3 py-2 border-t border-[#E4ECFF] hover:bg-[#EEF4FF]/80 transition"
        >
          {content}
        </div>
      );
    }

    return (
      <Link
        key={item.id}
        to={item.href}
        className="block px-3 py-2 border-t border-[#E4ECFF] hover:bg-[#EEF4FF]/80 transition"
        onClick={() => setQuery('')}
      >
        {content}
      </Link>
    );
  };

  const filterOptions = [
    {
      key: 'all',
      label: 'All',
      icon: Search,
      count: totalCount,
    },
    {
      key: 'people',
      label: 'People',
      icon: Users,
      count: groupedResults.people.length,
    },
    {
      key: 'files',
      label: 'Files',
      icon: FileText,
      count: groupedResults.files.length,
    },
    {
      key: 'tasks',
      label: 'Requests',
      icon: ListTodo,
      count: groupedResults.tasks.length,
    },
    {
      key: 'categories',
      label: 'Categories',
      icon: LayoutGrid,
      count: groupedResults.categories.length,
    },
  ];

  return (
    <div className="min-h-screen w-full bg-[radial-gradient(circle_at_top,_rgba(145,167,255,0.35),_transparent_55%),radial-gradient(circle_at_bottom,_rgba(196,218,255,0.45),_transparent_60%)] p-4 md:p-6">
      <div className="flex min-h-[calc(100vh-2rem)] gap-4 md:gap-6">
        <AppSidebar />
        <main className="flex-1 min-w-0 flex justify-center">
          <div className="w-full max-w-6xl h-full rounded-[32px] border border-[#D9E6FF] bg-white/85 shadow-[0_24px_60px_-40px_rgba(15,23,42,0.35)] flex flex-col overflow-hidden">
            <div className="shrink-0 border-b border-[#D9E6FF] bg-white/90 px-4 md:px-6 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="relative w-full max-w-md">
                  <div className="search-elastic group flex items-center gap-2 rounded-full border border-[#D9E6FF] bg-white/95 px-3 py-2 shadow-sm">
                    <Search className="search-elastic-icon h-4 w-4 text-muted-foreground" />
                    <div className="relative flex-1">
                      {showPlaceholder && (
                        <div className="search-placeholder">
                          <span className="search-placeholder-static">Search for</span>
                          <span className="search-placeholder-words">
                            <span className="search-placeholder-wordlist">
                              <span>tasks</span>
                              <span>files</span>
                            </span>
                          </span>
                        </div>
                      )}
                      <input
                        type="text"
                        aria-label="Search"
                        value={query}
                        onChange={(event) => {
                          setQuery(event.target.value);
                          setIsSearchDismissed(false);
                        }}
                        ref={searchInputRef}
                        onFocus={handleFocus}
                        onBlur={handleBlur}
                        onKeyDown={(event) => {
                          if (event.key === 'Escape') {
                            setQuery('');
                          }
                        }}
                        className="search-elastic-input w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
                      />
                    </div>
                    <span className="hidden sm:flex items-center gap-1 rounded-full bg-[#EFF4FF] px-2 py-0.5 text-[11px] text-muted-foreground">
                      <kbd className="font-sans">Ctrl</kbd>
                      <kbd className="font-sans">F</kbd>
                    </span>
                  </div>
                  {showPanel && (
                    <div
                      className="absolute left-0 right-0 mt-2 rounded-2xl border border-[#C9D7FF] bg-[#F6F8FF]/95 backdrop-blur-xl shadow-xl animate-dropdown overflow-hidden z-40"
                      onMouseDown={(event) => event.preventDefault()}
                    >
                      <div className="flex items-center justify-between px-3 pt-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                        <span>{scopeLabel}</span>
                        <span>{totalCount} results</span>
                      </div>
                      <div className="flex flex-wrap gap-2 px-3 pb-3">
                        {filterOptions.map((option) => {
                          const Icon = option.icon;
                          return (
                            <button
                              key={option.key}
                              type="button"
                              onClick={() => setActiveFilter(option.key as typeof activeFilter)}
                              className="search-chip"
                              data-active={activeFilter === option.key}
                            >
                              <Icon className="h-4 w-4" />
                              <span>{option.label}</span>
                              <span className="search-chip-count">{option.count}</span>
                            </button>
                          );
                        })}
                      </div>
                      <div className="max-h-72 overflow-auto scrollbar-none">
                        {Object.entries(visibleGroups).some(([, list]) => list.length > 0) ? (
                          Object.entries(visibleGroups).map(([title, list]) => {
                            if (list.length === 0) return null;
                            return (
                              <div key={title}>
                                <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                                  {title}
                                </div>
                                {list.slice(0, 6).map(renderItem)}
                              </div>
                            );
                          })
                        ) : (
                          <div className="px-3 py-4 text-sm text-muted-foreground border-t border-[#E4ECFF]">
                            No matches. Try a different term.
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {headerActions}
                  <Link
                    to="/help"
                    className="h-9 w-9 rounded-full border border-[#D9E6FF] bg-white/90 text-muted-foreground hover:text-foreground shadow-sm flex items-center justify-center"
                    aria-label="Help Center"
                  >
                    <HelpCircle className="h-4 w-4" />
                  </Link>
                  <div className="h-9 w-9 rounded-full border border-[#D9E6FF] bg-white/95 text-foreground font-semibold flex items-center justify-center shadow-sm">
                    {userInitial}
                  </div>
                </div>
              </div>
            </div>
            <div
              className="flex-1 overflow-auto scrollbar-none px-4 md:px-6"
              onScroll={handleContentScroll}
            >
              <div className="container py-6 px-4 md:px-8 max-w-6xl mx-auto">
                {children}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
