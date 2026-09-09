import type { ExpenseCategory, ExpenseDraft } from './Expense';
import type { MoneyCurrency } from '../settings/AppSettings';
import { buildExpenseFxSnapshot, type FxRateTable } from './fx';
import { toDayKey } from '../../utils/dateUtils';

/**
 * Purpose: result of on-device voice / typed quick-add parsing (no network, no ML model).
 * Inputs: parseVoiceSpend(raw transcript).
 * Outputs: partial spend facts; every field optional because speech is ambiguous.
 * Side effects: none.
 * Design decisions: parser never invents values — missing fields stay undefined and the caller
 *   (Controller) fills Smart Defaults or rejects. Keeps parsing honest and testable.
 */
export interface ParsedVoiceSpend {
  amount?: number;
  currency?: MoneyCurrency;
  category?: ExpenseCategory;
  note?: string;
}

/** First number-like token: "35", "1,250", "12.5". */
const AMOUNT_PATTERN = /\d[\d,]*(?:\.\d{1,2})?/;

/**
 * Currency keyword rules, checked in order — specific qualifiers (US / 人民) before generic
 * units so "美元" never falls through to the bare "元" rule.
 * Design decisions: bare "dollar(s)", "蚊", "元", "圓", "块/塊" and "$" resolve to HKD because
 *   the app is HKD-first and she spends locally; Japanese "円" (JPY) is deliberately unmapped —
 *   MoneyCurrency only supports HKD/USD/CNY, so a yen mention leaves currency undefined and the
 *   caller falls back to her default currency instead of guessing wrong.
 */
const CURRENCY_RULES: ReadonlyArray<{ currency: MoneyCurrency; pattern: RegExp }> = [
  { currency: 'USD', pattern: /\busd\b|\bus\$|\bus\s?dollars?\b|美金|美元|米ドル/i },
  { currency: 'CNY', pattern: /\bcny\b|\brmb\b|\byuan\b|人民币|人民幣|人民元/i },
  {
    currency: 'HKD',
    pattern: /\bhkd\b|hk\$|hong\s*kong\s*dollars?|港幣|港币|港元|港圓|香港ドル|\bdollars?\b|蚊|元|圓|塊|块|\$/i,
  },
];

/** Global patterns used to strip currency noise out of the note. */
const CURRENCY_NOISE: RegExp[] = [
  /\bus\s?dollars?\b|\busd\b|us\$/gi,
  /\bcny\b|\brmb\b|\byuan\b/gi,
  /\bhong\s*kong\s*dollars?\b|\bhkd\b|hk\$|\bdollars?\b|\$/gi,
  /美金|美元|米ドル/g,
  /人民币|人民幣|人民元/g,
  /港幣|港币|港元|港圓|香港ドル/g,
  /蚊|元|圓|塊|块/g,
];

/** Leading verb filler that adds no merchant meaning ("spent", "paid", "花了", "使った"…). */
const FILLER_PREFIX = /^(?:spent|spend|paid|pay|bought|buy|add|log|for|on|please|記|记|花了|用咗|使った|支払った|払った|買|买)\s*/i;

/**
 * Category keywords in English, Traditional Chinese, Simplified Chinese, and Japanese.
 * Checked in order; first category with any keyword hit wins.
 * Design decisions: ASCII keywords match on word boundaries so "bus" does not fire inside
 *   "business" and "tea" not inside "steak"; CJK keywords use substring matching (no word
 *   boundaries in CJK text) and are kept specific (e.g. no bare "食") to avoid cross-category
 *   false positives like "食料品" triggering dining.
 */
const CATEGORY_KEYWORDS: ReadonlyArray<{ category: ExpenseCategory; keywords: string[] }> = [
  {
    category: 'dining',
    keywords: [
      'coffee', 'cafe', 'café', 'tea', 'lunch', 'dinner', 'breakfast', 'brunch', 'restaurant',
      'meal', 'drink', 'drinks', 'snack', 'bakery', 'noodle', 'noodles', 'sushi', 'ramen',
      '咖啡', '早餐', '午餐', '晚餐', '飯', '饭', '餐', '麵', '面', '飲', '饮', '小食', '餐廳', '餐厅', '茶',
      'コーヒー', 'カフェ', 'ランチ', '朝食', '昼食', '夕食', 'ご飯', 'ごはん', '食事', 'ラーメン', '寿司',
    ],
  },
  {
    category: 'transport',
    keywords: [
      'mtr', 'bus', 'taxi', 'uber', 'train', 'metro', 'subway', 'ferry', 'tram', 'fuel', 'petrol', 'parking', 'ride',
      '地鐵', '地铁', '港鐵', '港铁', '巴士', '的士', '車費', '车费', '交通', '電車', '电车', '船', '泊車', '泊车',
      '地下鉄', 'バス', 'タクシー', '乗車', '交通費',
    ],
  },
  {
    category: 'groceries',
    keywords: [
      'grocery', 'groceries', 'supermarket', 'market', 'wellcome', 'parknshop', 'marketplace',
      '超市', '雜貨', '杂货', '買菜', '买菜', '街市', '超級市場', '超级市场',
      'スーパー', '食料品', '日用品',
    ],
  },
  {
    category: 'bills',
    keywords: [
      'bill', 'bills', 'rent', 'electricity', 'water', 'gas', 'internet', 'wifi', 'utility', 'utilities', 'insurance', 'phone bill',
      '賬單', '账单', '租金', '房租', '電費', '电费', '水費', '水费', '煤氣', '煤气', '電話費', '电话费', '網費', '网费', '保險', '保险',
      '家賃', '電気代', '水道代', 'ガス代', '携帯代', '保険', '請求書',
    ],
  },
  {
    category: 'shopping',
    keywords: [
      'shopping', 'clothes', 'clothing', 'shoes', 'shirt', 'dress', 'bag', 'bought',
      '購物', '购物', '衫', '衣服', '鞋', '手袋', '買衫',
      '買い物', '服', '靴', 'バッグ',
    ],
  },
  {
    category: 'entertainment',
    keywords: [
      'movie', 'cinema', 'film', 'game', 'games', 'concert', 'show', 'netflix', 'spotify', 'ticket', 'tickets', 'karaoke',
      '電影', '电影', '戲', '戏', '遊戲', '游戏', '演唱會', '演唱会', '娛樂', '娱乐', '門票', '门票', '卡拉ok',
      '映画', 'ゲーム', 'コンサート', '娯楽', 'カラオケ', 'チケット',
    ],
  },
  {
    category: 'health',
    keywords: [
      'doctor', 'medicine', 'pharmacy', 'hospital', 'clinic', 'gym', 'dentist', 'vitamin', 'vitamins',
      '醫生', '医生', '藥房', '药房', '藥', '药', '醫院', '医院', '診所', '诊所', '健身', '牙醫', '牙医',
      '医者', '病院', '薬', 'ジム', '歯医者', 'クリニック',
    ],
  },
];

/**
 * Purpose: escape a keyword for safe embedding in a RegExp.
 * Inputs: raw keyword.
 * Outputs: escaped string.
 * Side effects: none.
 */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Purpose: keyword match that respects word boundaries for ASCII and substring for CJK.
 * Inputs: source transcript (any case), one keyword.
 * Outputs: true when the keyword appears.
 * Side effects: none.
 * Design decisions: CJK scripts have no whitespace word boundaries, so substring is correct there;
 *   ASCII needs \b to avoid "bus" matching "business".
 */
function keywordMatches(source: string, keyword: string): boolean {
  // eslint-disable-next-line no-control-regex
  if (/^[\x00-\x7F]+$/.test(keyword)) {
    return new RegExp(`\\b${escapeRegExp(keyword)}\\b`, 'i').test(source);
  }
  return source.includes(keyword);
}

/**
 * Purpose: pull the first amount-like number out of a transcript.
 * Inputs: trimmed source text.
 * Outputs: parsed amount (grouping commas stripped), or undefined when no number is present.
 * Side effects: none.
 * Design decisions: first number wins — quick-add phrases carry exactly one amount; decimals
 *   beyond cents are not expected from speech.
 */
function extractAmount(source: string): number | undefined {
  const match = source.match(AMOUNT_PATTERN);
  if (!match) {
    return undefined;
  }
  const value = Number.parseFloat(match[0].replace(/,/g, ''));
  return Number.isFinite(value) ? value : undefined;
}

/**
 * Purpose: resolve the spoken currency, HKD-first.
 * Inputs: source text.
 * Outputs: HKD / USD / CNY, or undefined when nothing currency-ish was said (caller applies default).
 * Side effects: none.
 */
function detectCurrency(source: string): MoneyCurrency | undefined {
  for (const rule of CURRENCY_RULES) {
    if (rule.pattern.test(source)) {
      return rule.currency;
    }
  }
  return undefined;
}

/**
 * Purpose: map spoken keywords onto a spend category across en / zh-Hant / zh-Hans / ja.
 * Inputs: source text.
 * Outputs: first matching category, or undefined (caller applies Smart Default).
 * Side effects: none.
 */
function detectCategory(source: string): ExpenseCategory | undefined {
  for (const entry of CATEGORY_KEYWORDS) {
    for (const keyword of entry.keywords) {
      if (keywordMatches(source, keyword)) {
        return entry.category;
      }
    }
  }
  return undefined;
}

/**
 * Purpose: recover a human note from the transcript — the words that are not amount or currency.
 * Inputs: source text.
 * Outputs: trimmed note (≤ 48 chars, matching isMerchantishNote limits), or undefined when empty.
 * Side effects: none.
 * Design decisions: category keywords are KEPT in the note ("Coffee 35 dollars" → note "Coffee")
 *   because they are the merchant-ish words she would type; only amounts, currency units, and
 *   leading verb filler are stripped.
 */
function extractNote(source: string): string | undefined {
  let note = source.replace(AMOUNT_PATTERN, ' ');
  for (const noise of CURRENCY_NOISE) {
    note = note.replace(noise, ' ');
  }
  note = note.replace(FILLER_PREFIX, '').replace(/\s+/g, ' ').trim();
  if (!note) {
    return undefined;
  }
  return note.slice(0, 48);
}

/**
 * Purpose: parse a voice (or typed quick phrase) transcript into spend facts, fully on-device.
 * Inputs: raw transcript like "Coffee 35 dollars", "午餐 80 蚊", "ランチ 1200".
 * Outputs: ParsedVoiceSpend — e.g. { amount: 35, currency: 'HKD', category: 'dining', note: 'Coffee' }.
 * Side effects: none.
 * Design decisions: pure regex + keyword matching (no network, no ML) so it works offline and
 *   stays instant; unsupported hints are left undefined rather than guessed.
 */
export function parseVoiceSpend(text: string): ParsedVoiceSpend {
  const source = text.trim();
  if (!source) {
    return {};
  }
  return {
    amount: extractAmount(source),
    currency: detectCurrency(source),
    category: detectCategory(source),
    note: extractNote(source),
  };
}

/**
 * Purpose: build a complete ExpenseDraft from parsed voice facts for the Controller.
 * Inputs: parsed facts, local now, fallback currency (her default), fallback category
 *   (Smart Default from suggestQuickAdd), optional FX table + card fee for foreign locks.
 * Outputs: ExpenseDraft with dayKey and locked FX when foreign, or null when no amount was heard.
 * Side effects: none.
 * Design decisions: amount is mandatory — silently logging a guessed amount is worse than asking
 *   again; category/currency fall back to Smart Defaults; note passes through trimmed.
 */
export function buildExpenseDraftFromVoice(
  parsed: ParsedVoiceSpend,
  now: Date = new Date(),
  fallbackCurrency: MoneyCurrency = 'HKD',
  fallbackCategory: ExpenseCategory = 'other',
  fxTable?: FxRateTable | null,
  cardFeeRate: number = 0,
): ExpenseDraft | null {
  if (parsed.amount === undefined || !Number.isFinite(parsed.amount)) {
    return null;
  }
  const currency = parsed.currency ?? fallbackCurrency;
  const snapshot = buildExpenseFxSnapshot(parsed.amount, currency, fxTable, cardFeeRate, now);
  return {
    amount: Math.max(0, parsed.amount),
    currency,
    category: parsed.category ?? fallbackCategory,
    dayKey: toDayKey(now),
    note: parsed.note,
    fx: snapshot ?? (currency === 'HKD' ? null : undefined),
  };
}
