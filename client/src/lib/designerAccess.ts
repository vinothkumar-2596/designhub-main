import type { User } from '@/types';

const normalizeValue = (value?: string | null) => (value ? String(value).trim().toLowerCase() : '');

const parseEmailList = (value: string | undefined) =>
  Array.from(
    new Set(
      String(value || '')
        .split(/[\s,;]+/g)
        .map((entry) => normalizeValue(entry))
        .filter(Boolean)
    )
  );

const configuredMainDesignerEmails = Array.from(
  new Set([
    ...parseEmailList(import.meta.env.VITE_MAIN_DESIGNER_EMAIL),
    ...parseEmailList(import.meta.env.VITE_MAIN_DESIGNER_EMAILS),
  ])
);

const hasMainDesignerConfig = configuredMainDesignerEmails.length > 0;

const normalizeDesignerScope = (value?: string | null): 'main' | 'junior' | '' => {
  const normalized = normalizeValue(value);
  if (normalized === 'main' || normalized === 'junior') {
    return normalized;
  }
  return '';
};

const getUserId = (user?: Pick<User, 'id'> | null) => String(user?.id || '').trim();

export const isMainDesigner = (
  user?: Pick<User, 'role' | 'email' | 'designerScope'> | null
) => {
  if (!user || normalizeValue(user.role) !== 'designer') return false;
  const scope = normalizeDesignerScope(user.designerScope);
  if (scope) {
    return scope === 'main';
  }
  if (!hasMainDesignerConfig) {
    return true;
  }
  const email = normalizeValue(user.email);
  return Boolean(email && configuredMainDesignerEmails.includes(email));
};

export const isJuniorDesigner = (
  user?: Pick<User, 'role' | 'email' | 'designerScope'> | null
) => {
  if (!user || normalizeValue(user.role) !== 'designer') return false;
  return !isMainDesigner(user);
};

export const getDesignerScope = (
  user?: Pick<User, 'role' | 'email' | 'designerScope'> | null
): 'main' | 'junior' | '' => {
  if (!user || normalizeValue(user.role) !== 'designer') return '';
  const scope = normalizeDesignerScope(user.designerScope);
  if (scope) return scope;
  return isMainDesigner(user) ? 'main' : 'junior';
};

export const getDesignerPortalId = (
  user?: Pick<User, 'role' | 'id' | 'portalId' | 'designerScope' | 'email'> | null
) => {
  if (!user || normalizeValue(user.role) !== 'designer') return '';
  const explicitPortalId = String(user.portalId || '').trim();
  if (explicitPortalId) return explicitPortalId;
  const id = getUserId(user);
  if (!id) return '';
  const prefix = getDesignerScope(user) === 'main' ? 'MD' : 'JD';
  return `${prefix}-${id.slice(-6).toUpperCase()}`;
};

export const getDesignerScopeLabel = (scope?: string | null) => {
  const normalized = normalizeDesignerScope(scope);
  if (normalized === 'main') return 'Main Designer';
  if (normalized === 'junior') return 'Junior Designer';
  return 'Designer';
};
