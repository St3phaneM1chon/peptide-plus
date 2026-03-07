/**
 * Quote PDF Generator - BioCycle Peptides
 *
 * Generates a professional PDF for CRM quotes using jsPDF.
 * Includes: company header, client info, line items table,
 * subtotal/tax/total, terms, valid until date.
 *
 * Usage:
 *   import { generateQuotePdf } from '@/lib/crm/quote-pdf';
 *   const buffer = generateQuotePdf(quote);
 *   // Return as Response with content-type application/pdf
 */

import { jsPDF } from 'jspdf';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface QuoteItem {
  description: string;
  quantity: number;
  unitPrice: number | string;
  discount: number | string;
  total: number | string;
  product?: { name: string; sku: string | null } | null;
}

interface QuotePdfData {
  number: string;
  status: string;
  currency: string;
  subtotal: number | string;
  taxRate: number | string;
  taxAmount: number | string;
  total: number | string;
  validUntil: string | null;
  notes: string | null;
  terms: string | null;
  createdAt: string;
  deal: {
    title: string;
    lead?: {
      contactName: string;
      companyName: string | null;
      email: string | null;
      phone: string | null;
    } | null;
    contact?: {
      name: string | null;
      email: string;
      phone: string | null;
    } | null;
  };
  items: QuoteItem[];
  createdBy: {
    name: string | null;
    email: string;
  };
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const COMPANY_NAME = 'BioCycle Peptides';
const COMPANY_TAGLINE = 'Research-Grade Peptides';
const COMPANY_ADDRESS = 'Canada';
const COMPANY_EMAIL = 'info@biocyclepeptides.com';
const COMPANY_WEBSITE = 'biocyclepeptides.com';

// Colors (RGB tuples)
const COLOR_PRIMARY: [number, number, number] = [13, 148, 136]; // teal-600
const COLOR_DARK: [number, number, number] = [15, 23, 42]; // slate-900
const COLOR_GRAY: [number, number, number] = [100, 116, 139]; // slate-500
const COLOR_LIGHT_GRAY: [number, number, number] = [148, 163, 184]; // slate-400
const COLOR_TABLE_HEADER_BG: [number, number, number] = [241, 245, 249]; // slate-100
const COLOR_TABLE_BORDER: [number, number, number] = [226, 232, 240]; // slate-200
const _COLOR_WHITE: [number, number, number] = [255, 255, 255]; void _COLOR_WHITE;

// Page dimensions (A4 in mm)
const PAGE_WIDTH = 210;
const MARGIN_LEFT = 20;
const MARGIN_RIGHT = 20;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function fmtCurrency(amount: number | string, currency: string = 'CAD'): string {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(Number(amount));
}

function fmtDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-CA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

// ---------------------------------------------------------------------------
// PDF Generator
// ---------------------------------------------------------------------------

/**
 * Generate a PDF document for a CRM quote.
 * Returns the PDF as a Buffer suitable for API responses.
 */
export function generateQuotePdf(quote: QuotePdfData): Buffer {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  let y = 20; // Current vertical position

  // =========================================================================
  // 1. COMPANY HEADER
  // =========================================================================

  // Company name
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(...COLOR_PRIMARY);
  doc.text(COMPANY_NAME, MARGIN_LEFT, y);

  // Company tagline
  y += 7;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...COLOR_GRAY);
  doc.text(COMPANY_TAGLINE, MARGIN_LEFT, y);

  // Company contact details
  y += 5;
  doc.setFontSize(8);
  doc.setTextColor(...COLOR_LIGHT_GRAY);
  doc.text(`${COMPANY_ADDRESS} | ${COMPANY_EMAIL} | ${COMPANY_WEBSITE}`, MARGIN_LEFT, y);

  // QUOTE title on the right
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(28);
  doc.setTextColor(...COLOR_DARK);
  doc.text('QUOTE', PAGE_WIDTH - MARGIN_RIGHT, 22, { align: 'right' });

  // Quote number and date on the right
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...COLOR_GRAY);
  doc.text(quote.number, PAGE_WIDTH - MARGIN_RIGHT, 30, { align: 'right' });
  doc.text(fmtDate(quote.createdAt), PAGE_WIDTH - MARGIN_RIGHT, 36, { align: 'right' });

  // Divider line
  y += 8;
  doc.setDrawColor(...COLOR_TABLE_BORDER);
  doc.setLineWidth(0.5);
  doc.line(MARGIN_LEFT, y, PAGE_WIDTH - MARGIN_RIGHT, y);

  // =========================================================================
  // 2. CLIENT INFO & QUOTE META
  // =========================================================================

  y += 10;

  // Left column: Bill To
  const clientName =
    quote.deal.lead?.contactName ||
    quote.deal.contact?.name ||
    'N/A';
  const clientCompany =
    quote.deal.lead?.companyName || null;
  const clientEmail =
    quote.deal.lead?.email ||
    quote.deal.contact?.email ||
    null;
  const clientPhone =
    quote.deal.lead?.phone ||
    quote.deal.contact?.phone ||
    null;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...COLOR_GRAY);
  doc.text('BILL TO', MARGIN_LEFT, y);

  y += 5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...COLOR_DARK);
  doc.text(clientName, MARGIN_LEFT, y);

  if (clientCompany) {
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...COLOR_GRAY);
    doc.text(clientCompany, MARGIN_LEFT, y);
  }
  if (clientEmail) {
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...COLOR_GRAY);
    doc.text(clientEmail, MARGIN_LEFT, y);
  }
  if (clientPhone) {
    y += 5;
    doc.text(clientPhone, MARGIN_LEFT, y);
  }

  // Right column: Quote details
  const rightX = PAGE_WIDTH - MARGIN_RIGHT;
  let metaY = y - (clientCompany ? 15 : 10);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...COLOR_GRAY);
  doc.text('QUOTE DETAILS', rightX - 50, metaY);

  metaY += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...COLOR_DARK);

  // Deal
  doc.text('Deal:', rightX - 50, metaY);
  doc.text(truncateText(quote.deal.title, 30), rightX, metaY, { align: 'right' });

  // Status
  metaY += 5;
  doc.text('Status:', rightX - 50, metaY);
  doc.text(quote.status, rightX, metaY, { align: 'right' });

  // Valid Until
  if (quote.validUntil) {
    metaY += 5;
    doc.text('Valid Until:', rightX - 50, metaY);
    doc.text(fmtDate(quote.validUntil), rightX, metaY, { align: 'right' });
  }

  // Prepared By
  metaY += 5;
  doc.text('Prepared By:', rightX - 50, metaY);
  doc.text(quote.createdBy.name || quote.createdBy.email, rightX, metaY, { align: 'right' });

  // =========================================================================
  // 3. LINE ITEMS TABLE
  // =========================================================================

  y = Math.max(y, metaY) + 15;

  // Table column positions
  const colX = {
    description: MARGIN_LEFT,
    qty: MARGIN_LEFT + 90,
    unitPrice: MARGIN_LEFT + 108,
    discount: MARGIN_LEFT + 135,
    total: PAGE_WIDTH - MARGIN_RIGHT,
  };

  const rowHeight = 8;

  // Table header background
  doc.setFillColor(...COLOR_TABLE_HEADER_BG);
  doc.rect(MARGIN_LEFT, y - 5, CONTENT_WIDTH, rowHeight + 2, 'F');

  // Table header text
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...COLOR_GRAY);
  doc.text('DESCRIPTION', colX.description + 2, y);
  doc.text('QTY', colX.qty, y, { align: 'center' });
  doc.text('UNIT PRICE', colX.unitPrice, y, { align: 'center' });
  doc.text('DISC %', colX.discount, y, { align: 'center' });
  doc.text('TOTAL', colX.total - 2, y, { align: 'right' });

  // Header bottom border
  y += 3;
  doc.setDrawColor(...COLOR_TABLE_BORDER);
  doc.setLineWidth(0.3);
  doc.line(MARGIN_LEFT, y, PAGE_WIDTH - MARGIN_RIGHT, y);

  y += 5;

  // Table rows
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);

  for (const item of quote.items) {
    // Check if we need a new page
    if (y > 260) {
      doc.addPage();
      y = 20;
    }

    doc.setTextColor(...COLOR_DARK);
    const descText = item.product
      ? `${item.description} (${item.product.sku || item.product.name})`
      : item.description;
    doc.text(truncateText(descText, 55), colX.description + 2, y);

    doc.setTextColor(...COLOR_GRAY);
    doc.text(String(item.quantity), colX.qty, y, { align: 'center' });
    doc.text(fmtCurrency(item.unitPrice, quote.currency), colX.unitPrice, y, { align: 'center' });
    doc.text(`${Number(item.discount)}%`, colX.discount, y, { align: 'center' });

    doc.setTextColor(...COLOR_DARK);
    doc.setFont('helvetica', 'bold');
    doc.text(fmtCurrency(item.total, quote.currency), colX.total - 2, y, { align: 'right' });
    doc.setFont('helvetica', 'normal');

    // Row bottom border
    y += 3;
    doc.setDrawColor(...COLOR_TABLE_BORDER);
    doc.setLineWidth(0.15);
    doc.line(MARGIN_LEFT, y, PAGE_WIDTH - MARGIN_RIGHT, y);

    y += 5;
  }

  // =========================================================================
  // 4. TOTALS SECTION
  // =========================================================================

  y += 5;

  const totalsX = PAGE_WIDTH - MARGIN_RIGHT - 60;
  const totalsValX = PAGE_WIDTH - MARGIN_RIGHT - 2;

  // Subtotal
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...COLOR_GRAY);
  doc.text('Subtotal', totalsX, y);
  doc.setTextColor(...COLOR_DARK);
  doc.text(fmtCurrency(quote.subtotal, quote.currency), totalsValX, y, { align: 'right' });

  // Tax
  y += 6;
  doc.setTextColor(...COLOR_GRAY);
  const taxLabel = `Tax (${(Number(quote.taxRate) * 100).toFixed(2)}%)`;
  doc.text(taxLabel, totalsX, y);
  doc.setTextColor(...COLOR_DARK);
  doc.text(fmtCurrency(quote.taxAmount, quote.currency), totalsValX, y, { align: 'right' });

  // Total divider
  y += 4;
  doc.setDrawColor(...COLOR_PRIMARY);
  doc.setLineWidth(0.5);
  doc.line(totalsX - 5, y, PAGE_WIDTH - MARGIN_RIGHT, y);

  // Total
  y += 7;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...COLOR_PRIMARY);
  doc.text('TOTAL', totalsX, y);
  doc.setTextColor(...COLOR_DARK);
  doc.text(fmtCurrency(quote.total, quote.currency), totalsValX, y, { align: 'right' });

  // =========================================================================
  // 5. NOTES
  // =========================================================================

  if (quote.notes) {
    y += 15;

    if (y > 250) {
      doc.addPage();
      y = 20;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...COLOR_GRAY);
    doc.text('NOTES', MARGIN_LEFT, y);

    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...COLOR_DARK);

    const noteLines = doc.splitTextToSize(quote.notes, CONTENT_WIDTH - 10);
    doc.text(noteLines, MARGIN_LEFT, y);
    y += noteLines.length * 4;
  }

  // =========================================================================
  // 6. TERMS & CONDITIONS
  // =========================================================================

  if (quote.terms) {
    y += 10;

    if (y > 250) {
      doc.addPage();
      y = 20;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...COLOR_GRAY);
    doc.text('TERMS & CONDITIONS', MARGIN_LEFT, y);

    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...COLOR_DARK);

    const termLines = doc.splitTextToSize(quote.terms, CONTENT_WIDTH - 10);
    doc.text(termLines, MARGIN_LEFT, y);
    y += termLines.length * 3.5;
  }

  // =========================================================================
  // 7. VALID UNTIL NOTICE
  // =========================================================================

  if (quote.validUntil) {
    y += 10;

    if (y > 270) {
      doc.addPage();
      y = 20;
    }

    // Background box
    doc.setFillColor(254, 243, 199); // amber-100
    doc.roundedRect(MARGIN_LEFT, y - 4, CONTENT_WIDTH, 12, 2, 2, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(146, 64, 14); // amber-800
    doc.text(
      `This quote is valid until ${fmtDate(quote.validUntil)}`,
      PAGE_WIDTH / 2,
      y + 3,
      { align: 'center' }
    );
  }

  // =========================================================================
  // 8. FOOTER
  // =========================================================================

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...COLOR_LIGHT_GRAY);
    doc.text(
      `${COMPANY_NAME} | ${quote.number} | Page ${i} of ${pageCount}`,
      PAGE_WIDTH / 2,
      290,
      { align: 'center' }
    );
  }

  // =========================================================================
  // Return as Buffer
  // =========================================================================

  const arrayBuffer = doc.output('arraybuffer');
  return Buffer.from(arrayBuffer);
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function truncateText(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.substring(0, maxLen - 3) + '...';
}
