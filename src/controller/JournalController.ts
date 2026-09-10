import { AppConfig } from '../config/appConfig';
import type { JournalDraft, JournalEntry, JournalPatch } from '../model/journal/JournalEntry';
import type { JournalRepository } from '../model/journal/JournalRepository';
import { buildCalendarMonth, entriesOnDay, shiftMonth, type CalendarMonth } from '../model/journal/journalCalendar';
import { searchJournal, type JournalSearchInput } from '../model/journal/journalSearch';
import { computeInsights, countWords, type JournalInsights } from '../model/journal/journalStats';
import { groupTimeline, type TimelineSection } from '../model/journal/journalTimeline';
import { computeMoodAnalysis, type MoodAnalysis } from '../model/journal/moodTrends';
import { normalizeMoodNote } from '../model/journal/moodNote';
import { getDailyPrompt } from '../model/journal/prompts';
import { normalizeTags } from '../model/journal/tags';
import { persistMediaFile, removeMediaFile, type MediaKind } from '../data/mediaStore';
import type { WeekStart } from '../model/settings/AppSettings';
import { createId } from '../utils/idUtils';
import type { TrashRepository } from '../model/trash/TrashRepository';
import { upsertTrashItem } from '../model/trash/TrashRepository';

/**
 * Purpose: orchestrate journal use cases without UI concerns.
 * Inputs: JournalRepository plus drafts/patches from the view.
 * Outputs: entries, timeline, calendar, search results, and mood analysis for screens.
 * Side effects: persistence through the repository; media copy/delete through mediaStore.
 * Design decisions: controller stays thin — filtering, grouping, and trends live in Model.
 */
export class JournalController {
  constructor(
    private readonly repository: JournalRepository,
    private readonly trash?: TrashRepository,
  ) {}

  /**
   * Purpose: load the writer's pages, newest first.
   */
  async listEntries(): Promise<JournalEntry[]> {
    const entries = await this.repository.loadAll();
    return [...entries].sort(
      (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
    );
  }

  /**
   * Purpose: fetch a single page or null when missing.
   */
  async getEntry(id: string): Promise<JournalEntry | null> {
    const entries = await this.repository.loadAll();
    return entries.find((entry) => entry.id === id) ?? null;
  }

  /**
   * Purpose: copy a camera/library/recorder temp file into durable storage.
   */
  async persistMedia(tempUri: string, kind: MediaKind): Promise<string> {
    return persistMediaFile(tempUri, kind);
  }

  /**
   * Purpose: create a page from a draft after trimming, word counting, and persisting media URIs.
   */
  async createEntry(draft: JournalDraft): Promise<JournalEntry> {
    const now = new Date().toISOString();
    const kind = draft.kind ?? 'text';
    const photoUris = await this.persistAll(draft.photoUris ?? [], 'photo');
    const voiceUri = draft.voiceUri ? await persistMediaFile(draft.voiceUri, 'voice') : undefined;
    const body = draft.body.trim();
    const entry: JournalEntry = {
      id: createId(),
      createdAt: draft.createdAt ?? now,
      updatedAt: now,
      kind,
      title: this.normalizeTitle(draft.title, kind),
      body,
      bodyFormat: draft.bodyFormat ?? 'markdown',
      mood: draft.mood,
      moodNote: normalizeMoodNote(draft.moodNote),
      tags: normalizeTags(draft.tags),
      wordCount: countWords(body),
      photoUris,
      voiceUri,
      voiceDurationMs: voiceUri ? draft.voiceDurationMs : undefined,
      location: draft.location,
    };
    const entries = await this.repository.loadAll();
    await this.repository.saveAll([entry, ...entries]);
    return entry;
  }

  /**
   * Purpose: apply a patch to an existing page.
   */
  async updateEntry(id: string, patch: JournalPatch): Promise<JournalEntry> {
    const entries = await this.repository.loadAll();
    const index = entries.findIndex((entry) => entry.id === id);
    if (index < 0) {
      throw new Error('Entry was not found.');
    }
    const current = entries[index];
    const nextBody = patch.body ?? current.body;
    const nextPhotos =
      patch.photoUris !== undefined ? await this.persistAll(patch.photoUris, 'photo') : current.photoUris;
    let nextVoice = current.voiceUri;
    let nextDuration = current.voiceDurationMs;
    if (patch.voiceUri === null) {
      nextVoice = undefined;
      nextDuration = undefined;
    } else if (patch.voiceUri !== undefined) {
      nextVoice = await persistMediaFile(patch.voiceUri, 'voice');
      nextDuration = patch.voiceDurationMs ?? current.voiceDurationMs;
    }
    await this.dropUnusedMedia(current, nextPhotos, nextVoice);
    const updated: JournalEntry = {
      ...current,
      kind: patch.kind ?? current.kind,
      title: patch.title !== undefined ? this.normalizeTitle(patch.title, patch.kind ?? current.kind) : current.title,
      body: nextBody.trim(),
      bodyFormat: patch.bodyFormat ?? current.bodyFormat,
      mood: patch.mood ?? current.mood,
      moodNote:
        patch.moodNote === null
          ? undefined
          : patch.moodNote !== undefined
            ? normalizeMoodNote(patch.moodNote)
            : current.moodNote,
      tags: patch.tags !== undefined ? normalizeTags(patch.tags) : current.tags,
      wordCount: countWords(nextBody),
      photoUris: nextPhotos,
      voiceUri: nextVoice,
      voiceDurationMs: nextVoice ? nextDuration : undefined,
      location:
        patch.location === null ? undefined : patch.location !== undefined ? patch.location : current.location,
      updatedAt: new Date().toISOString(),
    };
    const next = [...entries];
    next[index] = updated;
    await this.repository.saveAll(next);
    return updated;
  }

  /**
   * Purpose: move a page to Recently deleted (30 days) instead of destroying media immediately.
   */
  async deleteEntry(id: string): Promise<void> {
    const entries = await this.repository.loadAll();
    const target = entries.find((entry) => entry.id === id);
    if (target && this.trash) {
      const document = await this.trash.load();
      await this.trash.save(
        upsertTrashItem(document, {
          id: target.id,
          kind: 'page',
          deletedAt: new Date().toISOString(),
          page: target,
        }),
      );
    } else if (target) {
      await this.dropUnusedMedia(target, [], undefined);
    }
    await this.repository.saveAll(entries.filter((entry) => entry.id !== id));
  }

  /**
   * Purpose: put a page back from Recently deleted (same id).
   */
  async restoreEntry(entry: JournalEntry): Promise<void> {
    const entries = await this.repository.loadAll();
    if (entries.some((item) => item.id === entry.id)) {
      return;
    }
    await this.repository.saveAll([entry, ...entries]);
  }

  /**
   * Purpose: build insight aggregates for the Insights screen.
   */
  async getInsights(weekStart: WeekStart = 'monday'): Promise<JournalInsights> {
    const entries = await this.repository.loadAll();
    return computeInsights(entries, new Date(), weekStart);
  }

  /**
   * Purpose: filter in-memory pages. Pure over the loaded list.
   */
  searchEntries(entries: JournalEntry[], input: JournalSearchInput, now: Date = new Date()): JournalEntry[] {
    return searchJournal(entries, input, now);
  }

  /**
   * Purpose: group pages for the private timeline feed.
   */
  timelineFor(entries: JournalEntry[], now: Date = new Date()): TimelineSection[] {
    return groupTimeline(entries, now);
  }

  /**
   * Purpose: month grid for the Calendar tab, first column from weekStart.
   */
  calendarMonth(entries: JournalEntry[], year: number, month: number, weekStart: WeekStart = 'monday', locale?: string): CalendarMonth {
    return buildCalendarMonth(year, month, entries, weekStart, locale);
  }

  /**
   * Purpose: pages written on one local day, for the calendar drill-in.
   */
  entriesForDay(entries: JournalEntry[], dayKey: string): JournalEntry[] {
    return entriesOnDay(entries, dayKey);
  }

  /**
   * Purpose: shift calendar navigation without date-math in the view.
   */
  adjacentMonth(year: number, month: number, delta: number): { year: number; month: number } {
    return shiftMonth(year, month, delta);
  }

  /**
   * Purpose: Aura mood-analysis snapshot.
   */
  moodAnalysis(entries: JournalEntry[], now: Date = new Date(), weekStart: WeekStart = 'monday'): MoodAnalysis {
    return computeMoodAnalysis(entries, now, weekStart);
  }

  /**
   * Purpose: expose today's writing invitation id (Today pack, date rotation).
   * Inputs: none (clock inside getDailyPrompt).
   * Outputs: PromptId; View translates `prompts.{id}`.
   * Side effects: none.
   * Design decisions: Model stays language-free; catalogs live in i18n.
   */
  getTodayPrompt(): string {
    return getDailyPrompt();
  }

  private normalizeTitle(title: string, kind: JournalEntry['kind']): string {
    const trimmed = title.trim().slice(0, AppConfig.writing.maxTitleLength);
    if (trimmed) {
      return trimmed;
    }
    return kind === 'voice' ? 'Voice page' : 'Untitled page';
  }

  private async persistAll(uris: string[], kind: MediaKind): Promise<string[]> {
    const unique = [...new Set(uris.filter(Boolean))].slice(0, AppConfig.writing.maxPhotos);
    return Promise.all(unique.map((uri) => persistMediaFile(uri, kind)));
  }

  private async dropUnusedMedia(
    previous: JournalEntry,
    nextPhotos: string[],
    nextVoice: string | undefined,
  ): Promise<void> {
    const nextSet = new Set(nextPhotos);
    for (const uri of previous.photoUris) {
      if (!nextSet.has(uri)) {
        await removeMediaFile(uri);
      }
    }
    if (previous.voiceUri && previous.voiceUri !== nextVoice) {
      await removeMediaFile(previous.voiceUri);
    }
  }
}
