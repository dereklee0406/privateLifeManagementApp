import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { FxRateController } from './FxRateController';
import { FxRateClient } from '../data/FxRateClient';
import { FxRateStore } from '../data/FxRateStore';
import { BASELINE_FX_TABLE, type FxRateTable } from '../model/finance/fx';

interface FxRateContextValue {
  table: FxRateTable | null;
  stale: boolean;
  refreshRates: (force?: boolean) => Promise<FxRateTable | null>;
}

const FxRateContext = createContext<FxRateContextValue | null>(null);

/**
 * Purpose: bind FxRateController to React (cache first, then optional GET).
 * Inputs: children tree.
 * Outputs: rate table, stale flag, refreshRates.
 * Side effects: AsyncStorage hydrate on mount; GET only when compose / foreign save / one-time backfill call refreshRates.
 * Design decisions: seed with baseline so Log a spend keypad can convert before cache/network returns.
 */
export function FxRateProvider({ children }: { children: ReactNode }) {
  const controller = useMemo(() => new FxRateController(new FxRateStore(), new FxRateClient()), []);
  const [table, setTable] = useState<FxRateTable | null>(BASELINE_FX_TABLE);
  const [stale, setStale] = useState(false);

  useEffect(() => {
    void controller.loadCached().then((cached) => {
      if (cached) {
        setTable(cached);
      }
    });
  }, [controller]);

  const refreshRates = useCallback(
    async (force = false) => {
      const result = await controller.refreshRates(force);
      setTable(result.table ?? BASELINE_FX_TABLE);
      setStale(result.stale || !result.table);
      return result.table ?? BASELINE_FX_TABLE;
    },
    [controller],
  );

  const value = useMemo<FxRateContextValue>(
    () => ({ table, stale, refreshRates }),
    [table, stale, refreshRates],
  );

  return createElement(FxRateContext.Provider, { value }, children);
}

/**
 * Purpose: access FX quotes from Money, Today, spend form, You.
 */
export function useFxRates(): FxRateContextValue {
  const value = useContext(FxRateContext);
  if (!value) {
    throw new Error('useFxRates must be used inside FxRateProvider.');
  }
  return value;
}
