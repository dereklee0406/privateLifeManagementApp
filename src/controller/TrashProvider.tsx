import { createContext, createElement, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { TrashController } from './TrashController';
import { TrashLocalStore } from '../data/TrashLocalStore';
import { useFinance } from './FinanceProvider';
import { useJournal } from './JournalProvider';
import type { TrashItem } from '../model/trash/TrashItem';

interface TrashContextValue {
  ready: boolean;
  items: TrashItem[];
  restore: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
}

const TrashContext = createContext<TrashContextValue | null>(null);

/**
 * Purpose: bind TrashController to React. Must sit inside JournalProvider and FinanceProvider.
 * Inputs: children.
 * Outputs: live Recently deleted rows and restore.
 * Side effects: 30-day purge on load; restore writes pages/spends back then refreshes those stores.
 */
export function TrashProvider({ children }: { children: ReactNode }) {
  const controller = useMemo(() => new TrashController(new TrashLocalStore()), []);
  const journal = useJournal();
  const finance = useFinance();
  const [ready, setReady] = useState(false);
  const [items, setItems] = useState<TrashItem[]>([]);

  const refresh = async () => {
    setItems(await controller.listLive());
    setReady(true);
  };

  useEffect(() => {
    void refresh();
  }, [controller]);

  const value = useMemo<TrashContextValue>(
    () => ({
      ready,
      items,
      restore: async (id) => {
        const item = await controller.restore(id);
        if (item?.page) {
          await journal.restoreEntry(item.page);
        }
        if (item?.spend) {
          await finance.restoreExpense(item.spend);
        }
        await refresh();
      },
      refresh,
    }),
    [ready, items, controller, journal, finance],
  );

  return createElement(TrashContext.Provider, { value }, children);
}

/**
 * Purpose: access Recently deleted from You.
 */
export function useTrash(): TrashContextValue {
  const value = useContext(TrashContext);
  if (!value) {
    throw new Error('useTrash must be used inside TrashProvider.');
  }
  return value;
}
