import type { MoneyCurrency } from '../settings/AppSettings';

/**
 * Purpose: structured result of on-device receipt OCR + domain parsing (no network).
 * Inputs: produced by `parseReceiptText` after an engine returns raw OCR text.
 * Outputs: merchant / amount / currency / date / items plus a short `cleanDescription` for note fields.
 * Side effects: none (pure data).
 * Design decisions: currency limited to MoneyCurrency (HKD|USD|CNY); amount is the best “total”
 *   guess, not every line price; `cleanDescription` prefers merchant + items + total for spend notes.
 */
export interface OcrReceiptResult {
  rawText: string;
  lines: string[];
  merchant?: string;
  amount?: number;
  currency?: MoneyCurrency;
  date?: string;
  items: string[];
  cleanDescription: string;
}

/** Common receipt chrome / boilerplate that is not a merchant or item. */
const HEADER_NOISE =
  /^(?:tax\s*invoice|invoice|receipt|official\s*receipt|welcome|thank\s*you|thanks|tel(?:ephone)?|phone|fax|www\.|http|gst|vat|abn|trn|cashier|counter|store\s*#|reg(?:ister)?|txn|transaction|card\s*sale|sale|copy|customer\s*copy|merchant\s*copy|duplicate|請保留|謝謝|歡迎光臨|收據|發票|電話|地址)\b/i;

const PHONE_OR_ADDRESS =
  /^(?:\+?\d[\d\s\-()]{6,}|\d{1,4}[\/\-]\d{1,4}[\/\-]\d{2,4}$|unit\s|flat\s|shop\s|rm\s|room\s|#\d)/i;

const TOTAL_LABEL =
  /(?:^|\b)(?:grand\s*)?total(?:\s*amount)?|amount\s*due|balance\s*due|應付|合計|總計|总计|合計金額|お会計|合計\s*¥?|合計金額/i;

const SUBTOTAL_OR_TAX =
  /(?:^|\b)(?:sub\s*total|subtotal|tax|gst|vat|service(?:\s*charge)?|tips?|discount|change|paid|cash|card|visa|master|octopus|八達通|服務費|稅|找續)/i;

const ITEM_PRICE_TAIL = /(?:HK\$|US\$|CN¥|¥|￥|\$|€)?\s*\d{1,6}(?:[.,]\d{2})?\s*$/i;

const MONEY_TOKEN =
  /(?:HK\$|US\$|CN¥|¥|￥|\$)\s*(\d{1,7}(?:[.,]\d{1,2})?)|(\d{1,7}(?:[.,]\d{2}))\s*(?:HKD|USD|CNY|RMB|元|圓)?/gi;

const DATE_ISO = /\b(20\d{2})[\/\-.](\d{1,2})[\/\-.](\d{1,2})\b/;
const DATE_DMY = /\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](20\d{2})\b/;

/**
 * Purpose: normalize a money token to a finite number (comma or dot decimals).
 * Inputs: raw numeric fragment from OCR (e.g. "1,280.50" or "45,00").
 * Outputs: number or undefined when unparseable.
 * Side effects: none.
 */
function parseMoneyNumber(raw: string): number | undefined {
  const cleaned = raw.replace(/,/g, '').trim();
  const n = Number.parseFloat(cleaned);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : undefined;
}

/**
 * Purpose: detect HKD / USD / CNY from a line that contains a money token.
 * Inputs: receipt line text.
 * Outputs: MoneyCurrency or undefined.
 * Side effects: none.
 * Design decisions: HK$ / HKD win over bare `$` (HKD-first app); US$ before generic `$`.
 */
function detectCurrency(line: string): MoneyCurrency | undefined {
  if (/\bHK\$|\bHKD\b|港幣|港币|港元/i.test(line)) {
    return 'HKD';
  }
  if (/\bUS\$|\bUSD\b|美金|美元/i.test(line)) {
    return 'USD';
  }
  if (/\bCN¥|\bCNY\b|\bRMB\b|人民币|人民幣|¥|￥/i.test(line)) {
    return 'CNY';
  }
  if (/\$/.test(line)) {
    return 'HKD';
  }
  return undefined;
}

/**
 * Purpose: collect money amounts mentioned on a line.
 * Inputs: one cleaned receipt line.
 * Outputs: list of positive amounts found.
 * Side effects: none.
 */
function amountsInLine(line: string): number[] {
  const found: number[] = [];
  const re = new RegExp(MONEY_TOKEN.source, 'gi');
  let match: RegExpExecArray | null;
  while ((match = re.exec(line)) !== null) {
    const token = match[1] ?? match[2];
    if (!token) {
      continue;
    }
    const n = parseMoneyNumber(token);
    if (n !== undefined) {
      found.push(n);
    }
  }
  return found;
}

/**
 * Purpose: normalize OCR date tokens to YYYY-MM-DD when possible.
 * Inputs: full raw text.
 * Outputs: ISO date string or undefined.
 * Side effects: none.
 * Design decisions: prefer ISO-looking dates; DMY assumes day-first (HK / UK style).
 */
function extractDate(text: string): string | undefined {
  const iso = DATE_ISO.exec(text);
  if (iso) {
    const y = iso[1];
    const m = iso[2].padStart(2, '0');
    const d = iso[3].padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const dmy = DATE_DMY.exec(text);
  if (dmy) {
    const d = dmy[1].padStart(2, '0');
    const m = dmy[2].padStart(2, '0');
    const y = dmy[3];
    return `${y}-${m}-${d}`;
  }
  return undefined;
}

/**
 * Purpose: drop receipt chrome and blank noise from OCR lines.
 * Inputs: raw multiline OCR string.
 * Outputs: cleaned non-empty lines suitable for merchant / item / total extraction.
 * Side effects: none.
 */
function cleanLines(rawText: string): string[] {
  return rawText
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter((line) => line.length > 0)
    .filter((line) => !HEADER_NOISE.test(line))
    .filter((line) => !PHONE_OR_ADDRESS.test(line))
    .filter((line) => !/^[-*=_.]{3,}$/.test(line));
}

/**
 * Purpose: pick merchant from the first substantial non-total line near the top.
 * Inputs: cleaned lines.
 * Outputs: merchant string or undefined.
 * Side effects: none.
 */
function extractMerchant(lines: string[]): string | undefined {
  for (const line of lines.slice(0, 6)) {
    if (TOTAL_LABEL.test(line) || SUBTOTAL_OR_TAX.test(line)) {
      continue;
    }
    if (amountsInLine(line).length > 0 && ITEM_PRICE_TAIL.test(line)) {
      continue;
    }
    if (/^\d{1,2}[:.]\d{2}/.test(line)) {
      continue;
    }
    if (line.length < 2 || line.length > 48) {
      continue;
    }
    return line;
  }
  return undefined;
}

/**
 * Purpose: find the best total amount and its currency from labeled or largest money tokens.
 * Inputs: cleaned lines.
 * Outputs: `{ amount, currency }` when found.
 * Side effects: none.
 * Design decisions: labeled Total/合計 lines win; otherwise take the largest amount that is not
 *   on an obvious tax/subtotal-only line.
 */
function extractTotal(lines: string[]): { amount?: number; currency?: MoneyCurrency } {
  let labeledAmount: number | undefined;
  let labeledCurrency: MoneyCurrency | undefined;
  let largest: number | undefined;
  let largestCurrency: MoneyCurrency | undefined;

  for (const line of lines) {
    const amounts = amountsInLine(line);
    if (amounts.length === 0) {
      continue;
    }
    const currency = detectCurrency(line);
    const primary = amounts[amounts.length - 1];

    if (TOTAL_LABEL.test(line)) {
      labeledAmount = primary;
      labeledCurrency = currency ?? labeledCurrency;
      continue;
    }
    if (SUBTOTAL_OR_TAX.test(line) && !TOTAL_LABEL.test(line)) {
      continue;
    }
    if (largest === undefined || primary > largest) {
      largest = primary;
      largestCurrency = currency ?? largestCurrency;
    }
  }

  if (labeledAmount !== undefined) {
    return { amount: labeledAmount, currency: labeledCurrency ?? largestCurrency };
  }
  return { amount: largest, currency: largestCurrency };
}

/**
 * Purpose: collect plausible line items (description + trailing price).
 * Inputs: cleaned lines, merchant name to skip.
 * Outputs: up to 6 short item labels without prices.
 * Side effects: none.
 */
function extractItems(lines: string[], merchant?: string): string[] {
  const items: string[] = [];
  for (const line of lines) {
    if (merchant && line === merchant) {
      continue;
    }
    if (TOTAL_LABEL.test(line) || SUBTOTAL_OR_TAX.test(line)) {
      continue;
    }
    if (!ITEM_PRICE_TAIL.test(line)) {
      continue;
    }
    const label = line.replace(ITEM_PRICE_TAIL, '').replace(/[.\-·]+$/, '').trim();
    if (label.length < 2 || label.length > 40) {
      continue;
    }
    if (/^\d+$/.test(label)) {
      continue;
    }
    items.push(label);
    if (items.length >= 6) {
      break;
    }
  }
  return items;
}

/**
 * Purpose: build a short note-ready description from parsed receipt fields.
 * Inputs: merchant, items, amount.
 * Outputs: human-readable description string (may be empty).
 * Side effects: none.
 * Design decisions: `Merchant · Item 1, Item 2 ($Total)` when possible; falls back to top lines.
 */
function buildCleanDescription(
  lines: string[],
  merchant: string | undefined,
  items: string[],
  amount: number | undefined,
): string {
  const money = amount !== undefined ? `($${amount % 1 === 0 ? amount.toFixed(0) : amount.toFixed(2)})` : undefined;
  const itemPart = items.length > 0 ? items.slice(0, 3).join(', ') : undefined;

  if (merchant && itemPart && money) {
    return `${merchant} · ${itemPart} ${money}`;
  }
  if (merchant && money) {
    return `${merchant} ${money}`;
  }
  if (merchant && itemPart) {
    return `${merchant} · ${itemPart}`;
  }
  if (merchant) {
    return merchant;
  }
  if (itemPart && money) {
    return `${itemPart} ${money}`;
  }
  if (money) {
    return money;
  }
  return lines.slice(0, 3).join(' · ');
}

/**
 * Purpose: turn raw OCR receipt text into structured spend/journal fields.
 * Inputs: multiline string from an on-device OCR engine (may be noisy).
 * Outputs: OcrReceiptResult with cleanDescription suitable for expense note / journal body.
 * Side effects: none.
 * Design decisions: pure domain — no I/O, no platform APIs; engines call this after recognition.
 */
export function parseReceiptText(rawText: string): OcrReceiptResult {
  const raw = typeof rawText === 'string' ? rawText : '';
  const lines = cleanLines(raw);
  const merchant = extractMerchant(lines);
  const { amount, currency } = extractTotal(lines);
  const date = extractDate(raw);
  const items = extractItems(lines, merchant);
  const cleanDescription = buildCleanDescription(lines, merchant, items, amount);

  return {
    rawText: raw,
    lines,
    merchant,
    amount,
    currency,
    date,
    items,
    cleanDescription,
  };
}
