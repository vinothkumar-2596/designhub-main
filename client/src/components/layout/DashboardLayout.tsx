import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppSidebar } from './AppSidebar';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate, useNavigate } from 'react-router-dom';
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
  Sparkles,
  Database,
  Clock,
  PenLine,
} from 'lucide-react';
import { useGlobalSearch } from '@/contexts/GlobalSearchContext';
import { Link, useLocation } from 'react-router-dom';
import {
  clearScheduleNotifications,
  loadScheduleNotifications,
  SCHEDULE_NOTIFICATIONS_PREFIX,
} from '@/lib/designerSchedule';
import { mockTasks } from '@/data/mockTasks';
import { mergeLocalTasks } from '@/lib/taskStorage';
import { TaskBuddyModal } from '@/components/ai/TaskBuddyModal';
import { GeminiBlink } from '@/components/common/GeminiBlink';
import { UserAvatar } from '@/components/common/UserAvatar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ThemeToggle } from '@/components/theme/ThemeToggle';

import { API_URL, authFetch } from '@/lib/api';
import { createSocket } from '@/lib/socket';
import { cn } from '@/lib/utils';
import { GridSmallBackground } from '@/components/ui/background';
import { GlassCard } from 'react-glass-ui';

interface DashboardLayoutProps {
  children: ReactNode;
  headerActions?: ReactNode;
  background?: ReactNode;
  hideGrid?: boolean;
}

type NotificationItem = {
  id: string;
  userId?: string;
  title: string;
  message: string;
  type: string;
  link?: string;
  linkState?: unknown;
  taskId?: string;
  createdAt: Date;
  readAt?: Date | null;
};

type GlobalViewer = {
  userId: string;
  userName: string;
  userRole?: string;
  userEmail?: string;
  lastSeenAt?: string;
  avatar?: string;
};

export function DashboardLayout({
  children,
  headerActions,
  background,
  hideGrid = false,
}: DashboardLayoutProps) {
  const { isAuthenticated, user } = useAuth();
  const apiUrl = API_URL;
  const [tasks, setTasks] = useState(mockTasks);
  const [storageTick, setStorageTick] = useState(0);
  const [useLocalData, setUseLocalData] = useState(!apiUrl);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [serverNotifications, setServerNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [globalViewers, setGlobalViewers] = useState<GlobalViewer[]>([]);
  const [globalTypers, setGlobalTypers] = useState<GlobalViewer[]>([]);
  const notificationsRef = useRef<HTMLDivElement | null>(null);
  const autoPreviewShownRef = useRef(false);
  const previewTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isTaskBuddyOpen, setIsTaskBuddyOpen] = useState(false);
  const [isGuidelinesOpen, setIsGuidelinesOpen] = useState(false);
  const lastFetchedAtRef = useRef<string | null>(null);
  const notificationsSocketRef = useRef<ReturnType<typeof createSocket> | null>(null);
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const userId = user?.id || (user as { _id?: string } | null)?._id || '';
  const useServerNotifications = Boolean(apiUrl);
  const contentScrollRef = useRef<HTMLDivElement | null>(null);


  const normalizeNotification = useCallback((entry: any): NotificationItem => {
    const createdAt = entry?.createdAt ? new Date(entry.createdAt) : new Date();
    const readAt = entry?.readAt ? new Date(entry.readAt) : null;
    const rawLink = entry?.link || '';
    const rawTaskId = entry?.taskId || entry?.taskID || entry?.task_id || '';
    let normalizedLink = rawLink;
    if (normalizedLink && normalizedLink.startsWith('http')) {
      try {
        const url = new URL(normalizedLink);
        normalizedLink = `${url.pathname}${url.search}${url.hash}`;
      } catch {
        // ignore invalid URL
      }
    }
    const inferredTaskId =
      rawTaskId ||
      (normalizedLink.startsWith('/task/')
        ? normalizedLink.replace('/task/', '').split(/[?#]/)[0]
        : '');
    const resolvedLink = normalizedLink || (inferredTaskId ? `/task/${inferredTaskId}` : '');
    return {
      id: entry?.id || entry?._id || `${entry?.userId || 'note'}-${createdAt.getTime()}`,
      userId: entry?.userId,
      title: entry?.title || 'Notification',
      message: entry?.message || '',
      type: entry?.type || 'system',
      link: resolvedLink,
      taskId: inferredTaskId || undefined,
      createdAt,
      readAt,
    };
  }, []);

  const updateLastFetchedAt = useCallback((items: NotificationItem[]) => {
    if (!items || items.length === 0) return;
    const latest = items.reduce((max, item) => {
      const time = new Date(item.createdAt).getTime();
      return time > max ? time : max;
    }, lastFetchedAtRef.current ? new Date(lastFetchedAtRef.current).getTime() : 0);
    if (Number.isFinite(latest) && latest > 0) {
      lastFetchedAtRef.current = new Date(latest).toISOString();
    }
  }, []);

  const mergeNotifications = useCallback((incoming: NotificationItem[], limit = 20) => {
    if (!incoming || incoming.length === 0) return;
    setServerNotifications((prev) => {
      const map = new Map(prev.map((item) => [item.id, item]));
      incoming.forEach((item) => {
        map.set(item.id, item);
      });
      const merged = Array.from(map.values()).sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      return merged.slice(0, limit);
    });
  }, []);

  const fetchUnreadCount = useCallback(async () => {
    if (!apiUrl || !userId) return;
    try {
      const response = await authFetch(`${apiUrl}/api/notifications/unread-count`);
      if (!response.ok) return;
      const data = await response.json();
      setUnreadCount(Number(data?.count || 0));
    } catch (error) {
      console.error('Notification unread count failed:', error);
    }
  }, [apiUrl, userId]);

  const fetchNotifications = useCallback(
    async (after?: string | null) => {
      if (!apiUrl || !userId) return;
      try {
        const params = new URLSearchParams();
        if (after) params.set('after', after);
        params.set('limit', '20');
        const response = await authFetch(`${apiUrl}/api/notifications?${params.toString()}`);
        if (!response.ok) return;
        const data = await response.json();
        if (!Array.isArray(data)) return;
        const normalized = data.map(normalizeNotification);
        if (after) {
          mergeNotifications(normalized);
          const newUnread = normalized.filter((item) => !item.readAt).length;
          if (newUnread > 0) {
            setUnreadCount((prev) => prev + newUnread);
          }
        } else {
          setServerNotifications(normalized);
          setUnreadCount(normalized.filter((item) => !item.readAt).length);
        }
        updateLastFetchedAt(normalized);
      } catch (error) {
        console.error('Notification fetch failed:', error);
      }
    },
    [apiUrl, userId, mergeNotifications, normalizeNotification, updateLastFetchedAt]
  );

  const markNotificationRead = useCallback(
    async (note: NotificationItem) => {
      if (!useServerNotifications || !apiUrl || !note.id || note.readAt) return;
      const readAt = new Date();
      setServerNotifications((prev) =>
        prev.map((item) => (item.id === note.id ? { ...item, readAt } : item))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
      try {
        await authFetch(`${apiUrl}/api/notifications/${note.id}/read`, {
          method: 'PATCH',
        });
      } catch (error) {
        console.error('Failed to mark notification read:', error);
      }
    },
    [apiUrl, useServerNotifications]
  );

  const markAllNotificationsRead = useCallback(async () => {
    if (!useServerNotifications || !apiUrl || unreadCount === 0) return;
    const readAt = new Date();
    setServerNotifications((prev) => prev.map((item) => ({ ...item, readAt })));
    setUnreadCount(0);
    try {
      await authFetch(`${apiUrl}/api/notifications/mark-all-read`, {
        method: 'PATCH',
      });
    } catch (error) {
      console.error('Failed to mark all notifications read:', error);
    }
  }, [apiUrl, unreadCount, useServerNotifications]);

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
    if (!apiUrl || !userId) {
      setServerNotifications([]);
      setUnreadCount(0);
      lastFetchedAtRef.current = null;
      return;
    }
    lastFetchedAtRef.current = null;
    fetchNotifications(null);
    fetchUnreadCount();
  }, [apiUrl, userId, fetchNotifications, fetchUnreadCount]);

  useEffect(() => {
    if (!apiUrl || !userId) return;
    const socket = createSocket(apiUrl);
    notificationsSocketRef.current = socket;

    const handleConnect = () => {
      setIsRealtimeConnected(true);
      console.log('Socket connected');
      socket.emit('join', { userId });
      console.log('Joined room', userId);
      if (user?.email) {
        socket.emit('join', { userId: user.email });
        console.log('Joined room', user.email);
      }
      if (user?.role === 'designer') {
        socket.emit('join', { userId: 'designers:queue' });
        console.log('Joined room designers:queue');
      }
      socket.emit('presence:global:join', {
        userId,
        userName: user?.name,
        userRole: user?.role,
        userEmail: user?.email,
        avatar: user?.avatar,
      });
      socket.emit('notifications:join', { userId });
      fetchNotifications(lastFetchedAtRef.current);
      fetchUnreadCount();
    };

    const handleDisconnect = () => {
      setIsRealtimeConnected(false);
      setGlobalViewers([]);
      setGlobalTypers([]);
    };

    const handleNewNotification = (payload: any) => {
      const normalized = normalizeNotification(payload);
      mergeNotifications([normalized]);
      if (!normalized.readAt) {
        setUnreadCount((prev) => prev + 1);
      }
      updateLastFetchedAt([normalized]);
    };

    const handleNewRequest = (payload: any) => {
      console.log('Received request:new');
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('designhub:request:new', { detail: payload }));
      }
    };

    const handleTaskUpdated = (payload: any) => {
      if (!payload?.task) return;
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('designhub:task:updated', { detail: payload.task }));
      }
    };

    const handleGlobalPresenceUpdate = (payload: any) => {
      const viewers = Array.isArray(payload?.viewers) ? payload.viewers : [];
      setGlobalViewers(
        viewers.map((viewer: any) => ({
          userId: viewer.userId,
          userName: viewer.userName || 'Someone',
          userRole: viewer.userRole,
          userEmail: viewer.userEmail,
          avatar: viewer.avatar || (viewer.userId === userId ? user?.avatar : undefined),
          lastSeenAt: viewer.lastSeenAt,
        }))
      );
    };

    const handleGlobalTypingUpdate = (payload: any) => {
      const typers = Array.isArray(payload?.typers) ? payload.typers : [];
      setGlobalTypers(
        typers.map((viewer: any) => ({
          userId: viewer.userId,
          userName: viewer.userName || 'Someone',
          userRole: viewer.userRole,
          userEmail: viewer.userEmail,
          avatar: viewer.avatar || (viewer.userId === userId ? user?.avatar : undefined),
          lastSeenAt: viewer.lastTypingAt,
        }))
      );
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('notification:new', handleNewNotification);
    socket.on('request:new', handleNewRequest);
    socket.on('task:updated', handleTaskUpdated);
    socket.on('presence:global:update', handleGlobalPresenceUpdate);
    socket.on('typing:global:update', handleGlobalTypingUpdate);

    return () => {
      socket.emit('presence:global:leave', { userId });
      socket.emit('notifications:leave', { userId });
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('notification:new', handleNewNotification);
      socket.off('request:new', handleNewRequest);
      socket.off('task:updated', handleTaskUpdated);
      socket.off('presence:global:update', handleGlobalPresenceUpdate);
      socket.off('typing:global:update', handleGlobalTypingUpdate);
      socket.disconnect();
      notificationsSocketRef.current = null;
      setIsRealtimeConnected(false);
    };
  }, [
    apiUrl,
    userId,
    user?.email,
    user?.name,
    user?.role,
    user?.avatar,
    fetchNotifications,
    fetchUnreadCount,
    mergeNotifications,
    normalizeNotification,
    updateLastFetchedAt,
  ]);

  useEffect(() => {
    if (!isRealtimeConnected || !notificationsSocketRef.current || !userId) return;
    notificationsSocketRef.current.emit('presence:global:join', {
      userId,
      userName: user?.name,
      userRole: user?.role,
      userEmail: user?.email,
      avatar: user?.avatar,
    });
  }, [isRealtimeConnected, userId, user?.name, user?.role, user?.email, user?.avatar]);

  useEffect(() => {
    if (!apiUrl || !userId || isRealtimeConnected) return;
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
    }
    pollingRef.current = setInterval(() => {
      fetchNotifications(lastFetchedAtRef.current);
    }, 30000);
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [apiUrl, userId, isRealtimeConnected, fetchNotifications]);

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
        const response = await authFetch(`${apiUrl}/api/tasks`);
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
      } catch (error) {
        console.error('❌ DashboardLayout load error:', error);
        setUseLocalData(true);
      }
    };
    loadTasks();
  }, [apiUrl]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!contentScrollRef.current) return;
    const frame = window.requestAnimationFrame(() => {
      contentScrollRef.current?.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [location.pathname, location.search]);

  const hydratedTasks = useMemo(() => {
    if (!useLocalData) return tasks;
    if (typeof window === 'undefined') return mockTasks;
    return mergeLocalTasks(mockTasks);
  }, [useLocalData, storageTick, tasks]);

  const taskIndex = useMemo(() => {
    const byId = new Map<string, any>();
    const byTitle = new Map<string, any>();
    hydratedTasks.forEach((task) => {
      const id = String(task?.id || task?._id || '').trim();
      if (id) {
        byId.set(id, task);
      }
      const title = String(task?.title || '').trim();
      if (title) {
        const key = title.toLowerCase();
        if (!byTitle.has(key)) {
          byTitle.set(key, task);
        }
      }
    });
    return { byId, byTitle };
  }, [hydratedTasks]);

  const globalPresenceList = useMemo(() => {
    const list = [...globalViewers];
    list.sort((a, b) => {
      if (a.userId === userId) return -1;
      if (b.userId === userId) return 1;
      return (a.userName || '').localeCompare(b.userName || '');
    });
    return list;
  }, [globalViewers, userId]);

  const globalPresenceSummary = useMemo(() => {
    const visible = globalPresenceList.slice(0, 4);
    return {
      visible,
      extraCount: Math.max(0, globalPresenceList.length - visible.length),
    };
  }, [globalPresenceList]);

  const globalTypingList = useMemo(() => {
    const list = [...globalTypers];
    list.sort((a, b) => {
      if (a.userId === userId) return -1;
      if (b.userId === userId) return 1;
      return (a.userName || '').localeCompare(b.userName || '');
    });
    return list;
  }, [globalTypers, userId]);

  const globalTypingSummary = useMemo(() => {
    const visible = globalTypingList.slice(0, 4);
    return {
      visible,
      extraCount: Math.max(0, globalTypingList.length - visible.length),
      total: globalTypingList.length,
    };
  }, [globalTypingList]);

  const extractTitleFromNotification = useCallback((title: string) => {
    if (!title) return '';
    const colonIndex = title.indexOf(':');
    if (colonIndex >= 0 && colonIndex < title.length - 1) {
      return title.slice(colonIndex + 1).trim();
    }
    const onMatch = title.match(/message on\s(.+)$/i);
    if (onMatch && onMatch[1]) {
      return onMatch[1].trim();
    }
    return '';
  }, []);

  const resolveNotificationTarget = useCallback(
    (entry: NotificationItem) => {
      let link = entry.link || '';
      let taskId = entry.taskId || '';
      if (link && !link.startsWith('/') && !link.startsWith('http')) {
        link = `/${link}`;
      }
      if (!taskId && link) {
        const match = link.match(/\/task\/([^/?#]+)/);
        if (match && match[1]) {
          taskId = match[1];
        }
      }
      let task = taskId ? taskIndex.byId.get(taskId) : undefined;
      if (!task) {
        const candidate = extractTitleFromNotification(entry.title || '');
        if (candidate) {
          task = taskIndex.byTitle.get(candidate.toLowerCase());
          if (task) {
            taskId = String(task?.id || task?._id || taskId);
          }
        }
      }
      if (!task && taskId) {
        task = taskIndex.byId.get(taskId);
      }
      if (!link && taskId) {
        link = `/task/${taskId}`;
      }
      return { link, taskId, task };
    },
    [extractTitleFromNotification, taskIndex]
  );

  const getLatestEntry = (entries: any[]) => {
    if (entries.length === 0) return null;
    return entries.reduce((latest, current) => {
      const latestTime = new Date(latest.createdAt ?? 0).getTime();
      const currentTime = new Date(current.createdAt ?? 0).getTime();
      return currentTime > latestTime ? current : latest;
    }, entries[0]);
  };

  const staffNotifications = useMemo(() => {
    if (useServerNotifications || !user || user.role !== 'staff') return [];
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
  }, [hydratedTasks, user, useServerNotifications]);

  const buildCommentNotifications = (role: 'designer' | 'treasurer') =>
    hydratedTasks
      .flatMap((task) => {
        const comments = task.comments || [];
        const roleComments = comments.filter((comment: any) => {
          if (comment.userRole !== 'staff') return false;
          if (Array.isArray(comment.receiverRoles) && comment.receiverRoles.length > 0) {
            return comment.receiverRoles.includes(role);
          }
          return true;
        });
        if (roleComments.length === 0) {
          return [];
        }
        const latest = roleComments.reduce((current: any, next: any) => {
          const currentTime = new Date(current.createdAt ?? 0).getTime();
          const nextTime = new Date(next.createdAt ?? 0).getTime();
          return nextTime > currentTime ? next : current;
        });
        return [
          {
            id: latest.id || `${task.id}-comment-${latest.createdAt ?? ''}`,
            taskId: task.id,
            taskTitle: task.title,
            task,
            field: 'comment',
            note: latest.content,
            userName: latest.userName,
            userRole: latest.userRole,
            createdAt: latest.createdAt,
          },
        ];
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const designerNotifications = useMemo(() => {
    if (useServerNotifications || !user || user.role !== 'designer') return [];
    const base = hydratedTasks
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
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const comments = buildCommentNotifications('designer');
    return [...base, ...comments]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 3);
  }, [hydratedTasks, user, useServerNotifications]);

  const treasurerNotifications = useMemo(() => {
    if (useServerNotifications || !user || user.role !== 'treasurer') return [];
    const base = hydratedTasks
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
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const comments = buildCommentNotifications('treasurer');
    return [...base, ...comments]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 3);
  }, [hydratedTasks, user, useServerNotifications]);

  const localNotifications =
    user?.role === 'staff'
      ? staffNotifications
      : user?.role === 'designer'
        ? designerNotifications
        : user?.role === 'treasurer'
          ? treasurerNotifications
          : [];

  const activeNotifications = useServerNotifications ? serverNotifications : localNotifications;
  const hasNotifications = activeNotifications.length > 0;
  const displayUnreadCount = useServerNotifications ? unreadCount : activeNotifications.length;
  const canShowNotifications =
    user?.role === 'staff' ||
    user?.role === 'designer' ||
    user?.role === 'treasurer' ||
    user?.role === 'admin';

  const getNotificationTitle = (entry: any) => {
    if (entry.field === 'comment') {
      return `${entry.userName || 'Staff'} messaged ${entry.taskTitle}`;
    }
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
    if (entry.field === 'comment') {
      return entry.note || 'New message received.';
    }
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

  const uiNotifications = useMemo(() => {
    const baseNotifications = useServerNotifications
      ? activeNotifications.map((entry: any) => normalizeNotification(entry))
      : activeNotifications.map((entry: any) => ({
        id: entry.id || `${entry.taskId}-${entry.createdAt}`,
        title: getNotificationTitle(entry),
        message: getNotificationNote(entry),
        type: entry.field || 'task',
        link: entry.taskId ? `/task/${entry.taskId}` : '',
        linkState: entry.taskId ? { task: entry.task, highlightChangeId: entry.id } : undefined,
        createdAt: new Date(entry.createdAt),
        readAt: null,
      }));

    return baseNotifications.map((entry) => {
      const resolved = resolveNotificationTarget(entry);
      const linkState =
        entry.linkState ?? (resolved.task ? { task: resolved.task } : undefined);
      return {
        ...entry,
        link: resolved.link || entry.link,
        taskId: resolved.taskId || entry.taskId,
        linkState,
      };
    });
  }, [
    activeNotifications,
    getNotificationNote,
    getNotificationTitle,
    normalizeNotification,
    resolveNotificationTarget,
    useServerNotifications,
  ]);

  const isNotificationNow = (createdAt: Date | string) => {
    const createdTime = new Date(createdAt).getTime();
    if (!Number.isFinite(createdTime)) return false;
    const diffMs = Date.now() - createdTime;
    return diffMs >= 0 && diffMs <= 2 * 60 * 1000;
  };

  useEffect(() => {
    if (!user || !hasNotifications) return;
    if (user.role === 'staff') return;
    if (useServerNotifications && displayUnreadCount === 0) return;
    if (autoPreviewShownRef.current) return;
    if (typeof window === 'undefined') return;
    const lastSeenKey = `designhub.notifications.lastSeen.${user.id}`;
    const lastSeenValue = Number(window.localStorage.getItem(lastSeenKey) || 0);
    const latestCreatedAt = Math.max(
      ...uiNotifications.map((entry) => new Date(entry.createdAt ?? 0).getTime())
    );
    if (!Number.isFinite(latestCreatedAt) || latestCreatedAt <= lastSeenValue) {
      return;
    }
    autoPreviewShownRef.current = true;
    setNotificationsOpen(true);
    window.localStorage.setItem(lastSeenKey, String(latestCreatedAt));
    if (previewTimeoutRef.current) {
      clearTimeout(previewTimeoutRef.current);
    }
    previewTimeoutRef.current = setTimeout(() => {
      setNotificationsOpen(false);
      previewTimeoutRef.current = null;
    }, 10000);
    return () => {
      if (previewTimeoutRef.current) {
        clearTimeout(previewTimeoutRef.current);
        previewTimeoutRef.current = null;
      }
    };
  }, [displayUnreadCount, hasNotifications, uiNotifications, useServerNotifications, user]);

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

  const headerPresenceAction = useMemo(() => {
    if (!user) return null;
    const isTyping = globalTypingSummary.total > 0;
    const avatars = isTyping ? globalTypingSummary.visible : globalPresenceSummary.visible;
    if (avatars.length === 0) return null;
    const extraCount = isTyping ? globalTypingSummary.extraCount : globalPresenceSummary.extraCount;
    const label = isTyping
      ? (() => {
        const preferred =
          globalTypingList.find((viewer) => viewer.userId !== userId) || globalTypingList[0];
        const rawName = (preferred?.userName || 'Someone').trim();
        const shortName = rawName ? rawName.slice(0, 5) : 'User';
        return `${shortName} typing...`;
      })()
      : 'Currently viewing';
    return (
      <div className="flex items-center gap-2 rounded-full border border-[#D9E6FF] bg-white/95 dark:bg-slate-900/70 dark:border-white/10 dark:text-white px-3 py-1.5 shadow-sm">
        <span
          className={
            (isTyping
              ? 'text-xs font-semibold text-muted-foreground'
              : 'text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground') +
            ' whitespace-nowrap'
          }
        >
          {label}
        </span>
        {isTyping && (
          <span className="flex items-center gap-1 typing-dots">
            <span className="h-1.5 w-1.5 rounded-full bg-primary/60" />
            <span className="h-1.5 w-1.5 rounded-full bg-primary/60" />
            <span className="h-1.5 w-1.5 rounded-full bg-primary/60" />
          </span>
        )}
        <div className="flex -space-x-2">
          {avatars.map((viewer) => {
            const isSelf = viewer.userId === userId;
            const avatarSrc = isSelf ? user?.avatar || viewer.avatar : viewer.avatar;
            const labelRole =
              viewer.userRole
                ? viewer.userRole.charAt(0).toUpperCase() + viewer.userRole.slice(1)
                : 'User';
            return (
              <Tooltip key={viewer.userId}>
                <TooltipTrigger asChild>
                  <span
                    className={cn('inline-flex rounded-full', isSelf ? '' : 'presence-highlight')}
                  >
                    <UserAvatar
                      name={viewer.userName}
                      avatar={avatarSrc}
                      className={cn(
                        'h-6 w-6 border-2 border-white shadow-sm bg-white/90 dark:border-white/10 dark:bg-slate-900/80',
                        isSelf && 'ring-2 ring-primary/40'
                      )}
                      fallbackClassName="bg-primary/10 text-primary text-[9px] font-semibold"
                    />
                  </span>
                </TooltipTrigger>
                <TooltipContent side="bottom" align="end">
                  <div className="text-xs font-semibold">
                    {viewer.userName}
                    {isSelf ? ' (you)' : ''}
                  </div>
                  <div className="text-[11px] text-muted-foreground">{labelRole}</div>
                  {viewer.userEmail && (
                    <div className="text-[11px] text-muted-foreground">{viewer.userEmail}</div>
                  )}
                </TooltipContent>
              </Tooltip>
            );
          })}
          {extraCount > 0 && (
            <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-white dark:border-white/10 bg-[#E6F1FF] dark:bg-slate-900/70 text-[9px] font-semibold text-primary shadow-sm">
              +{extraCount}
            </div>
          )}
        </div>
      </div>
    );
  }, [globalPresenceSummary, globalTypingSummary, user, userId]);

  useEffect(() => {
    const onOpenGuidelines = () => {
      setIsGuidelinesOpen(true);
    };
    window.addEventListener('designhub:open-guidelines', onOpenGuidelines as EventListener);
    return () =>
      window.removeEventListener('designhub:open-guidelines', onOpenGuidelines as EventListener);
  }, []);

  const notificationAction = canShowNotifications ? (
    <div className="relative" ref={notificationsRef}>
      <button
        type="button"
        className="relative h-9 w-9 rounded-full border border-[#D9E6FF] bg-white/90 dark:bg-muted/80 dark:border-border text-muted-foreground shadow-none flex items-center justify-center transition active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 hover:text-muted-foreground dark:hover:text-muted-foreground"
        onClick={() => {
          const nextOpen = !notificationsOpen;
          setNotificationsOpen(nextOpen);
          if (nextOpen && useServerNotifications) {
            fetchNotifications(lastFetchedAtRef.current);
            fetchUnreadCount();
          }
          if (nextOpen && user && typeof window !== 'undefined') {
            const lastSeenKey = `designhub.notifications.lastSeen.${user.id}`;
            const latestCreatedAt = Math.max(
              ...uiNotifications.map((entry) =>
                new Date(entry.createdAt ?? 0).getTime()
              )
            );
            if (Number.isFinite(latestCreatedAt)) {
              window.localStorage.setItem(lastSeenKey, String(latestCreatedAt));
            }
          }
        }}
        aria-label="Notifications"
      >
        <Bell className="h-4 w-4" />
        {displayUnreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-white shadow-sm">
            {displayUnreadCount > 99 ? '99+' : displayUnreadCount}
          </span>
        )}
      </button>
      {notificationsOpen && (
        <div className="absolute right-0 mt-2 w-72 rounded-xl border border-[#C9D7FF] bg-[#F2F6FF]/95 dark:bg-card/95 dark:border-border backdrop-blur-xl p-3 shadow-lg z-50 animate-dropdown origin-top-right">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-primary/70">
              Notifications
            </span>
            <div className="flex items-center gap-2">
              {useServerNotifications && unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllNotificationsRead}
                  className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary/70 hover:text-primary"
                >
                  Mark all read
                </button>
              )}
              <button
                className="text-primary/60 hover:text-primary"
                onClick={() => setNotificationsOpen(false)}
                type="button"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="mt-3 space-y-2 max-h-[420px] overflow-y-auto pr-2 scrollbar-thin">
            {uiNotifications.length > 0 ? (
              uiNotifications.map((entry, idx) => (
                <button
                  key={entry.id || `notif-${idx}`}
                  type="button"
                  onClick={() => {
                    markNotificationRead(entry);
                    setNotificationsOpen(false);
                    if (entry.link) {
                      navigate(entry.link, entry.linkState ? { state: entry.linkState } : undefined);
                    }
                  }}
                  className={cn(
                    'block w-full rounded-lg border px-3 py-2 text-left transition',
                    entry.readAt
                      ? 'border-primary/10 bg-white/70 hover:bg-white dark:border-border dark:bg-slate-900/60 dark:hover:bg-slate-900/80'
                      : 'border-primary/20 bg-primary/5 hover:bg-primary/10 dark:border-primary/30 dark:bg-primary/10 dark:hover:bg-primary/20'
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-foreground">
                      {`${entry.title
                        .replace(/\s*:\s*now$/i, '')
                        .replace(/\s+now$/i, '')}${isNotificationNow(entry.createdAt) ? ': now' : ''}`}
                    </p>
                    <ArrowUpRight className="mt-0.5 h-4 w-4 text-muted-foreground" />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {entry.message}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {format(new Date(entry.createdAt), 'MMM d, yyyy h:mm a')}
                  </p>
                </button>
              ))
            ) : (
              <div className="rounded-lg border border-dashed border-[#D9E6FF] bg-white/70 dark:bg-card/80 dark:border-border px-3 py-4 text-xs text-muted-foreground text-center">
                No notifications yet.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  ) : null;

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <DashboardShell
      userInitial={user?.name?.charAt(0) || 'U'}
      background={background}
      contentScrollRef={contentScrollRef}
      hideGrid={hideGrid}
      onContentScroll={() => {
        if (previewTimeoutRef.current) {
          clearTimeout(previewTimeoutRef.current);
          previewTimeoutRef.current = null;
        }
        setNotificationsOpen(false);
      }}
      headerActions={
        <>
          {location.pathname !== '/new-request' && (
            <GeminiBlink onClick={() => setIsTaskBuddyOpen(true)} className="mr-2" />
          )}
          <ThemeToggle className="mr-2" />
          {headerPresenceAction}
          {notificationAction}
          {headerActions}
        </>
      }
    >
      {children}
      {isGuidelinesOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <button
            type="button"
            aria-label="Close guidelines"
            onClick={() => setIsGuidelinesOpen(false)}
            className="absolute inset-0 bg-slate-900/25 backdrop-blur-sm"
          />
          <div className="relative w-full max-w-3xl rounded-[28px] border border-[#D9E6FF] bg-white dark:bg-card dark:border-border shadow-[0_22px_48px_-28px_rgba(15,23,42,0.25)]">
            <div className="absolute inset-0 rounded-[28px] bg-[radial-gradient(circle_at_top_left,_rgba(214,227,255,0.6),_transparent_55%),radial-gradient(circle_at_bottom_right,_rgba(240,244,255,0.9),_transparent_60%)] dark:hidden" />
            <div className="relative overflow-hidden rounded-[26px] border border-[#D9E6FF] bg-white/90 dark:bg-card dark:border-border backdrop-blur-xl">
              <div className="flex items-start justify-between gap-4 px-8 py-8">
                <div className="max-w-xl">
                  <h3 className="text-lg font-extrabold text-[#1E2A5A] dark:text-foreground">
                    Submission Guidelines
                  </h3>
                  <p className="mt-1 text-xs text-[#6B7A99] dark:text-muted-foreground">
                    Please follow these before submitting.
                  </p>
                </div>
                <button
                  type="button"
                  className="text-[#6B7A99] hover:text-[#1E2A5A] rounded-full p-2 bg-[#EEF4FF] hover:bg-[#E5ECFF] dark:text-muted-foreground dark:bg-slate-800 dark:hover:bg-slate-700"
                  onClick={() => setIsGuidelinesOpen(false)}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="px-8 pb-10">
                <div className="grid gap-4 md:grid-cols-[1.2fr,0.8fr] items-center">
                  <div className="rounded-2xl border border-[#D9E6FF] bg-white/70 text-sm text-[#4B5A78] divide-y divide-[#D9E6FF] dark:border-border dark:bg-slate-900/70 dark:text-muted-foreground dark:divide-border">
                    <div className="flex items-start gap-3 px-5 py-5">
                      <Database className="mt-0.5 h-7 w-7 text-primary" />
                      <span>
                        <span className="font-semibold text-[#2F3A56] dark:text-foreground">Data Requirements:</span>{' '}
                        Include all text content, images, logos, and reference files.
                      </span>
                    </div>
                    <div className="flex items-start gap-3 px-5 py-5">
                      <Clock className="mt-0.5 h-7 w-7 text-primary" />
                      <span>
                        <span className="font-semibold text-[#2F3A56] dark:text-foreground">Timeline:</span>{' '}
                        Minimum 3 working days for standard requests. Urgent requests require justification.
                      </span>
                    </div>
                    <div className="flex items-start gap-3 px-5 py-5">
                      <PenLine className="mt-0.5 h-7 w-7 text-primary" />
                      <span>
                        <span className="font-semibold text-[#2F3A56] dark:text-foreground">Modifications:</span>{' '}
                        Changes to approved designs require Treasurer approval first.
                      </span>
                    </div>
                  </div>
                  <div className="relative hidden md:block">
                    <div className="absolute -right-6 top-8 h-32 w-56 rounded-[28px] border border-white/70 bg-white/70 dark:hidden" />
                    <div className="guideline-preview-card relative rounded-[32px] bg-white p-6 dark:bg-slate-900 dark:border dark:border-slate-800/70">
                      <div className="flex items-center gap-3">
                        <div className="h-11 w-11 rounded-full bg-[#EEF4FF] flex items-center justify-center text-[#2F3A56] dark:bg-slate-800 dark:text-slate-200">
                          <Sparkles className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="guideline-shimmer h-3 w-24 rounded-full bg-[#EEF4FF] dark:bg-slate-800" />
                          <div className="guideline-shimmer mt-2 h-2 w-32 rounded-full bg-[#EEF4FF] dark:bg-slate-800" />
                        </div>
                        <span className="guideline-toggle-pulse ml-auto h-7 w-10 rounded-full bg-[#EAF1FF] dark:bg-slate-800" />
                      </div>
                      <div className="guideline-shimmer mt-4 h-2 w-28 rounded-full bg-[#EEF4FF] dark:bg-slate-800" />
                    </div>
                    <div className="guideline-preview-card guideline-preview-card--delay relative mt-3 ml-6 rounded-[32px] bg-white p-6 dark:bg-slate-900 dark:border dark:border-slate-800/70">
                      <div className="flex items-center gap-3">
                        <div className="h-11 w-11 rounded-full bg-[#EEF4FF] flex items-center justify-center text-[#2F3A56] dark:bg-slate-800 dark:text-slate-200">
                          <Clock className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="guideline-shimmer h-3 w-24 rounded-full bg-[#EEF4FF] dark:bg-slate-800" />
                          <div className="guideline-shimmer mt-2 h-2 w-32 rounded-full bg-[#EEF4FF] dark:bg-slate-800" />
                        </div>
                        <span className="guideline-toggle-pulse ml-auto h-7 w-10 rounded-full bg-[#EAF1FF] dark:bg-slate-800" />
                      </div>
                      <div className="guideline-shimmer mt-4 h-2 w-24 rounded-full bg-[#EEF4FF] dark:bg-slate-800" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      <TaskBuddyModal
        isOpen={isTaskBuddyOpen}
        onClose={() => setIsTaskBuddyOpen(false)}
        onTaskCreated={(draft) => {
          console.log('AI Draft created:', draft);
          setIsTaskBuddyOpen(false);
          toast.success('Draft created! Navigate to New Request to use it.');
        }}
        onOpenUploader={() => {
          navigate('/new-request');
          window.setTimeout(() => {
            window.dispatchEvent(new CustomEvent('designhub:open-uploader'));
          }, 350);
        }}
      />
    </DashboardShell>
  );
}

function DashboardShell({
  children,
  userInitial,
  headerActions,
  onContentScroll,
  background,
  contentScrollRef,
  hideGrid = false,
}: {
  children: ReactNode;
  userInitial: string;
  headerActions?: ReactNode;
  onContentScroll?: () => void;
  background?: ReactNode;
  contentScrollRef?: React.RefObject<HTMLDivElement>;
  hideGrid?: boolean;
}) {
  const { query, setQuery, items, scopeLabel } = useGlobalSearch();
  const [activeFilter, setActiveFilter] = useState<'all' | 'tasks' | 'people' | 'files' | 'categories' | 'more'>('all');
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isSearchDismissed, setIsSearchDismissed] = useState(false);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const searchContainerRef = useRef<HTMLDivElement | null>(null);

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
    onContentScroll?.();
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

  useEffect(() => {
    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      if (!showPanel) return;
      if (!searchContainerRef.current) return;
      if (searchContainerRef.current.contains(event.target as Node)) return;
      setIsSearchOpen(false);
      setIsSearchDismissed(true);
      setQuery('');
      setActiveFilter('all');
      searchInputRef.current?.blur();
    };
    document.addEventListener('mousedown', onPointerDown, true);
    document.addEventListener('touchstart', onPointerDown, true);
    return () => {
      document.removeEventListener('mousedown', onPointerDown, true);
      document.removeEventListener('touchstart', onPointerDown, true);
    };
  }, [showPanel]);

  useEffect(() => {
    setIsSearchOpen(false);
    setIsSearchDismissed(true);
    setQuery('');
    setActiveFilter('all');
  }, [location.pathname]);

  useEffect(() => {
    const onOpenSearch = () => {
      setIsSearchDismissed(false);
      setIsSearchOpen(true);
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    };
    window.addEventListener('designhub:open-search', onOpenSearch as EventListener);
    return () =>
      window.removeEventListener('designhub:open-search', onOpenSearch as EventListener);
  }, []);

  const highlightText = (text: string) => {
    const rawQuery = query.trim();
    if (!rawQuery) return text;
    const lowerText = text.toLowerCase();
    const lowerQuery = rawQuery.toLowerCase();
    const parts: ReactNode[] = [];
    let index = 0;

    while (index < text.length) {
      const matchIndex = lowerText.indexOf(lowerQuery, index);
      if (matchIndex === -1) {
        parts.push(text.slice(index));
        break;
      }
      if (matchIndex > index) {
        parts.push(text.slice(index, matchIndex));
      }
      const matchText = text.slice(matchIndex, matchIndex + rawQuery.length);
      parts.push(
        <mark
          key={`${matchIndex}-${matchText}`}
          className="rounded bg-amber-200/70 text-slate-900 dark:bg-amber-300/30 dark:text-amber-100 px-0.5"
        >
          {matchText}
        </mark>
      );
      index = matchIndex + rawQuery.length;
    }

    return parts;
  };

  const renderItem = (item: (typeof items)[number]) => {
    const content = (
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 rounded-full bg-[#EEF3FF] text-primary dark:bg-muted/70 dark:text-primary flex items-center justify-center">
          {item.kind === 'person' && <User className="h-4 w-4" />}
          {item.kind === 'file' && <FileText className="h-4 w-4" />}
          {item.kind === 'category' && <LayoutGrid className="h-4 w-4" />}
          {item.kind === 'task' && <ListTodo className="h-4 w-4" />}
          {(!item.kind || item.kind === 'activity' || item.kind === 'other') && (
            <ListTodo className="h-4 w-4" />
          )}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">
            {highlightText(item.label)}
          </p>
          {item.description && (
            <p className="text-xs text-muted-foreground truncate">
              {highlightText(item.description)}
            </p>
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
          className="px-3 py-2 border-t border-[#E4ECFF] dark:border-border hover:bg-[#EEF4FF]/80 dark:hover:bg-muted/60 transition"
        >
          {content}
        </div>
      );
    }

    return (
      <Link
        key={item.id}
        to={item.href}
        className="block px-3 py-2 border-t border-[#E4ECFF] dark:border-border hover:bg-[#EEF4FF]/80 dark:hover:bg-muted/60 transition"
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
    <GridSmallBackground
      hideGrid={hideGrid}
      className="min-h-screen w-full bg-[radial-gradient(circle_at_top,_rgba(145,167,255,0.35),_transparent_55%),radial-gradient(circle_at_bottom,_rgba(196,218,255,0.45),_transparent_60%)] dark:bg-background p-4 md:p-6"
    >
      <div className="flex min-h-[calc(100vh-2rem)] gap-4 md:gap-6 relative z-10">
        <div
          className="relative flex-shrink-0"
          style={{ width: 'var(--app-sidebar-width, 18rem)' }}
        >
          <div
            aria-hidden="true"
            className="h-full w-full opacity-0 pointer-events-none"
          />
          <AppSidebar />
        </div>
        <main className="flex-1 min-w-0 flex justify-center">
          <div className="w-full max-w-6xl h-full rounded-[32px] border border-[#D9E6FF] bg-white/85 dark:bg-card/85 dark:border-border shadow-[0_24px_60px_-40px_rgba(15,23,42,0.35)] dark:shadow-[0_24px_60px_-40px_rgba(0,0,0,0.6)] flex flex-col overflow-hidden">
            <div
              ref={contentScrollRef}
              className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin relative"
              onScroll={handleContentScroll}
            >
              {background}
              <div className="relative z-10">
                <div className="relative z-20">
                  <div className="shrink-0 border-b border-[#D9E6FF] bg-white/60 dark:bg-card/70 dark:border-border backdrop-blur-md px-4 md:px-6 py-3">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div className="relative w-full max-w-[220px] sm:max-w-[280px] md:max-w-md" ref={searchContainerRef}>
                        <div className="search-elastic group flex items-center gap-2 rounded-full border border-[#D9E6FF] bg-white/95 dark:bg-card/80 dark:border-border px-3 py-2 shadow-sm">
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
                          <span className="hidden sm:flex items-center gap-1 rounded-full bg-[#EFF4FF] dark:bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                            <kbd className="font-sans">Ctrl</kbd>
                            <kbd className="font-sans">F</kbd>
                          </span>
                        </div>
                        {showPanel && (
                          <GlassCard
                            className="absolute left-0 right-0 mt-2 z-50"
                            contentClassName="rounded-[30px] overflow-hidden border border-slate-100/90 bg-white/82 backdrop-blur-xl dark:border-white/10 dark:bg-[linear-gradient(145deg,_rgba(12,24,56,0.76),_rgba(8,18,43,0.62))] dark:backdrop-blur-2xl p-2 shadow-xl shadow-slate-200/45 dark:shadow-[0_26px_54px_-30px_rgba(2,8,23,0.95)] animate-dropdown"
                            blur={22}
                            saturation={145}
                            backgroundColor="#0b1738"
                            backgroundOpacity={0.45}
                            borderColor="#ffffff"
                            borderOpacity={0.14}
                            borderSize={1}
                            innerLightOpacity={0.1}
                          >
                            <div onMouseDown={(event) => event.preventDefault()}>
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
                                  <div className="px-3 py-4 text-sm text-muted-foreground border-t border-[#E4ECFF] dark:border-border">
                                    No matches. Try a different term.
                                  </div>
                                )}
                              </div>
                            </div>
                          </GlassCard>
                        )}
                      </div>
                      <div className="flex w-full items-center justify-end gap-2 md:w-auto">
                        {headerActions}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex-1">
                  <div className="container py-6 px-4 md:px-8 max-w-6xl mx-auto">
                    {children}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

    </GridSmallBackground>
  );
}
