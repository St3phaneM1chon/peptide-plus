# Exhaustive Report: Azure App Service for Next.js Applications

## Table of Contents
1. [App Service Plans and Pricing Tiers](#1-app-service-plans-and-pricing-tiers)
2. [Next.js-Specific Deployment](#2-nextjs-specific-deployment)
3. [Configuration Options](#3-configuration-options)
4. [Custom Domains, SSL/TLS Certificates, HTTPS Enforcement](#4-custom-domains-ssltls-certificates-https-enforcement)
5. [Deployment Methods](#5-deployment-methods)
6. [Performance Tuning](#6-performance-tuning)
7. [Node.js Version Management and PM2](#7-nodejs-version-management-and-pm2)
8. [Environment Variables vs Key Vault References](#8-environment-variables-vs-key-vault-references)
9. [Deployment Slots](#9-deployment-slots)
10. [Known Limitations and Gotchas](#10-known-limitations-and-gotchas)

---

## 1. App Service Plans and Pricing Tiers

### Tier Overview

| Tier | Compute | Storage | Max Instances | Deployment Slots | SLA | Always On | Auto-Scale |
|------|---------|---------|---------------|-------------------|-----|-----------|------------|
| **Free (F1)** | Shared, 60 CPU min/day | 1 GB | N/A (shared) | 0 | None | No | No |
| **Shared (D1)** | Shared, 240 CPU min/day | 1 GB | N/A (shared) | 0 | None | No | No |
| **Basic (B1/B2/B3)** | Dedicated | 10 GB | 3 (manual only) | 0 | 99.95% | Yes | No |
| **Standard (S1/S2/S3)** | Dedicated | 50 GB | 10 | 5 | 99.95% | Yes | Yes |
| **Premium V3 (P1v3/P2v3/P3v3)** | Dedicated | 250 GB | 30 | 20 | 99.95% | Yes | Yes |
| **Isolated V2 (I1v2/I2v2/I3v2)** | Dedicated (ASE) | 1 TB | 100 (200 total in ASE) | 20 | 99.95% | Yes | Yes |

### Instance Sizing

| SKU | vCPU Cores | RAM |
|-----|-----------|-----|
| **B1 / S1** | 1 | 1.75 GB |
| **B2 / S2** | 2 | 3.5 GB |
| **B3 / S3** | 4 | 7 GB |
| **P1v3** | 2 | 8 GB |
| **P2v3** | 4 | 16 GB |
| **P3v3** | 8 | 32 GB |
| **P1mv3** (memory-optimized) | 2 | 16 GB |
| **P2mv3** | 4 | 32 GB |
| **P3mv3** | 8 | 64 GB |
| **P4mv3** | 16 | 128 GB |
| **P5mv3** | 32 | 256 GB |

### Approximate Linux Pricing (US East, per month)

- **B1**: ~$13.14/month (Linux) / ~$55.80 (Windows)
- **B2**: ~$26.28 / ~$111.60
- **B3**: ~$52.56 / ~$223.20
- **S1**: ~$36.50 / ~$74.40
- **S2**: ~$73.00 / ~$148.40
- **S3**: ~$146.00 / ~$297.60
- **P1v3**: ~$80.30 / ~$139.43
- **P2v3**: ~$160.60 / ~$278.86
- **P3v3**: ~$321.20 / ~$557.72

**Important**: Linux pricing is significantly cheaper. Prices vary by region and change periodically. Always check the [official pricing page](https://azure.microsoft.com/en-us/pricing/details/app-service/linux/).

### Isolated Tier / App Service Environment v3

- Provides fully isolated, dedicated environment within a customer's virtual network
- Fine-grained control over inbound/outbound network traffic
- Up to 200 total instances across all plans in a single ASE
- ASEv3 eliminated the flat Stamp Fee, reducing costs by up to 80% compared to ASEv2
- Optional dedicated host deployment for physical hardware-level isolation

### Scaling Options

- **Manual scaling**: Available on Basic and above
- **Autoscale (Azure Monitor-based)**: Standard and above. Rules based on CPU, memory, HTTP queue length, thread count, disk usage, schedules
- **Automatic Scaling**: Premium V3 and above. HTTP traffic-based, no rules needed. Automatically disables ARR Affinity
- **Scale-out logic**: Autoscale scales OUT if ANY rule is met, scales IN only if ALL rules are met
- Only one scaling method should be active per App Service Plan

Sources:
- [Azure App Service Pricing](https://azure.microsoft.com/en-us/pricing/details/app-service/windows/)
- [Azure App Service Plans](https://learn.microsoft.com/en-us/azure/app-service/overview-hosting-plans)
- [App Service Plan Tiers Comparison](https://medium.com/@zaab_it/azure-app-service-plan-tiers-f07d5e22297a)
- [New App Service Plans](https://azure.microsoft.com/en-us/blog/new-azure-app-service-plans-fuel-greater-choice-and-savings/)
- [ASE Overview](https://learn.microsoft.com/en-us/azure/app-service/environment/overview)
- [Automatic Scaling](https://learn.microsoft.com/en-us/azure/app-service/manage-automatic-scaling)
- [Autoscale vs Automatic Scaling](https://portal.tutorialsdojo.com/forums/discussion/azure-app-service-autoscale-vs-automatic-scaling/)

---

## 2. Next.js-Specific Deployment

### Standalone Output Mode (Recommended)

The strongly recommended approach for deploying Next.js on Azure App Service is using the **standalone output mode**.

**next.config.js configuration:**
```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // Optional: custom build directory
  // distDir: 'build',
};
module.exports = nextConfig;
```

**Build and preparation:**
```bash
npm run build
# After build, copy static assets into the standalone folder:
cp -r .next/static .next/standalone/.next/static
cp -r public .next/standalone/public
```

**Startup command in Azure App Service:**
```
node server.js
```

The standalone build creates a minimal `server.js` file that can run without the full `node_modules`. Deploy the `.next/standalone` directory as your application package.

### SSR (Server-Side Rendering)

Azure App Service fully supports SSR because it runs a persistent Node.js server process. SSR works identically to any self-hosted Node.js environment. No special configuration needed beyond the standard startup command.

### ISR (Incremental Static Regeneration)

ISR works on Azure App Service with important caveats:

- **Single instance**: Default file system cache works fine
- **Multiple instances**: You MUST implement a custom `cacheHandler` in `next.config.js` because the default in-memory/file system cache is per-instance and not shared

```js
// next.config.js
const nextConfig = {
  cacheHandler: require.resolve('./cache-handler.js'),
  cacheMaxMemorySize: 0, // disable in-memory caching
};
```

The custom cache handler should use persistent storage (Azure Blob Storage, Redis, etc.) and implement `get`, `set`, `revalidateTag`, and `resetRequestCache` methods.

### API Routes

API routes work natively on Azure App Service since it runs a full Node.js server. No restrictions on route types (catch-all, dynamic, etc.) when using the standalone output mode.

**Warning**: If you use `next export` (static export), API routes are NOT available. The standalone output mode is required for API routes.

### Middleware

- Next.js middleware works on Azure App Service when self-hosting
- Edge Runtime middleware runs in a compatibility layer when self-hosted (not a true Edge environment)
- Starting with Next.js 15.2, you can use `export const runtime = 'nodejs'` in middleware to switch from Edge to Node.js runtime, which provides broader library compatibility
- Middleware should NOT access the `/.swa/health.html` path (relevant if migrating from/to Static Web Apps)

### Image Optimization

- Install `sharp` as a production dependency: `npm install sharp`
- For standalone mode, sharp is **required** (not optional)
- Set the environment variable `NEXT_SHARP_PATH` if sharp cannot be auto-resolved:
  ```
  NEXT_SHARP_PATH=/home/site/wwwroot/node_modules/sharp
  ```
- Alternatively, configure a custom image loader to offload optimization to a CDN

Sources:
- [Next.js 15 on Azure App Service Complete Guide](https://blog.kudoai.com/hosting-next-js-15-on-azure-app-service-the-complete-guide-with-ci-cd-ed5a0a173c17)
- [Next.js Standalone Output Documentation](https://nextjs.org/docs/pages/api-reference/config/next-config-js/output)
- [Next.js SSR on Azure App Service](https://medium.com/kanade-dev/nextjs-ssr-on-azure-app-service-8b7e2d42704e)
- [Next.js on Azure App Services (Sitecore)](https://developers.sitecore.com/learn/accelerate/xm-cloud/pre-development/developer-experience/nextjs-azure-app-services)
- [Next.js cacheHandler Configuration](https://nextjs.org/docs/app/api-reference/config/next-config-js/incrementalCacheHandlerPath)
- [Sharp Missing in Production](https://nextjs.org/docs/messages/sharp-missing-in-production)
- [Next.js 16 with PNPM on Azure](https://www.modern42.com/post/deploy-next-js-16-pnpm-linux-azure-web-app)

---

## 3. Configuration Options

### App Settings (Environment Variables)

App settings in Azure App Service are passed as environment variables to your application at runtime. Configuration is done via:
- **Azure Portal**: Settings > Environment Variables
- **Azure CLI**: `az webapp config appsettings set`
- **ARM Templates / Bicep / Terraform**

Key Next.js-related app settings:

| Setting | Value | Purpose |
|---------|-------|---------|
| `WEBSITES_PORT` | `3000` | Port your Next.js app listens on |
| `PORT` | `3000` | Azure passes this; your app must listen on it |
| `SCM_DO_BUILD_DURING_DEPLOYMENT` | `true` | Triggers Oryx build during deployment |
| `NPM_CONFIG_PRODUCTION` | `false` | Install devDependencies (needed for Next.js build) |
| `WEBSITE_NODE_DEFAULT_VERSION` | `~20` | Node.js version (Windows only) |
| `NEXT_SHARP_PATH` | path to sharp | Sharp module location for image optimization |
| `WEBSITE_RUN_FROM_PACKAGE` | `1` or URL | Run directly from ZIP package |
| `WEBSITES_CONTAINER_START_TIME_LIMIT` | `600` | Container startup timeout in seconds (max 1800) |
| `WEBSITE_HEALTHCHECK_MAXUNHEALTHYWORKERPERCENT` | `50` | Max % of unhealthy instances before stop removing |
| `PRE_BUILD_COMMAND` | command | Custom command before Oryx build |
| `POST_BUILD_COMMAND` | command | Custom command after Oryx build |
| `ENABLE_ORYX_BUILD` | `true` | Enable Oryx build system |

### Connection Strings

Connection strings are stored separately from app settings and are available as environment variables with type-specific prefixes:

| Type | Prefix | Example Environment Variable |
|------|--------|------------------------------|
| SQL Server | `SQLCONNSTR_` | `SQLCONNSTR_MyDb` |
| SQL Azure | `SQLAZURECONNSTR_` | `SQLAZURECONNSTR_MyDb` |
| MySQL | `MYSQLCONNSTR_` | `MYSQLCONNSTR_MyDb` |
| PostgreSQL | `POSTGRESQLCONNSTR_` | `POSTGRESQLCONNSTR_MyDb` |
| Custom | `CUSTOMCONNSTR_` | `CUSTOMCONNSTR_MyService` |

Connection strings are encrypted at rest. For Node.js/Next.js apps, it is often simpler to use regular app settings instead, since the prefix system was designed primarily for .NET.

### Oryx Build System

Azure's Oryx build system auto-detects Node.js projects by scanning for `package.json`. When `SCM_DO_BUILD_DURING_DEPLOYMENT=true`:
1. Detects language and runtime version
2. Runs `npm install` (or `yarn install`)
3. Runs the `build` script from `package.json`
4. Configures the runtime startup

**ENABLE_ORYX_BUILD vs SCM_DO_BUILD_DURING_DEPLOYMENT**: Both control build behavior but through different mechanisms. `ENABLE_ORYX_BUILD` controls the Oryx build system itself, while `SCM_DO_BUILD_DURING_DEPLOYMENT` controls whether building happens at deployment time via Kudu/ZipDeploy.

Sources:
- [Configure an App Service App](https://learn.microsoft.com/en-us/azure/app-service/configure-common)
- [Environment Variables Reference](https://learn.microsoft.com/en-us/azure/app-service/reference-app-settings)
- [Deploying with Oryx](https://azureossd.github.io/2024/10/14/deploying-applications-to-azure-appservice-using-oryx/)
- [ENABLE_ORYX_BUILD vs SCM_DO_BUILD_DURING_DEPLOYMENT](https://azureossd.github.io/2025/09/03/ENABLE_ORYX_BUILD-vs-SCM_DO_BUILD_DURING_DEPLOYMENT/index.html)
- [Next.js Deployment Guide](https://medium.com/@wdedweliwaththa/the-ultimate-guide-to-deploying-next-js-a1501de3e4d0)

---

## 4. Custom Domains, SSL/TLS Certificates, HTTPS Enforcement

### Custom Domains

- Supported on Basic tier and above (shared tier supports custom domains but not SSL)
- Configure via Settings > Custom domains
- Requires DNS validation via CNAME or A record + TXT record
- Apex (root) domains: Map using an A record pointing to the app's IP + TXT record for verification
- Subdomains: Map using a CNAME record

### SSL/TLS Certificate Options

| Certificate Type | Cost | Wildcard | Apex Domain | Exportable | Requirements |
|-----------------|------|----------|-------------|------------|--------------|
| **App Service Managed Certificate** | Free | No | Yes (with restrictions) | No | Basic tier+, public DNS |
| **App Service Certificate** (purchased from Azure) | Paid | Yes | Yes | Yes | Stored in Key Vault |
| **Uploaded PFX Certificate** | BYOC | Yes | Yes | N/A | PFX format, private key included |
| **Key Vault Certificate** | Varies | Yes | Yes | Depends | Managed identity required |

### Managed Certificate Important Changes (July 2025)

Starting July 28, 2025, App Service Managed Certificates (ASMC) are subject to new requirements:
- DigiCert migrated to a new validation platform (MPIC compliance)
- HTTP Token validation is now used for both apex and subdomains
- No need to allowlist DigiCert IP addresses anymore
- Front-end handles validation (requests never reach app workers)

### Managed Certificate Limitations

- No wildcard certificate support
- No private DNS support
- Not exportable
- Not supported in App Service Environment (ASE)
- Not supported with Traffic Manager root domains
- Apex domains must be publicly accessible (no IP restrictions)
- Adding IP restrictions after certificate creation causes renewal failure

### HTTPS Enforcement

- **HTTPS Only**: Toggle in Settings > TLS/SSL settings to redirect all HTTP to HTTPS
- On by default for new apps
- Sets a 301 redirect from HTTP to HTTPS

### TLS Version Control

- **Default minimum**: TLS 1.2
- **Supported versions**: TLS 1.0, 1.1, 1.2, 1.3
- Configurable independently for app and SCM (Kudu) site
- Industry standards (PCI DSS) recommend TLS 1.2 minimum
- TLS 1.3 support is available

### SNI SSL vs IP SSL

- **SNI SSL**: Supported on Basic tier and above. Multiple domains can share the same IP
- **IP SSL**: Supported on Standard tier and above. Dedicated IP address for the SSL binding

Sources:
- [Configure SSL Certificate](https://learn.microsoft.com/en-us/azure/app-service/configure-ssl-certificate)
- [ASMC Changes July 2025](https://learn.microsoft.com/en-us/azure/app-service/app-service-managed-certificate-changes-july-2025)
- [Secure Domain with TLS/SSL](https://learn.microsoft.com/en-us/azure/app-service/configure-ssl-bindings)
- [Secure App with Custom Domain](https://learn.microsoft.com/en-us/azure/app-service/tutorial-secure-domain-certificate)
- [App Service TLS Overview](https://learn.microsoft.com/en-us/azure/app-service/overview-tls)

---

## 5. Deployment Methods

### 1. GitHub Actions (Recommended for CI/CD)

Use the `azure/webapps-deploy@v3` action. Example workflow for Next.js:

```yaml
name: Deploy Next.js to Azure App Service

on:
  push:
    branches: [main]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build

      - name: Copy static files to standalone
        run: |
          cp -r .next/static .next/standalone/.next/static
          cp -r public .next/standalone/public

      - name: Deploy to Azure Web App
        uses: azure/webapps-deploy@v3
        with:
          app-name: ${{ secrets.AZURE_WEBAPP_NAME }}
          publish-profile: ${{ secrets.AZURE_WEBAPP_PUBLISH_PROFILE }}
          package: .next/standalone
```

**Authentication methods**: Publish Profile (XML), Service Principal (via `azure/login@v1`), or OpenID Connect (OIDC, recommended for security).

### 2. Azure DevOps (Azure Pipelines)

Uses ZipDeploy as the primary deployment method. The `AzureRmWebAppDeploymentV4` task supports:
- Web Deploy
- RunFromPackage
- Zip Deploy
- Container deployment
- Kudu REST APIs

### 3. ZIP Deploy

```bash
az webapp deploy --resource-group <group> --name <app-name> --src-path <zip-file>
```

### 4. Run From Package (WEBSITE_RUN_FROM_PACKAGE)

Set `WEBSITE_RUN_FROM_PACKAGE=1` to mount the ZIP package as a read-only file system:
- Eliminates file lock conflicts between deployment and runtime
- Faster cold starts
- Atomic deployment (no partially deployed state)
- **Caveat**: File system is read-only, so ISR file cache won't work

### 5. Docker Containers

Azure App Service for Linux supports custom Docker containers:

```bash
az webapp create --resource-group <group> --plan <plan> \
  --name <app-name> --deployment-container-image-name <registry>/<image>:<tag>
```

**Multi-stage Dockerfile example for Next.js:**
```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
```

Integrate with Azure Container Registry (ACR) for private image storage.

### 6. Local Git / FTP

- **Local Git**: Push to a Git remote hosted by Kudu
- **FTP/FTPS**: Upload files directly to `/home/site/wwwroot`
- Not recommended for production CI/CD workflows

### Deployment Best Practices

- Use deployment slots for zero-downtime deployments
- Build artifacts externally (in CI/CD pipeline) rather than on the App Service
- Use `WEBSITE_RUN_FROM_PACKAGE` for immutable deployments
- Cache `node_modules` or `.next` in CI/CD pipelines for faster builds
- Set `SCM_DO_BUILD_DURING_DEPLOYMENT=false` when deploying pre-built artifacts

Sources:
- [Deploy by Using GitHub Actions](https://learn.microsoft.com/en-us/azure/app-service/deploy-github-actions)
- [azure/webapps-deploy Action](https://github.com/Azure/webapps-deploy)
- [Deployment Best Practices](https://learn.microsoft.com/en-us/azure/app-service/deploy-best-practices)
- [Configure Continuous Deployment](https://learn.microsoft.com/en-us/azure/app-service/deploy-continuous-deployment)
- [Run From Package](https://learn.microsoft.com/en-us/azure/app-service/deploy-run-package)
- [Custom Container Quickstart](https://learn.microsoft.com/en-us/azure/app-service/quickstart-custom-container)
- [Deploy Next.js with Docker to Azure](https://echobind.com/post/deploy-nextjs-azure-cli)

---

## 6. Performance Tuning

### Always On

- **What it does**: Keeps the app process loaded by pinging the app root URL periodically, preventing cold starts after idle periods
- **Available on**: Basic tier and above
- **Recommended**: Always enable for production apps
- Does NOT replace Health Check -- they serve different purposes

### ARR Affinity (Session Affinity)

- Creates sticky sessions via a cookie (`ARRAffinity`)
- Clients connect to the same instance on subsequent requests
- **Recommendation for production**: **Disable ARR Affinity** because:
  - It can cause unequal distribution of requests across instances
  - It can overload specific instances
  - Next.js apps should be stateless
- Automatically disabled when Automatic Scaling is enabled

### Health Checks

- Configure a health check path (e.g., `/api/health`) in Settings > Health check
- Pings the path on ALL instances at **1-minute intervals**
- If an instance fails to respond with 200-299 after **10 requests** (configurable, minimum 2), it is marked unhealthy
- Unhealthy instances are removed from the load balancer
- **Requires 2+ instances** to be effective
- By default, no more than 50% of instances are removed (configurable via `WEBSITE_HEALTHCHECK_MAXUNHEALTHYWORKERPERCENT`)
- If ALL instances are unhealthy, none are removed (to prevent total outage)
- After removal, App Service continues pinging; if the instance recovers, it is returned to the load balancer
- If it does not recover, the underlying VM is restarted

### Auto-Healing

Configurable conditions and actions:

**Trigger Conditions:**
- Request duration thresholds (slow requests)
- Memory usage limits
- HTTP status code patterns (e.g., many 500 errors)
- Request count within time windows

**Actions:**
- Recycle process (restart worker)
- Log events
- Run diagnostics (memory dump, CLR profiler)
- Run custom executable/script

**Proactive Auto-Heal**: Automatically restarts based on percent memory and percent request rules.

### Azure Front Door / CDN Integration

For optimal Next.js performance, place Azure Front Door in front of App Service:
- Caches static assets at edge locations
- Front Door respects `Cache-Control` headers
- Next.js `s-maxage` header controls shared/CDN cache duration
- Set `Cache-Control: no-store, max-age=0` for authenticated API routes
- If no `Cache-Control` header is present, Front Door defaults to caching 1-3 days

### General Recommendations

- Set **Platform** to **64-bit**
- Enable **Always On**
- Disable **ARR Affinity**
- Enable **Health Checks** with a meaningful endpoint
- Configure **Auto-Healing** rules for common failure patterns

Sources:
- [Always On vs Health Check](https://techcommunity.microsoft.com/blog/appsonazureblog/understanding-always-on-vs-health-check-in-azure-app-service/4399899)
- [Health Check Best Practices](https://jafreitas90.medium.com/optimizing-azure-app-service-health-checks-best-practices-for-high-availability-52784b4b5f05)
- [Monitor Health Check Instances](https://learn.microsoft.com/en-us/azure/app-service/monitor-instances-health-check)
- [Auto-Heal Diagnostics](https://techcommunity.microsoft.com/blog/appsonazureblog/azure-app-service-auto-heal-capturing-relevant-data-during-performance-issues/4390351)
- [Robust Apps for the Cloud](https://azure.github.io/AppService/2020/05/15/Robust-Apps-for-the-cloud.html)
- [Front Door Caching](https://learn.microsoft.com/en-us/azure/frontdoor/front-door-caching)

---

## 7. Node.js Version Management and PM2

### Node.js Version Selection

**Linux App Service:**
- Controlled by the `linuxFxVersion` setting (e.g., `NODE|20-lts`)
- Available versions: Node 18 LTS, Node 20 LTS, Node 22
- Node 18 LTS extended support ended April 30, 2025 (apps still run but no security updates)
- Set via Azure Portal: Settings > Configuration > General settings > Stack settings

**Windows App Service:**
- Set `WEBSITE_NODE_DEFAULT_VERSION` app setting (e.g., `~20`)

### PM2 Configuration

PM2 comes pre-installed in the Linux Node.js containers.

**Important**: With Node.js versions after Node 14 LTS, the container does NOT automatically start your app with PM2. You must configure it explicitly.

**Basic startup:**
```
pm2 start /home/site/wwwroot/server.js --no-daemon
```

The `--no-daemon` flag is **mandatory** because PM2 must run in the foreground for the container to work.

**Cluster mode for multi-core utilization:**
```
pm2 start /home/site/wwwroot/server.js --no-daemon -i 4
```

Or use `-i max` or `-i 0` to spawn workers equal to the number of CPU cores.

**ecosystem.config.js:**
```js
module.exports = {
  apps: [{
    name: 'nextjs-app',
    script: '/home/site/wwwroot/server.js',
    instances: 'max',    // or specific number
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 8080,
    },
  }],
};
```

**Startup command with ecosystem file:**
```
pm2 --no-daemon start /home/site/wwwroot/ecosystem.config.js
```

**Benefits of PM2 cluster mode:**
- Utilizes all CPU cores (Node.js is single-threaded by default)
- Zero-downtime reloads
- Process monitoring and auto-restart on crash
- Each cluster worker handles requests independently

### Node.js Version Upgrade Gotcha

When upgrading Node.js versions (e.g., 18 to 20), the runtime version on Linux is controlled by the stack image (`linuxFxVersion`), not a separate property. This can cause confusion when the actual running version does not match what you expect.

Sources:
- [Configure Node.js Apps](https://learn.microsoft.com/en-us/azure/app-service/configure-language-nodejs)
- [Using PM2 on App Service Linux](https://azureossd.github.io/2022/02/22/Using-PM2-on-App-Service-Linux/)
- [PM2 Cluster Mode](https://github.com/Azure-App-Service/node/issues/38)
- [Node.js Version Upgrade Issue](https://learn.microsoft.com/en-us/answers/questions/2236557/issue-upgrading-node-js-from-18-to-20-on-azure-app)

---

## 8. Environment Variables vs Key Vault References

### App Settings (Environment Variables)

- Stored as key-value pairs in Azure App Service configuration
- Available to the application as standard environment variables
- Encrypted at rest
- Accessible via `process.env.VARIABLE_NAME` in Node.js/Next.js
- Changes to app settings trigger an app restart

**Next.js-specific behavior:**
- `NEXT_PUBLIC_*` variables are baked into the client bundle at **build time**
- Server-side environment variables are read at runtime
- For `NEXT_PUBLIC_*` variables to work on Azure, they must be available during the build step (either in the CI/CD pipeline or via `SCM_DO_BUILD_DURING_DEPLOYMENT`)

### Key Vault References

Replace sensitive values with references to Azure Key Vault secrets:

```
@Microsoft.KeyVault(SecretUri=https://myvault.vault.azure.net/secrets/mysecret)
```

**Reference formats:**
```
# With version (pinned):
@Microsoft.KeyVault(SecretUri=https://myvault.vault.azure.net/secrets/mysecret/abc123)

# Without version (always latest):
@Microsoft.KeyVault(SecretUri=https://myvault.vault.azure.net/secrets/mysecret)

# Alternative format:
@Microsoft.KeyVault(VaultName=myvault;SecretName=mysecret;SecretVersion=abc123)
```

### Setup Requirements

1. **Create a Managed Identity** for your App Service (system-assigned or user-assigned)
2. **Grant permissions** on the Key Vault:
   - **RBAC** (recommended): Assign "Key Vault Secrets User" role
   - **Access Policies** (legacy): Grant `Get` and `List` permissions for Secrets
3. **Add the reference** as an app setting value

### Key Vault Reference Behavior

- Versionless references automatically rotate when the secret is updated in Key Vault
- Versioned references are pinned and do not auto-rotate
- Resolution happens at app startup and when settings are refreshed
- If resolution fails, the raw reference string is used as the value (not the secret)
- App settings using Key Vault references should be marked as **slot settings** when using deployment slots (because different environments should reference different Key Vaults)

### Best Practices

- Use separate Key Vaults per environment (dev, staging, production)
- Mark Key Vault reference settings as slot-specific
- Use system-assigned managed identity for simplicity
- Use versionless references for auto-rotation of secrets
- Monitor Key Vault access logs for troubleshooting

Sources:
- [Key Vault References](https://learn.microsoft.com/en-us/azure/app-service/app-service-key-vault-references)
- [Configure Common Settings](https://learn.microsoft.com/en-us/azure/app-service/configure-common)
- [Environment Variables Reference](https://learn.microsoft.com/en-us/azure/app-service/reference-app-settings)

---

## 9. Deployment Slots

### Availability by Tier

| Tier | Max Deployment Slots |
|------|---------------------|
| Free / Shared / Basic | 0 |
| Standard | 5 |
| Premium V2/V3 | 20 |
| Isolated V2 | 20 |

No extra charge for using deployment slots.

### Settings That Swap vs. Stay

**Settings that ARE swapped (follow the content):**
- App content (code, files)
- Handler mappings
- Public certificates
- WebJobs content
- Hybrid connections (not marked slot-specific)
- Virtual network integration
- General settings: framework version, 32/64-bit, web sockets, HTTP version, platform bitness

**Settings that are NOT swapped by default (slot-specific):**
- Publishing endpoints
- Custom domain names
- Non-public certificates and TLS/SSL bindings
- Diagnostic logs settings
- CORS settings
- Virtual network integration settings

**Settings that CAN be made slot-specific:**
- App settings (by checking "Deployment slot setting")
- Connection strings (by checking "Deployment slot setting")

### Swap Operations

**How a swap works:**
1. App Service applies slot-specific settings from the target (production) to source instances
2. Source instances restart with those settings
3. Local cache initialization occurs (if enabled)
4. Swap completes by switching routing rules

**No downtime**: Traffic redirection is seamless, no requests are dropped.

**Rollback**: Perform the same swap again to revert.

### Auto-Swap

- Configure a slot to automatically swap into production after deployment
- Available on Standard tier and above
- Useful when pre-swap validation is not needed
- Configured per-slot in Settings > Configuration > General settings

### Traffic Routing

- Route a percentage (0-100%) of production traffic to a staging slot
- Useful for A/B testing and canary deployments
- Users routed to a specific slot receive a `x-ms-routing-name` cookie
- Configure via Settings > Deployment slots > Traffic %

### Warm-Up Configuration

Custom warm-up can be configured in `web.config` (Windows) or via the `WEBSITE_SWAP_WARMUP_PING_PATH` and `WEBSITE_SWAP_WARMUP_PING_STATUSES` app settings:

```
WEBSITE_SWAP_WARMUP_PING_PATH=/api/health
WEBSITE_SWAP_WARMUP_PING_STATUSES=200,301
```

Sources:
- [Set Up Staging Environments](https://learn.microsoft.com/en-us/azure/app-service/deploy-staging-slots)
- [Deployment Slot Best Practices](https://cloudengineerskills.com/posts/app-service-deployment-slots/)
- [Zero to Hero Part 3](https://azure.github.io/AppService/2020/07/07/zero_to_hero_pt3.html)
- [Deployment Slots Benefits](https://stackify.com/azure-deployment-slots/)

---

## 10. Known Limitations and Gotchas

### Critical Next.js-Specific Issues

**1. PORT Environment Variable**
Azure passes a `PORT` environment variable that your app must listen on. If your Next.js app hard-codes port 3000, Azure will report the app started but then fail to respond. The standalone `server.js` respects the `PORT` variable by default, but verify this.

**2. SNAT Port Exhaustion**
- Azure App Service has a soft limit of **128 SNAT ports** per instance for outbound connections
- Exceeding this causes intermittent connection failures to external services
- Node.js connections are NOT kept alive by default
- **Mitigations**:
  - Implement connection pooling
  - Enable HTTP keep-alive for outbound connections
  - Use Azure Private Endpoints / Service Endpoints for Azure services
  - Use NAT Gateway (64k outbound SNAT ports)
  - Use VNet Integration with Service Endpoints

**3. Single-Threaded Node.js**
Node.js is single-threaded, meaning one instance handles all SSR, API routes, image optimization, ISR, etc. on a single thread. This creates a performance bottleneck. Use PM2 cluster mode to utilize multiple cores.

**4. DevDependencies Not Installed in Production**
If `next` is listed under `devDependencies` instead of `dependencies`, Azure won't install it in production. Ensure `next`, `react`, and `react-dom` are in `dependencies`.

**5. Container Startup Timeout**
Default container startup timeout is 230 seconds. Large Next.js apps may exceed this. Increase with:
```
WEBSITES_CONTAINER_START_TIME_LIMIT=600  # up to 1800 seconds max
```

**6. File System Behavior with Run From Package**
When using `WEBSITE_RUN_FROM_PACKAGE=1`, the file system is **read-only**. ISR's file-system cache will not work. You need a custom cache handler.

**7. ISR Cache Not Shared Across Instances**
Default ISR cache is per-instance. When scaling to multiple instances, cached pages are inconsistent. Implement a shared cache handler using Redis or Azure Storage.

**8. NEXT_PUBLIC Environment Variables**
`NEXT_PUBLIC_*` variables are embedded at build time, not runtime. If you build in CI/CD and deploy to Azure, the values from the CI/CD environment are baked in, not the Azure app settings.

### General Azure App Service Gotchas

**9. Cold Starts**
Free and Shared tiers have no Always On. Basic tier has Always On but may still experience cold starts after deployment or restart. Use deployment slots + warm-up to mitigate.

**10. Disk Space Limits**
Each tier has strict disk limits (1 GB Free, 10 GB Basic, 50 GB Standard, 250 GB Premium). `node_modules` and `.next/cache` can consume significant space.

**11. Request Timeout**
Azure App Service has a **230-second request timeout** (non-configurable for non-ASE deployments). Long-running SSR requests that exceed this will be terminated.

**12. WebSocket Limits**
WebSockets are supported but must be explicitly enabled in General Settings. The number of concurrent WebSocket connections is limited by the plan tier.

**13. File System Shared Across Slots**
All deployment slots within the same App Service Plan share the same compute resources. A heavily loaded staging slot can impact production performance.

**14. next export vs Standalone**
Using `next export` (static export) on Azure App Service makes API routes unavailable. Always use `output: 'standalone'` for full Next.js functionality.

**15. Linux vs Windows**
Always use **Linux** App Service for Next.js:
- Lower cost
- Better Node.js support
- PM2 pre-installed
- Docker support
- Better performance for Node.js workloads
- Windows App Service has IIS/iisnode overhead

**16. Image Optimization Memory**
Next.js image optimization with `sharp` is memory-intensive. B1 (1.75 GB RAM) may be insufficient for high-traffic sites with heavy image optimization. Consider P1v3 (8 GB) or higher, or offload to a CDN/external service.

**17. Build on App Service vs CI/CD**
Building Next.js on the App Service itself (via Oryx) is slower and consumes app resources. Best practice: build in CI/CD pipeline and deploy only the built artifacts.

**18. Health Check and Single Instance**
Health Check requires 2+ instances to be effective. With a single instance, unhealthy instances are never removed from the load balancer.

Sources:
- [Container Startup Issues](https://learn.microsoft.com/en-us/answers/questions/2238095/issue-deploying-next-js-app-to-azure-app-service-c)
- [Next.js Failing to Start](https://learn.microsoft.com/en-us/answers/questions/5517816/next-js-app-failing-to-start-in-azure-app-service)
- [SNAT Port Exhaustion Troubleshooting](https://learn.microsoft.com/en-us/azure/app-service/troubleshoot-intermittent-outbound-connection-errors)
- [Gotchas Running Next.js on Azure](https://richiban.uk/2019/01/09/gotchas-getting-next-js-to-run-in-azure-app-services/)
- [Next.js on Azure App Services (Sitecore)](https://developers.sitecore.com/learn/accelerate/xm-cloud/pre-development/developer-experience/nextjs-azure-app-services)
- [Troubleshooting Node.js Deployments](https://azureossd.github.io/2023/02/09/troubleshooting-nodejs-deployments-on-appservice-linux/)

---

## Summary Recommendations for Next.js on Azure App Service

| Aspect | Recommendation |
|--------|---------------|
| **OS** | Linux (always) |
| **Minimum Tier** | B1 for development, S1 or P1v3 for production |
| **Output Mode** | `output: 'standalone'` |
| **Startup Command** | `node server.js` or PM2 with cluster mode |
| **Build Strategy** | Build in CI/CD, deploy artifacts only |
| **Deployment Method** | GitHub Actions with `azure/webapps-deploy@v3` |
| **Node.js Version** | 20 LTS (or latest LTS) |
| **Always On** | Enabled |
| **ARR Affinity** | Disabled |
| **Health Check** | Enabled with custom endpoint |
| **HTTPS** | Force HTTPS, TLS 1.2 minimum |
| **ISR (multi-instance)** | Custom cache handler with Redis or Azure Storage |
| **Image Optimization** | Install `sharp`, or use external CDN loader |
| **Secrets** | Key Vault references with managed identity |
| **Deployment Slots** | Use staging slot with warm-up, swap to production |
| **CDN** | Azure Front Door for static asset caching |
| **Monitoring** | Application Insights integration |
