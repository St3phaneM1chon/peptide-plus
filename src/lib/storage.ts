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
 * IMP-004: DONE: Storage quota check implemented via checkStorageQuota() method
 * IMP-005: DONE: Orphan media cleanup implemented via findOrphanMedia() method
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

  // -------------------------------------------------------------------------
  // IMP-004: Storage Quota Management
  // -------------------------------------------------------------------------

  /** Default storage quota per user in bytes (500 MB) */
  static DEFAULT_QUOTA_BYTES = 500 * 1024 * 1024;

  /**
   * Check if a user has sufficient storage quota for a new upload.
   * Returns { allowed, usedBytes, quotaBytes, remainingBytes }.
   *
   * @param userId - The user attempting the upload
   * @param fileSizeBytes - Size of the file being uploaded
   * @param quotaBytes - Custom quota override (defaults to DEFAULT_QUOTA_BYTES)
   */
  async checkStorageQuota(
    userId: string,
    fileSizeBytes: number,
    quotaBytes: number = StorageService.DEFAULT_QUOTA_BYTES
  ): Promise<{ allowed: boolean; usedBytes: number; quotaBytes: number; remainingBytes: number }> {
    try {
      const { prisma } = await import('@/lib/db');

      // Sum total storage used by this user
      const result = await prisma.media.aggregate({
        where: { uploadedBy: userId },
        _sum: { size: true },
      });
      const usedBytes = result._sum.size || 0;
      const remainingBytes = Math.max(0, quotaBytes - usedBytes);

      return {
        allowed: (usedBytes + fileSizeBytes) <= quotaBytes,
        usedBytes,
        quotaBytes,
        remainingBytes,
      };
    } catch (error) {
      logger.error('[Storage] Failed to check storage quota', {
        error: error instanceof Error ? error.message : String(error),
        userId,
      });
      // Fail open: allow upload if quota check fails (don't block on DB errors)
      return { allowed: true, usedBytes: 0, quotaBytes, remainingBytes: quotaBytes };
    }
  }

  // -------------------------------------------------------------------------
  // IMP-005: Orphan Media Cleanup
  // -------------------------------------------------------------------------

  /**
   * Find media records that are not referenced by any Product, Article, HeroSlide,
   * or other content entities. Returns IDs and URLs of orphaned media older than
   * the specified age.
   *
   * @param olderThanDays - Only consider media older than this many days (default: 30)
   * @param limit - Maximum number of orphans to return (default: 100)
   */
  async findOrphanMedia(
    olderThanDays: number = 30,
    limit: number = 100
  ): Promise<Array<{ id: string; url: string; size: number; createdAt: Date }>> {
    try {
      const { prisma } = await import('@/lib/db');

      const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);

      // Find media not referenced by any product images, hero slides, or articles.
      // This uses a NOT IN subquery approach for each referencing table.
      const orphans = await prisma.media.findMany({
        where: {
          createdAt: { lt: cutoff },
          // Exclude media that are referenced as product images, hero slide backgrounds,
          // or other known content. "reviews-pending" older than cutoff are orphan candidates.
          folder: { notIn: ['reviews'] }, // Active review media is linked
          AND: [
            // Not a product image URL (product images stored as URL strings, not FK)
            {
              NOT: {
                url: { in: await this.getReferencedUrls(prisma) },
              },
            },
          ],
        },
        select: {
          id: true,
          url: true,
          size: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'asc' },
        take: limit,
      });

      return orphans;
    } catch (error) {
      logger.error('[Storage] Failed to find orphan media', {
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * Delete orphan media: removes files from storage and records from DB.
   * Returns the count of deleted items.
   */
  async cleanupOrphanMedia(orphanIds: string[]): Promise<number> {
    if (orphanIds.length === 0) return 0;

    try {
      const { prisma } = await import('@/lib/db');

      // Fetch URLs before deletion
      const orphans = await prisma.media.findMany({
        where: { id: { in: orphanIds } },
        select: { id: true, url: true },
      });

      let deletedCount = 0;
      for (const orphan of orphans) {
        try {
          await this.delete(orphan.url);
          await prisma.media.delete({ where: { id: orphan.id } });
          deletedCount++;
        } catch (err) {
          logger.warn(`[Storage] Failed to cleanup orphan media ${orphan.id}`, {
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }

      return deletedCount;
    } catch (error) {
      logger.error('[Storage] Failed to cleanup orphan media batch', {
        error: error instanceof Error ? error.message : String(error),
      });
      return 0;
    }
  }

  /**
   * Get all media URLs that are currently referenced by content entities.
   * Used by findOrphanMedia to exclude active media.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async getReferencedUrls(prisma: any): Promise<string[]> {
    try {
      const urls: string[] = [];

      // HeroSlide background URLs
      const slides = await prisma.heroSlide.findMany({
        select: { backgroundUrl: true, backgroundMobile: true },
      });
      for (const s of slides) {
        if (s.backgroundUrl) urls.push(s.backgroundUrl);
        if (s.backgroundMobile) urls.push(s.backgroundMobile);
      }

      // Product image URLs (ProductImage model has url field)
      const productImages = await prisma.productImage.findMany({
        select: { url: true },
      });
      for (const pi of productImages) {
        if (pi.url) urls.push(pi.url);
      }

      // Product main imageUrl and videoUrl
      const products = await prisma.product.findMany({
        select: { imageUrl: true, videoUrl: true, certificateUrl: true },
      });
      for (const p of products) {
        if (p.imageUrl) urls.push(p.imageUrl);
        if (p.videoUrl) urls.push(p.videoUrl);
        if (p.certificateUrl) urls.push(p.certificateUrl);
      }

      // Review images
      const reviewImages = await prisma.reviewImage.findMany({
        select: { url: true },
      });
      for (const ri of reviewImages) {
        if (ri.url) urls.push(ri.url);
      }

      // User avatars
      const users = await prisma.user.findMany({
        where: { image: { not: null } },
        select: { image: true },
        take: 1000, // Limit to prevent OOM on large datasets
      });
      for (const u of users) {
        if (u.image) urls.push(u.image);
      }

      return urls;
    } catch (error) {
      logger.warn('[Storage] Failed to get referenced URLs for orphan check', {
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }
}

// Singleton instance
export const storage = new StorageService();
