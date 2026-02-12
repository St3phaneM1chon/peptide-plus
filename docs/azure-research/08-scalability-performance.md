# Azure Scalability & Performance Optimization for E-Commerce Web Applications

## Comprehensive Performance Report

**Date**: February 2026
**Scope**: Azure infrastructure scaling, caching, CDN, database optimization, load testing, and geographic distribution for e-commerce workloads.

---

## Table of Contents

1. [Auto-Scaling Strategies](#1-auto-scaling-strategies)
2. [Azure Front Door](#2-azure-front-door)
3. [Database Performance (PostgreSQL)](#3-database-performance-postgresql)
4. [Caching Architecture](#4-caching-architecture)
5. [Static Asset Optimization](#5-static-asset-optimization)
6. [Load Testing on Azure](#6-load-testing-on-azure)
7. [Geographic Distribution](#7-geographic-distribution)
8. [E-Commerce Architecture Reference](#8-e-commerce-architecture-reference)
9. [Black Friday / Peak Event Preparation Checklist](#9-black-friday--peak-event-preparation-checklist)

---

## 1. Auto-Scaling Strategies

### 1.1 App Service Auto-Scale Rules

Azure App Service provides two scaling paradigms: **rule-based autoscale** (via Azure Monitor) and **automatic scaling** (a newer platform-managed feature for Premium V2/V3 plans).

#### Metric-Based Rules

| Metric | Scale-Out Trigger | Scale-In Trigger | Notes |
|--------|-------------------|------------------|-------|
| **CPU Percentage** | > 70% average over 10 min | < 35% average over 10 min | Most common metric; use 5-10 min aggregation windows to avoid flapping |
| **Memory Percentage** | > 80% average over 10 min | < 50% average over 10 min | Critical for memory-intensive workloads (large catalogs, image processing) |
| **HTTP Queue Length** | > 100 requests queued | < 20 requests queued | Indicates request backlog; signals compute saturation before CPU spikes |
| **Data In / Data Out** | Application-specific threshold | Corresponding low threshold | Useful for download-heavy or API-heavy patterns |
| **Socket Count** | > threshold (varies by SKU) | < threshold | Tracks active TCP connections |

**Rule Logic**: Azure applies OR logic for scale-out (any rule triggers expansion) and AND logic for scale-in (all rules must agree before contracting). You can define up to 10 rules per autoscale profile.

**Cooldown Period**: After a scale operation, Azure enforces a cooldown period (default 5 minutes, configurable) to prevent thrashing. For e-commerce applications, a 5-10 minute cooldown is recommended during normal operations.

#### Schedule-Based Rules

Schedule-based scaling is critical for predictable traffic patterns in e-commerce:

```
Profile: "Business Hours"
  Schedule: Monday-Friday, 08:00-20:00 UTC
  Minimum instances: 4
  Maximum instances: 20
  Default instances: 6

Profile: "Weekend Peak"
  Schedule: Saturday-Sunday, 10:00-22:00 UTC
  Minimum instances: 6
  Maximum instances: 30
  Default instances: 8

Profile: "Black Friday"
  Schedule: Specific date range
  Minimum instances: 15
  Maximum instances: 50
  Default instances: 20
```

Schedule-based rules can be combined with metric-based rules. The schedule sets the baseline instance count, and metric rules allow dynamic adjustment within the defined min/max bounds.

#### Automatic Scaling (Platform-Managed)

Available on **Premium V2 and Premium V3** plans, automatic scaling eliminates the need for manual rule configuration:

- **Maximum Burst**: Defines the ceiling for instance count during sudden traffic surges. Must be >= current instance count.
- **Always Ready Instances**: Pre-loaded instances kept warm with your application code, ready to serve traffic immediately. Prevents cold-start latency.
- **Pre-Warmed Instances**: Buffer instances that fill in behind always-ready instances as they become active. As active instances scale up, pre-warmed instances are promoted and new pre-warmed instances are provisioned to maintain the buffer.

**Example flow for a traffic spike**:
1. 3 Always Ready instances are serving baseline traffic
2. Traffic spike begins; all 3 instances become active under load
3. 1 Pre-warmed instance is immediately promoted to active (no cold start)
4. A new pre-warmed instance is provisioned in the background
5. If traffic continues rising, the cycle repeats up to the Maximum Burst limit

### 1.2 Scale-Out vs Scale-Up Decisions

| Factor | Scale-Out (Horizontal) | Scale-Up (Vertical) |
|--------|----------------------|---------------------|
| **Use Case** | Handle more concurrent requests | Handle more compute-intensive requests per instance |
| **Downtime** | Zero downtime (instances added/removed behind load balancer) | Brief downtime (1-2 minutes during VM migration) |
| **Cost Model** | Pay per instance; more granular cost control | Larger VMs cost more; less granular |
| **Limits** | Up to 30 instances (Premium V3), 100 with ASE | Limited by largest available SKU |
| **Best For** | Stateless web apps, API tiers, microservices | Single-threaded workloads, applications requiring more RAM per process |
| **Recovery** | Azure drains connections and migrates instances one-by-one | App restarts on new hardware |

**Recommendation for E-Commerce**: Prefer **scale-out** as the primary strategy. E-commerce web applications are typically stateless (sessions in Redis, data in PostgreSQL) and benefit more from distributing load across many instances. Use scale-up only when the application genuinely needs more per-instance resources (e.g., upgrading from P1V3 to P2V3 for more memory per worker).

**Premium V3 SKU Specifications**:

| SKU | vCPUs | RAM | Storage | Monthly Cost (approx.) |
|-----|-------|-----|---------|----------------------|
| P0V3 | 1 | 4 GB | 250 GB | ~$80 |
| P1V3 | 2 | 8 GB | 250 GB | ~$160 |
| P2V3 | 4 | 16 GB | 250 GB | ~$320 |
| P3V3 | 8 | 32 GB | 250 GB | ~$640 |
| P1MV3 | 2 | 16 GB | 250 GB | Memory-optimized |
| P2MV3 | 4 | 32 GB | 250 GB | Memory-optimized |
| P3MV3 | 8 | 64 GB | 250 GB | Memory-optimized |

### 1.3 Pre-Warming for Traffic Spikes

For major e-commerce events (Black Friday, Cyber Monday, flash sales):

1. **Always Ready Instances**: Set to your expected baseline load (e.g., 10-15 instances for a major sale event). These instances are fully warmed with your application code and dependencies loaded.

2. **Pre-Warmed Buffer**: Configure 2-3 pre-warmed instances beyond your always-ready count to absorb the initial surge.

3. **Maximum Burst**: Set to 2-3x your expected peak. For Black Friday, if you expect 20 instances at peak, set Maximum Burst to 40-50.

4. **Staging Slot Warm-Up**: Use deployment slots with the "swap with preview" feature. This runs your application against production settings in a staging slot, allowing initialization routines (cache warming, connection pool establishment) to complete before the swap.

5. **Application Initialization Module**: Configure `applicationInitialization` in web.config (for .NET) or equivalent health check endpoints that the platform hits before marking an instance as ready:

```xml
<applicationInitialization>
  <add initializationPage="/api/health" />
  <add initializationPage="/api/warmup" />
</applicationInitialization>
```

6. **Pre-Scale Before Events**: 2-4 hours before a major sale event, manually increase the minimum instance count to your anticipated baseline. Do not rely solely on reactive autoscaling for known traffic spikes.

---

## 2. Azure Front Door

### 2.1 Global Load Balancing

Azure Front Door operates on Microsoft's global edge network across **100+ points of presence (PoPs)** worldwide. It provides Layer 7 (HTTP/HTTPS) load balancing with:

**Traffic Routing Methods**:
- **Latency-based**: Routes users to the origin with the lowest measured network latency. This is the default and recommended method for e-commerce.
- **Priority-based**: Designates a primary origin group with failover to secondary origins. Priority values range from 1-1000 (lower = higher priority).
- **Weighted**: Distributes traffic proportionally across origins based on assigned weights (1-1000). Useful for canary deployments or gradual migrations.

**Origin Group Configuration**:
```
Origin Group: "ecommerce-primary"
  Origin 1: app-eastus.azurewebsites.net (priority: 1, weight: 1000)
  Origin 2: app-westeurope.azurewebsites.net (priority: 1, weight: 1000)
  Origin 3: app-southeastasia.azurewebsites.net (priority: 2, weight: 1000)

  Load Balancing:
    Sample size: 5
    Successful samples required: 3
    Latency sensitivity: 200ms
```

The latency sensitivity setting determines how Front Door distributes traffic: origins within the sensitivity threshold of the fastest origin all receive traffic proportionally.

### 2.2 WAF Policies for DDoS Protection

Azure Front Door includes built-in **Layer 3, 4, and 7 DDoS protection**. The Web Application Firewall (WAF) adds application-layer security.

**Standard Tier Security**:
- Basic DDoS protection (always-on, no additional cost)
- Managed rule sets for OWASP Top 10
- Custom rules (IP restriction, geo-filtering, rate limiting)

**Premium Tier Security** (recommended for e-commerce):
- Everything in Standard
- Bot protection managed rule set
- Microsoft Threat Intelligence integration
- Azure Private Link support for origin connectivity
- Advanced security analytics

**Key WAF Rules for E-Commerce**:

```
Rule Set: Microsoft_DefaultRuleSet_2.1
  - SQL Injection detection
  - Cross-Site Scripting (XSS) prevention
  - Remote Command Execution blocking
  - Local File Inclusion prevention
  - Protocol enforcement

Custom Rules:
  - Rate Limiting: Max 1000 requests/min per IP on /api/* endpoints
  - Geo-Blocking: Block traffic from non-target markets (if applicable)
  - Bot Protection: Challenge suspicious automated traffic on checkout flows
  - IP Allowlisting: Restrict /admin/* to known IP ranges
```

**DDoS Mitigation Capabilities**:
- Continuous traffic monitoring with anomaly detection
- Distinguishes legitimate traffic spikes (flash sales) from malicious patterns
- Absorbs volumetric attacks at the edge before reaching origins
- Azure DDoS Protection now supports QUIC protocol mitigation

### 2.3 Session Affinity

Azure Front Door provides **cookie-based session affinity** using managed cookies:

- Cookies: `ASLBSA` and `ASLBSACORS`
- Cookie value: SHA256 hash of the origin URL
- Configured at the **origin group level** in Standard/Premium tiers

**Important behavior**:
- Session affinity is NOT established for cacheable responses
- Session affinity IS established when:
  - Response includes `Cache-Control: no-store`
  - Response contains a valid `Authorization` header
  - Response is HTTP 302

**E-Commerce Recommendation**: For a properly architected e-commerce application with externalized session state (Redis), session affinity is generally **not needed** and should be **disabled**. Disabling it allows Front Door to optimally distribute requests for better performance. Enable session affinity only if the application has in-memory state dependencies that cannot be externalized.

### 2.4 Health Probes and Failover

**Probe Configuration**:

| Setting | Recommended Value | Reasoning |
|---------|-------------------|-----------|
| Protocol | HTTPS | Match production traffic |
| Method | HEAD | Reduces load on origin vs GET |
| Path | /api/health | Dedicated health endpoint that checks dependencies |
| Interval | 30 seconds | Balance between fast detection and probe volume |
| Sample Size | 5 | Evaluates last 5 probes (150 seconds of data) |
| Successful Samples | 3 | Requires 3/5 success for "healthy" status |

**Probe Volume Calculation**: With 100 global PoPs and 30-second intervals, each origin receives approximately **200 probe requests per minute**. Use HEAD method to minimize impact.

**Failover Behavior**:
1. Front Door detects origin unhealthy (< 3/5 probes succeed)
2. Traffic routes to next-priority healthy origin in the origin group
3. When the primary origin recovers (3/5 probes succeed), traffic gradually returns
4. Failover is automatic and transparent to end users

**Health Endpoint Best Practice**: The health probe endpoint should verify all critical dependencies:
```javascript
// Example health check endpoint
app.get('/api/health', async (req, res) => {
  const checks = {
    database: await checkPostgresConnection(),
    redis: await checkRedisConnection(),
    storage: await checkBlobStorageAccess(),
  };
  const allHealthy = Object.values(checks).every(v => v === true);
  res.status(allHealthy ? 200 : 503).json(checks);
});
```

### 2.5 Edge Caching with Rules Engine

**Cache Behavior Options**:
- **Honor Origin**: Follows `Cache-Control` headers from the origin server
- **Override Always**: Caches for a specified duration regardless of origin headers
- **Override If Origin Missing**: Uses specified TTL only when origin lacks cache headers

**Rules Engine Actions for E-Commerce**:

```
Rule 1: "Cache Product Images"
  Condition: URL Path matches /images/products/*
  Action: Override cache TTL = 7 days
  Action: Enable query string caching (include all)

Rule 2: "Cache Static Assets"
  Condition: URL file extension = .css, .js, .woff2, .svg
  Action: Override cache TTL = 30 days
  Action: Modify response header: Cache-Control = public, max-age=2592000

Rule 3: "No Cache for Cart/Checkout"
  Condition: URL Path matches /cart/* OR /checkout/*
  Action: Disable caching
  Action: Set response header: Cache-Control = no-store, no-cache

Rule 4: "Cache API Product Catalog"
  Condition: URL Path matches /api/products/* AND Request Method = GET
  Action: Override cache TTL = 5 minutes
  Action: Cache every unique URL (include query strings)

Rule 5: "Redirect HTTP to HTTPS"
  Condition: Request scheme = HTTP
  Action: URL redirect (301) to HTTPS
```

### 2.6 HTTP/2 and HTTP/3 Support

**HTTP/2**:
- Fully supported on Azure Front Door for client-to-edge connections
- Backend/origin connections use HTTP/1.1
- Benefits: multiplexing, header compression, server push
- Enabled by default; no configuration required

**HTTP/3 (QUIC)**:
- **Azure Front Door does NOT currently support HTTP/3** (as of early 2026)
- Azure Application Gateway has HTTP/3 support in **private preview**
- Azure DDoS Protection supports QUIC protocol mitigation by default
- If HTTP/3 is a hard requirement, consider Azure Application Gateway behind Front Door, or use Cloudflare/Fastly as a complementary CDN layer

---

## 3. Database Performance (PostgreSQL)

### 3.1 Connection Pooling with PgBouncer

Azure Database for PostgreSQL Flexible Server includes **built-in PgBouncer** that can be enabled with a single parameter change.

**Configuration**:
```
Server Parameter: pgbouncer.enabled = true
PgBouncer Port: 6432 (application connects here instead of 5432)
Default Pool Mode: Transaction
```

**Pool Modes**:

| Mode | Description | Best For |
|------|-------------|----------|
| **Session** | Connection held for entire client session | Legacy apps with session-level features (LISTEN/NOTIFY, prepared statements with named cursors) |
| **Transaction** | Connection assigned per transaction, released between transactions | **Recommended for e-commerce** - most efficient use of connections |
| **Statement** | Connection assigned per statement | Multi-statement transactions not possible; rarely used |

**Key PgBouncer Parameters for E-Commerce**:

```ini
# Maximum client connections PgBouncer will accept
pgbouncer.max_client_conn = 2000

# Default pool size per user/database pair
pgbouncer.default_pool_size = 50

# Minimum pool size maintained even with no clients
pgbouncer.min_pool_size = 10

# Extra connections allowed when pool is exhausted
pgbouncer.reserve_pool_size = 5

# Time before reserve pool connections are released
pgbouncer.reserve_pool_timeout = 5

# Server-side idle timeout
pgbouncer.server_idle_timeout = 600

# Ignore startup parameters that PgBouncer can't handle
pgbouncer.ignore_startup_parameters = extra_float_digits,options
```

**Why Connection Pooling Matters for E-Commerce**:
- Each PostgreSQL connection consumes ~10MB of server memory
- Without pooling, 500 concurrent users = 500 connections = ~5GB just for connections
- With transaction pooling (default_pool_size=50), 500 concurrent users share 50 backend connections
- Reduces connection establishment overhead (PostgreSQL fork per connection)

**Monitoring**: PgBouncer metrics are emitted at 1-minute intervals with 93 days of history:
- Active connections, idle connections, total pooled connections
- Number of connection pools
- Available via Azure Monitor and `SHOW STATS` / `SHOW POOLS` commands

### 3.2 Read Replicas for Read-Heavy Workloads

E-commerce workloads are typically **80-90% reads** (product browsing, search, catalog) and 10-20% writes (orders, cart updates, user registration).

**Azure PostgreSQL Read Replica Features**:
- Up to **5 read replicas** per primary server
- Replicas can be in the **same region or cross-region** (geo-replicas)
- Asynchronous replication with typical lag of seconds
- Replicas can have different compute tiers and IOPS configurations
- Replicas support independent scaling

**Architecture Pattern**:
```
                     +---> Read Replica 1 (Product catalog queries)
                     |
Write Traffic -----> Primary Server
                     |
Read Traffic  -----> Read Replica 2 (Search & browse queries)
                     |
                     +---> Read Replica 3 (Analytics & reporting)
```

**Application-Level Read/Write Splitting**:
```javascript
// Connection configuration
const primaryPool = new Pool({
  host: 'primary-server.postgres.database.azure.com',
  port: 6432, // PgBouncer
  // ... credentials
});

const replicaPool = new Pool({
  host: 'replica-server.postgres.database.azure.com',
  port: 6432, // PgBouncer on replica
  // ... credentials
});

// Route queries based on type
async function query(sql, params, isWrite = false) {
  const pool = isWrite ? primaryPool : replicaPool;
  return pool.query(sql, params);
}

// Usage
const products = await query('SELECT * FROM products WHERE category_id = $1', [categoryId]); // reads from replica
const order = await query('INSERT INTO orders ...', [orderData], true); // writes to primary
```

### 3.3 Query Optimization with pg_stat_statements

**Enabling pg_stat_statements**:
```sql
-- Enable via Azure Portal: Server Parameters
-- shared_preload_libraries = 'pg_stat_statements'
-- (Requires server restart)

-- After restart, create extension
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
```

**Performance Caveat**: pg_stat_statements hooks into every query execution and writes query text to disk. There is a non-trivial performance overhead. Azure recommends using **either** pg_stat_statements **or** Query Store, not both simultaneously.

**Key Queries for E-Commerce Optimization**:

```sql
-- Top 10 queries by total execution time
SELECT
  queryid,
  calls,
  total_exec_time::numeric(20,2) AS total_time_ms,
  mean_exec_time::numeric(20,2) AS avg_time_ms,
  rows,
  query
FROM pg_stat_statements
ORDER BY total_exec_time DESC
LIMIT 10;

-- Top 10 queries by I/O consumption
SELECT
  queryid,
  calls,
  shared_blks_read + shared_blks_written AS total_io_blocks,
  (shared_blks_read + shared_blks_written)::float / calls AS io_per_call,
  query
FROM pg_stat_statements
WHERE calls > 100
ORDER BY total_io_blocks DESC
LIMIT 10;

-- Queries with highest cache miss ratio
SELECT
  queryid,
  calls,
  shared_blks_hit,
  shared_blks_read,
  CASE WHEN shared_blks_hit + shared_blks_read > 0
    THEN round(100.0 * shared_blks_read / (shared_blks_hit + shared_blks_read), 2)
    ELSE 0
  END AS cache_miss_pct,
  query
FROM pg_stat_statements
WHERE calls > 50
ORDER BY cache_miss_pct DESC
LIMIT 10;
```

**Common E-Commerce Query Optimizations**:

| Problem | Solution |
|---------|----------|
| Full table scan on products | Add composite index on (category_id, is_active, created_at DESC) |
| Slow text search | Use pg_trgm extension + GIN index, or Azure Cognitive Search |
| N+1 queries for product variants | Use JOINs or lateral joins; consider materialized views |
| Slow order history queries | Partition orders table by date; archive old orders |
| Lock contention on inventory updates | Use SELECT ... FOR UPDATE SKIP LOCKED; consider optimistic locking |

### 3.4 IOPS Scaling and Storage Auto-Grow

**Premium SSD (Standard)**:
- Baseline: 3,000 IOPS for disks up to 399 GiB
- Baseline: 12,000 IOPS for disks 400 GiB and above
- Additional provisioned IOPS available beyond baseline
- **Storage auto-grow supported**: Automatically increases storage when usage approaches the limit

**Premium SSD v2 (Preview)**:
- Up to 64 TiB storage
- Up to 80,000 IOPS
- Up to 1,200 MB/s throughput
- IOPS and throughput independently configurable
- Performance adjustments: up to 4 times per 24-hour period
- **Storage auto-grow NOT supported** on Premium SSD v2

**IOPS Monitoring and Right-Sizing**:
```
Azure Monitor Metrics:
  - io_consumption_percent: Percentage of provisioned IOPS used
  - storage_percent: Percentage of storage used
  - read_iops: Current read IOPS
  - write_iops: Current write IOPS

Alert Rules:
  - io_consumption_percent > 80% for 15 min -> Scale IOPS
  - storage_percent > 85% -> Increase storage (or verify auto-grow)
```

### 3.5 Intelligent Performance Features

**Query Performance Insight** (Azure Portal):
- Dashboard showing top queries by: Calls, Data Usage, IOPS, Temporary File Usage
- Visual timeline of query performance over time
- Identifies slow queries and resource-intensive operations

**Azure Advisor Recommendations**:
- Automatic detection of missing indexes
- Identification of unused indexes consuming write overhead
- Connection pattern analysis
- Storage and compute right-sizing recommendations

**Intelligent Tuning**:
- Automatic creation of recommended indexes
- Identification and removal of unused indexes
- Query plan regression detection

---

## 4. Caching Architecture

### 4.1 Multi-Tier Caching: CDN -> Redis -> Application -> Database

```
User Request
    |
    v
[Azure Front Door CDN / Edge Cache]  <-- Layer 1: Static assets, cached API responses
    |  (cache miss)
    v
[Azure Cache for Redis]              <-- Layer 2: Session data, product cache, cart data
    |  (cache miss)
    v
[Application Memory Cache]           <-- Layer 3: Hot configuration, feature flags, rate limits
    |  (cache miss)
    v
[Azure PostgreSQL]                   <-- Layer 4: Source of truth
    |
    v
Response (+ populate caches on the way back up)
```

**Layer 1 - CDN Edge Cache**:
- Scope: Static assets (images, CSS, JS), cacheable API responses (product listings)
- TTL: Minutes to days depending on content type
- Invalidation: Cache purge API, versioned URLs, short TTLs for dynamic content
- Technology: Azure Front Door built-in caching

**Layer 2 - Redis Cache**:
- Scope: User sessions, shopping carts, product details, inventory counts, search results
- TTL: Seconds to hours depending on data volatility
- Invalidation: Event-driven + TTL-based hybrid
- Technology: Azure Cache for Redis (Premium or Enterprise tier)

**Layer 3 - Application Memory Cache**:
- Scope: Configuration values, feature flags, frequently-accessed reference data
- TTL: 30 seconds to 5 minutes
- Invalidation: Periodic refresh from Redis
- Technology: Node.js in-memory Map/LRU cache, or node-cache library

**Layer 4 - Database**:
- Scope: All persistent data
- PostgreSQL shared_buffers acts as an internal page cache
- Read replicas distribute read load

### 4.2 Cache Invalidation Strategies

| Strategy | Mechanism | Best For | Trade-Off |
|----------|-----------|----------|-----------|
| **TTL Expiration** | Set expire time on cache entries | Product listings, search results | Stale data within TTL window |
| **Event-Driven Invalidation** | Publish invalidation events via Redis Pub/Sub | Inventory updates, price changes | Implementation complexity |
| **Write-Through** | Update cache simultaneously with DB write | Shopping cart, user preferences | Write latency increase |
| **Cache-Aside (Lazy Loading)** | Load into cache only on cache miss | Product details, category trees | First request after expiry is slow |
| **Versioned Keys** | Include version number in cache key | Catalog schema changes, migrations | Storage overhead for multiple versions |

**Recommended Hybrid Approach for E-Commerce**:

```javascript
// Cache-aside pattern with event-driven invalidation
class ProductCache {
  constructor(redis, db) {
    this.redis = redis;
    this.db = db;
    this.TTL = 300; // 5 minutes

    // Subscribe to invalidation events
    this.redis.subscribe('product:invalidate', (productId) => {
      this.redis.del(`product:${productId}`);
    });
  }

  async getProduct(productId) {
    // Try cache first
    const cached = await this.redis.get(`product:${productId}`);
    if (cached) return JSON.parse(cached);

    // Cache miss: load from database
    const product = await this.db.query(
      'SELECT * FROM products WHERE id = $1', [productId]
    );

    // Store in cache with TTL
    await this.redis.setex(
      `product:${productId}`,
      this.TTL,
      JSON.stringify(product)
    );

    return product;
  }

  async updateProduct(productId, data) {
    // Update database
    await this.db.query('UPDATE products SET ... WHERE id = $1', [productId]);

    // Invalidate cache immediately
    await this.redis.del(`product:${productId}`);

    // Publish invalidation event (for other app instances)
    await this.redis.publish('product:invalidate', productId);
  }
}
```

### 4.3 Redis Data Structures for E-Commerce

**Sorted Sets (ZSET) - Product Rankings and Leaderboards**:

```redis
# Track best-selling products (score = units sold)
ZINCRBY bestsellers:daily 1 "product:12345"
ZINCRBY bestsellers:weekly 1 "product:12345"

# Get top 20 best sellers
ZREVRANGE bestsellers:daily 0 19 WITHSCORES

# Track trending products (score = view count in last hour)
ZINCRBY trending:products 1 "product:67890"

# Get products ranked between positions 10-20
ZREVRANGE trending:products 9 19 WITHSCORES

# Price range queries (score = price in cents)
ZADD products:category:electronics 9999 "product:111"
ZADD products:category:electronics 14999 "product:222"
ZRANGEBYSCORE products:category:electronics 5000 15000 WITHSCORES
```

**Hashes - Session and Cart Data**:

```redis
# User session storage
HSET session:abc123 userId "user:456"
HSET session:abc123 email "user@example.com"
HSET session:abc123 role "customer"
HSET session:abc123 lastActive "2026-02-11T10:30:00Z"
EXPIRE session:abc123 3600  # 1 hour TTL

# Shopping cart
HSET cart:user:456 "product:111" '{"qty":2,"price":9999,"name":"Widget"}'
HSET cart:user:456 "product:222" '{"qty":1,"price":14999,"name":"Gadget"}'

# Get entire cart
HGETALL cart:user:456

# Get cart item count
HLEN cart:user:456
```

**Strings with Expiry - Inventory Locks and Rate Limiting**:

```redis
# Inventory reservation (prevent overselling during checkout)
SET inventory:lock:product:111 "order:789" EX 300 NX
# Returns OK if lock acquired, nil if already locked

# Rate limiting (sliding window)
SET ratelimit:user:456:api 1 EX 60 NX
INCR ratelimit:user:456:api
# Check: if value > 100 -> rate limited
```

**Lists - Recent Activity and Queues**:

```redis
# Recently viewed products per user
LPUSH user:456:recent "product:111"
LTRIM user:456:recent 0 19  # Keep only last 20

# Order processing queue
LPUSH queue:orders '{"orderId":"789","action":"process"}'
BRPOP queue:orders 30  # Blocking pop with 30s timeout
```

**Azure Redis Tier Recommendations for E-Commerce**:

| Tier | Memory | Use Case | Geo-Replication |
|------|--------|----------|-----------------|
| **Standard C2** | 6 GB | Small e-commerce (< 10K daily users) | No |
| **Premium P2** | 13 GB | Medium e-commerce (10K-100K daily users) | Passive geo-replication |
| **Enterprise E10** | 12 GB | Large e-commerce (100K+ daily users) | Active geo-replication (multi-region writes) |
| **Enterprise Flash EF** | 384 GB | Very large catalogs, ML features | Active geo-replication |

---

## 5. Static Asset Optimization

### 5.1 Azure CDN for Images, CSS, JS

**Architecture**:
```
Azure Blob Storage (origin)
    |
    v
Azure Front Door CDN (edge cache + compression + rules)
    |
    v
End User (served from nearest PoP)
```

**CDN Configuration for E-Commerce**:

```
Caching Rules:
  *.css, *.js  -> Cache 30 days, query string versioning
  *.woff2      -> Cache 365 days (fonts rarely change)
  *.jpg, *.png, *.webp -> Cache 7 days
  *.svg        -> Cache 30 days

Cache Key:
  Include query string (for cache busting: style.css?v=1.2.3)

Response Headers:
  Cache-Control: public, max-age=2592000, immutable  (for versioned assets)
  Vary: Accept-Encoding  (for compressed assets)
```

**Content Fingerprinting** (recommended over query string versioning):
```
# Instead of: /css/style.css?v=1.2.3
# Use:        /css/style.a1b2c3d4.css

# Benefits:
# - CDN caches treat different filenames as different objects
# - No issues with CDN configurations that ignore query strings
# - Works with all CDN providers
# - Enables "immutable" cache header (browser never revalidates)
```

### 5.2 Image Optimization

**Native Azure Capabilities**:
- Azure CDN Image Processing: scaling, cropping, format conversion (JPG, PNG, BMP, WebP, GIF, TIF)
- Azure Blob Storage: no built-in optimization (stores as uploaded)

**Recommended Image Pipeline**:

```
Upload -> Azure Function (resize/optimize) -> Blob Storage -> Front Door CDN -> User

Pipeline Steps:
1. Original uploaded to "originals" container
2. Azure Function triggered on blob creation
3. Function generates multiple variants:
   - Thumbnail: 150x150, WebP, quality 80
   - Small: 400x400, WebP, quality 85
   - Medium: 800x800, WebP, quality 85
   - Large: 1200x1200, WebP, quality 90
   - Original: preserved as-is
4. Variants stored in "optimized" container
5. Front Door serves from "optimized" container with CDN caching
```

**Third-Party Image CDN Solutions** (for more advanced needs):
- **ImageKit**: Automatic WebP/AVIF conversion, real-time transformations, URL-based resizing
- **Cloudinary**: Comprehensive image and video optimization
- **imgix**: Real-time image processing with URL parameters

**Format Comparison**:

| Format | Compression | Browser Support | Best For |
|--------|-------------|-----------------|----------|
| JPEG | Good | Universal | Photos, product images |
| PNG | Moderate | Universal | Graphics with transparency |
| WebP | Very Good (25-35% smaller than JPEG) | 97%+ browsers | Primary format for modern e-commerce |
| AVIF | Excellent (50% smaller than JPEG) | ~90% browsers | Next-gen format; use with WebP fallback |

### 5.3 Brotli/Gzip Compression

**Azure Front Door Compression**:
- Supports both **Brotli** and **Gzip**
- Brotli takes precedence when the client supports it (via `Accept-Encoding: br`)
- Compression is applied at the edge PoP for cache misses, then the compressed version is cached
- Configuration changes take up to 10 minutes to propagate globally

**Compression Effectiveness**:

| Content Type | Gzip Reduction | Brotli Reduction |
|-------------|----------------|------------------|
| HTML | 60-70% | 70-80% |
| CSS | 70-80% | 80-85% |
| JavaScript | 60-75% | 70-80% |
| JSON (API responses) | 70-80% | 75-85% |
| SVG | 50-65% | 60-70% |

**Eligible MIME Types for Compression** (configure in Front Door):
```
application/javascript
application/json
application/xml
text/css
text/html
text/javascript
text/plain
text/xml
image/svg+xml
application/x-font-woff
font/woff2
```

**Origin-Side Compression** (recommended complement to CDN):
```javascript
// Express.js with compression middleware
const compression = require('compression');

app.use(compression({
  filter: (req, res) => {
    if (req.headers['x-no-compression']) return false;
    return compression.filter(req, res);
  },
  level: 6, // Balanced speed/ratio for gzip
  threshold: 1024, // Only compress responses > 1KB
}));
```

---

## 6. Load Testing on Azure

### 6.1 Azure Load Testing Service

Azure Load Testing is a fully managed service that supports Apache JMeter and Locust test scripts at cloud scale.

**Key Capabilities**:
- Upload existing JMeter (.jmx) or Locust scripts
- Scale to thousands of concurrent virtual users
- Automatic collection of server-side metrics for Azure-hosted resources
- AI-powered insights for bottleneck identification
- Pass/fail criteria for automated regression detection
- Integration with Azure Monitor for comprehensive observability

**E-Commerce Test Scenarios**:

```
Test Plan: "E-Commerce Peak Load Simulation"

Thread Group 1: "Browsing Users" (70% of load)
  - GET /api/products?category=electronics (browse catalog)
  - GET /api/products/{id} (view product detail)
  - GET /api/products/{id}/reviews (view reviews)
  - Think time: 5-15 seconds between requests

Thread Group 2: "Shopping Users" (20% of load)
  - POST /api/cart/add (add to cart)
  - GET /api/cart (view cart)
  - PUT /api/cart/{itemId} (update quantity)
  - DELETE /api/cart/{itemId} (remove item)
  - Think time: 3-10 seconds

Thread Group 3: "Checkout Users" (10% of load)
  - POST /api/checkout/initiate
  - POST /api/checkout/payment
  - GET /api/orders/{id} (order confirmation)
  - Think time: 10-30 seconds

Ramp-Up:
  - Start: 100 virtual users
  - Ramp to 5,000 over 15 minutes
  - Sustain 5,000 for 30 minutes
  - Ramp to 10,000 over 10 minutes (peak simulation)
  - Sustain 10,000 for 15 minutes
  - Ramp down to 0 over 5 minutes
```

### 6.2 JMeter Integration

**Creating a JMeter-Based Load Test**:
1. Author your JMeter test plan (.jmx file) locally
2. Upload the .jmx file and any supporting files (CSV data, JARs) to Azure Load Testing
3. Configure test parameters (virtual users, duration, ramp-up)
4. Add Azure resource components for server-side metric collection
5. Define pass/fail criteria
6. Run the test

**Supported JMeter Features**:
- Thread Groups (standard, stepping, ultimate)
- HTTP samplers with SSL/TLS
- CSV Data Set Config
- Timers (constant, Gaussian, uniform random)
- Assertions (response, duration, size)
- Variables and functions
- Custom JMeter plugins (upload as JAR files)

**Pass/Fail Criteria Examples**:
```yaml
failureCriteria:
  - metric: response_time_ms
    aggregate: avg
    condition: '>'
    value: 2000
    action: stop
  - metric: error_percentage
    aggregate: avg
    condition: '>'
    value: 5
    action: stop
  - metric: response_time_ms
    aggregate: p99
    condition: '>'
    value: 5000
    action: continue  # Flag but don't stop
```

### 6.3 Performance Baselines

**Establishing Baselines**:

| Metric | Baseline Target | Warning Threshold | Critical Threshold |
|--------|-----------------|-------------------|--------------------|
| Response Time (avg) | < 500ms | > 1,000ms | > 2,000ms |
| Response Time (p95) | < 1,500ms | > 3,000ms | > 5,000ms |
| Response Time (p99) | < 3,000ms | > 5,000ms | > 10,000ms |
| Error Rate | < 0.1% | > 1% | > 5% |
| Throughput | > 1,000 req/s | < 800 req/s | < 500 req/s |
| CPU Utilization | < 60% | > 75% | > 90% |
| Memory Utilization | < 70% | > 80% | > 90% |
| Database Connections | < 70% pool capacity | > 80% | > 90% |

**CI/CD Integration**:

```yaml
# Azure DevOps Pipeline integration
- task: AzureLoadTest@1
  inputs:
    azureSubscription: 'production-subscription'
    loadTestConfigFile: 'tests/load/config.yaml'
    loadTestResource: 'ecommerce-load-testing'
    resourceGroup: 'rg-ecommerce-testing'
    env: |
      [
        { "name": "TARGET_URL", "value": "$(STAGING_URL)" },
        { "name": "VIRTUAL_USERS", "value": "1000" },
        { "name": "DURATION_SECONDS", "value": "300" }
      ]
```

**Recent Enhancements (2025)**:
- Application components and monitoring metrics configurable directly from CI/CD pipeline
- Azure DevOps task output variables consumable in downstream steps, jobs, and stages
- Pass/fail criteria on server-side metrics (CPU, memory, IOPS) from CI/CD
- Historical test run comparison for visual regression detection

---

## 7. Geographic Distribution

### 7.1 Multi-Region Deployment Patterns

**Pattern 1: Active-Passive (Hot Standby)**

```
Primary Region (East US)           Secondary Region (West Europe)
+---------------------------+      +---------------------------+
| Azure Front Door (Global) |      |                           |
|           |                |      |                           |
| App Service (active)      |      | App Service (standby)     |
| PostgreSQL (primary)      | ---> | PostgreSQL (read replica)  |
| Redis (primary)           |      | Redis (geo-replica)       |
| Blob Storage (GRS)        |      | Blob Storage (paired)     |
+---------------------------+      +---------------------------+

Traffic: 100% -> Primary
Failover: Automatic via Front Door health probes
RTO: 5-15 minutes
RPO: Seconds (async replication lag)
```

**Pattern 2: Active-Active (Multi-Region)**

```
Azure Front Door (Global Load Balancer, latency-based routing)
           |
    +------+------+
    |             |
Region 1       Region 2
(East US)      (West Europe)
    |             |
App Service    App Service
(active)       (active)
    |             |
PostgreSQL     PostgreSQL
(primary)      (read replica*)
    |             |
Redis          Redis
(active geo)   (active geo)

* Writes route to primary region; reads served locally
* For true multi-master PostgreSQL, consider Azure Cosmos DB for PostgreSQL
```

**Pattern 3: Follow-the-Sun**

```
Peak Hours Shift:
  Asia-Pacific: 00:00-08:00 UTC  -> Southeast Asia region primary
  Europe:       08:00-16:00 UTC  -> West Europe region primary
  Americas:     16:00-00:00 UTC  -> East US region primary

Implementation: Azure Traffic Manager with weighted routing
  Adjust weights on schedule to favor the region experiencing peak traffic
  All regions maintain read replicas; writes route to a single primary
```

### 7.2 Azure Traffic Manager for Geo-Routing

**Routing Methods**:

| Method | Description | E-Commerce Use Case |
|--------|-------------|---------------------|
| **Performance** | Routes to lowest-latency endpoint | Default: serve users from nearest region |
| **Priority** | Routes to highest-priority available endpoint | DR failover: primary -> secondary |
| **Weighted** | Distributes by weight percentage | Canary releases: 95% stable, 5% canary |
| **Geographic** | Routes by user's geographic location | Data sovereignty, regional pricing |
| **MultiValue** | Returns multiple healthy endpoints | Client-side load balancing |
| **Subnet** | Routes by client subnet | Enterprise/partner-specific routing |

**Nested Profiles for Complex E-Commerce Routing**:
```
Parent Profile (Geographic routing)
  |
  +-- Europe -> Child Profile 1 (Performance routing)
  |     +-- West Europe App Service
  |     +-- North Europe App Service
  |
  +-- North America -> Child Profile 2 (Performance routing)
  |     +-- East US App Service
  |     +-- West US App Service
  |
  +-- Asia Pacific -> Child Profile 3 (Priority routing)
        +-- Southeast Asia App Service (priority 1)
        +-- Australia East App Service (priority 2)
```

**Traffic Manager vs Front Door**:

| Feature | Traffic Manager | Front Door |
|---------|----------------|------------|
| Layer | DNS-based (L4) | HTTP-based (L7) |
| Failover Speed | DNS TTL dependent (30s-300s) | Near-instant (health probe interval) |
| Caching | No | Yes (edge cache) |
| WAF | No | Yes |
| SSL Offloading | No | Yes |
| URL Path Routing | No | Yes |
| Session Affinity | No | Yes |
| Best For | Multi-region DNS routing | Global HTTP load balancing + security |

**Recommendation**: Use **Azure Front Door** as the primary global entry point (with WAF, caching, and fast failover). Use **Traffic Manager** only if you need DNS-level routing for non-HTTP protocols or as a secondary routing layer.

### 7.3 Database Geo-Replication

**Azure PostgreSQL Flexible Server Geo-Replication**:

- Cross-region read replicas in any supported Azure region
- Asynchronous replication (eventual consistency)
- Replica promotion to standalone read-write server for DR
- Replica can have different compute/storage tiers

**Important Limitations**:
- No native multi-master / active-active writes
- Writes must go to the single primary server
- Promoted replicas do NOT automatically get HA enabled (must activate post-promotion)
- Replication lag varies by write volume and network distance

**For True Multi-Region Writes**:
Consider **Azure Cosmos DB for PostgreSQL** (formerly Hyperscale/Citus), which provides:
- Distributed PostgreSQL with sharding
- Multi-region writes (with conflict resolution)
- Up to 99.999% availability with active geo-replication
- Compatible with PostgreSQL wire protocol

**Blob Storage Geo-Redundancy**:

| Option | Description | Read Access to Secondary |
|--------|-------------|------------------------|
| LRS | 3 copies in single datacenter | No |
| ZRS | 3 copies across availability zones | No |
| GRS | LRS + async copy to paired region | No (until failover) |
| GZRS | ZRS + async copy to paired region | No (until failover) |
| RA-GRS | GRS + read access to secondary | Yes (read-only) |
| RA-GZRS | GZRS + read access to secondary | Yes (read-only) |

**Recommendation for E-Commerce**: Use **RA-GZRS** for blob storage containing product images and static assets. This provides zone-level + region-level redundancy with read access to the secondary region for serving static content.

---

## 8. E-Commerce Architecture Reference

### Complete Azure E-Commerce Reference Architecture

```
                           Internet Users
                                |
                     +----------v-----------+
                     |   Azure Front Door   |
                     |  (CDN + WAF + LB)    |
                     +----------+-----------+
                                |
              +-----------------+-----------------+
              |                                   |
     +--------v--------+               +---------v--------+
     | Region: East US |               | Region: W Europe |
     |                 |               |                  |
     | App Service     |               | App Service      |
     | (Premium V3)    |               | (Premium V3)     |
     | Auto-scale:     |               | Auto-scale:      |
     |  2-30 instances |               |  2-20 instances  |
     +--------+--------+               +---------+--------+
              |                                   |
     +--------v--------+               +---------v--------+
     | Redis Premium   |   <------->   | Redis Premium    |
     | (Session, Cart, |  Geo-Replica  | (Session, Cart,  |
     |  Product Cache) |               |  Product Cache)  |
     +--------+--------+               +---------+--------+
              |                                   |
     +--------v--------+               +---------v--------+
     | PostgreSQL      |   ---------> | PostgreSQL       |
     | Flexible Server | Async Repl.  | Read Replica     |
     | (Primary - R/W) |               | (Read Only)      |
     +--------+--------+               +---------+--------+
              |
     +--------v--------+
     | Blob Storage     |
     | (RA-GZRS)        |
     | Product Images   |
     | Static Assets    |
     +-----------------+
```

### Key Services and Their Roles

| Service | Role | Tier Recommendation |
|---------|------|---------------------|
| Azure Front Door | Global LB, CDN, WAF, DDoS protection | Premium |
| App Service | Application hosting | Premium V3 (P2V3 or P3V3) |
| Azure Cache for Redis | Session, cart, product cache | Premium P2+ or Enterprise E10 |
| PostgreSQL Flexible Server | Primary database | General Purpose D4ds_v5 or Memory Optimized E4ds_v5 |
| Azure Blob Storage | Static assets, images | RA-GZRS |
| Azure Load Testing | Performance validation | Standard |
| Azure Monitor | Observability, alerting | Standard |
| Azure Key Vault | Secrets management | Standard |

---

## 9. Black Friday / Peak Event Preparation Checklist

### 8 Weeks Before

- [ ] **Baseline Load Test**: Run comprehensive load tests to establish current performance baselines
- [ ] **Capacity Planning**: Based on projected traffic (previous year + growth), calculate required instances
- [ ] **Database Optimization**: Run pg_stat_statements analysis, create missing indexes, optimize slow queries
- [ ] **Redis Sizing**: Verify Redis tier can handle projected session/cart volume

### 4 Weeks Before

- [ ] **Scale-Up Database**: If needed, upgrade PostgreSQL compute tier (this causes brief downtime)
- [ ] **Add Read Replicas**: Deploy additional read replicas for anticipated read load
- [ ] **CDN Cache Warming**: Pre-populate CDN cache with product images and static assets
- [ ] **WAF Tuning**: Review WAF rules; ensure bot protection won't block legitimate traffic spikes

### 2 Weeks Before

- [ ] **Full-Scale Load Test**: Simulate expected Black Friday traffic patterns including the spike
- [ ] **Stress Test**: Push beyond expected peak to find breaking points and set alerts
- [ ] **Verify Autoscale**: Confirm autoscale rules trigger correctly and new instances warm up within acceptable time
- [ ] **Test Failover**: Simulate region failure; verify Front Door failover works correctly

### 1 Week Before

- [ ] **Pre-Scale**: Increase minimum instance counts to expected baseline
- [ ] **Set Always Ready Instances**: Configure to expected sustained load level
- [ ] **Increase Maximum Burst**: Set to 2-3x expected peak
- [ ] **Pre-Provision IOPS**: Increase PostgreSQL IOPS if on provisioned model

### Day Of

- [ ] **Monitor Dashboard**: Have Azure Monitor dashboards open with key metrics
- [ ] **Scale Instances**: If using manual pre-scaling, increase to target instance count
- [ ] **Disable Non-Critical Deployments**: Freeze all code deployments
- [ ] **On-Call Team**: Ensure team is available for rapid response to alerts

### Post-Event

- [ ] **Collect Metrics**: Export all performance data for analysis
- [ ] **Scale Down**: Gradually reduce instance counts as traffic normalizes
- [ ] **Cost Analysis**: Review actual spend vs projected for future planning
- [ ] **Lessons Learned**: Document any issues, bottlenecks, or surprises for next event

---

## Sources

### Auto-Scaling
- [Azure App Service Automatic Scaling](https://learn.microsoft.com/en-us/azure/app-service/manage-automatic-scaling)
- [Scale Up Features and Capacities](https://learn.microsoft.com/en-us/azure/app-service/manage-scale-up)
- [Autoscaling Guidance - Azure Architecture Center](https://learn.microsoft.com/en-us/azure/architecture/best-practices/auto-scaling)
- [Best Practices for Autoscale - Azure Monitor](https://learn.microsoft.com/en-us/azure/azure-monitor/autoscale/autoscale-best-practices)
- [Configure Premium V3 Tier](https://learn.microsoft.com/en-us/azure/app-service/app-service-configure-premium-v3-tier)
- [Azure Functions Premium Plan (Pre-warming)](https://learn.microsoft.com/en-us/azure/azure-functions/functions-premium-plan)
- [App Service Warm-Up Demystified](https://michaelcandido.com/app-service-warm-up-demystified/)

### Azure Front Door
- [Azure Front Door Overview](https://learn.microsoft.com/en-us/azure/frontdoor/front-door-overview)
- [DDoS Protection on Azure Front Door](https://learn.microsoft.com/en-us/azure/frontdoor/front-door-ddos)
- [Front Door Caching](https://learn.microsoft.com/en-us/azure/frontdoor/front-door-caching)
- [Rules Engine Actions](https://learn.microsoft.com/en-us/azure/frontdoor/front-door-rules-engine-actions)
- [Health Probes](https://learn.microsoft.com/en-us/azure/frontdoor/health-probes)
- [Best Practices - Azure Front Door](https://learn.microsoft.com/en-us/azure/frontdoor/best-practices)
- [Traffic Routing Methods](https://learn.microsoft.com/en-us/azure/frontdoor/routing-methods)
- [High Availability Implementation Guide](https://learn.microsoft.com/en-us/azure/frontdoor/high-availability)

### Database Performance
- [Connection Pooling Best Practices](https://learn.microsoft.com/en-us/azure/postgresql/flexible-server/concepts-connection-pooling-best-practices)
- [PgBouncer Best Practices Part 1](https://techcommunity.microsoft.com/blog/adforpostgresql/pgbouncer-best-practices-in-azure-database-for-postgresql-%E2%80%93-part-1/4453323)
- [PgBouncer in Azure Database for PostgreSQL](https://learn.microsoft.com/en-us/azure/postgresql/flexible-server/concepts-pgbouncer)
- [Read Replicas](https://learn.microsoft.com/en-us/azure/postgresql/flexible-server/concepts-read-replicas)
- [Query Performance Insight](https://learn.microsoft.com/en-us/azure/postgresql/monitor/concepts-query-performance-insight)
- [Optimize Query Stats Collection](https://learn.microsoft.com/en-us/azure/postgresql/flexible-server/how-to-optimize-query-stats-collection)
- [High IOPS Utilization](https://learn.microsoft.com/en-us/azure/postgresql/flexible-server/how-to-high-io-utilization)
- [Premium SSD v2](https://learn.microsoft.com/en-us/azure/postgresql/flexible-server/concepts-storage-premium-ssd-v2)
- [Performance Best Practices for Azure PostgreSQL](https://azure.microsoft.com/en-us/blog/performance-best-practices-for-using-azure-database-for-postgresql/)

### Caching
- [Azure Cache for Redis Overview](https://learn.microsoft.com/en-us/azure/azure-cache-for-redis/cache-overview)
- [Azure Managed Redis Architecture](https://learn.microsoft.com/en-us/azure/redis/architecture)
- [Cache-Aside Leaderboard Tutorial](https://learn.microsoft.com/en-us/azure/redis/web-app-cache-aside-leaderboard)
- [Redis Cache Invalidation](https://redis.io/glossary/cache-invalidation/)
- [Three Ways to Maintain Cache Consistency](https://redis.io/blog/three-ways-to-maintain-cache-consistency/)
- [Redis Sorted Sets](https://redis.io/glossary/redis-sorted-sets/)

### Static Assets & CDN
- [Improve Performance by Compressing Files - Azure CDN](https://learn.microsoft.com/en-us/azure/cdn/cdn-improve-performance)
- [Compression in Azure Front Door](https://learn.microsoft.com/en-us/azure/frontdoor/standard-premium/how-to-compression)
- [Azure CDN Image Processing](https://docs.azure.cn/en-us/cdn/cdn-image-processing)
- [Optimize and Resize Images in Azure Blob Storage](https://imagekit.io/blog/optimize-and-resize-images-in-azure-blob/)

### Load Testing
- [Azure Load Testing Overview](https://learn.microsoft.com/en-us/azure/app-testing/load-testing/overview-what-is-azure-load-testing)
- [Azure Load Testing Guide for Cloud and AI Era](https://www.shiham-sham.com/2025/07/06/azure-load-testing-guide-for-performance-testing-in-cloud-and-ai-era/)
- [Create JMeter-Based Load Test](https://learn.microsoft.com/en-us/azure/app-testing/load-testing/how-to-create-and-run-load-test-with-jmeter-script)
- [Automate Regression Tests with CI/CD](https://learn.microsoft.com/en-us/azure/load-testing/tutorial-identify-performance-regression-with-cicd)
- [CI/CD Enhancements for Azure Load Testing](https://techcommunity.microsoft.com/blog/appsonazureblog/announcing-cicd-enhancements-for-azure-load-testing/4400837)

### Geographic Distribution
- [Multi-Region Load Balancing](https://learn.microsoft.com/en-us/azure/architecture/high-availability/reference-architecture-traffic-manager-application-gateway)
- [Highly Available Multi-Region Web App](https://azure.github.io/AppService/2022/12/02/multi-region-web-app.html)
- [Traffic Manager Routing Methods](https://learn.microsoft.com/en-us/azure/traffic-manager/traffic-manager-routing-methods)
- [PostgreSQL Geo-Replication](https://learn.microsoft.com/en-us/azure/postgresql/flexible-server/concepts-read-replicas-geo)
- [Designing Multi-Region Active-Active Architecture](https://www.mscloudbros.com/2025/09/04/designing-a-multi-region-active-active-architecture-reliability/)

### E-Commerce Architecture
- [Architect Scalable E-Commerce Web App](https://learn.microsoft.com/en-us/azure/architecture/web-apps/idea/scalable-ecommerce-web-app)
- [E-Commerce Front End - Azure Architecture Center](https://learn.microsoft.com/en-us/azure/architecture/example-scenario/apps/ecommerce-scenario)
- [Performance Efficiency Checklist - Azure Well-Architected Framework](https://learn.microsoft.com/en-us/azure/well-architected/performance-efficiency/checklist)
- [Architecture Best Practices for App Service](https://learn.microsoft.com/en-us/azure/well-architected/service-guides/app-service-web-apps)
