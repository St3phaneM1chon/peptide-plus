# Azure Analytics & Business Intelligence for E-Commerce
## Comprehensive Research Report

**Date:** February 11, 2026
**Scope:** Azure analytics services evaluation for e-commerce platform (Peptide Plus)
**Status:** Research Complete

---

## Table of Contents

1. [Azure Synapse Analytics](#1-azure-synapse-analytics)
2. [Power BI Embedded](#2-power-bi-embedded)
3. [Azure Data Factory](#3-azure-data-factory)
4. [Azure Stream Analytics](#4-azure-stream-analytics)
5. [Azure Machine Learning](#5-azure-machine-learning)
6. [Microsoft Purview (Data Governance)](#6-microsoft-purview-data-governance)
7. [Architecture Patterns](#7-architecture-patterns)
8. [Cost Optimization](#8-cost-optimization)
9. [Migration Considerations: Synapse vs. Fabric](#9-migration-considerations-synapse-vs-fabric)
10. [Implementation Roadmap](#10-implementation-roadmap)

---

## 1. Azure Synapse Analytics

### Overview

Azure Synapse Analytics is a unified analytics platform that combines enterprise data warehousing with big data analytics. It brings together SQL-based data warehousing, Apache Spark for big data processing, Azure Data Explorer for log and telemetry analytics, and data integration pipelines -- all within a single unified workspace.

### Data Warehouse for Sales Analytics

**Dedicated SQL Pools** provide a provisioned, MPP (Massively Parallel Processing) data warehouse engine optimized for complex queries over petabyte-scale data. For e-commerce sales analytics, this means:

- **Star schema modeling** for orders, products, customers, and time dimensions
- **Columnar storage** with clustered columnstore indexes for fast aggregate queries (e.g., total revenue by product category by quarter)
- **Workload management** to prioritize executive dashboard queries over batch ETL loads
- **Result-set caching** for frequently-run sales reports
- **Materialized views** for pre-computed aggregations (daily sales summaries, monthly revenue trends)

**E-commerce data model components:**
- Fact tables: `fact_orders`, `fact_order_items`, `fact_page_views`, `fact_cart_events`, `fact_payments`
- Dimension tables: `dim_customer`, `dim_product`, `dim_time`, `dim_geography`, `dim_payment_method`, `dim_shipping_provider`
- Slowly changing dimensions for product pricing history and customer tier changes

### Serverless SQL Pools for Ad-Hoc Analysis

Serverless SQL pools are a key differentiator, providing on-demand query capability against data stored in Azure Data Lake Storage without provisioning dedicated resources.

**Pricing model:**
- $5 per TB of data processed
- Minimum charge of 10 MB per query, rounded up to nearest 1 MB
- No charge for DDL/metadata-only queries
- No charge for idle time (true pay-per-query)

**E-commerce use cases:**
- Ad-hoc exploration of raw clickstream data in Parquet/JSON files
- One-time analytical queries by marketing team (no dedicated warehouse needed)
- Cost-effective querying of historical data that does not justify dedicated pool storage
- Creating external tables over Data Lake files for Power BI direct query
- Querying semi-structured data (JSON order payloads, webhook event logs)

**Cost management strategies:**
- Set cost controls per query and per workspace (daily/weekly/monthly limits)
- Use OPENROWSET with targeted file paths to minimize data scanned
- Partition data by date to enable partition elimination
- Use Parquet format (columnar) instead of CSV/JSON for 10-100x cost reduction on scans

### Integration with Power BI

Synapse provides native, first-class Power BI integration:

- **Synapse Studio** includes a built-in Power BI integration hub for creating and editing reports directly from the analytics workspace
- **DirectQuery** mode connects Power BI reports to Synapse dedicated pools for real-time data without import
- **Serverless SQL pool views** can serve as a DirectQuery source, providing a cost-effective live query layer over Data Lake data
- **Linked Power BI workspaces** allow data engineers and BI developers to collaborate in the same environment
- **Automatic dataset creation** from Synapse SQL views or tables

### Key Specifications

| Feature | Specification |
|---------|--------------|
| Max dedicated pool size | 240 compute nodes (DW30000c) |
| Serverless query concurrency | 20 concurrent queries (default) |
| Supported file formats | Parquet, Delta, CSV, JSON, ORC |
| Data Lake integration | Native ADLS Gen2 support |
| Security | Column-level, row-level security, dynamic data masking |
| Pricing (Dedicated) | From ~$1.20/hour (DW100c) to ~$360/hour (DW30000c) |
| Pricing (Serverless) | $5/TB processed |

---

## 2. Power BI Embedded

### Overview

Power BI Embedded enables the integration of fully interactive Power BI reports, dashboards, and tiles directly into custom web applications. For an e-commerce admin panel, this eliminates the need for users to have separate Power BI accounts or navigate to a separate BI portal.

### Embedding Dashboards in Admin Panel

**Architecture for embedding in a Next.js/React admin panel:**

1. **Backend (Node.js/Next.js API route):**
   - Register an Azure AD application (service principal)
   - Use the Power BI REST API to generate embed tokens
   - API route: `POST /api/admin/analytics/embed-token`
   - Returns: `embedUrl`, `embedToken`, `reportId`

2. **Frontend (React component):**
   - Use the `powerbi-client-react` npm package (official Microsoft library)
   - The `<PowerBIEmbed>` component accepts embed configuration
   - Supports JavaScript and TypeScript
   - Event handling for report interactions (data selected, page changed, etc.)

3. **Authentication flow:**
   - "App owns data" pattern (recommended for e-commerce admin panels)
   - Service principal authenticates against Power BI service
   - Embed tokens are generated server-side, scoped to specific reports
   - No Power BI license required for end-user viewers (capacity covers all)

**Implementation example (React):**
```tsx
import { PowerBIEmbed } from 'powerbi-client-react';
import { models } from 'powerbi-client';

<PowerBIEmbed
  embedConfig={{
    type: 'report',
    id: reportId,
    embedUrl: embedUrl,
    accessToken: embedToken,
    tokenType: models.TokenType.Embed,
    settings: {
      panes: { filters: { expanded: false, visible: true } },
      background: models.BackgroundType.Transparent,
    }
  }}
  cssClassName="power-bi-report"
/>
```

### Real-Time Sales Dashboards

Power BI supports near-real-time and true real-time data refresh:

- **Streaming datasets:** Push data to Power BI via REST API for true real-time tiles (sub-second latency)
- **DirectQuery:** Live connection to Synapse/SQL database, data refreshed on each interaction
- **Import with scheduled refresh:** Up to 48 refreshes/day on Premium/Embedded capacity
- **Push datasets:** Combine streaming + historical data for hybrid real-time dashboards

**Recommended real-time sales dashboard KPIs:**
- Orders per hour (live ticker)
- Revenue today vs. yesterday vs. same day last week
- Average order value (rolling 24h)
- Top-selling products (live)
- Cart abandonment rate (live)
- Conversion funnel (sessions -> add-to-cart -> checkout -> payment)
- Payment success/failure rate
- Geographic heat map of active orders

### Inventory Analytics

Power BI reports for inventory management:

- **Stock level monitoring:** Current inventory vs. reorder thresholds with color-coded alerts
- **Inventory turnover ratio:** By product, category, and warehouse
- **Days of supply:** Predicted days until stockout based on current sell-through rate
- **Dead stock identification:** Products with zero sales in configurable time windows
- **Supplier lead time analysis:** Average time from order to receipt by supplier
- **ABC analysis:** Classify inventory by revenue contribution (A=80%, B=15%, C=5%)

### Customer Segmentation Reports

- **RFM analysis dashboards:** Recency, Frequency, Monetary value segmentation
- **Customer lifetime value (CLV):** Predicted and historical by cohort
- **Cohort analysis:** Retention curves by sign-up month
- **Geographic segmentation:** Revenue and order patterns by region
- **Acquisition channel analysis:** Performance by marketing channel
- **Customer tier distribution:** Free, premium, VIP breakdown with migration trends

### Pricing and Capacity (2025-2026)

| SKU | v-Cores | RAM | Price (USD/month) | Notes |
|-----|---------|-----|-------------------|-------|
| **A1 (Embedded)** | 1 | 3 GB | ~$735 | Dev/test, small workloads |
| **A2 (Embedded)** | 2 | 5 GB | ~$1,470 | Small production |
| **A3 (Embedded)** | 4 | 10 GB | ~$2,940 | Medium production |
| **A4 (Embedded)** | 8 | 25 GB | ~$5,880 | Large production |
| **F64 (Fabric)** | 64 | - | ~$5,003 | Full Fabric + PBI, no per-user license needed |
| **Power BI Pro** | - | - | $14/user/month | Per-user licensing |
| **Power BI PPU** | - | - | $24/user/month | Premium per user |

**Important licensing notes:**
- A-SKU (Embedded): No Power BI user license required for report consumers
- F-SKU below F64 (F8, F16, F32): Power BI user licensing IS required for consumers
- F-SKU F64 and above: No Power BI user license required for consumers
- P-SKUs were retired July 1, 2024 for new customers; fully replaced by F-SKUs
- For an e-commerce admin panel with limited admin users, A-SKU Embedded or Power BI Pro per-user may be most cost-effective

---

## 3. Azure Data Factory

### Overview

Azure Data Factory (ADF) is a fully managed, serverless data integration service for building ETL (Extract, Transform, Load) and ELT (Extract, Load, Transform) pipelines. It provides 90+ built-in connectors and supports hybrid/multi-cloud scenarios.

### ETL Pipelines for Data Consolidation

**Pipeline architecture for e-commerce:**

```
[Stripe API] ----\
[PayPal API] -----\
[Shipping APIs] ----> [Azure Data Factory] -> [Data Lake (Bronze)] -> [Transform] -> [Silver/Gold] -> [Synapse/Power BI]
[PostgreSQL DB] --/
[Redis Cache] ---/
[Web Analytics] -/
```

**Key pipeline patterns:**

1. **Incremental extraction:** Use watermark columns (e.g., `updated_at`) to only extract changed records since last run
2. **Full snapshot:** Periodic complete extracts for reference data (product catalog, shipping rates)
3. **Event-driven pipelines:** Triggered by blob storage events or custom events via Event Grid
4. **Tumbling window triggers:** Scheduled pipelines that process data in non-overlapping time windows
5. **Dependency chaining:** Pipelines that wait for upstream data before processing

### Import Data from Stripe

**Stripe integration approach:**

Since ADF does not have a native Stripe connector, integration uses the **REST connector**:

- **REST linked service** configured with Stripe API base URL (`https://api.stripe.com/v1/`)
- **Authentication:** API key via Azure Key Vault (HTTP header: `Authorization: Bearer sk_live_...`)
- **Pagination handling:** Stripe uses cursor-based pagination with `starting_after` parameter; ADF supports pagination rules with `$.has_more` and `$.data[-1].id`
- **Rate limiting:** Stripe allows 100 read requests/second; configure retry policies and throttling in ADF
- **Key endpoints to extract:**
  - `/v1/charges` - All payment charges
  - `/v1/payment_intents` - Payment intents with status
  - `/v1/customers` - Customer records
  - `/v1/subscriptions` - Subscription data
  - `/v1/invoices` - Invoice records
  - `/v1/refunds` - Refund transactions
  - `/v1/disputes` - Chargeback/dispute data

**Webhook-based real-time ingestion (complementary):**
- ADF Webhook Activity can receive callbacks from Stripe webhooks
- Azure Functions as webhook receiver -> Event Hub -> ADF pipeline trigger
- Enables near-real-time data ingestion for critical events (payment succeeded, refund created, dispute opened)

### Import Data from PayPal

**PayPal integration:**

- **REST connector** with OAuth 2.0 authentication (client credentials flow)
- PayPal API base URL: `https://api-m.paypal.com/v2/`
- **Key endpoints:**
  - `/v2/payments/captures` - Captured payments
  - `/v1/reporting/transactions` - Transaction history (batch)
  - `/v2/invoicing/invoices` - Invoices
  - `/v1/customer/disputes` - Disputes
- **PayPal transaction reporting API** supports date-range queries for incremental extraction
- **SFTP connector** for PayPal settlement reports (daily reconciliation files)

### Import Data from Shipping Providers

- **REST connectors** for carrier APIs (Canada Post, UPS, FedEx, Purolator)
- **Tracking data extraction:** Polling carrier APIs for shipment status updates
- **SFTP/FTP connectors** for EDI-based shipping data from traditional carriers
- **Webhook receivers** via Azure Functions for real-time tracking updates

### Data Lake for Historical Analysis

**Medallion architecture implementation:**

| Layer | Purpose | Format | Retention | E-Commerce Data |
|-------|---------|--------|-----------|----------------|
| **Bronze** | Raw ingestion, immutable | JSON, CSV, Parquet | Indefinite | Raw Stripe events, PayPal transactions, carrier tracking, web logs |
| **Silver** | Cleansed, validated, deduplicated | Delta/Parquet | 3-7 years | Normalized orders, validated payments, clean customer profiles |
| **Gold** | Business-ready aggregates | Delta/Parquet | Indefinite | Daily sales summaries, customer segments, inventory KPIs, revenue metrics |

**Storage hierarchy in ADLS Gen2:**
```
datalake/
  bronze/
    stripe/
      charges/year=2026/month=02/day=11/
      payment_intents/year=2026/month=02/day=11/
    paypal/
      transactions/year=2026/month=02/day=11/
    shipping/
      canada_post/tracking/year=2026/month=02/day=11/
    web_analytics/
      clickstream/year=2026/month=02/day=11/
    postgres/
      orders/year=2026/month=02/day=11/
      products/year=2026/month=02/day=11/
  silver/
    orders/            -- Unified order model across all sources
    payments/          -- Normalized payment records
    customers/         -- Master customer profile
    products/          -- Product catalog with history
    shipments/         -- Unified tracking data
  gold/
    sales_daily/       -- Daily aggregated sales
    customer_segments/ -- RFM and CLV segments
    inventory_kpis/    -- Stock levels and turnover
    financial_summary/ -- Revenue, costs, margins
```

### Key Specifications

| Feature | Specification |
|---------|--------------|
| Built-in connectors | 90+ (REST, SFTP, HTTP, SQL, Blob, etc.) |
| Data flow transformations | 80+ transformation types |
| Max pipeline activities | 40 per pipeline |
| Max concurrent pipeline runs | 10,000 per workspace |
| Trigger types | Schedule, tumbling window, event-based, manual |
| Pricing (Orchestration) | ~$1.00 per 1,000 activity runs |
| Pricing (Data Flow) | ~$0.274/vCore-hour (general purpose) |
| Pricing (Data Movement) | ~$0.25 per DIU-hour |

---

## 4. Azure Stream Analytics

### Overview

Azure Stream Analytics is a fully managed, real-time analytics service for processing high-velocity streaming data from sources like IoT devices, applications, and clickstreams. It uses a SQL-like query language for defining transformations over streaming data.

### Real-Time Order Processing Analytics

**Architecture:**
```
[Web App Events] -> [Azure Event Hubs] -> [Stream Analytics] -> [Power BI (real-time)]
                                                              -> [Azure SQL / Cosmos DB]
                                                              -> [Azure Functions (alerts)]
```

**Event sources for e-commerce:**
- Order placement events
- Payment processing events (success, failure, retry)
- Cart add/remove events
- Page view and session events
- Inventory change events
- Shipping status updates
- User authentication events

**Stream Analytics queries for order processing:**

```sql
-- Orders per minute with 1-minute tumbling window
SELECT
    COUNT(*) AS OrderCount,
    SUM(TotalAmount) AS Revenue,
    AVG(TotalAmount) AS AvgOrderValue,
    System.Timestamp() AS WindowEnd
INTO [PowerBIDashboard]
FROM [OrderEvents]
WHERE EventType = 'order_placed'
GROUP BY TumblingWindow(minute, 1)

-- Running 5-minute order rate with hopping window
SELECT
    COUNT(*) AS OrdersLast5Min,
    SUM(TotalAmount) AS RevenueLast5Min,
    System.Timestamp() AS WindowEnd
INTO [RealtimeMetrics]
FROM [OrderEvents]
WHERE EventType = 'order_placed'
GROUP BY HoppingWindow(minute, 5, 1)
```

### Windowing Functions for E-Commerce

| Window Type | E-Commerce Use Case | Example |
|-------------|-------------------|---------|
| **Tumbling** | Hourly sales reports, daily summaries | Orders per hour, revenue per day |
| **Hopping** | Rolling metrics, trend detection | 5-min rolling avg order value, updated every 1 min |
| **Sliding** | Threshold alerts, spike detection | Alert if >100 orders in any 5-min window |
| **Session** | User session analytics, cart abandonment | Group user events into browsing sessions with 30-min timeout |
| **Snapshot** | Point-in-time state | Current inventory levels at query time |

### Fraud Detection Patterns

**Real-time fraud detection with Stream Analytics:**

```sql
-- Detect multiple orders from same IP in short window (velocity check)
SELECT
    IPAddress,
    COUNT(*) AS OrderCount,
    COLLECT(OrderId) AS OrderIds,
    System.Timestamp() AS DetectedAt
INTO [FraudAlerts]
FROM [OrderEvents]
WHERE EventType = 'order_placed'
GROUP BY IPAddress, SlidingWindow(minute, 5)
HAVING COUNT(*) > 3

-- Detect same credit card used with different shipping addresses
SELECT
    a.CardLastFour,
    COUNT(DISTINCT a.ShippingAddressHash) AS UniqueAddresses,
    System.Timestamp() AS DetectedAt
INTO [FraudAlerts]
FROM [PaymentEvents] a
GROUP BY a.CardLastFour, TumblingWindow(hour, 1)
HAVING COUNT(DISTINCT a.ShippingAddressHash) > 2

-- Detect unusually large orders (anomaly)
SELECT
    OrderId,
    CustomerId,
    TotalAmount,
    AVG(TotalAmount) OVER (LIMIT DURATION(hour, 24)) AS Avg24hOrderValue,
    System.Timestamp() AS DetectedAt
INTO [FraudAlerts]
FROM [OrderEvents]
WHERE EventType = 'order_placed'
  AND TotalAmount > 5 * (SELECT AVG(TotalAmount) FROM [OrderEvents] LIMIT DURATION(hour, 24))
```

**Fraud detection patterns supported:**
- Velocity checks (too many orders in short time from same source)
- Geographic anomalies (order from unusual location for customer)
- Amount anomalies (order significantly above customer average)
- Card testing patterns (multiple small charges)
- Account takeover detection (sudden change in behavior patterns)
- Device fingerprint mismatches

**Integration with Azure Machine Learning:**
- Stream Analytics can call Azure ML models as user-defined functions (UDFs)
- Real-time scoring of each transaction against fraud ML model
- Results fed back into the stream for immediate action (block, flag, allow)

### Live Conversion Rate Monitoring

```sql
-- Real-time conversion funnel with session windows
SELECT
    COUNT(CASE WHEN EventType = 'page_view' THEN 1 END) AS PageViews,
    COUNT(CASE WHEN EventType = 'product_view' THEN 1 END) AS ProductViews,
    COUNT(CASE WHEN EventType = 'add_to_cart' THEN 1 END) AS AddToCarts,
    COUNT(CASE WHEN EventType = 'checkout_started' THEN 1 END) AS CheckoutsStarted,
    COUNT(CASE WHEN EventType = 'order_placed' THEN 1 END) AS OrdersPlaced,
    CAST(COUNT(CASE WHEN EventType = 'add_to_cart' THEN 1 END) AS FLOAT) /
        NULLIF(COUNT(CASE WHEN EventType = 'product_view' THEN 1 END), 0) * 100 AS AddToCartRate,
    CAST(COUNT(CASE WHEN EventType = 'order_placed' THEN 1 END) AS FLOAT) /
        NULLIF(COUNT(CASE WHEN EventType = 'checkout_started' THEN 1 END), 0) * 100 AS CheckoutCompletionRate,
    System.Timestamp() AS WindowEnd
INTO [ConversionDashboard]
FROM [UserEvents]
GROUP BY TumblingWindow(minute, 5)
```

### Key Specifications

| Feature | Specification |
|---------|--------------|
| Latency | Sub-millisecond to seconds |
| Throughput | Millions of events per second |
| Query language | SQL-like (Stream Analytics Query Language) |
| Input sources | Event Hubs, IoT Hub, Blob Storage |
| Output sinks | Power BI, SQL DB, Cosmos DB, Blob, Event Hub, Functions |
| ML integration | Azure ML UDF functions |
| Pricing | From ~$0.11/hour (1 SU) to ~$3.37/hour (36 SU) |
| Scaling | 1 to 396 Streaming Units (SU) |

---

## 5. Azure Machine Learning

### Overview

Azure Machine Learning is a cloud platform for training, deploying, and managing machine learning models. It supports the full ML lifecycle from data preparation to model monitoring, with both code-first and low-code/no-code experiences.

### Customer Churn Prediction

**Problem:** Identify customers likely to stop purchasing so proactive retention actions can be taken.

**Azure ML implementation approach:**

1. **Data preparation:**
   - Feature engineering from order history: recency, frequency, monetary value
   - Engagement metrics: email open rates, support ticket frequency, return rates
   - Behavioral signals: login frequency decline, cart abandonment increase
   - Demographic features: customer tier, geography, account age

2. **Model training options:**
   - **AutoML:** Automated model selection and hyperparameter tuning
     - Supports classification models: LightGBM, XGBoost, Random Forest, Logistic Regression
     - Automatic feature engineering and selection
     - Built-in cross-validation and model explainability
   - **Custom training:** Scikit-learn, TensorFlow, PyTorch on managed compute
   - **Designer (no-code):** Drag-and-drop pipeline for non-ML engineers

3. **Model deployment:**
   - Managed online endpoint for real-time churn scoring
   - Batch endpoint for periodic scoring of entire customer base
   - Integration with Azure Functions for event-driven scoring

4. **Key features and signals for e-commerce churn:**
   - Days since last purchase (most predictive)
   - Order frequency trend (declining = risk)
   - Average order value trend
   - Product return rate
   - Support ticket sentiment
   - Email engagement decline
   - Competitor price sensitivity (response to price increases)

**Expected outcomes:**
- Identify at-risk customers 30-60 days before churn
- Enable targeted retention campaigns (discounts, personalized outreach)
- Typical AUC-ROC of 0.75-0.90 depending on data quality

### Demand Forecasting for Inventory

**Azure ML forecasting capabilities:**

- **AutoML time-series forecasting** with automatic model selection
- Supported algorithms: Prophet, ARIMA, ExponentialSmoothing, TCNForecaster (deep learning), and ensemble methods
- **Multi-series forecasting:** Forecast demand for thousands of SKUs simultaneously
- **Feature engineering:** Automatic lag features, rolling window aggregates, holiday/event detection

**Implementation:**

1. **Training data requirements:**
   - Historical sales data (minimum 2 years for seasonality detection)
   - Product attributes (category, price, brand)
   - External signals: holidays, promotions, weather, marketing campaigns
   - Time granularity: daily or weekly recommended

2. **AutoML configuration (no-code studio):**
   - Select forecasting task type
   - Configure forecast horizon (e.g., 14, 30, 90 days)
   - Set time series identifiers (product_id, warehouse_id)
   - Enable DNN (deep neural network) models for complex patterns
   - Cross-validation with rolling origin evaluation

3. **Outputs:**
   - Point forecasts with confidence intervals (P10, P50, P90)
   - Feature importance (which factors drive demand)
   - Model performance metrics (MAPE, RMSE, R-squared)

**E-commerce applications:**
- Automated reorder point calculation
- Safety stock optimization
- Seasonal demand planning (holiday surges)
- New product demand estimation (cold-start problem with transfer learning)
- Promotion impact forecasting

### Price Optimization

**Approach using Azure ML:**

1. **Demand-price elasticity modeling:**
   - Train regression models to understand price sensitivity by product/segment
   - Features: current price, competitor prices, seasonality, inventory level, customer segment
   - Output: predicted demand at various price points

2. **Optimization framework:**
   - Define business constraints (minimum margin, competitive bounds, fairness rules)
   - Use demand models to simulate revenue at different price points
   - Optimize for maximum profit subject to constraints
   - A/B testing framework for price experiments

3. **Dynamic pricing pipeline:**
   - Batch endpoint: Recalculate optimal prices daily/weekly
   - Real-time endpoint: Adjust prices based on current demand signals
   - Integration with e-commerce platform pricing API

### Fraud Detection Models

**ML-based fraud detection architecture:**

```
[Transaction Event] -> [Feature Store] -> [ML Model (real-time endpoint)] -> [Risk Score]
                                                                          -> [Decision Engine]
                                                                          -> [Alert System]
```

**Model approaches:**

1. **Supervised learning:** Train on labeled fraud/legitimate transactions
   - Gradient Boosted Trees (XGBoost, LightGBM) -- best for tabular fraud data
   - Handle class imbalance with SMOTE, cost-sensitive learning, or threshold tuning
   - Features: transaction amount, time, location, device, velocity, historical patterns

2. **Unsupervised/anomaly detection:**
   - Isolation Forest for detecting outlier transactions
   - Autoencoder networks for learning "normal" transaction patterns
   - Azure Anomaly Detector cognitive service for time-series anomalies

3. **Vector-based approaches (modern):**
   - Generate embeddings for transactions using OpenAI models
   - Store in Azure Cosmos DB with vector search
   - Compare new transactions against historical spending patterns using vector similarity
   - Detect anomalies based on semantic distance from normal behavior

4. **Real-time scoring pipeline:**
   - Managed online endpoint with <100ms latency
   - Feature store for real-time feature computation
   - A/B model deployment for gradual rollout of new models
   - Monitoring for model drift and performance degradation

### MLOps and Deployment

**Azure ML MLOps capabilities:**

- **Model registry:** Version-controlled model storage with metadata
- **Managed online endpoints:** Auto-scaling, blue/green deployment, traffic splitting
- **Batch endpoints:** Process large datasets on schedule
- **Pipelines:** Automated retraining triggered by data drift or schedule
- **Monitoring:** Model performance tracking, data drift detection, feature importance drift
- **Responsible AI dashboard:** Fairness assessment, error analysis, model interpretability

**Deployment options:**

| Endpoint Type | Latency | Use Case | Pricing |
|--------------|---------|----------|---------|
| Managed online (real-time) | <100ms | Fraud scoring, price optimization | Per vCPU-hour + per GB memory |
| Kubernetes online | <50ms | Ultra-low latency requirements | AKS cluster costs |
| Batch | Minutes-hours | Churn scoring, demand forecasting | Per compute-hour |
| Serverless (preview) | <200ms | Infrequent, bursty inference | Pay-per-request |

---

## 6. Microsoft Purview (Data Governance)

### Overview

Microsoft Purview is a unified data governance, security, and compliance platform. It provides a comprehensive solution for discovering, classifying, and governing data across on-premises, multi-cloud, and SaaS environments.

### Data Catalog for All Customer Data

**Unified Catalog capabilities:**

- **Automated scanning:** Purview scans connected data sources (Azure SQL, ADLS Gen2, Cosmos DB, Synapse, Power BI) and creates a searchable catalog
- **AI-powered classification:** Automatically detects and classifies data based on content patterns
- **Business glossary:** Define business terms (e.g., "Customer Lifetime Value", "Churn Rate") and link them to actual data assets
- **Data discovery:** Business users can search for datasets without knowing where they are stored
- **Access management:** Request and approve data access through the catalog

**E-commerce data catalog structure:**

| Data Domain | Sources | Key Assets |
|-------------|---------|-----------|
| **Customer** | PostgreSQL, Stripe, PayPal | Customer profiles, payment methods, addresses |
| **Orders** | PostgreSQL, Stripe | Order history, line items, payment records |
| **Products** | PostgreSQL, PIM | Product catalog, pricing, inventory |
| **Payments** | Stripe, PayPal | Transactions, refunds, disputes |
| **Shipping** | Carrier APIs, PostgreSQL | Shipments, tracking, delivery confirmations |
| **Analytics** | Data Lake, Synapse | Aggregated sales, customer segments, forecasts |
| **Marketing** | Email platform, web analytics | Campaigns, email events, page views |

### PIPEDA/GDPR Compliance Tracking

**Regulatory compliance capabilities:**

1. **GDPR compliance:**
   - Automated discovery of EU citizen personal data across all data stores
   - Data Subject Access Request (DSAR) support: Find all data about a specific individual
   - Right to erasure tracking: Identify all locations where a customer's data exists
   - Consent management integration: Track data processing legal basis
   - Data processing records: Automated Article 30 records of processing activities
   - Cross-border data transfer tracking

2. **PIPEDA compliance (Canada):**
   - While Purview does not have a PIPEDA-specific template, its capabilities support PIPEDA requirements:
   - **Principle 4.3 (Consent):** Track where personal information is collected and processed
   - **Principle 4.5 (Limiting Use):** Data lineage shows how personal data flows and is used
   - **Principle 4.6 (Accuracy):** Data quality rules ensure accuracy of personal information
   - **Principle 4.8 (Openness):** Catalog provides transparency about data practices
   - **Principle 4.9 (Individual Access):** Catalog enables locating all data about an individual
   - Custom compliance assessments can be created to map PIPEDA principles

3. **Compliance Manager dashboard:**
   - Real-time compliance scoring against regulatory frameworks
   - Pre-built assessments for GDPR, HIPAA, ISO 27001, PCI DSS, NIST
   - Actionable improvement recommendations
   - Evidence collection and audit trail
   - Custom assessment creation for PIPEDA

4. **PCI DSS support (critical for e-commerce):**
   - Discover and classify payment card data across all systems
   - Monitor for unauthorized storage of full card numbers
   - Track data flows involving payment information

### Data Lineage

**End-to-end data lineage tracking:**

- **Visual lineage viewer:** Graphical representation of data flow from source to destination
- **Automated lineage capture** from:
  - Azure Data Factory pipelines (automatic)
  - Synapse SQL queries and Spark notebooks (automatic)
  - Power BI datasets and reports (automatic)
  - Custom applications (via REST API and Atlas hooks)

- **E-commerce lineage example:**
  ```
  Stripe API -> ADF Pipeline -> ADLS Bronze -> Spark Transform -> ADLS Silver
  -> Synapse SQL View -> Power BI Dataset -> Sales Dashboard
  ```

- **Impact analysis:** Understand downstream impact before changing data sources or schemas
- **Root cause analysis:** Trace data quality issues back to their origin
- **Audit compliance:** Demonstrate to auditors exactly how data flows through the system

### Data Classification and Sensitivity Labels

**Built-in classifiers for e-commerce:**

| Classification | Type | Examples |
|---------------|------|---------|
| Credit Card Number | PII/Financial | Visa, MasterCard, Amex patterns |
| Social Insurance Number (SIN) | PII (Canada) | 9-digit Canadian SIN |
| Email Address | PII | Customer email addresses |
| Phone Number | PII | Customer phone numbers |
| Physical Address | PII | Shipping/billing addresses |
| Date of Birth | PII | Customer birthdates |
| Bank Account Number | Financial | Payment account details |
| IP Address | PII/Technical | Customer IP from web logs |

**Sensitivity labels:**
- **Public:** Product catalog, published prices
- **General:** Internal reports, aggregated analytics
- **Confidential:** Customer PII, order details
- **Highly Confidential:** Payment data, financial records, medical information (if applicable to peptide products)

**Auto-labeling policies:**
- Automatically apply labels based on data classification results
- Enforce encryption and access restrictions based on labels
- Track label application across the entire data estate
- Alert on sensitive data appearing in unexpected locations

---

## 7. Architecture Patterns

### Reference Architecture: E-Commerce Analytics Platform

```
                                    REAL-TIME PATH
                                    ==============
[Web App] -> [Event Hubs] -> [Stream Analytics] -> [Power BI Streaming]
                |                    |                      |
                v                    v                      v
         [Event Archive]      [Azure Functions]     [Real-time Dashboard]
         (ADLS Bronze)        (Fraud Alerts)         (Admin Panel)
                                    |
                                    v
                            [Azure ML Endpoint]
                            (Fraud Scoring)

                                    BATCH PATH
                                    ==========
[Stripe API] --\
[PayPal API] ---\
[Carriers] -------> [Azure Data Factory] -> [ADLS Gen2] -> [Synapse/Fabric]
[PostgreSQL] ---/         |                  (Medallion)         |
[Web Logs] ----/          |                                      v
                          v                               [Power BI Reports]
                    [Data Quality]                        (Embedded in Admin)
                    [Purview Scan]
                          |
                          v                              ML PATH
                    [Data Catalog]                       =======
                    [Compliance]                  [Synapse/ADLS] -> [Azure ML]
                                                       |               |
                                                  [Feature Store]  [Model Registry]
                                                       |               |
                                                       v               v
                                                  [Training]    [Endpoints]
                                                                (Churn, Demand,
                                                                 Fraud, Price)
```

### Medallion Lakehouse Architecture for E-Commerce

**Bronze Layer (Raw):**
- Raw JSON/CSV from all source systems
- Append-only, immutable
- Partitioned by source system and date
- No transformations, no deletions
- Purpose: Audit trail, reprocessing capability

**Silver Layer (Cleansed):**
- Deduplicated, validated records
- Standardized schemas across sources
- Type corrections and null handling
- Business key resolution (customer matching across Stripe/PayPal)
- SCD Type 2 for slowly changing dimensions

**Gold Layer (Business-Ready):**
- Pre-computed aggregations for dashboards
- Star schema for BI consumption
- Materialized business metrics
- Optimized for query performance
- Serves Power BI DirectQuery and Import

### Microsoft Fabric Consideration

**Important note for 2026:** Microsoft is positioning **Microsoft Fabric** as the successor to Azure Synapse Analytics. Key considerations:

- Fabric is a SaaS platform (vs. Synapse as PaaS)
- Combines Data Factory, Synapse Data Engineering, Synapse Data Warehouse, Synapse Data Science, Real-Time Analytics, and Power BI into one platform
- OneLake provides unified storage (eliminates need for separate ADLS configuration)
- Capacity-based pricing (F-SKUs) simplifies billing
- Better Power BI integration (native, no separate service)
- Microsoft is focusing innovation on Fabric, not Synapse

**Recommendation:** For a new e-commerce analytics platform in 2026, consider starting with Microsoft Fabric rather than individual Azure services. However, the concepts (medallion architecture, ETL patterns, ML integration) remain the same.

---

## 8. Cost Optimization

### Cost Estimation for E-Commerce Analytics (Small-to-Medium Scale)

**Scenario:** 10,000 orders/month, 500K page views/month, 50,000 customers, 5 admin users

| Service | Configuration | Est. Monthly Cost (USD) |
|---------|--------------|------------------------|
| **Azure Data Factory** | 5 pipelines, daily runs | $50-150 |
| **ADLS Gen2** | 500 GB storage + transactions | $10-25 |
| **Synapse Serverless** | 2 TB/month scanned | $10 |
| **Synapse Dedicated** | DW100c, 8h/day (pause overnight) | ~$290 |
| **Stream Analytics** | 3 SU, continuous | ~$250 |
| **Power BI Pro** | 5 admin users | $70 |
| **Power BI Embedded** | A1 SKU (if embedding) | ~$735 |
| **Azure ML** | Standard_DS3_v2 endpoint | ~$200-400 |
| **Event Hubs** | Basic tier, 1 TU | ~$12 |
| **Purview** | Standard tier | ~$0.25/asset scanned |
| **Azure Functions** | Consumption plan (alerts) | $5-20 |
| **TOTAL (without embedding)** | | **~$900-1,400/month** |
| **TOTAL (with Power BI Embedded)** | | **~$1,600-2,100/month** |

### Cost Optimization Strategies

1. **Pause Synapse dedicated pool** during off-hours (save 60-70%)
2. **Use serverless SQL pool** for ad-hoc queries instead of keeping dedicated pool running
3. **Reserved capacity** for Synapse (1-year: 25% discount, 3-year: 55% discount)
4. **Auto-pause and auto-scale** for ML endpoints (scale to zero when not in use)
5. **Partition and use Parquet** in Data Lake to minimize serverless query costs
6. **Incremental extraction** in ADF to reduce data movement costs
7. **Azure Hybrid Benefit** if you have existing SQL Server licenses
8. **Start with Power BI Pro** ($14/user/month) before investing in Embedded capacity
9. **Use Azure Cost Management** with budget alerts at 50%, 75%, 90% thresholds
10. **Tag all resources** by service and purpose for cost attribution

### Scaling Cost Considerations

| Scale | Orders/Month | Recommended Config | Est. Monthly Cost |
|-------|-------------|-------------------|------------------|
| Startup | <1,000 | Serverless only + Power BI Pro | $100-300 |
| Small | 1,000-10,000 | Serverless + small dedicated + Pro | $500-1,500 |
| Medium | 10,000-100,000 | Dedicated + Embedded + ML | $2,000-5,000 |
| Large | 100,000-1M | Fabric F64 + ML cluster | $8,000-20,000 |
| Enterprise | >1M | Fabric F128+ + dedicated ML | $25,000+ |

---

## 9. Migration Considerations: Synapse vs. Fabric

### Current State (February 2026)

- Azure Synapse Analytics remains **fully supported** and functional
- Microsoft Fabric is **generally available** and receiving all new innovation
- No automatic migration path exists; manual migration required
- P-SKUs (Power BI Premium capacity) have been retired and replaced by F-SKUs

### Decision Framework

| Factor | Choose Synapse | Choose Fabric |
|--------|---------------|--------------|
| Existing investment | Heavy Synapse investment | Greenfield project |
| Team skills | Strong SQL/Spark skills | Mixed skill levels |
| Customization needs | High customization required | Standard patterns suffice |
| Power BI integration | Separate BI team | Unified analytics team |
| Cost model preference | Pay-per-resource (PaaS) | Capacity-based (SaaS) |
| Governance | Custom governance needed | Purview integration wanted |
| Timeline | Immediate (proven platform) | Can adopt newer platform |

### Recommendation for Peptide Plus

Given that this is a **new implementation** (not a migration), the recommendation is:

1. **Start with Microsoft Fabric** for data warehousing and Power BI (future-proof)
2. **Use Azure Data Factory** for ETL (works with both Synapse and Fabric)
3. **Use Azure Stream Analytics** for real-time processing (independent service)
4. **Use Azure Machine Learning** for ML workloads (independent service)
5. **Use Microsoft Purview** for governance (integrates with Fabric natively)

---

## 10. Implementation Roadmap

### Phase 1: Foundation (Months 1-2)
- Set up Azure Data Lake Storage Gen2 with medallion architecture
- Configure Azure Data Factory pipelines for PostgreSQL data extraction
- Implement Stripe data ingestion pipeline (REST connector)
- Deploy basic Power BI Pro reports for admin team
- Set up Microsoft Purview scanning on PostgreSQL database

### Phase 2: Real-Time Analytics (Months 2-3)
- Deploy Azure Event Hubs for order and user event streaming
- Configure Azure Stream Analytics for real-time order metrics
- Build real-time sales dashboard in Power BI (streaming dataset)
- Implement basic fraud detection rules in Stream Analytics
- Add PayPal and shipping provider data pipelines

### Phase 3: Advanced Analytics (Months 3-5)
- Train customer churn prediction model in Azure ML
- Deploy demand forecasting model for inventory optimization
- Build customer segmentation reports (RFM analysis)
- Implement Power BI Embedded in admin panel (if user count justifies)
- Configure Purview sensitivity labels and compliance assessments

### Phase 4: Optimization (Months 5-6)
- Deploy ML-based fraud detection model
- Implement price optimization models
- Build comprehensive data lineage in Purview
- Optimize costs (pause schedules, reserved capacity, partitioning)
- Set up PIPEDA and GDPR compliance tracking dashboards
- Implement automated model retraining pipelines (MLOps)

---

## Sources

### Azure Synapse Analytics
- [Azure for Analytics in 2026 - Integrate.io](https://www.integrate.io/blog/azure-for-analytics-in-2025/)
- [Azure Synapse Analytics - Microsoft Azure](https://azure.microsoft.com/en-us/products/synapse-analytics)
- [Azure Synapse Analytics 2025 - BayTech](https://www.baytechconsulting.com/blog/azure-synapse-analytics-2025)
- [What is Azure Synapse Analytics? - Microsoft Learn](https://learn.microsoft.com/en-us/azure/synapse-analytics/overview-what-is)
- [Serverless SQL Pool - Microsoft Learn](https://learn.microsoft.com/en-us/azure/synapse-analytics/sql/on-demand-workspace-overview)
- [Azure Synapse Pricing - Microsoft](https://azure.microsoft.com/en-us/pricing/details/synapse-analytics/)
- [Dedicated vs Serverless SQL Pool - AlphaBold](https://www.alphabold.com/dedicated-sql-pool-and-serverless-sql-in-azure-comparison/)
- [Synapse Analytics Pricing Explained - CloudOptimo](https://www.cloudoptimo.com/blog/azure-synapse-analytics-explained-pricing-features-and-tuning-tips/)
- [Serverless SQL Pool Cost Management - Microsoft Learn](https://learn.microsoft.com/en-us/troubleshoot/azure/synapse-analytics/serverless-sql/query-perf/ssql-perf-optimize-cost)

### Power BI Embedded
- [Power BI Client React - Microsoft Learn](https://learn.microsoft.com/en-us/javascript/api/overview/powerbi/powerbi-client-react)
- [powerbi-client-react - GitHub](https://github.com/microsoft/powerbi-client-react)
- [Embed for Customers - Microsoft Learn](https://learn.microsoft.com/en-us/power-bi/developer/embedded/embed-sample-for-customers)
- [Power BI Embedded Pocket Guide - Holistics](https://www.holistics.io/blog/power-bi-embedded/)
- [Power BI E-commerce Dashboard - Vidi Corp](https://vidi-corp.com/power-bi-ecommerce-dashboards/)
- [Power BI Ecommerce Dashboard Full Funnel - Medium](https://medium.com/@seo.xbyteanalytics/power-bi-ecommerce-dashboard-full-funnel-view-of-traffic-orders-revenue-f7ab7a24f4fb)
- [Power BI Pricing 2026 - Mammoth](https://mammoth.io/blog/power-bi-pricing/)
- [Power BI Licensing 2025-2026 - NimusTech](https://nimustech.com/2025/12/22/guide-to-power-bi-licensing-changes-in-2025-2026/)
- [Power BI Embedded Pricing - Microsoft Azure](https://azure.microsoft.com/en-us/pricing/details/power-bi-embedded/)
- [Capacity and SKUs - Microsoft Learn](https://learn.microsoft.com/en-us/power-bi/developer/embedded/embedded-capacity)
- [Power BI Premium vs Embedded - Upsolve](https://upsolve.ai/blog/power-bi-premium-vs-embedded)

### Azure Data Factory
- [Azure Data Factory - Microsoft Azure](https://azure.microsoft.com/en-us/products/data-factory)
- [Introduction to ADF - Microsoft Learn](https://learn.microsoft.com/en-us/azure/data-factory/introduction)
- [ETL with Azure Data Factory - Integrate.io](https://www.integrate.io/blog/microsoft-etl-understanding-etl-with-azure-data-factory/)
- [Building ETL with ADF - Analytics Vidhya](https://www.analyticsvidhya.com/blog/2022/06/building-an-etl-data-pipeline-using-azure-data-factory/)
- [REST Connector - Microsoft Learn](https://learn.microsoft.com/en-us/azure/data-factory/connector-rest)
- [Stripe REST API Integration with ADF - Microsoft Q&A](https://learn.microsoft.com/en-us/answers/questions/792460/stripe-rest-api-integration-with-adf)
- [Webhook Activity - Microsoft Learn](https://learn.microsoft.com/en-us/azure/data-factory/control-flow-webhook-activity)
- [ADF End-to-End Automation - CloudOptimo](https://www.cloudoptimo.com/blog/azure-data-factory-for-end-to-end-data-integration-and-automation/)

### Azure Stream Analytics
- [Azure Stream Analytics Event-Driven Architecture - AppStream Studio](https://appstream.studio/blog/azure-stream-analytics-event-driven-architecture)
- [Azure Real-Time Fraud Detection - GitHub/Microsoft](https://github.com/microsoft/azure-realtime-fraud-detection)
- [Real-Time Data Processing Guide - Addend Analytics](https://addendanalytics.com/blog/real-time-data-processing-with-azure-stream-analytics-a-data-engineers-guide)
- [Near Real-time Fraud Analytics - Microsoft Accelerators](https://msusazureaccelerators.github.io/accelerators/near-real-time-fraud-and-compliance-analytics.html)
- [Stream Analytics Windowing Functions - Microsoft Learn](https://learn.microsoft.com/en-us/azure/stream-analytics/stream-analytics-window-functions)
- [Tumbling Window - Microsoft Learn](https://learn.microsoft.com/en-us/stream-analytics-query/tumbling-window-azure-stream-analytics)
- [Real-Time Fraud Detection with Stream Analytics - Microsoft Docs](https://github.com/MicrosoftDocs/azure-docs/blob/main/articles/stream-analytics/stream-analytics-real-time-fraud-detection.md)

### Azure Machine Learning
- [AI Forecast Customer Orders - Microsoft Learn](https://learn.microsoft.com/en-us/azure/architecture/ai-ml/idea/next-order-forecasting)
- [Customer Churn Prediction Architecture - Microsoft Learn](https://learn.microsoft.com/en-us/azure/architecture/ai-ml/idea/customer-churn-prediction)
- [AutoML Demand Forecasting Tutorial - Microsoft Learn](https://learn.microsoft.com/en-us/azure/machine-learning/tutorial-automated-ml-forecast?view=azureml-api-2)
- [Churn Prediction Sample - GitHub/Azure](https://github.com/Azure-Samples/MachineLearningSamples-ChurnPrediction)
- [ML Use Cases in Retail - Microsoft Azure Blog](https://azure.microsoft.com/en-us/blog/current-use-cases-for-machine-learning-in-retail-and-consumer-goods/)
- [Online Endpoints for Real-Time Inference - Microsoft Learn](https://learn.microsoft.com/en-us/azure/machine-learning/concept-endpoints-online?view=azureml-api-2)
- [MLOps Model Management - Microsoft Learn](https://learn.microsoft.com/en-us/azure/machine-learning/concept-model-management-and-deployment?view=azureml-api-2)
- [Azure ML Deployment Guide - Imaginary Cloud](https://www.imaginarycloud.com/blog/azure-machine-learning-deployment-and-mlops-guide)
- [Fraud Detection with Azure Cosmos DB Vector Search - Microsoft Learn](https://learn.microsoft.com/en-us/samples/azurecosmosdb/cosmos-fabric-samples/fraud-detection/)
- [Big Data Fraud Detection on Azure - Inovex](https://www.inovex.de/en/references/case-studies/big-data-optimised-fraud-detection-in-microsoft-azure/)

### Microsoft Purview
- [Data Governance Overview - Microsoft Learn](https://learn.microsoft.com/en-us/purview/data-governance-overview)
- [Microsoft Purview Guide - DynaTech](https://dynatechconsultancy.com/blog/microsoft-purview-data-governance-compliance-and-security)
- [Purview Evolving in 2025 - Refoundry](https://refoundry.com/why-data-governance-matters-and-how-microsoft-purview-is-evolving-in-2025/)
- [Purview Benefits - James Serra](https://www.jamesserra.com/archive/2025/10/microsoft-purview-the-key-benefits-of-data-governance/)
- [Classifications and Sensitivity Labels - James Serra](https://www.jamesserra.com/archive/2024/07/classifications-and-sensitivity-labels-in-microsoft-purview/)
- [Data Classification and Labels - 2toLead](https://www.2tolead.com/insights/microsoft-purview-data-classification-labels)
- [Sensitivity Labels in Data Map - Microsoft Learn](https://learn.microsoft.com/en-us/purview/data-map-sensitivity-labels)
- [Purview Data Lineage - Medium](https://medium.com/@akkhil0024/microsoft-purview-from-lens-of-a-product-owner-4b30692a8855)

### Architecture and Case Studies
- [Retail Data Solutions Architecture - Microsoft Learn](https://learn.microsoft.com/en-us/industry/retail/retail-data-solutions/architecture/ra-retail-data-solutions)
- [E-commerce Front End Architecture - Microsoft Learn](https://learn.microsoft.com/en-us/azure/architecture/example-scenario/apps/ecommerce-scenario)
- [Solutions for Retail - Microsoft Azure Architecture Center](https://learn.microsoft.com/en-us/azure/architecture/industries/retail)
- [Data Warehousing Analytics Architecture - Microsoft Learn](https://learn.microsoft.com/en-us/azure/architecture/example-scenario/data/data-warehouse)
- [Azure Case Studies: Retail - DataBeat](https://databeat.io/case-studies/azure-case-studies-architecture/)
- [Medallion Architecture - Microsoft Learn](https://learn.microsoft.com/en-us/azure/databricks/lakehouse/medallion)
- [Medallion in Fabric - Microsoft Learn](https://learn.microsoft.com/en-us/fabric/onelake/onelake-medallion-lakehouse-architecture)

### Microsoft Fabric vs. Synapse
- [Fabric vs Synapse Architecture - Atlan](https://atlan.com/microsoft-fabric-vs-azure-synapse/)
- [Azure Synapse vs Fabric 2025 - ChaosGenius](https://www.chaosgenius.io/blog/azure-synapse-vs-fabric/)
- [Fabric vs Synapse Capabilities - Kanerika](https://kanerika.com/blogs/fabric-vs-synapse/)
- [Fabric Modernization Path - Microsoft Fabric Blog](https://blog.fabric.microsoft.com/en-US/blog/two-years-on-how-fabric-redefines-the-modernization-path-for-synapse-users/)
- [Synapse to Fabric Migration - Microsoft Learn](https://learn.microsoft.com/en-us/fabric/data-warehouse/migration-synapse-dedicated-sql-pool-warehouse)

### Cost Optimization
- [Azure Cost Optimization Guide 2025 - Finout](https://www.finout.io/blog/azure-cost-optimization)
- [Azure Cost Management - Microsoft](https://azure.microsoft.com/en-us/solutions/cost-optimization)
- [Azure Cost Optimization Best Practices - Economize](https://www.economize.cloud/blog/azure-cost-optimization-strategies/)
