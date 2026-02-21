export const dynamic = 'force-dynamic';
/**
 * API - Generate and download invoice PDF
 * GET /api/account/invoices/[id]/pdf
 * Returns a professional PDF invoice using jsPDF
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/db';
import jsPDF from 'jspdf';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Company information (tax numbers loaded from DB at runtime)
const COMPANY_STATIC = {
  name: 'BioCycle Peptides Inc.',
  address: '1234 Boulevard des Sciences',
  city: 'Montreal, QC H3C 1K3',
  country: 'Canada',
  phone: '(514) 555-0199',
  email: 'support@biocyclepeptides.com',
  website: 'www.biocyclepeptides.com',
};

async function getCompanyInfo() {
  const settings = await prisma.accountingSettings.findUnique({ where: { id: 'default' } });
  return {
    ...COMPANY_STATIC,
    tpsNumber: settings?.tpsNumber || process.env.BUSINESS_TPS || '',
    tvqNumber: settings?.tvqNumber || process.env.BUSINESS_TVQ || '',
  };
}

// Payment method display names
const PAYMENT_METHOD_LABELS: Record<string, string> = {
  STRIPE_CARD: 'Credit Card',
  APPLE_PAY: 'Apple Pay',
  GOOGLE_PAY: 'Google Pay',
  PAYPAL: 'PayPal',
  VISA_CLICK_TO_PAY: 'Visa Click to Pay',
  MASTERCARD_CLICK_TO_PAY: 'Mastercard Click to Pay',
  AURELIA_PAY: 'Aurelia Pay',
};

function formatMoney(amount: number, symbol: string = '$'): string {
  return `${symbol}${amount.toFixed(2)}`;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-CA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Fetch order with items and currency
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        items: true,
        currency: {
          select: {
            code: true,
            symbol: true,
          },
        },
      },
    });

    if (!order) {
      return NextResponse.json(
        { error: 'Invoice not found' },
        { status: 404 }
      );
    }

    // Verify ownership
    if (order.userId !== session.user.id) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    // Verify paid status
    if (order.paymentStatus !== 'PAID') {
      return NextResponse.json(
        { error: 'Invoice not available for unpaid orders' },
        { status: 400 }
      );
    }

    // Get user name for the invoice
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { name: true, email: true },
    });

    const currencySymbol = order.currency?.symbol || '$';
    const currencyCode = order.currency?.code || 'CAD';
    const invoiceNumber = `INV-${order.orderNumber}`;

    // Load company info with tax numbers from DB
    const COMPANY = await getCompanyInfo();
    if (!COMPANY.tpsNumber || !COMPANY.tvqNumber) {
      return NextResponse.json(
        { error: 'Tax registration numbers not configured. Please configure in Accounting Settings.' },
        { status: 500 }
      );
    }

    // Generate PDF
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    const rightCol = pageWidth - margin;
    let y = margin;

    // =========================================================
    // HEADER - Company Info (left) + Invoice Info (right)
    // =========================================================

    // Company name
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(200, 80, 0); // Orange
    doc.text(COMPANY.name, margin, y);
    y += 7;

    // Company address
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text(COMPANY.address, margin, y);
    y += 4;
    doc.text(COMPANY.city, margin, y);
    y += 4;
    doc.text(COMPANY.country, margin, y);
    y += 4;
    doc.text(`${COMPANY.phone} | ${COMPANY.email}`, margin, y);
    y += 4;
    doc.text(COMPANY.website, margin, y);

    // Invoice label (right side)
    const invoiceHeaderY = margin;
    doc.setFontSize(28);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(50, 50, 50);
    doc.text('INVOICE', rightCol, invoiceHeaderY, { align: 'right' });

    // Invoice details (right side)
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 80, 80);
    doc.text(`Invoice #: ${invoiceNumber}`, rightCol, invoiceHeaderY + 10, { align: 'right' });
    doc.text(`Date: ${formatDate(order.createdAt)}`, rightCol, invoiceHeaderY + 16, { align: 'right' });
    doc.text(`Currency: ${currencyCode}`, rightCol, invoiceHeaderY + 22, { align: 'right' });

    // Tax registration numbers
    y += 6;
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(`GST/TPS: ${COMPANY.tpsNumber}`, margin, y);
    y += 4;
    doc.text(`QST/TVQ: ${COMPANY.tvqNumber}`, margin, y);

    // Separator line
    y += 8;
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.5);
    doc.line(margin, y, rightCol, y);
    y += 10;

    // =========================================================
    // BILL TO / SHIP TO
    // =========================================================

    const colMid = pageWidth / 2;

    // Bill To header
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(200, 80, 0);
    doc.text('BILL TO', margin, y);

    // Ship To header
    doc.text('SHIP TO', colMid + 5, y);
    y += 6;

    // Bill To info
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(50, 50, 50);
    doc.setFontSize(10);
    const customerName = user?.name || order.shippingName || 'Customer';
    const customerEmail = user?.email || '';
    doc.text(customerName, margin, y);
    doc.text(order.shippingName, colMid + 5, y);
    y += 5;
    if (customerEmail) {
      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      doc.text(customerEmail, margin, y);
    }
    doc.setFontSize(9);
    doc.setTextColor(80, 80, 80);
    doc.text(order.shippingAddress1, colMid + 5, y);
    y += 5;
    if (order.shippingAddress2) {
      doc.text(order.shippingAddress2, colMid + 5, y);
      y += 5;
    }
    doc.text(
      `${order.shippingCity}, ${order.shippingState} ${order.shippingPostal}`,
      colMid + 5,
      y
    );
    y += 5;
    doc.text(order.shippingCountry, colMid + 5, y);
    if (order.shippingPhone) {
      y += 5;
      doc.text(`Tel: ${order.shippingPhone}`, colMid + 5, y);
    }

    y += 12;

    // =========================================================
    // ITEMS TABLE
    // =========================================================

    // Table header background
    const tableX = margin;
    const tableW = rightCol - margin;
    const colProduct = tableX + 2;
    const colQty = tableX + tableW * 0.55;
    const colUnit = tableX + tableW * 0.68;
    const colLineTotal = rightCol - 2;

    doc.setFillColor(245, 245, 245);
    doc.rect(tableX, y - 4, tableW, 10, 'F');

    // Table header text
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(60, 60, 60);
    doc.text('Product', colProduct, y + 1);
    doc.text('Qty', colQty, y + 1, { align: 'center' });
    doc.text('Unit Price', colUnit, y + 1, { align: 'right' });
    doc.text('Total', colLineTotal, y + 1, { align: 'right' });

    y += 10;

    // Table rows
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(50, 50, 50);

    for (const item of order.items) {
      // Check if we need a new page
      if (y > pageHeight - 80) {
        doc.addPage();
        y = margin;
      }

      const productLabel = item.formatName
        ? `${item.productName} - ${item.formatName}`
        : item.productName;

      // Truncate long product names
      const maxLen = 55;
      const displayName = productLabel.length > maxLen
        ? productLabel.substring(0, maxLen) + '...'
        : productLabel;

      doc.setFontSize(9);
      doc.text(displayName, colProduct, y);
      doc.text(String(item.quantity), colQty, y, { align: 'center' });
      doc.text(formatMoney(Number(item.unitPrice), currencySymbol), colUnit, y, { align: 'right' });
      doc.text(formatMoney(Number(item.total), currencySymbol), colLineTotal, y, { align: 'right' });

      // SKU line (smaller, gray)
      if (item.sku) {
        y += 4;
        doc.setFontSize(7);
        doc.setTextColor(150, 150, 150);
        doc.text(`SKU: ${item.sku}`, colProduct, y);
        doc.setTextColor(50, 50, 50);
      }

      y += 8;
    }

    // Separator before totals
    y += 2;
    doc.setDrawColor(220, 220, 220);
    doc.line(tableX + tableW * 0.5, y, rightCol, y);
    y += 8;

    // =========================================================
    // TOTALS SECTION
    // =========================================================

    const totalsLabelX = tableX + tableW * 0.55;
    const totalsValueX = colLineTotal;

    // Subtotal
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 80, 80);
    doc.text('Subtotal:', totalsLabelX, y);
    doc.setTextColor(50, 50, 50);
    doc.text(formatMoney(Number(order.subtotal), currencySymbol), totalsValueX, y, { align: 'right' });
    y += 6;

    // Discount
    const discountAmount = Number(order.discount);
    if (discountAmount > 0) {
      doc.setTextColor(0, 150, 0);
      doc.text(
        order.promoCode ? `Discount (${order.promoCode}):` : 'Discount:',
        totalsLabelX,
        y
      );
      doc.text(`-${formatMoney(discountAmount, currencySymbol)}`, totalsValueX, y, { align: 'right' });
      y += 6;
    }

    // Shipping
    doc.setTextColor(80, 80, 80);
    doc.text('Shipping:', totalsLabelX, y);
    const shippingCost = Number(order.shippingCost);
    doc.setTextColor(50, 50, 50);
    doc.text(
      shippingCost > 0 ? formatMoney(shippingCost, currencySymbol) : 'FREE',
      totalsValueX,
      y,
      { align: 'right' }
    );
    y += 6;

    // Taxes
    const taxTps = Number(order.taxTps);
    const taxTvq = Number(order.taxTvq);
    const taxTvh = Number(order.taxTvh);
    const taxPst = Number(order.taxPst);

    if (taxTps > 0) {
      doc.setTextColor(80, 80, 80);
      doc.text('GST/TPS (5%):', totalsLabelX, y);
      doc.setTextColor(50, 50, 50);
      doc.text(formatMoney(taxTps, currencySymbol), totalsValueX, y, { align: 'right' });
      y += 6;
    }

    if (taxTvq > 0) {
      doc.setTextColor(80, 80, 80);
      doc.text('QST/TVQ (9.975%):', totalsLabelX, y);
      doc.setTextColor(50, 50, 50);
      doc.text(formatMoney(taxTvq, currencySymbol), totalsValueX, y, { align: 'right' });
      y += 6;
    }

    if (taxTvh > 0) {
      doc.setTextColor(80, 80, 80);
      doc.text('HST/TVH:', totalsLabelX, y);
      doc.setTextColor(50, 50, 50);
      doc.text(formatMoney(taxTvh, currencySymbol), totalsValueX, y, { align: 'right' });
      y += 6;
    }

    if (taxPst > 0) {
      doc.setTextColor(80, 80, 80);
      doc.text('PST:', totalsLabelX, y);
      doc.setTextColor(50, 50, 50);
      doc.text(formatMoney(taxPst, currencySymbol), totalsValueX, y, { align: 'right' });
      y += 6;
    }

    // Grand total
    y += 2;
    doc.setFillColor(200, 80, 0); // Orange
    doc.rect(totalsLabelX - 5, y - 5, rightCol - totalsLabelX + 7, 12, 'F');
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text('TOTAL:', totalsLabelX, y + 2);
    doc.text(
      `${formatMoney(Number(order.total), currencySymbol)} ${currencyCode}`,
      totalsValueX,
      y + 2,
      { align: 'right' }
    );

    y += 18;

    // =========================================================
    // PAYMENT INFO
    // =========================================================

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(200, 80, 0);
    doc.text('PAYMENT INFORMATION', margin, y);
    y += 6;

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 80, 80);
    const paymentLabel = order.paymentMethod
      ? (PAYMENT_METHOD_LABELS[order.paymentMethod] || order.paymentMethod)
      : 'N/A';
    doc.text(`Payment Method: ${paymentLabel}`, margin, y);
    y += 5;
    doc.text(`Payment Status: Paid`, margin, y);
    y += 5;
    doc.text(`Payment Date: ${formatDate(order.createdAt)}`, margin, y);

    // =========================================================
    // FOOTER
    // =========================================================

    const footerY = pageHeight - 25;
    doc.setDrawColor(220, 220, 220);
    doc.line(margin, footerY - 5, rightCol, footerY - 5);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(150, 150, 150);
    doc.text(
      'Thank you for your purchase!',
      pageWidth / 2,
      footerY,
      { align: 'center' }
    );
    doc.setFontSize(8);
    doc.text(
      `${COMPANY.email} | ${COMPANY.website} | ${COMPANY.phone}`,
      pageWidth / 2,
      footerY + 5,
      { align: 'center' }
    );
    doc.text(
      `${COMPANY.name} - ${COMPANY.city}, ${COMPANY.country}`,
      pageWidth / 2,
      footerY + 10,
      { align: 'center' }
    );

    // Page number
    doc.setFontSize(8);
    doc.text(
      'Page 1/1',
      pageWidth / 2,
      footerY + 16,
      { align: 'center' }
    );

    // Convert to buffer
    const pdfBuffer = Buffer.from(doc.output('arraybuffer'));

    // Return PDF response
    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Invoice_${invoiceNumber}.pdf"`,
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch (error) {
    console.error('Error generating invoice PDF:', error);
    return NextResponse.json(
      { error: 'Failed to generate PDF' },
      { status: 500 }
    );
  }
}
