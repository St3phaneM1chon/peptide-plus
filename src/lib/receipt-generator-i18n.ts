/**
 * RECEIPT GENERATOR - INTERNATIONALIZED
 * Génération de reçus PDF traduits selon la langue de l'utilisateur
 */

import jsPDF from 'jspdf';
import { type Locale } from '@/i18n/config';
import { 
  formatCurrencyServer, 
  formatDateTimeServer 
} from '@/i18n/server';

interface ReceiptItem {
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

interface ReceiptData {
  receiptNumber: string;
  date: Date;
  customerName: string;
  customerEmail: string;
  companyName?: string;
  items: ReceiptItem[];
  subtotal: number;
  taxes: { name: string; rate: number; amount: number }[];
  total: number;
  paymentMethod: string;
  locale: Locale;
}

// Labels traduits pour le reçu (Partial - not all locales have full translations)
const receiptLabels: Partial<Record<Locale, {
  title: string;
  receiptNo: string;
  date: string;
  billTo: string;
  description: string;
  quantity: string;
  unitPrice: string;
  total: string;
  subtotal: string;
  grandTotal: string;
  paymentMethod: string;
  paymentMethods: Record<string, string>;
  thankYou: string;
  questions: string;
  page: string;
}>> = {
  fr: {
    title: 'REÇU',
    receiptNo: 'Reçu N°',
    date: 'Date',
    billTo: 'Facturé à',
    description: 'Description',
    quantity: 'Qté',
    unitPrice: 'Prix unit.',
    total: 'Total',
    subtotal: 'Sous-total',
    grandTotal: 'TOTAL',
    paymentMethod: 'Mode de paiement',
    paymentMethods: {
      STRIPE_CARD: 'Carte de crédit',
      APPLE_PAY: 'Apple Pay',
      GOOGLE_PAY: 'Google Pay',
      PAYPAL: 'PayPal',
      VISA_CLICK_TO_PAY: 'Visa Click to Pay',
      MASTERCARD_CLICK_TO_PAY: 'Mastercard Click to Pay',
    },
    thankYou: 'Merci pour votre achat!',
    questions: 'Des questions? Contactez-nous:',
    page: 'Page',
  },
  en: {
    title: 'RECEIPT',
    receiptNo: 'Receipt No.',
    date: 'Date',
    billTo: 'Bill To',
    description: 'Description',
    quantity: 'Qty',
    unitPrice: 'Unit Price',
    total: 'Total',
    subtotal: 'Subtotal',
    grandTotal: 'TOTAL',
    paymentMethod: 'Payment Method',
    paymentMethods: {
      STRIPE_CARD: 'Credit Card',
      APPLE_PAY: 'Apple Pay',
      GOOGLE_PAY: 'Google Pay',
      PAYPAL: 'PayPal',
      VISA_CLICK_TO_PAY: 'Visa Click to Pay',
      MASTERCARD_CLICK_TO_PAY: 'Mastercard Click to Pay',
    },
    thankYou: 'Thank you for your purchase!',
    questions: 'Questions? Contact us:',
    page: 'Page',
  },
  es: {
    title: 'RECIBO',
    receiptNo: 'Recibo N°',
    date: 'Fecha',
    billTo: 'Facturado a',
    description: 'Descripción',
    quantity: 'Cant.',
    unitPrice: 'Precio unit.',
    total: 'Total',
    subtotal: 'Subtotal',
    grandTotal: 'TOTAL',
    paymentMethod: 'Método de pago',
    paymentMethods: {
      STRIPE_CARD: 'Tarjeta de crédito',
      APPLE_PAY: 'Apple Pay',
      GOOGLE_PAY: 'Google Pay',
      PAYPAL: 'PayPal',
      VISA_CLICK_TO_PAY: 'Visa Click to Pay',
      MASTERCARD_CLICK_TO_PAY: 'Mastercard Click to Pay',
    },
    thankYou: '¡Gracias por su compra!',
    questions: '¿Preguntas? Contáctenos:',
    page: 'Página',
  },
  de: {
    title: 'QUITTUNG',
    receiptNo: 'Quittung Nr.',
    date: 'Datum',
    billTo: 'Rechnung an',
    description: 'Beschreibung',
    quantity: 'Menge',
    unitPrice: 'Einzelpreis',
    total: 'Gesamt',
    subtotal: 'Zwischensumme',
    grandTotal: 'GESAMT',
    paymentMethod: 'Zahlungsmethode',
    paymentMethods: {
      STRIPE_CARD: 'Kreditkarte',
      APPLE_PAY: 'Apple Pay',
      GOOGLE_PAY: 'Google Pay',
      PAYPAL: 'PayPal',
      VISA_CLICK_TO_PAY: 'Visa Click to Pay',
      MASTERCARD_CLICK_TO_PAY: 'Mastercard Click to Pay',
    },
    thankYou: 'Vielen Dank für Ihren Einkauf!',
    questions: 'Fragen? Kontaktieren Sie uns:',
    page: 'Seite',
  },
  it: {
    title: 'RICEVUTA',
    receiptNo: 'Ricevuta N°',
    date: 'Data',
    billTo: 'Fatturato a',
    description: 'Descrizione',
    quantity: 'Qtà',
    unitPrice: 'Prezzo unit.',
    total: 'Totale',
    subtotal: 'Subtotale',
    grandTotal: 'TOTALE',
    paymentMethod: 'Metodo di pagamento',
    paymentMethods: {
      STRIPE_CARD: 'Carta di credito',
      APPLE_PAY: 'Apple Pay',
      GOOGLE_PAY: 'Google Pay',
      PAYPAL: 'PayPal',
      VISA_CLICK_TO_PAY: 'Visa Click to Pay',
      MASTERCARD_CLICK_TO_PAY: 'Mastercard Click to Pay',
    },
    thankYou: 'Grazie per il tuo acquisto!',
    questions: 'Domande? Contattaci:',
    page: 'Pagina',
  },
  pt: {
    title: 'RECIBO',
    receiptNo: 'Recibo N°',
    date: 'Data',
    billTo: 'Faturado para',
    description: 'Descrição',
    quantity: 'Qtd',
    unitPrice: 'Preço unit.',
    total: 'Total',
    subtotal: 'Subtotal',
    grandTotal: 'TOTAL',
    paymentMethod: 'Método de pagamento',
    paymentMethods: {
      STRIPE_CARD: 'Cartão de crédito',
      APPLE_PAY: 'Apple Pay',
      GOOGLE_PAY: 'Google Pay',
      PAYPAL: 'PayPal',
      VISA_CLICK_TO_PAY: 'Visa Click to Pay',
      MASTERCARD_CLICK_TO_PAY: 'Mastercard Click to Pay',
    },
    thankYou: 'Obrigado pela sua compra!',
    questions: 'Dúvidas? Contacte-nos:',
    page: 'Página',
  },
  zh: {
    title: '收据',
    receiptNo: '收据编号',
    date: '日期',
    billTo: '账单地址',
    description: '描述',
    quantity: '数量',
    unitPrice: '单价',
    total: '总计',
    subtotal: '小计',
    grandTotal: '总计',
    paymentMethod: '支付方式',
    paymentMethods: {
      STRIPE_CARD: '信用卡',
      APPLE_PAY: 'Apple Pay',
      GOOGLE_PAY: 'Google Pay',
      PAYPAL: 'PayPal',
      VISA_CLICK_TO_PAY: 'Visa Click to Pay',
      MASTERCARD_CLICK_TO_PAY: 'Mastercard Click to Pay',
    },
    thankYou: '感谢您的购买！',
    questions: '有问题？联系我们：',
    page: '页',
  },
  ar: {
    title: 'إيصال',
    receiptNo: 'رقم الإيصال',
    date: 'التاريخ',
    billTo: 'فاتورة إلى',
    description: 'الوصف',
    quantity: 'الكمية',
    unitPrice: 'سعر الوحدة',
    total: 'المجموع',
    subtotal: 'المجموع الفرعي',
    grandTotal: 'المجموع الكلي',
    paymentMethod: 'طريقة الدفع',
    paymentMethods: {
      STRIPE_CARD: 'بطاقة ائتمان',
      APPLE_PAY: 'Apple Pay',
      GOOGLE_PAY: 'Google Pay',
      PAYPAL: 'PayPal',
      VISA_CLICK_TO_PAY: 'Visa Click to Pay',
      MASTERCARD_CLICK_TO_PAY: 'Mastercard Click to Pay',
    },
    thankYou: 'شكراً لشرائك!',
    questions: 'أسئلة؟ اتصل بنا:',
    page: 'صفحة',
  },
};

// Configuration business
const businessConfig = {
  name: process.env.BUSINESS_NAME || 'Formations Pro',
  address: process.env.BUSINESS_ADDRESS || '123 Rue Exemple, Montréal, QC H2X 1Y6',
  phone: process.env.BUSINESS_PHONE || '(514) 555-0123',
  email: process.env.NEXT_PUBLIC_CONTACT_EMAIL || 'contact@biocyclepeptides.com',
  tps: process.env.BUSINESS_TPS || '123456789 RT0001',
  tvq: process.env.BUSINESS_TVQ || '1234567890 TQ0001',
};

/**
 * Génère un reçu PDF traduit
 */
export function generateReceiptPDFi18n(data: ReceiptData): Buffer {
  const locale = data.locale || 'fr';
  const labels = receiptLabels[locale] || receiptLabels.fr!;
  const isRTL = locale === 'ar';

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  let y = margin;

  // Helpers
  const formatPrice = (amount: number) => formatCurrencyServer(amount, locale);
  const formatDate = (date: Date) => formatDateTimeServer(date, locale);

  // ===== EN-TÊTE =====
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text(businessConfig.name, isRTL ? pageWidth - margin : margin, y);
  y += 10;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100);
  doc.text(businessConfig.address, isRTL ? pageWidth - margin : margin, y);
  y += 5;
  doc.text(`${businessConfig.phone} | ${businessConfig.email}`, isRTL ? pageWidth - margin : margin, y);
  y += 5;
  doc.text(`TPS: ${businessConfig.tps} | TVQ: ${businessConfig.tvq}`, isRTL ? pageWidth - margin : margin, y);
  y += 15;

  // ===== TITRE =====
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0);
  doc.text(labels.title, pageWidth / 2, y, { align: 'center' });
  y += 15;

  // ===== INFOS REÇU =====
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');

  // Numéro et date
  doc.text(`${labels.receiptNo}: ${data.receiptNumber}`, margin, y);
  doc.text(`${labels.date}: ${formatDate(data.date)}`, pageWidth - margin, y, { align: 'right' });
  y += 10;

  // Client
  doc.setFont('helvetica', 'bold');
  doc.text(labels.billTo, margin, y);
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.text(data.customerName, margin, y);
  y += 5;
  doc.text(data.customerEmail, margin, y);
  if (data.companyName) {
    y += 5;
    doc.text(data.companyName, margin, y);
  }
  y += 15;

  // ===== TABLEAU DES ARTICLES =====
  const colWidths = {
    description: 80,
    quantity: 25,
    unitPrice: 35,
    total: 30,
  };

  // En-tête tableau
  doc.setFillColor(240, 240, 240);
  doc.rect(margin, y, pageWidth - 2 * margin, 8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  y += 5;

  let x = margin + 2;
  doc.text(labels.description, x, y);
  x += colWidths.description;
  doc.text(labels.quantity, x, y, { align: 'center' });
  x += colWidths.quantity;
  doc.text(labels.unitPrice, x, y, { align: 'right' });
  x += colWidths.unitPrice;
  doc.text(labels.total, x + colWidths.total - 2, y, { align: 'right' });
  y += 8;

  // Articles
  doc.setFont('helvetica', 'normal');
  for (const item of data.items) {
    x = margin + 2;
    doc.text(item.name.substring(0, 45), x, y);
    x += colWidths.description;
    doc.text(String(item.quantity), x, y, { align: 'center' });
    x += colWidths.quantity;
    doc.text(formatPrice(item.unitPrice), x, y, { align: 'right' });
    x += colWidths.unitPrice;
    doc.text(formatPrice(item.total), x + colWidths.total - 2, y, { align: 'right' });
    y += 7;
  }

  // Ligne séparatrice
  y += 5;
  doc.setDrawColor(200);
  doc.line(margin, y, pageWidth - margin, y);
  y += 10;

  // ===== TOTAUX =====
  const totalsX = pageWidth - margin - 60;

  // Sous-total
  doc.text(labels.subtotal, totalsX, y);
  doc.text(formatPrice(data.subtotal), pageWidth - margin, y, { align: 'right' });
  y += 6;

  // Taxes
  for (const tax of data.taxes) {
    doc.text(`${tax.name} (${tax.rate}%)`, totalsX, y);
    doc.text(formatPrice(tax.amount), pageWidth - margin, y, { align: 'right' });
    y += 6;
  }

  // Total
  y += 2;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(labels.grandTotal, totalsX, y);
  doc.text(formatPrice(data.total), pageWidth - margin, y, { align: 'right' });
  y += 15;

  // ===== MODE DE PAIEMENT =====
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const paymentLabel = labels.paymentMethods[data.paymentMethod] || data.paymentMethod;
  doc.text(`${labels.paymentMethod}: ${paymentLabel}`, margin, y);
  y += 20;

  // ===== PIED DE PAGE =====
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(labels.thankYou, pageWidth / 2, y, { align: 'center' });
  y += 8;
  doc.setFontSize(9);
  doc.text(`${labels.questions} ${businessConfig.email}`, pageWidth / 2, y, { align: 'center' });

  // Numéro de page
  doc.setFontSize(8);
  doc.text(
    `${labels.page} 1/1`,
    pageWidth / 2,
    pageHeight - 10,
    { align: 'center' }
  );

  // Retourner le buffer
  return Buffer.from(doc.output('arraybuffer'));
}

export { receiptLabels, businessConfig };
