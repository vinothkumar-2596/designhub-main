import type { Task } from '@/types';
import type { GlobalSearchItem } from '@/contexts/GlobalSearchContext';

export const normalizeSearch = (value: string) => value.trim().toLowerCase();

export const matchesSearch = (query: string, fields: Array<string | undefined | null>) => {
  const normalized = normalizeSearch(query);
  if (!normalized) return true;
  const tokens = normalized.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return true;
  const haystack = fields.filter(Boolean).join(' ').toLowerCase();
  return tokens.every((token) => haystack.includes(token));
};

const humanize = (value?: string | null) => {
  if (!value) return '';
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

export const buildSearchItemsFromTasks = (tasks: Task[]): GlobalSearchItem[] => {
  const taskItems: GlobalSearchItem[] = tasks.map((task) => ({
    id: `task:${task.id}`,
    label: task.title,
    description: task.description,
    meta: [humanize(task.status), humanize(task.category)].filter(Boolean).join(' • '),
    href: `/task/${task.id}`,
    kind: 'task',
  }));

  const peopleMap = new Map<
    string,
    { roles: Set<string>; count: number; sampleTaskId: string }
  >();
  const addPerson = (name: string, role: string, taskId: string) => {
    const entry = peopleMap.get(name) || {
      roles: new Set<string>(),
      count: 0,
      sampleTaskId: taskId,
    };
    entry.roles.add(role);
    entry.count += 1;
    if (!entry.sampleTaskId) entry.sampleTaskId = taskId;
    peopleMap.set(name, entry);
  };

  tasks.forEach((task) => {
    if (task.requesterName) {
      addPerson(task.requesterName, 'Requester', String(task.id));
    }
    if (task.assignedToName) {
      addPerson(task.assignedToName, 'Designer', String(task.id));
    }
  });

  const peopleItems: GlobalSearchItem[] = Array.from(peopleMap.entries()).map(
    ([name, info]) => ({
      id: `person:${name}`,
      label: name,
      meta: `${Array.from(info.roles).join(' / ')} • ${info.count} request${
        info.count === 1 ? '' : 's'
      }`,
      href: info.sampleTaskId ? `/task/${info.sampleTaskId}` : '/tasks',
      kind: 'person',
    })
  );

  const fileItems: GlobalSearchItem[] = [];
  tasks.forEach((task) => {
    if (!Array.isArray(task.files)) return;
    task.files.forEach((file) => {
      if (!file?.name) return;
      fileItems.push({
        id: `file:${task.id}:${file.name}`,
        label: file.name,
        description: task.title,
        meta: `${file.type === 'output' ? 'Final file' : 'Reference file'}`,
        href: `/task/${task.id}`,
        kind: 'file',
      });
    });
  });

  const categoryMap = new Map<string, number>();
  tasks.forEach((task) => {
    if (!task.category) return;
    const label = humanize(task.category);
    categoryMap.set(label, (categoryMap.get(label) || 0) + 1);
  });

  const categoryItems: GlobalSearchItem[] = Array.from(categoryMap.entries()).map(
    ([label, count]) => ({
      id: `category:${label}`,
      label,
      meta: `${count} request${count === 1 ? '' : 's'}`,
      href: '/tasks',
      kind: 'category',
    })
  );

  return [...taskItems, ...peopleItems, ...fileItems, ...categoryItems];
};
