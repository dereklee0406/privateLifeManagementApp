import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BackupError } from './BackupDocument';
import {
  decryptBackupPayload,
  encryptBackupPayload,
} from './backupCrypto';
import {
  buildBackupDocument,
  parseBackupDocument,
  serializeBackupDocument,
  settingsForBackup,
} from './serializeBackup';
import { normalizeFinanceDocument } from '../finance/normalizeFinance';
import { normalizeReminderDocument } from '../reminders/normalizeReminder';
import { DEFAULT_SETTINGS, type AppSettings } from '../settings/AppSettings';
import { emptyFinanceDocument } from '../finance/Account';

describe('settingsForBackup', () => {
  it('strips PIN and system secrets while keeping lock preference', () => {
    const dirty = {
      ...DEFAULT_SETTINGS,
      writerName: 'Ella',
      onboardingComplete: true,
      lockMode: 'pin' as const,
      pin: '1234',
      secret: 'should-not-export',
      lastBackupAt: '2026-03-01T00:00:00.000Z',
      lastBackupJournalCount: 2,
      lastBackupReminderCount: 1,
      lastBackupSpendCount: 4,
    } as AppSettings & { pin?: string; secret?: string };

    const cleaned = settingsForBackup(dirty);
    assert.equal(cleaned.writerName, 'Ella');
    assert.equal(cleaned.lockMode, 'pin');
    assert.equal(cleaned.lastBackupAt, '2026-03-01T00:00:00.000Z');
    assert.equal('pin' in cleaned, false);
    assert.equal('secret' in cleaned, false);
    assert.equal(JSON.stringify(cleaned).includes('1234'), false);
    assert.equal(JSON.stringify(cleaned).includes('should-not-export'), false);
  });
});

describe('HALO1 encrypt / decrypt', () => {
  it('creates an encrypted backup and decrypts with the matching password', async () => {
    const document = buildBackupDocument({
      journal: [],
      reminders: { reminders: [], creditCards: [] },
      finance: emptyFinanceDocument(),
      settings: { ...DEFAULT_SETTINGS, writerName: 'Ella', onboardingComplete: true },
      exportedAt: '2026-03-15T12:00:00.000Z',
    });
    const plaintext = serializeBackupDocument(document);
    const password = 'halo-pass';
    const bytes = await encryptBackupPayload(plaintext, password);

    const magic = new TextDecoder().decode(bytes.subarray(0, 5));
    assert.equal(magic, 'HALO1');
    assert.equal(new TextDecoder().decode(bytes).includes('"writerName"'), false);

    const restoredJson = await decryptBackupPayload(bytes, password);
    const restored = parseBackupDocument(restoredJson);
    assert.equal(restored.version, 1);
    assert.equal(restored.settings.writerName, 'Ella');
    assert.equal(restored.exportedAt, '2026-03-15T12:00:00.000Z');
  });

  it('throws BackupError wrong-password when the password does not match', async () => {
    const plaintext = serializeBackupDocument(
      buildBackupDocument({
        journal: [],
        reminders: { reminders: [], creditCards: [] },
        finance: emptyFinanceDocument(),
        settings: DEFAULT_SETTINGS,
      }),
    );
    const bytes = await encryptBackupPayload(plaintext, 'correct-password');

    await assert.rejects(
      () => decryptBackupPayload(bytes, 'incorrect-password'),
      (error: unknown) =>
        error instanceof BackupError && error.code === 'wrong-password',
    );
  });
});

describe('normalizeFinanceDocument / normalizeReminderDocument fallbacks', () => {
  it('returns empty finance schema for null/corrupt roots and drops bad expense rows', () => {
    assert.deepEqual(normalizeFinanceDocument(null), emptyFinanceDocument());
    assert.deepEqual(normalizeFinanceDocument('nope'), emptyFinanceDocument());

    const doc = normalizeFinanceDocument({
      expenses: [
        { id: 'ok', amount: 12.5, dayKey: '2026-03-01', category: 'dining', currency: 'HKD' },
        { id: 99, amount: 'bad' },
        null,
        { amount: 5, dayKey: '2026-03-02' },
      ],
      incomes: 'not-an-array',
      budgets: [],
      assets: [],
      loans: [],
    });
    assert.equal(doc.expenses.length, 1);
    assert.equal(doc.expenses[0]?.id, 'ok');
    assert.equal(doc.expenses[0]?.amount, 12.5);
    assert.deepEqual(doc.incomes, []);
  });

  it('accepts legacy reminder arrays and drops unreadable reminder rows', () => {
    const fromArray = normalizeReminderDocument([
      {
        id: 'r1',
        kind: 'follow-up',
        title: 'Call bank',
        hour: 9,
        minute: 30,
        recurrence: { type: 'daily' },
        createdAt: '2026-01-01T00:00:00.000Z',
      },
      { id: 'broken', title: 'missing kind' },
    ]);
    assert.equal(fromArray.reminders.length, 1);
    assert.equal(fromArray.reminders[0]?.id, 'r1');
    assert.deepEqual(fromArray.creditCards, []);

    const empty = normalizeReminderDocument(null);
    assert.deepEqual(empty, { reminders: [], creditCards: [] });

    const fromObject = normalizeReminderDocument({
      reminders: [],
      creditCards: [
        {
          id: 'c1',
          name: 'HSBC Red',
          dueDayOfMonth: 25,
          statementDayOfMonth: 5,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
        { name: 'incomplete' },
      ],
    });
    assert.equal(fromObject.creditCards.length, 1);
    assert.equal(fromObject.creditCards[0]?.id, 'c1');
  });
});
