/**
 * GÉNÉRATEUR DE REÇUS PDF
 * Utilise jsPDF pour générer des reçus imprimables
 */

import { jsPDF } from 'jspdf';

interface ReceiptData {
  receiptNumber: string;
  date: Date;
  
  // Client
  customerName: string;
  customerEmail: string;
  companyName?: string;
  
  // Produit
  productName: string;
  productDescription?: string;
  
  // Montants
  subtotal: number;
  tps: number;
  tvq: number;
  total: number;
  currency: string;
  
  // Paiement
  paymentMethod: string;
  transactionId: string;
  
  // Entreprise
  businessName: string;
  businessAddress: string;
  businessPhone: string;
  businessEmail: string;
  businessTaxNumbers: {
    tps: string;
    tvq: string;
  };
}

export async function generateReceiptPDF(data: ReceiptData): Promise<Buffer> {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  
  // Couleurs - typées comme tuples pour éviter les erreurs avec spread
  const primaryColor: [number, number, number] = [37, 99, 235]; // blue-600
  const textColor: [number, number, number] = [31, 41, 55]; // gray-800
  const lightGray: [number, number, number] = [156, 163, 175]; // gray-400

  let y = 20;

  // ===== EN-TÊTE =====
  
  // Logo / Nom de l'entreprise
  doc.setFontSize(24);
  doc.setTextColor(...primaryColor);
  doc.setFont('helvetica', 'bold');
  doc.text(data.businessName, 20, y);
  
  // Badge REÇU
  doc.setFillColor(...primaryColor);
  doc.roundedRect(pageWidth - 60, y - 12, 40, 16, 3, 3, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(12);
  doc.text('REÇU', pageWidth - 50, y - 2);
  
  y += 15;

  // Informations entreprise
  doc.setFontSize(10);
  doc.setTextColor(...lightGray);
  doc.setFont('helvetica', 'normal');
  doc.text(data.businessAddress, 20, y);
  y += 5;
  doc.text(`Tél: ${data.businessPhone}`, 20, y);
  y += 5;
  doc.text(`Email: ${data.businessEmail}`, 20, y);
  y += 5;
  doc.text(`TPS: ${data.businessTaxNumbers.tps}`, 20, y);
  y += 5;
  doc.text(`TVQ: ${data.businessTaxNumbers.tvq}`, 20, y);

  y += 15;

  // ===== INFORMATIONS DU REÇU =====
  
  // Ligne de séparation
  doc.setDrawColor(...lightGray);
  doc.setLineWidth(0.5);
  doc.line(20, y, pageWidth - 20, y);
  
  y += 10;

  // Numéro et date
  doc.setFontSize(10);
  doc.setTextColor(...textColor);
  doc.setFont('helvetica', 'bold');
  doc.text('Numéro de reçu:', 20, y);
  doc.setFont('helvetica', 'normal');
  doc.text(data.receiptNumber, 70, y);
  
  doc.setFont('helvetica', 'bold');
  doc.text('Date:', pageWidth - 80, y);
  doc.setFont('helvetica', 'normal');
  doc.text(formatDate(data.date), pageWidth - 60, y);
  
  y += 15;

  // ===== CLIENT =====
  
  doc.setFillColor(249, 250, 251); // gray-50
  doc.roundedRect(20, y - 5, pageWidth - 40, 35, 3, 3, 'F');
  
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...primaryColor);
  doc.text('FACTURÉ À', 25, y + 5);
  
  y += 12;
  
  doc.setFontSize(10);
  doc.setTextColor(...textColor);
  doc.setFont('helvetica', 'normal');
  
  if (data.companyName) {
    doc.setFont('helvetica', 'bold');
    doc.text(data.companyName, 25, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
  }
  doc.text(data.customerName, 25, y);
  y += 5;
  doc.text(data.customerEmail, 25, y);
  
  y += 25;

  // ===== DÉTAILS DU PRODUIT =====
  
  // En-tête tableau
  doc.setFillColor(...primaryColor);
  doc.rect(20, y, pageWidth - 40, 10, 'F');
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('Description', 25, y + 7);
  doc.text('Montant', pageWidth - 50, y + 7);
  
  y += 15;

  // Ligne produit
  doc.setTextColor(...textColor);
  doc.setFont('helvetica', 'bold');
  doc.text(data.productName, 25, y);
  doc.setFont('helvetica', 'normal');
  doc.text(formatCurrency(data.subtotal, data.currency), pageWidth - 50, y);
  
  if (data.productDescription) {
    y += 5;
    doc.setFontSize(9);
    doc.setTextColor(...lightGray);
    doc.text(data.productDescription.substring(0, 60), 25, y);
  }
  
  y += 20;

  // Ligne de séparation
  doc.setDrawColor(...lightGray);
  doc.line(pageWidth - 100, y, pageWidth - 20, y);
  
  y += 8;

  // ===== TOTAUX =====
  
  doc.setFontSize(10);
  doc.setTextColor(...textColor);
  
  // Sous-total
  doc.setFont('helvetica', 'normal');
  doc.text('Sous-total:', pageWidth - 100, y);
  doc.text(formatCurrency(data.subtotal, data.currency), pageWidth - 50, y);
  
  y += 6;
  
  // TPS
  doc.text('TPS (5%):', pageWidth - 100, y);
  doc.text(formatCurrency(data.tps, data.currency), pageWidth - 50, y);
  
  y += 6;
  
  // TVQ
  doc.text('TVQ (9.975%):', pageWidth - 100, y);
  doc.text(formatCurrency(data.tvq, data.currency), pageWidth - 50, y);
  
  y += 8;
  
  // Ligne avant total
  doc.setDrawColor(...primaryColor);
  doc.setLineWidth(1);
  doc.line(pageWidth - 100, y, pageWidth - 20, y);
  
  y += 8;
  
  // Total
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL:', pageWidth - 100, y);
  doc.setTextColor(...primaryColor);
  doc.text(formatCurrency(data.total, data.currency), pageWidth - 50, y);
  
  y += 20;

  // ===== PAIEMENT =====
  
  doc.setFillColor(249, 250, 251);
  doc.roundedRect(20, y, pageWidth - 40, 20, 3, 3, 'F');
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...textColor);
  
  y += 8;
  doc.text(`Mode de paiement: ${data.paymentMethod}`, 25, y);
  y += 6;
  doc.setTextColor(...lightGray);
  doc.setFontSize(9);
  doc.text(`Transaction: ${data.transactionId}`, 25, y);
  
  y += 20;

  // ===== STATUT PAYÉ =====
  
  doc.setFillColor(34, 197, 94); // green-500
  doc.roundedRect(pageWidth / 2 - 30, y, 60, 20, 3, 3, 'F');
  
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('PAYÉ', pageWidth / 2 - 12, y + 13);
  
  y += 35;

  // ===== PIED DE PAGE =====
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...lightGray);
  
  const footerText = [
    'Merci pour votre achat!',
    'Ce reçu est généré automatiquement et constitue une preuve de paiement.',
    'Pour toute question, contactez-nous à ' + data.businessEmail,
  ];
  
  footerText.forEach((line, i) => {
    doc.text(line, pageWidth / 2, y + (i * 5), { align: 'center' });
  });

  // Générer le PDF en buffer
  const pdfOutput = doc.output('arraybuffer');
  return Buffer.from(pdfOutput);
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('fr-CA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
}

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('fr-CA', {
    style: 'currency',
    currency: currency,
  }).format(amount);
}

// Configuration de l'entreprise depuis les variables d'environnement
export const businessConfig = {
  name: process.env.BUSINESS_NAME || 'BioCycle Peptides Inc.',
  address: process.env.BUSINESS_ADDRESS || '123 Rue Principale, Montréal, QC H2X 1Y6',
  phone: process.env.BUSINESS_PHONE || '(514) 555-0123',
  email: process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'support@biocyclepeptides.com',
  taxNumbers: {
    tps: process.env.TPS_NUMBER || '',
    tvq: process.env.TVQ_NUMBER || '',
  },
};
