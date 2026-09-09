import type { Recurrence, Reminder, ReminderCategoryPath, ReminderKind, ReminderPriority, Weekday, MonthAnchor } from './Reminder';
import type {
  CardBankPromotion,
  CardRebateRule,
  CardRewardType,
  CreditCardAccount,
  CreditCardPingRole,
} from './creditCards';
import { makeCategoryPath } from './categories';
import { isValidRecurrence } from './nextFire';

const KINDS: ReminderKind[] = ['follow-up', 'goal', 'reflection', 'anniversary'];
const PRIORITIES: ReminderPriority[] = ['low', 'normal', 'high', 'urgent'];
const PING_ROLES: CreditCardPingRole[] = ['statement', 'due', 'custom'];
const REWARD_TYPES: CardRewardType[] = ['cashback', 'miles', 'points'];
const DEFAULT_BASE_REBATE_RATE = 0.004;
const DAY_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

export interface ReminderDocument {
  reminders: Reminder[];
  creditCards: CreditCardAccount[];
}

/**
 * Purpose: coerce stored JSON (legacy array or document) into reminders + credit cards.
 * Inputs: parsed JSON unknown.
 * Outputs: ReminderDocument.
 * Side effects: none.
 */
export function normalizeReminderDocument(raw: unknown): ReminderDocument {
  if (Array.isArray(raw)) {
    return { reminders: normalizeReminders(raw), creditCards: [] };
  }
  if (!raw || typeof raw !== 'object') {
    return { reminders: [], creditCards: [] };
  }
  const value = raw as Record<string, unknown>;
  return {
    reminders: normalizeReminders(value.reminders),
    creditCards: normalizeCreditCards(value.creditCards),
  };
}

/**
 * Purpose: coerce stored JSON into Reminder records; drop unreadable rows.
 * Inputs: parsed JSON unknown.
 * Outputs: valid Reminder array.
 * Side effects: none.
 */
export function normalizeReminders(raw: unknown): Reminder[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.map(normalizeReminder).filter((item): item is Reminder => item !== null);
}

/**
 * Purpose: validate one stored reminder object.
 * Inputs: unknown JSON value.
 * Outputs: Reminder or null.
 * Side effects: none.
 */
export function normalizeReminder(raw: unknown): Reminder | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const value = raw as Record<string, unknown>;
  const kind = KINDS.includes(value.kind as ReminderKind) ? (value.kind as ReminderKind) : null;
  const recurrence = parseRecurrence(value.recurrence);
  if (!kind || !recurrence || typeof value.id !== 'string' || typeof value.title !== 'string') {
    return null;
  }
  const hour = Number(value.hour);
  const minute = Number(value.minute);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
    return null;
  }
  const createdAt = typeof value.createdAt === 'string' ? value.createdAt : new Date().toISOString();
  const updatedAt = typeof value.updatedAt === 'string' ? value.updatedAt : createdAt;
  const anchorAt = typeof value.anchorAt === 'string' ? value.anchorAt : createdAt;
  const priority = PRIORITIES.includes(value.priority as ReminderPriority)
    ? (value.priority as ReminderPriority)
    : 'normal';
  return {
    id: value.id,
    kind,
    title: value.title,
    note: typeof value.note === 'string' && value.note.trim() ? value.note : undefined,
    hour: Math.min(23, Math.max(0, Math.floor(hour))),
    minute: Math.min(59, Math.max(0, Math.floor(minute))),
    enabled: value.enabled !== false,
    recurrence,
    priority,
    categoryPath: parseCategoryPath(value.categoryPath),
    anchorAt,
    templateId: typeof value.templateId === 'string' ? value.templateId : undefined,
    accountId: typeof value.accountId === 'string' ? value.accountId : undefined,
    pingRole: PING_ROLES.includes(value.pingRole as CreditCardPingRole)
      ? (value.pingRole as CreditCardPingRole)
      : undefined,
    lastCompletedAt:
      typeof value.lastCompletedAt === 'string' && !Number.isNaN(Date.parse(value.lastCompletedAt))
        ? value.lastCompletedAt
        : undefined,
    completedDayKeys: Array.isArray(value.completedDayKeys)
      ? value.completedDayKeys.filter(
          (key): key is string => typeof key === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(key),
        )
      : undefined,
    createdAt,
    updatedAt,
  };
}

/**
 * Purpose: validate stored credit-card parent rows.
 * Inputs: unknown JSON.
 * Outputs: CreditCardAccount list.
 * Side effects: none.
 */
export function normalizeCreditCards(raw: unknown): CreditCardAccount[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return null;
      }
      const value = item as Record<string, unknown>;
      if (typeof value.id !== 'string' || typeof value.name !== 'string') {
        return null;
      }
      const due = Number(value.dueDayOfMonth);
      const statement = Number(value.statementDayOfMonth);
      if (!Number.isFinite(due) || !Number.isFinite(statement)) {
        return null;
      }
      const amount = Number(value.amountDue);
      const balance = Number(value.currentBalance);
      const createdAt = typeof value.createdAt === 'string' ? value.createdAt : new Date().toISOString();
      const bankId =
        typeof value.bankId === 'string' && value.bankId.trim() ? value.bankId.trim() : 'other';
      const bankName =
        typeof value.bankName === 'string' && value.bankName.trim() ? value.bankName.trim() : undefined;
      const cardTier =
        typeof value.cardTier === 'string' && value.cardTier.trim() ? value.cardTier.trim() : undefined;
      const rewardType = REWARD_TYPES.includes(value.rewardType as CardRewardType)
        ? (value.rewardType as CardRewardType)
        : 'cashback';
      const baseRaw = Number(value.baseRebateRate);
      const baseRebateRate =
        Number.isFinite(baseRaw) && baseRaw >= 0 ? baseRaw : DEFAULT_BASE_REBATE_RATE;
      const account: CreditCardAccount = {
        id: value.id,
        name: value.name,
        dueDayOfMonth: Math.min(31, Math.max(1, Math.floor(due))),
        statementDayOfMonth: Math.min(31, Math.max(1, Math.floor(statement))),
        amountDue: Number.isFinite(amount) ? amount : undefined,
        currentBalance: Number.isFinite(balance) ? Math.max(0, balance) : undefined,
        bankId,
        bankName,
        cardTier,
        rewardType,
        baseRebateRate,
        rebateRules: normalizeRebateRules(value.rebateRules),
        monthlySpendCap: parsePositiveFinite(value.monthlySpendCap),
        monthlyRebateCap: parsePositiveFinite(value.monthlyRebateCap),
        annualSpendCap: parsePositiveFinite(value.annualSpendCap),
        minMonthlySpendRequirement: parsePositiveFinite(value.minMonthlySpendRequirement),
        promotions: normalizePromotions(value.promotions),
        createdAt,
        updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : createdAt,
      };
      return account;
    })
    .filter((item): item is CreditCardAccount => item !== null);
}

/**
 * Purpose: coerce optional positive finite numbers used for spend/rebate caps.
 * Inputs: unknown JSON value.
 * Outputs: finite number > 0, or undefined.
 * Side effects: none.
 */
function parsePositiveFinite(raw: unknown): number | undefined {
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    return undefined;
  }
  return value;
}

/**
 * Purpose: sanitize stored category rebate rules.
 * Inputs: unknown JSON array.
 * Outputs: valid CardRebateRule list (drops unreadable rows).
 * Side effects: none.
 */
function normalizeRebateRules(raw: unknown): CardRebateRule[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw
    .map((item): CardRebateRule | null => {
      if (!item || typeof item !== 'object') {
        return null;
      }
      const value = item as Record<string, unknown>;
      if (typeof value.id !== 'string' || !value.id.trim()) {
        return null;
      }
      if (typeof value.category !== 'string' || !value.category.trim()) {
        return null;
      }
      const rate = Number(value.rebateRate);
      if (!Number.isFinite(rate) || rate < 0) {
        return null;
      }
      const rule: CardRebateRule = {
        id: value.id.trim(),
        category: value.category.trim(),
        rebateRate: rate,
        minSpendPerTx: parsePositiveFinite(value.minSpendPerTx),
        monthlySpendCap: parsePositiveFinite(value.monthlySpendCap),
        monthlyRebateCap: parsePositiveFinite(value.monthlyRebateCap),
        isPooledCap: value.isPooledCap === true ? true : undefined,
        pooledCapId:
          typeof value.pooledCapId === 'string' && value.pooledCapId.trim()
            ? value.pooledCapId.trim()
            : undefined,
        description:
          typeof value.description === 'string' && value.description.trim()
            ? value.description.trim()
            : undefined,
      };
      return rule;
    })
    .filter((item): item is CardRebateRule => item !== null);
}

/**
 * Purpose: sanitize stored bank promotions.
 * Inputs: unknown JSON array.
 * Outputs: valid CardBankPromotion list (drops unreadable rows).
 * Side effects: none.
 */
function normalizePromotions(raw: unknown): CardBankPromotion[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw
    .map((item): CardBankPromotion | null => {
      if (!item || typeof item !== 'object') {
        return null;
      }
      const value = item as Record<string, unknown>;
      if (typeof value.id !== 'string' || !value.id.trim()) {
        return null;
      }
      if (typeof value.title !== 'string' || !value.title.trim()) {
        return null;
      }
      if (typeof value.startDate !== 'string' || !DAY_KEY_RE.test(value.startDate)) {
        return null;
      }
      if (typeof value.endDate !== 'string' || !DAY_KEY_RE.test(value.endDate)) {
        return null;
      }
      const extra = Number(value.extraRebateRate);
      if (!Number.isFinite(extra) || extra < 0) {
        return null;
      }
      const promo: CardBankPromotion = {
        id: value.id.trim(),
        title: value.title.trim(),
        category:
          typeof value.category === 'string' && value.category.trim()
            ? value.category.trim()
            : undefined,
        extraRebateRate: extra,
        startDate: value.startDate,
        endDate: value.endDate,
        minSpendPerTx: parsePositiveFinite(value.minSpendPerTx),
        minTotalSpend: parsePositiveFinite(value.minTotalSpend),
        maxRebateCap: parsePositiveFinite(value.maxRebateCap),
        requiresRegistration: value.requiresRegistration === true,
        isRegistered: value.isRegistered === true,
        termsNote:
          typeof value.termsNote === 'string' && value.termsNote.trim()
            ? value.termsNote.trim()
            : undefined,
      };
      return promo;
    })
    .filter((item): item is CardBankPromotion => item !== null);
}

function parseCategoryPath(raw: unknown): ReminderCategoryPath {
  if (!raw || typeof raw !== 'object') {
    return makeCategoryPath('other');
  }
  const value = raw as Record<string, unknown>;
  const top = typeof value.top === 'string' && value.top ? value.top : 'other';
  return makeCategoryPath(
    top,
    typeof value.subcategory === 'string' ? value.subcategory : undefined,
    typeof value.type === 'string' ? value.type : undefined,
  );
}

function parseRecurrence(raw: unknown): Recurrence | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const value = raw as Record<string, unknown>;
  const type = value.type;
  let recurrence: Recurrence | null = null;
  if (type === 'once') {
    recurrence = { type: 'once', dayKey: typeof value.dayKey === 'string' ? value.dayKey : '' };
  } else if (type === 'daily') {
    recurrence = { type: 'daily' };
  } else if (type === 'weekly') {
    const weekdays = Array.isArray(value.weekdays)
      ? value.weekdays.filter((day): day is Weekday => isWeekday(day))
      : [];
    recurrence = { type: 'weekly', weekdays };
  } else if (type === 'monthly') {
    const monthAnchor = parseMonthAnchor(value.monthAnchor);
    let dayOfMonth = Number(value.dayOfMonth);
    if (monthAnchor === 'start') {
      dayOfMonth = 1;
    } else if (monthAnchor === 'end' && !Number.isFinite(dayOfMonth)) {
      dayOfMonth = 31;
    }
    recurrence = {
      type: 'monthly',
      dayOfMonth,
      ...(monthAnchor ? { monthAnchor } : {}),
    };
  } else if (type === 'yearly') {
    recurrence = { type: 'yearly', month: Number(value.month), day: Number(value.day) };
  } else if (type === 'every-n-days') {
    recurrence = { type: 'every-n-days', interval: Number(value.interval) };
  } else if (type === 'every-n-weeks') {
    recurrence = {
      type: 'every-n-weeks',
      interval: Number(value.interval),
      weekday: isWeekday(value.weekday) ? value.weekday : 0,
    };
  } else if (type === 'every-n-months') {
    recurrence = {
      type: 'every-n-months',
      interval: Number(value.interval),
      dayOfMonth: Number(value.dayOfMonth),
    };
  }
  if (!recurrence || !isValidRecurrence(recurrence)) {
    return null;
  }
  return recurrence;
}

function parseMonthAnchor(raw: unknown): MonthAnchor | undefined {
  if (raw === 'start' || raw === 'end' || raw === 'date') {
    return raw;
  }
  return undefined;
}

function isWeekday(value: unknown): value is Weekday {
  return value === 0 || value === 1 || value === 2 || value === 3 || value === 4 || value === 5 || value === 6;
}
