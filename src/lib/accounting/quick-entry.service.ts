/**
 * Quick Entry Service
 * Templates, shortcuts, and fast data entry for accounting
 */

import { JournalEntry, JournalLine } from './types';

// ============================================
// ENTRY TEMPLATES
// ============================================

export interface EntryTemplate {
  id: string;
  name: string;
  category: 'SALES' | 'PURCHASES' | 'PAYROLL' | 'TAXES' | 'ADJUSTMENTS' | 'OTHER';
  description: string;
  lines: {
    accountCode: string;
    accountName: string;
    description?: string;
    debitFormula?: string; // e.g., "amount", "amount * 0.05"
    creditFormula?: string;
  }[];
  variables: {
    name: string;
    label: string;
    type: 'number' | 'text' | 'date' | 'select';
    options?: string[];
    defaultValue?: string | number | Date;
    required: boolean;
  }[];
  shortcut?: string; // Keyboard shortcut like "Ctrl+Shift+V"
  frequency: number; // Usage count for sorting
  lastUsed?: Date;
}

// Predefined templates
export const DEFAULT_TEMPLATES: EntryTemplate[] = [
  {
    id: 'tpl-sale',
    name: 'Vente avec taxes (QC)',
    category: 'SALES',
    description: 'Vente à un client québécois avec TPS/TVQ',
    lines: [
      { accountCode: '1110', accountName: 'Comptes clients', debitFormula: 'total' },
      { accountCode: '4010', accountName: 'Ventes', creditFormula: 'amount' },
      { accountCode: '2110', accountName: 'TPS à payer', creditFormula: 'amount * 0.05' },
      { accountCode: '2120', accountName: 'TVQ à payer', creditFormula: 'amount * 0.09975' },
    ],
    variables: [
      { name: 'amount', label: 'Montant HT', type: 'number', required: true },
      { name: 'customer', label: 'Client', type: 'text', required: false },
    ],
    shortcut: 'Ctrl+Shift+V',
    frequency: 0,
  },
  {
    id: 'tpl-purchase',
    name: 'Achat avec taxes (QC)',
    category: 'PURCHASES',
    description: 'Achat fournisseur avec CTI/RTI',
    lines: [
      { accountCode: '5010', accountName: 'Achats', debitFormula: 'amount' },
      { accountCode: '1115', accountName: 'TPS à recevoir (CTI)', debitFormula: 'amount * 0.05' },
      { accountCode: '1116', accountName: 'TVQ à recevoir (RTI)', debitFormula: 'amount * 0.09975' },
      { accountCode: '2000', accountName: 'Comptes fournisseurs', creditFormula: 'total' },
    ],
    variables: [
      { name: 'amount', label: 'Montant HT', type: 'number', required: true },
      { name: 'supplier', label: 'Fournisseur', type: 'text', required: false },
      { name: 'invoice', label: 'N° Facture', type: 'text', required: false },
    ],
    shortcut: 'Ctrl+Shift+A',
    frequency: 0,
  },
  {
    id: 'tpl-stripe-fee',
    name: 'Frais Stripe',
    category: 'OTHER',
    description: 'Enregistrement des frais de paiement Stripe',
    lines: [
      { accountCode: '6110', accountName: 'Frais Stripe', debitFormula: 'amount' },
      { accountCode: '1040', accountName: 'Compte Stripe', creditFormula: 'amount' },
    ],
    variables: [
      { name: 'amount', label: 'Montant des frais', type: 'number', required: true },
      { name: 'reference', label: 'Référence transaction', type: 'text', required: false },
    ],
    shortcut: 'Ctrl+Shift+S',
    frequency: 0,
  },
  {
    id: 'tpl-shipping',
    name: 'Frais de livraison',
    category: 'PURCHASES',
    description: 'Frais de livraison payés',
    lines: [
      { accountCode: '6010', accountName: 'Frais de livraison', debitFormula: 'amount' },
      { accountCode: '1010', accountName: 'Compte bancaire', creditFormula: 'amount' },
    ],
    variables: [
      { name: 'amount', label: 'Montant', type: 'number', required: true },
      { name: 'carrier', label: 'Transporteur', type: 'select', options: ['Postes Canada', 'FedEx', 'UPS', 'Purolator'], required: false },
    ],
    frequency: 0,
  },
  {
    id: 'tpl-bank-transfer',
    name: 'Transfert entre comptes',
    category: 'OTHER',
    description: 'Transfert de fonds entre comptes bancaires',
    // FIX: F072 - accountCode is empty because it's resolved dynamically from fromAccount/toAccount
    // variables at apply time. The template engine must validate that the selected variables
    // map to valid COA codes before creating the journal entry.
    lines: [
      { accountCode: '', accountName: '', description: 'Compte de destination', debitFormula: 'amount' },
      { accountCode: '', accountName: '', description: 'Compte source', creditFormula: 'amount' },
    ],
    variables: [
      { name: 'amount', label: 'Montant', type: 'number', required: true },
      { name: 'fromAccount', label: 'Compte source', type: 'select', options: ['1010', '1020', '1030', '1040'], required: true },
      { name: 'toAccount', label: 'Compte destination', type: 'select', options: ['1010', '1020', '1030', '1040'], required: true },
    ],
    frequency: 0,
  },
  {
    id: 'tpl-depreciation',
    name: 'Amortissement mensuel',
    category: 'ADJUSTMENTS',
    description: 'Écriture d\'amortissement des immobilisations',
    lines: [
      { accountCode: '6800', accountName: 'Dotation aux amortissements', debitFormula: 'amount' },
      { accountCode: '1590', accountName: 'Amortissement cumulé', creditFormula: 'amount' },
    ],
    variables: [
      { name: 'amount', label: 'Montant', type: 'number', required: true },
      { name: 'asset', label: 'Immobilisation', type: 'text', required: false },
    ],
    frequency: 0,
  },
  {
    id: 'tpl-tax-payment',
    name: 'Paiement TPS/TVQ',
    category: 'TAXES',
    description: 'Paiement des taxes à Revenu Québec',
    lines: [
      { accountCode: '2110', accountName: 'TPS à payer', debitFormula: 'gst' },
      { accountCode: '2120', accountName: 'TVQ à payer', debitFormula: 'qst' },
      { accountCode: '1010', accountName: 'Compte bancaire', creditFormula: 'gst + qst' },
    ],
    variables: [
      { name: 'gst', label: 'TPS nette', type: 'number', required: true },
      { name: 'qst', label: 'TVQ nette', type: 'number', required: true },
      { name: 'period', label: 'Période', type: 'text', required: false },
    ],
    frequency: 0,
  },
];

/**
 * Parse formula and calculate value using a safe recursive descent parser.
 * No eval() or new Function() - fully parsed and computed manually.
 */
export function evaluateFormula(
  formula: string,
  variables: Record<string, number>
): number {
  if (!formula) return 0;

  // Replace variable names with values
  // Sort by name length descending to avoid partial replacements (e.g., "total" before "t")
  let expression = formula;
  const sortedNames = Object.keys(variables).sort((a, b) => b.length - a.length);
  for (const name of sortedNames) {
    expression = expression.replace(
      new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
      String(variables[name])
    );
  }

  // FIX (F030): 'total' is now pre-calculated in numericValues before calling
  // evaluateFormula(). This block is a safety fallback only.
  // The hardcoded 1.14975 (QC: TPS 5% + TVQ 9.975%) is kept as a fallback
  // but should be avoided - callers should set numericValues.total explicitly.
  if (expression.includes('total')) {
    const amount = variables.amount || 0;
    console.warn('evaluateFormula: "total" not pre-calculated, using QC fallback rate 1.14975');
    const total = amount * 1.14975;
    expression = expression.replace(/total/g, String(total));
  }

  // Validate: only allow digits, decimals, arithmetic operators, parentheses, spaces
  if (!/^[\d\s+\-*/().]+$/.test(expression)) {
    return 0;
  }

  try {
    return safeArithmeticParse(expression);
  } catch {
    return 0;
  }
}

/**
 * Recursive descent parser for safe arithmetic evaluation.
 * Grammar: expr = term (('+' | '-') term)*
 *          term = factor (('*' | '/') factor)*
 *          factor = unary | '(' expr ')' | number
 *          unary = ('-' | '+') factor
 */
function safeArithmeticParse(input: string): number {
  const tokens = input.match(/(\d+\.?\d*|[+\-*/()])/g) || [];
  let pos = 0;

  function peek(): string | undefined { return tokens[pos]; }
  function consume(): string { return tokens[pos++]; }

  function parseExpr(): number {
    let result = parseTerm();
    while (peek() === '+' || peek() === '-') {
      const op = consume();
      const right = parseTerm();
      result = op === '+' ? result + right : result - right;
    }
    return result;
  }

  function parseTerm(): number {
    let result = parseFactor();
    while (peek() === '*' || peek() === '/') {
      const op = consume();
      const right = parseFactor();
      result = op === '*' ? result * right : right !== 0 ? result / right : 0;
    }
    return result;
  }

  function parseFactor(): number {
    if (peek() === '-') {
      consume();
      return -parseFactor();
    }
    if (peek() === '+') {
      consume();
      return parseFactor();
    }
    if (peek() === '(') {
      consume();
      const result = parseExpr();
      if (peek() === ')') consume();
      return result;
    }
    const token = consume();
    const num = parseFloat(token);
    if (isNaN(num)) return 0;
    return num;
  }

  return parseExpr();
}

/**
 * Generate entry from template
 */
export function generateEntryFromTemplate(
  template: EntryTemplate,
  values: Record<string, string | number | Date>,
  entryNumber: string
): Omit<JournalEntry, 'id' | 'createdAt' | 'createdBy'> {
  const numericValues: Record<string, number> = {};

  // Extract numeric values
  for (const variable of template.variables) {
    if (variable.type === 'number' && values[variable.name] !== undefined) {
      numericValues[variable.name] = parseFloat(String(values[variable.name])) || 0;
    }
  }

  // FIX (F040): Calculate 'total' in numericValues BEFORE calling evaluateFormula()
  // This prevents the issue where replacing 'total' in 'subtotal' could corrupt the expression.
  // Also FIX (F030): Use parameterized tax rate instead of hardcoded QC rate
  if (numericValues.amount) {
    // Default to QC rate; in future, accept province as a parameter
    const taxRate = numericValues.taxRate || 0.14975; // TPS 5% + TVQ 9.975%
    numericValues.total = numericValues.amount * (1 + taxRate);
  }

  // Generate lines
  const lines: JournalLine[] = template.lines.map((line, index) => {
    let accountCode = line.accountCode;
    
    // Handle dynamic account codes (e.g., for transfers)
    if (!accountCode && values[`${index === 0 ? 'toAccount' : 'fromAccount'}`]) {
      accountCode = String(values[`${index === 0 ? 'toAccount' : 'fromAccount'}`]);
    }

    return {
      id: `line-${Date.now()}-${index}`,
      accountCode,
      accountName: line.accountName || accountCode,
      description: line.description,
      debit: Math.round(evaluateFormula(line.debitFormula || '', numericValues) * 100) / 100,
      credit: Math.round(evaluateFormula(line.creditFormula || '', numericValues) * 100) / 100,
    };
  });

  // Build description
  let description = template.description;
  if (values.customer) description += ` - ${values.customer}`;
  if (values.supplier) description += ` - ${values.supplier}`;
  if (values.reference) description += ` (${values.reference})`;

  return {
    entryNumber,
    date: values.date ? new Date(values.date) : new Date(),
    description,
    type: 'MANUAL',
    status: 'DRAFT',
    reference: String(values.reference || values.invoice || ''),
    lines,
  };
}

/**
 * Get templates sorted by usage frequency
 */
export function getTemplatesByFrequency(templates: EntryTemplate[]): EntryTemplate[] {
  return [...templates].sort((a, b) => {
    // Sort by frequency, then by last used, then by name
    if (b.frequency !== a.frequency) return b.frequency - a.frequency;
    if (a.lastUsed && b.lastUsed) return b.lastUsed.getTime() - a.lastUsed.getTime();
    return a.name.localeCompare(b.name);
  });
}

/**
 * Record template usage
 */
export function recordTemplateUsage(template: EntryTemplate): void {
  template.frequency++;
  template.lastUsed = new Date();
  // In production, save to database/localStorage
}

// ============================================
// KEYBOARD SHORTCUTS
// ============================================

export interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  action: string;
  description: string;
}

export const KEYBOARD_SHORTCUTS: KeyboardShortcut[] = [
  { key: 'n', ctrl: true, action: 'NEW_ENTRY', description: 'Nouvelle écriture' },
  { key: 's', ctrl: true, action: 'SAVE', description: 'Enregistrer' },
  { key: 'Enter', ctrl: true, action: 'SAVE_AND_POST', description: 'Enregistrer et valider' },
  { key: 'Escape', action: 'CANCEL', description: 'Annuler' },
  { key: 'd', ctrl: true, action: 'DUPLICATE', description: 'Dupliquer l\'écriture' },
  { key: 'f', ctrl: true, action: 'SEARCH', description: 'Rechercher' },
  { key: 'ArrowDown', alt: true, action: 'ADD_LINE', description: 'Ajouter une ligne' },
  { key: 'ArrowUp', alt: true, action: 'REMOVE_LINE', description: 'Supprimer une ligne' },
  { key: '1', ctrl: true, shift: true, action: 'TEMPLATE_1', description: 'Template rapide 1' },
  { key: '2', ctrl: true, shift: true, action: 'TEMPLATE_2', description: 'Template rapide 2' },
  { key: '3', ctrl: true, shift: true, action: 'TEMPLATE_3', description: 'Template rapide 3' },
];

/**
 * Parse keyboard event to shortcut action
 */
export function parseKeyboardEvent(event: KeyboardEvent): string | null {
  for (const shortcut of KEYBOARD_SHORTCUTS) {
    if (
      event.key === shortcut.key &&
      !!event.ctrlKey === !!shortcut.ctrl &&
      !!event.shiftKey === !!shortcut.shift &&
      !!event.altKey === !!shortcut.alt
    ) {
      return shortcut.action;
    }
  }
  return null;
}

// ============================================
// DUPLICATE & COPY
// ============================================

/**
 * Duplicate an entry
 */
export function duplicateEntry(
  entry: JournalEntry,
  newEntryNumber: string,
  newDate?: Date
): Omit<JournalEntry, 'id' | 'createdAt' | 'createdBy' | 'postedAt' | 'postedBy'> {
  return {
    entryNumber: newEntryNumber,
    date: newDate || new Date(),
    description: `Copie de ${entry.description}`,
    type: 'MANUAL',
    status: 'DRAFT',
    reference: entry.reference,
    orderId: undefined,
    lines: entry.lines.map((line, index) => ({
      id: `line-dup-${Date.now()}-${index}`,
      accountCode: line.accountCode,
      accountName: line.accountName,
      description: line.description,
      debit: Number(line.debit),
      credit: Number(line.credit),
    })),
  };
}

/**
 * Reverse an entry (create opposite entry)
 */
export function reverseEntry(
  entry: JournalEntry,
  newEntryNumber: string,
  reason: string
): Omit<JournalEntry, 'id' | 'createdAt' | 'createdBy'> {
  return {
    entryNumber: newEntryNumber,
    date: new Date(),
    description: `Contre-passation: ${entry.description} - ${reason}`,
    type: 'ADJUSTMENT',
    status: 'DRAFT',
    reference: `REV-${entry.entryNumber}`,
    lines: entry.lines.map((line, index) => ({
      id: `line-rev-${Date.now()}-${index}`,
      accountCode: line.accountCode,
      accountName: line.accountName,
      description: `Contre-passation: ${line.description || ''}`,
      debit: Number(line.credit), // Swap debit/credit
      credit: Number(line.debit),
    })),
  };
}

// ============================================
// IMPORT FROM CLIPBOARD/CSV
// ============================================

/**
 * Parse CSV data for batch entry import
 */
export function parseCSVForEntries(
  csvContent: string
): {
  entries: Partial<JournalEntry>[];
  errors: string[];
} {
  const entries: Partial<JournalEntry>[] = [];
  const errors: string[] = [];
  
  const lines = csvContent.split('\n').filter(l => l.trim());
  if (lines.length < 2) {
    errors.push('Le fichier doit contenir au moins une ligne d\'en-tête et une ligne de données');
    return { entries, errors };
  }

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  
  // Validate required columns
  const requiredCols = ['date', 'description', 'account', 'debit', 'credit'];
  for (const col of requiredCols) {
    if (!headers.includes(col)) {
      errors.push(`Colonne requise manquante: ${col}`);
    }
  }
  
  if (errors.length > 0) return { entries, errors };

  // Group by entry number or date+description
  const groups = new Map<string, { date: Date; description: string; lines: JournalLine[] }>();
  // FIX: F074 - Detect duplicate rows by hashing date+account+debit+credit+description
  const seenRows = new Set<string>();

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));

    const date = cols[headers.indexOf('date')];
    const description = cols[headers.indexOf('description')];
    const account = cols[headers.indexOf('account')];
    const debit = parseFloat(cols[headers.indexOf('debit')]) || 0;
    const credit = parseFloat(cols[headers.indexOf('credit')]) || 0;
    const entryNum = cols[headers.indexOf('entry')] || `${date}-${description}`;

    // FIX: F074 - Skip duplicate rows (same date+account+debit+credit+description)
    const rowKey = `${date}|${account}|${debit}|${credit}|${description}`;
    if (seenRows.has(rowKey)) {
      errors.push(`Ligne ${i + 1}: doublon détecté (${date}, ${account}, D:${debit}, C:${credit})`);
      continue;
    }
    seenRows.add(rowKey);

    if (!groups.has(entryNum)) {
      groups.set(entryNum, {
        date: new Date(date),
        description,
        lines: [],
      });
    }

    groups.get(entryNum)!.lines.push({
      id: `import-${i}`,
      accountCode: account,
      accountName: account,
      debit,
      credit,
    });
  }

  for (const [, group] of groups) {
    entries.push({
      date: group.date,
      description: group.description,
      type: 'MANUAL',
      status: 'DRAFT',
      lines: group.lines,
    });
  }

  return { entries, errors };
}
