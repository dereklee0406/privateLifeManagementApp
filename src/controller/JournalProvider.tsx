import { createContext, createElement, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { JournalController } from './JournalController';
import { JournalLocalStore } from '../data/JournalLocalStore';
import { TrashLocalStore } from '../data/TrashLocalStore';
import type { MediaKind } from '../data/mediaStore';
import type { JournalDraft, JournalEntry, JournalPatch } from '../model/journal/JournalEntry';
import type { CalendarMonth } from '../model/journal/journalCalendar';
import type { JournalSearchInput } from '../model/journal/journalSearch';
import { computeInsights, type JournalInsights } from '../model/journal/journalStats';
import type { TimelineSection } from '../model/journal/journalTimeline';
import { computeMoodAnalysis, type MoodAnalysis } from '../model/journal/moodTrends';
import { resolveWeekStart } from '../model/settings/AppSettings';
import { useSettings } from './SettingsProvider';

interface JournalContextValue {
  ready: boolean;
  entries: JournalEntry[];
  insights: JournalInsights;
  moodAnalysis: MoodAnalysis;
  todayPrompt: string;
  refresh: () => Promise<void>;
  createEntry: (draft: JournalDraft) => Promise<JournalEntry>;
  updateEntry: (id: string, patch: JournalPatch) => Promise<JournalEntry>;
  deleteEntry: (id: string) => Promise<void>;
  restoreEntry: (entry: JournalEntry) => Promise<void>;
  getEntry: (id: string) => JournalEntry | undefined;
  persistMedia: (tempUri: string, kind: MediaKind) => Promise<string>;
  searchEntries: (input: JournalSearchInput) => JournalEntry[];
  timelineFor: (input?: JournalSearchInput) => TimelineSection[];
  calendarMonth: (year: number, month: number, locale?: string) => CalendarMonth;
  entriesForDay: (dayKey: string) => JournalEntry[];
  adjacentMonth: (year: number, month: number, delta: number) => { year: number; month: number };
}

const JournalContext = createContext<JournalContextValue | null>(null);

/**
 * Purpose: bind JournalController to React without putting business rules in screens.
 * Inputs: children tree.
 * Outputs: context consumers get entries and use-case methods.
 * Side effects: loads and writes journal storage.
 */
export function JournalProvider({ children }: { children: ReactNode }) {
  const { settings } = useSettings();
  const weekStart = resolveWeekStart(settings);
  const controller = useMemo(
    () => new JournalController(new JournalLocalStore(), new TrashLocalStore()),
    [],
  );
  const [ready, setReady] = useState(false);
  const [entries, setEntries] = useState<JournalEntry[]>([]);

  const refresh = async () => {
    const next = await controller.listEntries();
    setEntries(next);
    setReady(true);
  };

  useEffect(() => {
    void refresh();
  }, []);

  const value = useMemo<JournalContextValue>(
    () => ({
      ready,
      entries,
      insights: computeInsights(entries, new Date(), weekStart),
      moodAnalysis: computeMoodAnalysis(entries, new Date(), weekStart),
      todayPrompt: controller.getTodayPrompt(),
      refresh,
      createEntry: async (draft) => {
        const created = await controller.createEntry(draft);
        await refresh();
        return created;
      },
      updateEntry: async (id, patch) => {
        const updated = await controller.updateEntry(id, patch);
        await refresh();
        return updated;
      },
      deleteEntry: async (id) => {
        await controller.deleteEntry(id);
        await refresh();
      },
      restoreEntry: async (entry) => {
        await controller.restoreEntry(entry);
        await refresh();
      },
      getEntry: (id) => entries.find((entry) => entry.id === id),
      persistMedia: (tempUri, kind) => controller.persistMedia(tempUri, kind),
      searchEntries: (input) => controller.searchEntries(entries, input),
      timelineFor: (input) => {
        const filtered = input ? controller.searchEntries(entries, input) : entries;
        return controller.timelineFor(filtered);
      },
      calendarMonth: (year, month, locale) => controller.calendarMonth(entries, year, month, weekStart, locale),
      entriesForDay: (dayKey) => controller.entriesForDay(entries, dayKey),
      adjacentMonth: (year, month, delta) => controller.adjacentMonth(year, month, delta),
    }),
    [ready, entries, controller, weekStart],
  );

  return createElement(JournalContext.Provider, { value }, children);
}

/**
 * Purpose: access journal use cases from views.
 */
export function useJournal(): JournalContextValue {
  const value = useContext(JournalContext);
  if (!value) {
    throw new Error('useJournal must be used inside JournalProvider.');
  }
  return value;
}
