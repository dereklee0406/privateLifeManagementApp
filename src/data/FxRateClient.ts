import { AppConfig } from '../config/appConfig';
import { normalizeFxRateTable, type FxRateTable } from '../model/finance/fx';
import type { MoneyCurrency } from '../model/settings/AppSettings';

const QUOTE_CODES: MoneyCurrency[] = ['HKD', 'USD', 'CNY'];

/**
 * Purpose: HTTP GET latest public FX quotes (currency pair only).
 * Inputs: none — URL is compile-time `from`/`to` codes.
 * Outputs: FxRateTable with fetchedAt = now.
 * Side effects: one GET to Frankfurter/ECB; abort after 8s.
 * Design decisions: never send amounts, notes, or identity; Model stays fetch-free.
 */
export class FxRateClient {
  async fetchLatest(): Promise<FxRateTable> {
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), 8_000);
    try {
      const response = await fetch(AppConfig.money.fxUrl, {
        method: 'GET',
        signal: abort.signal,
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) {
        throw new Error('FX feed unavailable.');
      }
      const json: unknown = await response.json();
      const table = parseFrankfurter(json, new Date().toISOString());
      if (!table || (table.quotes.HKD === undefined && table.quotes.CNY === undefined)) {
        throw new Error('FX feed unreadable.');
      }
      return table;
    } finally {
      clearTimeout(timer);
    }
  }
}

/**
 * Purpose: map Frankfurter `{ base, rates }` onto Halo’s table (HKD / USD / CNY only).
 * Inputs: JSON body, ISO fetchedAt.
 * Outputs: normalized table or null.
 * Side effects: none.
 */
function parseFrankfurter(raw: unknown, fetchedAt: string): FxRateTable | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const body = raw as { base?: unknown; rates?: unknown };
  const quotes: Partial<Record<MoneyCurrency, number>> = {};
  if (body.rates && typeof body.rates === 'object') {
    const rates = body.rates as Record<string, unknown>;
    for (const code of QUOTE_CODES) {
      const rate = rates[code];
      if (typeof rate === 'number' && Number.isFinite(rate) && rate > 0) {
        quotes[code] = rate;
      }
    }
  }
  return normalizeFxRateTable({
    base: typeof body.base === 'string' ? body.base : 'USD',
    quotes,
    fetchedAt,
  });
}
