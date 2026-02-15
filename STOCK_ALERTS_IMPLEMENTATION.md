# Back-in-Stock Notification System

## Overview

The Back-in-Stock Notification system allows customers to subscribe to email alerts when out-of-stock products become available again. This feature improves customer experience and helps recover potentially lost sales.

## Implementation Details

### Database Schema

A new `StockAlert` model was added to the Prisma schema:

```prisma
model StockAlert {
  id         String    @id @default(cuid())
  email      String
  productId  String
  formatId   String?   // Optional - for specific product formats
  notified   Boolean   @default(false)
  notifiedAt DateTime?
  createdAt  DateTime  @default(now())
  product    Product   @relation(fields: [productId], references: [id], onDelete: Cascade)

  @@unique([email, productId, formatId])
  @@index([productId, notified])
  @@index([email])
}
```

**Key Features:**
- Unique constraint ensures one alert per email/product/format combination
- Indexes optimize queries for notification processing
- Cascade delete when product is deleted

### API Endpoints

#### 1. Subscribe to Stock Alerts
**POST** `/api/stock-alerts`

Request body:
```json
{
  "email": "customer@example.com",
  "productId": "product_123",
  "formatId": "format_456" // optional
}
```

Response:
```json
{
  "success": true,
  "message": "You will be notified when this product is back in stock",
  "alertId": "alert_789"
}
```

Features:
- Email validation using Zod
- Product/format existence verification
- Idempotent (upsert) - safe to call multiple times
- Resets notification status if user re-subscribes

#### 2. Check Subscription Status
**GET** `/api/stock-alerts?email=...&productId=...&formatId=...`

Response:
```json
{
  "subscribed": true,
  "notified": false
}
```

#### 3. Process Stock Alerts (Cron Job)
**POST** `/api/cron/stock-alerts`

Authentication: Requires `CRON_SECRET` in `Authorization: Bearer <token>` header

Response:
```json
{
  "success": true,
  "processed": 25,
  "sent": 20,
  "errors": 0,
  "message": "Processed 25 alerts, sent 20 emails, 0 errors"
}
```

Features:
- Batch processing (100 alerts per run, 10 emails per batch)
- Checks both product-level and format-level stock
- Sends notification email when stock > 0
- Marks alerts as notified with timestamp
- Rate limiting between batches (1 second delay)

**GET** `/api/cron/stock-alerts` - Health check endpoint

### Frontend Components

#### StockAlertButton Component

Located at: `/src/components/shop/StockAlertButton.tsx`

**Props:**
- `productId`: string - Product ID
- `formatId`: string (optional) - Specific format ID
- `productName`: string - Product name for display
- `formatName`: string (optional) - Format name for display

**Features:**
- Pre-fills email from user session if logged in
- Email validation
- Success/error feedback via Sonner toasts
- Visual confirmation when subscribed
- Fully translated (i18n)

**Integration:**
The component is integrated into `ProductPageClient.tsx` and displays when a product or format is out of stock (`!selectedFormat.inStock`).

### Email Template

Function: `backInStockEmail()` in `/src/lib/email-templates.ts`

**Features:**
- Fully responsive HTML email
- Multi-language support (FR, EN, ES)
- Product image (if available)
- Direct link to product page
- Price display
- Professional branding

**Email Subject:**
- EN: "🔔 {Product Name} is back in stock!"
- FR: "🔔 {Product Name} est de nouveau disponible!"
- ES: "🔔 {Product Name} ¡está de nuevo en stock!"

### Translations

Added to both `/src/i18n/locales/en.json` and `/src/i18n/locales/fr.json`:

```json
"stockAlert": {
  "title": "Notify Me When Available",
  "description": "Get notified by email when this product is back in stock.",
  "emailPlaceholder": "your@email.com",
  "notifyMe": "Notify Me",
  "success": "You'll be notified when this product is back in stock!",
  "error": "Failed to subscribe. Please try again.",
  "subscribed": "You'll be notified!",
  "subscribedMessage": "We'll send you an email when this product is back in stock."
}
```

## Setup & Configuration

### 1. Environment Variables

Add to `.env`:
```env
CRON_SECRET=your_secure_random_secret_here
```

### 2. Database Migration

The schema was already pushed using:
```bash
npx prisma db push
```

### 3. Cron Job Setup

Set up a scheduled task to call the cron endpoint. Options:

#### Option A: Vercel Cron (Recommended for Vercel deployments)

Add to `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/cron/stock-alerts",
      "schedule": "0 * * * *"
    }
  ]
}
```

#### Option B: External Cron Service (e.g., cron-job.org, EasyCron)

Configure:
- URL: `https://yourdomain.com/api/cron/stock-alerts`
- Method: POST
- Schedule: Every hour (or as needed)
- Headers: `Authorization: Bearer YOUR_CRON_SECRET`

#### Option C: Manual Testing

```bash
curl -X POST https://yourdomain.com/api/cron/stock-alerts \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

### 4. Email Service

Ensure one of the following is configured in `.env`:

```env
# Option 1: Resend (Recommended)
EMAIL_PROVIDER=resend
RESEND_API_KEY=your_resend_api_key

# Option 2: SendGrid
EMAIL_PROVIDER=sendgrid
SENDGRID_API_KEY=your_sendgrid_api_key

# Option 3: Development (logs to console)
EMAIL_PROVIDER=log
```

## Usage Flow

1. **Customer visits out-of-stock product page**
   - StockAlertButton component displays
   - Customer enters email address
   - Clicks "Notify Me"

2. **Alert is created**
   - API validates email and product
   - Creates StockAlert record in database
   - Returns success confirmation

3. **Product is restocked**
   - Admin updates product inventory
   - Stock quantity > 0

4. **Cron job runs (hourly)**
   - Finds all non-notified alerts
   - Checks if products are back in stock
   - Sends notification emails
   - Marks alerts as notified

5. **Customer receives email**
   - Notification with product details
   - Direct link to product page
   - Customer can purchase product

## Testing

### Test Subscription
1. Navigate to an out-of-stock product
2. Enter email in StockAlertButton
3. Click "Notify Me"
4. Check database: `SELECT * FROM "StockAlert" WHERE email = 'test@example.com';`

### Test Notification
1. Update product stock: `UPDATE "ProductFormat" SET "stockQuantity" = 10, "inStock" = true WHERE id = 'format_id';`
2. Manually trigger cron: `curl -X POST http://localhost:3000/api/cron/stock-alerts -H "Authorization: Bearer YOUR_CRON_SECRET"`
3. Check email logs or inbox
4. Verify alert is marked notified: `SELECT * FROM "StockAlert" WHERE "notified" = true;`

### Health Check
```bash
curl http://localhost:3000/api/cron/stock-alerts
```

Expected response:
```json
{
  "status": "healthy",
  "pendingAlerts": 5,
  "totalAlerts": 20,
  "timestamp": "2024-02-15T10:30:00.000Z"
}
```

## Performance Considerations

- **Batch Processing**: Processes 100 alerts per cron run to avoid timeouts
- **Email Rate Limiting**: Sends emails in batches of 10 with 1-second delays
- **Database Indexes**: Optimized for product/notified lookups
- **Idempotent API**: Safe to resubscribe without duplicates

## Future Enhancements

Potential improvements:
- [ ] SMS notifications option
- [ ] User preference for notification timing
- [ ] Multi-language email detection from user locale
- [ ] Unsubscribe functionality
- [ ] Admin dashboard to view pending alerts
- [ ] Analytics on conversion rate from stock alerts
- [ ] Automatic cleanup of old notified alerts (>90 days)

## Files Modified/Created

### Created:
- `/prisma/schema.prisma` - Added StockAlert model
- `/src/app/api/stock-alerts/route.ts` - Subscribe API
- `/src/app/api/cron/stock-alerts/route.ts` - Cron job
- `/src/components/shop/StockAlertButton.tsx` - UI component
- `/src/lib/email-templates.ts` - Added backInStockEmail()

### Modified:
- `/src/app/(shop)/product/[slug]/ProductPageClient.tsx` - Integrated StockAlertButton
- `/src/i18n/locales/en.json` - Added translations
- `/src/i18n/locales/fr.json` - Added translations

## Support

For issues or questions, check:
- Logs: `console.log` statements in cron job
- Database: Check StockAlert table
- Email service: Verify EMAIL_PROVIDER configuration
- Cron secret: Ensure CRON_SECRET is set and matches
