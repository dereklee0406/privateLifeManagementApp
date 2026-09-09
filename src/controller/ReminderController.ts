import { defaultBodyForKind, defaultTitleForKind, reminderOpenPath } from '../model/reminders/defaults';
import { nextFireAt, nextFireTimes, scheduleHorizon, isValidRecurrence } from '../model/reminders/nextFire';
import type { Reminder, ReminderDraft } from '../model/reminders/Reminder';
import type { ReminderRepository } from '../model/reminders/ReminderRepository';
import {
  draftFromTemplate,
  listReminderTemplates,
  type ReminderTemplate,
  type ReminderTemplateId,
} from '../model/reminders/templates';
import {
  defaultCreditCardPings,
  draftFromCreditCardPing,
  type CardBankPromotion,
  type CardRebateRule,
  type CardRewardType,
  type CreditCardAccount,
  type CreditCardPingDraft,
} from '../model/reminders/creditCards';
import { makeCategoryPath } from '../model/reminders/categories';
import {
  reminderNotificationsSupported,
  requestReminderPermission,
  syncReminderNotifications,
  type ReminderNotificationFire,
} from '../data/reminderNotifications';
import { createId } from '../utils/idUtils';
import { toDayKey } from '../utils/dateUtils';

export interface CreditCardCreateInput {
  name: string;
  dueDayOfMonth: number;
  statementDayOfMonth: number;
  amountDue?: number;
  currentBalance?: number;
  bankId?: string;
  bankName?: string;
  cardTier?: string;
  rewardType?: CardRewardType;
  baseRebateRate?: number;
  rebateRules?: CardRebateRule[];
  monthlySpendCap?: number;
  monthlyRebateCap?: number;
  annualSpendCap?: number;
  minMonthlySpendRequirement?: number;
  promotions?: CardBankPromotion[];
  pings: CreditCardPingDraft[];
}

/** Options for DATE notification sync (sound + optional lock-screen redaction). */
export interface ReminderScheduleOptions {
  playSound?: boolean;
  /** When true (App Lock on), OS tray uses privateTitle/privateBody instead of reminder text. */
  redactLockScreen?: boolean;
  privateTitle?: string;
  privateBody?: string;
}

/**
 * Purpose: CRUD reminders and credit-card parents; schedule computed next-fires.
 * Inputs: ReminderRepository plus drafts from the View.
 * Outputs: Reminder / CreditCardAccount snapshots.
 * Side effects: JSON persistence; native DATE notifications via reminderNotifications adapter.
 * Design decisions: next occurrence is Model-only; a card is one account + N child reminder rows.
 */
export class ReminderController {
  private soundOn = true;
  private redactLockScreen = false;
  private privateTitle = 'Halo reminder';
  private privateBody = 'Tap to open Halo';

  constructor(private readonly repository: ReminderRepository) {}

  /**
   * Purpose: keep DATE scheduling aligned with You → Customize sound without every CRUD call passing a flag.
   * Inputs: resolveReminderSoundEnabled(settings).
   * Outputs: none.
   * Side effects: next syncSchedules uses this flag.
   */
  configureSound(enabled: boolean): void {
    this.soundOn = enabled;
  }

  /**
   * Purpose: keep lock-screen tray copy aligned with App Lock without every CRUD call passing strings.
   * Inputs: redact when lockMode !== 'off'; localized private title/body from View i18n.
   * Outputs: none.
   * Side effects: next syncSchedules (including CRUD) uses these values.
   */
  configureTrayPrivacy(input: { redact: boolean; title: string; body: string }): void {
    this.redactLockScreen = input.redact;
    this.privateTitle = input.title.trim() || 'Halo reminder';
    this.privateBody = input.body.trim() || 'Tap to open Halo';
  }

  /**
   * Purpose: load reminders newest-updated first.
   */
  async listReminders(): Promise<Reminder[]> {
    const { reminders } = await this.repository.load();
    return [...reminders].sort(
      (left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
    );
  }

  /**
   * Purpose: load credit-card parent accounts.
   */
  async listCreditCards(): Promise<CreditCardAccount[]> {
    const { creditCards } = await this.repository.load();
    return [...creditCards].sort(
      (left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
    );
  }

  /**
   * Purpose: catalog for the create-flow template picker.
   */
  listTemplates(): ReminderTemplate[] {
    return listReminderTemplates();
  }

  /**
   * Purpose: apply a smart template to a new editor draft.
   */
  applyTemplate(templateId: ReminderTemplateId | string, now: Date = new Date()): ReminderDraft {
    return draftFromTemplate(templateId, now);
  }

  /**
   * Purpose: next fire for list/edit previews.
   */
  nextFire(reminder: Reminder, now: Date = new Date()): Date | null {
    return nextFireAt(reminder, now);
  }

  /**
   * Purpose: create and persist a reminder, then reschedule OS notifications.
   */
  async createReminder(draft: ReminderDraft): Promise<Reminder> {
    const document = await this.repository.load();
    const nowIso = new Date().toISOString();
    const reminder = draftToReminder(draft, createId(), nowIso, nowIso);
    await this.repository.save({ ...document, reminders: [reminder, ...document.reminders] });
    await this.syncSchedules();
    return reminder;
  }

  /**
   * Purpose: patch an existing reminder; reset interval anchor when recurrence changes.
   */
  async updateReminder(id: string, draft: ReminderDraft): Promise<Reminder> {
    const document = await this.repository.load();
    const current = document.reminders.find((item) => item.id === id);
    if (!current) {
      throw new Error('Reminder not found.');
    }
    const recurrenceChanged = JSON.stringify(current.recurrence) !== JSON.stringify(draft.recurrence);
    const next = draftToReminder(
      draft,
      id,
      current.createdAt,
      new Date().toISOString(),
      recurrenceChanged ? new Date().toISOString() : current.anchorAt,
      {
        lastCompletedAt: draft.lastCompletedAt ?? current.lastCompletedAt,
        completedDayKeys: draft.completedDayKeys ?? current.completedDayKeys,
      },
    );
    await this.repository.save({
      ...document,
      reminders: document.reminders.map((item) => (item.id === id ? next : item)),
    });
    await this.syncSchedules();
    return next;
  }

  /**
   * Purpose: enable or disable without opening the editor.
   */
  async setEnabled(id: string, enabled: boolean): Promise<Reminder> {
    const document = await this.repository.load();
    const current = document.reminders.find((item) => item.id === id);
    if (!current) {
      throw new Error('Reminder not found.');
    }
    const next: Reminder = { ...current, enabled, updatedAt: new Date().toISOString() };
    await this.repository.save({
      ...document,
      reminders: document.reminders.map((item) => (item.id === id ? next : item)),
    });
    await this.syncSchedules();
    return next;
  }

  /**
   * Purpose: 1-tap mark a reminder done for today; advance next-fire for recurring rules.
   * Inputs: reminder id, optional local now.
   * Outputs: updated Reminder with lastCompletedAt + completedDayKeys.
   * Side effects: repository write; reschedules native DATE notifications.
   * Design decisions: once-rules are disabled after complete; periodic rules stay enabled and
   *   nextFireAt skips today via lastCompletedAt so the OS window refills on the next occurrence.
   */
  async completeReminder(id: string, now: Date = new Date()): Promise<Reminder> {
    const document = await this.repository.load();
    const current = document.reminders.find((item) => item.id === id);
    if (!current) {
      throw new Error('Reminder not found.');
    }
    const today = toDayKey(now);
    const keys = new Set(current.completedDayKeys ?? []);
    keys.add(today);
    const next: Reminder = {
      ...current,
      lastCompletedAt: now.toISOString(),
      completedDayKeys: [...keys],
      enabled: current.recurrence.type === 'once' ? false : current.enabled,
      updatedAt: now.toISOString(),
    };
    await this.repository.save({
      ...document,
      reminders: document.reminders.map((item) => (item.id === id ? next : item)),
    });
    await this.syncSchedules();
    return next;
  }

  /**
   * Purpose: undo today’s completion so the habit resurfaces on Next Up / list.
   * Inputs: reminder id, optional local now.
   * Outputs: updated Reminder without today’s dayKey in completedDayKeys.
   * Side effects: repository write; reschedules notifications.
   */
  async uncompleteReminder(id: string, now: Date = new Date()): Promise<Reminder> {
    const document = await this.repository.load();
    const current = document.reminders.find((item) => item.id === id);
    if (!current) {
      throw new Error('Reminder not found.');
    }
    const today = toDayKey(now);
    const completedDayKeys = (current.completedDayKeys ?? []).filter((key) => key !== today);
    const lastWasToday =
      current.lastCompletedAt !== undefined &&
      !Number.isNaN(Date.parse(current.lastCompletedAt)) &&
      toDayKey(new Date(current.lastCompletedAt)) === today;
    const next: Reminder = {
      ...current,
      completedDayKeys: completedDayKeys.length ? completedDayKeys : undefined,
      lastCompletedAt: lastWasToday ? undefined : current.lastCompletedAt,
      enabled: current.recurrence.type === 'once' ? true : current.enabled,
      updatedAt: now.toISOString(),
    };
    await this.repository.save({
      ...document,
      reminders: document.reminders.map((item) => (item.id === id ? next : item)),
    });
    await this.syncSchedules();
    return next;
  }

  /**
   * Purpose: delete a reminder and drop its scheduled fires.
   */
  async deleteReminder(id: string): Promise<void> {
    const document = await this.repository.load();
    await this.repository.save({
      ...document,
      reminders: document.reminders.filter((item) => item.id !== id),
    });
    await this.syncSchedules();
  }

  /**
   * Purpose: create a credit card plus statement/due (and extra) child reminders.
   * Inputs: account fields and ping drafts (defaults are two monthly pings).
   * Outputs: the parent CreditCardAccount.
   * Side effects: writes account + N reminder rows; reschedules notifications.
   */
  async createCreditCard(input: CreditCardCreateInput): Promise<CreditCardAccount> {
    const document = await this.repository.load();
    const nowIso = new Date().toISOString();
    const account: CreditCardAccount = {
      id: createId(),
      name: input.name.trim() || 'Card',
      dueDayOfMonth: clampDay(input.dueDayOfMonth),
      statementDayOfMonth: clampDay(input.statementDayOfMonth),
      amountDue: input.amountDue,
      currentBalance: input.currentBalance,
      ...pickCardRewardFields(input),
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    const pings = input.pings.length
      ? input.pings
      : defaultCreditCardPings({
          name: account.name,
          dueDayOfMonth: account.dueDayOfMonth,
          statementDayOfMonth: account.statementDayOfMonth,
        });
    const children = pings.map((ping) =>
      draftToReminder(draftFromCreditCardPing(account.id, ping, account.amountDue), createId(), nowIso, nowIso),
    );
    await this.repository.save({
      reminders: [...children, ...document.reminders],
      creditCards: [account, ...document.creditCards],
    });
    await this.syncSchedules();
    return account;
  }

  /**
   * Purpose: update card money fields and rebuild child ping titles/notes if days change.
   */
  async updateCreditCard(id: string, input: CreditCardCreateInput): Promise<CreditCardAccount> {
    const document = await this.repository.load();
    const current = document.creditCards.find((item) => item.id === id);
    if (!current) {
      throw new Error('Card not found.');
    }
    const nowIso = new Date().toISOString();
    const account: CreditCardAccount = {
      ...current,
      name: input.name.trim() || current.name,
      dueDayOfMonth: clampDay(input.dueDayOfMonth),
      statementDayOfMonth: clampDay(input.statementDayOfMonth),
      amountDue: input.amountDue,
      currentBalance: input.currentBalance,
      ...pickCardRewardFields(input, current),
      updatedAt: nowIso,
    };
    const otherReminders = document.reminders.filter((item) => item.accountId !== id);
    const children = input.pings.map((ping) => {
      const existing = document.reminders.find((item) => item.accountId === id && item.pingRole === ping.role);
      const draft = draftFromCreditCardPing(account.id, ping, account.amountDue);
      return draftToReminder(
        draft,
        existing?.id ?? createId(),
        existing?.createdAt ?? nowIso,
        nowIso,
        existing?.anchorAt ?? nowIso,
      );
    });
    await this.repository.save({
      reminders: [...children, ...otherReminders],
      creditCards: document.creditCards.map((item) => (item.id === id ? account : item)),
    });
    await this.syncSchedules();
    return account;
  }

  /**
   * Purpose: flip isRegistered on one bank promotion for a card.
   * Inputs: card id + promotion id.
   * Outputs: none.
   * Side effects: persists updated promotions array; no notification resync needed.
   */
  async toggleCardPromotionRegistration(cardId: string, promoId: string): Promise<void> {
    const document = await this.repository.load();
    const current = document.creditCards.find((item) => item.id === cardId);
    if (!current) {
      throw new Error('Card not found.');
    }
    const promotions = current.promotions ?? [];
    const index = promotions.findIndex((promo) => promo.id === promoId);
    if (index < 0) {
      throw new Error('Promotion not found.');
    }
    const nextPromotions = promotions.map((promo, promoIndex) =>
      promoIndex === index ? { ...promo, isRegistered: !promo.isRegistered } : promo,
    );
    const nowIso = new Date().toISOString();
    await this.repository.save({
      ...document,
      creditCards: document.creditCards.map((item) =>
        item.id === cardId
          ? { ...item, promotions: nextPromotions, updatedAt: nowIso }
          : item,
      ),
    });
  }

  /**
   * Purpose: insert or replace one bank promotion on a card.
   * Inputs: card id + full CardBankPromotion.
   * Outputs: none.
   * Side effects: persists promotions; creates when id is new, replaces when existing.
   */
  async upsertCardPromotion(cardId: string, promo: CardBankPromotion): Promise<void> {
    const document = await this.repository.load();
    const current = document.creditCards.find((item) => item.id === cardId);
    if (!current) {
      throw new Error('Card not found.');
    }
    const promotions = current.promotions ?? [];
    const index = promotions.findIndex((item) => item.id === promo.id);
    const nextPromotions =
      index < 0
        ? [...promotions, promo]
        : promotions.map((item, promoIndex) => (promoIndex === index ? promo : item));
    const nowIso = new Date().toISOString();
    await this.repository.save({
      ...document,
      creditCards: document.creditCards.map((item) =>
        item.id === cardId
          ? { ...item, promotions: nextPromotions, updatedAt: nowIso }
          : item,
      ),
    });
  }

  /**
   * Purpose: remove one bank promotion from a card.
   * Inputs: card id + promotion id.
   * Outputs: none.
   * Side effects: persists filtered promotions array.
   */
  async deleteCardPromotion(cardId: string, promoId: string): Promise<void> {
    const document = await this.repository.load();
    const current = document.creditCards.find((item) => item.id === cardId);
    if (!current) {
      throw new Error('Card not found.');
    }
    const promotions = (current.promotions ?? []).filter((promo) => promo.id !== promoId);
    const nowIso = new Date().toISOString();
    await this.repository.save({
      ...document,
      creditCards: document.creditCards.map((item) =>
        item.id === cardId ? { ...item, promotions, updatedAt: nowIso } : item,
      ),
    });
  }

  /**
   * Purpose: append one extra ping to an existing card without replacing statement/due.
   */
  async addCreditCardPing(accountId: string, ping: CreditCardPingDraft): Promise<Reminder> {
    const document = await this.repository.load();
    const account = document.creditCards.find((item) => item.id === accountId);
    if (!account) {
      throw new Error('Card not found.');
    }
    const nowIso = new Date().toISOString();
    const reminder = draftToReminder(
      draftFromCreditCardPing(accountId, { ...ping, role: 'custom' }, account.amountDue),
      createId(),
      nowIso,
      nowIso,
    );
    await this.repository.save({ ...document, reminders: [reminder, ...document.reminders] });
    await this.syncSchedules();
    return reminder;
  }

  /**
   * Purpose: delete a card and every child ping.
   */
  async deleteCreditCard(id: string): Promise<void> {
    const document = await this.repository.load();
    await this.repository.save({
      reminders: document.reminders.filter((item) => item.accountId !== id),
      creditCards: document.creditCards.filter((item) => item.id !== id),
    });
    await this.syncSchedules();
  }

  /**
   * Purpose: refill the native DATE window from Model nextFireTimes.
   * Inputs: playSound from AppSettings; optional redactLockScreen + private tray copy when App Lock is on.
   * Outputs: true when native notifications are supported and permission is granted (or nothing to schedule).
   * Side effects: POST_NOTIFICATIONS / iOS alert only when at least one reminder is enabled; DATE sync uses current sound.
   * Design decisions: full title/note stay in-app only when lock is on — OS lock screen gets generic copy.
   */
  async syncSchedules(options: ReminderScheduleOptions = {}): Promise<boolean> {
    const playSound = options.playSound ?? this.soundOn;
    const redact = options.redactLockScreen ?? this.redactLockScreen;
    const privateTitle = options.privateTitle?.trim() || this.privateTitle;
    const privateBody = options.privateBody?.trim() || this.privateBody;
    const { reminders } = await this.repository.load();
    const enabled = reminders.filter((item) => item.enabled);
    if (enabled.length === 0) {
      await syncReminderNotifications([], playSound);
      return true;
    }
    if (reminderNotificationsSupported()) {
      const granted = await requestReminderPermission();
      if (!granted) {
        await syncReminderNotifications([], playSound);
        return false;
      }
    }
    const fires: ReminderNotificationFire[] = [];
    const now = new Date();
    for (const reminder of enabled) {
      const times = nextFireTimes(reminder, now, scheduleHorizon(reminder.recurrence));
      times.forEach((fireAt, index) => {
        fires.push({
          reminderId: reminder.id,
          index,
          title: redact ? privateTitle : (reminder.title.trim() || defaultTitleForKind(reminder.kind)),
          body: redact ? privateBody : (reminder.note?.trim() || defaultBodyForKind(reminder.kind)),
          fireAt,
          url: reminderOpenPath(reminder.kind),
        });
      });
    }
    await syncReminderNotifications(fires, playSound);
    return reminderNotificationsSupported();
  }
}

function clampDay(day: number): number {
  return Math.min(31, Math.max(1, Math.floor(day)));
}

/**
 * Purpose: map optional reward/bank fields from create/update input onto the account.
 * Inputs: CreditCardCreateInput; optional existing account for update fallbacks.
 * Outputs: partial CreditCardAccount reward fields.
 * Side effects: none.
 * Design decisions: omitted input fields keep current values on update; create defaults
 *   bankId to 'other', rewardType to cashback, baseRebateRate to 0.4%, empty arrays for rules/promos.
 */
function pickCardRewardFields(
  input: CreditCardCreateInput,
  current?: CreditCardAccount,
): Pick<
  CreditCardAccount,
  | 'bankId'
  | 'bankName'
  | 'cardTier'
  | 'rewardType'
  | 'baseRebateRate'
  | 'rebateRules'
  | 'monthlySpendCap'
  | 'monthlyRebateCap'
  | 'annualSpendCap'
  | 'minMonthlySpendRequirement'
  | 'promotions'
> {
  const bankId =
    typeof input.bankId === 'string' && input.bankId.trim()
      ? input.bankId.trim()
      : current?.bankId ?? 'other';
  const bankName =
    input.bankName !== undefined
      ? input.bankName.trim() || undefined
      : current?.bankName;
  const cardTier =
    input.cardTier !== undefined
      ? input.cardTier.trim() || undefined
      : current?.cardTier;
  const rewardType = input.rewardType ?? current?.rewardType ?? 'cashback';
  const baseRebateRate =
    input.baseRebateRate !== undefined &&
    Number.isFinite(input.baseRebateRate) &&
    input.baseRebateRate >= 0
      ? input.baseRebateRate
      : current?.baseRebateRate ?? 0.004;
  return {
    bankId,
    bankName,
    cardTier,
    rewardType,
    baseRebateRate,
    rebateRules: input.rebateRules ?? current?.rebateRules ?? [],
    monthlySpendCap:
      input.monthlySpendCap !== undefined ? input.monthlySpendCap : current?.monthlySpendCap,
    monthlyRebateCap:
      input.monthlyRebateCap !== undefined ? input.monthlyRebateCap : current?.monthlyRebateCap,
    annualSpendCap:
      input.annualSpendCap !== undefined ? input.annualSpendCap : current?.annualSpendCap,
    minMonthlySpendRequirement:
      input.minMonthlySpendRequirement !== undefined
        ? input.minMonthlySpendRequirement
        : current?.minMonthlySpendRequirement,
    promotions: input.promotions ?? current?.promotions ?? [],
  };
}

function draftToReminder(
  draft: ReminderDraft,
  id: string,
  createdAt: string,
  updatedAt: string,
  anchorAt: string = updatedAt,
  completion?: { lastCompletedAt?: string; completedDayKeys?: string[] },
): Reminder {
  const recurrence = isValidRecurrence(draft.recurrence) ? draft.recurrence : { type: 'daily' as const };
  const lastCompletedAt = draft.lastCompletedAt ?? completion?.lastCompletedAt;
  const completedDayKeys = draft.completedDayKeys ?? completion?.completedDayKeys;
  return {
    id,
    kind: draft.kind,
    title: draft.title.trim() || defaultTitleForKind(draft.kind),
    note: draft.note.trim() ? draft.note.trim() : undefined,
    hour: Math.min(23, Math.max(0, Math.floor(draft.hour))),
    minute: Math.min(59, Math.max(0, Math.floor(draft.minute))),
    enabled: draft.enabled,
    recurrence,
    priority: draft.priority ?? 'normal',
    categoryPath: draft.categoryPath ?? makeCategoryPath('other'),
    anchorAt,
    templateId: draft.templateId,
    accountId: draft.accountId,
    pingRole: draft.pingRole,
    lastCompletedAt,
    completedDayKeys: completedDayKeys?.length ? completedDayKeys : undefined,
    createdAt,
    updatedAt,
  };
}
