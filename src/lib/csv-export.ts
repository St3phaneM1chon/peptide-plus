/**
 * CSV EXPORT UTILITY
 * Generates properly formatted CSV with UTF-8 BOM for Excel compatibility
 */

/**
 * Escapes a CSV field value
 * - Wraps in quotes if contains comma, quote, or newline
 * - Doubles any quotes inside the value
 */
function escapeCSVField(value: string | number | null | undefined): string {
  if (value === null || value === undefined) {
    return '';
  }

  const stringValue = String(value);

  // If the value contains comma, quote, or newline, wrap it in quotes
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n') || stringValue.includes('\r')) {
    // Double any quotes in the value
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
}

/**
 * Generates a CSV string from headers and rows
 * @param headers - Array of column headers
 * @param rows - Array of row data (each row is an array of values)
 * @returns CSV string with UTF-8 BOM for Excel compatibility
 */
export function generateCSV(headers: string[], rows: string[][]): string {
  // UTF-8 BOM for Excel compatibility
  const BOM = '\uFEFF';

  // Build CSV content
  const csvLines: string[] = [];

  // Add headers
  csvLines.push(headers.map(escapeCSVField).join(','));

  // Add rows
  for (const row of rows) {
    csvLines.push(row.map(escapeCSVField).join(','));
  }

  return BOM + csvLines.join('\n');
}

/**
 * Formats a date for CSV export
 */
export function formatDateForCSV(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('fr-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

/**
 * Formats a datetime for CSV export
 */
export function formatDateTimeForCSV(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('fr-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}
