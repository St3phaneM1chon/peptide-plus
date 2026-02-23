// FIX: F59 - Shared formatting utilities to avoid duplication across media/admin files

/**
 * Format a file size in bytes to a human-readable string.
 * @param bytes - File size in bytes
 * @returns Formatted string (e.g., "1.5 MB", "512 KB", "128 B")
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
