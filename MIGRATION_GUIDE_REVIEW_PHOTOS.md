# Migration Guide: Review Photos Feature

## Quick Start

This feature adds photo upload capability to the review system. Customers can now upload up to 3 photos with their product reviews.

## 1. Database Migration

The database schema has been updated. Run:

```bash
npx prisma db push
```

This adds:
- `ReviewImage` table (id, reviewId, url, alt, order, createdAt)
- `Review.images` relation (one-to-many)

**Rollback**: If needed, remove `ReviewImage` model and `images` field from `Review` model in `schema.prisma`, then run `npx prisma db push` again.

## 2. File System Setup

The upload directory has been created at `/public/uploads/reviews/`.

Verify it exists and is writable:

```bash
# Check directory exists
ls -la public/uploads/reviews/

# Test write permissions (should succeed)
touch public/uploads/reviews/.test && rm public/uploads/reviews/.test
```

If directory doesn't exist or isn't writable:

```bash
mkdir -p public/uploads/reviews
chmod 755 public/uploads/reviews
```

## 3. Verify Installation

Run the verification script:

```bash
node verify-review-photos.js
```

All checks should pass (green checkmarks).

## 4. Test the Feature

### Test as Customer

1. Go to any product page
2. Click "Write a Review"
3. Fill in rating, title, and review text
4. Click the image upload area or drag images
5. Upload 1-3 images (JPG, PNG, or WebP, max 5MB each)
6. Submit the review
7. See success message (review pending admin approval)

### Test as Admin

1. Go to Admin Panel > Avis (Reviews)
2. See the new review with "With Photos" badge
3. See photo thumbnails in the review card
4. Click "Approve" to publish the review
5. Go back to the product page
6. Click "With Photos" filter
7. See your review with the uploaded images
8. Click an image to open the lightbox gallery

## 5. Configuration

### Adjust Upload Limits

Edit `/src/app/api/reviews/upload/route.ts`:

```typescript
const MAX_FILE_SIZE = 5 * 1024 * 1024; // Change to your preferred max size
const MAX_IMAGES = 3; // Change max number of images
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']; // Add/remove types
```

Also update `/src/components/shop/ReviewImageUpload.tsx` to match.

### Server Configuration

**Next.js** (next.config.js):
```javascript
module.exports = {
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb', // Increase if needed
    },
  },
};
```

**Nginx** (if using):
```nginx
client_max_body_size 10M;
```

## 6. Environment-Specific Setup

### Development
- No additional setup needed
- Images stored in `/public/uploads/reviews/`
- Directory in `.gitignore` (images not committed)

### Staging/Production
- Ensure upload directory exists and is writable
- Set up backup strategy for uploads directory
- Consider CDN for image serving (future)
- Monitor disk space usage
- Optionally move to cloud storage (S3, Cloudinary)

## 7. Backup Strategy

Add uploads directory to your backup routine:

```bash
# Example backup command
tar -czf backups/uploads-$(date +%Y%m%d).tar.gz public/uploads/
```

Or configure your backup tool to include `/public/uploads/`.

## 8. Monitoring

### Things to Monitor

1. **Disk Usage**: `/public/uploads/reviews/` directory size
2. **Upload Errors**: Check API logs for failed uploads
3. **File Count**: Number of images vs. ReviewImage records
4. **Orphaned Files**: Images without database records

### Quick Health Check

```bash
# Count uploaded files
ls -1 public/uploads/reviews/*.{jpg,png,webp} 2>/dev/null | wc -l

# Check total size
du -sh public/uploads/reviews/

# Database image count (in psql)
SELECT COUNT(*) FROM "ReviewImage";
```

## 9. Troubleshooting

### Issue: "Failed to upload images"

**Check:**
1. Directory exists: `ls public/uploads/reviews/`
2. Directory is writable: `ls -la public/uploads/`
3. Disk space available: `df -h`
4. User is authenticated (logged in)
5. File size < 5MB
6. File type is JPG, PNG, or WebP
7. Max 3 images selected

### Issue: Images not displaying

**Check:**
1. Image URL in database: `SELECT url FROM "ReviewImage" LIMIT 5;`
2. File exists: `ls public/uploads/reviews/review_*.jpg`
3. File permissions: `ls -la public/uploads/reviews/`
4. Next.js serving static files correctly
5. Browser console for 404 errors

### Issue: Review submitted but no images

**Check:**
1. Images uploaded before review creation
2. `imageUrls` passed to `/api/reviews` endpoint
3. ReviewImage records created in database
4. No JavaScript errors in console

### Issue: Admin can't see images

**Check:**
1. Admin API includes images relation
2. Admin component has Image import from next/image
3. Browser network tab shows images loading
4. Image URLs are correct in API response

## 10. Security Considerations

### Implemented Security

✅ File type validation (whitelist)
✅ File size limits
✅ Authentication required
✅ Safe filename generation (no user input)
✅ Directory isolation (/uploads/reviews/ only)

### Additional Security (Optional)

Consider adding:
- EXIF data stripping (privacy)
- Image content scanning (NSFW detection)
- Rate limiting on uploads
- Virus scanning for uploaded files
- Image optimization/conversion server-side

## 11. Performance Optimization (Future)

### Current State
- Images served from `/public/` (static)
- No compression or optimization
- No CDN
- No caching headers

### Future Improvements
1. **Image Optimization**: Auto-resize and compress
2. **CDN**: Cloudflare, Cloudinary, or Vercel Image Optimization
3. **Lazy Loading**: Already using Next.js Image (built-in)
4. **WebP Conversion**: Convert all to WebP server-side
5. **Thumbnail Generation**: Multiple sizes for responsive images

## 12. API Documentation

### POST /api/reviews/upload

Upload images for a review.

**Auth**: Required
**Content-Type**: multipart/form-data
**Max files**: 3
**Max size**: 5MB per file
**Formats**: JPG, PNG, WebP

**Example**:
```bash
curl -X POST http://localhost:3000/api/reviews/upload \
  -H "Cookie: next-auth.session-token=..." \
  -F "images=@photo1.jpg" \
  -F "images=@photo2.png"
```

**Response**:
```json
{
  "urls": [
    "/uploads/reviews/review_1708012345_abc123.jpg",
    "/uploads/reviews/review_1708012346_def456.png"
  ]
}
```

### POST /api/reviews

Submit a review with images.

**Auth**: Required
**Content-Type**: application/json

**Body**:
```json
{
  "productId": "clx...",
  "rating": 5,
  "title": "Amazing product!",
  "comment": "This peptide is fantastic...",
  "imageUrls": [
    "/uploads/reviews/review_1708012345_abc123.jpg",
    "/uploads/reviews/review_1708012346_def456.png"
  ]
}
```

**Response**:
```json
{
  "message": "Review submitted successfully. It will be published after admin approval.",
  "reviewId": "clx..."
}
```

### GET /api/reviews?productId=X&withPhotos=true

Fetch reviews for a product.

**Auth**: Not required (public approved reviews)

**Query Params**:
- `productId` (required): Product ID
- `withPhotos` (optional): true/false - Filter reviews with photos only

**Example**:
```bash
curl http://localhost:3000/api/reviews?productId=clx123&withPhotos=true
```

**Response**:
```json
{
  "reviews": [
    {
      "id": "clx...",
      "userId": "clx...",
      "userName": "John Doe",
      "rating": 5,
      "title": "Great product",
      "content": "I love this peptide...",
      "images": [
        "/uploads/reviews/review_1708012345_abc123.jpg",
        "/uploads/reviews/review_1708012346_def456.png"
      ],
      "verified": true,
      "helpful": 5,
      "createdAt": "2024-02-15T12:00:00Z",
      "response": null
    }
  ]
}
```

## 13. Rollback Procedure

If you need to remove this feature:

### 1. Database Rollback

```prisma
// In schema.prisma, remove:
model ReviewImage { ... }

// And remove from Review model:
images ReviewImage[]
```

Then run:
```bash
npx prisma db push
```

### 2. File Removal

```bash
# Optional: backup first
tar -czf review-images-backup.tar.gz public/uploads/reviews/

# Remove files
rm -rf public/uploads/reviews/

# Remove API routes
rm -rf src/app/api/reviews/upload/
rm src/app/api/reviews/route.ts

# Remove components
rm src/components/shop/ReviewImageUpload.tsx
rm src/components/shop/ReviewImageGallery.tsx

# Restore original ProductReviews.tsx from git
git checkout src/components/shop/ProductReviews.tsx

# Restore original admin reviews page
git checkout src/app/admin/avis/page.tsx
```

### 3. Restore Admin API

```bash
git checkout src/app/api/admin/reviews/route.ts
```

## 14. Support

For issues or questions:

1. Check the troubleshooting section above
2. Review error logs in browser console and server
3. Verify all files exist (run verify-review-photos.js)
4. Check database schema matches expected structure
5. Ensure upload directory has correct permissions

## 15. Future Enhancements

Planned improvements:
- [ ] Cloud storage integration (S3/Cloudinary)
- [ ] Automatic image optimization
- [ ] Video review support
- [ ] Image moderation/filtering
- [ ] Bulk image upload for existing reviews
- [ ] Image analytics (view tracking)
- [ ] User image galleries
- [ ] Image compression before upload (client-side)
- [ ] Progressive image loading
- [ ] Cleanup cron job for orphaned images

## Summary

✅ Database schema updated
✅ Upload directory created
✅ API endpoints implemented
✅ UI components created
✅ Admin panel updated
✅ Security validated
✅ Documentation complete

**Status**: Ready for testing and deployment
