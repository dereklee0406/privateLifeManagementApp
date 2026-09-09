import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseReceiptText } from './receiptOcr';

describe('parseReceiptText', () => {
  it('parses a Hong Kong cafe receipt (merchant, total, HKD)', () => {
    const raw = `
WELCOME
TAX INVOICE
Cafe Bloom
Central, Hong Kong
TEL 2123 4567
Espresso          HK$38.00
Croissant         HK$32.00
Subtotal          HK$70.00
Service Charge    HK$7.00
Total             HK$77.00
Thank you
`;
    const result = parseReceiptText(raw);
    assert.equal(result.merchant, 'Cafe Bloom');
    assert.equal(result.amount, 77);
    assert.equal(result.currency, 'HKD');
    assert.ok(result.items.includes('Espresso'));
    assert.ok(result.items.includes('Croissant'));
    assert.match(result.cleanDescription, /Cafe Bloom/);
    assert.match(result.cleanDescription, /\$77/);
  });

  it('parses a supermarket receipt with ISO date', () => {
    const raw = `
RECEIPT
Wellcome
Milk 2L                 $28.90
Eggs 12pc               $32.50
Bread                   $18.00
TOTAL                   $79.40
2026-03-15 14:22
`;
    const result = parseReceiptText(raw);
    assert.equal(result.merchant, 'Wellcome');
    assert.equal(result.amount, 79.4);
    assert.equal(result.date, '2026-03-15');
    assert.ok(result.items.length >= 2);
    assert.match(result.cleanDescription, /Wellcome/);
  });

  it('parses a retail receipt with DD/MM/YYYY and US$', () => {
    const raw = `
Invoice
UNIQLO
T-Shirt M          US$29.90
Socks              US$9.90
Amount Due         US$39.80
15/09/2026
`;
    const result = parseReceiptText(raw);
    assert.equal(result.merchant, 'UNIQLO');
    assert.equal(result.amount, 39.8);
    assert.equal(result.currency, 'USD');
    assert.equal(result.date, '2026-09-15');
    assert.match(result.cleanDescription, /UNIQLO/);
  });

  it('handles unformatted OCR lines without crashing', () => {
    const raw = `
random noise
foo bar
42
`;
    const result = parseReceiptText(raw);
    assert.equal(result.rawText.includes('foo bar'), true);
    assert.ok(Array.isArray(result.lines));
    assert.ok(Array.isArray(result.items));
    assert.equal(typeof result.cleanDescription, 'string');
  });

  it('returns empty description for blank input', () => {
    const result = parseReceiptText('');
    assert.deepEqual(result.lines, []);
    assert.deepEqual(result.items, []);
    assert.equal(result.cleanDescription, '');
    assert.equal(result.merchant, undefined);
    assert.equal(result.amount, undefined);
  });

  it('prefers labeled Total over larger line-item noise', () => {
    const raw = `
Corner Shop
Widget A    $12.00
Widget B    $8.00
TOTAL       $20.00
`;
    const result = parseReceiptText(raw);
    assert.equal(result.amount, 20);
    assert.equal(result.merchant, 'Corner Shop');
  });

  it('builds merchant-only description when no items', () => {
    const raw = `
MTR Station
Total HK$18.50
`;
    const result = parseReceiptText(raw);
    assert.equal(result.merchant, 'MTR Station');
    assert.equal(result.amount, 18.5);
    assert.equal(result.cleanDescription, 'MTR Station ($18.50)');
  });
});
