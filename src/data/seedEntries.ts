import type { JournalEntry } from '../model/journal/JournalEntry';
import { countWords } from '../model/journal/journalStats';

function atHoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

function atDaysAgo(days: number, hour = 10): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - days, hour, 15, 0).toISOString();
}

/**
 * Purpose: first-run sample pages so the journal never opens empty.
 * Inputs: none.
 * Outputs: editorial sample entries spanning today through earlier months so Timeline, Calendar, and Aura have shape.
 * Side effects: none until the store persists them.
 * Design decisions: copy is clearly a demo so a new writer can delete it immediately. No seed binaries — photos and voice are empty.
 */
export function createSeedEntries(): JournalEntry[] {
  const samples: JournalEntry[] = [
    {
      id: 'seed-harbor',
      createdAt: atHoursAgo(3),
      updatedAt: atHoursAgo(3),
      kind: 'text',
      title: 'The harbor light',
      body: 'Walked home later than I meant to. The street was almost empty, and the shop signs looked like they were whispering instead of shouting.\n\nI kept thinking about how a day can feel **heavy** without being dramatic — just a stack of small unfinished things. I let the last one stay unfinished.',
      bodyFormat: 'markdown',
      mood: 'neutral',
      tags: ['evening'],
      wordCount: 0,
      photoUris: [],
    },
    {
      id: 'seed-kitchen',
      createdAt: atDaysAgo(1, 19),
      updatedAt: atDaysAgo(1, 19),
      kind: 'text',
      title: 'Orange on the counter',
      body: 'Someone left an orange in the kitchen and the whole room smelled like a warmer climate. I stood there longer than a person should stand in a kitchen doing nothing. It felt like permission.',
      bodyFormat: 'markdown',
      mood: 'happy',
      tags: ['health', 'home'],
      wordCount: 0,
      photoUris: [],
    },
    {
      id: 'seed-focus',
      createdAt: atDaysAgo(3, 9),
      updatedAt: atDaysAgo(3, 9),
      kind: 'text',
      title: 'One clean hour',
      body: 'I put the phone in another room and wrote until the sentence stopped fighting me.\n\n- Not a masterpiece\n- Just a *clean hour*\n\nI want more days that are built from those.',
      bodyFormat: 'markdown',
      mood: 'happy',
      tags: ['work'],
      wordCount: 0,
      photoUris: [],
    },
    {
      id: 'seed-finance',
      createdAt: atDaysAgo(5, 21),
      updatedAt: atDaysAgo(5, 21),
      kind: 'text',
      title: 'The number on the screen',
      body: 'Opened the banking app and felt my jaw set. Nothing was actually wrong. I still closed it like I had been caught.',
      bodyFormat: 'markdown',
      mood: 'angry',
      tags: ['finance'],
      wordCount: 0,
      photoUris: [],
    },
    {
      id: 'seed-rain',
      createdAt: atDaysAgo(12, 16),
      updatedAt: atDaysAgo(12, 16),
      kind: 'text',
      title: 'Rain on the bus glass',
      body: 'Sat by the window and watched the city smear. I missed a stop on purpose. Sometimes lateness is a kindness you give yourself.',
      bodyFormat: 'markdown',
      mood: 'sad',
      tags: ['health'],
      wordCount: 0,
      photoUris: [],
    },
    {
      id: 'seed-sunday',
      createdAt: atDaysAgo(20, 11),
      updatedAt: atDaysAgo(20, 11),
      kind: 'text',
      title: 'Slow eggs',
      body: 'Made eggs the long way. The kitchen filled with that ordinary gold. I did not reach for the news.',
      bodyFormat: 'markdown',
      mood: 'happy',
      tags: ['health'],
      wordCount: 0,
      photoUris: [],
    },
    {
      id: 'seed-earlier',
      createdAt: atDaysAgo(40, 8),
      updatedAt: atDaysAgo(40, 8),
      kind: 'text',
      title: 'A note from last season',
      body: 'Found this page again while looking for something else. The worry in it has already expired. I left it here as proof that weather passes.',
      bodyFormat: 'markdown',
      mood: 'neutral',
      tags: ['work'],
      wordCount: 0,
      photoUris: [],
    },
    {
      id: 'seed-last-month',
      createdAt: atDaysAgo(55, 14),
      updatedAt: atDaysAgo(55, 14),
      kind: 'text',
      title: 'Desk lamp',
      body: 'Worked later than I told myself I would. The lamp made a small planet on the desk. I shut it off and the room became honest again.',
      bodyFormat: 'markdown',
      mood: 'sad',
      tags: ['work'],
      wordCount: 0,
      photoUris: [],
    },
  ];

  return samples.map((entry) => ({ ...entry, wordCount: countWords(entry.body) }));
}
