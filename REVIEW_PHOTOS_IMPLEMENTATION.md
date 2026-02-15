# Review Photos Implementation

## Overview
Enhanced the review system to allow customers to upload up to 3 photos with their product reviews. Images are stored locally in the filesystem and referenced in the database.

## Database Changes

### New Model: ReviewImage
```prisma
model ReviewImage {
  id        String   @id @default(cuid())
  reviewId  String
  url       String
  alt       String?
  order     Int      @default(0)
  review    Review   @relation(fields: [reviewId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())

  @@index([reviewId])
}
```

### Updated Model: Review
- Added `images ReviewImage[]` relationship

**Migration**: Run `npx prisma db push` (already completed)

## New Files Created

### 1. `/src/app/api/reviews/upload/route.ts`
Image upload API endpoint:
- **Method**: POST (multipart/form-data)
- **Auth**: Required
- **Max files**: 3 images per request
- **Max size**: 5MB per image
- **Formats**: JPG, PNG, WebP
- **Storage**: `/public/uploads/reviews/`
- **Returns**: Array of image URLs

### 2. `/src/app/api/reviews/route.ts`
Customer review submission API:
- **GET**: Fetch approved reviews for a product
  - Query params: `productId`, `withPhotos` (filter)
  - Returns reviews with image URLs
- **POST**: Submit new review with images
  - Validates user authentication
  - Checks for duplicate reviews
  - Verifies purchase for badge
  - Creates review with associated images
  - Requires admin approval before publishing

### 3. `/src/components/shop/ReviewImageUpload.tsx`
Drag-and-drop image upload component:
- Drag & drop zone
- Click to browse files
- Image preview thumbnails
- Remove button on each preview
- File validation (type, size)
- Max 3 images indicator
- User-friendly error messages

### 4. `/src/components/shop/ReviewImageGallery.tsx`
Review image display component:
- Thumbnail grid display
- Click to open lightbox
- Full-size image viewer
- Previous/Next navigation
- Keyboard controls (ESC, arrows)
- Photo count badge

## Updated Files

### 1. `/src/components/shop/ProductReviews.tsx`
Enhanced review form and display:
- Integrated ReviewImageUpload component
- Added image upload before review submission
- Displays ReviewImageGallery for reviews with photos
- Added "With Photos" filter toggle
- Real API integration for fetching reviews
- Shows loading state and empty states
- Toast notifications for errors

### 2. `/src/app/api/admin/reviews/route.ts`
Updated to include images in response:
- Added `images` relationship to query
- Returns image URLs in review data

### 3. `/src/app/admin/avis/page.tsx`
Admin review management with photos:
- Display review images as thumbnails
- Show photo count in stats
- Display images in review modal
- Added Camera icon and "With Photos" stat card

### 4. `/prisma/schema.prisma`
Added ReviewImage model and relationship

### 5. `/.gitignore`
Added `public/uploads/` to ignore uploaded files

## File Structure
```
public/
  uploads/
    reviews/
      .gitkeep              # Ensures directory exists in git
      README.md             # Documentation
      review_*.{jpg,png,webp}  # Uploaded images (gitignored)

src/
  app/
    api/
      reviews/
        route.ts            # Customer review API (GET/POST)
        upload/
          route.ts          # Image upload API
      admin/
        reviews/
          route.ts          # Admin review list (updated)
          [id]/
            route.ts        # Admin review actions
            respond/
              route.ts      # Admin response API

  components/
    shop/
      ProductReviews.tsx    # Main review component (updated)
      ReviewImageUpload.tsx # Image upload component (new)
      ReviewImageGallery.tsx # Image gallery component (new)
```

## Features

### Customer Features
1. **Upload Photos**: Up to 3 photos per review
2. **Drag & Drop**: Intuitive file upload interface
3. **Preview**: See images before submitting
4. **Validation**: Automatic file type and size validation
5. **View Photos**: Click thumbnails to view full-size in lightbox
6. **Filter**: Toggle to show only reviews with photos
7. **Gallery Navigation**: Keyboard and click navigation

### Admin Features
1. **View Photos**: See customer-uploaded photos in review list
2. **Photo Count**: Dashboard stat showing reviews with photos
3. **Moderation**: Photos visible when reviewing/approving
4. **Auto-delete**: Images cascade delete when review is deleted

## Technical Details

### Image Upload Flow
1. User selects images via ReviewImageUpload component
2. Images validated client-side (type, size, count)
3. On review submit:
   - Images uploaded first to `/api/reviews/upload`
   - Returns array of URLs
   - Review created with image URLs at `/api/reviews`
   - ReviewImage records created with order
4. Admin approves/rejects review
5. Approved reviews display images in ProductReviews

### Security
- Authentication required for uploads
- File type whitelist (JPG, PNG, WebP only)
- File size limit (5MB per image)
- Max 3 images per review
- Server-side validation
- No directory traversal (safe filenames)

### Performance
- Images served from `/public/uploads/` (static)
- Thumbnails generated client-side via Next.js Image
- Lazy loading via Next.js Image component
- Optimized queries (includes only when needed)

### Storage
- **Location**: `/public/uploads/reviews/`
- **Filename**: `review_{timestamp}_{random}.{ext}`
- **Access**: Public via `/uploads/reviews/`
- **Backup**: Not in git (add to backup strategy)

## Configuration

### Maximum Values
```typescript
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_IMAGES = 3;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
```

### Adjust in Files
- `/src/app/api/reviews/upload/route.ts`
- `/src/components/shop/ReviewImageUpload.tsx`

## Database Queries

### Get Reviews with Images
```typescript
const reviews = await prisma.review.findMany({
  where: { productId, isApproved: true },
  include: {
    images: { orderBy: { order: 'asc' } },
    user: { select: { id: true, name: true } },
  },
});
```

### Create Review with Images
```typescript
const review = await prisma.review.create({
  data: {
    userId, productId, rating, title, comment,
    images: {
      create: imageUrls.map((url, index) => ({
        url,
        order: index,
      })),
    },
  },
});
```

### Delete Review (cascades to images)
```typescript
await prisma.review.delete({ where: { id } });
// ReviewImage records auto-deleted via onDelete: Cascade
```

## API Endpoints

### POST /api/reviews/upload
Upload review images (authenticated)
```bash
curl -X POST /api/reviews/upload \
  -H "Cookie: next-auth.session-token=..." \
  -F "images=@photo1.jpg" \
  -F "images=@photo2.jpg"
```

Response:
```json
{
  "urls": [
    "/uploads/reviews/review_1708012345_a1b2c3.jpg",
    "/uploads/reviews/review_1708012345_d4e5f6.jpg"
  ]
}
```

### POST /api/reviews
Submit review with images (authenticated)
```bash
curl -X POST /api/reviews \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=..." \
  -d '{
    "productId": "...",
    "rating": 5,
    "title": "Great product!",
    "comment": "I love this peptide...",
    "imageUrls": ["/uploads/reviews/review_...jpg"]
  }'
```

### GET /api/reviews?productId=X&withPhotos=true
Fetch reviews (public for approved reviews)
```bash
curl /api/reviews?productId=abc123&withPhotos=true
```

## Future Enhancements

### Potential Improvements
1. **Image Optimization**: Auto-resize/compress on upload
2. **Cloud Storage**: Move to S3/Cloudinary for scalability
3. **Image Moderation**: AI-powered content filtering
4. **Multiple Sizes**: Generate thumbnails server-side
5. **CDN**: Serve images via CDN for performance
6. **Cleanup Job**: Cron to remove orphaned images
7. **Analytics**: Track which reviews get more engagement with photos
8. **Video Support**: Allow short video reviews
9. **Image Captions**: Let users add alt text to images
10. **Compression**: Client-side compression before upload

### Known Limitations
1. Local filesystem storage (not cloud-ready)
2. No automatic image optimization
3. No thumbnail generation
4. No orphaned file cleanup
5. No image moderation/filtering
6. No EXIF data stripping (privacy)

## Testing

### Manual Testing Checklist
- [ ] Upload 1 image with review
- [ ] Upload 3 images (max)
- [ ] Try uploading 4 images (should error)
- [ ] Upload file > 5MB (should error)
- [ ] Upload non-image file (should error)
- [ ] Submit review without images (should work)
- [ ] View review with images in customer view
- [ ] Click image to open lightbox
- [ ] Navigate with keyboard in lightbox
- [ ] Filter reviews by "With Photos"
- [ ] Admin: View review with images
- [ ] Admin: Delete review (images should cascade delete)
- [ ] Test drag & drop upload
- [ ] Test remove image before submit

### Test Users
- Create test customer account
- Submit reviews with various image combinations
- Check admin panel displays correctly

## Deployment Checklist

### Before Deploying
- [x] Database schema updated (prisma db push)
- [x] Upload directory created (`/public/uploads/reviews/`)
- [x] .gitignore updated
- [x] API routes have `export const dynamic = 'force-dynamic';`
- [ ] Test on staging environment
- [ ] Configure upload limits in production
- [ ] Set up backup strategy for uploads directory
- [ ] Consider cloud storage migration plan
- [ ] Test with real images and file sizes
- [ ] Check mobile responsiveness
- [ ] Verify image loading performance
- [ ] Test concurrent uploads
- [ ] Verify disk space monitoring

### Production Notes
- Ensure `/public/uploads/reviews/` has write permissions
- Monitor disk usage (images not in git)
- Consider max upload directory size limits
- Add to backup/restore procedures
- Configure CDN if needed
- Set up image cleanup cron job

## Support

### Common Issues

**Q: Images not showing after upload**
A: Check file permissions on `/public/uploads/reviews/` directory

**Q: Upload fails with 413 error**
A: Check server body size limits (nginx, Next.js config)

**Q: Images lost after deployment**
A: Uploads directory not included in deployments (expected)

**Q: Can't upload certain image types**
A: Only JPG, PNG, and WebP are supported

**Q: Too many images in directory**
A: Implement cleanup script for orphaned images

## Maintenance

### Regular Tasks
1. Monitor disk usage of uploads directory
2. Check for orphaned images (no ReviewImage record)
3. Verify upload permissions
4. Review error logs for failed uploads
5. Consider archiving old review images

### Cleanup Script (Future)
```typescript
// Find orphaned images not in database
// Delete files older than X days with no review
// Log cleanup activities
```

## License & Credits
Implemented for BioCycle Peptides+ e-commerce platform.
