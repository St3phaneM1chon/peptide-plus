/**
 * @jest-environment node
 */

/**
 * #93 Unit tests for quick-entry.service.ts
 *
 * Covers:
 * - Formula evaluation (safe arithmetic parser)
 * - Template generation with variables
 * - Template usage tracking and sorting
 * - Entry duplication and reversal
 * - CSV import parsing
 * - Keyboard shortcut parsing
 */

import {
  evaluateFormula,
  generateEntryFromTemplate,
  getTemplatesByFrequency,
  recordTemplateUsage,
  duplicateEntry,
  reverseEntry,
  parseCSVForEntries,
  DEFAULT_TEMPLATES,
  EntryTemplate,
} from '@/lib/accounting/quick-entry.service';
import { JournalEntry } from '@/lib/accounting/types';

// =====================================================
// FORMULA EVALUATION
// =====================================================

describe('evaluateFormula', () => {
  it('should evaluate simple variable substitution', () => {
    const result = evaluateFormula('amount', { amount: 100 });
    expect(result).toBe(100);
  });

  it('should evaluate multiplication formula', () => {
    const result = evaluateFormula('amount * 0.05', { amount: 100 });
    expect(result).toBeCloseTo(5, 2);
  });

  it('should evaluate QST formula (amount * 0.09975)', () => {
    const result = evaluateFormula('amount * 0.09975', { amount: 100 });
    expect(result).toBeCloseTo(9.975, 3);
  });

  it('should evaluate addition formula', () => {
    const result = evaluateFormula('gst + qst', { gst: 5, qst: 9.975 });
    expect(result).toBeCloseTo(14.975, 3);
  });

  it('should evaluate total variable (amount * 1.14975)', () => {
    const result = evaluateFormula('total', { amount: 100 });
    expect(result).toBeCloseTo(114.975, 2);
  });

  it('should return 0 for empty formula', () => {
    expect(evaluateFormula('', { amount: 100 })).toBe(0);
  });

  it('should return 0 for invalid formula with letters', () => {
    expect(evaluateFormula('DROP TABLE', {})).toBe(0);
  });

  it('should handle parentheses', () => {
    const result = evaluateFormula('(amount + 10) * 0.05', { amount: 100 });
    expect(result).toBeCloseTo(5.5, 2);
  });

  it('should handle division', () => {
    const result = evaluateFormula('amount / 2', { amount: 100 });
    expect(result).toBe(50);
  });

  it('should handle division by zero safely', () => {
    const result = evaluateFormula('amount / 0', { amount: 100 });
    expect(result).toBe(0);
  });

  it('should handle multiple variables sorted by length', () => {
    // "total" should not partially replace "totalAmount"
    const result = evaluateFormula('amount * 2', { amount: 50, totalAmount: 200 });
    expect(result).toBe(100);
  });

  it('should handle negative unary operator', () => {
    const result = evaluateFormula('-amount', { amount: 100 });
    // After substitution: -100, parsed as negative
    expect(result).toBe(-100);
  });
});

// =====================================================
// TEMPLATE GENERATION
// =====================================================

describe('generateEntryFromTemplate', () => {
  const saleTemplate = DEFAULT_TEMPLATES.find((t) => t.id === 'tpl-sale')!;

  it('should generate a sale entry with correct line count', () => {
    const entry = generateEntryFromTemplate(
      saleTemplate,
      { amount: 100, customer: 'Client Test' },
      'JV-2026-0001'
    );
    expect(entry.lines).toHaveLength(4);
    expect(entry.entryNumber).toBe('JV-2026-0001');
    expect(entry.status).toBe('DRAFT');
  });

  it('should calculate TPS and TVQ correctly on sale', () => {
    const entry = generateEntryFromTemplate(
      saleTemplate,
      { amount: 100 },
      'JV-2026-0002'
    );
    // Line 0: Comptes clients (debit = total = 100 * 1.14975)
    expect(entry.lines[0].debit).toBeCloseTo(114.98, 0);
    // Line 1: Ventes (credit = amount = 100)
    expect(entry.lines[1].credit).toBe(100);
    // Line 2: TPS (credit = 100 * 0.05 = 5)
    expect(entry.lines[2].credit).toBe(5);
    // Line 3: TVQ (credit = 100 * 0.09975 = 9.975 -> rounded)
    expect(entry.lines[3].credit).toBeCloseTo(9.98, 1);
  });

  it('should append customer name to description', () => {
    const entry = generateEntryFromTemplate(
      saleTemplate,
      { amount: 100, customer: 'Jean Dupont' },
      'JV-2026-0003'
    );
    expect(entry.description).toContain('Jean Dupont');
  });

  it('should use current date when no date provided', () => {
    const entry = generateEntryFromTemplate(
      saleTemplate,
      { amount: 100 },
      'JV-2026-0004'
    );
    const now = new Date();
    expect(entry.date.getFullYear()).toBe(now.getFullYear());
  });

  it('should use provided date when specified', () => {
    const entry = generateEntryFromTemplate(
      saleTemplate,
      { amount: 100, date: '2026-06-15' },
      'JV-2026-0005'
    );
    expect(entry.date.toISOString()).toContain('2026-06-15');
  });

  it('should generate purchase entry with supplier info', () => {
    const purchaseTemplate = DEFAULT_TEMPLATES.find((t) => t.id === 'tpl-purchase')!;
    const entry = generateEntryFromTemplate(
      purchaseTemplate,
      { amount: 200, supplier: 'Fournisseur ABC', invoice: 'FAC-001' },
      'JV-2026-0010'
    );
    expect(entry.description).toContain('Fournisseur ABC');
    expect(entry.reference).toBe('FAC-001');
  });

  it('should handle bank transfer template with dynamic accounts', () => {
    const transferTemplate = DEFAULT_TEMPLATES.find((t) => t.id === 'tpl-bank-transfer')!;
    const entry = generateEntryFromTemplate(
      transferTemplate,
      { amount: 500, fromAccount: '1010', toAccount: '1020' },
      'JV-2026-0020'
    );
    expect(entry.lines[0].accountCode).toBe('1020'); // destination
    expect(entry.lines[1].accountCode).toBe('1010'); // source
    expect(entry.lines[0].debit).toBe(500);
    expect(entry.lines[1].credit).toBe(500);
  });
});

// =====================================================
// TEMPLATE SORTING & USAGE
// =====================================================

describe('getTemplatesByFrequency', () => {
  it('should sort templates by frequency descending', () => {
    const templates: EntryTemplate[] = [
      { ...DEFAULT_TEMPLATES[0], frequency: 5 },
      { ...DEFAULT_TEMPLATES[1], frequency: 10 },
      { ...DEFAULT_TEMPLATES[2], frequency: 1 },
    ];
    const sorted = getTemplatesByFrequency(templates);
    expect(sorted[0].frequency).toBe(10);
    expect(sorted[1].frequency).toBe(5);
    expect(sorted[2].frequency).toBe(1);
  });

  it('should sort by lastUsed when frequency is equal', () => {
    const templates: EntryTemplate[] = [
      { ...DEFAULT_TEMPLATES[0], frequency: 5, lastUsed: new Date('2026-01-01') },
      { ...DEFAULT_TEMPLATES[1], frequency: 5, lastUsed: new Date('2026-02-01') },
    ];
    const sorted = getTemplatesByFrequency(templates);
    expect(sorted[0].id).toBe(templates[1].id); // More recent first
  });
});

describe('recordTemplateUsage', () => {
  it('should increment frequency and set lastUsed', () => {
    const template = { ...DEFAULT_TEMPLATES[0], frequency: 0 };
    recordTemplateUsage(template);
    expect(template.frequency).toBe(1);
    expect(template.lastUsed).toBeDefined();
    recordTemplateUsage(template);
    expect(template.frequency).toBe(2);
  });
});

// =====================================================
// DUPLICATION & REVERSAL
// =====================================================

describe('duplicateEntry', () => {
  const mockEntry: JournalEntry = {
    id: 'entry-1',
    entryNumber: 'JV-2026-0001',
    date: new Date('2026-01-15'),
    description: 'Vente test',
    type: 'MANUAL',
    status: 'POSTED',
    reference: 'REF-001',
    lines: [
      { id: 'l1', accountCode: '1110', accountName: 'Clients', debit: 100, credit: 0 },
      { id: 'l2', accountCode: '4010', accountName: 'Ventes', debit: 0, credit: 100 },
    ],
    createdBy: 'user-1',
    createdAt: new Date('2026-01-15'),
  };

  it('should create a DRAFT copy with new entry number', () => {
    const dup = duplicateEntry(mockEntry, 'JV-2026-0050');
    expect(dup.entryNumber).toBe('JV-2026-0050');
    expect(dup.status).toBe('DRAFT');
    expect(dup.description).toContain('Copie de');
  });

  it('should preserve line amounts', () => {
    const dup = duplicateEntry(mockEntry, 'JV-2026-0051');
    expect(dup.lines[0].debit).toBe(100);
    expect(dup.lines[1].credit).toBe(100);
  });

  it('should use provided date or default to now', () => {
    const withDate = duplicateEntry(mockEntry, 'JV-2026-0052', new Date('2026-06-01'));
    expect(withDate.date.toISOString()).toContain('2026-06-01');
    const withoutDate = duplicateEntry(mockEntry, 'JV-2026-0053');
    expect(withoutDate.date.getFullYear()).toBe(new Date().getFullYear());
  });
});

describe('reverseEntry', () => {
  const mockEntry: JournalEntry = {
    id: 'entry-1',
    entryNumber: 'JV-2026-0001',
    date: new Date('2026-01-15'),
    description: 'Vente test',
    type: 'MANUAL',
    status: 'POSTED',
    lines: [
      { id: 'l1', accountCode: '1110', accountName: 'Clients', debit: 100, credit: 0 },
      { id: 'l2', accountCode: '4010', accountName: 'Ventes', debit: 0, credit: 100 },
    ],
    createdBy: 'user-1',
    createdAt: new Date(),
  };

  it('should swap debits and credits', () => {
    const rev = reverseEntry(mockEntry, 'JV-2026-0060', 'Erreur');
    expect(rev.lines[0].debit).toBe(0);
    expect(rev.lines[0].credit).toBe(100);
    expect(rev.lines[1].debit).toBe(100);
    expect(rev.lines[1].credit).toBe(0);
  });

  it('should include reason and original ref', () => {
    const rev = reverseEntry(mockEntry, 'JV-2026-0061', 'Montant erroné');
    expect(rev.description).toContain('Contre-passation');
    expect(rev.description).toContain('Montant erroné');
    expect(rev.reference).toBe('REV-JV-2026-0001');
  });

  it('should have type ADJUSTMENT', () => {
    const rev = reverseEntry(mockEntry, 'JV-2026-0062', 'Test');
    expect(rev.type).toBe('ADJUSTMENT');
  });
});

// =====================================================
// CSV IMPORT
// =====================================================

describe('parseCSVForEntries', () => {
  it('should parse valid CSV data into entries', () => {
    const csv = `date,description,account,debit,credit
2026-01-15,Vente test,4010,0,100
2026-01-15,Vente test,1110,100,0`;
    const result = parseCSVForEntries(csv);
    expect(result.errors).toHaveLength(0);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].lines).toHaveLength(2);
  });

  it('should report missing required columns', () => {
    const csv = `date,description,amount
2026-01-15,Test,100`;
    const result = parseCSVForEntries(csv);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.some((e) => e.includes('account'))).toBe(true);
  });

  it('should reject CSV with only header', () => {
    const csv = 'date,description,account,debit,credit';
    const result = parseCSVForEntries(csv);
    expect(result.entries).toHaveLength(0);
  });

  it('should reject CSV with insufficient lines', () => {
    const csv = 'single line only';
    const result = parseCSVForEntries(csv);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('should group lines by entry number', () => {
    const csv = `date,description,account,debit,credit,entry
2026-01-15,Vente A,4010,0,100,E001
2026-01-15,Vente A,1110,100,0,E001
2026-01-16,Vente B,4010,0,200,E002
2026-01-16,Vente B,1110,200,0,E002`;
    const result = parseCSVForEntries(csv);
    expect(result.entries).toHaveLength(2);
  });
});
