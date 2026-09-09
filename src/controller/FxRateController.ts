import { FxRateClient } from '../data/FxRateClient';
import { FxRateStore } from '../data/FxRateStore';
import { fxTableIsFresh, type FxRateTable } from '../model/finance/fx';

/** ECB-style feeds move once a business day; six hours avoids hammering the public API. */
const FX_TTL_MS = 6 * 60 * 60 * 1000;

export interface FxRefreshResult {
  table: FxRateTable | null;
  stale: boolean;
}

/**
 * Purpose: load cached quotes, then refresh from the public feed without blocking spends.
 * Inputs: FxRateStore + FxRateClient; optional force (after a foreign spend save).
 * Outputs: table to show; stale=true when the live GET failed and cache was used.
 * Side effects: HTTP GET of currency pair only; AsyncStorage write on success.
 * Design decisions: coalesce in-flight refreshes so compose + backfill share one GET. Money list does not call this.
 */
export class FxRateController {
  private inflight: Promise<FxRefreshResult> | null = null;

  constructor(
    private readonly store: FxRateStore,
    private readonly client: FxRateClient,
  ) {}

  /**
   * Purpose: hydrate UI from disk before any network.
   */
  async loadCached(): Promise<FxRateTable | null> {
    return this.store.load();
  }

  /**
   * Purpose: latest quotes for Log a spend, or a forced fetch after a foreign save / legacy backfill.
   * Inputs: force=true skips the TTL (still never throws to the View).
   * Outputs: cached or fresh table; stale when the GET failed.
   * Side effects: network + cache write on success.
   */
  async refreshRates(force = false): Promise<FxRefreshResult> {
    if (this.inflight) {
      return this.inflight;
    }
    this.inflight = this.runRefresh(force).finally(() => {
      this.inflight = null;
    });
    return this.inflight;
  }

  private async runRefresh(force: boolean): Promise<FxRefreshResult> {
    const cached = await this.store.load();
    if (!force && cached && fxTableIsFresh(cached, new Date(), FX_TTL_MS)) {
      return { table: cached, stale: false };
    }
    try {
      const fresh = await this.client.fetchLatest();
      await this.store.save(fresh);
      return { table: fresh, stale: false };
    } catch {
      return { table: cached, stale: Boolean(cached) };
    }
  }
}
