import { ReactNode, createContext, useContext, useMemo, useState } from 'react';

export type GlobalSearchItem = {
  id: string;
  label: string;
  description?: string;
  meta?: string;
  href?: string;
  kind?: 'task' | 'person' | 'file' | 'category' | 'activity' | 'other';
};

type GlobalSearchContextValue = {
  query: string;
  setQuery: (value: string) => void;
  items: GlobalSearchItem[];
  setItems: (items: GlobalSearchItem[]) => void;
  scopeLabel: string;
  setScopeLabel: (label: string) => void;
};

const GlobalSearchContext = createContext<GlobalSearchContextValue | undefined>(undefined);

export function GlobalSearchProvider({ children }: { children: ReactNode }) {
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<GlobalSearchItem[]>([]);
  const [scopeLabel, setScopeLabel] = useState('Search');

  const value = useMemo(
    () => ({ query, setQuery, items, setItems, scopeLabel, setScopeLabel }),
    [query, items, scopeLabel]
  );

  return <GlobalSearchContext.Provider value={value}>{children}</GlobalSearchContext.Provider>;
}

export function useGlobalSearch() {
  const context = useContext(GlobalSearchContext);
  if (!context) {
    throw new Error('useGlobalSearch must be used within a GlobalSearchProvider');
  }
  return context;
}
