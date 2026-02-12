# Azure Ancillary Services for E-Commerce - Exhaustive Research Report

> Generated: 2026-02-11 | Based on Microsoft documentation, architecture patterns, and expert recommendations

---

## Table of Contents

1. [Azure Cache for Redis](#1-azure-cache-for-redis)
2. [Azure CDN & Azure Front Door](#2-azure-cdn--azure-front-door)
3. [Azure Blob Storage](#3-azure-blob-storage)
4. [Azure Communication Services](#4-azure-communication-services)
5. [Azure Service Bus / Event Grid](#5-azure-service-bus--event-grid)

---

## 1. Azure Cache for Redis

### CRITICAL: Retirement & Migration to Azure Managed Redis

**Azure Cache for Redis is being retired.** Microsoft has announced:

- **Azure Cache for Redis Enterprise/Enterprise Flash**: Retiring **March 30, 2027**
- **Azure Cache for Redis Basic/Standard/Premium**: Retirement process initiating **early 2026**, final retirement **September 30, 2028**
- **Replacement**: **Azure Managed Redis (AMR)** -- built on Redis Enterprise software
- **Migration tooling**: Command-line migration available in phases from **February 2026**, starting with Basic caches in preview
- **Compatibility**: No application code changes required beyond connection configuration for most scenarios
- **Feature parity target**: Major gaps closing by **March-June 2026**

**Recommendation**: New projects should plan for Azure Managed Redis from the start. Existing projects should begin migration planning now.

Sources:
- [Azure Cache for Redis Retirement Announcement](https://techcommunity.microsoft.com/blog/azure-managed-redis/azure-cache-for-redis-retirement-what-to-know-and-how-to-prepare/4458721)
- [Migration Overview](https://learn.microsoft.com/en-us/azure/redis/migrate/migrate-overview)

---

### 1.1 Tiers Comparison

#### Basic Tier
- **Memory**: 250 MB - 53 GB
- **SLA**: No SLA (development/testing only)
- **Replication**: None (single node)
- **Threading**: Single-threaded command processing (open-source Redis)
- **Networking**: Shared infrastructure, no VNet support
- **Persistence**: None
- **Use case**: Development, testing, non-critical workloads

#### Standard Tier
- **Memory**: 250 MB - 53 GB
- **SLA**: 99.9%
- **Replication**: Primary/replica (two nodes)
- **Threading**: Single-threaded command processing
- **Networking**: Shared infrastructure
- **Persistence**: None built-in
- **Failover**: Automatic failover
- **Use case**: Production workloads with moderate demands

#### Premium Tier
- **Memory**: 6 GB - 1.2 TB (with clustering up to 10 shards)
- **SLA**: 99.9%
- **Replication**: Primary/replica with clustering
- **Threading**: Single-threaded but additional vCPUs for I/O and OS processes
- **Networking**: VNet injection, Private Link
- **Persistence**: RDB snapshots, AOF (Append Only File)
- **Geo-replication**: Passive (single region primary)
- **Zone redundancy**: Supported
- **Use case**: High-throughput production, data persistence requirements, network isolation

#### Enterprise Tier
- **Memory**: 1 GB - 2 TB
- **SLA**: Up to 99.999% with geo-replication
- **Replication**: Multi-master with active geo-replication
- **Threading**: Multi-threaded (Redis Enterprise) -- significantly better performance
- **Networking**: Private Link
- **Persistence**: RDB + AOF to managed disk
- **Modules**: RediSearch, RedisJSON, RedisBloom, RedisTimeSeries
- **Geo-replication**: Active (multi-master, conflict-free data types)
- **Use case**: Enterprise-grade, global distribution, advanced data structures, vector search

#### Enterprise Flash Tier
- **Memory**: 300 GB - 4.5 TB (RAM + flash NVMe)
- **SLA**: Up to 99.999%
- **Key difference**: Extends memory to flash storage for massive datasets at lower per-GB cost
- **Performance**: Slight latency increase vs pure RAM, but negligible for most workloads
- **Use case**: Massive datasets where cost-per-GB matters, large session stores

Sources:
- [What is Azure Cache for Redis?](https://learn.microsoft.com/en-us/azure/azure-cache-for-redis/cache-overview)
- [Azure Cache for Redis Pricing](https://azure.microsoft.com/en-us/pricing/details/cache/)
- [Enterprise Tiers Best Practices](https://learn.microsoft.com/en-us/azure/azure-cache-for-redis/cache-best-practices-enterprise-tiers)
- [Azure Redis Pricing Guide](https://www.dragonflydb.io/guides/azure-redis-pricing)

---

### 1.2 Best Practices

#### Connection Pooling
- **Use connection multiplexing**: Fewer TCP connections handling many requests reduces resource overhead
- **StackExchange.Redis (.NET)**: Uses a singleton `ConnectionMultiplexer` -- supports connection reuse out of the box
- **node-redis / ioredis (Node.js)**: Reuse a single client connection; avoid creating new connections per request
- **Singleton pattern**: Use a single `ConnectionMultiplexer` (or equivalent) instance shared across the application
- **Periodic reconnection**: Allow apps to force a reconnection periodically to handle stale connections
- **Pipeline commands**: Batch multiple commands over a single connection to reduce round trips

```typescript
// Node.js example with ioredis - singleton pattern
import Redis from 'ioredis';

let redisClient: Redis | null = null;

export function getRedisClient(): Redis {
  if (!redisClient) {
    redisClient = new Redis({
      host: process.env.REDIS_HOST,
      port: parseInt(process.env.REDIS_PORT || '6380'),
      password: process.env.REDIS_KEY,
      tls: { servername: process.env.REDIS_HOST },
      retryStrategy: (times) => Math.min(times * 50, 2000),
      maxRetriesPerRequest: 3,
    });
  }
  return redisClient;
}
```

#### Retry Policies
- **Exponential backoff**: Use exponential backoff algorithm (Microsoft Patterns & Practices recommended)
- **Connect timeout**: Set to at least **5 seconds** to handle high-CPU conditions
- **Max retries**: Configure 3-5 retries with increasing delays
- **Circuit breaker**: Implement circuit breaker pattern for sustained failures
- **Avoid thundering herd**: Add jitter to retry delays

```typescript
// Retry configuration example
const retryConfig = {
  retryStrategy: (times: number) => {
    if (times > 5) return null; // Stop retrying after 5 attempts
    const delay = Math.min(times * 200, 5000); // Max 5s delay
    const jitter = Math.random() * 100; // Add jitter
    return delay + jitter;
  },
  connectTimeout: 5000,
  commandTimeout: 5000,
};
```

#### Data Persistence
- **RDB snapshots**: Point-in-time snapshots; good for disaster recovery; some data loss acceptable
- **AOF (Append Only File)**: Logs every write operation; minimal data loss
  - **Async AOF** (recommended for performance): Writes asynchronously to disk
  - **Sync AOF** (maximum durability): Writes synchronously; higher latency
- **Best practice**: Enable AOF for critical workloads (e-commerce sessions, cart data)
- **Schedule regular backups**: Automate with Azure Backup service
- **Premium tier**: Persists to Azure Storage account
- **Enterprise tier**: Persists to Managed Disk (faster, more reliable)

Sources:
- [Connection Resilience Best Practices](https://learn.microsoft.com/en-us/azure/azure-cache-for-redis/cache-best-practices-connection)
- [Client Libraries Best Practices](https://learn.microsoft.com/en-us/azure/azure-cache-for-redis/cache-best-practices-client-libraries)
- [Azure Cache Best Practices Guide](https://www.dragonflydb.io/guides/azure-cache-best-practices)

---

### 1.3 Use Cases for E-Commerce

#### Session Store
- Store user sessions (authentication state, cart contents, preferences) in Redis
- Sub-millisecond reads for session validation on every request
- TTL-based automatic session expiration
- ASP.NET/Node.js session state providers available
- **Pattern**: `session:{userId}` -> JSON blob of session data

#### Page/Fragment Cache
- Cache rendered HTML fragments, API responses, product catalog pages
- Cache-aside pattern: check Redis first, fall back to database, populate cache on miss
- **Performance gain**: 800%+ throughput improvement, 1000%+ latency improvement vs direct database
- Cache tag helper for MVC/Razor pages
- **Pattern**: `page:{route}:{params}` -> rendered HTML or serialized data

#### Rate Limiting
- Use Redis atomic `INCR` + `EXPIRE` for sliding window rate limiting
- Protect APIs from abuse (cart manipulation, checkout spam)
- Track per-IP, per-user, or per-API-key request counts
- **Pattern**: `ratelimit:{ip}:{window}` -> counter with TTL

#### Real-Time Features
- **Pub/Sub**: Real-time inventory updates, price changes, flash sale notifications
- **Sorted Sets**: Leaderboards, trending products, real-time search suggestions
- **Streams**: Event sourcing for order processing pipeline
- **SignalR backplane**: Scale WebSocket connections across multiple server instances

#### Shopping Cart
- Store ephemeral cart data with TTL (e.g., 7 days)
- Hash data structure maps naturally to cart items
- Atomic operations prevent race conditions in concurrent updates
- **Pattern**: `cart:{userId}` -> Hash of `{productId: quantity}`

Sources:
- [Azure Cache for Redis Product Page](https://azure.microsoft.com/en-us/products/cache)
- [Azure Cache for Redis Overview](https://learn.microsoft.com/en-us/azure/azure-cache-for-redis/cache-overview)
- [ASP.NET Session State Provider](https://learn.microsoft.com/en-us/azure/azure-cache-for-redis/cache-aspnet-session-state-provider)

---

### 1.4 Redis vs Cosmos DB for Caching

| Aspect | Azure Cache for Redis | Azure Cosmos DB |
|--------|----------------------|-----------------|
| **Storage type** | In-memory (RAM) | Disk-based (SSD) |
| **Latency** | Sub-millisecond (<1ms) | Single-digit millisecond (1-10ms) |
| **Data model** | Key-value, hash, list, set, sorted set | Document (JSON), graph, table, column-family |
| **SLA** | 99.9% (Premium), 99.999% (Enterprise) | 99.99% (single region), 99.999% (multi-region) |
| **Persistence** | Optional (RDB/AOF) | Always persistent |
| **Global distribution** | Active geo-replication (Enterprise only) | Turnkey global distribution (all tiers) |
| **Consistency** | Eventual (replicas) | 5 consistency levels (strong to eventual) |
| **Cost** | Higher per-GB (RAM pricing) | Lower per-GB (disk pricing), but RU-based billing |
| **Query capability** | Limited (key lookup, RediSearch module) | Rich SQL-like queries |

#### When to Use Redis for Caching
- Ultra-low latency required (<1ms)
- Simple key-value lookups (session, page cache, rate limits)
- Pub/Sub or real-time features needed
- Ephemeral data that can be regenerated
- High read-to-write ratio (hot data caching)

#### When to Use Cosmos DB for Caching
- Data must be durable and queryable
- Global distribution needed without Enterprise tier Redis
- Complex queries on cached data
- Moderate latency acceptable (1-10ms)
- Light workloads where Redis cost is prohibitive

#### Cache-Aside Pattern (Best Practice: Use Both)
1. Check Redis for the requested data
2. On cache miss, read from Cosmos DB (or other primary database)
3. Populate Redis with TTL
4. On writes, update primary database and invalidate Redis cache key
5. **80/20 rule**: Cache the 20% of data that serves 80% of reads

Sources:
- [Redis vs Cosmos for Application Cache (Microsoft Q&A)](https://learn.microsoft.com/en-us/answers/questions/917339/redis-vs-cosmos-for-application-cache)
- [Azure Managed Redis & Cosmos DB Cache-Aside Guide](https://techcommunity.microsoft.com/blog/azure-managed-redis/azure-managed-redis--azure-cosmos-db-with-cache%E2%80%91aside-a-practical-guide/4475007)

---

### 1.5 Connection Security

#### Private Link (Recommended for Production)
- Creates a private endpoint in your VNet
- Traffic stays on the Microsoft backbone network (never traverses public internet)
- Eliminates data exfiltration risk
- Available on Premium, Enterprise, and Enterprise Flash tiers
- **Recommendation**: Always use Private Link for production e-commerce workloads

#### SSL/TLS
- **TLS 1.2+** required by default on all tiers
- **TLS 1.3** now supported on all tiers
- Non-TLS port (6379) disabled by default -- do not enable in production
- TLS port: **6380**
- Always use `tls: true` in client configuration

#### Access Keys vs Microsoft Entra ID

| Aspect | Access Keys | Microsoft Entra ID |
|--------|------------|-------------------|
| **Mechanism** | Shared secret (password) | Token-based (OAuth 2.0) |
| **Rotation** | Manual key rotation required | Automatic token renewal |
| **Granularity** | Full access (no RBAC) | Role-based access control (custom ACLs) |
| **Audit** | Limited | Full Azure AD audit logs |
| **Risk** | Key leaks grant full access | Token-scoped, time-limited |
| **Recommendation** | Legacy; avoid for new deployments | **Preferred** -- Microsoft recommended |

**Microsoft explicitly recommends**: Use Microsoft Entra ID and disable access keys.

#### Configuration Steps for Entra ID
1. Register your application in Microsoft Entra ID
2. Assign `Redis Cache Contributor` or custom data access role
3. Configure your client library to use token-based auth
4. Disable access key authentication on the cache instance

Sources:
- [Microsoft Entra for Cache Authentication](https://learn.microsoft.com/en-us/azure/azure-cache-for-redis/cache-azure-active-directory-for-authentication)
- [How to Configure Azure Cache for Redis](https://learn.microsoft.com/en-us/azure/azure-cache-for-redis/cache-configure)

---

## 2. Azure CDN & Azure Front Door

### CRITICAL: CDN Landscape Changes (2025-2027)

**Retirements and migrations**:
- **Azure CDN from Akamai**: Already retired (October 2023)
- **Azure CDN from Edgio (Verizon)**: Edgio filed for bankruptcy; service disrupted
- **Azure Front Door (classic)**: Retiring **March 31, 2027**; managed certificate support ending **August 15, 2025**
- **Azure CDN from Microsoft (classic)**: Managed certificate support ending **August 15, 2025**

**Current recommendation**: **Azure Front Door Standard/Premium** is the unified, forward-looking CDN + load balancing + WAF service.

---

### 2.1 Azure CDN Profile Types (Legacy Context)

#### Azure CDN Standard from Microsoft (Classic)
- Microsoft-owned PoP network
- Basic rules engine
- HTTPS with managed or custom certificates
- Compression support
- Query string caching
- Geo-filtering
- **Status**: Being superseded by Azure Front Door Standard

#### Azure CDN Standard from Akamai
- Akamai's massive network (200,000+ servers, 120+ countries)
- HTTP/2 support
- Geo-filtering
- Large file download optimization
- **Status**: RETIRED (October 2023)

#### Azure CDN Standard from Verizon
- Verizon Digital Media Services network
- Bandwidth/cache status reports
- Country-based content restriction (per IP, per directory)
- **Status**: Disrupted due to Edgio bankruptcy

#### Azure CDN Premium from Verizon
- All Standard Verizon features plus:
- Advanced real-time analytics
- Token authentication
- Advanced rules engine with regex support
- **Status**: Disrupted due to Edgio bankruptcy

**Bottom line**: Azure Front Door Standard/Premium is the only viable path forward for new deployments.

Sources:
- [Azure Front Door vs CDN Comparison](https://learn.microsoft.com/en-us/azure/frontdoor/front-door-cdn-comparison)
- [Azure CDN Overview](https://learn.microsoft.com/en-us/azure/cdn/cdn-overview)
- [CDN Guidance - Azure Architecture Center](https://learn.microsoft.com/en-us/azure/architecture/best-practices/cdn)

---

### 2.2 Azure Front Door Standard/Premium (Recommended)

Azure Front Door is the modern unified service combining CDN, global load balancing, WAF, and intelligent routing.

#### Standard Tier
- Global CDN with caching
- SSL offload
- Custom domains with managed HTTPS certificates
- Rules engine (URL rewrite, redirect, header manipulation)
- Health probes and automatic failover
- Layer 3-4 DDoS protection
- Compression (gzip, brotli)
- **Pricing**: Based on base fees + data transfer + request count

#### Premium Tier
- All Standard features plus:
- **Web Application Firewall (WAF)** with managed rule sets
- **Bot protection**
- **Private Link** to origins
- Enhanced security reports and analytics
- Microsoft Threat Intelligence integration
- **Pricing**: Higher base fee, but includes WAF

#### Rules Engine Capabilities

The rules engine is one of Front Door's most powerful features:

**Match Conditions** (up to 10 per rule):
- Remote address (IP/CIDR)
- Request method (GET, POST, etc.)
- Query string
- Post args
- Request URI / path / path extension
- Request header
- Request scheme (HTTP/HTTPS)
- Server port
- SSL protocol
- URL file name / extension / path / full
- Cookies
- Is device (mobile/desktop)

**Actions** (up to 5 per rule):
- **URL Rewrite**: Change the request path sent to origin (e.g., `/api/v2/*` -> `/api/v3/*`)
- **URL Redirect**: Return 301/302/307/308 redirects (e.g., HTTP -> HTTPS, www -> apex)
- **Request Header Modification**: Add/overwrite/delete request headers sent to origin
- **Response Header Modification**: Add/overwrite/delete response headers sent to client
- **Route Configuration Override**: Override caching behavior, origin group, forwarding protocol

**Server Variables Available**:
- `{client_ip}`, `{client_port}`
- `{hostname}`, `{request_uri}`
- `{url_path}`, `{query_string}`
- `{http_header_name}`, `{cookie_name}`
- `{geo_country}`, `{ssl_protocol}`

#### Common E-Commerce Rules Engine Patterns

```
Rule 1: Force HTTPS
  Condition: Request scheme = HTTP
  Action: Redirect to HTTPS (301)

Rule 2: WWW to Apex Redirect
  Condition: Hostname = www.example.com
  Action: Redirect to example.com (301)

Rule 3: Add Security Headers
  Condition: Always
  Actions:
    - Add response header: X-Content-Type-Options: nosniff
    - Add response header: X-Frame-Options: DENY
    - Add response header: Strict-Transport-Security: max-age=31536000

Rule 4: Cache Static Assets Aggressively
  Condition: URL path extension = .js, .css, .png, .jpg, .woff2
  Action: Override caching TTL to 30 days

Rule 5: Bypass Cache for API
  Condition: URL path starts with /api/
  Action: Disable caching
```

Sources:
- [Azure Front Door Overview](https://learn.microsoft.com/en-us/azure/frontdoor/front-door-overview)
- [Azure Front Door Rules Engine](https://learn.microsoft.com/en-us/azure/frontdoor/front-door-rules-engine?pivots=front-door-standard-premium)
- [Rules Engine Actions](https://learn.microsoft.com/en-us/azure/frontdoor/front-door-rules-engine-actions)
- [URL Rewrite](https://learn.microsoft.com/en-us/azure/frontdoor/front-door-url-rewrite)
- [Rules Engine Scenarios](https://learn.microsoft.com/en-us/azure/frontdoor/rules-engine-scenarios)

---

### 2.3 Caching Configuration

#### Cache Behavior Options
- **Honor Origin**: Respect `Cache-Control` headers from origin
- **Override Always**: Use Front Door-specified TTL regardless of origin headers
- **Override if Origin Missing**: Use Front Door TTL only if origin does not specify caching

#### Purge Options
- **Single URL purge**: Purge specific asset by full URL
- **Wildcard purge**: Purge all assets matching a pattern (e.g., `/images/*`)
- **Purge all**: Clear entire cache (use sparingly)
- **API/CLI purge**: Automate via ARM API or Azure CLI for CI/CD pipelines

#### Compression
- Supported: gzip, brotli
- File types: JS, CSS, HTML, XML, JSON, SVG, fonts, etc.
- Minimum file size: 1 byte
- Maximum file size: 8 MB
- Can compress at the edge even if origin doesn't compress

#### Best Practices for E-Commerce
- **Static assets**: Cache for 7-30 days with content-hash file names (fingerprinting)
- **Product pages**: Cache for 1-5 minutes with stale-while-revalidate
- **API responses**: Cache selectively (product catalog: yes; cart/checkout: never)
- **Images**: Cache aggressively (30+ days); use query string versioning for updates
- **Always enable compression**: 60-80% size reduction for text-based assets

Sources:
- [Front Door Caching](https://learn.microsoft.com/en-us/azure/frontdoor/front-door-caching)
- [Compression in Front Door](https://learn.microsoft.com/en-us/azure/frontdoor/standard-premium/how-to-compression)

---

### 2.4 Custom Domains and HTTPS

- **Free managed certificates**: Front Door provides free TLS certificates (auto-renewed)
- **Bring Your Own Certificate (BYOC)**: Upload custom certificates via Azure Key Vault
- **Certificate types**: RSA and ECDSA supported
- **Domain validation**: DNS TXT record or CNAME validation
- **Minimum TLS version**: 1.2 (configurable; 1.3 recommended)
- **Custom domains per profile**: Up to 500 (Standard), 500 (Premium)

#### Setup Steps
1. Add custom domain in Front Door profile
2. Create CNAME or TXT DNS record for domain validation
3. Choose managed certificate or BYOC from Key Vault
4. Associate domain with Front Door endpoint and route
5. Configure HTTP-to-HTTPS redirect rule

---

### 2.5 Performance: PoP Locations & Latency

- **Microsoft's global network**: 192+ PoP locations across 109+ metro areas
- **Anycast routing**: DNS directs users to the nearest PoP
- **Split TCP**: Front Door terminates TLS at the edge and maintains persistent connections to origin, reducing latency
- **Connection reuse**: Multiplexed connections to origin reduce connection overhead
- **HTTP/2 and HTTP/3**: Supported at the edge
- **Dynamic Site Acceleration (DSA)**: Optimizes non-cacheable content delivery through route optimization

Sources:
- [Azure CDN POP Locations Interactive Map](https://build5nines.com/azure-cdn-endpoint-interactive-map/)
- [CDN Performance Optimization](https://learn.microsoft.com/en-us/azure/cdn/cdn-optimization-overview)

---

## 3. Azure Blob Storage

### 3.1 E-Commerce Use Cases

- **Product images and videos**: Store media assets for product catalog
- **User-generated content**: Reviews with photos, profile pictures
- **Static website assets**: CSS, JavaScript, fonts, icons
- **Document storage**: Invoices, receipts, shipping labels (PDF)
- **Export files**: Order reports, inventory exports (CSV)
- **Backup/archive**: Database backups, log archives

---

### 3.2 Access Tiers

| Tier | Access Pattern | Storage Cost | Read Cost | Min Retention | Retrieval Time |
|------|---------------|-------------|-----------|---------------|----------------|
| **Hot** | Frequently accessed | Highest | Lowest | None | Instant |
| **Cool** | Infrequently accessed (30+ days) | Lower | Higher | 30 days | Instant |
| **Cold** | Rarely accessed (90+ days) | Lower still | Higher still | 90 days | Instant |
| **Archive** | Rarely accessed (180+ days) | Lowest | Highest | 180 days | Up to 15 hours |

#### Tier Selection for E-Commerce

- **Hot**: Active product images, current CSS/JS bundles, recent order documents
- **Cool**: Product images for discontinued items, last quarter's reports
- **Cold**: Old marketing assets, historical analytics data, seasonal product media
- **Archive**: Compliance records, old invoices (7+ year retention), legacy data backups

#### Key Constraints
- Moving from warmer to cooler tier: **Instant**
- Rehydrating from Archive to online tier: **Up to 15 hours** (standard priority) or **1 hour** (high priority, higher cost)
- Early deletion penalties apply if moved before minimum retention period
- Cannot rehydrate archived blobs via lifecycle management policies (must use manual rehydration)

Sources:
- [Access Tiers for Blob Data](https://learn.microsoft.com/en-us/azure/storage/blobs/access-tiers-overview)
- [Access Tiers Best Practices](https://learn.microsoft.com/en-us/azure/storage/blobs/access-tiers-best-practices)

---

### 3.3 SAS Tokens & Container Access Policies

#### Shared Access Signatures (SAS)

SAS tokens grant limited, time-bound access to specific resources without exposing account keys.

**Types**:
- **Service SAS**: Access to a specific service (Blob, Queue, Table, File)
- **Account SAS**: Access to one or more storage services
- **User Delegation SAS**: Signed with Entra ID credentials (most secure, recommended)

**SAS Token Parameters**:
- `sv` (signed version): API version
- `ss` (signed services): b=blob, f=file, q=queue, t=table
- `srt` (signed resource types): s=service, c=container, o=object
- `sp` (signed permissions): r=read, w=write, d=delete, l=list, a=add, c=create
- `se` (signed expiry): ISO 8601 datetime
- `sip` (signed IP): Restrict to specific IP ranges
- `spr` (signed protocol): HTTPS only (recommended)

#### Stored Access Policies
- Define reusable permission sets on a container
- Up to 5 stored access policies per container
- Can revoke a policy (which revokes all SAS tokens referencing it)
- Advantage over ad-hoc SAS: Centralized revocation

#### E-Commerce SAS Patterns

```
# Upload SAS for user product reviews (write-only, 1 hour expiry)
sp=w, se=+1h, spr=https, container=user-uploads

# Download SAS for invoice retrieval (read-only, 5 minute expiry)
sp=r, se=+5m, spr=https, blob=invoices/{orderId}.pdf

# CDN origin SAS (read-only, long-lived, stored access policy)
sp=r, se=+1y, policy=cdn-read-policy, container=product-images
```

#### Security Best Practices
- **Always prefer User Delegation SAS** (Entra ID-signed) over account key SAS
- **Use HTTPS only** (`spr=https`)
- **Set shortest practical expiry time**
- **Restrict IP ranges** where possible
- **Use stored access policies** for revocability
- **Never expose SAS tokens in client-side JavaScript** -- generate server-side

Sources:
- [Storage SAS Overview](https://learn.microsoft.com/en-us/azure/storage/common/storage-sas-overview)
- [Using Azure CDN with SAS](https://learn.microsoft.com/en-us/azure/cdn/cdn-sas-storage-support)
- [Create SAS Tokens](https://learn.microsoft.com/en-us/azure/ai-services/translator/document-translation/how-to-guides/create-sas-tokens)

---

### 3.4 Static Website Hosting

Azure Storage can host static websites directly from a `$web` container.

#### Features
- **Index document**: Configurable (typically `index.html`)
- **Error document**: Custom 404 page
- **Custom domain**: Map your domain via DNS CNAME
- **HTTPS**: Requires Azure CDN or Front Door for custom domain HTTPS
- **Free hosting**: No additional cost beyond storage and bandwidth

#### Limitations
- No server-side processing (static files only)
- No auth at the storage level (use CDN/Front Door WAF for protection)
- Limited to a single storage account per static website
- No support for SPA (Single Page Application) routing natively -- requires CDN rules engine for fallback routing

#### When to Use
- Marketing landing pages
- Documentation sites
- SPA frontends (React, Next.js static export, Vue)
- Microsites for campaigns/promotions

Sources:
- [Static Website Hosting Troubleshooting](https://techcommunity.microsoft.com/blog/azurepaasblog/troubleshooting-common-issues-in-azure-storage-static-websites/3803156)
- [Azure App Service vs Blob Storage + CDN](https://learn.microsoft.com/en-us/answers/questions/2238512/azure-app-service-vs-azure-blob-storage-cdn-for-ho)

---

### 3.5 CDN Integration

#### Architecture Pattern
```
User -> Azure Front Door (edge cache + WAF + TLS)
  -> Azure Blob Storage (origin, $web container or standard container)
```

#### Configuration Steps
1. Create a Storage Account with Blob service
2. Upload assets to a container (or enable static website hosting for `$web`)
3. Create an Azure Front Door profile
4. Add origin group pointing to blob storage endpoint
5. Configure caching rules (TTL, query string behavior)
6. Set up custom domain with managed HTTPS certificate
7. Add rules for HTTP->HTTPS redirect, security headers

#### CDN with SAS Tokens
- For private containers, pass SAS token as query string on CDN origin
- Enable query string caching to ensure CDN treats each unique SAS URL separately
- Use long-lived SAS tokens for CDN origins (managed via stored access policies for revocability)
- Set CDN origin host header to match the blob storage hostname

Sources:
- [Integrate Storage Account with CDN](https://learn.microsoft.com/en-us/azure/cdn/cdn-create-a-storage-account-with-cdn)
- [Access Storage Blobs via CDN Custom Domain](https://learn.microsoft.com/en-us/azure/cdn/cdn-storage-custom-domain-https)

---

### 3.6 Lifecycle Management Policies

Lifecycle management policies automate tier transitions and blob deletion.

#### Rule Structure
```json
{
  "rules": [
    {
      "name": "moveToCoollAfter30Days",
      "type": "Lifecycle",
      "definition": {
        "filters": {
          "blobTypes": ["blockBlob"],
          "prefixMatch": ["product-images/"]
        },
        "actions": {
          "baseBlob": {
            "tierToCool": {
              "daysAfterLastAccessTimeGreaterThan": 30
            },
            "tierToCold": {
              "daysAfterLastAccessTimeGreaterThan": 90
            },
            "tierToArchive": {
              "daysAfterLastAccessTimeGreaterThan": 180
            },
            "delete": {
              "daysAfterLastAccessTimeGreaterThan": 730
            }
          }
        }
      }
    }
  ]
}
```

#### E-Commerce Lifecycle Policies

| Data Type | Hot | Cool (30d) | Cold (90d) | Archive (180d) | Delete |
|-----------|-----|-----------|-----------|----------------|--------|
| Active product images | Yes | - | - | - | - |
| Discontinued product images | 30d | Yes | 180d | - | 2 years |
| Order invoices | 30d | 90d | 1 year | 7 years | 10 years |
| User upload photos | 90d | 1 year | - | - | 2 years |
| Analytics/logs | 7d | 30d | 90d | 1 year | 3 years |
| Database backups | 7d | 30d | 90d | 1 year | 3 years |

#### Best Practices
- Enable **last access time tracking** on the storage account for access-based policies
- Use **prefix filters** to apply different policies to different data types
- Monitor lifecycle policy execution via **Azure Monitor metrics**
- **Test policies** on a non-production account first
- Consider early deletion fees when setting tier transitions

Sources:
- [Lifecycle Management Overview](https://learn.microsoft.com/en-us/azure/storage/blobs/lifecycle-management-overview)
- [Lifecycle Management Policy Access Tiers](https://learn.microsoft.com/en-us/azure/storage/blobs/lifecycle-management-policy-access-tiers)
- [Azure Storage Lifecycle Management Tips](https://n2ws.com/blog/azure-storage-lifecycle-management-pro-tips)

---

### 3.7 Blob Storage Security for E-Commerce

#### Network Security
- **Private endpoints**: Keep storage traffic on Microsoft backbone
- **Service endpoints**: Restrict access to specific VNets (less isolation than Private Link)
- **Firewall rules**: Restrict access by IP range
- **Disable public access**: Block anonymous access to all containers

#### Data Protection
- **Encryption at rest**: AES-256, enabled by default
- **Customer Managed Keys (CMK)**: Use Azure Key Vault for key management
- **Encryption in transit**: Require HTTPS (enforce via `supportsHttpsTrafficOnly`)
- **Soft delete**: Recover accidentally deleted blobs (configurable retention 1-365 days)
- **Versioning**: Maintain previous versions of blobs for rollback
- **Immutable storage**: WORM (Write Once Read Many) for compliance

#### Threat Detection
- **Microsoft Defender for Storage**: Detects unusual access patterns, data exfiltration, malicious uploads
- **Content scanning**: Scan uploaded files for malware before processing
- **WAF at CDN layer**: Filter malicious requests before they reach storage

Sources:
- [Security Recommendations for Blob Storage](https://learn.microsoft.com/en-us/azure/storage/blobs/security-recommendations)
- [Architecture Best Practices for Blob Storage](https://learn.microsoft.com/en-us/azure/well-architected/service-guides/azure-blob-storage)
- [Reliable File Upload through Azure Front Door](https://learn.microsoft.com/en-us/azure/frontdoor/scenario-upload-storage-blobs)

---

## 4. Azure Communication Services

### 4.1 Email Sending (Transactional)

#### Features
- **Transactional emails**: Order confirmations, password resets, shipping notifications
- **Bulk/marketing emails**: Newsletters, promotional campaigns
- **SMTP support**: Drop-in replacement for existing SMTP-based systems
- **SDK support**: .NET, JavaScript/TypeScript, Python, Java
- **REST API**: Direct HTTP calls for any platform
- **Custom domains**: Send from your own domain (requires DNS verification)
- **Email tracking**: Delivery status, open tracking, engagement analytics

#### Pricing
- **Pay-as-you-go**: ~$0.25 per 1,000 emails (rate may vary)
- **Attachment cost**: ~$0.00080 per MB
- **Free tier**: Up to 100 emails/day for development/testing
- **No monthly minimum** or commitment

#### Service Limits (Sandbox/Development)
- 30 emails per minute
- 100 emails per hour
- 50 recipients per SMTP send
- **Production limits**: Request increase via Azure support ticket

#### SMTP Integration
```typescript
// Node.js example with Azure Communication Services SMTP
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransporter({
  host: '<your-acs-resource>.communication.azure.com',
  port: 587,
  secure: false,
  auth: {
    user: '<your-acs-resource>.<entra-app-id>.<entra-tenant-id>',
    pass: '<entra-client-secret>',
  },
});

await transporter.sendMail({
  from: 'orders@yourdomain.com',
  to: 'customer@example.com',
  subject: 'Order Confirmation #12345',
  html: orderConfirmationTemplate,
});
```

Sources:
- [Azure Communication Services Email Overview](https://learn.microsoft.com/en-us/azure/communication-services/concepts/email/email-overview)
- [Email Pricing](https://learn.microsoft.com/en-us/azure/communication-services/concepts/email-pricing)
- [Service Limits](https://learn.microsoft.com/en-us/azure/communication-services/concepts/service-limits)
- [Replacing SendGrid with ACS](https://www.blueboxes.co.uk/replacing-sendgrid-free-tier-with-azure-communication-services-for-emails-via-smtp)

---

### 4.2 SMS Capabilities

#### Supported Number Types
- **Toll-free numbers**: US, Canada, Puerto Rico
- **Short codes**: US only
- **Alphanumeric sender IDs**: Multiple countries (for branded one-way SMS)
- **10DLC (10-Digit Long Code)**: US business messaging
- **Mobile Numbers**: Global A2P SMS

#### Features
- Two-way SMS (send and receive)
- Delivery reports and status callbacks
- Event Grid integration for incoming SMS events
- Phone number management via API
- Compliance support (10DLC registration, carrier registration)

#### Pricing
- Pay-per-message segment (varies by destination country)
- Carrier surcharges applied per message
- Phone number leasing: Monthly fee per number
- 10DLC: Brand registration + campaign registration fees

#### E-Commerce SMS Use Cases
- Order confirmation and shipping updates
- Two-factor authentication (2FA / OTP)
- Appointment/delivery reminders
- Cart abandonment recovery
- Flash sale notifications (opt-in marketing)

Sources:
- [SMS Pricing](https://learn.microsoft.com/en-us/azure/communication-services/concepts/sms-pricing)
- [Azure Communication Services Pricing](https://azure.microsoft.com/en-us/pricing/details/communication-services/)

---

### 4.3 Comparison: ACS vs SendGrid vs Mailgun

| Feature | Azure Communication Services | SendGrid (Twilio) | Mailgun |
|---------|------------------------------|-------------------|---------|
| **Email** | Yes (SMTP + SDK + REST) | Yes (best-in-class) | Yes (SMTP + REST) |
| **SMS** | Yes (built-in) | Via Twilio (separate) | No |
| **Voice/Video** | Yes (built-in) | Via Twilio (separate) | No |
| **Chat** | Yes (built-in) | No | No |
| **WhatsApp** | Yes (Advanced Messaging) | Via Twilio | No |
| **Free tier** | 100 emails/day | 60-day trial (was free tier) | 100 emails/day |
| **Pricing model** | Pay-per-use | Tiered plans | Tiered plans |
| **Email analytics** | Basic (delivery status) | Advanced (opens, clicks, heatmaps) | Good (opens, clicks) |
| **Template engine** | Basic | Advanced (visual editor) | Good (template API) |
| **Deliverability tools** | Domain auth (SPF/DKIM) | Expert deliverability, dedicated IPs | Dedicated IPs, IP warming |
| **Azure integration** | Native (Event Grid, Monitor) | Via marketplace (being sunset) | Via API |
| **SMTP relay** | Yes | Yes | Yes |

#### Recommendations
- **Choose ACS if**: You want a single Azure-native service for email + SMS + more, with simple pay-per-use pricing and tight Azure ecosystem integration
- **Choose SendGrid if**: Email is your primary channel, you need advanced deliverability features, template management, and analytics (note: SendGrid free tier removed May 2025)
- **Choose Mailgun if**: You need strong SMTP relay performance and are not invested in Azure ecosystem

Sources:
- [SendGrid vs Azure Communication Services (NashTech)](https://blog.nashtechglobal.com/acs-vs-twilio-sendgrid/)
- [ACS vs SendGrid (Microsoft Q&A)](https://learn.microsoft.com/en-us/answers/questions/1397173/sendgrid-or-azure-communication-services-or-outloo)
- [Mailgun vs ACS (StackShare)](https://stackshare.io/stackups/azure-communication-services-vs-mailgun)

---

## 5. Azure Service Bus / Event Grid

### 5.1 Azure Service Bus

#### Core Concepts

**Queues** (Point-to-Point):
- Single consumer receives and processes each message
- FIFO ordering (with message sessions)
- At-least-once delivery guarantee
- Message size: up to 256 KB (Standard) or 100 MB (Premium)
- Maximum queue size: 1-80 GB

**Topics & Subscriptions** (Publish/Subscribe):
- One-to-many communication
- Each subscription receives a copy of every message
- Filter rules on subscriptions (SQL-like expressions or correlation filters)
- Multiple consumers can process different aspects of the same event

#### E-Commerce Message Flow Example
```
Order Placed
  -> Service Bus Topic: "order-events"
    -> Subscription: "payment-processor" (filter: eventType = 'OrderCreated')
    -> Subscription: "inventory-service" (filter: eventType = 'OrderCreated')
    -> Subscription: "notification-service" (filter: eventType = 'OrderCreated')
    -> Subscription: "analytics-service" (all events)
```

#### Dead-Letter Queue (DLQ)

The DLQ holds messages that cannot be delivered or processed:

**Automatic dead-lettering triggers**:
- Message exceeds `MaxDeliveryCount` (default: 10 retries)
- Message TTL expires
- Subscription filter evaluation exception
- Queue/subscription max size exceeded

**DLQ Management Patterns**:
1. **Manual inspection**: Dashboard for support team to review failed messages
2. **Auto-resubmit**: Azure Function periodically reprocesses DLQ messages
3. **Alert + fix + resubmit**: Monitor DLQ count, alert operations, fix root cause, bulk resubmit
4. **Dead-letter to archive**: Move permanently failed messages to storage for audit

```typescript
// Node.js example: Processing DLQ messages
import { ServiceBusClient } from '@azure/service-bus';

const sbClient = new ServiceBusClient(connectionString);
const dlqReceiver = sbClient.createReceiver(queueName, {
  subQueueType: 'deadLetter',
});

const messages = await dlqReceiver.receiveMessages(10);
for (const message of messages) {
  console.log(`DLQ Reason: ${message.deadLetterReason}`);
  console.log(`DLQ Description: ${message.deadLetterErrorDescription}`);
  // Inspect, fix, and optionally resubmit to main queue
  await dlqReceiver.completeMessage(message);
}
```

#### Retry Mechanisms
- **Client SDK retry**: Configurable via `ServiceBusClientOptions.RetryOptions`
- **Retry modes**: Fixed delay or exponential backoff
- **Max retries**: Configurable (default varies by SDK)
- **Lock duration**: Default 30 seconds; message becomes available to other receivers if not completed
- **Max delivery count**: Default 10; after exhaustion, message moves to DLQ

#### Message Sessions (Ordered Processing)
- Group related messages with a `sessionId`
- Guarantees FIFO processing within a session
- **E-commerce use**: All messages for a single order share `sessionId = orderId`
- Only one consumer can process a session at a time

#### Tiers

| Feature | Basic | Standard | Premium |
|---------|-------|----------|---------|
| **Queues** | Yes | Yes | Yes |
| **Topics** | No | Yes | Yes |
| **Message size** | 256 KB | 256 KB | 100 MB |
| **Throughput** | Variable | Variable | Dedicated (1-16 messaging units) |
| **VNet/Private Link** | No | No | Yes |
| **Geo-disaster recovery** | No | Yes | Yes |
| **JMS 2.0** | No | No | Yes |
| **Transactions** | No | Yes | Yes |

Sources:
- [Service Bus Queues, Topics, Subscriptions](https://learn.microsoft.com/en-us/azure/service-bus-messaging/service-bus-queues-topics-subscriptions)
- [Service Bus Dead-Letter Queues](https://learn.microsoft.com/en-us/azure/service-bus-messaging/service-bus-dead-letter-queues)
- [Reprocessing Dead-Letter Messages](https://www.serverlessnotes.com/docs/how-to-reprocess-dead-letter-messages-in-service-bus-queues)

---

### 5.2 Azure Event Grid

#### Core Concepts

- **Events**: What happened (e.g., "BlobCreated", "OrderShipped")
- **Event Sources**: Where the event originated (Azure services or custom apps)
- **Topics**: Endpoint where events are published
  - **System topics**: Automatically created for Azure service events
  - **Custom topics**: Your application publishes events here
- **Subscriptions**: Route events to handlers with optional filtering
- **Event Handlers**: Azure Functions, webhooks, Service Bus, Storage Queue, Event Hubs

#### Event Delivery Models

**Push delivery (HTTP Push)**: Events pushed to subscriber endpoint
- Best for reactive systems needing instant response
- Webhook endpoints must implement validation handshake
- At-least-once delivery guarantee
- Retry with exponential backoff (up to 24 hours)

**Pull delivery** (newer model): Subscribers poll for events
- Better for high-throughput batch processing
- Client controls rate of consumption

#### Event Filtering

**Event type filtering**:
```json
{
  "filter": {
    "includedEventTypes": ["Microsoft.Storage.BlobCreated"]
  }
}
```

**Subject filtering**:
```json
{
  "filter": {
    "subjectBeginsWith": "/blobServices/default/containers/product-images/",
    "subjectEndsWith": ".jpg"
  }
}
```

**Advanced filtering**:
```json
{
  "filter": {
    "advancedFilters": [
      {
        "operatorType": "StringIn",
        "key": "data.orderStatus",
        "values": ["shipped", "delivered"]
      }
    ]
  }
}
```

#### E-Commerce Event Grid Patterns

```
Azure Blob Storage -> Event Grid -> Azure Function (image resizer)
  Event: BlobCreated in product-images container
  Handler: Resize to thumbnail, medium, large; store back in Blob

Stripe Webhook -> API endpoint -> Custom Event Grid Topic -> Multiple Subscribers
  Event: payment.succeeded
  Subscribers:
    - Order service (mark order as paid)
    - Notification service (send confirmation email)
    - Analytics (record transaction)

Azure Communication Services -> Event Grid -> Azure Function
  Event: EmailDeliveryReportReceived
  Handler: Update email status in database, trigger retry for bounced emails
```

#### Security
- **HTTPS only**: All webhook endpoints must use HTTPS
- **Entra ID authentication**: Secure webhook delivery with OAuth tokens
- **Managed Identity**: Event Grid can use managed identity to deliver events
- **Private endpoints**: For Event Grid topics/domains in isolated networks

Sources:
- [Compare Azure Messaging Services](https://learn.microsoft.com/en-us/azure/service-bus-messaging/compare-messaging-services)
- [Event-Driven Architecture Style](https://learn.microsoft.com/en-us/azure/architecture/guide/architecture-styles/event-driven)
- [Webhooks as Event Handlers](https://learn.microsoft.com/en-us/azure/event-grid/handler-webhooks)
- [Secure Webhook Delivery](https://learn.microsoft.com/en-us/azure/event-grid/secure-webhook-delivery)
- [Building Scalable Event-Driven Architectures](https://multishoring.com/blog/building-scalable-event-driven-architectures-with-azure-event-grid-and-service-bus/)

---

### 5.3 Service Bus vs Event Grid vs Storage Queue

| Aspect | Service Bus | Event Grid | Storage Queue |
|--------|-------------|------------|---------------|
| **Pattern** | Command/message queue | Event notification | Simple task queue |
| **Delivery** | Pull (receiver fetches) | Push (delivered to endpoint) | Pull (receiver fetches) |
| **Ordering** | FIFO (with sessions) | No ordering guarantee | FIFO (approximate) |
| **Transactions** | Yes (Standard+) | No | No |
| **Dead-lettering** | Yes (built-in) | Yes (to Storage/Event Hub) | No |
| **Duplicate detection** | Yes | No | No |
| **Max message size** | 256 KB / 100 MB | 1 MB (Cloud Events) | 64 KB |
| **Max queue size** | 1-80 GB | N/A (serverless) | Up to 500 TB |
| **Latency** | Milliseconds | Sub-second | Milliseconds |
| **Throughput** | High (Premium: dedicated) | Very high (10M events/sec) | High (2000 msg/sec/queue) |
| **Cost** | Moderate-High | Very low (per event) | Very low (per operation) |
| **Best for** | Ordered workflows, transactions, critical messages | React to events, fan-out notifications | Simple background tasks, decoupling |

#### E-Commerce Recommendation

Use **all three** in combination:

1. **Event Grid**: React to system events (blob uploads, resource changes, webhook ingestion)
2. **Service Bus**: Process business-critical operations (orders, payments, fulfillment) with guaranteed delivery, ordering, and dead-letter handling
3. **Storage Queue**: Simple background tasks (report generation, non-critical notifications, batch processing)

```
                                    ┌─ Service Bus ─── Order Processor
                                    │    (critical,     Payment Handler
Customer Order ──> API ──> Event Grid    ordered)       Inventory Update
                                    │
                                    ├─ Azure Function ─ Send Confirmation Email
                                    │    (reactive)
                                    │
                                    └─ Storage Queue ── Generate Invoice PDF
                                         (background)    Update Analytics
```

Sources:
- [Compare Azure Messaging Services](https://learn.microsoft.com/en-us/azure/service-bus-messaging/compare-messaging-services)
- [Asynchronous Messaging Options](https://learn.microsoft.com/en-us/azure/architecture/guide/technology-choices/messaging)
- [Azure Event-Driven Architectures](https://www.thecloudguru.in/2025/09/25/azure-event-driven-architectures-event-grid-service-bus-or-event-hubs/)
- [Choosing the Right Messaging Backbone](https://prashantbiztalkblogs.wordpress.com/2025/06/21/event-grid-vs-service-bus-vs-event-hubs-vs-storage-queues-choosing-the-right-messaging-backbone-in-azure/)
- [Azure Event-Driven Architecture Deep Dive (Medium)](https://medium.com/codetodeploy/azure-event-driven-architecture-a-real-world-deep-dive-into-event-grid-service-bus-and-event-4921e762da7c)

---

## Summary: Recommended Architecture for E-Commerce

```
                          ┌──────────────────────────────────────────┐
                          │         Azure Front Door Premium         │
                          │  (CDN + WAF + Rules Engine + TLS)        │
                          └──────────────┬───────────────────────────┘
                                         │
                    ┌────────────────────┼────────────────────┐
                    │                    │                     │
            Static Assets          API Routes           Media Uploads
                    │                    │                     │
        ┌───────────┴──────┐    ┌───────┴────────┐   ┌───────┴────────┐
        │  Blob Storage    │    │  App Service/   │   │  Blob Storage  │
        │  ($web or CDN)   │    │  Container Apps │   │  (SAS uploads) │
        └──────────────────┘    └───────┬────────┘   └────────────────┘
                                        │
                     ┌──────────────────┼──────────────────┐
                     │                  │                   │
              ┌──────┴──────┐   ┌──────┴──────┐    ┌──────┴──────┐
              │ Azure Redis │   │  Service Bus │    │ Event Grid  │
              │ (cache +    │   │  (orders,    │    │ (webhooks,  │
              │  sessions)  │   │  payments)   │    │  events)    │
              └─────────────┘   └─────────────┘    └─────────────┘
                                        │
                                ┌───────┴────────┐
                                │ Communication  │
                                │  Services      │
                                │ (email + SMS)  │
                                └────────────────┘
```

### Cost Optimization Tips
1. **Redis**: Start with Standard C1 (~$80/mo); upgrade to Premium only when you need persistence/VNet
2. **Front Door**: Standard tier sufficient for most; upgrade to Premium only if WAF/bot protection needed
3. **Blob Storage**: Implement lifecycle policies from day one; use Cool tier for anything >30 days old
4. **Communication Services**: Pay-per-use is cost-effective for transactional email; no minimum commitment
5. **Service Bus**: Standard tier sufficient for most e-commerce; Premium only for VNet isolation or >256KB messages
6. **Event Grid**: Extremely cost-effective at $0.60 per million events; use for all event routing

---

*This report covers Azure services as of February 2026. Azure CDN landscape is in significant transition -- always verify current availability and retirement timelines before making architecture decisions.*
