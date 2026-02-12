# Azure Database for PostgreSQL -- Flexible Server: Comprehensive Reference Guide

---

## 1. Architecture

### Deployment Options on Azure

Azure offers three PostgreSQL deployment models:

| Option | Description | Use Case |
|--------|-------------|----------|
| **Flexible Server** | Fully managed, separated compute/storage architecture on Linux VMs | Default choice for all new workloads; migrating existing PostgreSQL/Oracle apps |
| **Single Server** (RETIRED) | Legacy managed service, retired March 28, 2025 | No longer available for new deployments |
| **Cosmos DB for PostgreSQL** | Distributed PostgreSQL powered by the Citus extension | Horizontally scaled, multi-node, globally distributed apps |

### Flexible Server Architecture

The architecture **separates compute and storage**:

- **Compute**: The database engine runs inside a container on a Linux virtual machine. You select the VM size (Burstable, General Purpose, or Memory Optimized).
- **Storage**: Data files reside on Azure Premium SSD or Premium SSD v2 managed disks, with **three locally redundant synchronous copies** for durability.
- **Backups**: Automatically stored in Zone-Redundant Storage (ZRS) with three synchronous copies, encrypted with AES-256.
- **Networking**: You choose at creation time between Public access (firewall rules), VNet Integration (injection), or Private Link (private endpoints).

### Cosmos DB for PostgreSQL vs Flexible Server

- **Cosmos DB for PostgreSQL** uses a "shared-nothing" distributed architecture: a coordinator node manages metadata and query planning, while worker nodes store sharded data and execute queries in parallel. Best for apps needing horizontal scaling of both reads and writes across multiple nodes.
- **Flexible Server** is a single-node managed PostgreSQL (with optional read replicas). Best for traditional workloads, modernization of existing PostgreSQL or Oracle databases, and when a single powerful node suffices.

Sources: [Service Overview](https://learn.microsoft.com/en-us/azure/postgresql/flexible-server/service-overview), [Flexible Server Overview](https://learn.microsoft.com/en-us/azure/postgresql/flexible-server/overview), [Choosing PostgreSQL on Azure](https://techcommunity.microsoft.com/blog/adforpostgresql/postgresql-on-azure-%E2%80%93-how-to-choose-what%E2%80%99s-best-for-your-app/3784537), [Single Server vs Flexible Server](https://learn.microsoft.com/en-us/azure/postgresql/flexible-server/concepts-compare-single-server-flexible-server)

---

## 2. Configuration Parameters

### Server Parameters

Azure exposes PostgreSQL server parameters through the Azure Portal, CLI, ARM templates, and Terraform. Key categories:

- **Connections**: `max_connections`, `superuser_reserved_connections`, `tcp_keepalives_idle`, `tcp_keepalives_interval`
- **Memory**: `shared_buffers`, `work_mem`, `maintenance_work_mem`, `effective_cache_size`
- **WAL**: `wal_buffers`, `max_wal_size`, `min_wal_size`, `checkpoint_completion_target`
- **Autovacuum**: `autovacuum_max_workers`, `autovacuum_vacuum_scale_factor`, `autovacuum_naptime`, `autovacuum_vacuum_threshold`, `autovacuum_cost_limit`, `autovacuum_vacuum_cost_delay`
- **Logging**: `log_min_duration_statement`, `log_statement`, `log_checkpoints`
- **Locale/Formatting**: `DateStyle`, `timezone`, `client_encoding`, `password_encryption`

### Extension-Defined Parameters

- `pg_stat_statements.max` (pg_stat_statements)
- `pg_qs.max_query_text_length` (Query Store)
- `pgaudit.log_catalog`, `pgaudit.log` (pgAudit)
- `cron.database_name` (pg_cron)

### azure.extensions Parameter

Extensions must be **allowlisted** before they can be created. This is done via the `azure.extensions` server parameter:

```bash
az postgres flexible-server parameter set \
  --resource-group myRG \
  --server-name myServer \
  --name azure.extensions \
  --value "pg_stat_statements,pgcrypto,vector,postgis,pg_cron"
```

Then in SQL:
```sql
CREATE EXTENSION pg_stat_statements;
CREATE EXTENSION vector;  -- pgvector
```

### pg_hba.conf

You do **not** have direct access to `pg_hba.conf` on Flexible Server. Azure manages it automatically based on your networking configuration (firewall rules, VNet integration, or Private Link). TLS is enforced by default and cannot be disabled.

Sources: [Server Parameters](https://learn.microsoft.com/en-us/azure/postgresql/flexible-server/concepts-server-parameters), [Allow Extensions](https://learn.microsoft.com/en-us/azure/postgresql/extensions/how-to-allow-extensions)

---

## 3. High Availability

### HA Models

| Model | SLA | Description |
|-------|-----|-------------|
| **No HA** (default) | 99.9% | Single node with built-in storage redundancy (3 local copies) |
| **Same-Zone HA** | 99.95% | Warm standby in the same availability zone, synchronous replication |
| **Zone-Redundant HA** | 99.99% | Warm standby in a different availability zone, synchronous replication |

### How It Works

- A **warm standby replica** is provisioned with the same compute and storage as the primary.
- Data changes are **synchronously replicated** to the standby, ensuring **zero data loss** during failover.
- WAL (Write-Ahead Log) files are archived to zone-redundant backup storage.

### Failover Mechanisms

- **Planned (Manual) Failover**: Initiated by the user for maintenance or testing. The standby becomes the new primary.
- **Unplanned (Automatic) Failover**: Triggered by Azure when hardware/network failures are detected. The standby comes online immediately.
- **Forced Failover**: Can be triggered for disaster recovery testing.

### Failover Timing

- Typical failover completes in **60-120 seconds**.
- DNS is updated to point to the new primary; applications reconnect using the same connection string.
- PgBouncer (if enabled) seamlessly restarts on the promoted standby.

### Considerations

- **Write latency impact**: Synchronous replication adds some latency to writes/commits (varies by SKU and region).
- **Read queries are not affected** by the synchronous replication.
- HA **doubles the compute and storage cost** (you pay for both primary and standby).
- HA is available on General Purpose and Memory Optimized tiers only (not Burstable).

Sources: [Reliability and HA](https://learn.microsoft.com/en-us/azure/reliability/reliability-azure-database-postgresql), [Configure HA](https://learn.microsoft.com/en-us/azure/postgresql/high-availability/how-to-configure-high-availability)

---

## 4. Backup and Restore

### Automated Backups

- **Full backups**: Taken weekly.
- **Differential backups**: Taken twice daily.
- **Transaction log (WAL) backups**: Taken every 5 minutes (or sooner based on WAL generation).
- All backups are encrypted at rest with AES-256.

### Retention Period

- Default: **7 days**
- Configurable: **7 to 35 days**
- Can be set at creation or modified later.

### Backup Redundancy Options

| Option | Description |
|--------|-------------|
| **Locally Redundant (LRS)** | 3 copies in the same datacenter |
| **Zone-Redundant (ZRS)** | 3 copies across availability zones in the same region (default) |
| **Geo-Redundant (GRS)** | Asynchronous copy to the Azure paired region; up to 1 hour delay |

### Point-in-Time Restore (PITR)

- Restore to **any point in time** within the retention period.
- Creates a **new server** in the same region (you cannot restore in-place).
- You can choose the availability zone for the restored server.
- Supports **Fast Restore** for recent recovery points.

### Geo-Restore

- When geo-redundant backup is enabled, you can restore to the **Azure paired region**.
- Creates a new server in the paired region from the geo-replicated backup.
- Useful for regional disaster recovery.

### Backup Pricing

- **Free backup storage**: Equal to 100% of your provisioned server storage.
- **Additional backup storage**: Billed per GiB/month beyond the free tier.
- Example: 512 GiB server gets 512 GiB free backup. If backups total 612 GiB, you pay for the extra 100 GiB.

Sources: [Backup and Restore](https://learn.microsoft.com/en-us/azure/postgresql/flexible-server/concepts-backup-restore), [Geo-Restore](https://learn.microsoft.com/en-us/azure/postgresql/flexible-server/how-to-restore-paired-region)

---

## 5. Security

### Encryption

- **At rest**: FIPS 140-2 validated AES-256 encryption for all data, backups, and temporary files. Customer-managed keys (CMK) supported via Azure Key Vault.
- **In transit**: TLS enforced by default; cannot be disabled. Only TLS 1.2 and TLS 1.3 are accepted as secure versions.

### TLS/SSL Configuration

- Minimum TLS version defaults to **TLS 1.2** (configurable to TLS 1.3).
- The `require_secure_transport` parameter is set to `ON` by default.
- Connection string must include `sslmode=require` (or `verify-ca` / `verify-full`).
- **Certificate rotation**: Azure rotates intermediate CA certificates periodically (ongoing rollout through 2026). Applications must NOT pin certificates.

### Authentication Methods

| Method | Description |
|--------|-------------|
| **PostgreSQL authentication** | Standard username/password (md5 or scram-sha-256) |
| **Microsoft Entra ID (Azure AD)** | Token-based authentication using Azure AD tokens as passwords |
| **Both** | Combined mode allowing either method |

### Microsoft Entra ID / Azure AD Authentication

- Supports Entra users, groups, service principals, and managed identities.
- Enable **passwordless authentication** by using system-assigned or user-assigned managed identities.
- The Entra admin can be configured during or after server provisioning.
- Flow: Application requests an access token from Azure AD, then passes it as the password in the PostgreSQL connection.

### Networking Options

| Option | Description | Key Notes |
|--------|-------------|-----------|
| **Public Access (Firewall)** | IP-based firewall rules | Simplest; allows specific IP ranges |
| **VNet Integration (Injection)** | Server deployed inside a delegated subnet | Requires dedicated subnet; no public endpoint; chosen at creation and cannot be changed |
| **Private Link (Private Endpoints)** | Private IP via Azure Private Link | Can be added after creation; does NOT require delegated subnet; recommended by Microsoft |

**Important**: VNet Integration and Private Link are **mutually exclusive**. You choose one at deployment time. Microsoft recommends Private Link as the preferred private networking approach.

### Private Link vs VNet Integration

- **VNet Integration**: Requires a delegated subnet, no public endpoint at all, full network isolation within the VNet.
- **Private Link**: No delegated subnet required, can coexist with public firewall rules (with firewall configured to deny public), more flexible for hub-spoke topologies.

Sources: [Security Overview](https://learn.microsoft.com/en-us/azure/postgresql/flexible-server/security-overview), [TLS/SSL](https://learn.microsoft.com/en-us/azure/postgresql/flexible-server/concepts-networking-ssl-tls), [Entra Authentication](https://learn.microsoft.com/en-us/azure/postgresql/flexible-server/concepts-azure-ad-authentication), [Private Networking](https://learn.microsoft.com/en-us/azure/postgresql/flexible-server/concepts-networking-private-link)

---

## 6. Performance

### Built-in PgBouncer Connection Pooling

- **Built-in** PgBouncer is available and optional (enabled via server parameter).
- Supported on **General Purpose and Memory Optimized** tiers (not Burstable for the built-in version).
- Connects via the same hostname on **port 6432** (standard PostgreSQL on port 5432).
- Default pool mode: **Transaction mode** (recommended for most workloads).
- Key parameters: `pgbouncer.default_pool_size`, `pgbouncer.max_client_conn`, `pgbouncer.pool_mode`.
- During HA failover, PgBouncer restarts seamlessly on the promoted standby.
- For extreme scale, Microsoft documents a **multi-PgBouncer architecture** behind an Azure Load Balancer.

### Read Replicas

- Up to **5 read replicas** per primary (same-region or cross-region).
- **Asynchronous replication** using PostgreSQL native streaming replication.
- Cross-region replicas available in any Azure region supporting Flexible Server.
- Replica lag typically ranges from seconds to minutes; under heavy write loads, lag can extend to hours.
- Replicas can be **promoted to independent servers** (for DR or region migration).
- Replica must have the **same or larger** compute/storage as the primary.
- HA is NOT automatically enabled on promoted replicas.

### IOPS and Storage Performance

**Premium SSD (default)**:
- Storage: Up to **32 TiB**
- Free IOPS: **3,000 IOPS** for disks up to 399 GiB; **12,000 IOPS** for disks 400 GiB+
- Max IOPS: **20,000** (with provisioned IOPS)
- Max throughput: **900 MB/s**
- Additional IOPS can be provisioned beyond the free tier (extra charge)

**Premium SSD v2 (preview/GA)**:
- Storage: Up to **64 TiB**
- Free IOPS: **3,000 IOPS** (baseline); up to **80,000 IOPS** provisionable
- Max throughput: **1,200 MB/s**
- IOPS and throughput can be **independently scaled online** without downtime
- HA now supported with Premium SSD v2

**Important**: The VM type also imposes IOPS limits. A small Burstable VM cannot use all IOPS from a large disk.

Sources: [PgBouncer](https://learn.microsoft.com/en-us/azure/postgresql/flexible-server/concepts-pgbouncer), [Read Replicas](https://learn.microsoft.com/en-us/azure/postgresql/flexible-server/concepts-read-replicas), [Premium SSD v2](https://learn.microsoft.com/en-us/azure/postgresql/flexible-server/concepts-storage-premium-ssd-v2), [Scaling Connection Pooling](https://techcommunity.microsoft.com/blog/microsoftmissioncriticalblog/scaling-postgresql-connections-in-azure-a-deep-dive-into-multi-pgbouncer-archite/4420637)

---

## 7. Monitoring

### Azure Metrics

- All metrics emitted at **1-minute intervals** with **up to 93 days of retention**.
- Key metrics include:
  - CPU percent, Memory percent
  - Active connections, Failed connections
  - Storage used, Storage percent
  - IOPS (read/write), Throughput
  - Network In/Out
  - Replication lag (for replicas)
  - PgBouncer metrics (active/idle connections, pool count)

### Slow Query Log

- Enable via the `log_min_duration_statement` parameter (e.g., set to 500 for queries over 500ms).
- Server Logs feature allows downloading logs directly.
- Log retention: **1 to 7 days**.

### Query Performance Insight

- Provides visualization of **top resource-consuming queries**.
- Powered by **Query Store** (must be enabled; captures query text, execution counts, wait stats).
- Views include: Top queries by calls, by data usage, by IOPS, by temporary file usage.
- Requires Query Store to have captured a few hours of data before rendering.
- Available via Azure Portal.

### Log Analytics Integration

- Stream logs to Azure Log Analytics for advanced querying with KQL.
- Three log categories: Sessions logs, Query Store Runtime, Query Store Wait Statistics.

### Azure Advisor Recommendations

- **Index Scan Insights**: Detects disabled/unused indexes.
- **Audit Logging Review**: Identifies excessive logging via `pgaudit.log`.
- Daily insights for performance optimization.

### Troubleshooting Guides

- Built-in troubleshooting guides available in the Azure Portal for common issues (high CPU, high memory, high IOPS, high connections).

Sources: [Monitoring and Metrics](https://learn.microsoft.com/en-us/azure/postgresql/flexible-server/concepts-monitoring), [Query Performance Insight](https://learn.microsoft.com/en-us/azure/postgresql/flexible-server/concepts-query-performance-insight), [Slow Query Identification](https://learn.microsoft.com/en-us/azure/postgresql/flexible-server/how-to-identify-slow-queries)

---

## 8. Pricing Tiers

### Compute Tiers

#### Burstable (B-series)
Best for dev/test and workloads without sustained CPU. Uses a CPU credit system.

| SKU | vCores | RAM (GiB) | max_connections |
|-----|--------|-----------|-----------------|
| B1ms | 1 | 2 | 50 |
| B2s | 2 | 4 | 429 |
| B2ms | 2 | 8 | 859 |
| B4ms | 4 | 16 | 1,718 |
| B8ms | 8 | 32 | 3,437 |
| B12ms | 12 | 48 | 5,000 |
| B16ms | 16 | 64 | 5,000 |
| B20ms | 20 | 80 | 5,000 |

#### General Purpose (D-series)
Best for most production workloads. Balanced CPU-to-memory ratio.

| SKU | vCores | RAM (GiB) | max_connections |
|-----|--------|-----------|-----------------|
| D2s/D2ds | 2 | 8 | 859 |
| D4s/D4ds | 4 | 16 | 1,718 |
| D8s/D8ds | 8 | 32 | 3,437 |
| D16s/D16ds | 16 | 64 | 5,000 |
| D32s/D32ds | 32 | 128 | 5,000 |
| D48s/D48ds | 48 | 192 | 5,000 |
| D64s/D64ds | 64 | 256 | 5,000 |
| D96ds | 96 | 384 | 5,000 |

#### Memory Optimized (E-series)
Best for high-performance, memory-intensive workloads. ~8 GiB per vCore.

| SKU | vCores | RAM (GiB) | max_connections |
|-----|--------|-----------|-----------------|
| E2s/E2ds | 2 | 16 | 1,718 |
| E4s/E4ds | 4 | 32 | 3,437 |
| E8s/E8ds | 8 | 64 | 5,000 |
| E16s/E16ds | 16 | 128 | 5,000 |
| E20ds | 20 | 160 | 5,000 |
| E32s/E32ds | 32 | 256 | 5,000 |
| E48s/E48ds | 48 | 384 | 5,000 |
| E64s/E64ds | 64 | 432 | 5,000 |
| E96ds | 96 | 672 | 5,000 |

**Note**: Azure reserves 15 connections from `max_connections` for physical replication and monitoring. The formula for max_connections: for VMs with <= 2 GiB RAM: `memoryGiB * 25`; for VMs with > 2 GiB: `MIN(memoryGiB * 0.1049164697034809 * 16384, 5000)`.

### Pricing Structure

- **Compute**: Billed per vCore-hour (pay-as-you-go) or with reserved capacity.
- **Storage**: Billed per GiB/month. Premium SSD and Premium SSD v2 have different rates.
- **Backup**: Free up to 100% of provisioned storage; extra billed per GiB/month.
- **HA**: Doubles compute + storage cost (standby has identical specs).
- **IOPS**: Free baseline included; additional provisioned IOPS billed separately.

### Reserved Capacity Discounts

| Term | Discount vs Pay-as-you-Go |
|------|--------------------------|
| 1-year | Up to **40-47%** savings |
| 3-year | Up to **60-64%** savings |

Reserved capacity applies to **compute only** (not storage, networking, or backup).

### Approximate Pricing (East US, Pay-as-you-Go, as of 2025)

| SKU | Approx. Hourly Cost |
|-----|---------------------|
| B1ms (1 vCore, 2 GiB) | ~$0.021/hr (~$15/mo) |
| B2s (2 vCores, 4 GiB) | ~$0.042/hr (~$30/mo) |
| D2s (2 vCores, 8 GiB) | ~$0.10/hr (~$73/mo) |
| D4s (4 vCores, 16 GiB) | ~$0.20/hr (~$146/mo) |
| D8s (8 vCores, 32 GiB) | ~$0.40/hr (~$292/mo) |
| E4s (4 vCores, 32 GiB) | ~$0.28/hr (~$204/mo) |

**Note**: These are approximate figures. Consult the [official pricing page](https://azure.microsoft.com/en-us/pricing/details/postgresql/flexible-server/) or [Azure Pricing Calculator](https://azure.microsoft.com/en-us/pricing/calculator/) for exact, current pricing in your region.

Sources: [Compute Options](https://learn.microsoft.com/en-us/azure/postgresql/flexible-server/concepts-compute), [Limits](https://learn.microsoft.com/en-us/azure/postgresql/flexible-server/concepts-limits), [Pricing Page](https://azure.microsoft.com/en-us/pricing/details/postgresql/flexible-server/), [Reserved Pricing](https://learn.microsoft.com/en-us/azure/postgresql/flexible-server/concepts-reserved-pricing)

---

## 9. Migration Strategies

### Migration Tools

| Tool | Best For | Type |
|------|----------|------|
| **Azure Migration Service** (built-in) | PostgreSQL-to-Flexible Server, AWS RDS to Azure | Online or Offline |
| **pg_dump / pg_restore** | Small databases (< 200 GiB), offline acceptable | Offline only |
| **Azure Database Migration Service (DMS)** | Large-scale, complex migrations | Online (Premium tier) |
| **Logical Replication** | Custom online migration with minimal downtime | Online |

### Azure Migration Service (Built-in)

- Uses **pgcopydb** binary for fast, efficient copying.
- Supports **Online mode**: full backup + continuous replication (pgcopydb follow), with brief cutover downtime.
- Supports **Offline mode**: full dump and restore with downtime.
- Supports migration from: Single Server, AWS RDS PostgreSQL, on-premises PostgreSQL, Google Cloud SQL.

### Migration from AWS RDS PostgreSQL

1. Enable `rds.logical_replication = 1` in RDS parameter group.
2. Set `max_wal_senders >= 10` and `max_replication_slots >= 5`.
3. Reboot the RDS instance.
4. Ensure all tables have primary keys (for online mode, without PKs only inserts are replicated).
5. Use Azure Migration Service or Azure DMS.

### Migration from On-Premises / Other Providers

1. **pg_dump/pg_restore** for small databases with acceptable downtime.
2. **Azure DMS** for online migration with minimal downtime.
3. **Logical replication** for custom setups.

### Best Practices

- Allocate at least **125% of source storage** on the target Flexible Server.
- Ensure all tables have **primary keys** for online migration.
- Plan migration during **low-traffic periods**.
- Validate data post-migration using comparison tools.
- Test the migration in a staging environment first.

### Single Server Retirement (March 28, 2025)

- Single Server was retired and can no longer be created.
- Existing instances were auto-migrated in phases.
- Microsoft provided a built-in Single-to-Flexible migration tool.

Sources: [Migration Service Overview](https://learn.microsoft.com/en-us/azure/postgresql/migrate/migration-service/overview-migration-service-postgresql), [Migration Best Practices](https://learn.microsoft.com/en-us/azure/postgresql/migrate/migration-service/best-practices-migration-service-postgresql), [AWS RDS Migration](https://learn.microsoft.com/en-us/azure/postgresql/migrate/migration-service/tutorial-migration-service-rds-online)

---

## 10. Supported Extensions

Extensions must be allowlisted via the `azure.extensions` server parameter before `CREATE EXTENSION` can be used. Here is a comprehensive (though not exhaustive) list of supported extensions:

### Core / Utility Extensions
- `pg_stat_statements` -- Query execution statistics (preloaded in shared_preload_libraries)
- `pgcrypto` -- Cryptographic functions
- `uuid-ossp` -- UUID generation
- `hstore` -- Key-value store data type
- `citext` -- Case-insensitive text type
- `ltree` -- Hierarchical tree data type
- `intarray` -- Integer array functions
- `isn` -- International Standard Numbers
- `unaccent` -- Text search dictionary for accent removal
- `fuzzystrmatch` -- String similarity and distance

### Indexing & Search
- `btree_gin` -- GIN operator classes for B-tree
- `btree_gist` -- GiST operator classes for B-tree
- `bloom` -- Bloom filter index access method
- `pg_trgm` -- Trigram matching for text search
- `rum` -- RUM index access method

### Spatial / GIS
- `postgis` -- Spatial and geographic data types and functions
- `postgis_topology` -- Topology types and functions
- `postgis_raster` -- Raster data handling
- `postgis_sfcgal` -- 3D spatial functions
- `postgis_tiger_geocoder` -- US Census TIGER geocoding
- `address_standardizer` -- Address parsing
- `pgrouting` -- Geospatial routing

### AI / Vector
- `vector` (pgvector) -- Vector similarity search (0.7.0+)
- `pg_diskann` -- DiskANN vector indexing algorithm
- `azure_ai` -- Azure AI services integration
- `azure_local_ai` -- Local AI model inference

### Scheduling & Jobs
- `pg_cron` -- Time-based job scheduling (cron-like)

### Auditing & Security
- `pgaudit` -- Audit logging
- `credcheck` -- Credential checking

### Foreign Data & Connectivity
- `dblink` -- Cross-database queries
- `postgres_fdw` -- PostgreSQL foreign data wrapper
- `mysql_fdw` -- MySQL foreign data wrapper
- `oracle_fdw` -- Oracle foreign data wrapper (version dependent)

### Statistics & Monitoring
- `pg_buffercache` -- Buffer cache inspection
- `pg_freespacemap` -- Free space map examination
- `pg_prewarm` -- Buffer cache prewarming
- `pg_visibility` -- Visibility map examination
- `pg_stat_kcache` -- Kernel cache statistics
- `auto_explain` -- Automatic query plan logging
- `pg_wait_sampling` -- Wait event sampling

### Data Types & Encoding
- `postgres_protobuf` -- Protocol Buffers support
- `dict_int`, `dict_xsyn` -- Text search dictionaries
- `tablefunc` -- Crosstab, connectby functions
- `earthdistance` -- Earth distance calculations
- `cube` -- Multi-dimensional cube data type

### Replication & Maintenance
- `pg_failover_slots` -- Failover of logical replication slots
- `pg_repack` -- Online table repacking (no locks)
- `pglogical` -- Logical replication

### Statistics & Analytics
- `postgresql-hll` -- HyperLogLog data structure
- `topn` -- Top-N approximation
- `tdigest` -- t-digest for quantile approximation
- `pg_duckdb` -- DuckDB integration for analytics
- `timescaledb` -- Time-series data (supported for migration)

### Azure-Specific
- `azure_storage` -- Read/write Azure Blob Storage from PostgreSQL
- `pg_qs` -- Query Store (Azure-specific)

### Recently Added (2025)
- `pg_cron` on PostgreSQL 17
- `pg_diskann` for vector indexing
- `pg_duckdb` for analytics
- `postgresql-hll`, `topn`, `tdigest`

For the complete version-specific list, see [Extensions by Engine Version](https://learn.microsoft.com/en-us/azure/postgresql/extensions/concepts-extensions-by-engine).

Sources: [Extensions List by Name](https://learn.microsoft.com/en-us/azure/postgresql/extensions/concepts-extensions-versions), [Allow Extensions](https://learn.microsoft.com/en-us/azure/postgresql/extensions/how-to-allow-extensions), [January 2025 Recap](https://techcommunity.microsoft.com/blog/adforpostgresql/january-2025-recap-azure-database-for-postgresql-flexible-server/4372535), [April 2025 Recap](https://techcommunity.microsoft.com/blog/adforpostgresql/april-2025-recap-azure-database-for-postgresql-flexible-server/4412095)

---

## 11. Maintenance Windows and Version Upgrades

### Maintenance Windows

- **System-managed**: Azure picks a 1-hour window on a day with least activity.
- **Custom**: You specify the day-of-week and start time (1-hour window).
- Minor version updates, security patches, and Azure infrastructure updates are applied during maintenance.
- Expect brief downtime (typically a few seconds to minutes) during maintenance.

### Minor Version Upgrades

- Automatically applied during the scheduled maintenance window.
- Azure picks the "preferred" minor version; you cannot opt out.

### Major Version Upgrade (In-Place)

- Uses `pg_upgrade` internally for **in-place** upgrades.
- You can **skip versions** (e.g., upgrade directly from 13 to 17).
- The operation is **offline** -- the server is unavailable during the upgrade.
- Most upgrades complete in **under 15 minutes** (varies by database size/complexity).
- Azure takes an **implicit backup** before the upgrade; automatic rollback if upgrade fails.

### Supported Versions (as of 2025)

| Version | Latest Minor |
|---------|-------------|
| PostgreSQL 18 | 18.1 |
| PostgreSQL 17 | 17.7 |
| PostgreSQL 16 | 16.11 |
| PostgreSQL 15 | 15.15 |
| PostgreSQL 14 | 14.20 |
| PostgreSQL 13 | 13.23 |

### Version Policy

- Azure follows the PostgreSQL community versioning policy.
- Each major version is supported for **5 years** after the community release.
- End-of-life versions receive at least **12 months notice** before retirement.
- PostgreSQL 12 and 11 have reached end of life in the community.

Sources: [Major Version Upgrades](https://learn.microsoft.com/en-us/azure/postgresql/flexible-server/concepts-major-version-upgrade), [Supported Versions](https://learn.microsoft.com/en-us/azure/postgresql/flexible-server/concepts-supported-versions), [Version Policy](https://learn.microsoft.com/en-us/azure/postgresql/flexible-server/concepts-version-policy)

---

## 12. Connection Limits and Connection String Formats

### Connection Limits

- `max_connections` is set automatically based on the VM's RAM.
- Azure reserves **15 connections** for internal replication and monitoring.
- Maximum ceiling is **5,000 connections** regardless of RAM.
- Even though high max_connections is possible, Microsoft strongly recommends using **PgBouncer** for connection pooling. Idle connections still consume memory (~5-10 MB each).

### Connection String Formats

**Standard PostgreSQL format**:
```
host=myserver.postgres.database.azure.com port=5432 dbname=mydb user=myuser password=mypassword sslmode=require
```

**URI format**:
```
postgresql://myuser:mypassword@myserver.postgres.database.azure.com:5432/mydb?sslmode=require
```

**ADO.NET / C#**:
```
Server=myserver.postgres.database.azure.com;Database=mydb;Port=5432;User Id=myuser;Password=mypassword;Ssl Mode=Require;
```

**JDBC (Java)**:
```
jdbc:postgresql://myserver.postgres.database.azure.com:5432/mydb?user=myuser&password=mypassword&sslmode=require
```

**PgBouncer connection** (use port 6432):
```
host=myserver.postgres.database.azure.com port=6432 dbname=mydb user=myuser password=mypassword sslmode=require
```

**With Entra ID / Managed Identity** (token as password):
```python
import azure.identity
credential = azure.identity.DefaultAzureCredential()
token = credential.get_token("https://ossrdbms-aad.database.windows.net/.default")
conn = psycopg2.connect(
    host="myserver.postgres.database.azure.com",
    dbname="mydb",
    user="myuser@myserver",
    password=token.token,
    sslmode="require"
)
```

Sources: [Limits](https://learn.microsoft.com/en-us/azure/postgresql/flexible-server/concepts-limits), [Connect with C#](https://learn.microsoft.com/en-us/azure/postgresql/flexible-server/connect-csharp), [Managed Identity Connection](https://learn.microsoft.com/en-us/azure/postgresql/flexible-server/security-connect-with-managed-identity)

---

## 13. Best Practices

### Architecture Best Practices (Azure Well-Architected Framework)

1. **Enable Zone-Redundant HA** for production workloads to get 99.99% SLA.
2. **Use Private Link or VNet Integration** instead of public firewall rules.
3. **Enable geo-redundant backups** if you need cross-region DR.
4. **Use read replicas** in regions close to users for read-heavy workloads.

### Performance Best Practices

1. **Enable PgBouncer** for connection pooling, especially with many short-lived connections.
2. **Right-size your compute**: Start with General Purpose and scale up/down as needed. Avoid over-provisioning.
3. **Provision sufficient storage for IOPS**: Default 125 GiB is limited to 375 IOPS. Use at least 400 GiB to get 12,000 free IOPS.
4. **Enable intelligent tuning**: Autovacuum tuning and writes tuning automatically optimize parameters.
5. **Use index tuning**: Let Azure recommend CREATE INDEX and DROP INDEX operations.
6. **Monitor with Query Performance Insight**: Enable Query Store and review top queries regularly.
7. **Set `log_min_duration_statement`** to catch slow queries (e.g., 1000ms for production).
8. **Use `pg_stat_statements`** for query-level performance tracking.

### Intelligent Tuning Features

- **Autovacuum tuning**: Adjusts `autovacuum_vacuum_scale_factor`, `autovacuum_cost_limit`, `autovacuum_naptime`, `autovacuum_vacuum_threshold`, `autovacuum_vacuum_cost_delay` based on bloat ratio and resource usage.
- **Writes tuning**: Adjusts `bgwriter_delay`, `checkpoint_completion_target`, `max_wal_size`, `min_wal_size` based on write patterns.
- **Index tuning**: Recommends indexes to create/drop based on query patterns.
- **Note**: Intelligent tuning requires General Purpose or Memory Optimized with 4+ vCores.

### Security Best Practices

1. **Use Microsoft Entra ID authentication** for passwordless access where possible.
2. **Use Private Link** instead of public firewall rules.
3. **Use `sslmode=verify-full`** in connection strings for full certificate validation.
4. **Never pin certificates** -- allow Azure to rotate intermediate CAs.
5. **Enable pgAudit** for compliance logging.
6. **Use scram-sha-256** password encryption instead of md5.

### Cost Optimization

1. **Use reserved capacity** for predictable workloads (up to 64% savings with 3-year).
2. **Use Burstable tier** for dev/test environments.
3. **Stop compute** when not needed (storage persists, compute stops billing).
4. **Right-size storage** -- avoid over-provisioning.
5. **Review Azure Advisor** recommendations regularly.

Sources: [Architecture Best Practices](https://learn.microsoft.com/en-us/azure/well-architected/service-guides/postgresql), [Intelligent Tuning](https://learn.microsoft.com/en-us/azure/postgresql/flexible-server/concepts-intelligent-tuning), [Cost Optimization](https://learn.microsoft.com/en-us/azure/postgresql/flexible-server/how-to-cost-optimization), [Connection Pooling Best Practices](https://learn.microsoft.com/en-us/azure/postgresql/flexible-server/concepts-connection-pooling-best-practices)

---

## 14. Common Pitfalls and Troubleshooting

### Authentication Failures

**Problem**: `FATAL: no pg_hba.conf entry for host "x.x.x.x"`
- **Cause**: Client IP not in firewall rules, or using VNet integration without proper routing.
- **Fix**: Add client IP to firewall rules, or ensure the application is within the VNet/has proper peering.

**Problem**: `FATAL: password authentication failed for user`
- **Cause**: Wrong password, or trying PostgreSQL auth when only Entra ID is configured (or vice versa).
- **Fix**: Verify authentication mode (PostgreSQL only, Entra only, or both). Check user exists and password is correct.

**Problem**: Entra ID token authentication fails
- **Cause**: Token expired (tokens last ~1 hour), wrong scope, or Entra admin not configured.
- **Fix**: Refresh token before expiry. Use scope `https://ossrdbms-aad.database.windows.net/.default`. Ensure an Entra admin is set on the server.

### SSL/TLS Issues

**Problem**: Connection fails with SSL errors after certificate rotation
- **Cause**: Application pinned to a specific certificate or intermediate CA.
- **Fix**: Never pin certificates. Use the system trust store or download the DigiCert Global Root G2 certificate. Do NOT include `sslcert` or `sslkey` parameters (client certificates are not supported).

**Problem**: `SSL connection is required. Please specify SSL options and retry.`
- **Cause**: Connection string missing `sslmode=require`.
- **Fix**: Add `sslmode=require` (minimum) to the connection string. Preferably use `verify-ca` or `verify-full`.

**Problem**: TLS version mismatch
- **Cause**: Client only supports TLS 1.0 or 1.1.
- **Fix**: Update client libraries to support TLS 1.2+. Azure only accepts TLS 1.2 and 1.3.

### Connection Drops and Timeouts

**Problem**: Intermittent connection drops during maintenance
- **Cause**: Planned maintenance causes brief downtime (seconds to ~60 seconds).
- **Fix**: Implement **connection retry logic** with exponential backoff. Use PgBouncer for connection management.

**Problem**: `connection timed out` or very slow connections
- **Cause**: Firewall blocking port 5432, DNS issues, or high server load.
- **Fix**: Verify network connectivity (telnet to port 5432). Check CPU/memory/IOPS metrics. Consider scaling up.

**Problem**: `too many connections for role`
- **Cause**: Exceeding max_connections or per-user connection limits.
- **Fix**: Enable PgBouncer connection pooling. Review application connection pool settings. Scale up to a higher SKU.

### Performance Issues

**Problem**: High CPU usage
- **Cause**: Inefficient queries, missing indexes, excessive connections.
- **Fix**: Use Query Performance Insight to identify top queries. Enable intelligent index tuning. Review and optimize slow queries.

**Problem**: Storage throttling (low IOPS)
- **Cause**: Provisioned storage too small (125 GiB = only 375 IOPS).
- **Fix**: Scale storage to at least 400 GiB for 12,000 free IOPS. Consider Premium SSD v2 for independent IOPS scaling.

**Problem**: Autovacuum not keeping up
- **Cause**: Default autovacuum settings too conservative for write-heavy workloads.
- **Fix**: Enable intelligent autovacuum tuning. Manually adjust `autovacuum_vacuum_scale_factor` and `autovacuum_naptime` for large tables.

### Common Mistakes

1. **Choosing VNet Integration when Private Link would be better** -- VNet Integration cannot be changed after deployment.
2. **Not enabling PgBouncer** -- Direct connections waste resources; always use pooling in production.
3. **Under-provisioning storage IOPS** -- The default 125 GiB storage is severely IOPS-limited.
4. **Forgetting to allowlist extensions** -- `CREATE EXTENSION` fails silently or with obscure errors if the extension is not in `azure.extensions`.
5. **Not implementing retry logic** -- Maintenance and failover cause brief disconnections; applications must handle reconnection gracefully.
6. **Using certificate pinning** -- Breaks during Azure's periodic certificate rotations.
7. **Not testing failover** -- Use planned failover to validate application resilience before a real outage occurs.

Sources: [Troubleshoot Connections](https://learn.microsoft.com/en-us/azure/postgresql/flexible-server/how-to-troubleshoot-common-connection-issues), [TLS Troubleshooting](https://learn.microsoft.com/en-us/azure/postgresql/flexible-server/security-tls-troubleshoot), [Connection Issues on Azure](https://techcommunity.microsoft.com/t5/azure-database-for-postgresql/are-you-running-into-postgres-connection-issues-on-azure/ba-p/1994913), [pg_hba.conf Rejects Connection](https://learn.microsoft.com/en-us/answers/questions/1342633/not-able-to-connect-to-azure-database-for-postgres)

---

## Summary Decision Matrix

| Criteria | Recommendation |
|----------|---------------|
| New production app, single-node | **Flexible Server** (General Purpose or Memory Optimized) |
| Dev/Test/Staging | **Flexible Server** (Burstable B1ms or B2s) |
| Horizontal scaling, multi-tenant SaaS | **Cosmos DB for PostgreSQL** (Citus) |
| DR across regions | Flexible Server + **Geo-Redundant Backup** + **Cross-Region Read Replicas** |
| Lowest possible latency | Flexible Server + **Same-Zone HA** + **PgBouncer** |
| Maximum uptime SLA | Flexible Server + **Zone-Redundant HA** (99.99%) |
| AI / Vector search workloads | Flexible Server + **pgvector** or **pg_diskann** |
| Budget-constrained | Flexible Server **Burstable** + **Reserved Capacity** |

---

This report covers all 14 areas you requested. For the most current pricing figures, always consult the [Azure Pricing Calculator](https://azure.microsoft.com/en-us/pricing/calculator/) and the [official pricing page](https://azure.microsoft.com/en-us/pricing/details/postgresql/flexible-server/), as rates change frequently and vary by region.