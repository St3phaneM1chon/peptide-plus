# Azure Monitoring & Observability: Comprehensive Strategy Report for Web Applications

This report covers all 15 areas of Azure monitoring and observability, with specific focus on Next.js web applications backed by PostgreSQL and Redis, deployed on Azure App Service.

---

## 1. Application Insights: Setup for Next.js

### OpenTelemetry-Based Setup (Recommended Approach)

The modern approach uses OpenTelemetry via `@vercel/otel` and the Azure Monitor exporter. This is the recommended path as Azure Application Insights has migrated to OpenTelemetry internally.

**Installation:**
```bash
npm install @vercel/otel @opentelemetry/api @azure/monitor-opentelemetry-exporter --save
```

**`instrumentation.ts` (project root):**
```typescript
import { AzureMonitorTraceExporter } from '@azure/monitor-opentelemetry-exporter';
import { registerOTel } from '@vercel/otel';

export async function register() {
  registerOTel({
    serviceName: 'peptide-plus',
    traceExporter: new AzureMonitorTraceExporter({
      connectionString: process.env.APPLICATIONINSIGHTS_CONNECTION_STRING,
    }),
  });
}
```

**`next.config.ts`:**
```typescript
const nextConfig = {
  experimental: {
    instrumentationHook: true,
  },
};
export default nextConfig;
```

### Classic SDK Setup (Server-Side)

For broader telemetry including custom events, metrics, and dependencies:

```typescript
import * as appInsights from 'applicationinsights';

appInsights
  .setup(process.env.APPLICATIONINSIGHTS_CONNECTION_STRING)
  .setAutoCollectRequests(true)
  .setAutoCollectPerformance(true, true)
  .setAutoCollectExceptions(true)
  .setAutoCollectDependencies(true)
  .setAutoCollectConsole(true, true)
  .setUseDiskRetryCaching(true)
  .setSendLiveMetrics(true)
  .start();

export const telemetryClient = appInsights.defaultClient;
```

**Critical:** Load `applicationinsights` before any other `require`/`import` statements so third-party libraries get properly instrumented.

### Client-Side JavaScript SDK

For browser-side telemetry (page views, client exceptions, AJAX calls):

```typescript
// In your Next.js layout or _app.tsx
import { ApplicationInsights } from '@microsoft/applicationinsights-web';

const appInsights = new ApplicationInsights({
  config: {
    connectionString: process.env.NEXT_PUBLIC_APPINSIGHTS_CONNECTION_STRING,
    enableAutoRouteTracking: true,
    enableCorsCorrelation: true,
    enableRequestHeaderTracking: true,
    enableResponseHeaderTracking: true,
  }
});
appInsights.loadAppInsights();
appInsights.trackPageView();
```

### Auto-Instrumentation (Azure App Service)

Azure App Service supports codeless auto-instrumentation for Node.js apps. Enable it in the Azure Portal under **App Service > Settings > Application Insights > Turn on Application Insights**. This automatically instruments your app without code changes but provides less control than the SDK approach.

### Sampling Configuration

Sampling reduces telemetry volume and costs while preserving statistical accuracy.

| Sampling Type | Description | Node.js Support |
|---|---|---|
| **Adaptive** | Dynamically adjusts rate based on traffic volume; targets ~5 items/sec | ASP.NET only (not Node.js) |
| **Fixed-Rate** | Set a ratio between 0 and 1 (e.g., 0.5 = 50% of traces) | Yes, via OpenTelemetry |
| **Ingestion** | Drops data at Azure ingestion endpoint; last-resort fallback | Yes (portal config) |

For Node.js/Next.js, configure fixed-rate sampling via OpenTelemetry:

```typescript
import { TraceIdRatioBasedSampler } from '@opentelemetry/sdk-trace-base';

registerOTel({
  serviceName: 'peptide-plus',
  traceExporter: new AzureMonitorTraceExporter({ connectionString: '...' }),
  sampler: new TraceIdRatioBasedSampler(0.5), // 50% sampling
});
```

**Important deadline:** As of March 31, 2025, instrumentation key ingestion is no longer supported. Use connection strings exclusively. As of September 30, 2025, API keys for live metrics are retired; use Microsoft Entra authentication instead.

Sources:
- [OpenTelemetry setup in NextJS with Azure Monitor - Maxwell Weru](https://www.maxwellweru.com/blog/2024/03/nextjs-opentelemetry-with-azure-monitor)
- [Application Insights JavaScript SDK - Microsoft Learn](https://learn.microsoft.com/en-us/azure/azure-monitor/app/javascript-sdk)
- [applicationinsights npm package](https://www.npmjs.com/package/applicationinsights)
- [Sampling in Application Insights with OpenTelemetry - Microsoft Learn](https://learn.microsoft.com/en-us/azure/azure-monitor/app/opentelemetry-sampling)
- [Telemetry sampling (Classic API) - Microsoft Learn](https://learn.microsoft.com/en-us/azure/azure-monitor/app/sampling-classic-api)

---

## 2. Azure Monitor: Metrics, Alerts, Action Groups, Dashboards

### Platform Metrics

Azure Monitor automatically collects platform metrics from Azure resources at 1-minute intervals. Key metrics for web apps:

| Resource | Key Metrics |
|---|---|
| **App Service** | CPU Percentage, Memory Percentage, Http Server Errors, Response Time, Requests, Data In/Out |
| **PostgreSQL Flexible** | CPU Percent, Memory Percent, Active Connections, Storage Percent, IOPS, Network In/Out |
| **Redis Cache** | Cache Hits/Misses, Connected Clients, Server Load, Used Memory, Cache Latency |
| **Application Insights** | Server Response Time, Server Requests, Failed Requests, Dependency Duration, Exception Rate |

### Alert Types

| Alert Type | Use Case | Evaluation |
|---|---|---|
| **Metric Alerts** | Numeric thresholds (CPU > 80%, response time > 2s) | Real-time, 1-min frequency |
| **Log Search Alerts** | KQL-based conditions on log data | Configurable frequency (1-60 min) |
| **Activity Log Alerts** | Azure resource events (deployments, scaling, restarts) | Event-driven |
| **Smart Detection** | ML-based anomaly detection (failure rate spikes) | Automatic, no config needed |

### Static vs Dynamic Thresholds

- **Static thresholds**: Fixed values (e.g., CPU > 80%). Simple but require manual tuning and maintenance.
- **Dynamic thresholds**: ML-based, learns historical behavior patterns (hourly, daily, weekly seasonality). Requires 3 days and 30+ samples before activating. Best for noisy metrics like CPU/memory and for detecting significant deviations.

**Best practice:** Use dynamic thresholds for metrics with predictable patterns; use static thresholds for absolute limits (e.g., disk full, connection pool exhausted).

### Alert Severity Levels

| Severity | Label | Use Case |
|---|---|---|
| **Sev0** | Critical | Production down, data loss risk |
| **Sev1** | Error | Service degraded, user impact |
| **Sev2** | Warning | Potential issues, performance degradation |
| **Sev3** | Informational | Unusual activity, capacity planning |
| **Sev4** | Verbose | Diagnostic, debugging |

### Action Groups

Action groups define notification and automation targets:

- **Notifications**: Email, SMS, voice call, push notification
- **Automated Actions**: Azure Function, Logic App, Webhook (including secure webhooks), ITSM connector, Event Hub, Automation Runbook

**Best practices:**
- Use one alert rule to monitor multiple resources when possible
- Use alert processing rules to control behavior at scale (e.g., suppress during maintenance windows)
- Prefer secure webhook actions for stronger authentication
- Up to 5 action groups per alert rule; action groups execute concurrently

### Dashboards

Azure supports multiple dashboard approaches:
- **Azure Portal Dashboards**: Pin metrics charts and query results directly
- **Azure Monitor Workbooks**: Rich interactive reports with KQL (see section 9)
- **Grafana Dashboards**: Now natively integrated in Azure Portal at no additional cost (GA November 2025)

Sources:
- [Azure Monitor Alerts Overview - Microsoft Learn](https://learn.microsoft.com/en-us/azure/azure-monitor/alerts/alerts-overview)
- [Best Practices for Azure Monitor Alerts - Microsoft Learn](https://learn.microsoft.com/en-us/azure/azure-monitor/alerts/best-practices-alerts)
- [Action Groups - Microsoft Learn](https://learn.microsoft.com/en-us/azure/azure-monitor/alerts/action-groups)
- [Dynamic Thresholds - Microsoft Learn](https://learn.microsoft.com/en-us/azure/azure-monitor/alerts/alerts-dynamic-thresholds)
- [Azure Monitor 101 - Microsoft Community Hub](https://techcommunity.microsoft.com/blog/startupsatmicrosoftblog/azure-monitor-101-the-missing-guide-to-understanding-monitoring-on-azure/4462799)

---

## 3. Log Analytics Workspace: KQL Queries, Retention, Costs

### Architecture

A Log Analytics workspace is the central data store for Azure Monitor Logs. Application Insights resources (workspace-based) store their data in a Log Analytics workspace. All billing for data ingestion and retention is done at the workspace level.

### Key Tables for Web Applications

| Table | Content |
|---|---|
| `AppRequests` | Incoming HTTP requests |
| `AppDependencies` | Outgoing calls (DB, HTTP, Redis) |
| `AppExceptions` | Application exceptions |
| `AppTraces` | Log messages and traces |
| `AppMetrics` | Performance counters and custom metrics |
| `AppPageViews` | Client-side page views |
| `AppBrowserTimings` | Client-side load times |
| `AppAvailabilityResults` | Availability test results |
| `AppServiceHTTPLogs` | App Service HTTP access logs |
| `AppServiceConsoleLogs` | Console output from the app |
| `AzureDiagnostics` | Resource diagnostic logs |

### Essential KQL Queries

**Slow Requests (> 2 seconds):**
```kql
AppRequests
| where TimeGenerated > ago(24h)
| where DurationMs > 2000
| project TimeGenerated, Name, DurationMs, ResultCode, Url
| order by DurationMs desc
| take 50
```

**Error Rate Over Time:**
```kql
AppRequests
| where TimeGenerated > ago(7d)
| summarize TotalRequests = count(),
            FailedRequests = countif(toint(ResultCode) >= 500)
            by bin(TimeGenerated, 1h)
| extend ErrorRate = round(100.0 * FailedRequests / TotalRequests, 2)
| project TimeGenerated, ErrorRate, TotalRequests, FailedRequests
| render timechart
```

**Top Slow Dependencies:**
```kql
AppDependencies
| where TimeGenerated > ago(24h)
| summarize AvgDuration = avg(DurationMs),
            P95Duration = percentile(DurationMs, 95),
            Count = count()
            by Target, Name, Type
| order by P95Duration desc
| take 20
```

**Exception Trends:**
```kql
AppExceptions
| where TimeGenerated > ago(7d)
| summarize Count = count() by bin(TimeGenerated, 1h), ProblemId
| render timechart
```

**PostgreSQL Slow Queries:**
```kql
AzureDiagnostics
| where ResourceProvider == "MICROSOFT.DBFORPOSTGRESQL"
| where Category == "QueryStoreRuntimeStatistics"
| where mean_time_s > 1
| project TimeGenerated, db_id_s, query_id_s, mean_time_s, calls_s
| order by mean_time_s desc
```

### Data Retention and Costs

| Retention Type | Duration | Cost |
|---|---|---|
| **Interactive Retention** | Default 30 days, configurable up to 730 days (2 years) | ~$0.10/GB/month beyond 30 days |
| **Long-term Retention** | Up to 12 years | ~$0.02/GB/month |
| **Search Jobs** | To retrieve long-term data | Per-query charge |

### Pricing Tiers

| Plan | Rate | Notes |
|---|---|---|
| **Pay-As-You-Go** | ~$2.30/GB ingested | First 5 GB/month free |
| **100 GB/day Commitment** | ~$1.96/GB (15% discount) | |
| **200 GB/day Commitment** | ~$1.84/GB (20% discount) | |
| **500 GB/day Commitment** | ~$1.61/GB (30% discount) | |

### Cost Optimization with KQL Transformations

Use ingestion-time transformations to filter, project, aggregate, or drop data before it reaches the workspace:

```kql
// Example: Drop verbose health-check requests at ingestion
source
| where Name != "GET /health"
| where Name != "GET /ready"
```

**Best practices:**
- Filter early in queries using `where` to reduce dataset size
- Be specific with `project` to limit output columns
- Set appropriate retention per table (not everything needs 90 days)
- Use Basic logs plan for high-volume, low-value tables
- Consider ingestion-time transformations to drop noisy data

Sources:
- [Log Analytics Workspace Overview - Microsoft Learn](https://learn.microsoft.com/en-us/azure/azure-monitor/logs/log-analytics-workspace-overview)
- [Azure Monitor Logs Cost Calculations - Microsoft Learn](https://learn.microsoft.com/en-us/azure/azure-monitor/logs/cost-logs)
- [Manage Data Retention - Microsoft Learn](https://learn.microsoft.com/en-us/azure/azure-monitor/logs/data-retention-configure)
- [Four Strategies for Cost-Effective Azure Monitoring - Microsoft Community Hub](https://techcommunity.microsoft.com/blog/azuregovernanceandmanagementblog/four-strategies-for-cost-effective-azure-monitoring-and-log-analytics/4101784)
- [KQL in Azure for Application Monitoring - CloudThat](https://www.cloudthat.com/resources/blog/using-kql-in-azure-for-application-monitoring-and-insights)

---

## 4. Diagnostic Settings: App Service, PostgreSQL, Redis

### Azure App Service

**Log Categories to Enable:**

| Category | Description | Priority |
|---|---|---|
| `AppServiceHTTPLogs` | HTTP access logs (method, URL, status, duration) | **Essential** |
| `AppServiceConsoleLogs` | Console stdout/stderr output | **Essential** |
| `AppServiceAppLogs` | Application-generated logs | **Essential** |
| `AppServicePlatformLogs` | Platform operations (scaling, config changes) | Recommended |
| `AppServiceAuditLogs` | Login activity via Kudu | Recommended |
| `AppServiceIPSecAuditLogs` | IP security audit | Optional |
| `AppServiceFileAuditLogs` | Site content changes | Optional |
| **AllMetrics** | Platform metrics (CPU, memory, requests) | Only if needed in Log Analytics |

**Note:** Enabling diagnostic settings adds app settings and triggers an app restart.

### Azure Database for PostgreSQL (Flexible Server)

**Log Categories:**

| Category | Description | Priority |
|---|---|---|
| `PostgreSQLLogs` | Server logs (errors, warnings, connections) | **Essential** |
| `QueryStoreRuntimeStatistics` | Query execution stats (duration, calls, rows) | **Essential** |
| `QueryStoreWaitStatistics` | Wait event statistics | Recommended |
| `Sessions` | Active session data | Recommended |

**Server Parameters to Enable:**
```
log_checkpoints = on
log_connections = on
log_disconnections = on
log_duration = on
log_min_duration_statement = 1000   # Log queries > 1s
log_statement = 'ddl'               # Log DDL statements
pg_qs.query_capture_mode = 'ALL'    # Enable Query Store
pgms_wait_sampling.query_capture_mode = 'ALL'
```

**Important:** PostgreSQL metrics emit at 1-minute intervals with up to 93 days of retention. Autovacuum metrics require enabling `metrics.autovacuum_diagnostics = ON` and emit at 30-minute intervals.

### Azure Cache for Redis

**Log Categories:**

| Category | Description | Priority |
|---|---|---|
| `ConnectedClientList` | Client connection logs (IP, duration) | **Essential** |
| `AllMetrics` | Cache hits/misses, latency, memory, connections | **Essential** |

**Destination requirements:**
- Log Analytics workspace: Can be in any region
- Storage Account: Must be in the same region as the cache
- Event Hub: Must be in the same region as the cache

### Configuration via Terraform (Recommended)

```hcl
resource "azurerm_monitor_diagnostic_setting" "app_service" {
  name                       = "app-service-diagnostics"
  target_resource_id         = azurerm_linux_web_app.main.id
  log_analytics_workspace_id = azurerm_log_analytics_workspace.main.id

  enabled_log { category = "AppServiceHTTPLogs" }
  enabled_log { category = "AppServiceConsoleLogs" }
  enabled_log { category = "AppServiceAppLogs" }
  enabled_log { category = "AppServicePlatformLogs" }
  metric { category = "AllMetrics" }
}
```

Sources:
- [Enable Diagnostic Logging - App Service - Microsoft Learn](https://learn.microsoft.com/en-us/azure/app-service/troubleshoot-diagnostic-logs)
- [Monitor App Service - Microsoft Learn](https://learn.microsoft.com/en-us/azure/app-service/monitor-app-service)
- [Configure and Access Logs - PostgreSQL - Microsoft Learn](https://learn.microsoft.com/en-us/azure/postgresql/flexible-server/how-to-configure-and-access-logs)
- [Monitor Diagnostic Settings - Redis - Microsoft Learn](https://learn.microsoft.com/en-us/azure/azure-cache-for-redis/cache-monitor-diagnostic-settings)
- [Diagnostic Settings - Azure Monitor - Microsoft Learn](https://learn.microsoft.com/en-us/azure/azure-monitor/platform/diagnostic-settings)

---

## 5. Application Performance Management (APM)

### Request Tracking

Application Insights automatically tracks all incoming HTTP requests with:
- URL, method, response code, duration
- Client IP, user agent, session context
- Correlation IDs for distributed tracing

The `AppRequests` table captures:
```kql
AppRequests
| where TimeGenerated > ago(1h)
| summarize AvgDuration = avg(DurationMs),
            P50 = percentile(DurationMs, 50),
            P95 = percentile(DurationMs, 95),
            P99 = percentile(DurationMs, 99),
            ErrorRate = countif(toint(ResultCode) >= 500) * 100.0 / count()
            by Name
| order by P95 desc
```

### Dependency Tracking

Auto-collected dependencies for Node.js include:
- **HTTP/HTTPS** outbound calls (including API calls)
- **PostgreSQL** queries (via `pg` driver instrumentation)
- **Redis** commands (via `ioredis`/`redis` client instrumentation)
- **Azure SDK** calls (Storage, Service Bus, etc.)

The `AppDependencies` table captures target, name, type, duration, success/failure, and result code.

### Exception Tracking

```typescript
// Automatic: unhandled exceptions are auto-captured
// Manual: track caught exceptions
try {
  await riskyOperation();
} catch (error) {
  telemetryClient.trackException({
    exception: error as Error,
    properties: { operation: 'checkout', userId: user.id },
    measurements: { cartValue: cart.total }
  });
}
```

The **Failures** blade in the Azure Portal provides:
- Aggregated failure rates over time
- Top failing operations and dependencies
- Exception details with full stack traces
- Correlation to specific requests and users

### Live Metrics Stream

Real-time monitoring dashboard showing:
- Incoming request rate and duration
- Dependency call rate and duration
- Exception rate
- CPU, memory, and thread count
- Custom live filters for specific telemetry

Enable with: `appInsights.setup().setSendLiveMetrics(true).start();`

### Application Map

Visual topology showing:
- All components of your distributed application
- Call volumes between components
- Average durations and failure rates
- Health status (green/yellow/red) per component

Sources:
- [Application Insights Overview - Microsoft Learn](https://learn.microsoft.com/en-us/azure/azure-monitor/app/app-insights-overview)
- [Dependency Tracking - Microsoft Learn](https://learn.microsoft.com/en-us/azure/azure-monitor/app/dependencies)
- [Enable Application Monitoring - App Service - Microsoft Learn](https://learn.microsoft.com/en-us/azure/azure-monitor/app/codeless-app-service)
- [Azure APM Key Components - Vineet Sharma / Medium](https://mvineetsharma.medium.com/azure-application-performance-monitoring-apm-key-components-and-features-450c660bfe10)
- [Application Insights Easy Guide - Umesh Pandit](https://umeshpandit.com/2025/09/08/azure-application-insights-easy-guide-to-monitoring/)

---

## 6. Custom Metrics and Events: Business KPIs & Conversion Tracking

### Custom Events

```typescript
// Track business events
telemetryClient.trackEvent({
  name: 'OrderPlaced',
  properties: {
    orderId: order.id,
    paymentMethod: order.paymentMethod,
    productCategory: order.items[0].category,
    couponUsed: order.couponCode ? 'true' : 'false',
  },
  measurements: {
    orderTotal: order.total,
    itemCount: order.items.length,
    discountAmount: order.discount,
  }
});

// Track user actions
telemetryClient.trackEvent({
  name: 'ProductViewed',
  properties: {
    productId: product.id,
    productName: product.name,
    source: referrer,
  }
});

// Track conversion funnel
telemetryClient.trackEvent({
  name: 'CheckoutStep',
  properties: {
    step: 'payment_entered',
    sessionId: session.id,
  }
});
```

### Custom Metrics

```typescript
// Track numeric KPIs
telemetryClient.trackMetric({
  name: 'ActiveSubscriptions',
  value: activeCount
});

telemetryClient.trackMetric({
  name: 'CartAbandonmentRate',
  value: abandonedCarts / totalCarts * 100
});

// Use GetMetric for pre-aggregation (recommended for high-volume)
// Pre-aggregates locally, sends summary once/minute
// Significantly reduces cost and performance overhead
```

### Conversion Funnel KQL Query

```kql
let funnel = customEvents
| where TimeGenerated > ago(30d)
| where name in ("ProductViewed", "AddedToCart", "CheckoutStarted", "PaymentEntered", "OrderPlaced")
| summarize Users = dcount(user_Id) by name
| order by Users desc;
funnel
```

### Business KPI Dashboard Queries

```kql
// Revenue per hour
customEvents
| where TimeGenerated > ago(24h)
| where name == "OrderPlaced"
| extend orderTotal = todouble(customMeasurements.orderTotal)
| summarize Revenue = sum(orderTotal), Orders = count() by bin(TimeGenerated, 1h)
| render timechart

// Average order value trend
customEvents
| where TimeGenerated > ago(30d)
| where name == "OrderPlaced"
| extend orderTotal = todouble(customMeasurements.orderTotal)
| summarize AOV = avg(orderTotal) by bin(TimeGenerated, 1d)
| render timechart
```

### Best Practices

- Use `GetMetric()` with pre-aggregation for high-frequency metrics (reduces cost and overhead)
- Store all custom metrics in both the metrics store and logs automatically
- Access custom metrics in Metrics Explorer under the `azure.applicationinsights` namespace
- Define meaningful property dimensions for filtering and segmentation

Sources:
- [Application Insights API for Custom Events and Metrics - Microsoft Learn](https://learn.microsoft.com/en-us/azure/azure-monitor/app/api-custom-events-metrics)
- [Custom Metrics in Azure Monitor - Microsoft Learn](https://learn.microsoft.com/en-us/azure/azure-monitor/metrics/metrics-custom-overview)
- [Metrics in Application Insights - Microsoft Learn](https://learn.microsoft.com/en-us/azure/azure-monitor/app/metrics-overview)
- [Application Insights Node.js SDK - GitHub](https://github.com/microsoft/ApplicationInsights-node.js)

---

## 7. Availability Tests

### Test Types (Current State)

| Test Type | Status | Cost |
|---|---|---|
| **Standard Test** | Recommended, active | Charged per test execution |
| **URL Ping Test** | **Retiring September 30, 2026** | Currently free |
| **Custom TrackAvailability** | Active, code-based | No direct test cost |

### Standard Test Configuration

Standard tests are the replacement for URL ping tests and should always be used if possible.

**Configuration parameters:**
- **URL**: The endpoint to test
- **Frequency**: Default 300 seconds (5 minutes); configurable
- **Test locations**: Up to 16 geographic locations worldwide
- **Success criteria**: HTTP response code, response time threshold, content match
- **SSL certificate validation**: Checks expiry, chain validity
- **HTTP method**: GET, POST, PUT, HEAD, etc.
- **Custom headers**: Authentication tokens, API keys
- **Request body**: For POST/PUT tests

**Important cost consideration:** Standard tests are charged per test execution. With 5 locations testing every 5 minutes, that is 5 x 288 = 1,440 tests/day per URL. Plan your test configurations carefully.

### Custom TrackAvailability (for Complex Scenarios)

```typescript
import { AvailabilityTelemetry } from 'applicationinsights/out/Declarations/Contracts';

async function runAvailabilityTest() {
  const startTime = Date.now();
  let success = true;
  let message = '';

  try {
    // Multi-step test: login, browse, checkout
    const loginResponse = await fetch('/api/auth/login', { method: 'POST', body: '...' });
    if (!loginResponse.ok) throw new Error(`Login failed: ${loginResponse.status}`);

    const productsResponse = await fetch('/api/products');
    if (!productsResponse.ok) throw new Error(`Products failed: ${productsResponse.status}`);

    message = 'All steps passed';
  } catch (error) {
    success = false;
    message = (error as Error).message;
  }

  telemetryClient.trackAvailability({
    name: 'Multi-Step Checkout Flow',
    duration: Date.now() - startTime,
    success,
    runLocation: 'Azure Function - East US',
    message,
    id: crypto.randomUUID(),
  });
}
```

### Migration Plan

Organizations using URL ping tests must migrate to standard tests before September 30, 2026. Standard tests provide:
- SSL certificate checks
- HTTP verb selection
- Custom headers
- Request body support
- Content validation

Sources:
- [Application Insights Availability Tests - Microsoft Learn](https://learn.microsoft.com/en-us/azure/azure-monitor/app/availability)
- [Availability Standard Tests - Microsoft Learn](https://learn.microsoft.com/EN-us/azure/azure-monitor/app/availability-standard-tests)
- [URL Ping Test Retirement Announcement - Microsoft Q&A](https://learn.microsoft.com/en-us/answers/questions/1376057/retirement-announcement-url-ping-tests-in-the-appl)
- [Standard Test Transition - Azure Updates](https://azure.microsoft.com/en-gb/updates/transition-to-using-standard-tests-for-singlestep-availability-testing-in-azure-monitor-application-insights-by-30-september/)
- [Standard Test Pricing Impact - Sysadmin Central](https://sysadmin-central.com/2026/01/15/your-azure-single-url-ping-tests-are-about-to-get-expensive/)

---

## 8. Smart Detection and Alerts

### Automatic Smart Detection Rules

Smart Detection uses machine learning to analyze telemetry patterns with **zero configuration required**.

**Failure Anomalies (Always Active):**
- Analyzes failure rates in a rolling 20-minute window
- Compares against the last 40 minutes and the past 7 days
- Uses adaptive thresholds based on the app's request volume
- Requires 24 hours of learning before activating
- Needs a minimum volume of data to establish patterns

**Performance Anomalies:**
- Slow server response time detection
- Slow page load time detection
- Slow dependency duration detection
- Degradation in server response time
- Degradation in dependency duration

**Other Detection Rules:**
- Abnormal rise in exception volume
- Potential memory leak detection
- Potential security issue detection
- Abnormal rise in daily data volume
- Degradation in trace severity ratio

### Algorithm Details

The failure anomaly algorithm:
1. Analyzes the failure percentage of requests/dependencies in a 20-minute rolling window
2. Compares the current 20-minute rate to the past 40 minutes and past 7 days
3. Looks for significant deviations exceeding X-times the standard deviation
4. Uses an adaptive minimum failure percentage based on traffic volume

### Configuration

- **Default:** Email notifications sent when detections are found
- **Customizable:** Configure recipients per detection rule
- **Programmatic:** Configure via Azure Resource Manager templates
- **Integration:** Smart detection alerts flow through the standard Azure Monitor alert pipeline with action groups

### Recommended Alert Configuration for Web Apps

```
Critical (Sev0):
  - Availability test failure from 3+ locations
  - Exception rate > 10x baseline
  - Smart Detection: Failure Anomalies

Error (Sev1):
  - Server error rate > 5%
  - Response time P95 > 5 seconds
  - Dependency failure rate > 10%

Warning (Sev2):
  - CPU > 80% for 10 minutes
  - Memory > 85% for 10 minutes
  - Response time P95 > 2 seconds
  - PostgreSQL connections > 80% of max

Informational (Sev3):
  - App Service restart detected
  - Deployment detected
  - SSL certificate expiring in < 30 days
  - Daily data volume anomaly
```

Sources:
- [Smart Detection in Application Insights - Microsoft Learn](https://learn.microsoft.com/en-us/azure/azure-monitor/alerts/proactive-diagnostics)
- [Smart Detection of Failure Anomalies - Microsoft Learn](https://learn.microsoft.com/en-us/azure/azure-monitor/alerts/proactive-failure-diagnostics)
- [Smart Detection Performance Anomalies - Microsoft Learn](https://learn.microsoft.com/en-us/azure/azure-monitor/alerts/smart-detection-performance)
- [Smart Detection Rule Settings - Microsoft Learn](https://learn.microsoft.com/en-us/azure/azure-monitor/alerts/proactive-arm-config)

---

## 9. Azure Monitor Workbooks

### Overview

Azure Monitor Workbooks are interactive documents that combine KQL queries, parameters, and rich visualizations within the Azure Portal. They transform raw monitoring data into actionable insights.

### Visualization Types

| Type | Use Case |
|---|---|
| **Charts** | Time series, bar charts, pie charts via `render` |
| **Grids/Tables** | Tabular data with conditional formatting, column styling |
| **Tiles** | Summary KPI cards with sparklines and icons |
| **Maps** | Geographic distribution of users, errors, latency |
| **Text** | Markdown documentation and narrative |
| **Metrics** | Live metric charts from Azure Monitor |
| **Parameters** | Interactive filters (time range, resource, environment) |

### Template Gallery

Microsoft maintains a public gallery of workbook templates on GitHub. These templates cover:
- Application performance overview
- Failure analysis
- Usage analysis
- SLA monitoring
- Cost analysis

Templates are portable and can be imported from the community or exported for sharing.

### Building a Custom Web App Monitoring Workbook

**Step 1: Add Parameters**
- Time Range selector
- Environment dropdown (Production/Staging)
- Resource group filter

**Step 2: KPI Summary Tiles**
```kql
// Request summary tile
AppRequests
| where TimeGenerated > {TimeRange}
| summarize
    TotalRequests = count(),
    FailedRequests = countif(toint(ResultCode) >= 500),
    AvgDuration = avg(DurationMs),
    P95Duration = percentile(DurationMs, 95)
```

**Step 3: Error Trend Chart**
```kql
AppRequests
| where TimeGenerated > {TimeRange}
| summarize Errors = countif(toint(ResultCode) >= 500) by bin(TimeGenerated, 5m)
| render timechart
```

**Step 4: Dependency Health Grid**
```kql
AppDependencies
| where TimeGenerated > {TimeRange}
| summarize
    Calls = count(),
    Failures = countif(Success == false),
    AvgMs = avg(DurationMs),
    P95Ms = percentile(DurationMs, 95)
    by Target, Type
| extend FailRate = round(100.0 * Failures / Calls, 1)
| order by FailRate desc
```

**Step 5: Geographic User Map**
```kql
AppRequests
| where TimeGenerated > {TimeRange}
| summarize Requests = count() by client_CountryOrRegion
```

### Automation

Workbooks can be deployed via ARM templates or Bicep, enabling:
- Version control of dashboard definitions
- Consistent deployment across environments
- Infrastructure-as-code practices

Sources:
- [Azure Workbooks Overview - Microsoft Learn](https://learn.microsoft.com/en-us/azure/azure-monitor/visualize/workbooks-overview)
- [Create or Edit an Azure Workbook - Microsoft Learn](https://learn.microsoft.com/en-us/azure/azure-monitor/visualize/workbooks-create-workbook)
- [Azure Workbooks Templates - Microsoft Learn](https://learn.microsoft.com/en-us/azure/azure-monitor/visualize/workbooks-templates)
- [Application Insights Workbooks Templates - GitHub](https://github.com/microsoft/Application-Insights-Workbooks)
- [Complete Guide to Azure Monitor Workbooks - MoldStud](https://moldstud.com/articles/p-ultimate-guide-to-azure-monitor-workbooks-for-enhanced-analytics)

---

## 10. Distributed Tracing

### Architecture

Azure Application Insights implements distributed tracing using the **W3C Trace-Context** standard, which defines:
- `traceparent`: Globally unique operation ID and call identifier
- `tracestate`: System-specific tracing context

With OpenTelemetry, traces propagate automatically across HTTP boundaries using these headers.

### How It Works in Next.js

```
User Browser                 Next.js Server           PostgreSQL         Redis
    |                              |                       |                |
    |-- Page Request ------------->|                       |                |
    |   (traceparent: abc-123)     |                       |                |
    |                              |-- SQL Query --------->|                |
    |                              |   (parent: abc-123)   |                |
    |                              |<-- Result ------------|                |
    |                              |                       |                |
    |                              |-- Cache Check ------->|--------------->|
    |                              |   (parent: abc-123)   |                |
    |                              |<-- Cache Hit ---------|<---------------|
    |                              |                       |                |
    |<-- Response -----------------|                       |                |
```

All operations share the same `operation_Id`, enabling end-to-end correlation.

### Transaction Diagnostics View

The Azure Portal provides two primary views:
1. **Transaction Diagnostics**: Waterfall view of a single transaction showing all requests, dependencies, and exceptions with timing
2. **Application Map**: Topology view showing how services interact, with call volumes, durations, and failure rates

### Correlation ID in Application Code

```typescript
import { context, trace } from '@opentelemetry/api';

// Access the current trace context
const span = trace.getActiveSpan();
const traceId = span?.spanContext().traceId;

// Pass correlation ID to downstream services or logs
logger.info('Processing order', {
  correlationId: traceId,
  orderId: order.id,
});
```

### Cross-Service Correlation

For microservice architectures, ensure correlation headers propagate:

```typescript
import { W3CTraceContextPropagator } from '@opentelemetry/core';

// Automatically propagated by OpenTelemetry SDK
// When making HTTP calls, trace headers are injected:
// traceparent: 00-<traceId>-<spanId>-01
// tracestate: <vendor-specific>
```

### End-to-End Query

```kql
// Find all telemetry for a single transaction
union AppRequests, AppDependencies, AppExceptions, AppTraces
| where operation_Id == "abc123def456"
| project TimeGenerated, itemType, Name, DurationMs, ResultCode, Message
| order by TimeGenerated asc
```

Sources:
- [Distributed Trace Data - Microsoft Learn](https://learn.microsoft.com/en-us/azure/azure-monitor/app/distributed-trace-data)
- [OpenTelemetry on Azure - Microsoft Learn](https://learn.microsoft.com/en-us/azure/azure-monitor/app/opentelemetry)
- [OpenTelemetry Data Collection - Microsoft Learn](https://learn.microsoft.com/en-us/azure/azure-monitor/app/opentelemetry-overview)
- [Distributed Tracing with OpenTelemetry and App Insights - Cicoria](https://www.cicoria.com/leveraging-azure-application-insights-with-opentelemetry-distributed-tracing-done-right/)
- [Distributed Tracing with Application Insights - Turbo360](https://turbo360.com/blog/how-to-achieve-distributed-tracing-using-application-insights)

---

## 11. Cost Monitoring

### Azure Cost Management

Azure Cost Management provides:
- **Cost Analysis**: Real-time spend visualization by resource, resource group, tag, service
- **Budgets**: Spending limits with configurable threshold alerts
- **Cost Anomaly Detection**: AI-powered detection of unusual spending patterns
- **Advisor Recommendations**: Auto-generated cost optimization suggestions
- **Copilot in Azure**: Natural language queries about costs (GA 2025)

### Budget Configuration

```
Budget: peptide-plus-production-monthly
  Scope: Resource Group (peptide-plus-prod)
  Amount: $500/month
  Reset: Monthly

  Alert Conditions:
    - 50% consumed  -> Email to engineering team
    - 80% consumed  -> Email + SMS to tech lead
    - 100% consumed -> Email + SMS + webhook to PagerDuty
    - 120% forecast -> Email + SMS to CTO + engineering
```

Budgets evaluate costs daily (within ~24 hours) and fire alerts when thresholds are crossed. **Important:** Budgets do not cap spending -- they are alerts only. Azure will not stop resources automatically.

### Cost Allocation with Tags

Essential tags for cost tracking:

```
Environment: production | staging | development
Project: peptide-plus
Team: engineering
Service: web-app | database | cache | monitoring
CostCenter: CC-1234
```

### Application Insights Cost Control

| Strategy | Impact |
|---|---|
| Fixed-rate sampling at 50% | ~50% reduction in ingestion |
| Ingestion-time transformations (drop health checks) | 10-30% reduction |
| Daily cap configuration | Hard limit on daily ingestion |
| Shorter retention (30 vs 90 days) | Reduce retention costs |
| Basic logs plan for verbose tables | Lower per-GB rate |
| Commitment tier at 100+ GB/day | 15-30% discount |

### Monitoring Cost KQL Query

```kql
// What's driving Application Insights costs?
union AppRequests, AppDependencies, AppExceptions, AppTraces, AppMetrics
| where TimeGenerated > ago(30d)
| summarize
    RecordCount = count(),
    EstimatedGB = sum(estimate_data_size(*)) / 1073741824.0
    by itemType
| order by EstimatedGB desc
```

Sources:
- [Microsoft Cost Management - Azure](https://azure.microsoft.com/en-us/products/cost-management)
- [Azure Cost Monitoring and Management Guide - Sedai](https://www.sedai.io/blog/azure-cost-usage-monitoring)
- [Mastering Cost Management in Azure - MS Cloud Bros](https://www.mscloudbros.com/2025/09/08/mastering-cost-management-and-budgets-in-azure-cost-optimization/)
- [Azure Monitor Cost and Usage - Microsoft Learn](https://learn.microsoft.com/en-us/azure/azure-monitor/fundamentals/cost-usage)
- [Azure Monitor Pricing - Microsoft Azure](https://azure.microsoft.com/en-us/pricing/details/monitor/)

---

## 12. Performance Baselines and Benchmarking

### Establishing Baselines

A performance baseline is a benchmark established during normal operation against which all future measurements are compared. Baseline data should be collected over at least 2-4 weeks to capture daily and weekly patterns.

**Key Metrics to Baseline:**

| Metric | How to Measure | Typical Target |
|---|---|---|
| Server Response Time (P50) | `AppRequests` average | < 200ms |
| Server Response Time (P95) | `AppRequests` percentile | < 1000ms |
| Server Response Time (P99) | `AppRequests` percentile | < 3000ms |
| Error Rate | Failed requests / total | < 0.1% |
| Availability | Availability tests | > 99.9% |
| Throughput | Requests per second | Application-specific |
| CPU Utilization | Platform metrics | < 70% average |
| Memory Utilization | Platform metrics | < 80% average |
| DB Query Time (P95) | `AppDependencies` | < 100ms |
| Redis Latency (P95) | `AppDependencies` | < 10ms |

### SLA / SLO / SLI Framework

| Term | Definition | Example |
|---|---|---|
| **SLI** (Service Level Indicator) | Measurable metric | Request success rate |
| **SLO** (Service Level Objective) | Internal target | 99.95% success rate |
| **SLA** (Service Level Agreement) | External contract | 99.9% uptime, with financial penalties |

**Error Budget Calculation:**
- For a 99.9% SLO: Monthly error budget = 43.2 minutes of downtime
- For a 99.95% SLO: Monthly error budget = 21.6 minutes
- For a 99.99% SLO: Monthly error budget = 4.3 minutes

### Baseline KQL Query

```kql
// Establish weekly performance baseline
AppRequests
| where TimeGenerated > ago(28d)
| summarize
    P50 = percentile(DurationMs, 50),
    P95 = percentile(DurationMs, 95),
    P99 = percentile(DurationMs, 99),
    AvgDuration = avg(DurationMs),
    ErrorRate = countif(toint(ResultCode) >= 500) * 100.0 / count(),
    RequestCount = count()
    by bin(TimeGenerated, 1d), dayofweek(TimeGenerated)
| order by TimeGenerated asc
```

### Load Testing Integration

Use Azure Load Testing (or tools like k6, Artillery, Locust) to:
1. Establish throughput limits
2. Identify breaking points
3. Validate auto-scaling behavior
4. Compare performance before and after deployments

Embed load testing in CI/CD to catch performance regressions before production.

Sources:
- [Performance Testing Strategies - Azure Well-Architected Framework - Microsoft Learn](https://learn.microsoft.com/en-us/azure/well-architected/performance-efficiency/performance-test)
- [Reliability Metrics - Azure Well-Architected Framework - Microsoft Learn](https://learn.microsoft.com/en-us/azure/well-architected/reliability/metrics)
- [SLA/SLO-Driven Monitoring Requirements - Uptrace](https://uptrace.dev/blog/sla-slo-monitoring-requirements)
- [5 Steps to Benchmark Azure Workload Performance - Critical Cloud](https://azure.criticalcloud.ai/5-steps-to-benchmark-azure-workload-performance/)

---

## 13. Integration with Third-Party Tools

### Azure Managed Grafana

**Status:** GA, natively integrated into Azure Portal (November 2025)

**Key features:**
- Grafana dashboards directly in Azure Portal at no additional cost
- Supports Azure Monitor, Azure Data Explorer (ADX), and Prometheus data sources
- Dashboards portable across Grafana OSS, Grafana Cloud, Azure Managed Grafana
- Import from thousands of community dashboards
- KQL queries for ADX data sources

**Setup:**
1. Create Azure Managed Grafana workspace
2. Configure Azure Monitor data source (auto-authenticated via managed identity)
3. Import or create dashboards
4. Optional: Connect to Prometheus metrics for container workloads

### Datadog

**Integration approach:**
- Azure Monitor integration via Azure Event Hub or direct API
- 900+ prebuilt integrations
- Native Azure resource monitoring
- APM with distributed tracing
- Real User Monitoring (RUM)

**Setup:** Configure Azure integration in Datadog console, deploy Datadog agent or use agentless monitoring via Azure diagnostic settings forwarded to Event Hub.

### New Relic

**Integration approach:**
- Azure Monitor integration for infrastructure metrics
- 700+ prebuilt integrations
- APM agent for Node.js applications
- Infrastructure agent for VM-level metrics

### OpenTelemetry Advantage

Using OpenTelemetry for instrumentation provides vendor neutrality:

```typescript
// Same instrumentation code works with any backend
import { AzureMonitorTraceExporter } from '@azure/monitor-opentelemetry-exporter';
// OR
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
// OR configure for Datadog, New Relic, Grafana Cloud, etc.
```

This means you can switch or dual-ship telemetry to multiple backends without changing application code.

### Comparison Matrix

| Feature | Azure Monitor | Datadog | New Relic | Grafana |
|---|---|---|---|---|
| Azure-native | Best | Good | Good | Good (Managed) |
| Multi-cloud | Limited | Excellent | Excellent | Excellent |
| APM depth | Good | Excellent | Excellent | Via backends |
| Cost (entry) | Pay-per-GB | Per host/GB | Per GB | Free (OSS) |
| Dashboarding | Workbooks | Excellent | Good | Best-in-class |
| Alerting | Good | Excellent | Good | Good |
| Log management | Good (KQL) | Excellent | Good | Good (Loki) |

Sources:
- [Azure Monitor Grafana Dashboards GA - Grafana Labs](https://grafana.com/blog/2025/11/18/azure-monitor-offers-grafana-dashboards-natively-for-immediate-real-time-operational-monitoring-now-ga/)
- [Visualize Azure Monitor Data with Grafana - Microsoft Learn](https://learn.microsoft.com/en-us/azure/azure-monitor/visualize/visualize-grafana-overview)
- [Azure Managed Grafana - Microsoft Azure](https://azure.microsoft.com/en-us/products/managed-grafana)
- [Grafana Dashboards with Application Insights - Microsoft Learn](https://learn.microsoft.com/en-us/azure/azure-monitor/app/grafana-dashboards)

---

## 14. Azure Status Page and Service Health Alerts

### Three Levels of Health Information

| Level | Scope | Use Case |
|---|---|---|
| **Azure Status** | Global, all Azure services | Broad outages affecting many customers |
| **Service Health** | Personalized to your subscriptions/regions/services | Targeted issues affecting your resources |
| **Resource Health** | Individual resource status | Specific resource problems (VM, DB, etc.) |

### Service Health Event Types

| Event Type | Description |
|---|---|
| **Service Issues** | Unplanned outages or degradations currently affecting your resources |
| **Planned Maintenance** | Upcoming maintenance that might cause brief downtime |
| **Health Advisories** | Changes that require attention (feature deprecations, quota limits) |
| **Security Advisories** | Security-related notifications |

### Configuration

**Portal setup:**
1. Navigate to **Service Health** in Azure Portal
2. Select **Health Alerts** > **Create service health alert**
3. Choose subscriptions, services, and regions to monitor
4. Select event types (Service issues, Planned maintenance, Health advisories)
5. Configure action group (email, SMS, webhook, ITSM)

**Integration with incident management:**
- **PagerDuty**: Via webhook action in action group
- **ServiceNow**: Via ITSM connector
- **OpsGenie**: Via webhook
- **Slack/Teams**: Via Logic App or webhook

### Health History

Access historical health events in the Azure Portal under **Service Health > Health History**. Shows past incidents, maintenance events, and advisories relevant to your subscriptions and regions.

### Recommended Configuration

```
Service Health Alert: peptide-plus-health
  Subscriptions: [production-subscription]
  Services: App Service, PostgreSQL, Redis Cache, Azure Monitor, DNS
  Regions: [your-primary-region, your-dr-region]
  Event Types: All (Service issues, Planned maintenance, Health advisories)
  Action Group:
    - Email: engineering@company.com
    - SMS: on-call phone
    - Webhook: PagerDuty integration URL
```

Sources:
- [What is Azure Service Health - Microsoft Learn](https://learn.microsoft.com/en-us/azure/service-health/overview)
- [Service Health Notifications Overview - Microsoft Learn](https://learn.microsoft.com/en-us/azure/service-health/service-health-notifications-properties)
- [Create Service Health Alerts - Microsoft Learn](https://learn.microsoft.com/en-us/azure/service-health/alerts-activity-log-service-notifications-portal)
- [Azure Status Overview - Microsoft Learn](https://learn.microsoft.com/en-us/azure/service-health/azure-status-overview)

---

## 15. Best Practices for Production Monitoring Setup

### The Four Pillars of Observability

1. **Metrics**: Numeric measurements over time (response time, error rate, CPU)
2. **Logs**: Structured event records (application logs, audit trails)
3. **Traces**: End-to-end request paths across services
4. **Events**: Discrete occurrences (deployments, alerts, incidents)

### Production Monitoring Checklist

**Day 1 (Essential):**
- [ ] Application Insights connected with connection string
- [ ] OpenTelemetry instrumentation in `instrumentation.ts`
- [ ] Auto-collection: requests, dependencies, exceptions enabled
- [ ] Diagnostic settings for App Service, PostgreSQL, Redis
- [ ] Log Analytics workspace created with appropriate retention
- [ ] Smart Detection enabled (default, no config needed)
- [ ] Availability standard tests from 5+ locations
- [ ] Service Health alerts configured
- [ ] Basic alert rules: error rate, response time, availability

**Week 1 (Important):**
- [ ] Custom events for business KPIs
- [ ] Action groups with email + SMS + webhook to on-call
- [ ] Alert processing rules for maintenance windows
- [ ] Sampling configured (50% or adaptive)
- [ ] Ingestion-time transformations to drop noise
- [ ] Azure Cost Management budget with alerts
- [ ] Performance baseline established

**Month 1 (Operational Excellence):**
- [ ] Azure Monitor Workbooks for team dashboards
- [ ] Grafana dashboards for operations center
- [ ] SLI/SLO definitions documented
- [ ] Error budget tracking
- [ ] Load testing integrated in CI/CD
- [ ] Runbook automation for common alerts
- [ ] Incident management integration (PagerDuty/ServiceNow)
- [ ] Cost optimization review

### Structured Logging Best Practices

```typescript
// Good: structured, machine-readable
logger.info('Order processed', {
  orderId: order.id,
  userId: user.id,
  total: order.total,
  duration: processingTime,
  paymentMethod: order.paymentMethod,
});

// Bad: unstructured string
logger.info(`Order ${orderId} processed for user ${userId} with total ${total}`);
```

Use appropriate log levels per environment:
- **Production**: `warn` and above (errors, warnings)
- **Staging**: `info` and above
- **Development**: `debug` and above

### Key Design Principles

1. **Correlation IDs everywhere**: Ensure a trace ID flows across all service boundaries
2. **Caught exceptions must be logged**: Every error should surface as exception telemetry
3. **Embed observability in CI/CD**: Monitor deployments in real-time, catch regressions before production
4. **Use dynamic thresholds**: Let ML learn your patterns instead of manually tuning static thresholds
5. **Alert on symptoms, not causes**: Alert on user-facing impact (error rate, latency), not internal metrics (CPU, memory) -- those are diagnostic
6. **Avoid alert fatigue**: Fewer, high-quality alerts with clear escalation paths
7. **Cost-aware monitoring**: Verbose logging can incur significant costs; set log levels appropriately

### 2025-2026 Azure Monitor Innovations

- **Copilot Observability Agent** (Preview, Ignite 2025): AI-powered root cause analysis across AKS, VMs, and application services
- **Grafana Dashboards in Azure Portal** (GA November 2025): Free, native Grafana integration
- **Full-Stack Observability**: Streamlined onboarding with sensible defaults enabling monitoring in minutes
- **OpenTelemetry as Standard**: Azure Monitor fully embraces OTel as the vendor-neutral telemetry standard

### Recommended Architecture

```
                    +------------------+
                    |   Azure Portal   |
                    |  (Dashboards,    |
                    |   Workbooks,     |
                    |   Grafana)       |
                    +--------+---------+
                             |
                    +--------+---------+
                    | Log Analytics    |
                    | Workspace        |
                    | (Central Store)  |
                    +--------+---------+
                             |
          +------------------+------------------+
          |                  |                  |
+---------+-------+ +--------+-------+ +--------+-------+
| Application     | | Diagnostic     | | Activity       |
| Insights        | | Settings       | | Log            |
| (APM, Traces,   | | (App Service,  | | (Deployments,  |
|  Custom Events) | |  PostgreSQL,   | |  Scaling,      |
|                 | |  Redis)        | |  Config)       |
+---------+-------+ +--------+-------+ +--------+-------+
          |                  |                  |
+---------+-------+ +--------+-------+ +--------+-------+
| Next.js App     | | PostgreSQL     | | Redis Cache    |
| (OTel SDK)      | | (Flex Server)  | |                |
+-----------------+ +----------------+ +----------------+
```

Sources:
- [Advancing Full-Stack Observability - Azure Monitor at Ignite 2025 - Microsoft Community Hub](https://techcommunity.microsoft.com/blog/azureobservabilityblog/advancing-full-stack-observability-with-azure-monitor-at-ignite-2025/4469041)
- [Observability Agent Best Practices - Microsoft Learn](https://learn.microsoft.com/en-us/azure/azure-monitor/aiops/observability-agent-best-practices)
- [Observability Architecture Strategies - Azure Well-Architected Framework - Microsoft Learn](https://learn.microsoft.com/en-us/azure/well-architected/operational-excellence/observability)
- [Monitoring and Alerting Strategy - Azure Well-Architected Framework - Microsoft Learn](https://learn.microsoft.com/en-us/azure/well-architected/reliability/monitoring-alerting-strategy)
- [Application Insights: Backbone of App Reliability - Divya Akula](https://www.divyaakula.com/cloud-monitoring/2025/08/21/application-insights-primer.html)
- [Monitoring vs Observability in Azure - Tech Findings](https://www.tech-findings.com/2025/09/monitoring-vs-observability-in-azure.html)
- [Monitoring and Analytics with Azure Monitor - AzureTracks](https://azuretracks.com/2025/08/monitoring-and-analytics-with-azure-monitor/)

---

## Summary: Estimated Monthly Cost for a Medium Web Application

| Component | Estimated Cost | Notes |
|---|---|---|
| Application Insights (10 GB/month) | ~$12/month | First 5 GB free, then $2.30/GB |
| Log Analytics retention (30 days) | Included | Default retention is free |
| Log Analytics retention (90 days) | ~$1.50/month | For 10 GB retained beyond 30 days |
| Standard Availability Tests (3 URLs, 5 locations) | ~$15/month | Per-execution billing |
| Metric Alerts (10 rules) | ~$1.50/month | $0.10-0.50 per rule |
| Log Search Alerts (5 rules) | ~$2.50/month | $0.50 per rule |
| Azure Managed Grafana | Free (basic) | Native portal integration |
| Service Health Alerts | Free | No cost |
| Smart Detection | Free | Included with App Insights |
| **Total (estimated)** | **~$30-50/month** | For a medium-traffic app |

For high-traffic applications ingesting 100+ GB/month, consider commitment tiers for 15-30% discounts, aggressive sampling (10-25%), and ingestion-time transformations to manage costs.