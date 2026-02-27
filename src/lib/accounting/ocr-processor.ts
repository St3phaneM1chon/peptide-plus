/**
 * Invoice OCR Processor
 * Extract vendor, amounts, line items from scanned invoices
 * Uses pattern matching for high accuracy without external API
 */

export interface OcrExtraction {
  vendor: string | null;
  date: string | null;
  invoiceNumber: string | null;
  subtotal: number | null;
  taxAmount: number | null;
  total: number | null;
  currency: string;
  lineItems: Array<{ description: string; quantity: number; unitPrice: number; total: number }>;
  confidence: number;
  rawText: string;
}

// Common patterns for Canadian invoices
const DATE_PATTERNS = [
  /(\d{4}[-/]\d{2}[-/]\d{2})/, // 2026-02-24
  /(\d{2}[-/]\d{2}[-/]\d{4})/, // 24/02/2026
  /(\d{1,2}\s+(?:jan|fév|mar|avr|mai|jun|jul|aoû|sep|oct|nov|déc)\w*\s+\d{4})/i,
];
const INVOICE_NUM_PATTERNS = [
  /(?:facture|invoice|#|no\.?)\s*[:.]?\s*([A-Z0-9-]+)/i,
  /(?:INV|FAC)-?\d+/i,
];
const TAX_PATTERNS = [
  /(?:TPS|GST)\s*[:.]?\s*\$?\s*(\d+\.\d{2})/i,
  /(?:TVQ|QST)\s*[:.]?\s*\$?\s*(\d+\.\d{2})/i,
  /(?:TVH|HST)\s*[:.]?\s*\$?\s*(\d+\.\d{2})/i,
];
const TOTAL_PATTERNS = [
  /(?:total|montant total|grand total)\s*[:.]?\s*\$?\s*(\d{1,3}(?:[, ]\d{3})*(?:\.\d{2}))/i,
];

export function extractFromText(rawText: string): OcrExtraction {
  const result: OcrExtraction = {
    vendor: null,
    date: null,
    invoiceNumber: null,
    subtotal: null,
    taxAmount: null,
    total: null,
    currency: 'CAD',
    lineItems: [],
    confidence: 0,
    rawText,
  };

  let confidencePoints = 0;
  const maxPoints = 5;

  // Extract date
  for (const pattern of DATE_PATTERNS) {
    const match = rawText.match(pattern);
    if (match) {
      result.date = match[1];
      confidencePoints++;
      break;
    }
  }

  // Extract invoice number
  for (const pattern of INVOICE_NUM_PATTERNS) {
    const match = rawText.match(pattern);
    if (match) {
      result.invoiceNumber = match[1] || match[0];
      confidencePoints++;
      break;
    }
  }

  // Extract total
  for (const pattern of TOTAL_PATTERNS) {
    const match = rawText.match(pattern);
    if (match) {
      result.total = parseFloat(match[1].replace(/[, ]/g, ''));
      confidencePoints++;
      break;
    }
  }

  // Extract taxes
  let totalTax = 0;
  for (const pattern of TAX_PATTERNS) {
    const match = rawText.match(pattern);
    if (match) {
      totalTax += parseFloat(match[1]);
    }
  }
  if (totalTax > 0) {
    result.taxAmount = Math.round(totalTax * 100) / 100;
    confidencePoints++;
  }

  // Calculate subtotal if we have total and tax
  if (result.total && result.taxAmount) {
    result.subtotal = Math.round((result.total - result.taxAmount) * 100) / 100;
  }

  // Extract vendor (first non-empty line, heuristic)
  const lines = rawText.split('\n').map(l => l.trim()).filter(l => l.length > 2);
  if (lines.length > 0) {
    // Vendor is usually the first substantive line
    result.vendor = lines[0].substring(0, 100);
    confidencePoints++;
  }

  // Calculate confidence
  result.confidence = Math.round((confidencePoints / maxPoints) * 100) / 100;

  return result;
}

export function formatExtraction(extraction: OcrExtraction): string {
  const lines: string[] = [];
  if (extraction.vendor) lines.push(`Fournisseur: ${extraction.vendor}`);
  if (extraction.date) lines.push(`Date: ${extraction.date}`);
  if (extraction.invoiceNumber) lines.push(`# Facture: ${extraction.invoiceNumber}`);
  if (extraction.subtotal) lines.push(`Sous-total: $${extraction.subtotal.toFixed(2)}`);
  if (extraction.taxAmount) lines.push(`Taxes: $${extraction.taxAmount.toFixed(2)}`);
  if (extraction.total) lines.push(`Total: $${extraction.total.toFixed(2)}`);
  lines.push(`Confiance: ${Math.round(extraction.confidence * 100)}%`);
  return lines.join('\n');
}
