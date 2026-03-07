
import * as path from 'path';
import { BaseSectionAuditor, type SectionConfig } from './base-section-auditor';
import type { AuditCheckResult } from '@/lib/audit-engine';

export default class SectionMediaAuditor extends BaseSectionAuditor {
  auditTypeCode = 'SECTION-MEDIA';
  sectionConfig: SectionConfig = {
    sectionName: 'Media',
    adminPages: ['media'],
    apiRoutes: ['admin/media', 'admin/media/upload'],
    prismaModels: ['Media'],
    i18nNamespaces: ['admin.nav.media'],
  };

  // ── Angle 1: DB-First (media model field checks) ────────────────

  protected override async angle1_dbFirst(): Promise<AuditCheckResult[]> {
    const results = await super.angle1_dbFirst();
    const prefix = 'section-media-db';
    const schemaPath = path.join(this.rootDir, 'prisma', 'schema.prisma');
    const schema = this.readFile(schemaPath);

    const mediaBlock = this.extractModelBlock(schema, 'Media');
    if (mediaBlock) {
      // url or path field
      const hasUrl = /url\s+String|path\s+String|filePath\s+String/.test(mediaBlock);
      results.push(
        hasUrl
          ? this.pass(`${prefix}-url`, 'Media model has url/path field')
          : this.fail(`${prefix}-url`, 'CRITICAL', 'Media model missing url/path field',
              'The Media model must store the file location (url or path)',
              { filePath: 'prisma/schema.prisma', recommendation: 'Add `url String` to the Media model' })
      );

      // mimeType field
      const hasMimeType = /mimeType|mime_type|contentType/.test(mediaBlock);
      results.push(
        hasMimeType
          ? this.pass(`${prefix}-mimetype`, 'Media model has mimeType field')
          : this.fail(`${prefix}-mimetype`, 'HIGH', 'Media model missing mimeType field',
              'Media files need a MIME type for correct content-type headers and display logic',
              { filePath: 'prisma/schema.prisma', recommendation: 'Add `mimeType String` to the Media model' })
      );

      // size field
      const hasSize = /size\s+Int|size\s+BigInt|fileSize/.test(mediaBlock);
      results.push(
        hasSize
          ? this.pass(`${prefix}-size`, 'Media model has size field')
          : this.fail(`${prefix}-size`, 'MEDIUM', 'Media model missing file size field',
              'Storing file size enables quota management and display of file info',
              { filePath: 'prisma/schema.prisma', recommendation: 'Add `size Int` to the Media model' })
      );

      // alt text field
      const hasAlt = /alt\s+String|altText|alt_text/.test(mediaBlock);
      results.push(
        hasAlt
          ? this.pass(`${prefix}-alt`, 'Media model has alt text field')
          : this.fail(`${prefix}-alt`, 'MEDIUM', 'Media model missing alt text field',
              'Alt text is required for accessibility (screen readers) and SEO',
              { filePath: 'prisma/schema.prisma', recommendation: 'Add `alt String?` to the Media model' })
      );

      // Image optimization fields (width, height, thumbnailUrl)
      const hasWidth = /width\s+Int/.test(mediaBlock);
      const hasHeight = /height\s+Int/.test(mediaBlock);
      const hasThumbnail = /thumbnail|thumbnailUrl|thumb/.test(mediaBlock);
      const optimizationCount = [hasWidth, hasHeight, hasThumbnail].filter(Boolean).length;
      results.push(
        optimizationCount >= 2
          ? this.pass(`${prefix}-optimization`, 'Media model has image optimization fields')
          : this.fail(`${prefix}-optimization`, 'LOW', 'Media model lacks image optimization fields',
              `Only ${optimizationCount}/3 optimization fields found (width, height, thumbnailUrl). These enable responsive images and fast loading.`,
              { filePath: 'prisma/schema.prisma', recommendation: 'Add `width Int?`, `height Int?`, `thumbnailUrl String?` to Media' })
      );
    }

    return results;
  }

  // ── Angle 3: API Testing (upload validation, bulk delete, size limits) ──

  protected override async angle3_apiTesting(): Promise<AuditCheckResult[]> {
    const results = await super.angle3_apiTesting();
    const prefix = 'section-media-api';

    // Collect all media API route content
    const uploadRoutePath = path.join(this.srcDir, 'app', 'api', 'admin', 'media', 'upload', 'route.ts');
    const mediaRoutePath = path.join(this.srcDir, 'app', 'api', 'admin', 'media', 'route.ts');
    const mediaIdRoutePath = path.join(this.srcDir, 'app', 'api', 'admin', 'media', '[id]', 'route.ts');
    const uploadContent = this.readFile(uploadRoutePath);
    const mediaContent = this.readFile(mediaRoutePath) + this.readFile(mediaIdRoutePath);

    // File type validation on upload
    if (uploadContent) {
      const hasTypeValidation = /mimeType|contentType|image\/|video\/|application\/pdf|accept|allowedTypes|fileType/i.test(uploadContent);
      results.push(
        hasTypeValidation
          ? this.pass(`${prefix}-upload-types`, 'Upload API validates file types')
          : this.fail(`${prefix}-upload-types`, 'HIGH', 'Upload API missing file type validation',
              'The upload endpoint should validate MIME types to prevent uploading of dangerous file types',
              { filePath: 'src/app/api/admin/media/upload/route.ts', recommendation: 'Validate file.type against allowed MIME types (image/*, video/*, application/pdf)' })
      );

      // File size limits
      const hasSizeLimit = /maxSize|MAX_SIZE|size.*limit|content-length|fileSizeLimit|MAX_FILE_SIZE/i.test(uploadContent);
      results.push(
        hasSizeLimit
          ? this.pass(`${prefix}-upload-size-limit`, 'Upload API enforces file size limits')
          : this.fail(`${prefix}-upload-size-limit`, 'HIGH', 'Upload API missing file size limit',
              'Without a file size limit, users can upload arbitrarily large files and exhaust storage',
              { filePath: 'src/app/api/admin/media/upload/route.ts', recommendation: 'Add a MAX_FILE_SIZE check (e.g. 10MB) before processing the upload' })
      );
    }

    // Bulk delete support
    if (mediaContent) {
      const hasBulkDelete = /bulk|deleteMany|ids.*delete|delete.*ids|batch/i.test(mediaContent);
      results.push(
        hasBulkDelete
          ? this.pass(`${prefix}-bulk-delete`, 'Media API supports bulk delete')
          : this.fail(`${prefix}-bulk-delete`, 'MEDIUM', 'Media API missing bulk delete',
              'Admins need to delete multiple media files at once for library cleanup',
              { recommendation: 'Add a DELETE endpoint accepting an array of IDs for batch removal' })
      );
    }

    return results;
  }

  // ── Angle 5: State Testing (empty library, upload progress, preview) ──

  protected override async angle5_stateTesting(): Promise<AuditCheckResult[]> {
    const results = await super.angle5_stateTesting();
    const prefix = 'section-media-state';

    const mediaPagePath = path.join(this.srcDir, 'app', 'admin', 'media', 'page.tsx');
    const mediaContent = this.readFile(mediaPagePath);
    if (!mediaContent) return results;

    // Empty library state
    const hasEmptyLibrary = /empty|no media|no files|aucun|\.length\s*===?\s*0|NoMedia|EmptyState/i.test(mediaContent);
    results.push(
      hasEmptyLibrary
        ? this.pass(`${prefix}-empty-library`, 'Media page handles empty library state')
        : this.fail(`${prefix}-empty-library`, 'MEDIUM', 'Media page missing empty library state',
            'When no media files exist, the page should show an empty state with an upload prompt',
            { filePath: 'src/app/admin/media/page.tsx', recommendation: 'Show an illustration and "Upload your first file" CTA when library is empty' })
    );

    // Upload progress indicator
    const hasUploadProgress = /progress|uploading|upload.*progress|percent|ProgressBar|onUploadProgress/i.test(mediaContent);
    results.push(
      hasUploadProgress
        ? this.pass(`${prefix}-upload-progress`, 'Media page has upload progress indicator')
        : this.fail(`${prefix}-upload-progress`, 'MEDIUM', 'Media page missing upload progress indicator',
            'Large file uploads need a progress bar so users know the upload is working',
            { filePath: 'src/app/admin/media/page.tsx', recommendation: 'Add a progress bar or percentage display during file upload' })
    );

    // Image preview / lightbox
    const hasPreview = /preview|lightbox|fullscreen|zoom|enlarge|modal.*image|ImagePreview|Dialog.*img/i.test(mediaContent);
    results.push(
      hasPreview
        ? this.pass(`${prefix}-preview`, 'Media page has image preview/lightbox')
        : this.fail(`${prefix}-preview`, 'LOW', 'Media page missing image preview/lightbox',
            'Users should be able to click a thumbnail to see the full-size image in a lightbox or modal',
            { filePath: 'src/app/admin/media/page.tsx', recommendation: 'Add a click-to-enlarge lightbox or modal for image previews' })
    );

    return results;
  }
}
