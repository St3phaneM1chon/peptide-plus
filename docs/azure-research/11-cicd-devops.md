# Comprehensive Azure CI/CD & DevOps Strategy Report for Peptide-Plus (BioCycle Peptides)

**Application Profile:** Next.js 15 e-commerce platform with standalone output, Prisma ORM on PostgreSQL, Stripe payments, Azure Key Vault, MSAL authentication, and a complex schema (70+ models).

**Current State:** You already have a functional `deploy-azure.yml` and `security-scan.yml` in `/Volumes/AI_Project/peptide-plus/.github/workflows/`. This report identifies gaps and provides a production-grade upgrade path across all 15 areas.

---

## 1. GitHub Actions for Azure: Core Actions & Workflow Architecture

### Key Actions

| Action | Version | Purpose |
|--------|---------|---------|
| `azure/login@v2` | v2 | Authenticate to Azure (OIDC, Service Principal, or Publish Profile) |
| `azure/webapps-deploy@v3` | v3 | Deploy to Azure App Service or deployment slots |
| `azure/webapps-container-deploy` | latest | Deploy Docker containers to App Service |
| `azure/container-apps-deploy-action` | latest | Deploy to Azure Container Apps |
| `azure/appservice-settings@v1` | v1 | Configure app settings post-deploy |

### Current Gap in Your Workflow

Your existing `deploy-azure.yml` at `/Volumes/AI_Project/peptide-plus/.github/workflows/deploy-azure.yml` uses **service principal with client secret** (lines 107-113). This is the legacy approach. The recommended modern approach is **OIDC with federated credentials**, which eliminates long-lived secrets entirely.

### Recommended OIDC Authentication Upgrade

```yaml
permissions:
  id-token: write
  contents: read

- name: Login to Azure
  uses: azure/login@v2
  with:
    client-id: ${{ secrets.AZURE_CLIENT_ID }}
    tenant-id: ${{ secrets.AZURE_TENANT_ID }}
    subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}
```

Setup commands for federated credentials:

```bash
# Create app registration
az ad app create --display-name "peptide-plus-cicd"

# Create service principal
az ad sp create --id $APP_ID

# Create federated credential for main branch
az ad app federated-credential create --id $APP_OBJECT_ID --parameters '{
  "name": "github-main",
  "issuer": "https://token.actions.githubusercontent.com",
  "subject": "repo:YOUR_ORG/peptide-plus:ref:refs/heads/main",
  "audiences": ["api://AzureADTokenExchange"]
}'

# Create federated credential for staging environment
az ad app federated-credential create --id $APP_OBJECT_ID --parameters '{
  "name": "github-staging",
  "issuer": "https://token.actions.githubusercontent.com",
  "subject": "repo:YOUR_ORG/peptide-plus:environment:staging",
  "audiences": ["api://AzureADTokenExchange"]
}'
```

**Sources:** [Microsoft Learn - Deploy by Using GitHub Actions](https://learn.microsoft.com/en-us/azure/app-service/deploy-github-actions), [Configuring OpenID Connect in Azure](https://docs.github.com/actions/deployment/security-hardening-your-deployments/configuring-openid-connect-in-azure), [Azure/webapps-deploy GitHub](https://github.com/Azure/webapps-deploy)

---

## 2. Azure DevOps Pipelines: YAML Pipelines vs Classic Editor

### When to Use Azure DevOps vs GitHub Actions

For your project, since you are already on **GitHub** with GitHub Actions, continuing with GitHub Actions is recommended. Azure DevOps Pipelines are more appropriate when:

- You need the Classic Editor (visual pipeline designer) for teams unfamiliar with YAML
- You require Azure Boards integration for work item tracking
- You need Azure Artifacts for private npm feeds
- Your organization mandates Azure DevOps for compliance

### Equivalent Azure DevOps YAML Pipeline (if needed)

```yaml
trigger:
  - main

pool:
  vmImage: 'ubuntu-latest'

variables:
  nodeVersion: '20.x'
  azureSubscription: 'BioCyclePeptides-ServiceConnection'
  appName: 'biocyclepeptides'

stages:
  - stage: Build
    jobs:
      - job: BuildApp
        steps:
          - task: NodeTool@0
            inputs:
              versionSpec: $(nodeVersion)

          - task: Cache@2
            displayName: 'Cache .next/cache'
            inputs:
              key: 'next | $(Agent.OS) | package-lock.json'
              path: '$(System.DefaultWorkingDirectory)/.next/cache'

          - script: |
              npm ci
              npx prisma generate
              npm run build
            displayName: 'Install, Generate, Build'

          - task: ArchiveFiles@2
            inputs:
              rootFolderOrFile: '$(System.DefaultWorkingDirectory)'
              includeRootFolder: false
              archiveType: 'zip'
              archiveFile: '$(Build.ArtifactStagingDirectory)/app.zip'

          - publish: '$(Build.ArtifactStagingDirectory)/app.zip'
            artifact: 'drop'

  - stage: DeployStaging
    dependsOn: Build
    jobs:
      - deployment: DeployToStaging
        environment: 'staging'
        strategy:
          runOnce:
            deploy:
              steps:
                - task: AzureWebApp@1
                  inputs:
                    azureSubscription: $(azureSubscription)
                    appName: $(appName)
                    slotName: 'staging'
                    package: '$(Pipeline.Workspace)/drop/app.zip'

  - stage: DeployProd
    dependsOn: DeployStaging
    condition: succeeded()
    jobs:
      - deployment: SwapToProd
        environment: 'production'
        strategy:
          runOnce:
            deploy:
              steps:
                - task: AzureAppServiceManage@0
                  inputs:
                    azureSubscription: $(azureSubscription)
                    action: 'Swap Slots'
                    webAppName: $(appName)
                    sourceSlot: 'staging'
                    targetSlot: 'production'
```

**Key differences:** Azure DevOps provides built-in **environment approvals and gates** (automatic health checks, manual approvals, Azure Monitor alerts as gates), reusable YAML templates, and deployment groups for self-hosted agents.

**Sources:** [Azure DevOps Pipelines Explained](https://www.codeant.ai/blogs/azure-devops-pipeline), [Setting Up CI/CD for Next.js on Azure DevOps](https://medium.com/@ricardo.jucrist/setting-up-a-ci-cd-pipeline-for-a-next-js-application-on-azure-devops-a3c072450504), [Control deployments with gates and approvals](https://learn.microsoft.com/en-us/azure/devops/pipelines/release/deploy-using-approvals)

---

## 3. Build Optimization: Caching Strategy

Your current workflow at `/Volumes/AI_Project/peptide-plus/.github/workflows/deploy-azure.yml` uses `cache: 'npm'` on the setup-node step (line 41) but is **missing Next.js build cache and Prisma cache**. This is a significant optimization gap.

### Comprehensive Caching Configuration

```yaml
- name: Setup Node.js
  uses: actions/setup-node@v4
  with:
    node-version: ${{ env.NODE_VERSION }}
    cache: 'npm'

# Cache Next.js build output
- name: Cache Next.js build
  uses: actions/cache@v4
  with:
    path: |
      ~/.npm
      ${{ github.workspace }}/.next/cache
    key: ${{ runner.os }}-nextjs-${{ hashFiles('**/package-lock.json') }}-${{ hashFiles('**/*.js', '**/*.jsx', '**/*.ts', '**/*.tsx') }}
    restore-keys: |
      ${{ runner.os }}-nextjs-${{ hashFiles('**/package-lock.json') }}-

# Cache Prisma engines (critical for your 70+ model schema)
- name: Cache Prisma Client
  uses: actions/cache@v4
  with:
    path: |
      node_modules/.prisma
      node_modules/@prisma/client
    key: ${{ runner.os }}-prisma-${{ hashFiles('prisma/schema.prisma') }}
    restore-keys: |
      ${{ runner.os }}-prisma-
```

### Critical Prisma Note

Your `package.json` build script is `"build": "prisma generate && next build"` (line 8). This is correct. However, **always run `prisma generate` explicitly even with cache**, because cached Prisma client from a previous schema version will cause runtime errors. The current build script handles this correctly.

### Expected Impact

| Cache Layer | Time Saved | Cache Key Invalidation |
|------------|-----------|----------------------|
| npm modules | 30-60s | `package-lock.json` changes |
| Next.js `.next/cache` | 60-120s | Source file changes |
| Prisma engines | 10-20s | `schema.prisma` changes |
| **Total** | **~2-3 min per build** | |

**Sources:** [Next.js CI Build Caching](https://nextjs.org/docs/pages/building-your-application/deploying/ci-build-caching), [Squashing the Outdated Prisma Client Error](https://medium.com/@patelpriysnshu2410/squashing-the-outdated-prisma-client-error-a-practical-guide-to-deploying-next-js-89e1e7c01d2c)

---

## 4. Deployment Strategies: Blue-Green, Canary, Rolling Updates

### Blue-Green with Azure Deployment Slots (Recommended for BioCycle)

Azure App Service deployment slots provide native blue-green deployment. This is the best fit for your e-commerce site where downtime means lost revenue.

```yaml
deploy-staging:
  name: Deploy to Staging Slot
  needs: build
  runs-on: ubuntu-latest
  environment:
    name: staging
    url: https://biocyclepeptides-staging.azurewebsites.net
  steps:
    - uses: actions/download-artifact@v4
      with:
        name: build-output

    - uses: azure/login@v2
      with:
        client-id: ${{ secrets.AZURE_CLIENT_ID }}
        tenant-id: ${{ secrets.AZURE_TENANT_ID }}
        subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}

    - name: Deploy to staging slot
      uses: azure/webapps-deploy@v3
      with:
        app-name: biocyclepeptides
        slot-name: staging
        package: .

    - name: Warm up staging
      run: |
        for i in 1 2 3 4 5; do
          curl -s https://biocyclepeptides-staging.azurewebsites.net/api/health
          sleep 5
        done

swap-to-production:
  name: Swap Staging to Production
  needs: deploy-staging
  runs-on: ubuntu-latest
  environment:
    name: production
    url: https://biocyclepeptides.com
  steps:
    - uses: azure/login@v2
      with:
        client-id: ${{ secrets.AZURE_CLIENT_ID }}
        tenant-id: ${{ secrets.AZURE_TENANT_ID }}
        subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}

    - name: Swap slots
      run: |
        az webapp deployment slot swap \
          --resource-group biocycle-peptides-prod \
          --name biocyclepeptides \
          --slot staging \
          --target-slot production
```

### Canary with Traffic Shifting

For gradual rollouts, use traffic shifting between slots:

```yaml
- name: Canary - 10% traffic to staging
  run: |
    az webapp traffic-routing set \
      --resource-group biocycle-peptides-prod \
      --name biocyclepeptides \
      --distribution staging=10

- name: Monitor for 10 minutes
  run: sleep 600

- name: Canary - 50% traffic
  run: |
    az webapp traffic-routing set \
      --resource-group biocycle-peptides-prod \
      --name biocyclepeptides \
      --distribution staging=50

- name: Monitor for 10 minutes
  run: sleep 600

- name: Full swap
  run: |
    az webapp deployment slot swap \
      --resource-group biocycle-peptides-prod \
      --name biocyclepeptides \
      --slot staging \
      --target-slot production
```

**Requirement:** Standard tier or higher App Service plan (S1+) is required for deployment slots.

**Sources:** [Blue-Green Deployment with Azure App Service](https://medium.com/capgemini-microsoft-team/blue-green-deployment-with-azure-app-service-deployment-slots-using-azure-devops-f06583386178), [Blue-Green Deployments with GitHub Actions](https://bursteways.tech/posts/blue-green-deployments/), [Zero to Hero with App Service Part 3](https://azure.github.io/AppService/2020/07/07/zero_to_hero_pt3.html)

---

## 5. Infrastructure as Code: Bicep for Azure

### Recommendation: Bicep over Terraform for Azure-only projects

Since BioCycle Peptides is fully Azure-native (App Service, PostgreSQL, Key Vault, Azure Identity), **Bicep** is recommended over Terraform for simpler syntax and zero-lag Azure API support.

### Complete Bicep Template for Peptide-Plus Infrastructure

```bicep
// main.bicep - BioCycle Peptides Infrastructure
@description('Environment name')
@allowed(['dev', 'staging', 'production'])
param environment string

@description('Azure region')
param location string = resourceGroup().location

@description('PostgreSQL admin password')
@secure()
param dbAdminPassword string

var appName = 'biocyclepeptides-${environment}'
var dbServerName = 'biocycle-db-${environment}'
var kvName = 'biocycle-kv-${environment}'
var appPlanName = 'biocycle-plan-${environment}'

// App Service Plan
resource appServicePlan 'Microsoft.Web/serverfarms@2023-01-01' = {
  name: appPlanName
  location: location
  sku: {
    name: environment == 'production' ? 'P1v3' : 'B1'
    tier: environment == 'production' ? 'PremiumV3' : 'Basic'
  }
  kind: 'linux'
  properties: {
    reserved: true
  }
}

// App Service
resource webApp 'Microsoft.Web/sites@2023-01-01' = {
  name: appName
  location: location
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: appServicePlan.id
    siteConfig: {
      linuxFxVersion: 'NODE|20-lts'
      alwaysOn: environment == 'production'
      healthCheckPath: '/api/health'
      appSettings: [
        { name: 'NODE_ENV', value: environment == 'production' ? 'production' : 'development' }
        { name: 'NEXT_TELEMETRY_DISABLED', value: '1' }
        { name: 'WEBSITE_NODE_DEFAULT_VERSION', value: '~20' }
      ]
    }
    httpsOnly: true
  }
}

// Staging Deployment Slot (production only)
resource stagingSlot 'Microsoft.Web/sites/slots@2023-01-01' = if (environment == 'production') {
  parent: webApp
  name: 'staging'
  location: location
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: appServicePlan.id
    siteConfig: {
      linuxFxVersion: 'NODE|20-lts'
      healthCheckPath: '/api/health'
    }
  }
}

// PostgreSQL Flexible Server
resource dbServer 'Microsoft.DBforPostgreSQL/flexibleServers@2023-03-01-preview' = {
  name: dbServerName
  location: location
  sku: {
    name: environment == 'production' ? 'Standard_D2s_v3' : 'Standard_B1ms'
    tier: environment == 'production' ? 'GeneralPurpose' : 'Burstable'
  }
  properties: {
    version: '15'
    administratorLogin: 'biocycleadmin'
    administratorLoginPassword: dbAdminPassword
    storage: {
      storageSizeGB: environment == 'production' ? 128 : 32
    }
    backup: {
      backupRetentionDays: environment == 'production' ? 35 : 7
      geoRedundantBackup: environment == 'production' ? 'Enabled' : 'Disabled'
    }
    highAvailability: {
      mode: environment == 'production' ? 'ZoneRedundant' : 'Disabled'
    }
  }
}

resource database 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2023-03-01-preview' = {
  parent: dbServer
  name: 'biocycle_${environment}'
}

// Key Vault
resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: kvName
  location: location
  properties: {
    sku: { family: 'A', name: 'standard' }
    tenantId: subscription().tenantId
    enableRbacAuthorization: true
    enableSoftDelete: true
    softDeleteRetentionInDays: 90
  }
}

// Key Vault access for App Service managed identity
resource kvRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: keyVault
  name: guid(keyVault.id, webApp.id, 'Key Vault Secrets User')
  properties: {
    principalId: webApp.identity.principalId
    roleDefinitionId: subscriptionResourceId(
      'Microsoft.Authorization/roleDefinitions',
      '4633458b-17de-408a-b874-0445c86b69e6' // Key Vault Secrets User
    )
    principalType: 'ServicePrincipal'
  }
}

output webAppUrl string = 'https://${webApp.properties.defaultHostName}'
output webAppName string = webApp.name
output dbServerFqdn string = dbServer.properties.fullyQualifiedDomainName
output keyVaultUri string = keyVault.properties.vaultUri
```

### Deploying from CI/CD

```yaml
- name: Deploy Infrastructure
  uses: azure/arm-deploy@v2
  with:
    subscriptionId: ${{ secrets.AZURE_SUBSCRIPTION_ID }}
    resourceGroupName: biocycle-peptides-${{ env.ENVIRONMENT }}
    template: ./infra/main.bicep
    parameters: >
      environment=${{ env.ENVIRONMENT }}
      dbAdminPassword=${{ secrets.DB_ADMIN_PASSWORD }}
```

**Sources:** [Azure Bicep GitHub](https://github.com/Azure/bicep), [Bicep vs Terraform vs Pulumi](https://xebia.com/blog/infrastructure-as-code-on-azure-bicep-vs-terraform-vs-pulumi/), [Quickstart: Create PostgreSQL with Bicep](https://learn.microsoft.com/en-us/azure/postgresql/flexible-server/quickstart-create-server-bicep)

---

## 6. Azure Container Registry + Docker Deployment

### Multi-Stage Dockerfile for Peptide-Plus

Your `next.config.js` already has `output: 'standalone'` (line 4), which is perfect for Docker.

```dockerfile
# Stage 1: Dependencies
FROM node:20-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma/
RUN npm ci
RUN npx prisma generate

# Stage 2: Build
FROM node:20-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/node_modules/.prisma ./node_modules/.prisma
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
RUN npm run build

# Stage 3: Production
FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Security: non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy standalone output
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
```

### GitHub Actions: Build & Push to ACR

```yaml
- name: Login to ACR
  uses: azure/docker-login@v2
  with:
    login-server: biocyclepeptides.azurecr.io
    username: ${{ secrets.ACR_USERNAME }}
    password: ${{ secrets.ACR_PASSWORD }}

- name: Build and push
  uses: docker/build-push-action@v5
  with:
    context: .
    push: true
    tags: |
      biocyclepeptides.azurecr.io/peptide-plus:${{ github.sha }}
      biocyclepeptides.azurecr.io/peptide-plus:latest
    cache-from: type=gha
    cache-to: type=gha,mode=max

- name: Deploy container to App Service
  uses: azure/webapps-deploy@v3
  with:
    app-name: biocyclepeptides
    images: biocyclepeptides.azurecr.io/peptide-plus:${{ github.sha }}
```

### Image Size Optimization

With the multi-stage approach and standalone output, expect:
- **Before optimization:** ~870-1000MB
- **After optimization:** ~180-250MB (70-80% reduction)
- **Rebuild on code changes only:** 30-60 seconds

**Sources:** [Deploying Next.js with Docker and GitHub Actions to Azure](https://medium.com/coding-spaghetti/deploying-next-js-web-app-using-docker-and-github-actions-in-azure-2d5cc28d6705), [Next.js 15 Standalone Mode & Docker Optimization](https://javascript.plainenglish.io/next-js-15-self-hosting-with-docker-complete-guide-0826e15236da), [Deploy Next.js to Azure App Service with Docker](https://medium.com/@mindelias/how-to-deploy-next-js-to-azure-app-service-with-docker-a-complete-guide-to-environment-variables-1aa19d85000a)

---

## 7. Environment Management: Dev / Staging / Production Pipeline

### Build Once, Deploy Many Strategy

Your existing workflow hardcodes `NEXT_PUBLIC_APP_URL` at build time (line 60). This is problematic because `NEXT_PUBLIC_*` variables are **inlined at build time** and cannot be changed per environment without rebuilding.

### Solution: Server-Side Runtime Variables

Since your `next.config.js` only exposes two public variables (lines 129-132):
```javascript
env: {
  NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
}
```

For a true build-once-deploy-many approach, move these to **Server Components** that read `process.env` at runtime:

```typescript
// src/lib/config.ts (server-side only)
export function getConfig() {
  return {
    appName: process.env.NEXT_PUBLIC_APP_NAME || 'BioCycle Peptides',
    appUrl: process.env.NEXT_PUBLIC_APP_URL || 'https://biocyclepeptides.com',
  };
}
```

### Complete Multi-Environment Workflow

```yaml
name: Build Once, Deploy Many

on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npx prisma generate
      - run: npm run build
        env:
          NEXT_TELEMETRY_DISABLED: 1
      - uses: actions/upload-artifact@v4
        with:
          name: build-artifact
          include-hidden-files: true
          path: |
            .next/
            package.json
            package-lock.json
            public/
            prisma/
            next.config.js
            server.js

  deploy-dev:
    needs: build
    runs-on: ubuntu-latest
    environment: development
    steps:
      - uses: actions/download-artifact@v4
        with:
          name: build-artifact
      - uses: azure/login@v2
        with:
          client-id: ${{ secrets.AZURE_CLIENT_ID }}
          tenant-id: ${{ secrets.AZURE_TENANT_ID }}
          subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}
      - run: |
          az webapp config appsettings set \
            --resource-group biocycle-peptides-dev \
            --name biocyclepeptides-dev \
            --settings \
              DATABASE_URL="${{ secrets.DEV_DATABASE_URL }}" \
              NEXTAUTH_URL="https://dev.biocyclepeptides.com" \
              NODE_ENV=development
      - uses: azure/webapps-deploy@v3
        with:
          app-name: biocyclepeptides-dev
          package: .

  deploy-staging:
    needs: deploy-dev
    runs-on: ubuntu-latest
    environment: staging
    steps:
      # Same artifact, different environment variables
      - uses: actions/download-artifact@v4
        with:
          name: build-artifact
      - uses: azure/login@v2
        with:
          client-id: ${{ secrets.AZURE_CLIENT_ID }}
          tenant-id: ${{ secrets.AZURE_TENANT_ID }}
          subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}
      - uses: azure/webapps-deploy@v3
        with:
          app-name: biocyclepeptides
          slot-name: staging
          package: .

  deploy-production:
    needs: deploy-staging
    runs-on: ubuntu-latest
    environment:
      name: production
      url: https://biocyclepeptides.com
    steps:
      - uses: azure/login@v2
        with:
          client-id: ${{ secrets.AZURE_CLIENT_ID }}
          tenant-id: ${{ secrets.AZURE_TENANT_ID }}
          subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}
      - run: |
          az webapp deployment slot swap \
            --resource-group biocycle-peptides-prod \
            --name biocyclepeptides \
            --slot staging \
            --target-slot production
```

**Cost Benefit:** If you expand to multiple locales, this strategy eliminates redundant builds. Instead of N builds, you run 1 build + N lightweight deploys.

**Sources:** [Build Once, Deploy Many with Next.js 15](https://www.learnwithgurpreet.com/posts/automating-nextjs-15-deployments-a-build-once-deploy-many-github-actions-guide), [Next.js 15 Environment-Agnostic Builds](https://www.learnwithgurpreet.com/posts/nextjs-15-build-once-deploy-many-achieving-environment-agnostic-builds-with-the-app-router)

---

## 8. Secrets Management: GitHub Secrets + Azure Key Vault Integration

### Current Issue

Your workflow configures app settings via `az webapp config appsettings set` (lines 116-124) with some values inline. Sensitive secrets (DATABASE_URL, Stripe keys, JWT secrets) should come from **Azure Key Vault**, not GitHub Secrets directly.

### Layered Secrets Architecture

| Layer | Secrets | Management |
|-------|---------|-----------|
| GitHub Secrets | Azure OIDC credentials only (Client ID, Tenant ID, Subscription ID) | Repository Settings |
| Azure Key Vault | DATABASE_URL, STRIPE_SECRET_KEY, NEXTAUTH_SECRET, MSAL credentials | Key Vault + RBAC |
| App Service Config | Non-sensitive settings (NODE_ENV, NEXT_PUBLIC_*) | Bicep or az cli |

### Key Vault Integration in Pipeline

```yaml
- name: Login to Azure
  uses: azure/login@v2
  with:
    client-id: ${{ secrets.AZURE_CLIENT_ID }}
    tenant-id: ${{ secrets.AZURE_TENANT_ID }}
    subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}

- name: Get secrets from Key Vault
  uses: Azure/get-keyvault-secrets@v1
  with:
    keyvault: 'biocycle-kv-production'
    secrets: 'DATABASE-URL, STRIPE-SECRET-KEY, NEXTAUTH-SECRET'
  id: keyvault

- name: Configure App Settings with Key Vault references
  run: |
    az webapp config appsettings set \
      --resource-group biocycle-peptides-prod \
      --name biocyclepeptides \
      --settings \
        DATABASE_URL="@Microsoft.KeyVault(VaultName=biocycle-kv-production;SecretName=DATABASE-URL)" \
        STRIPE_SECRET_KEY="@Microsoft.KeyVault(VaultName=biocycle-kv-production;SecretName=STRIPE-SECRET-KEY)" \
        NEXTAUTH_SECRET="@Microsoft.KeyVault(VaultName=biocycle-kv-production;SecretName=NEXTAUTH-SECRET)"
```

### Key Vault Reference Syntax (App Service Native Integration)

Instead of fetching secrets in CI/CD and passing them, use **Key Vault references** in App Service settings. This means the App Service reads secrets directly from Key Vault at runtime:

```
@Microsoft.KeyVault(VaultName=biocycle-kv-production;SecretName=DATABASE-URL)
```

This requires the App Service managed identity to have the "Key Vault Secrets User" role on the Key Vault.

Your project already includes `@azure/keyvault-secrets` and `@azure/identity` in `package.json` (lines 28-29), so your application code is ready for Key Vault integration.

**Sources:** [Use Azure Key Vault secrets in GitHub Actions](https://learn.microsoft.com/en-us/azure/developer/github/github-actions-key-vault), [Azure/get-keyvault-secrets](https://github.com/Azure/get-keyvault-secrets), [Implement and manage secrets in GitHub Actions](https://notes.kodekloud.com/docs/AZ-400/Design-and-Implement-a-Strategy-for-Managing-Sensitive-Information-in-Automation/Implement-and-manage-secrets-in-GitHub-Actions-and-Azure-Pipelines/page)

---

## 9. Database Migrations in CI/CD: Prisma Migrate Deploy

### Current Gap

Your existing workflow has a placeholder for migrations (lines 148-154) that just prints "Database migrations should be run via Kudu or SSH." This needs to be automated.

### Recommended Approach: Separate Migration Job

```yaml
migrate:
  name: Run Database Migrations
  needs: build
  runs-on: ubuntu-latest
  # Migrations run BEFORE deployment
  steps:
    - uses: actions/checkout@v4

    - uses: actions/setup-node@v4
      with:
        node-version: '20'
        cache: 'npm'

    - run: npm ci

    - uses: azure/login@v2
      with:
        client-id: ${{ secrets.AZURE_CLIENT_ID }}
        tenant-id: ${{ secrets.AZURE_TENANT_ID }}
        subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}

    - name: Get Database URL from Key Vault
      run: |
        DB_URL=$(az keyvault secret show \
          --vault-name biocycle-kv-production \
          --name DATABASE-URL \
          --query value -o tsv)
        echo "DATABASE_URL=$DB_URL" >> $GITHUB_ENV

    - name: Run Prisma Migrate Deploy
      run: npx prisma migrate deploy
      env:
        DATABASE_URL: ${{ env.DATABASE_URL }}

    - name: Verify migration status
      run: npx prisma migrate status
      env:
        DATABASE_URL: ${{ env.DATABASE_URL }}
```

### Zero-Downtime Migration Strategy

For your complex schema with 70+ models, follow the **expand-contract pattern**:

1. **Expand phase** (backward-compatible): Add new columns/tables without removing old ones
2. **Deploy new code**: Application writes to both old and new columns
3. **Migrate data**: Backfill existing data to new columns
4. **Contract phase**: Remove old columns in a subsequent release

Example for renaming a column:

```sql
-- Migration 1: Expand (add new column)
ALTER TABLE "Product" ADD COLUMN "shortDesc" TEXT;
UPDATE "Product" SET "shortDesc" = "shortDescription";

-- Migration 2: Contract (remove old column, after code is updated)
ALTER TABLE "Product" DROP COLUMN "shortDescription";
```

### Important: Prisma in Production Dependencies

Your `prisma` is in `devDependencies` (line 73). For CI/CD migration jobs, you need `prisma` available. Options:

1. Use `npm ci` (installs all deps including dev) in the migration job
2. Move `prisma` to `dependencies`
3. Install it explicitly: `npm install prisma --no-save`

**Sources:** [Deploying database changes with Prisma Migrate](https://www.prisma.io/docs/orm/prisma-client/deployment/deploy-database-changes-with-prisma-migrate), [Mastering Prisma ORM: Production Deployment and CI/CD Guide](https://dilukangelo.dev/mastering-prisma-orm-a-practical-guide-to-deployment-and-cicd), [Development and production workflows](https://www.prisma.io/docs/orm/prisma-migrate/workflows/development-and-production)

---

## 10. Automated Testing in Pipeline

### Current State

Your `security-scan.yml` runs tests with `continue-on-error: true` (line 140). Your `package.json` includes `jest`, `@testing-library/react`, and `@testing-library/jest-dom` but no Playwright. This needs strengthening.

### Comprehensive Testing Pipeline

```yaml
test:
  name: Test Suite
  runs-on: ubuntu-latest
  services:
    postgres:
      image: postgres:15
      env:
        POSTGRES_USER: test
        POSTGRES_PASSWORD: test
        POSTGRES_DB: biocycle_test
      ports:
        - 5432:5432
      options: >-
        --health-cmd pg_isready
        --health-interval 10s
        --health-timeout 5s
        --health-retries 5

  steps:
    - uses: actions/checkout@v4

    - uses: actions/setup-node@v4
      with:
        node-version: '20'
        cache: 'npm'

    - run: npm ci

    - name: Setup test database
      run: |
        npx prisma migrate deploy
        npx prisma db seed
      env:
        DATABASE_URL: postgresql://test:test@localhost:5432/biocycle_test

    # Unit Tests
    - name: Run Unit Tests
      run: npm test -- --coverage --ci
      env:
        DATABASE_URL: postgresql://test:test@localhost:5432/biocycle_test
        NEXTAUTH_SECRET: test-secret-for-ci

    # Integration Tests
    - name: Run Integration Tests
      run: npm test -- --testPathPattern='integration' --ci
      env:
        DATABASE_URL: postgresql://test:test@localhost:5432/biocycle_test

    - name: Upload coverage
      uses: actions/upload-artifact@v4
      with:
        name: coverage-report
        path: coverage/

e2e:
  name: E2E Tests (Playwright)
  needs: build
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4

    - uses: actions/setup-node@v4
      with:
        node-version: '20'
        cache: 'npm'

    - run: npm ci

    - name: Install Playwright browsers
      run: npx playwright install --with-deps chromium

    - name: Download build
      uses: actions/download-artifact@v4
      with:
        name: build-output

    - name: Run E2E tests
      run: npx playwright test
      env:
        BASE_URL: http://localhost:3000

    - name: Upload Playwright report
      uses: actions/upload-artifact@v4
      if: always()
      with:
        name: playwright-report
        path: playwright-report/
        retention-days: 30
```

### Adding Playwright to the Project

```bash
npm install -D @playwright/test
npx playwright install
```

Recommended Playwright config for your e-commerce flows:

```typescript
// playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['html'], ['junit', { outputFile: 'results.xml' }]] : 'html',
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
  ],
  webServer: {
    command: 'npm run start',
    port: 3000,
    reuseExistingServer: !process.env.CI,
  },
});
```

**Sources:** [Automating E2E Testing with Playwright and Azure Pipelines](https://techcommunity.microsoft.com/blog/azurearchitectureblog/automating-end-to-end-testing-with-playwright-and-azure-pipelines/3883704), [Playwright CI Guide](https://playwright.dev/docs/ci), [Microsoft Playwright Testing](https://azure.microsoft.com/en-us/products/playwright-testing)

---

## 11. Preview Environments for Pull Requests

### Option A: Azure Static Web Apps (Built-in PR Previews)

If you can use Azure Static Web Apps for PR previews, it provides **automatic pre-production environments** for every PR:

```yaml
# .github/workflows/pr-preview.yml
name: PR Preview
on:
  pull_request:
    types: [opened, synchronize, reopened]

jobs:
  preview:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Build and Deploy to SWA
        uses: Azure/static-web-apps-deploy@v1
        with:
          azure_static_web_apps_api_token: ${{ secrets.SWA_DEPLOY_TOKEN }}
          repo_token: ${{ secrets.GITHUB_TOKEN }}
          action: 'upload'
          app_location: '/'
          output_location: '.next'
```

URL pattern: `https://<subdomain>-<PR_NUMBER>.<region>.azurestaticapps.net`

### Option B: Deployment Slots per PR (App Service)

For full SSR support (which your app needs), use dynamic deployment slots:

```yaml
name: PR Preview Environment

on:
  pull_request:
    types: [opened, synchronize]

jobs:
  deploy-preview:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: azure/login@v2
        with:
          client-id: ${{ secrets.AZURE_CLIENT_ID }}
          tenant-id: ${{ secrets.AZURE_TENANT_ID }}
          subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}

      - name: Create PR slot
        run: |
          az webapp deployment slot create \
            --resource-group biocycle-peptides-dev \
            --name biocyclepeptides-dev \
            --slot pr-${{ github.event.pull_request.number }}

      # Build and deploy steps...

      - uses: azure/webapps-deploy@v3
        with:
          app-name: biocyclepeptides-dev
          slot-name: pr-${{ github.event.pull_request.number }}
          package: .

      - name: Comment PR URL
        uses: actions/github-script@v7
        with:
          script: |
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: `Preview: https://biocyclepeptides-dev-pr-${{ github.event.pull_request.number }}.azurewebsites.net`
            })

  cleanup-preview:
    if: github.event.action == 'closed'
    runs-on: ubuntu-latest
    steps:
      - uses: azure/login@v2
        with:
          client-id: ${{ secrets.AZURE_CLIENT_ID }}
          tenant-id: ${{ secrets.AZURE_TENANT_ID }}
          subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}

      - name: Delete PR slot
        run: |
          az webapp deployment slot delete \
            --resource-group biocycle-peptides-dev \
            --name biocyclepeptides-dev \
            --slot pr-${{ github.event.pull_request.number }}
```

**Sources:** [Review Pull Requests in Pre-Production](https://learn.microsoft.com/en-us/azure/static-web-apps/review-publish-pull-requests), [Azure-Samples/github-actions-deployment-slots](https://github.com/Azure-Samples/github-actions-deployment-slots), [Create named preview environments](https://learn.microsoft.com/en-us/azure/static-web-apps/named-environments)

---

## 12. Rollback Strategies and Versioning

### Immediate Rollback via Slot Swap

The fastest rollback for your production site:

```yaml
rollback:
  name: Emergency Rollback
  runs-on: ubuntu-latest
  if: failure()
  needs: [deploy-production]
  steps:
    - uses: azure/login@v2
      with:
        client-id: ${{ secrets.AZURE_CLIENT_ID }}
        tenant-id: ${{ secrets.AZURE_TENANT_ID }}
        subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}

    - name: Swap back to previous version
      run: |
        az webapp deployment slot swap \
          --resource-group biocycle-peptides-prod \
          --name biocyclepeptides \
          --slot staging \
          --target-slot production
```

### Automated Health-Check Triggered Rollback

```yaml
- name: Post-deploy health check
  id: healthcheck
  run: |
    MAX_RETRIES=5
    RETRY_COUNT=0
    while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
      HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://biocyclepeptides.com/api/health)
      if [ "$HTTP_STATUS" = "200" ]; then
        echo "healthy=true" >> $GITHUB_OUTPUT
        exit 0
      fi
      RETRY_COUNT=$((RETRY_COUNT + 1))
      sleep 30
    done
    echo "healthy=false" >> $GITHUB_OUTPUT

- name: Auto-rollback on failure
  if: steps.healthcheck.outputs.healthy == 'false'
  run: |
    echo "Health check failed. Rolling back..."
    az webapp deployment slot swap \
      --resource-group biocycle-peptides-prod \
      --name biocyclepeptides \
      --slot staging \
      --target-slot production
    echo "Rollback complete."
    exit 1
```

### Versioning Strategy

Tag every production deployment:

```yaml
- name: Tag release
  if: success()
  run: |
    VERSION=$(date +%Y.%m.%d)-$(echo ${{ github.sha }} | cut -c1-7)
    git tag "v${VERSION}"
    git push origin "v${VERSION}"
```

### Database Rollback Considerations

Prisma does **not** support automatic migration rollback. For database rollback:

1. Maintain backward-compatible migrations (expand-contract pattern)
2. Keep rollback SQL scripts alongside each migration
3. Use database snapshots before risky migrations:

```bash
az postgres flexible-server backup create \
  --resource-group biocycle-peptides-prod \
  --name biocycle-db-production \
  --backup-name pre-migration-$(date +%Y%m%d)
```

**Sources:** [Rollback Strategies for Azure Deployments](https://appstream.studio/blog/rollback-strategies-azure-deployments), [Azure Well-Architected Framework - Safe Deployment](https://learn.microsoft.com/en-us/azure/well-architected/devops/release-engineering-rollback), [Automatic rollback for Azure deploy](https://autosysops.com/blog/automatic-rollback-for-azure-deploy-with-pipeline)

---

## 13. Azure Static Web Apps vs App Service for Next.js

### Comparison for BioCycle Peptides

| Feature | Static Web Apps | App Service | **Verdict for BioCycle** |
|---------|----------------|-------------|--------------------------|
| **SSR/RSC** | Supported (via Azure Functions) | Full native support | App Service |
| **API Routes** | 250MB limit, Functions-based | No limits | App Service |
| **WebSockets** | Not supported | Supported | App Service (for chat) |
| **Prisma + PostgreSQL** | Limited cold starts | Persistent connections | **App Service** |
| **Deployment Slots** | 3-10 staging environments | Unlimited (S1+) | App Service |
| **Cost** | Free tier or $9/month | B1 ~$13/month, S1 ~$73/month | App Service for production |
| **PR Previews** | Built-in, automatic | Manual slot creation | Static Web Apps |
| **Custom Domain + SSL** | 2-5 custom domains | Unlimited | App Service |
| **Health Checks** | Basic | Advanced (path-based, auto-heal) | App Service |
| **Container Support** | No | Yes | App Service |

### Recommendation

**Use App Service for production** due to:
- Your chat system requires WebSocket-like capabilities
- Prisma connection pooling works better with persistent processes
- Your schema complexity and API route count exceed SWA limits
- You need deployment slots for blue-green (S1+ tier)
- Your `@azure/keyvault-secrets` integration needs managed identity

**Optionally use Static Web Apps for PR previews** to get automatic preview environments at no cost.

### Consider Azure Container Apps

Azure Container Apps is a strong alternative if you containerize, offering:
- Serverless scaling (scale to zero in dev)
- Built-in Dapr integration
- KEDA-based autoscaling
- Native container support without Kubernetes complexity
- 48% adoption increase year-over-year (2025 data)

**Sources:** [Next.js on Azure Static Web Apps](https://learn.microsoft.com/en-us/azure/static-web-apps/nextjs), [Deploy hybrid Next.js to SWA](https://learn.microsoft.com/en-us/azure/static-web-apps/deploy-nextjs-hybrid), [Azure Container Apps 2025 Guide](https://kunaldaskd.medium.com/azure-container-apps-your-complete-2025-guide-to-serverless-container-deployment-de6ef2ef1f1a)

---

## 14. Monitoring Deployments: Health Checks & Traffic Shifting

### Health Check Endpoint

Your current workflow checks `/api/health` (line 161). Ensure this endpoint validates critical dependencies:

```typescript
// src/app/api/health/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const checks = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.BUILD_ID || 'unknown',
    checks: {} as Record<string, string>,
  };

  // Database check
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.checks.database = 'healthy';
  } catch {
    checks.checks.database = 'unhealthy';
    checks.status = 'unhealthy';
  }

  // Redis check (if applicable)
  // Stripe connectivity check
  // Key Vault accessibility check

  const statusCode = checks.status === 'healthy' ? 200 : 503;
  return NextResponse.json(checks, { status: statusCode });
}
```

### App Service Health Check Configuration

Configure in Bicep or Azure portal:

```bicep
resource webApp 'Microsoft.Web/sites@2023-01-01' = {
  // ...
  properties: {
    siteConfig: {
      healthCheckPath: '/api/health'
      // Auto-heal rules
      autoHealEnabled: true
      autoHealRules: {
        triggers: {
          statusCodes: [
            { status: 500, subStatus: 0, count: 10, timeInterval: '00:05:00' }
          ]
        }
        actions: {
          actionType: 'Recycle'
          minProcessExecutionTime: '00:05:00'
        }
      }
    }
  }
}
```

### Traffic Shifting with Monitoring

```yaml
- name: Deploy to staging and begin canary
  run: |
    # Deploy to staging slot
    az webapp deployment slot swap --preview \
      --resource-group biocycle-peptides-prod \
      --name biocyclepeptides \
      --slot staging

    # Route 10% traffic to staging
    az webapp traffic-routing set \
      --resource-group biocycle-peptides-prod \
      --name biocyclepeptides \
      --distribution staging=10

    echo "Canary started: 10% traffic to new version"

- name: Monitor canary (check error rates)
  run: |
    sleep 300  # 5 minutes
    # Query Application Insights for error rate
    ERROR_RATE=$(az monitor app-insights query \
      --apps biocycle-insights \
      --analytics-query "requests | where timestamp > ago(5m) | summarize failRate = countif(success == false) * 100.0 / count()" \
      --query "tables[0].rows[0][0]" -o tsv)

    if (( $(echo "$ERROR_RATE > 5" | bc -l) )); then
      echo "Error rate too high: $ERROR_RATE%. Rolling back."
      az webapp traffic-routing clear \
        --resource-group biocycle-peptides-prod \
        --name biocyclepeptides
      exit 1
    fi

    echo "Error rate acceptable: $ERROR_RATE%. Proceeding to full swap."

- name: Complete swap
  run: |
    az webapp traffic-routing clear \
      --resource-group biocycle-peptides-prod \
      --name biocyclepeptides
    az webapp deployment slot swap \
      --resource-group biocycle-peptides-prod \
      --name biocyclepeptides \
      --slot staging \
      --target-slot production
```

**Sources:** [Monitor the Health of App Service Instances](https://learn.microsoft.com/en-us/azure/app-service/monitor-instances-health-check), [Azure App Service Health Checks and Zero-Downtime Deployments](https://johnnyreilly.com/azure-app-service-health-checks-and-zero-downtime-deployments), [Safe Deployment Practices](https://learn.microsoft.com/en-us/azure/well-architected/operational-excellence/safe-deployments)

---

## 15. Git Flow vs Trunk-Based Development

### Recommendation: Trunk-Based Development with Release Flow

For BioCycle Peptides, **trunk-based development** (Microsoft's "Release Flow" variant) is recommended because:

- Small team (implied by single-product focus)
- Continuous deployment to Azure App Service
- Fast iteration on e-commerce features
- Blue-green deployment slots handle the "safety net"

### Branch Strategy

```
main (always deployable)
  |
  |-- feature/PP-123-add-subscription-flow  (short-lived, max 2-3 days)
  |-- feature/PP-124-loyalty-points-ui      (short-lived)
  |-- fix/PP-125-checkout-tax-calculation    (short-lived)
  |
  |-- release/v2026.02  (created at sprint boundary, only hotfixes cherry-picked)
```

### Branch Protection Rules

```yaml
# GitHub branch protection for main
# Settings > Branches > Branch protection rules
- branch: main
  rules:
    - require_pull_request_reviews: true
      required_approving_review_count: 1
    - require_status_checks: true
      required_checks:
        - "Security Scan / Audit Dependencies"
        - "Security Scan / SAST Analysis"
        - "Build & Test"
    - require_linear_history: true
    - require_conversation_resolution: true
```

### Workflow Triggers Aligned with Strategy

```yaml
# CI runs on every PR to main
on:
  pull_request:
    branches: [main]
    # Trigger only on relevant file changes
    paths:
      - 'src/**'
      - 'prisma/**'
      - 'package.json'
      - 'next.config.js'

# CD runs on merge to main
on:
  push:
    branches: [main]
```

### Microsoft's Own Practice (Release Flow)

Microsoft uses trunk-based development for Azure DevOps itself. Key principles:
1. All developers work on short-lived branches off `main`
2. PRs require CI checks and code review
3. Release branches are created per sprint
4. Hotfixes are cherry-picked from `main` into release branches
5. No long-lived feature branches

**Sources:** [How Microsoft develops with DevOps](https://learn.microsoft.com/en-us/devops/develop/how-microsoft-develops-devops), [Release Flow: How We Do Branching on the VSTS Team](https://devblogs.microsoft.com/devops/release-flow-how-we-do-branching-on-the-vsts-team/), [Trunk-Based Development vs Git Flow](https://get.assembla.com/blog/trunk-based-development-vs-git-flow/)

---

## Complete Recommended Workflow Architecture

Here is the target-state pipeline architecture combining all 15 areas:

```
PR Created
    |
    v
[Security Scan] -----> [Unit Tests] -----> [Build] -----> [PR Preview Environment]
    |                       |                  |                    |
    |                       |                  |            [E2E Tests on Preview]
    |                       |                  |                    |
    v                       v                  v                    v
[Gitleaks]          [Jest + Coverage]    [Prisma Generate]    [Playwright]
[Semgrep SAST]      [Integration Tests]  [Next.js Build]     [Accessibility]
[CodeQL]            [Type Check]         [Artifact Upload]
[npm audit]
[Snyk]

PR Merged to Main
    |
    v
[Build Once] ---> [Prisma Migrate] ---> [Deploy Dev] ---> [Deploy Staging Slot]
                       |                      |                    |
                  [Expand/Contract]     [Smoke Tests]       [Health Check]
                  [Backup DB first]                         [Integration Tests]
                                                                   |
                                                                   v
                                                        [Manual Approval Gate]
                                                                   |
                                                                   v
                                                         [Swap to Production]
                                                                   |
                                                                   v
                                                  [Canary: 10% -> 50% -> 100%]
                                                                   |
                                                         [Monitor Error Rate]
                                                                   |
                                                    [Auto-Rollback if >5% errors]
```

---

## Immediate Action Items for Peptide-Plus

Based on analyzing your existing workflows and codebase, here are prioritized improvements:

### Priority 1 (Critical)
1. **Upgrade to OIDC authentication** - Remove client secret from `deploy-azure.yml` lines 107-113
2. **Automate database migrations** - Replace the placeholder at lines 148-154 with `prisma migrate deploy`
3. **Add Next.js build cache** - Add `.next/cache` caching to both workflows
4. **Add Prisma cache** - Cache `node_modules/.prisma` keyed on `schema.prisma` hash

### Priority 2 (Important)
5. **Create deployment slots** - Add staging slot for blue-green deployment
6. **Integrate Key Vault references** - Stop passing secrets through CI/CD, use App Service KV references
7. **Add Playwright E2E tests** - Cover checkout flow, authentication, and product browsing
8. **Create Bicep templates** - Define infrastructure as code for reproducible environments

### Priority 3 (Enhancement)
9. **Implement PR preview environments** - Dynamic deployment slots per PR
10. **Add canary traffic shifting** - Gradual rollout with monitoring
11. **Create Dockerfile** - For Container Apps migration path
12. **Set up automated rollback** - Health check triggered slot swap reversal

---

## Key Files Referenced

- `/Volumes/AI_Project/peptide-plus/.github/workflows/deploy-azure.yml` -- Current deployment workflow
- `/Volumes/AI_Project/peptide-plus/.github/workflows/security-scan.yml` -- Current security pipeline
- `/Volumes/AI_Project/peptide-plus/next.config.js` -- Next.js config (standalone output already enabled)
- `/Volumes/AI_Project/peptide-plus/package.json` -- Dependencies and scripts
- `/Volumes/AI_Project/peptide-plus/prisma/schema.prisma` -- Database schema (70+ models, PostgreSQL)

## Sources

- [Microsoft Learn - Deploy by Using GitHub Actions](https://learn.microsoft.com/en-us/azure/app-service/deploy-github-actions)
- [Azure/webapps-deploy GitHub](https://github.com/Azure/webapps-deploy)
- [Configuring OpenID Connect in Azure - GitHub Docs](https://docs.github.com/actions/deployment/security-hardening-your-deployments/configuring-openid-connect-in-azure)
- [Next.js CI Build Caching](https://nextjs.org/docs/pages/building-your-application/deploying/ci-build-caching)
- [Azure Bicep GitHub](https://github.com/Azure/bicep)
- [Bicep vs Terraform vs Pulumi](https://xebia.com/blog/infrastructure-as-code-on-azure-bicep-vs-terraform-vs-pulumi/)
- [Blue-Green Deployment with Azure App Service](https://medium.com/capgemini-microsoft-team/blue-green-deployment-with-azure-app-service-deployment-slots-using-azure-devops-f06583386178)
- [Blue-Green Deployments with GitHub Actions](https://bursteways.tech/posts/blue-green-deployments/)
- [Deploying database changes with Prisma Migrate](https://www.prisma.io/docs/orm/prisma-client/deployment/deploy-database-changes-with-prisma-migrate)
- [Use Azure Key Vault secrets in GitHub Actions](https://learn.microsoft.com/en-us/azure/developer/github/github-actions-key-vault)
- [Automating E2E Testing with Playwright and Azure Pipelines](https://techcommunity.microsoft.com/blog/azurearchitectureblog/automating-end-to-end-testing-with-playwright-and-azure-pipelines/3883704)
- [Playwright CI Guide](https://playwright.dev/docs/ci)
- [Review Pull Requests in Pre-Production](https://learn.microsoft.com/en-us/azure/static-web-apps/review-publish-pull-requests)
- [Rollback Strategies for Azure Deployments](https://appstream.studio/blog/rollback-strategies-azure-deployments)
- [Next.js on Azure Static Web Apps](https://learn.microsoft.com/en-us/azure/static-web-apps/nextjs)
- [Azure Container Apps 2025 Guide](https://kunaldaskd.medium.com/azure-container-apps-your-complete-2025-guide-to-serverless-container-deployment-de6ef2ef1f1a)
- [Monitor the Health of App Service Instances](https://learn.microsoft.com/en-us/azure/app-service/monitor-instances-health-check)
- [Safe Deployment Practices - Azure Well-Architected](https://learn.microsoft.com/en-us/azure/well-architected/operational-excellence/safe-deployments)
- [How Microsoft develops with DevOps](https://learn.microsoft.com/en-us/devops/develop/how-microsoft-develops-devops)
- [Release Flow by Microsoft](https://devblogs.microsoft.com/devops/release-flow-how-we-do-branching-on-the-vsts-team/)
- [Build Once Deploy Many with Next.js 15](https://www.learnwithgurpreet.com/posts/automating-nextjs-15-deployments-a-build-once-deploy-many-github-actions-guide)
- [Setting Up CI/CD for Next.js on Azure DevOps](https://medium.com/@ricardo.jucrist/setting-up-a-ci-cd-pipeline-for-a-next-js-application-on-azure-devops-a3c072450504)
- [Azure DevOps Pipelines Explained](https://www.codeant.ai/blogs/azure-devops-pipeline)
- [Control Deployments with Gates and Approvals](https://learn.microsoft.com/en-us/azure/devops/pipelines/release/deploy-using-approvals)
- [Trunk-Based Development vs Git Flow](https://get.assembla.com/blog/trunk-based-development-vs-git-flow/)
- [GitHub Actions Complete CI/CD Guide 2026](https://dasroot.net/posts/2026/01/github-actions-complete-ci-cd-guide/)
- [Next.js 15 Standalone Docker Optimization](https://javascript.plainenglish.io/next-js-15-self-hosting-with-docker-complete-guide-0826e15236da)
- [Deploying PostgreSQL to Azure with Bicep](https://pamelafox.github.io/my-py-talks/postgres-bicep/)
