/**
 * STORAGE SERVICE (#66)
 * Azure Blob Storage with local filesystem fallback for development.
 *
 * Usage:
 *   import { StorageService } from '@/lib/storage';
 *   const storage = new StorageService();
 *   const url = await storage.upload(buffer, 'image.jpg', 'image/jpeg');
 *   await storage.delete(url);
 *
 * IMP-001: TODO: Implement CDN (Azure CDN or Cloudflare) in front of storage for geo-distributed caching
 * IMP-002: DONE: All 5 upload endpoints already use StorageService (admin/medias, reviews/upload, chat/upload, accounting/attachments, hero-slides)
 * IMP-004: TODO: Add storageQuota field to settings and enforce per-user/org quota check before upload
 * IMP-005: TODO: Implement orphan media garbage collection job (find Media records not referenced by any Product/Article/HeroSlide)
 * IMP-006: TODO: Wire getPresignedUploadUrl() to a client-side direct upload flow for large files (method exists but unused)
 * IMP-008: TODO: Configure Azure Blob Storage geo-redundancy (GRS) and soft-delete for backup
 * IMP-010: TODO: Implement media versioning (keep previous versions with isLatest flag before overwrite)
 */

import { writeFile, unlink, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { createHash, randomUUID } from 'crypto';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UploadResult {
  url: string;
  filename: string;
  size: number;
  contentHash: string;
}

export interface StorageOptions {
  folder?: string;
  /** If true, include a content hash in the filename for cache-busting (#70) */
  hashFilename?: boolean;
}

// ---------------------------------------------------------------------------
// Azure Blob Storage Client (lazy-loaded)
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let blobServiceClient: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let containerClient: any = null;

async function getAzureClients() {
  if (containerClient) return { blobServiceClient: blobServiceClient!, containerClient };

  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
  const containerName = process.env.AZURE_STORAGE_CONTAINER || 'media';

  if (!connectionString) {
    return null;
  }

  try {
    const { BlobServiceClient } = await import('@azure/storage-blob');
    blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
    containerClient = blobServiceClient.getContainerClient(containerName);

    // Create container if it doesn't exist
    await containerClient.createIfNotExists({ access: 'blob' });

    return { blobServiceClient, containerClient };
  } catch (error) {
    logger.warn('Azure Blob Storage not available, using local filesystem', { error: error instanceof Error ? error.message : String(error) });
    return null;
  }
}

// ---------------------------------------------------------------------------
// Storage Service
// ---------------------------------------------------------------------------

export class StorageService {
  private localUploadDir: string;

  constructor() {
    this.localUploadDir = path.join(process.cwd(), 'public', 'uploads');
  }

  /**
   * Upload a file to Azure Blob Storage or local filesystem.
   * Returns the public URL of the uploaded file.
   * (#70): Includes content hash in filename for immutable caching.
   */
  async upload(
    file: Buffer,
    filename: string,
    contentType: string,
    options: StorageOptions = {}
  ): Promise<UploadResult> {
    const { folder = 'general', hashFilename = true } = options;

    // Generate content hash for deduplication (#71) and cache-busting (#70)
    const contentHash = createHash('sha256').update(file).digest('hex').slice(0, 16);

    // Build filename with hash
    const ext = path.extname(filename);
    const baseName = path.basename(filename, ext);
    const uniqueName = hashFilename
      ? `${baseName}-${contentHash}${ext}`
      : `${randomUUID()}${ext}`;

    const blobPath = `${folder}/${uniqueName}`;

    const azure = await getAzureClients();

    if (azure) {
      return this.uploadToAzure(azure.containerClient, file, blobPath, contentType, contentHash);
    }

    return this.uploadToLocal(file, blobPath, contentType, contentHash);
  }

  /**
   * Delete a file from storage.
   */
  async delete(url: string): Promise<void> {
    const azure = await getAzureClients();

    if (azure) {
      return this.deleteFromAzure(azure.containerClient, url);
    }

    return this.deleteFromLocal(url);
  }

  /**
   * Get a public URL for a file.
   * For Azure, returns the blob URL.
   * For local, returns the /uploads/... path.
   */
  async getUrl(blobPath: string): Promise<string> {
    const azure = await getAzureClients();

    if (azure) {
      const blobClient = azure.containerClient.getBlobClient(blobPath);
      return blobClient.url;
    }

    return `/uploads/${blobPath}`;
  }

  /**
   * Generate a presigned URL for direct upload to Azure (#74).
   */
  async getPresignedUploadUrl(
    blobPath: string,
    contentType: string,
    expiresInMinutes: number = 15
  ): Promise<{ uploadUrl: string; blobUrl: string } | null> {
    const azure = await getAzureClients();

    if (!azure) {
      return null; // Presigned URLs only work with Azure
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const azureBlob: any = await import('@azure/storage-blob');
      const { BlobSASPermissions, generateBlobSASQueryParameters, StorageSharedKeyCredential } = azureBlob;

      const blockBlobClient = azure.containerClient.getBlockBlobClient(blobPath);

      // F78 FIX: Parse connection string with key-value splitting instead of fragile regex.
      // Handles edge cases like values containing '=' (e.g. base64 AccountKey) by splitting
      // only on the first '=' per segment.
      const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING!;
      const connParts: Record<string, string> = {};
      for (const segment of connectionString.split(';')) {
        const eqIdx = segment.indexOf('=');
        if (eqIdx > 0) {
          connParts[segment.substring(0, eqIdx).trim()] = segment.substring(eqIdx + 1).trim();
        }
      }
      const accountName = connParts['AccountName'] || '';
      const accountKey = connParts['AccountKey'] || '';

      if (!accountName || !accountKey) {
        return null;
      }

      const sharedKeyCredential = new StorageSharedKeyCredential(accountName, accountKey);

      const startsOn = new Date();
      const expiresOn = new Date(startsOn.getTime() + expiresInMinutes * 60 * 1000);

      const sasToken = generateBlobSASQueryParameters(
        {
          containerName: azure.containerClient.containerName,
          blobName: blobPath,
          permissions: BlobSASPermissions.parse('cw'), // create + write
          startsOn,
          expiresOn,
          contentType,
        },
        sharedKeyCredential
      ).toString();

      return {
        uploadUrl: `${blockBlobClient.url}?${sasToken}`,
        blobUrl: blockBlobClient.url,
      };
    } catch (error) {
      logger.error('Failed to generate presigned URL', { error: error instanceof Error ? error.message : String(error) });
      return null;
    }
  }

  // -------------------------------------------------------------------------
  // Azure Implementation
  // -------------------------------------------------------------------------

  private async uploadToAzure(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    container: any,
    file: Buffer,
    blobPath: string,
    contentType: string,
    contentHash: string
  ): Promise<UploadResult> {
    const blockBlobClient = container!.getBlockBlobClient(blobPath);

    await blockBlobClient.uploadData(file, {
      blobHTTPHeaders: {
        blobContentType: contentType,
        // #70: CDN headers for immutable caching
        blobCacheControl: 'public, max-age=31536000, immutable',
      },
    });

    return {
      url: blockBlobClient.url,
      filename: blobPath,
      size: file.length,
      contentHash,
    };
  }

  private async deleteFromAzure(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    container: any,
    url: string
  ): Promise<void> {
    // FIX (F18): Parse URL properly instead of fragile split('/')
    // Handles query parameters and unexpected URL formats
    let blobName: string;
    try {
      const parsed = new URL(url);
      // Remove leading slash and container name from pathname
      // e.g. /media/folder/file.jpg -> folder/file.jpg
      const pathParts = parsed.pathname.split('/').filter(Boolean);
      // Skip the container name (first segment) to get the blob path
      blobName = pathParts.length > 1 ? pathParts.slice(1).join('/') : pathParts.join('/');
    } catch (error) {
      console.error('[Storage] URL parsing failed for blob deletion, using fallback:', error);
      blobName = url.split('/').slice(-2).join('/');
    }
    const blobClient = container!.getBlobClient(blobName);
    await blobClient.deleteIfExists();
  }

  // -------------------------------------------------------------------------
  // Local Filesystem Implementation (dev fallback)
  // -------------------------------------------------------------------------

  private async uploadToLocal(
    file: Buffer,
    blobPath: string,
    _contentType: string,
    contentHash: string
  ): Promise<UploadResult> {
    const filePath = path.join(this.localUploadDir, blobPath);
    const dir = path.dirname(filePath);

    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }

    await writeFile(filePath, file);

    return {
      url: `/uploads/${blobPath}`,
      filename: blobPath,
      size: file.length,
      contentHash,
    };
  }

  private async deleteFromLocal(url: string): Promise<void> {
    const relativePath = url.replace(/^\/uploads\//, '');
    const filePath = path.join(this.localUploadDir, relativePath);

    try {
      await unlink(filePath);
    } catch (error) {
      // File might not exist - only log unexpected errors
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.error('[Storage] Failed to delete local file:', error);
      }
    }
  }

  // -------------------------------------------------------------------------
  // Deduplication (#71)
  // -------------------------------------------------------------------------

  /**
   * Check if a file with the same SHA-256 hash already exists.
   * Returns the existing URL if found, null otherwise.
   */
  // F43 FIX: Use proper Prisma typing instead of unsafe cast
  async findDuplicate(contentHash: string, folder: string = 'general'): Promise<string | null> {
    // Check in Media table if a file with same hash exists
    try {
      const { prisma } = await import('@/lib/db');
      const existing = await prisma.media.findFirst({
        where: {
          url: { contains: contentHash },
          folder,
        },
        select: { url: true },
      });
      return existing?.url || null;
    } catch (error) {
      console.error('[Storage] Failed to find duplicate media:', error);
      return null;
    }
  }
}

// Singleton instance
export const storage = new StorageService();
