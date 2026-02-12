# Comprehensive Azure Communication & Notification Strategy for E-Commerce

## Table of Contents

1. [Azure Communication Services Email](#1-azure-communication-services-email)
2. [SendGrid on Azure](#2-sendgrid-on-azure)
3. [Microsoft 365 / Exchange Online SMTP Relay](#3-microsoft-365--exchange-online-smtp-relay)
4. [Azure Notification Hubs](#4-azure-notification-hubs)
5. [Azure Service Bus for Email Processing](#5-azure-service-bus-for-email-processing)
6. [Email Deliverability](#6-email-deliverability)
7. [E-Commerce Notification Patterns](#7-e-commerce-notification-patterns)
8. [Pricing Comparison Matrix](#8-pricing-comparison-matrix)
9. [Recommended Architecture](#9-recommended-architecture)

---

## 1. Azure Communication Services Email

### Setup and Configuration

Azure Communication Services (ACS) Email requires two separate Azure resources:

1. **Communication Services resource** -- the main ACS resource
2. **Email Communication resource** -- a separate resource specifically for email capabilities

**Provisioning via Azure CLI:**
```bash
az communication email create \
  --name "<EmailServiceName>" \
  --location "Global" \
  --data-location "United States" \
  --resource-group "<resourceGroup>"
```

**SMTP Configuration:**
- Server: `smtp.azurecomm.net`
- Port: `587` (STARTTLS)
- Authentication: Microsoft Entra application service principals (OAuth2-based)
- Username format: `<ACS_RESOURCE_NAME>.<APP_ID>.<TENANT_ID>`

**Node.js SDK integration** uses the `@azure/communication-email` package:
```javascript
import { EmailClient } from "@azure/communication-email";

const client = new EmailClient("<connection-string>");
const message = {
  senderAddress: "notify@yourdomain.com",
  content: {
    subject: "Order Confirmation",
    html: "<html>...</html>",
    plainText: "Your order has been confirmed."
  },
  recipients: {
    to: [{ address: "customer@example.com", displayName: "Customer" }]
  }
};
const poller = await client.beginSend(message);
const result = await poller.pollUntilDone();
```

### Custom Domains for Transactional Email

Two domain options:

| Feature | Azure-Managed Domain | Custom Domain |
|---------|---------------------|---------------|
| Format | `xxxxxxxx-xxxx.azurecomm.net` | `notify.yourdomain.com` |
| Setup | One-click provisioning | DNS verification required |
| SPF/DKIM | Auto-configured | Manual DNS records needed |
| Sender addresses | `donotreply@...` | Any address on your domain |
| Rate limits | 5/min, 10/hour (hard cap) | 30/min, 100/hour (expandable) |
| Quota increase | Not available | Available via support request |
| Cost for domain | Free | Free (no extra licensing) |

Custom domains require adding DNS records for DKIM (two selectors: DKIM and DKIM2) and SPF. There is no extra licensing cost for multiple domains or sender addresses.

### Email Templates

ACS Email does **not** include a built-in template engine like SendGrid's dynamic templates. You must manage templates at the application level using:
- Server-side template engines (Handlebars, EJS, Pug)
- HTML email frameworks (MJML, Foundation for Emails)
- A custom template store in your database

This is a notable gap compared to SendGrid and means you must build your own template management layer.

### Delivery Tracking and Analytics

ACS provides robust delivery tracking:

**Delivery Statuses:** Delivered, Expanded, Failed, Quarantined, FilteredSpam, Suppressed, Bounced

**Engagement Tracking:** Open tracking and click tracking are supported and can be enabled.

**Monitoring Options:**
- **Insights Dashboard** -- built-in email analytics in the Azure portal
- **Email Logs** -- request-level logs with message ID and recipient info
- **Azure Event Grid** -- subscribe to `EmailDeliveryReportReceived` and `EmailEngagementTrackingReportReceived` events
- **Azure Monitor** -- diagnostic settings for operational logs

**Event Grid Events:**
- `EmailDeliveryReportReceived` -- fires when email reaches terminal state (Delivered, Failed, etc.)
- `EmailEngagementTrackingReportReceived` -- fires on open or link click

### Pricing

| Component | Cost |
|-----------|------|
| Per email sent | $0.00025 |
| Data transferred | $0.00012/MB |

**Example calculation for 100,000 emails/month at 50KB average:**
- Messages: 100,000 x $0.00025 = **$25.00**
- Data: 100,000 x 0.05MB x $0.00012 = **$0.60**
- **Total: ~$25.60/month**

### Rate Limits (Default)

| Scope | Custom Domain | Azure-Managed Domain |
|-------|--------------|---------------------|
| Per minute | 30 emails | 5 emails |
| Per hour | 100 emails | 10 emails |
| Max recipients per email | 50 | 50 |
| Max email size | 10 MB (7.5 MB effective with Base64) | 10 MB |
| Max concurrent SMTP connections | 250 | 250 |

Higher limits (up to 1-2 million messages/hour) are available for custom domains via support request, provided your failure rate is below 1%.

---

## 2. SendGrid on Azure

### Azure Marketplace Integration

SendGrid (now Twilio SendGrid) is available on the [Azure Marketplace](https://azuremarketplace.microsoft.com/en-us/marketplace/apps/sendgrid.tsg-saas-offer) as a SaaS offering. Integration is straightforward -- provision from the marketplace, obtain an API key, and start sending.

### Free Tier Status (CRITICAL UPDATE)

**As of July 26, 2025, SendGrid has eliminated its free tier entirely.** Any accounts not upgraded by the deadline were automatically paused. This is a significant change for budget-conscious e-commerce projects.

**Current paid plans:**
| Plan | Price | Emails/Month | Key Features |
|------|-------|-------------|--------------|
| Essentials | ~$20/mo | 50,000 | Basic API, SMTP, webhooks |
| Pro | ~$90/mo | 100,000 | Dedicated IP, sub-user management, advanced analytics |
| Premier | Custom | Custom | All features, priority support |

### Template Engine

SendGrid's Dynamic Transactional Templates use **Handlebars.js** syntax:

```javascript
// Node.js SendGrid integration with dynamic template
const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const msg = {
  to: 'customer@example.com',
  from: 'orders@yourstore.com',
  templateId: 'd-xxxxxxxxxxxx',
  dynamicTemplateData: {
    orderNumber: 'ORD-12345',
    customerName: 'John Doe',
    items: [
      { name: 'Product A', qty: 2, price: '$29.99' },
      { name: 'Product B', qty: 1, price: '$49.99' }
    ],
    totalAmount: '$109.97'
  }
};
await sgMail.send(msg);
```

Template features include:
- `{{variable}}` substitution
- `{{#each items}}...{{/each}}` iteration
- `{{#if condition}}...{{/if}}` conditionals
- Partials and helpers
- Visual drag-and-drop editor in the dashboard

### Event Webhooks

SendGrid Event Webhooks deliver near-real-time POST requests for email events:

**Delivery Events:**
| Event | Description |
|-------|-------------|
| `processed` | Email accepted by SendGrid |
| `dropped` | Email rejected (suppression, invalid) |
| `delivered` | Email accepted by recipient server |
| `deferred` | Temporary delivery failure, will retry |
| `bounce` | Permanent delivery failure |

**Engagement Events:**
| Event | Description |
|-------|-------------|
| `open` | Recipient opened HTML email |
| `click` | Recipient clicked a link |
| `spam_report` | Recipient marked as spam |
| `unsubscribe` | Recipient unsubscribed |
| `group_unsubscribe` | Unsubscribed from group |
| `group_resubscribe` | Re-subscribed to group |

Webhook payloads include IP address, user agent, URL clicked, timestamp, and custom categories/unique args for attribution.

---

## 3. Microsoft 365 / Exchange Online SMTP Relay

### SMTP Relay Options

Microsoft 365 offers three methods for application email:

| Method | Authentication | Use Case | Limits |
|--------|---------------|----------|--------|
| **SMTP Client Submission** | OAuth2 (smtp.office365.com:587) | Low-volume app email | 10,000 recipients/day, 30 msgs/min |
| **SMTP Relay (Connector)** | IP-based (MX endpoint:25) | Medium-volume from known IPs | Higher than client submission |
| **Direct Send** | None (MX endpoint:25) | Internal-only email | Internal recipients only |

### OAuth2 for SMTP Authentication

**Critical timeline:** Microsoft is retiring Basic Authentication for SMTP AUTH:
- **March 1, 2026** -- Basic auth begins retirement
- **April 30, 2026** -- Complete removal

**OAuth2 Implementation:**
1. Register app in Microsoft Entra (Azure AD)
2. Grant `SMTP.SendAsApp` permission
3. Use SASL XOAUTH2 format: `base64("user=" + userEmail + "\x01auth=Bearer " + accessToken + "\x01\x01")`
4. Connect to `smtp.office365.com:587` with STARTTLS

```javascript
// OAuth2 token acquisition for SMTP
const { ConfidentialClientApplication } = require('@azure/msal-node');

const msalConfig = {
  auth: {
    clientId: '<APP_CLIENT_ID>',
    authority: 'https://login.microsoftonline.com/<TENANT_ID>',
    clientSecret: '<CLIENT_SECRET>'
  }
};

const cca = new ConfidentialClientApplication(msalConfig);
const tokenResponse = await cca.acquireTokenByClientCredential({
  scopes: ['https://outlook.office365.com/.default']
});
// Use tokenResponse.accessToken with SMTP XOAUTH2
```

### Limitations and Quotas

| Limit | Value |
|-------|-------|
| Recipients per mailbox per day | 10,000 |
| Recipients per message | 500 |
| Messages per minute | 30 |
| Concurrent connections | 3 |
| Message size | 150 MB |

**Important:** IP address-based SMTP relay connectors are NOT affected by the OAuth2 enforcement since they do not rely on basic SMTP AUTH endpoints.

**Verdict for e-commerce:** Microsoft 365 SMTP is **not recommended** for transactional e-commerce email due to low throughput limits (30 msgs/min) and the fact that it is designed for user mailbox communication, not application-to-person bulk sending.

---

## 4. Azure Notification Hubs

### Overview

Azure Notification Hubs is a massively scalable push notification engine supporting millions of notifications across platforms.

### Platform Support

| Platform | Protocol | Status |
|----------|----------|--------|
| iOS (APNs) | Certificate or Token-based | GA |
| Android (FCM) | Firebase Cloud Messaging | GA |
| Windows (WNS) | Windows Notification Service | GA |
| Web Push (Chrome, Edge, Firefox) | VAPID/Web Push Protocol | GA |
| Kindle (ADM) | Amazon Device Messaging | GA |
| Baidu | Baidu Cloud Push | GA |
| Safari | Via APNs certificate auth | Supported |

### Web Push Setup

1. Generate VAPID keys (public/private key pair)
2. Configure Browser (Web Push) blade in Azure portal with VAPID keys
3. Register service worker in web app
4. Create browser registrations with `installationId`, `platform: "browser"`, and `pushChannel` (containing endpoint, p256dh, auth)
5. Subject format must be `mailto:your@email.com`

### Segmentation and Targeting

**Tag-based routing:**
```
// Tag examples for e-commerce
"user:12345"           // Individual user
"segment:vip"          // Customer tier
"interest:electronics" // Product interest
"location:us-east"     // Geographic segment
"language:en"          // Language preference
"cart:abandoned"       // Behavioral trigger
```

**Tag expressions** support boolean logic:
```
"segment:vip && interest:electronics"   // VIP electronics buyers
"location:us-east || location:us-west"  // US customers
"!(segment:unsubscribed)"               // Not unsubscribed
```

### Scheduled Notifications

Available on Standard tier -- notifications can be scheduled up to 7 days in advance.

### Pricing

| Feature | Free | Basic | Standard |
|---------|------|-------|----------|
| **Price/month** | $0 | $10/namespace | $200/namespace |
| **Devices** | 500 | 200,000 | 10,000,000 |
| **Pushes included** | 1M/subscription | 10M/subscription | 10M/subscription |
| **Scheduled push** | No | No | Yes |
| **Rich telemetry** | No | No | Yes |
| **Multi-tenancy** | No | No | Yes |
| **SLA** | None | 99.9% | 99.9% |
| **Auto-scale** | No | No | Yes |

Overage pushes beyond included volume are billed at approximately $1 per 1M additional pushes (Basic) and higher for Standard with telemetry.

---

## 5. Azure Service Bus for Email Processing

### Architecture for Email Processing Queues

Azure Service Bus provides enterprise-grade messaging that is ideal for decoupling email sending from your application layer.

**Queue-based email processing pattern:**
```
[Web App] --> [Service Bus Queue: email-send] --> [Azure Function / Worker]
                                                       |
                                                  [Email Provider]
                                                  (ACS / SendGrid)
                                                       |
                                              [Service Bus Queue: email-status]
                                                       |
                                              [Status Processor / Analytics]
```

### Dead Letter Queues (DLQ) for Failed Sends

DLQs are automatic sub-queues that capture messages that cannot be processed:

**Automatic dead-lettering occurs when:**
- `MaxDeliveryCount` is exceeded (default: 10 retries)
- Message TTL expires (when `EnableDeadLetteringOnMessageExpiration = true`)

**Manual dead-lettering** -- your code can explicitly dead-letter messages that fail business validation (e.g., invalid email format, permanently bounced address).

**DLQ monitoring strategies:**
1. **Azure Function with Service Bus trigger** -- process DLQ messages automatically
2. **Logic App workflow** -- alert and retry workflow
3. **Azure Monitor alerts** -- alert on `DeadLetteredMessages` metric
4. **Auto-forward** -- forward dead-lettered messages to a separate queue for analysis

```javascript
// Dead letter a message with reason
await receiver.deadLetterMessage(message, {
  deadLetterReason: "EmailBounced",
  deadLetterErrorDescription: "Hard bounce: mailbox does not exist"
});
```

### Topic Subscriptions for Notification Types

Topics enable fan-out to multiple subscribers with filtering:

```
[Notification Service] --> [Topic: notifications]
                               |
                    +----------+----------+----------+
                    |          |          |          |
              [Sub: email] [Sub: push] [Sub: sms] [Sub: admin]
                    |          |          |          |
              Filter:      Filter:    Filter:    Filter:
              type='email' type='push' type='sms' priority='high'
```

**Example topic/subscription setup for e-commerce:**

| Topic | Subscriptions | Filter |
|-------|--------------|--------|
| `order-events` | `email-confirmations` | `eventType = 'order.confirmed'` |
| `order-events` | `push-shipping` | `eventType = 'order.shipped'` |
| `order-events` | `admin-alerts` | `priority = 'high'` |
| `marketing-events` | `abandoned-cart-email` | `eventType = 'cart.abandoned'` |
| `marketing-events` | `review-request` | `eventType = 'review.request'` |
| `inventory-events` | `low-stock-admin` | `stockLevel < threshold` |

### Pricing

| Tier | Base Cost | Included Operations | Per-Operation Overage |
|------|-----------|--------------------|-----------------------|
| Basic | $0.05/M operations | Pay-per-use | $0.05/M |
| Standard | $10/month | 12.5M operations | ~$0.80/M |
| Premium | From $668/month | Unlimited operations | Included |

One "operation" = one send/receive/delete of a message up to 64KB. Messages larger than 64KB count as multiple operations.

---

## 6. Email Deliverability

### SPF, DKIM, DMARC Configuration for Azure

#### SPF (Sender Policy Framework)

For Azure Communication Services custom domains:
```dns
yourdomain.com.  IN  TXT  "v=spf1 include:spf.protection.outlook.com include:azurecomm.net ~all"
```

#### DKIM (DomainKeys Identified Mail)

ACS requires **two DKIM selectors** (DKIM and DKIM2). The CNAME records are provided in the Azure portal during domain verification:
```dns
selector1._domainkey.yourdomain.com  CNAME  selector1-yourdomain-com._domainkey.azurecomm.net
selector2._domainkey.yourdomain.com  CNAME  selector2-yourdomain-com._domainkey.azurecomm.net
```

#### DMARC

```dns
_dmarc.yourdomain.com.  IN  TXT  "v=DMARC1; p=quarantine; rua=mailto:dmarc-reports@yourdomain.com; pct=100; adkim=s; aspf=s"
```

**Recommended rollout sequence:**
1. Configure SPF and DKIM first
2. Deploy DMARC at `p=none` with `rua` reporting
3. Analyze DMARC reports for 2-4 weeks
4. Move to `p=quarantine`
5. After validation, move to `p=reject`

**2025 Microsoft requirement:** As of May 5, 2025, high-volume senders (5,000+ emails/day to Outlook.com) **must** implement SPF, DKIM, and DMARC or face throttling, junk-foldering, or blocking.

#### ARC (Authenticated Received Chain)

ACS supports ARC (RFC 8617) to preserve authentication results during message forwarding -- this is handled automatically by the platform.

### IP Reputation Management

Azure Communication Services uses **shared IP infrastructure** by default. Key considerations:

- ACS maintains a **global managed suppression list** that protects sender reputation across all ACS customers
- There is no option for dedicated IPs through ACS (unlike SendGrid Pro plan)
- Microsoft's platform-level spam protection (Microsoft Defender components) scans all outbound email
- URL blocking and content heuristic filtering are applied to all messages

**For dedicated IP needs:** Use SendGrid Pro or higher tier, which offers dedicated IP addresses with full reputation isolation.

### Warm-Up Strategies for New Domains

ACS explicitly recommends a 2-4 week warm-up period:

| Week | Strategy | Volume |
|------|----------|--------|
| Week 1-2 | Send to most active subscribers (opened/clicked in last 30 days) | 10-20% of target volume |
| Week 3-4 | Expand to 60-day active subscribers | 40-60% of target volume |
| Week 5-6 | Expand to 90-day active subscribers | 80-100% of target volume |
| Week 7+ | Full volume, monitor metrics | Full target volume |

**Key rules during warm-up:**
- Never send to addresses that have not engaged in 90+ days during the first 6 weeks
- Request quota increases gradually, not all at once
- Monitor failure rate -- must stay below 1% to qualify for quota increases
- Quota increase requests take up to 72 hours for approval

### Bounce Handling

**ACS Managed Suppression List lifecycle:**

| Stage | Duration | Trigger |
|-------|----------|---------|
| Initial suppression | 24 hours | First hard bounce |
| Progressive (2nd) | 48 hours | Hard bounce during initial period |
| Progressive (3rd) | 96 hours | Continued failures |
| Progressive (4th) | 7 days | Continued failures |
| Maximum | 14 days | Continued failures |
| Auto-removal | After lease expires | No sends to address during lease |

**Two suppression lists exist:**
1. **Global Suppression List** -- managed by Microsoft, protects shared infrastructure reputation (not visible in your portal)
2. **Custom Suppression List** -- managed by you, for your domain-specific opt-outs and bounces

**Delivery statuses to monitor:**
- `Delivered` -- successfully accepted
- `Bounced` -- hard bounce (permanent failure, 5xx)
- `Suppressed` -- address on suppression list
- `FilteredSpam` -- flagged as spam
- `Quarantined` -- held for review
- `Failed` -- general failure

---

## 7. E-Commerce Notification Patterns

### Transactional Email Flows

#### Order Confirmation
```
[Order Placed] --> [Service Bus: order-events] --> [Email Worker]
                                                       |
                                               Template: order-confirmation
                                               Data: order details, items, total
                                               Timing: Immediate (<30 seconds)
```

**Best practices:**
- Send within 30 seconds of order placement
- Include order number, items, quantities, prices, shipping address, expected delivery date
- Include a link to track order status
- Include contact information for support

#### Shipping Updates
```
[Carrier Webhook] --> [API: shipping-update] --> [Service Bus: order-events]
                                                       |
                                               Template: shipping-notification
                                               Events: shipped, in-transit, out-for-delivery, delivered
```

**Timing:**
- Shipped: Immediate when carrier accepts package
- In transit: Daily updates if journey > 3 days
- Out for delivery: Morning of delivery day
- Delivered: Within 1 hour of confirmation

#### Delivery Confirmation
- Include product review request CTA (delay 3-7 days after delivery)
- Include return/exchange instructions
- Include re-order links

### Marketing/Engagement Email Flows

#### Abandoned Cart
```
[Cart Abandoned Event] --> [Azure Function: abandoned-cart-timer]
                               |
                      +--------+--------+
                      |        |        |
                   1 hour   24 hours  72 hours
                      |        |        |
                  Reminder  Follow-up  Last chance
                  (no offer) (5-10%)   (15-20% off)
```

**Key metrics:** Back-in-stock alert emails achieve 65.32% open rates and 14% average conversion rate.

**Best practices:**
- First email at 1 hour: Gentle reminder with cart contents
- Second email at 24 hours: Include social proof or urgency
- Third email at 72 hours: Include discount incentive
- Stop sequence if purchase is made at any point
- Include product images and one-click return-to-cart link

#### Review Request
- Send 5-7 days after delivery confirmation
- Personalize with specific product purchased
- Include direct link to review form (minimize clicks)
- Offer incentive (loyalty points, discount code)
- Limit to one follow-up if no response

#### Subscription Renewal Reminders
```
Timeline:
  30 days before: "Your subscription renews soon"
  7 days before:  "Renewal in 7 days - update payment if needed"
  1 day before:   "Renewing tomorrow"
  Day of:         "Subscription renewed successfully" / "Payment failed"
  3 days after failure: "Action needed: update payment method"
```

#### Low Stock Alerts (Admin)
- Threshold-based: Set alert at ~1.5x weekly sales velocity
- Include product name, current stock level, and direct reorder link
- Use push notifications (Notification Hubs) for urgency
- Channel: Email + push notification to admin dashboard
- Differentiate severity: Warning (< 2 weeks stock) vs Critical (< 3 days stock)

---

## 8. Pricing Comparison Matrix

### Email Service Comparison (100,000 emails/month, 50KB avg)

| Service | Monthly Cost | Free Tier | Dedicated IP | Templates | Webhooks/Events | SMTP Support |
|---------|-------------|-----------|-------------|-----------|----------------|-------------|
| **ACS Email** | ~$25.60 | None | No (shared) | None (DIY) | Event Grid | Yes |
| **SendGrid (Essentials)** | ~$20 | Eliminated (Jul 2025) | No | Handlebars dynamic | Event Webhooks | Yes |
| **SendGrid (Pro)** | ~$90 | Eliminated | Yes | Handlebars dynamic | Event Webhooks | Yes |
| **Amazon SES** | ~$10 | 3,000/mo (12 months) | Yes ($24.95/mo) | None (DIY) | SNS notifications | Yes |
| **Mailgun (Foundation)** | ~$35 | Trial only | No | Handlebars | Webhooks | Yes |
| **Mailgun (Scale)** | ~$90 | None | Yes | Handlebars | Webhooks | Yes |

### Cost at Scale

| Volume/Month | ACS Email | SendGrid Pro | Amazon SES | Mailgun Scale |
|-------------|-----------|-------------|------------|--------------|
| 10,000 | $2.56 | $90 | $1.00 | $90 |
| 100,000 | $25.60 | $90 | $10.00 | $90 |
| 500,000 | $128.00 | $250+ | $50.00 | $200+ |
| 1,000,000 | $256.00 | $450+ | $100.00 | Custom |

**Key takeaway:** For pure cost per email, Amazon SES is cheapest, followed by ACS Email. But ACS integrates natively with Azure services, while SES requires AWS cross-cloud connectivity. SendGrid and Mailgun are more expensive but include template engines, analytics dashboards, and dedicated IPs out of the box.

---

## 9. Recommended Architecture for E-Commerce on Azure

### Architecture Diagram

```
                          ┌─────────────────────┐
                          │   Next.js Web App    │
                          │   (Order, Cart, etc) │
                          └──────────┬───────────┘
                                     │
                                     ▼
                    ┌────────────────────────────────┐
                    │      Azure Service Bus          │
                    │                                  │
                    │  Topics:                         │
                    │  ├── order-events                │
                    │  ├── marketing-events            │
                    │  ├── inventory-events            │
                    │  └── admin-alerts                │
                    │                                  │
                    │  Queues:                         │
                    │  ├── email-send (with DLQ)       │
                    │  ├── push-send (with DLQ)        │
                    │  └── sms-send (with DLQ)         │
                    └──────────┬──────────┬────────────┘
                               │          │
                 ┌─────────────┘          └──────────────┐
                 ▼                                        ▼
    ┌────────────────────┐               ┌───────────────────────┐
    │  Email Worker       │               │  Push Worker           │
    │  (Azure Function)   │               │  (Azure Function)      │
    │                     │               │                         │
    │  ├── Template Engine│               │  Azure Notification     │
    │  ├── ACS Email SDK  │               │  Hubs (Standard)        │
    │  └── Retry Logic    │               │                         │
    └─────────┬───────────┘               └────────────┬────────────┘
              │                                         │
              ▼                                         ▼
    ┌─────────────────┐                    ┌────────────────────┐
    │ ACS Email /      │                    │ APNs / FCM / WNS / │
    │ SendGrid         │                    │ Web Push (VAPID)    │
    │ (Primary/Fallback)│                    └────────────────────┘
    └─────────────────┘
              │
              ▼
    ┌─────────────────────┐
    │ Event Grid /         │
    │ SendGrid Webhooks    │
    │                      │
    │ → Delivery tracking  │
    │ → Engagement metrics │
    │ → Bounce handling    │
    │ → Analytics store    │
    └──────────────────────┘
```

### Service Selection Recommendations

| Use Case | Recommended Service | Rationale |
|----------|-------------------|-----------|
| **Transactional email** (orders, receipts) | ACS Email + SendGrid fallback | ACS for Azure-native cost efficiency; SendGrid as fallback with template engine |
| **Marketing email** (campaigns, promotions) | SendGrid Pro | Template engine, dedicated IP, engagement analytics |
| **Push notifications** | Azure Notification Hubs (Standard) | Multi-platform, tag-based segmentation, scheduled sends |
| **Message queuing** | Azure Service Bus (Standard) | Topics for fan-out, DLQ for failed sends, reliable delivery |
| **Internal/admin email** | ACS Email | Low volume, cost-effective |
| **SMS notifications** | ACS SMS or Twilio | ACS for Azure-native; Twilio for global coverage |

### Resilience Pattern

For critical transactional emails (order confirmations, payment receipts), implement a dual-provider strategy:

```javascript
async function sendTransactionalEmail(message) {
  try {
    // Primary: Azure Communication Services
    await acsEmailClient.beginSend(message);
  } catch (error) {
    // Fallback: SendGrid
    console.error('ACS failed, falling back to SendGrid:', error);
    await sendGridClient.send(convertToSendGridFormat(message));
  }
}
```

Use the [Polly .NET library](https://developersvoice.com/blog/dotnet/sendgrid-azure-polly-email-delivery/) (or equivalent retry logic in Node.js) for retry policies with exponential backoff.

### Database Schema for Notification Tracking

```sql
-- Notification log table
CREATE TABLE notification_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type VARCHAR(50) NOT NULL,           -- 'email', 'push', 'sms'
  category VARCHAR(100) NOT NULL,      -- 'order_confirmation', 'shipping_update', etc.
  recipient_id UUID REFERENCES users(id),
  recipient_address VARCHAR(255),
  provider VARCHAR(50),                -- 'acs', 'sendgrid', 'notification_hubs'
  provider_message_id VARCHAR(255),
  status VARCHAR(50) DEFAULT 'queued', -- queued, sent, delivered, bounced, failed, opened, clicked
  template_id VARCHAR(100),
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  delivered_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ
);

-- Suppression list
CREATE TABLE email_suppressions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_address VARCHAR(255) NOT NULL UNIQUE,
  reason VARCHAR(50) NOT NULL,         -- 'hard_bounce', 'spam_complaint', 'unsubscribe'
  source VARCHAR(50),                  -- 'acs_managed', 'sendgrid', 'manual'
  suppressed_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);
```

---

## Summary of Key Decisions

1. **Primary email provider:** Azure Communication Services Email for cost efficiency and Azure-native integration. Supplement with SendGrid for template management and dedicated IP needs.

2. **SendGrid free tier is gone** -- budget accordingly. For low-volume projects, ACS Email is now the most cost-effective option on Azure.

3. **Always implement SPF + DKIM + DMARC** from day one. Microsoft enforces this for high-volume senders as of May 2025.

4. **Use Azure Service Bus** as the messaging backbone to decouple notification sending from application logic, enable retry patterns, and provide dead-letter handling for failed sends.

5. **Azure Notification Hubs Standard** for push notifications with tag-based segmentation, scheduled sends, and multi-platform support.

6. **Do not use Microsoft 365 SMTP** for transactional e-commerce email -- the 30 messages/minute limit and 10,000 recipients/day cap make it unsuitable for application email.

7. **Warm up new domains gradually** over 2-4 weeks, monitor failure rates, and keep bounce rates below 1% before requesting quota increases.

---

## Sources

- [Azure Communication Services Email Overview](https://learn.microsoft.com/en-us/azure/communication-services/concepts/email/email-overview)
- [Azure Communication Services Email Pricing](https://learn.microsoft.com/en-us/azure/communication-services/concepts/email-pricing)
- [Azure Communication Services Service Limits](https://learn.microsoft.com/en-us/azure/communication-services/concepts/service-limits)
- [Email Domain and Sender Authentication](https://learn.microsoft.com/en-us/azure/communication-services/concepts/email/email-domain-and-sender-authentication)
- [Best Practices for Sender Authentication](https://learn.microsoft.com/en-us/azure/communication-services/concepts/email/email-authentication-best-practice)
- [Sender Reputation and Managed Suppression List](https://learn.microsoft.com/en-us/azure/communication-services/concepts/email/sender-reputation-managed-suppression-list)
- [Email Insights Dashboard](https://learn.microsoft.com/en-us/azure/communication-services/concepts/analytics/insights/email-insights)
- [Enable User Engagement Tracking](https://learn.microsoft.com/en-us/azure/communication-services/quickstarts/email/enable-user-engagement-tracking)
- [Handle Email Events](https://learn.microsoft.com/en-us/azure/communication-services/quickstarts/email/handle-email-events)
- [Email Quota Increase](https://learn.microsoft.com/en-us/azure/communication-services/concepts/email/email-quota-increase)
- [Azure Communication Services SMTP Authentication](https://learn.microsoft.com/en-us/azure/communication-services/quickstarts/email/send-email-smtp/smtp-authentication)
- [Azure Communication Email JS SDK](https://learn.microsoft.com/en-us/javascript/api/overview/azure/communication-email-readme)
- [Twilio SendGrid on Azure Marketplace](https://azuremarketplace.microsoft.com/en-us/marketplace/apps/sendgrid.tsg-saas-offer)
- [SendGrid Has Ended Its Free Tier](https://meraksystems.com/blog/2025/07/29/sendgrid-has-ended-its-free-tier-heres-what-it-means-for-your-website/)
- [SendGrid Event Webhook Reference](https://www.twilio.com/docs/sendgrid/for-developers/tracking-events/event)
- [SendGrid Dynamic Templates with Handlebars](https://www.twilio.com/docs/sendgrid/for-developers/sending-email/using-handlebars)
- [SendGrid Pricing](https://sendgrid.com/en-us/pricing)
- [Exchange Online SMTP AUTH Retirement](https://techcommunity.microsoft.com/blog/exchange/exchange-online-to-retire-basic-auth-for-client-submission-smtp-auth/4114750)
- [OAuth for High Volume Email M365](https://learn.microsoft.com/en-us/exchange/mail-flow-best-practices/oauth-high-volume-mails-m365)
- [SMTP Submission Improvements](https://learn.microsoft.com/en-us/exchange/troubleshoot/send-emails/smtp-submission-improvements)
- [Azure Notification Hubs Overview](https://learn.microsoft.com/en-us/azure/notification-hubs/notification-hubs-push-notification-overview)
- [Browser Push with Notification Hubs](https://learn.microsoft.com/en-us/azure/notification-hubs/browser-push)
- [Notification Hubs Pricing](https://azure.microsoft.com/en-us/pricing/details/notification-hubs/)
- [Azure Service Bus Dead-Letter Queues](https://learn.microsoft.com/en-us/azure/service-bus-messaging/service-bus-dead-letter-queues)
- [Azure Service Bus Queues, Topics, Subscriptions](https://learn.microsoft.com/en-us/azure/service-bus-messaging/service-bus-queues-topics-subscriptions)
- [Service Bus Pricing](https://azure.microsoft.com/en-us/pricing/details/service-bus/)
- [Scalable Order Processing Architecture](https://learn.microsoft.com/en-us/azure/architecture/example-scenario/data/ecommerce-order-processing)
- [Microsoft 2025 Sender Email Requirements](https://redsift.com/tools/microsoft-sender-requirements)
- [Microsoft Azure SPF and DKIM Configuration](https://easydmarc.com/blog/microsoft-azure-spf-and-dkim-configuration/)
- [Amazon SES Pricing](https://aws.amazon.com/ses/pricing/)
- [Mailgun Pricing](https://www.mailgun.com/pricing/)
- [Email APIs in 2025: SendGrid vs Resend vs AWS SES](https://medium.com/@nermeennasim/email-apis-in-2025-sendgrid-vs-resend-vs-aws-ses-a-developers-journey-8db7b5545233)
- [Azure Warm-Up Process for Email Marketing](https://learn.microsoft.com/en-us/dynamics365/customer-insights/journeys/warmup-process-email-marketing)
- [Building Resilient Email Delivery: SendGrid vs ACS with Polly](https://developersvoice.com/blog/dotnet/sendgrid-azure-polly-email-delivery/)