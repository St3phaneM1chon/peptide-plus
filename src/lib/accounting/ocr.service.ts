/**
 * OCR Service for Invoice Scanning
 * Uses OpenAI Vision or Tesseract for document processing
 */

interface InvoiceData {
  invoiceNumber?: string;
  invoiceDate?: Date;
  dueDate?: Date;
  supplierName?: string;
  supplierAddress?: string;
  subtotal?: number;
  taxTps?: number;
  taxTvq?: number;
  total?: number;
  lineItems?: {
    description: string;
    quantity?: number;
    unitPrice?: number;
    total: number;
  }[];
  currency?: string;
  confidence: number;
  rawText?: string;
}

interface OCRResult {
  success: boolean;
  data?: InvoiceData;
  error?: string;
  processingTime?: number;
}

/**
 * ACF-007: Maximum allowed base64-encoded image size before sending to OpenAI.
 * A 10 MB file becomes ~13.3 MB of base64 (4/3 ratio), so the threshold below
 * reflects the original binary limit of 10 MB expressed in base64 characters.
 */
const MAX_BASE64_CHARS = Math.ceil(10 * 1024 * 1024 * (4 / 3));

/**
 * Process invoice image using OpenAI Vision API
 */
export async function processInvoiceWithVision(
  imageBase64: string,
  mimeType: string = 'image/png'
): Promise<OCRResult> {
  const startTime = Date.now();

  try {
    // ACF-007: Validate base64 payload size before forwarding to OpenAI.
    // This catches callers that bypass validateOCRFile (e.g. direct service calls).
    if (imageBase64.length > MAX_BASE64_CHARS) {
      return {
        success: false,
        error: 'Image trop volumineuse (max 10 Mo). Veuillez compresser ou redimensionner l\'image avant de la soumettre.',
      };
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return { success: false, error: 'OpenAI API key not configured' };
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `Tu es un assistant spécialisé dans l'extraction de données de factures.
Analyse l'image et extrait les informations suivantes au format JSON:
- invoiceNumber: numéro de facture
- invoiceDate: date de facture (format YYYY-MM-DD)
- dueDate: date d'échéance (format YYYY-MM-DD)
- supplierName: nom du fournisseur
- supplierAddress: adresse du fournisseur
- subtotal: sous-total avant taxes (nombre)
- taxTps: montant TPS/GST (nombre)
- taxTvq: montant TVQ/QST (nombre)
- total: total TTC (nombre)
- lineItems: tableau d'articles avec description, quantity, unitPrice, total
- currency: devise (CAD, USD, EUR)

Retourne UNIQUEMENT le JSON, sans markdown ni explication.`,
          },
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: {
                  url: `data:${mimeType};base64,${imageBase64}`,
                  detail: 'high',
                },
              },
              {
                type: 'text',
                text: 'Extrait les données de cette facture au format JSON.',
              },
            ],
          },
        ],
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      // ACF-001: Do not expose raw OpenAI API error body to callers (may contain key/rate info)
      const errorBody = await response.text();
      console.error('[OCR] OpenAI API error', { status: response.status, body: errorBody });
      return { success: false, error: `OpenAI Vision API returned status ${response.status}` };
    }

    const result = await response.json();
    const content = result.choices[0]?.message?.content;

    if (!content) {
      return { success: false, error: 'No response from OpenAI' };
    }

    // Parse JSON response
    try {
      const data = JSON.parse(content.replace(/```json\n?|\n?```/g, '').trim());
      
      // Convert dates
      if (data.invoiceDate) data.invoiceDate = new Date(data.invoiceDate);
      if (data.dueDate) data.dueDate = new Date(data.dueDate);

      // F-049 FIX: Compute confidence dynamically based on fields extracted
      const extractedFields = [
        data.invoiceNumber, data.invoiceDate, data.supplierName,
        data.subtotal, data.total, data.lineItems?.length,
      ].filter(Boolean).length;
      const dynamicConfidence = Math.min(0.95, 0.5 + extractedFields * 0.08);

      return {
        success: true,
        data: {
          ...data,
          confidence: dynamicConfidence,
        },
        processingTime: Date.now() - startTime,
      };
    } catch (parseError) {
      console.error('[OCR] Failed to parse OCR result:', parseError);
      return {
        success: false,
        error: 'Failed to parse OCR result',
        processingTime: Date.now() - startTime,
      };
    }
  } catch (error: unknown) {
    console.error('[OCR] OCR invoice processing failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      processingTime: Date.now() - startTime,
    };
  }
}

/**
 * Extract amounts from text using regex patterns
 */
function extractAmounts(text: string): {
  subtotal?: number;
  taxTps?: number;
  taxTvq?: number;
  total?: number;
} {
  const result: { subtotal?: number; taxTps?: number; taxTvq?: number; total?: number } = {};

  // Patterns for different amount types
  const patterns = {
    subtotal: /sous[- ]?total|subtotal|montant\s*ht/i,
    taxTps: /tps|gst|t\.?p\.?s\.?/i,
    taxTvq: /tvq|qst|t\.?v\.?q\.?/i,
    total: /total\s*(ttc)?|montant\s*total|grand\s*total/i,
  };

  // Amount pattern (handles $1,234.56 or 1 234,56 $)
  const amountPattern = /\$?\s*[\d\s]+[.,]\d{2}\s*\$?/g;

  const lines = text.split('\n');
  
  for (const line of lines) {
    const amounts = line.match(amountPattern);
    if (!amounts) continue;

    const amount = parseAmount(amounts[amounts.length - 1]); // Usually last amount on line

    if (patterns.subtotal.test(line) && !result.subtotal) {
      result.subtotal = amount;
    } else if (patterns.taxTps.test(line) && !result.taxTps) {
      result.taxTps = amount;
    } else if (patterns.taxTvq.test(line) && !result.taxTvq) {
      result.taxTvq = amount;
    } else if (patterns.total.test(line) && !result.total) {
      result.total = amount;
    }
  }

  return result;
}

/**
 * Parse amount string to number
 */
function parseAmount(amountStr: string): number {
  // Remove currency symbols and spaces
  let cleaned = amountStr.replace(/[$\s]/g, '');
  
  // Handle French format (1 234,56) vs English (1,234.56)
  if (cleaned.includes(',') && !cleaned.includes('.')) {
    cleaned = cleaned.replace(',', '.');
  } else if (cleaned.includes(',') && cleaned.includes('.')) {
    // Has both - assume comma is thousands separator
    cleaned = cleaned.replace(',', '');
  }

  return parseFloat(cleaned) || 0;
}

/**
 * Extract invoice number
 */
function extractInvoiceNumber(text: string): string | undefined {
  const patterns = [
    /facture\s*[#n°:]?\s*([A-Z0-9-]+)/i,
    /invoice\s*[#n°:]?\s*([A-Z0-9-]+)/i,
    /n[°o]?\s*:\s*([A-Z0-9-]+)/i,
    /ref[é]?rence\s*[#:]?\s*([A-Z0-9-]+)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1];
  }

  return undefined;
}

/**
 * Extract dates from text
 */
function extractDates(text: string): { invoiceDate?: Date; dueDate?: Date } {
  const result: { invoiceDate?: Date; dueDate?: Date } = {};

  // Date patterns
  const datePatterns = [
    /(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/g, // DD/MM/YYYY or DD-MM-YYYY
    /(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})/g, // YYYY-MM-DD
  ];

  const lines = text.split('\n');
  
  for (const line of lines) {
    const lowerLine = line.toLowerCase();
    
    for (const pattern of datePatterns) {
      const matches = [...line.matchAll(pattern)];
      
      for (const match of matches) {
        const dateStr = match[0];
        let date: Date | null = null;

        // Try to parse
        if (/^\d{4}/.test(dateStr)) {
          date = new Date(dateStr);
        } else {
          // Assume DD/MM/YYYY
          const parts = dateStr.split(/[\/\-.]/).map(Number);
          if (parts.length === 3) {
            const year = parts[2] < 100 ? 2000 + parts[2] : parts[2];
            date = new Date(year, parts[1] - 1, parts[0]);
          }
        }

        if (date && !isNaN(date.getTime())) {
          if ((lowerLine.includes('échéance') || lowerLine.includes('due') || lowerLine.includes('payer avant')) && !result.dueDate) {
            result.dueDate = date;
          } else if (!result.invoiceDate) {
            result.invoiceDate = date;
          }
        }
      }
    }
  }

  return result;
}

/**
 * Simple text-based OCR fallback (for environments without Vision API)
 */
export async function processInvoiceFromText(
  rawText: string
): Promise<OCRResult> {
  const startTime = Date.now();

  try {
    const amounts = extractAmounts(rawText);
    const dates = extractDates(rawText);
    const invoiceNumber = extractInvoiceNumber(rawText);

    // Extract supplier name (usually in first few lines)
    const lines = rawText.split('\n').filter(l => l.trim());
    const supplierName = lines.find(l => l.length > 3 && l.length < 100 && !/\d/.test(l));

    const data: InvoiceData = {
      invoiceNumber,
      invoiceDate: dates.invoiceDate,
      dueDate: dates.dueDate,
      supplierName,
      subtotal: amounts.subtotal,
      taxTps: amounts.taxTps,
      taxTvq: amounts.taxTvq,
      total: amounts.total,
      // FIX: F081 - Detect common currency symbols beyond just apostrophe/dollar
      currency: detectCurrency(rawText),
      confidence: 0.6, // Lower confidence for text-only processing
      rawText,
    };

    return {
      success: true,
      data,
      processingTime: Date.now() - startTime,
    };
  } catch (error: unknown) {
    console.error('[OCR] OCR receipt processing failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      processingTime: Date.now() - startTime,
    };
  }
}

/**
 * #74 Audit: Validate OCR results before they can be used to create entries.
 * Returns a list of validation errors. Empty array means data is valid.
 */
export function validateOCRData(ocrData: InvoiceData): string[] {
  const errors: string[] = [];

  if (!ocrData.total || ocrData.total <= 0) {
    errors.push('Total is missing or not positive');
  }

  if (ocrData.subtotal !== undefined && ocrData.subtotal < 0) {
    errors.push('Subtotal cannot be negative');
  }

  if (ocrData.taxTps !== undefined && ocrData.taxTps < 0) {
    errors.push('TPS tax amount cannot be negative');
  }

  if (ocrData.taxTvq !== undefined && ocrData.taxTvq < 0) {
    errors.push('TVQ tax amount cannot be negative');
  }

  // Cross-validate: subtotal + taxes should roughly equal total
  if (ocrData.subtotal && ocrData.total) {
    const computedTotal = ocrData.subtotal + (ocrData.taxTps || 0) + (ocrData.taxTvq || 0);
    const tolerance = ocrData.total * 0.05; // 5% tolerance for OCR inaccuracies
    if (Math.abs(computedTotal - ocrData.total) > tolerance && Math.abs(computedTotal - ocrData.total) > 1) {
      errors.push(
        `Computed total (${computedTotal.toFixed(2)}) differs from OCR total (${ocrData.total.toFixed(2)}) by more than 5%`
      );
    }
  }

  // Validate dates are sensible
  if (ocrData.invoiceDate) {
    const now = new Date();
    const twoYearsAgo = new Date(now.getFullYear() - 2, 0, 1);
    if (ocrData.invoiceDate < twoYearsAgo || ocrData.invoiceDate > new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)) {
      errors.push('Invoice date seems unreasonable (more than 2 years old or in the future)');
    }
  }

  if (ocrData.dueDate && ocrData.invoiceDate && ocrData.dueDate < ocrData.invoiceDate) {
    errors.push('Due date is before invoice date');
  }

  if (ocrData.confidence < 0.5) {
    errors.push(`OCR confidence too low (${(ocrData.confidence * 100).toFixed(0)}%) - manual review required`);
  }

  return errors;
}

/**
 * Create supplier invoice from OCR data
 */
export function createInvoiceFromOCR(
  ocrData: InvoiceData
): {
  invoiceNumber: string;
  supplierName: string;
  invoiceDate: Date;
  dueDate: Date;
  subtotal: number;
  taxTps: number;
  taxTvq: number;
  total: number;
  items: { description: string; quantity: number; unitPrice: number; total: number }[];
  needsReview: boolean;
  reviewNotes: string[];
} {
  const reviewNotes: string[] = [];
  let needsReview = false;

  // #74 Audit: Run structured validation before creating entries
  const validationErrors = validateOCRData(ocrData);
  if (validationErrors.length > 0) {
    reviewNotes.push(...validationErrors);
    needsReview = true;
  }

  // Additional cosmetic checks
  if (!ocrData.invoiceNumber) {
    reviewNotes.push('Numéro de facture non détecté');
    needsReview = true;
  }

  if (ocrData.confidence < 0.7 && !validationErrors.some(e => e.includes('confidence'))) {
    reviewNotes.push('Confiance OCR faible - vérification recommandée');
    needsReview = true;
  }

  return {
    invoiceNumber: ocrData.invoiceNumber || `OCR-${Date.now()}`,
    supplierName: ocrData.supplierName || 'Fournisseur inconnu',
    invoiceDate: ocrData.invoiceDate || new Date(),
    dueDate: ocrData.dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    subtotal: ocrData.subtotal || 0,
    taxTps: ocrData.taxTps || 0,
    taxTvq: ocrData.taxTvq || 0,
    total: ocrData.total || 0,
    items: ocrData.lineItems?.map(item => ({
      description: item.description,
      quantity: item.quantity || 1,
      unitPrice: item.unitPrice || item.total,
      total: item.total,
    })) || [],
    needsReview,
    reviewNotes,
  };
}

/**
 * FIX: F081 - Detect currency from common symbols ($, EUR, GBP, etc.)
 */
function detectCurrency(text: string): string | undefined {
  if (/\$|CAD|CA\$/i.test(text)) return 'CAD';
  if (/USD|US\$/i.test(text)) return 'USD';
  if (/€|EUR/i.test(text)) return 'EUR';
  if (/£|GBP/i.test(text)) return 'GBP';
  if (/¥|JPY|CNY/i.test(text)) return 'JPY';
  // Fallback: if $ is present without other clues, assume CAD (Canadian business context)
  if (/\$/.test(text)) return 'CAD';
  return undefined;
}

/**
 * Supported file types for OCR
 */
export const SUPPORTED_FILE_TYPES = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
  'application/pdf', // PDF requires special handling
];

/**
 * Validate file for OCR
 */
export function validateOCRFile(
  file: { type: string; size: number }
): { valid: boolean; error?: string } {
  if (!SUPPORTED_FILE_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: `Type de fichier non supporté. Types acceptés: ${SUPPORTED_FILE_TYPES.join(', ')}`,
    };
  }

  // FIX: F087 - Reduced from 20MB to 10MB for serverless compatibility (Azure Functions memory limits)
  if (file.size > 10 * 1024 * 1024) {
    return {
      valid: false,
      error: 'Le fichier est trop volumineux (max 10 Mo)',
    };
  }

  return { valid: true };
}
