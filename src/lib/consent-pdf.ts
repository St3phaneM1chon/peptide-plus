/**
 * Consent PDF Generator
 * Generates professional PDF documents for consent records using pdf-lib.
 */

import { PDFDocument, StandardFonts, rgb, PDFPage, PDFFont } from 'pdf-lib';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ConsentPdfData {
  consentId: string;
  clientName: string;
  clientEmail: string;
  type: string; // ContentConsentType enum value
  videoTitle?: string | null;
  templateName?: string | null;
  templateDescription?: string | null;
  questions: Array<{
    question: string;
    type: 'checkbox' | 'text' | 'signature';
    required: boolean;
  }>;
  responses: Record<string, string | boolean>;
  legalText?: string | null;
  grantedAt: Date;
  ipAddress?: string | null;
  userAgent?: string | null;
  signatureHash?: string | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PAGE_WIDTH = 595.28; // A4 width in points
const PAGE_HEIGHT = 841.89; // A4 height in points
const MARGIN_LEFT = 50;
const MARGIN_RIGHT = 50;
const MARGIN_TOP = 60;
const MARGIN_BOTTOM = 60;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;

const FONT_SIZE_TITLE = 20;
const FONT_SIZE_SECTION_HEADER = 13;
const FONT_SIZE_BODY = 10;
const FONT_SIZE_SMALL = 8;
const FONT_SIZE_LEGAL = 7.5;

const LINE_HEIGHT_BODY = 14;
const LINE_HEIGHT_LEGAL = 10;
const SECTION_GAP = 24;
const SUBSECTION_GAP = 6;

const COLOR_BLACK = rgb(0, 0, 0);
const COLOR_DARK = rgb(0.12, 0.12, 0.12);
const COLOR_GRAY = rgb(0.4, 0.4, 0.4);
const COLOR_LIGHT_GRAY = rgb(0.7, 0.7, 0.7);
const COLOR_ORANGE = rgb(0.918, 0.345, 0.047); // #EA580C
const COLOR_SEPARATOR = rgb(0.85, 0.85, 0.85);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Wrap a single string into lines that fit within `maxWidth` at the given font+size. */
function wrapText(
  text: string,
  font: PDFFont,
  fontSize: number,
  maxWidth: number,
): string[] {
  const paragraphs = text.split('\n');
  const allLines: string[] = [];

  for (const paragraph of paragraphs) {
    if (paragraph.trim() === '') {
      allLines.push('');
      continue;
    }

    const words = paragraph.split(/\s+/);
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const testWidth = font.widthOfTextAtSize(testLine, fontSize);

      if (testWidth > maxWidth && currentLine) {
        allLines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }

    if (currentLine) {
      allLines.push(currentLine);
    }
  }

  return allLines;
}

/** Format a Date to a readable string. */
function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  });
}

/** Friendly label for a ContentConsentType enum value. */
function formatConsentType(type: string): string {
  const map: Record<string, string> = {
    VIDEO_APPEARANCE: 'Video Appearance',
    TESTIMONIAL: 'Testimonial',
    PHOTO: 'Photo',
    CASE_STUDY: 'Case Study',
    MARKETING: 'Marketing',
  };
  return map[type] ?? type;
}

// ---------------------------------------------------------------------------
// Cursor – tracks the current Y position and handles page breaks
// ---------------------------------------------------------------------------

class PdfCursor {
  y: number;
  page: PDFPage;
  private readonly doc: PDFDocument;
  private readonly fontRegular: PDFFont;
  private readonly fontBold: PDFFont;

  constructor(
    doc: PDFDocument,
    page: PDFPage,
    fontRegular: PDFFont,
    fontBold: PDFFont,
  ) {
    this.doc = doc;
    this.page = page;
    this.fontRegular = fontRegular;
    this.fontBold = fontBold;
    this.y = PAGE_HEIGHT - MARGIN_TOP;
  }

  /** Ensure there is at least `needed` points of vertical space; add a page if not. */
  ensureSpace(needed: number): void {
    if (this.y - needed < MARGIN_BOTTOM) {
      this.addPage();
    }
  }

  /** Add a new page and reset the cursor. */
  addPage(): void {
    this.page = this.doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    this.y = PAGE_HEIGHT - MARGIN_TOP;
  }

  /** Draw text at the current position and advance the cursor. */
  drawText(
    text: string,
    options: {
      font?: PDFFont;
      size?: number;
      color?: ReturnType<typeof rgb>;
      x?: number;
      lineHeight?: number;
      maxWidth?: number;
      indent?: number;
    } = {},
  ): void {
    const font = options.font ?? this.fontRegular;
    const size = options.size ?? FONT_SIZE_BODY;
    const color = options.color ?? COLOR_DARK;
    const x = options.x ?? MARGIN_LEFT;
    const lineHeight = options.lineHeight ?? LINE_HEIGHT_BODY;
    const maxWidth = options.maxWidth ?? CONTENT_WIDTH - (options.indent ?? 0);
    const indent = options.indent ?? 0;

    const lines = wrapText(text, font, size, maxWidth);

    for (const line of lines) {
      this.ensureSpace(lineHeight);
      this.page.drawText(line, {
        x: x + indent,
        y: this.y,
        size,
        font,
        color,
      });
      this.y -= lineHeight;
    }
  }

  /** Draw a horizontal separator line. */
  drawSeparator(): void {
    this.ensureSpace(10);
    this.y -= 4;
    this.page.drawLine({
      start: { x: MARGIN_LEFT, y: this.y },
      end: { x: PAGE_WIDTH - MARGIN_RIGHT, y: this.y },
      thickness: 0.5,
      color: COLOR_SEPARATOR,
    });
    this.y -= 8;
  }

  /** Draw a section header with the orange accent. */
  drawSectionHeader(title: string): void {
    this.ensureSpace(SECTION_GAP + FONT_SIZE_SECTION_HEADER + 8);
    this.y -= SECTION_GAP;

    // Orange accent bar
    this.page.drawRectangle({
      x: MARGIN_LEFT,
      y: this.y - 1,
      width: 3,
      height: FONT_SIZE_SECTION_HEADER + 2,
      color: COLOR_ORANGE,
    });

    this.page.drawText(title.toUpperCase(), {
      x: MARGIN_LEFT + 10,
      y: this.y,
      size: FONT_SIZE_SECTION_HEADER,
      font: this.fontBold,
      color: COLOR_ORANGE,
    });

    this.y -= FONT_SIZE_SECTION_HEADER + 8;
  }

  /** Draw a label: value pair on one or more lines. */
  drawLabelValue(label: string, value: string): void {
    const labelWidth = this.fontBold.widthOfTextAtSize(`${label}: `, FONT_SIZE_BODY);
    const availableForValue = CONTENT_WIDTH - labelWidth;

    const valueLines = wrapText(value, this.fontRegular, FONT_SIZE_BODY, availableForValue);

    this.ensureSpace(LINE_HEIGHT_BODY);

    // Label
    this.page.drawText(`${label}:`, {
      x: MARGIN_LEFT,
      y: this.y,
      size: FONT_SIZE_BODY,
      font: this.fontBold,
      color: COLOR_DARK,
    });

    // First line of value next to label
    if (valueLines.length > 0) {
      this.page.drawText(valueLines[0], {
        x: MARGIN_LEFT + labelWidth,
        y: this.y,
        size: FONT_SIZE_BODY,
        font: this.fontRegular,
        color: COLOR_DARK,
      });
    }

    this.y -= LINE_HEIGHT_BODY;

    // Remaining value lines indented to match
    for (let i = 1; i < valueLines.length; i++) {
      this.ensureSpace(LINE_HEIGHT_BODY);
      this.page.drawText(valueLines[i], {
        x: MARGIN_LEFT + labelWidth,
        y: this.y,
        size: FONT_SIZE_BODY,
        font: this.fontRegular,
        color: COLOR_DARK,
      });
      this.y -= LINE_HEIGHT_BODY;
    }
  }

  /** Advance Y by a given gap. */
  advance(gap: number): void {
    this.y -= gap;
  }
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export async function generateConsentPdf(
  data: ConsentPdfData,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const fontRegular = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const firstPage = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const cursor = new PdfCursor(doc, firstPage, fontRegular, fontBold);

  // -----------------------------------------------------------------------
  // 1. HEADER
  // -----------------------------------------------------------------------

  // Company name
  cursor.page.drawText('BioCycle Peptides', {
    x: MARGIN_LEFT,
    y: cursor.y,
    size: 16,
    font: fontBold,
    color: COLOR_ORANGE,
  });

  // Document date (right-aligned)
  const dateStr = formatDate(data.grantedAt);
  const dateWidth = fontRegular.widthOfTextAtSize(dateStr, FONT_SIZE_SMALL);
  cursor.page.drawText(dateStr, {
    x: PAGE_WIDTH - MARGIN_RIGHT - dateWidth,
    y: cursor.y,
    size: FONT_SIZE_SMALL,
    font: fontRegular,
    color: COLOR_GRAY,
  });

  cursor.y -= 24;

  // Title
  cursor.page.drawText('Consent Record', {
    x: MARGIN_LEFT,
    y: cursor.y,
    size: FONT_SIZE_TITLE,
    font: fontBold,
    color: COLOR_BLACK,
  });

  cursor.y -= 10;

  // Consent ID
  const idText = `ID: ${data.consentId}`;
  cursor.page.drawText(idText, {
    x: MARGIN_LEFT,
    y: cursor.y,
    size: FONT_SIZE_SMALL,
    font: fontRegular,
    color: COLOR_GRAY,
  });

  cursor.y -= 8;

  cursor.drawSeparator();

  // -----------------------------------------------------------------------
  // 2. CLIENT INFORMATION
  // -----------------------------------------------------------------------

  cursor.drawSectionHeader('Client Information');

  cursor.drawLabelValue('Name', data.clientName);
  cursor.advance(SUBSECTION_GAP);
  cursor.drawLabelValue('Email', data.clientEmail);
  cursor.advance(SUBSECTION_GAP);
  cursor.drawLabelValue('Consent Type', formatConsentType(data.type));

  if (data.videoTitle) {
    cursor.advance(SUBSECTION_GAP);
    cursor.drawLabelValue('Related Video', data.videoTitle);
  }

  if (data.templateName) {
    cursor.advance(SUBSECTION_GAP);
    cursor.drawLabelValue('Form Template', data.templateName);
  }

  if (data.templateDescription) {
    cursor.advance(SUBSECTION_GAP);
    cursor.drawLabelValue('Description', data.templateDescription);
  }

  // -----------------------------------------------------------------------
  // 3. QUESTIONS & ANSWERS
  // -----------------------------------------------------------------------

  if (data.questions.length > 0) {
    cursor.drawSectionHeader('Questions & Answers');

    for (let i = 0; i < data.questions.length; i++) {
      const q = data.questions[i];
      const responseKey = String(i);
      const response = data.responses[responseKey];

      cursor.ensureSpace(LINE_HEIGHT_BODY * 3);

      // Question number + text
      const questionLabel = `Q${i + 1}. ${q.question}`;
      cursor.drawText(questionLabel, {
        font: fontBold,
        size: FONT_SIZE_BODY,
        color: COLOR_DARK,
      });

      // Required indicator
      if (q.required) {
        cursor.page.drawText('(Required)', {
          x: MARGIN_LEFT + 20,
          y: cursor.y + LINE_HEIGHT_BODY - 2,
          size: FONT_SIZE_SMALL,
          font: fontRegular,
          color: COLOR_GRAY,
        });
      }

      // Answer based on type
      let answerText: string;
      if (q.type === 'checkbox') {
        const checked = response === true || response === 'true';
        answerText = checked ? 'Yes' : 'No';
      } else if (q.type === 'signature') {
        answerText = typeof response === 'string' && response
          ? `Signed: "${response}"`
          : 'Not signed';
      } else {
        answerText = typeof response === 'string' && response
          ? response
          : 'No response';
      }

      cursor.advance(2);
      cursor.drawText(answerText, {
        font: fontRegular,
        size: FONT_SIZE_BODY,
        color: COLOR_DARK,
        indent: 20,
      });

      // Small gap between questions
      if (i < data.questions.length - 1) {
        cursor.advance(8);
      }
    }
  }

  // -----------------------------------------------------------------------
  // 4. LEGAL TEXT
  // -----------------------------------------------------------------------

  if (data.legalText) {
    cursor.drawSectionHeader('Legal Terms');

    const legalLines = wrapText(
      data.legalText,
      fontRegular,
      FONT_SIZE_LEGAL,
      CONTENT_WIDTH,
    );

    for (const line of legalLines) {
      cursor.ensureSpace(LINE_HEIGHT_LEGAL);
      cursor.page.drawText(line, {
        x: MARGIN_LEFT,
        y: cursor.y,
        size: FONT_SIZE_LEGAL,
        font: fontRegular,
        color: COLOR_GRAY,
      });
      cursor.y -= LINE_HEIGHT_LEGAL;
    }
  }

  // -----------------------------------------------------------------------
  // 5. ELECTRONIC PROOF
  // -----------------------------------------------------------------------

  cursor.drawSectionHeader('Electronic Proof');

  cursor.drawLabelValue('Consent Granted', formatDate(data.grantedAt));
  cursor.advance(SUBSECTION_GAP);

  if (data.ipAddress) {
    cursor.drawLabelValue('IP Address', data.ipAddress);
    cursor.advance(SUBSECTION_GAP);
  }

  if (data.userAgent) {
    cursor.drawLabelValue('User Agent', data.userAgent);
    cursor.advance(SUBSECTION_GAP);
  }

  if (data.signatureHash) {
    cursor.drawLabelValue('Signature Hash', data.signatureHash);
    cursor.advance(SUBSECTION_GAP);
  }

  // -----------------------------------------------------------------------
  // 6. FOOTER
  // -----------------------------------------------------------------------

  cursor.advance(SECTION_GAP);
  cursor.drawSeparator();

  const footerText =
    'This document serves as proof of electronic consent. Generated by BioCycle Peptides.';
  const footerWidth = fontRegular.widthOfTextAtSize(footerText, FONT_SIZE_SMALL);
  const footerX = (PAGE_WIDTH - footerWidth) / 2;

  cursor.ensureSpace(LINE_HEIGHT_BODY);
  cursor.page.drawText(footerText, {
    x: footerX,
    y: cursor.y,
    size: FONT_SIZE_SMALL,
    font: fontRegular,
    color: COLOR_LIGHT_GRAY,
  });

  // -----------------------------------------------------------------------
  // Serialize
  // -----------------------------------------------------------------------

  return doc.save();
}
