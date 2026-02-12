# Azure Security for Web Applications - Comprehensive Report

**Date:** February 11, 2026
**Scope:** Exhaustive coverage of all Azure security domains for web applications
**Audience:** Architects, DevOps, Security Engineers, Compliance Officers

---

## Table of Contents

1. [Azure Active Directory / Entra ID](#1-azure-active-directory--entra-id)
2. [Azure Key Vault](#2-azure-key-vault)
3. [Network Security](#3-network-security)
4. [Private Endpoints and Private Link](#4-private-endpoints-and-private-link)
5. [Managed Identity](#5-managed-identity)
6. [Microsoft Defender for Cloud](#6-microsoft-defender-for-cloud)
7. [SSL/TLS](#7-ssltls)
8. [CORS, IP Restrictions, Access Restrictions](#8-cors-ip-restrictions-access-restrictions)
9. [Azure Policy](#9-azure-policy)
10. [Secret Rotation and Certificate Auto-Renewal](#10-secret-rotation-and-certificate-auto-renewal)
11. [Logging and Auditing](#11-logging-and-auditing)
12. [OWASP Top 10 Protections](#12-owasp-top-10-protections)
13. [Azure Security Benchmark v3](#13-azure-security-benchmark-v3)
14. [Zero Trust Architecture](#14-zero-trust-architecture)
15. [Comparison with AWS/GCP](#15-comparison-with-awsgcp)
16. [Recent CVEs and Vulnerability Intelligence](#16-recent-cves-and-vulnerability-intelligence)
17. [Compliance Frameworks (NIST/ISO)](#17-compliance-frameworks-nistiso)
18. [Implementation Checklist](#18-implementation-checklist)

---

## 1. Azure Active Directory / Entra ID

### 1.1 App Registrations

An **App Registration** in Microsoft Entra ID creates an application object and a service principal in the home tenant. When you register a new application, a service principal is automatically created.

**Best Practices:**
- Restrict who can create app registrations via Entra ID tenant settings
- Use **application permissions** (client credentials flow) for daemon/backend services only
- Use **delegated permissions** (authorization code flow) for user-facing applications
- Limit the API permissions granted to the absolute minimum required (principle of least privilege)
- Prefer certificates over client secrets for authentication; store them in Key Vault
- Set expiration dates on credentials (secrets and certificates) -- never use "never expires"
- Regularly audit and remove unused app registrations using Entra ID's application activity reports
- Tag and categorize registrations by environment (dev/staging/prod) and team ownership

**Configuration:**
```bash
# Create app registration with Azure CLI
az ad app create --display-name "peptide-plus-api" \
  --sign-in-audience "AzureADMyOrg" \
  --enable-id-token-issuance false

# Add certificate credential (preferred over secrets)
az ad app credential reset --id <app-id> \
  --cert @certificate.pem --append
```

### 1.2 Service Principals

A **service principal** is the local representation of an application object in a single tenant. It defines what the app can do in that specific tenant and who can access it.

**Three types:**
1. **Application** -- Created when you register an app; linked to the app object
2. **Managed Identity** -- Created automatically for Azure resources; fully managed credentials
3. **Legacy** -- Created before app registrations existed; avoid creating new ones

**Best Practices:**
- Use managed identities instead of service principals wherever possible (eliminates credential management)
- For multi-tenant apps, create dedicated service principals per tenant
- Never embed service principal credentials in source code
- Rotate credentials every 90 days maximum
- Assign service principals to Entra ID groups for easier RBAC management

### 1.3 RBAC (Role-Based Access Control)

Azure RBAC controls access to Azure resources at management group, subscription, resource group, or individual resource scope. Permissions inherit downward through the scope hierarchy.

**Core Concepts:**
- **Security Principal:** User, group, service principal, or managed identity
- **Role Definition:** Collection of permissions (read, write, delete, etc.)
- **Scope:** The level where the role is assigned (management group > subscription > resource group > resource)
- **Role Assignment:** Binding of a role definition to a security principal at a scope

**Built-in Roles for Web Apps:**
| Role | Description |
|------|-------------|
| Website Contributor | Manage websites, not access to them |
| Web Plan Contributor | Manage App Service plans |
| Reader | View resources only |
| Key Vault Secrets User | Read secret contents |
| Storage Blob Data Reader | Read blob data |
| Contributor | Full access except role assignments |

**Best Practices:**
- Follow the principle of least privilege -- assign the most restrictive role that still allows the task
- Prefer assigning roles to **groups** rather than individual users
- Use **Conditional Access** alongside RBAC for risk-based access decisions
- Enable **Privileged Identity Management (PIM)** for time-limited, just-in-time elevation
- Audit role assignments regularly using `az role assignment list`
- Avoid the Owner role for service accounts; use Contributor + specific additional roles if needed

### 1.4 Conditional Access and MFA

**Mandatory MFA:** As of 2025, Microsoft is enforcing mandatory MFA for all Azure portal, CLI, and PowerShell access across all tenants. Phase 1 enforcement began mid-2025.

**Key Policies to Implement:**
- Require MFA for all users accessing Azure management surfaces
- Require MFA for all admin roles (Global Admin, Security Admin, etc.)
- Block legacy authentication protocols that cannot support MFA
- Require compliant devices for access to sensitive applications
- Create location-based policies (block access from unexpected geographies)
- Exclude emergency break-glass accounts (2 minimum) from all policies; monitor their usage

```json
// Example Conditional Access Policy Structure
{
  "displayName": "Require MFA for all users",
  "state": "enabled",
  "conditions": {
    "users": { "includeUsers": ["All"] },
    "applications": { "includeApplications": ["All"] },
    "clientAppTypes": ["browser", "mobileAppsAndDesktopClients"]
  },
  "grantControls": {
    "operator": "OR",
    "builtInControls": ["mfa"]
  }
}
```

**Sources:**
- [Apps & Service Principals in Microsoft Entra ID](https://learn.microsoft.com/en-us/entra/identity-platform/app-objects-and-service-principals)
- [Managed Identities Overview](https://learn.microsoft.com/en-us/entra/identity/managed-identities-azure-resources/overview)
- [Register an App and Create a Service Principal](https://learn.microsoft.com/en-us/entra/identity-platform/howto-create-service-principal-portal)
- [Assign Azure Roles via Portal](https://learn.microsoft.com/en-us/azure/role-based-access-control/role-assignments-portal)
- [Managed Identity vs. Service Principal (TechTarget)](https://www.techtarget.com/searchcloudcomputing/tip/Managed-identity-vs-service-principal-for-Azure-apps)
- [Require MFA with Conditional Access](https://learn.microsoft.com/en-us/entra/identity/conditional-access/policy-all-users-mfa-strength)
- [Mandatory MFA Plan](https://learn.microsoft.com/en-us/entra/identity/authentication/concept-mandatory-multifactor-authentication)

---

## 2. Azure Key Vault

### 2.1 Secrets Management

Azure Key Vault provides centralized storage for application secrets, encryption keys, and certificates. Secrets are encrypted at rest using FIPS 140-2 Level 2 (Standard tier) or Level 3 (Premium tier with HSM) validated hardware.

**Secret Types:**
- **Secrets:** Connection strings, API keys, passwords, tokens
- **Keys:** RSA or EC cryptographic keys for signing/encryption
- **Certificates:** X.509 certificates with lifecycle management

**Best Practices:**
- One Key Vault per application per environment (dev/staging/prod)
- Enable soft-delete and purge protection to prevent accidental or malicious deletion
- Enable diagnostic logging to track all access
- Tag secrets with expiration dates and owner metadata
- Use versioning -- never overwrite secrets; create new versions
- Store database connection strings, API keys, and certificates exclusively in Key Vault

### 2.2 Access Policies vs. RBAC

**CRITICAL 2026 UPDATE:** Starting with API version **2026-02-01** (releasing February 2026), Azure RBAC becomes the **default** access control model for all newly created Key Vaults. The legacy access policy model is being deprecated.

| Feature | Access Policies (Legacy) | Azure RBAC (Recommended) |
|---------|-------------------------|-------------------------|
| Scope | Key Vault level only | Management group, subscription, resource group, or individual resource |
| Granularity | Keys/Secrets/Certificates as groups | Individual secrets, keys, certificates |
| Integration | Key Vault only | Unified Azure RBAC model |
| Audit | Key Vault logs only | Azure Activity Log + Key Vault logs |
| Conditional Access | Not supported | Supported |
| Permission management | Vault owner or Contributor | Only Owner and User Access Administrator |

**Key RBAC Roles for Key Vault:**
| Role | Permissions |
|------|------------|
| Key Vault Administrator | Full management of all Key Vault objects |
| Key Vault Secrets Officer | Full management of secrets |
| Key Vault Secrets User | Read secret contents (for applications) |
| Key Vault Certificates Officer | Full management of certificates |
| Key Vault Crypto Officer | Full management of keys |
| Key Vault Reader | Read metadata (not values) |

**Migration Path:**
```bash
# Check current permission model
az keyvault show --name <vault-name> --query properties.enableRbacAuthorization

# Migrate from access policies to RBAC
az keyvault update --name <vault-name> --enable-rbac-authorization true

# Assign role to managed identity
az role assignment create \
  --role "Key Vault Secrets User" \
  --assignee <managed-identity-object-id> \
  --scope /subscriptions/<sub-id>/resourceGroups/<rg>/providers/Microsoft.KeyVault/vaults/<vault-name>
```

### 2.3 Key Vault References in App Service

Key Vault references allow App Service to pull secrets directly as app settings/connection strings without application code changes.

**Syntax:**
```
@Microsoft.KeyVault(VaultName=myvault;SecretName=mysecret)
@Microsoft.KeyVault(SecretUri=https://myvault.vault.azure.net/secrets/mysecret/)
@Microsoft.KeyVault(SecretUri=https://myvault.vault.azure.net/secrets/mysecret/ec96f02080254f109c51a1f14cdb1931)
```

**Requirements:**
- App Service must have a managed identity (system-assigned used by default)
- The managed identity must have **Key Vault Secrets User** role (RBAC) or **Get** secrets permission (access policy)
- For user-assigned identity, specify the identity in the reference source configuration
- Network connectivity between App Service and Key Vault (private endpoint or service endpoint recommended)

**Rotation Behavior:**
- App Service polls for secret updates periodically (approximately every 24 hours)
- Changing the app setting value or restarting the app triggers immediate refresh
- For version-less references, the latest version is automatically resolved on refresh

**Sources:**
- [Grant Permission Using Azure RBAC](https://learn.microsoft.com/en-us/azure/key-vault/general/rbac-guide)
- [RBAC vs Access Policies](https://learn.microsoft.com/en-us/azure/key-vault/general/rbac-access-policy)
- [Prepare for Key Vault API 2026-02-01](https://learn.microsoft.com/en-us/azure/key-vault/general/access-control-default)
- [Migrate to Azure RBAC](https://learn.microsoft.com/en-us/azure/key-vault/general/rbac-migration)
- [Key Vault References in App Service](https://learn.microsoft.com/en-us/azure/app-service/app-service-key-vault-references)
- [Secure Your Key Vault](https://learn.microsoft.com/en-us/azure/key-vault/general/secure-key-vault)

---

## 3. Network Security

### 3.1 Network Security Groups (NSGs)

NSGs provide stateful packet filtering at Layer 3/4 (IP addresses and TCP/UDP ports). They can be associated with subnets or individual network interfaces.

**Key Rules:**
- Default rules allow all inbound from the VNet and Azure Load Balancer, deny all other inbound
- Default rules allow all outbound to the VNet and internet, deny all other outbound
- Custom rules use priority (100-4096); lower number = higher priority
- NSGs are **stateful**: return traffic is automatically allowed

**Best Practices for Web Apps:**
```
Inbound Rules:
  Priority 100: Allow HTTPS (443) from Internet/Front Door
  Priority 110: Allow HTTP (80) from Internet (redirect to HTTPS)
  Priority 200: Allow SSH/RDP from management subnet only
  Priority 4096: Deny all (implicit)

Outbound Rules:
  Priority 100: Allow HTTPS to Key Vault service tag
  Priority 110: Allow PostgreSQL (5432) to database subnet
  Priority 120: Allow HTTPS to AzureMonitor service tag
  Priority 4096: Deny all (explicit -- override default allow-all)
```

**Service Tags:** Use Azure service tags instead of hardcoded IPs:
- `AzureKeyVault` -- Key Vault endpoints
- `Sql` -- Azure SQL/PostgreSQL endpoints
- `AzureMonitor` -- Monitoring endpoints
- `AzureFrontDoor.Backend` -- Front Door backend IPs
- `Storage` -- Azure Storage endpoints
- `AzureActiveDirectory` -- Entra ID endpoints

### 3.2 Azure Firewall

Azure Firewall is a managed, cloud-native network firewall service offering L3-L7 filtering, threat intelligence-based filtering, and TLS inspection.

**Tiers:**
| Feature | Standard | Premium |
|---------|----------|---------|
| L3-L4 rules | Yes | Yes |
| FQDN filtering | Yes | Yes |
| Threat intelligence | Yes | Yes (enhanced) |
| TLS inspection | No | Yes |
| IDPS (Intrusion Detection) | No | Yes |
| URL filtering | No | Yes |
| Web categories | No | Yes |

**Architecture Pattern for Web Apps:**
```
Internet --> Azure Front Door (WAF) --> Azure Firewall --> App Service (VNet integrated)
                                                       --> Database (Private Endpoint)
                                                       --> Storage (Private Endpoint)
```

### 3.3 Web Application Firewall (WAF)

Azure WAF provides centralized protection against OWASP Top 10 and other common web vulnerabilities. It can be deployed on:
- **Azure Application Gateway** (regional, L7 load balancer)
- **Azure Front Door** (global, CDN + L7 load balancer)
- **Azure CDN** (content delivery with WAF rules)

**Rule Sets:**
- **DRS 2.2** (Default Rule Set): Latest Microsoft-managed rules with proprietary threat intelligence. Covers SQL injection, XSS, local file inclusion (LFI), remote code execution (RCE), PHP/Java/Node.js specific attacks, protocol violations, session fixation, and scanner detection
- **CRS 3.2** (OWASP Core Rule Set): Community-managed, aligned with OWASP ModSecurity CRS
- **Bot Manager Rule Set**: Classifies and manages bot traffic (good bots, bad bots, unknown)

**Deployment Strategy:**
1. Start in **Detection** mode to understand traffic patterns and identify false positives
2. Review WAF logs for 2-4 weeks, create exclusions for legitimate traffic patterns
3. Switch to **Prevention** mode to actively block threats
4. Configure custom rules for application-specific protections
5. Enable rate limiting to mitigate volumetric attacks

**Custom Rules Examples:**
```json
{
  "name": "BlockSQLInjectionInHeaders",
  "priority": 1,
  "ruleType": "MatchRule",
  "matchConditions": [{
    "matchVariables": [{"variableName": "RequestHeaders", "selector": "User-Agent"}],
    "operator": "Contains",
    "matchValues": ["SELECT", "UNION", "DROP", "INSERT", "DELETE", "--", "/*"]
  }],
  "action": "Block"
}
```

### 3.4 DDoS Protection

**Two tiers:**
- **DDoS Network Protection** (formerly Standard): Per-VNet protection, adaptive tuning, metrics/alerts, rapid response team access. Approximately $2,944/month per 100 resources
- **DDoS IP Protection**: Per-public-IP protection, same core mitigation capabilities. Approximately $199/month per IP

**Coverage:**
- Layer 3/4 DDoS protection (volumetric, protocol, resource layer attacks)
- Always-on traffic monitoring with automatic mitigation
- Layer 7 protection requires WAF (on Application Gateway or Front Door)
- Automatic tuning based on your traffic profile over time

**Sources:**
- [Azure Network Security Overview](https://docs.azure.cn/en-us/security/fundamentals/network-overview)
- [Azure Web Application Firewall](https://azure.microsoft.com/en-us/products/web-application-firewall)
- [Azure DDoS Protection Overview](https://learn.microsoft.com/en-us/azure/ddos-protection/ddos-protection-overview)
- [Azure Security Benchmark v3 - Network Security](https://learn.microsoft.com/en-us/security/benchmark/azure/security-controls-v3-network-security)
- [Secure Azure Front Door](https://learn.microsoft.com/en-us/azure/frontdoor/secure-front-door)
- [DDoS on Front Door](https://learn.microsoft.com/en-us/azure/frontdoor/front-door-ddos)
- [Inside Azure DDoS Protection (Redmond Mag)](https://redmondmag.com/articles/2025/09/11/inside-azure--ddos-protection.aspx)

---

## 4. Private Endpoints and Private Link

### 4.1 Concepts

**Azure Private Link** enables access to Azure PaaS services over a private IP address within your virtual network. Traffic traverses the Microsoft backbone network, never the public internet.

**Private Endpoint** = A network interface injected into your subnet with a private IP address from your VNet address space. It represents a specific Azure resource.

### 4.2 Securing Database Connections (PostgreSQL)

Azure Database for PostgreSQL Flexible Server supports Private Link for secure, private connectivity.

**Architecture:**
```
App Service (VNet Integrated) --> Subnet A
                                    |
                              Private Endpoint (10.0.1.4) --> PostgreSQL Flexible Server
                                    |
                              Private DNS Zone: privatelink.postgres.database.azure.com
```

**Implementation Steps:**
1. Create a Private Endpoint for the PostgreSQL server in a dedicated subnet
2. Create a Private DNS Zone (`privatelink.postgres.database.azure.com`)
3. Link the DNS zone to your VNet
4. Disable public network access on the PostgreSQL server
5. Configure App Service VNet integration to route through the private endpoint

```bash
# Create private endpoint for PostgreSQL
az network private-endpoint create \
  --name pg-private-endpoint \
  --resource-group myResourceGroup \
  --vnet-name myVNet \
  --subnet database-subnet \
  --private-connection-resource-id /subscriptions/.../Microsoft.DBforPostgreSQL/flexibleServers/myserver \
  --group-id postgresqlServer \
  --connection-name pg-connection

# Create private DNS zone
az network private-dns zone create \
  --resource-group myResourceGroup \
  --name privatelink.postgres.database.azure.com

# Link DNS zone to VNet
az network private-dns zone vnet-link create \
  --resource-group myResourceGroup \
  --zone-name privatelink.postgres.database.azure.com \
  --name myVNetLink \
  --virtual-network myVNet \
  --registration-enabled false

# Create DNS zone group for automatic DNS record creation
az network private-endpoint dns-zone-group create \
  --resource-group myResourceGroup \
  --endpoint-name pg-private-endpoint \
  --name myZoneGroup \
  --private-dns-zone privatelink.postgres.database.azure.com \
  --zone-name postgres
```

### 4.3 Securing Storage Accounts

```
Private DNS Zones needed:
- privatelink.blob.core.windows.net (Blob)
- privatelink.file.core.windows.net (File)
- privatelink.queue.core.windows.net (Queue)
- privatelink.table.core.windows.net (Table)
```

**Security Hardening:**
- Disable public network access after private endpoints are established
- Use NSGs on the private endpoint subnet for additional filtering
- Combine with Azure RBAC (Storage Blob Data Reader/Contributor) for defense-in-depth
- Enable Storage Firewall to restrict access to specific VNets and IPs as an additional layer

### 4.4 Private Endpoints for Key Vault

```bash
# Private endpoint for Key Vault
az network private-endpoint create \
  --name kv-private-endpoint \
  --resource-group myResourceGroup \
  --vnet-name myVNet \
  --subnet keyvault-subnet \
  --private-connection-resource-id /subscriptions/.../Microsoft.KeyVault/vaults/myvault \
  --group-id vault \
  --connection-name kv-connection

# DNS Zone: privatelink.vaultcore.azure.net
```

### 4.5 Cost and Limitations

- Private endpoint: ~$7.30/month per endpoint + $0.01/GB data processed
- Each private endpoint consumes one IP from your subnet
- Maximum 1000 private endpoints per VNet
- Private endpoints do not support NSG rules directly on the endpoint NIC (use NSGs on the source/destination subnets instead)

**Sources:**
- [Private Link for PostgreSQL](https://learn.microsoft.com/en-us/azure/postgresql/flexible-server/concepts-networking-private-link)
- [What is a Private Endpoint?](https://docs.azure.cn/en-us/private-link/private-endpoint-overview)
- [Azure Private Link Guide](http://subnetsavy.com/wp-content/uploads/articles/azure-private-link-guide.html)
- [Add Private Endpoint to PostgreSQL](https://learn.microsoft.com/en-us/azure/postgresql/flexible-server/how-to-networking-servers-deployed-public-access-add-private-endpoint)

---

## 5. Managed Identity

### 5.1 System-Assigned vs. User-Assigned

| Feature | System-Assigned | User-Assigned |
|---------|----------------|---------------|
| Lifecycle | Tied to Azure resource; deleted when resource is deleted | Independent; managed separately |
| Sharing | One per resource, cannot be shared | Can be assigned to multiple resources |
| Use case | Single-resource, 1:1 relationship | Shared identity across multiple resources |
| Management | Automatic with resource lifecycle | Manual creation and assignment required |
| Recommended | Simple scenarios | **Microsoft's recommended type** for production workloads |

**When to use User-Assigned:**
- Multiple App Service slots/instances need the same identity
- Blue-green deployments where identity permissions must persist
- Pre-provisioning permissions before deploying the application
- Shared access pattern across multiple resources (e.g., App Service + Function App accessing same Key Vault)

### 5.2 Passwordless Connections to PostgreSQL

Managed identity authentication to PostgreSQL Flexible Server uses Microsoft Entra tokens instead of passwords. The flow:

```
App Service --> DefaultAzureCredential() --> Entra ID Token --> PostgreSQL (Entra Auth enabled)
```

**Implementation (Node.js/TypeScript):**
```typescript
import { DefaultAzureCredential } from "@azure/identity";
import { Client } from "pg";

async function getConnection() {
  const credential = new DefaultAzureCredential();
  // For user-assigned identity:
  // const credential = new ManagedIdentityCredential("<client-id>");

  const token = await credential.getToken("https://ossrdbms-aad.database.windows.net/.default");

  const client = new Client({
    host: "myserver.postgres.database.azure.com",
    port: 5432,
    user: "managed-identity-name", // The Entra user created in PostgreSQL
    password: token.token,
    database: "peptideplus",
    ssl: { rejectUnauthorized: true }
  });

  await client.connect();
  return client;
}
```

**PostgreSQL Server Setup:**
```sql
-- Enable Entra authentication on the server (Azure CLI)
-- az postgres flexible-server update --name myserver --resource-group myRG --active-directory-auth enabled

-- Create the Entra user in the database
SELECT * FROM pgaadauth_create_principal('managed-identity-name', false, false);

-- Grant permissions
GRANT ALL PRIVILEGES ON DATABASE peptideplus TO "managed-identity-name";
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO "managed-identity-name";
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO "managed-identity-name";
```

**Token Caching:** The `DefaultAzureCredential` from `@azure/identity` handles token caching and refresh automatically. Tokens are typically valid for 1 hour and are refreshed proactively.

### 5.3 Service Connector (Passwordless Helper)

Azure Service Connector simplifies passwordless connections by auto-configuring the managed identity, Entra authentication, and connection strings.

```bash
az webapp connection create postgres-flexible \
  --resource-group myRG \
  --name myApp \
  --target-resource-group myRG \
  --server myserver \
  --database peptideplus \
  --client-type nodejs \
  --system-identity
```

**Sources:**
- [Connect with Managed Identity to PostgreSQL](https://learn.microsoft.com/en-us/azure/postgresql/flexible-server/security-connect-with-managed-identity)
- [Managed Identities for App Service](https://learn.microsoft.com/en-us/azure/app-service/overview-managed-identity)
- [Migrate to Passwordless Connections](https://learn.microsoft.com/en-us/azure/developer/java/spring-framework/migrate-postgresql-to-passwordless-connection)
- [Tutorial: Access Azure Databases with Managed Identity](https://learn.microsoft.com/en-us/azure/app-service/tutorial-connect-msi-azure-database)
- [Service Connector for PostgreSQL](https://learn.microsoft.com/en-us/azure/service-connector/how-to-integrate-postgres)

---

## 6. Microsoft Defender for Cloud

### 6.1 Threat Protection

Microsoft Defender for Cloud provides Cloud Security Posture Management (CSPM) and Cloud Workload Protection Platform (CWPP) capabilities.

**Defender Plans Relevant to Web Apps:**

| Plan | Protection |
|------|-----------|
| Defender for App Service | Runtime threat detection, vulnerability scanning, anomalous request detection |
| Defender for Databases | PostgreSQL/SQL threat detection, vulnerability assessment |
| Defender for Key Vault | Anomalous access patterns, unusual secret access |
| Defender for Storage | Malware scanning, suspicious access patterns |
| Defender for DNS | DNS exfiltration, communication with known malicious domains |
| Defender for Resource Manager | Suspicious management operations |

**Defender for App Service Detection Categories:**
- **Pre-attack:** Vulnerability scanner detection, reconnaissance attempts
- **Initial access:** Connections from known malicious IPs, SSH/FTP brute force
- **Execution:** Suspicious process creation, web shell detection
- **Persistence:** Unauthorized scheduled tasks, startup script modifications
- **Command and Control:** Communication with suspicious external IPs
- **Data exfiltration:** Large data transfers to unusual destinations

### 6.2 Security Score

Two scoring models are now available:

1. **Cloud Secure Score (Risk-based)** -- Available in Microsoft Defender portal; incorporates asset risk factors and criticality for more accurate prioritization
2. **Classic Secure Score** -- Available in Azure portal; percentage-based compliance scoring

**Score Improvement Actions for Web Apps:**
- Enable MFA for all accounts (high impact)
- Enable Defender plans for all services (medium impact)
- Remediate vulnerability findings (varies)
- Enable encryption in transit (medium impact)
- Restrict unauthorized network access (high impact)
- Apply system updates (medium impact)

### 6.3 Vulnerability Assessment

- **Agentless scanning:** Rapid snapshot-based scanning without agent installation
- **Agent-based scanning:** Deeper analysis using Defender Vulnerability Management (MDVM)
- **Container scanning:** Image vulnerability scanning for ACR and AKS
- **Code scanning:** Dependency vulnerability scanning powered by Trivy for GitHub/Azure DevOps repositories
- **SQL vulnerability assessment:** Built-in SQL database scanning for misconfigurations

**Sources:**
- [Defender for App Service](https://learn.microsoft.com/en-us/azure/defender-for-cloud/defender-for-app-service-introduction)
- [App Service Alerts](https://learn.microsoft.com/en-us/azure/defender-for-cloud/alerts-azure-app-service)
- [Cloud Secure Score](https://learn.microsoft.com/en-us/azure/defender-for-cloud/secure-score-security-controls)
- [Vulnerability Assessment with MDVM](https://learn.microsoft.com/en-us/azure/defender-for-cloud/deploy-vulnerability-assessment-defender-vulnerability-management)
- [Azure Vulnerability Management Guide 2026 (SentinelOne)](https://www.sentinelone.com/cybersecurity-101/cybersecurity/azure-vulnerability-management/)
- [Defender for Cloud on Gartner Peer Insights](https://www.gartner.com/reviews/market/cloud-security-posture-management-tools/vendor/microsoft/product/microsoft-defender-for-cloud)

---

## 7. SSL/TLS

### 7.1 Minimum TLS Version

- **TLS 1.2** is the default minimum for new App Service apps
- **TLS 1.3** is fully supported and recommended
- TLS 1.0 and 1.1 are deprecated and should be disabled

```bash
# Enforce minimum TLS 1.2
az webapp config set --name myApp --resource-group myRG --min-tls-version 1.2

# For Storage accounts
az storage account update --name mystorageaccount --min-tls-version TLS1_2
```

**Azure Policy enforcement:**
- Built-in policy: "App Service apps should use the latest TLS version" (Policy ID: `f0e6e85b-9b9f-4a4b-b67b-f730d42f1b0b`)

### 7.2 Certificate Management

**Certificate Sources:**
1. **App Service Managed Certificates (ASMC)** -- Free, auto-issued by DigiCert, auto-renewed
2. **App Service Certificates (ASC)** -- Paid (~$69.99/year), issued by GoDaddy, stored in Key Vault
3. **Custom Certificates** -- Upload your own, stored in Key Vault
4. **Key Vault Certificates** -- Full lifecycle management with auto-renewal

**CRITICAL 2025-2026 Industry Changes:**
- **July 2025:** New ASMC issuance requirements from DigiCert's MPIC migration
- **2026:** Maximum certificate validity reduced to **200 days** (industry-wide)
- **2026:** ASC will automatically issue two overlapping certificates to cover one year
- **2026:** Newly issued certificates will NOT support client authentication EKU (Extended Key Usage)

**Impact on your application:**
- If using client certificate authentication, you must migrate to certificates that support it
- Auto-renewal becomes more frequent due to shorter validity periods
- Monitor certificate expiration proactively via Key Vault alerts

### 7.3 End-to-End Encryption

**Architecture:**
```
Client --> HTTPS (TLS 1.3) --> Front Door/App Gateway --> HTTPS (TLS 1.2+) --> App Service
                                                                             --> Key Vault (TLS 1.2+)
                                                                             --> PostgreSQL (TLS 1.2+ required)
```

**Best Practices:**
- Enforce HTTPS-only on App Service (`az webapp update --https-only true`)
- Configure Application Gateway with end-to-end TLS (re-encrypt to backend)
- Enable `sslmode=require` or `sslmode=verify-full` for PostgreSQL connections
- Use TLS 1.3 cipher suites where possible
- Configure HSTS headers (Strict-Transport-Security) with minimum 1-year max-age

**Application Gateway TLS Policies:**
| Policy | Min TLS | Cipher Suites |
|--------|---------|---------------|
| AppGwSslPolicy20220101 | TLS 1.2 | Modern, AEAD-only |
| AppGwSslPolicy20220101S | TLS 1.2 | Strict, forward secrecy only |
| CustomV2 | Configurable | User-selected |

**Sources:**
- [TLS/SSL in Azure App Service](https://learn.microsoft.com/en-us/azure/app-service/overview-tls)
- [Certificate Management in App Service](https://learn.microsoft.com/en-us/azure/app-service/configure-ssl-certificate)
- [ASMC Changes July 2025](https://learn.microsoft.com/en-us/azure/app-service/app-service-managed-certificate-changes-july-2025)
- [Industry-Wide Certificate Changes](https://techcommunity.microsoft.com/blog/appsonazureblog/industry-wide-certificate-changes-impacting-azure-app-service-certificates/4477924)
- [Enforce Min TLS for Storage](https://learn.microsoft.com/en-us/azure/storage/common/transport-layer-security-configure-minimum-version)
- [Application Gateway TLS Policies](https://learn.microsoft.com/en-us/azure/application-gateway/application-gateway-ssl-policy-overview)

---

## 8. CORS, IP Restrictions, Access Restrictions

### 8.1 CORS Configuration

Cross-Origin Resource Sharing (CORS) controls which domains can make browser requests to your API.

**Best Practices:**
- NEVER use wildcard (`*`) for allowed origins in production
- Explicitly list each allowed origin domain
- Do not allow origins with `http://` -- require HTTPS
- Set appropriate `Access-Control-Max-Age` to reduce preflight requests
- Restrict allowed methods to only what your API supports
- Restrict allowed headers to only what your API requires

**Azure Policy:** "App Service apps should not have CORS configured to allow every resource to access your apps" (Policy ID: `5744710e-cc2f-4ee8-8809-3b11e89f4bc9`)

```bash
# Configure CORS on App Service
az webapp cors add --name myApp --resource-group myRG \
  --allowed-origins "https://peptideplus.com" "https://www.peptideplus.com"
```

**Application-Level CORS (Next.js):**
```typescript
// next.config.js
async headers() {
  return [{
    source: "/api/:path*",
    headers: [
      { key: "Access-Control-Allow-Origin", value: "https://peptideplus.com" },
      { key: "Access-Control-Allow-Methods", value: "GET,POST,PUT,DELETE,OPTIONS" },
      { key: "Access-Control-Allow-Headers", value: "Content-Type,Authorization" },
      { key: "Access-Control-Max-Age", value: "86400" }
    ]
  }];
}
```

### 8.2 IP Restrictions

App Service access restrictions define a priority-ordered allow/deny list controlling network access.

**Types of Restrictions:**
1. **IPv4/IPv6 addresses:** Individual IPs or CIDR ranges
2. **Service Tags:** Named groups of Azure IPs (e.g., `AzureFrontDoor.Backend`)
3. **Virtual Network subnets:** Via service endpoints
4. **HTTP Headers:** Filter by `X-Forwarded-For`, `X-Azure-FDID`, etc.

**Multi-Source Rules:** Combine up to 8 IP ranges or 8 service tags in a single rule.

**Important:** Access restrictions do NOT apply to traffic entering through a Private Endpoint. Private Endpoints have their own access control.

```bash
# Allow only Front Door traffic
az webapp config access-restriction add \
  --name myApp --resource-group myRG \
  --priority 100 \
  --action Allow \
  --service-tag AzureFrontDoor.Backend \
  --http-header x-azure-fdid=<front-door-id>

# Deny all other traffic (implicit if any allow rules exist)
```

### 8.3 SCM Site (Kudu) Restrictions

Configure separate access restrictions for the SCM/Kudu site (deployment endpoint):
- By default, SCM inherits main site restrictions
- Recommended: Restrict SCM to management VNet or specific admin IPs only
- Block public access to SCM entirely if using deployment pipelines from VNet-connected agents

```bash
# Restrict SCM site separately
az webapp config access-restriction add \
  --name myApp --resource-group myRG \
  --priority 100 --action Allow \
  --ip-address 10.0.0.0/24 \
  --scm-site true
```

**Sources:**
- [Set Up Access Restrictions](https://learn.microsoft.com/en-us/azure/app-service/app-service-ip-restrictions)
- [App Service Access Restrictions Overview](https://learn.microsoft.com/en-us/azure/app-service/overview-access-restrictions)
- [Built-in Policy Definitions for App Service](https://learn.microsoft.com/en-us/azure/app-service/policy-reference)
- [Enable IP Restriction for Public App Service](https://techcommunity.microsoft.com/blog/azureinfrastructureblog/enable-ip-restriction-for-a-public-facing-app-service/4276342)

---

## 9. Azure Policy

### 9.1 Overview

Azure Policy enforces organizational standards and assesses compliance at scale. Policies are evaluated in real-time during resource creation/modification and on a regular compliance scan.

**Policy Types:**
- **Built-in Policies:** Pre-built by Microsoft, cover common security/compliance scenarios
- **Custom Policies:** Organization-specific rules written in JSON
- **Policy Initiatives (Sets):** Groups of related policies applied together

### 9.2 Critical Built-in Policies for Web Apps

| Policy | Effect | Description |
|--------|--------|-------------|
| App Service apps should use latest TLS version | AuditIfNotExists | Enforces TLS 1.2+ |
| App Service apps should use managed identity | AuditIfNotExists | Detects apps without managed identity |
| App Service apps should use HTTPS | Audit | Flags HTTP-accessible apps |
| CORS should not allow every resource to access your apps | AuditIfNotExists | Blocks wildcard CORS |
| Remote debugging should be turned off | AuditIfNotExists | Remote debug is a security risk |
| App Service apps should have resource logs enabled | AuditIfNotExists | Ensures diagnostic logging |
| App Service apps should not have CORS wildcard | AuditIfNotExists | Prevents * origin |
| Private endpoint should be enabled for PostgreSQL | AuditIfNotExists | Enforces private connectivity |
| Key Vault should use RBAC | Audit | Enforces RBAC over access policies |
| Storage accounts should use private link | AuditIfNotExists | Ensures private storage access |

### 9.3 Regulatory Compliance Initiatives

Pre-built initiative packages for compliance frameworks:
- **Microsoft Cloud Security Benchmark (MCSB)** -- Microsoft's own comprehensive benchmark
- **CIS Microsoft Azure Foundations Benchmark 2.0**
- **NIST SP 800-53 Rev. 5**
- **ISO 27001:2013**
- **PCI DSS v4.0**
- **HIPAA HITRUST 9.2**
- **SOC 2 Type 2**
- **Canada Federal PBMM**
- **Australian Government ISM PROTECTED**

### 9.4 Policy as Code

Store policies in Git, deploy via CI/CD:
```bash
# Export existing policy assignments
az policy assignment list --query "[].{name:name, policy:policyDefinitionId}" -o table

# Deploy policy assignment via Bicep/ARM
az deployment group create --template-file policies.bicep --resource-group myRG
```

**2025 Updates:**
- **Service Groups:** New grouping construct to optimize cross-subscription management
- **Policy as Code:** Enhanced CI/CD integration for policy management
- **Windows Server 2025 Security Baseline:** 300+ security settings

**Sources:**
- [Azure Policy Overview](https://learn.microsoft.com/en-us/azure/governance/policy/overview)
- [App Service Regulatory Compliance Controls](https://learn.microsoft.com/en-us/azure/app-service/security-controls-policy)
- [Azure Policy Built-in Definitions Index](https://learn.microsoft.com/en-us/azure/governance/policy/samples/)
- [Azure Policy Regulatory Compliance - MCSB](https://learn.microsoft.com/en-us/azure/governance/policy/samples/azure-security-benchmark)
- [Everything New in Azure Governance - Build 2025](https://techcommunity.microsoft.com/blog/azuregovernanceandmanagementblog/everything-new-in-azure-governance--build-2025/4415414)
- [Top Azure Security Best Practices & Checklists 2026 (SentinelOne)](https://www.sentinelone.com/cybersecurity-101/cloud-security/azure-security-best-practices/)

---

## 10. Secret Rotation and Certificate Auto-Renewal

### 10.1 Key Rotation

Azure Key Vault supports automatic cryptographic key rotation with configurable policies.

**Rotation Policy Configuration:**
```bash
az keyvault key rotation-policy update --vault-name myVault --name myKey \
  --value '{
    "lifetimeActions": [{
      "trigger": {"timeBeforeExpiry": "P30D"},
      "action": {"type": "Rotate"}
    }, {
      "trigger": {"timeBeforeExpiry": "P7D"},
      "action": {"type": "Notify"}
    }],
    "attributes": {"expiryTime": "P90D"}
  }'
```

**Constraints:**
- Minimum rotation interval: 7 days from creation
- Minimum notification interval: 7 days before expiration
- Rotation creates a new key version; old version remains available

### 10.2 Secret Rotation Strategies

Azure Key Vault does NOT have built-in secret rotation. You must implement rotation using one of these patterns:

**Pattern 1: Event Grid + Function App (Recommended)**
```
Key Vault (Near Expiry Event) --> Event Grid --> Azure Function (rotate secret) --> Key Vault (new version)
                                                                                --> Target Service (update credential)
```

**Pattern 2: Dual-Credential Rotation**
For services with two sets of credentials (e.g., Storage account keys):
1. Function detects near-expiry event for key1
2. Regenerates key2 on the target service
3. Stores key2 as new active secret in Key Vault
4. Later, regenerates key1 when key2 approaches expiry

**Pattern 3: Eliminate Secrets Entirely (Best)**
- Use managed identities for passwordless connections
- Use workload identity federation for external services
- Use certificate-based authentication instead of shared secrets

### 10.3 Certificate Auto-Renewal

**Key Vault Certificate Lifecycle:**
1. Key Vault can request certificates from integrated CAs (DigiCert, GlobalSign)
2. Configure auto-renewal at X% of lifetime (default: 80%)
3. Key Vault handles CSR generation, submission, and installation
4. Notifications via Event Grid when certificates are renewed or about to expire

**For App Service Managed Certificates:**
- Auto-renewed by Azure automatically
- Post-July 2025: New MPIC validation requirements may cause renewal failures for certain DNS configurations
- Monitor renewal status via App Service certificate health alerts

**For App Service Certificates (ASC):**
- Stored in Key Vault, auto-renewed 45 days before expiration
- Sync to App Service via Key Vault certificate binding
- In 2026: Two overlapping certificates will be issued per year due to 200-day max validity

**Monitoring Rotation:**
```bash
# Set up near-expiry alert
az keyvault set-policy --name myVault --spn <event-grid-sp> --secret-permissions get list

# Create Event Grid subscription for near-expiry
az eventgrid event-subscription create \
  --source-resource-id /subscriptions/.../Microsoft.KeyVault/vaults/myVault \
  --name secret-expiry-handler \
  --endpoint https://myfunction.azurewebsites.net/api/rotate \
  --included-event-types Microsoft.KeyVault.SecretNearExpiry
```

**Sources:**
- [Understanding Autorotation in Key Vault](https://learn.microsoft.com/en-us/azure/key-vault/general/autorotation)
- [Configure Key Auto-Rotation](https://learn.microsoft.com/en-us/azure/key-vault/keys/how-to-configure-key-rotation)
- [Certificate Rotation Tutorial](https://learn.microsoft.com/en-us/azure/key-vault/certificates/tutorial-rotate-certificates)
- [Dual Credential Rotation Tutorial](https://learn.microsoft.com/en-us/azure/key-vault/secrets/tutorial-rotation-dual)
- [How to Automate Key Rotation (TechTarget)](https://www.techtarget.com/searchcloudcomputing/tutorial/How-to-perform-and-automate-key-rotation-in-Azure-Key-Vault)

---

## 11. Logging and Auditing

### 11.1 Azure Monitor

Azure Monitor is the central observability platform that collects, analyzes, and acts on telemetry from Azure resources.

**Data Types:**
- **Metrics:** Time-series numerical data (CPU, memory, request count, latency)
- **Logs:** Structured event data stored in Log Analytics workspaces
- **Traces:** Distributed traces for request flow analysis (via Application Insights)
- **Activity Logs:** Control plane operations (who created/modified/deleted what)

**Diagnostic Settings for Web Apps:**
```bash
# Enable diagnostic logging for App Service
az monitor diagnostic-settings create \
  --name app-diagnostics \
  --resource /subscriptions/.../Microsoft.Web/sites/myApp \
  --workspace /subscriptions/.../Microsoft.OperationalInsights/workspaces/myWorkspace \
  --logs '[
    {"category": "AppServiceHTTPLogs", "enabled": true},
    {"category": "AppServiceConsoleLogs", "enabled": true},
    {"category": "AppServiceAppLogs", "enabled": true},
    {"category": "AppServiceAuditLogs", "enabled": true},
    {"category": "AppServiceIPSecAuditLogs", "enabled": true},
    {"category": "AppServicePlatformLogs", "enabled": true},
    {"category": "AppServiceAntivirusScanAuditLogs", "enabled": true}
  ]'
```

**Key Log Categories for Security:**

| Category | Contains |
|----------|----------|
| AppServiceHTTPLogs | All HTTP requests with status codes, IPs, user agents |
| AppServiceAuditLogs | Login/authentication events |
| AppServiceIPSecAuditLogs | IP restriction rule matches (allow/deny) |
| AppServiceAntivirusScanAuditLogs | Antivirus scan results |
| AppServicePlatformLogs | Container/platform operations |

### 11.2 Microsoft Sentinel (SIEM/SOAR)

Microsoft Sentinel is a cloud-native Security Information and Event Management (SIEM) and Security Orchestration, Automation and Response (SOAR) solution.

**Data Connectors for Web App Security:**
- Azure Activity Logs
- Microsoft Entra ID sign-in and audit logs
- Microsoft Defender for Cloud alerts
- Azure Key Vault diagnostic logs
- Azure SQL/PostgreSQL audit logs
- Azure Web Application Firewall logs
- Custom application logs (via Log Analytics)

**Key Detection Scenarios:**
```kusto
// Detect failed login attempts from multiple IPs (brute force)
SigninLogs
| where ResultType != "0"
| summarize FailureCount = count(), IPs = make_set(IPAddress) by UserPrincipalName, bin(TimeGenerated, 1h)
| where FailureCount > 10
| where array_length(IPs) > 3

// Detect unusual Key Vault access
AzureDiagnostics
| where ResourceProvider == "MICROSOFT.KEYVAULT"
| where OperationName == "SecretGet"
| summarize AccessCount = count() by CallerIPAddress, bin(TimeGenerated, 1h)
| where AccessCount > 100

// Detect WAF blocks
AzureDiagnostics
| where ResourceProvider == "MICROSOFT.NETWORK"
| where Category == "ApplicationGatewayFirewallLog"
| where action_s == "Blocked"
| summarize BlockCount = count() by ruleId_s, clientIp_s, bin(TimeGenerated, 1h)
```

**Automated Response (Playbooks):**
- Block malicious IPs via NSG rules
- Disable compromised user accounts
- Rotate compromised secrets
- Send alerts to Security Operations team
- Create incidents in ticketing systems

### 11.3 Application Insights

Application Insights provides application performance monitoring (APM) with security-relevant telemetry:
- Request telemetry (all HTTP requests with timing)
- Dependency telemetry (database calls, external API calls)
- Exception telemetry (unhandled errors, which may indicate attacks)
- Custom events (login attempts, authorization failures)
- Live metrics stream for real-time monitoring

### 11.4 Audit Best Practices

1. Send ALL diagnostic logs to a central Log Analytics workspace
2. Configure retention policies (minimum 90 days, recommended 1 year for compliance)
3. Use Azure Monitor Alerts for critical security events
4. Enable resource locks on Log Analytics workspaces to prevent deletion
5. Use immutable storage for compliance-critical audit logs
6. Configure cross-workspace queries for multi-subscription environments
7. Implement custom Sentinel analytics rules for application-specific threats

**Sources:**
- [Azure Security Logging and Auditing](https://learn.microsoft.com/en-us/azure/security/fundamentals/log-audit)
- [Audit Microsoft Sentinel](https://learn.microsoft.com/en-us/azure/sentinel/audit-sentinel-data)
- [Logging and Monitoring Security Control](https://learn.microsoft.com/en-us/security/benchmark/azure/security-control-logging-monitoring)
- [Sentinel Audit Logs](https://techcommunity.microsoft.com/blog/microsoftsentinelblog/microsoft-sentinel-platform-audit-logs-and-where-to-find-them/4481838)
- [Secure Your Azure Monitor Deployment](https://learn.microsoft.com/en-us/azure/azure-monitor/fundamentals/best-practices-security)

---

## 12. OWASP Top 10 Protections

### 12.1 OWASP Top 10:2025

The OWASP Top 10 was updated in 2025 with significant changes from the 2021 edition:

| Rank 2025 | Category | Change from 2021 |
|-----------|----------|-------------------|
| 1 | Broken Access Control | Same (#1) |
| 2 | Cryptographic Failures | Same (#2) |
| 3 | Injection (includes XSS) | Down from #3 (broadened) |
| 4 | Insecure Design | Same (#4) |
| 5 | Security Misconfiguration | Down from #5 |
| 6 | Vulnerable and Outdated Components | Same (#6) |
| 7 | Identification and Authentication Failures | Same (#7) |
| 8 | Software and Data Integrity Failures | Same (#8) |
| 9 | Security Logging and Monitoring Failures | Same (#9) |
| 10 | Server-Side Request Forgery (SSRF) | Same (#10) |

### 12.2 Azure Protections by OWASP Category

**A01: Broken Access Control**
- Azure RBAC for resource-level access control
- Entra ID Conditional Access for user access decisions
- App Service Authentication (EasyAuth) for built-in authentication
- Custom authorization middleware in application code
- Managed Identity for service-to-service authentication (no credential exposure)

**A02: Cryptographic Failures**
- Key Vault for centralized key management with HSM backing
- TLS 1.2+ enforcement across all services
- Azure Disk Encryption for data at rest
- Storage Service Encryption (SSE) with customer-managed keys
- Always Encrypted for PostgreSQL/SQL column-level encryption

**A03: Injection (SQL Injection, XSS, Command Injection)**
- Azure WAF DRS 2.2 rules specifically targeting SQL injection and XSS patterns
- Parameterized queries at the application level (Prisma, Knex, pg with parameters)
- Content Security Policy (CSP) headers via application middleware
- Input validation and output encoding in Next.js/React (JSX auto-escapes by default)

**Application-Level Protection (Next.js):**
```typescript
// Content Security Policy header
const cspHeader = `
  default-src 'self';
  script-src 'self' 'nonce-${nonce}';
  style-src 'self' 'unsafe-inline';
  img-src 'self' blob: data:;
  font-src 'self';
  object-src 'none';
  base-uri 'self';
  form-action 'self';
  frame-ancestors 'none';
  upgrade-insecure-requests;
`;
```

**A04: Insecure Design**
- Azure Well-Architected Framework security pillar
- Threat modeling with Microsoft Threat Modeling Tool
- Security design reviews using Azure Architecture Center patterns
- Defense-in-depth layering (WAF + NSG + Private Endpoints + RBAC)

**A05: Security Misconfiguration**
- Azure Policy for configuration enforcement
- Defender for Cloud recommendations for misconfiguration detection
- Azure Advisor security recommendations
- Environment-specific configurations (dev vs. prod) via App Configuration
- Disable unnecessary features (remote debugging, FTP, HTTP 2.0 if not needed)

**A06: Vulnerable and Outdated Components**
- Defender for Cloud dependency scanning (Trivy-powered)
- GitHub Dependabot / Azure DevOps dependency scanning
- npm audit / yarn audit in CI/CD pipelines
- Azure Container Registry vulnerability scanning
- Regular framework and runtime updates

**A07: Identification and Authentication Failures**
- Entra ID for enterprise authentication
- Multi-factor authentication enforcement
- Token validation with MSAL library
- Session management with secure cookie attributes
- Rate limiting on authentication endpoints
- Account lockout policies in Entra ID

**A08: Software and Data Integrity Failures**
- Signed container images
- Azure DevOps/GitHub Actions pipeline security (protected branches, required reviews)
- npm/yarn integrity verification (package-lock.json)
- Subresource Integrity (SRI) for CDN-loaded scripts

**A09: Security Logging and Monitoring Failures**
- Azure Monitor + Log Analytics for centralized logging
- Microsoft Sentinel for threat detection and response
- Application Insights for application-level monitoring
- WAF logs for attack visibility
- Alerting via Azure Monitor Action Groups

**A10: Server-Side Request Forgery (SSRF)**
- Azure WAF rules for SSRF detection
- Private endpoints to prevent SSRF from reaching internal services
- URL validation and allowlisting in application code
- Disable metadata endpoint access from application containers where possible
- Network segmentation via NSGs

### 12.3 CSRF Protection

CSRF is not in the OWASP Top 10 as a standalone category but remains critical:

**Azure/Application-Level Protections:**
- `SameSite=Strict` or `SameSite=Lax` cookie attribute
- Anti-CSRF tokens (built into most frameworks)
- CORS restriction to specific origins
- Custom request headers requirement (e.g., `X-Requested-With`)
- Verify `Origin` and `Referer` headers server-side

**Sources:**
- [OWASP Top 10:2025](https://owasp.org/Top10/2025/en/)
- [WAF CRS and DRS Rule Groups](https://learn.microsoft.com/en-us/azure/web-application-firewall/ag/application-gateway-crs-rulegroups-rules)
- [CSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)
- [Enhancing Cloud Reliability with Azure WAF 2025](https://evokehub.com/enhancing-cloud-reliability-azure-web-application-firewall-in-2025/)
- [OWASP Top 10 2025 vs 2021 Comparison (Equixly)](https://equixly.com/blog/2025/12/01/owasp-top-10-2025-vs-2021/)

---

## 13. Azure Security Benchmark v3

### 13.1 Overview

The Azure Security Benchmark (ASB) v3 -- now evolving into the **Microsoft Cloud Security Benchmark (MCSB) v2** -- provides prescriptive best practices and recommendations for improving the security of workloads, data, and services on Azure.

### 13.2 Control Domains

| ID | Domain | Key Controls |
|----|--------|-------------|
| NS | Network Security | Network segmentation, private access, WAF, DDoS, firewall |
| IM | Identity Management | Centralized identity, managed identity, MFA, Conditional Access |
| PA | Privileged Access | Admin workstations, JIT access, emergency access accounts |
| DP | Data Protection | Encryption at rest/transit, key management, data classification |
| AM | Asset Management | Inventory, vulnerability management, configuration management |
| LT | Logging and Threat Detection | Security logging, threat detection, SIEM integration |
| IR | Incident Response | Preparation, detection, containment, recovery |
| PV | Posture and Vulnerability Management | Security posture, vulnerability scanning, remediation |
| ES | Endpoint Security | EDR, anti-malware, patch management |
| BR | Backup and Recovery | Backup automation, validation, protection |
| DS | DevOps Security | Pipeline security, code scanning, infrastructure as code scanning |
| GS | Governance and Strategy | Risk management, security architecture, roles and responsibilities |
| AI | AI Security | (New in MCSB v2) AI workload controls |

### 13.3 Key Controls for Web Applications

**NS-1: Establish network segmentation boundaries**
- Isolate web tier, application tier, and data tier in separate subnets
- Use NSGs between tiers; only allow necessary ports/protocols

**NS-2: Secure cloud services with network controls**
- Enable Private Link for all PaaS services (PostgreSQL, Key Vault, Storage)
- Disable public network access where possible

**NS-6: Deploy web application firewall**
- Deploy Azure WAF in Prevention mode
- Use DRS 2.2 or later rule sets
- Configure custom rules for application-specific threats

**IM-1: Use centralized identity and authentication system**
- Use Entra ID as the sole identity provider
- Disable local authentication on all Azure services

**IM-3: Manage application identities securely**
- Use managed identities for all Azure-to-Azure communication
- Eliminate stored credentials wherever possible

**DP-3: Encrypt sensitive data in transit**
- Enforce TLS 1.2+ on all endpoints
- Enable HTTPS-only on App Service

**DP-4: Enable data at rest encryption by default**
- Use platform-managed or customer-managed encryption keys
- Enable Transparent Data Encryption on databases

**LT-1: Enable threat detection capabilities**
- Enable Defender for Cloud on all subscriptions
- Enable Defender for App Service, Databases, Key Vault, Storage

**DS-6: Enforce security of workload throughout DevOps lifecycle**
- Implement security scanning in CI/CD (SAST, DAST, dependency scanning)
- Use signed commits and protected branches

### 13.4 Policy Mappings

Each MCSB control maps to Azure Policy definitions for automated assessment:
```bash
# Assign MCSB initiative
az policy assignment create \
  --name "MCSB-Assignment" \
  --policy-set-definition "1f3afdf9-d0c9-4c3d-847f-89da613e70a8" \
  --scope /subscriptions/<subscription-id>
```

**Sources:**
- [Azure Security Benchmark v3 Overview](https://learn.microsoft.com/en-us/security/benchmark/azure/overview-v3)
- [MCSB v2 Overview](https://learn.microsoft.com/en-us/security/benchmark/azure/overview)
- [ASB v3 Network Security](https://learn.microsoft.com/en-us/security/benchmark/azure/security-controls-v3-network-security)
- [ASB v3 DevOps Security](https://learn.microsoft.com/en-us/security/benchmark/azure/security-controls-v3-devops-security)
- [MCSB v2 Posture and Vulnerability Management](https://learn.microsoft.com/en-us/security/benchmark/azure/mcsb-v2-posture-vulnerability-management)

---

## 14. Zero Trust Architecture

### 14.1 Core Principles

Microsoft's Zero Trust model is based on three principles:

1. **Verify explicitly:** Authenticate and authorize every access request based on all available data points (user identity, location, device health, service/workload, data classification, anomalies)
2. **Use least privilege access:** Limit user access with JIT/JIA (Just-In-Time/Just-Enough-Access), risk-based adaptive policies, and data protection
3. **Assume breach:** Minimize blast radius, segment access, verify end-to-end encryption, use analytics for visibility and threat detection

### 14.2 Zero Trust Web Application Architecture on Azure

```
                                    +-----------------+
                                    | Microsoft       |
                                    | Entra ID        |
                                    | (Verify every   |
                                    |  identity)      |
                                    +--------+--------+
                                             |
                                    Conditional Access
                                    MFA + Device Compliance
                                             |
Internet --> Azure Front Door -----> Azure Application --> App Service
             (WAF + DDoS)            Gateway              (VNet Integrated)
             (Global L7 LB)         (Regional L7 LB)          |
                                    (End-to-end TLS)     +----+----+
                                                         |         |
                                                    Key Vault   PostgreSQL
                                                    (Private    (Private
                                                     Endpoint)   Endpoint)
                                                         |
                                                    All via Managed Identity
                                                    (Zero stored credentials)
```

### 14.3 Implementation Pillars

**Identity Zero Trust:**
- Entra ID as centralized identity provider
- Conditional Access evaluating user, device, location, risk, application
- Continuous access evaluation (CAE) for real-time session revocation
- Privileged Identity Management (PIM) for time-limited admin access
- Workload identity federation for external CI/CD (GitHub Actions)

**Network Zero Trust:**
- Micro-segmentation with NSGs and Azure Firewall
- Private Endpoints for all PaaS services (eliminate public endpoints)
- VNet Integration for App Service outbound traffic
- Azure Front Door as the single entry point with WAF
- No direct internet access for backend services
- East-west traffic inspection with Azure Firewall

**Data Zero Trust:**
- Encryption at rest with customer-managed keys (CMK)
- Encryption in transit with TLS 1.3
- Data classification and labeling with Microsoft Purview
- Data Loss Prevention (DLP) policies
- Database access exclusively through managed identity

**Device Zero Trust:**
- Intune device compliance as Conditional Access condition
- Only compliant/hybrid-joined devices can access management surfaces
- Certificate-based authentication for IoT/device scenarios

**Application Zero Trust:**
- Application-level authentication and authorization
- Token validation on every API call
- Input validation and output encoding
- Runtime protection via Defender for App Service
- Regular penetration testing and vulnerability scanning

### 14.4 Quantum-Safe Considerations (2026+)

Organizations implementing Zero Trust in 2026 should begin planning for:
- Post-quantum cryptography migration (NIST PQC standards finalized 2024)
- Crypto-agility in application design (ability to swap algorithms without major refactoring)
- Inventory of all cryptographic dependencies
- Azure Key Vault HSM support for quantum-resistant algorithms (expected in future updates)

**Sources:**
- [Zero Trust Security in Azure](https://learn.microsoft.com/en-us/azure/security/fundamentals/zero-trust)
- [Building Zero Trust Web Application in Azure (Festive Tech Calendar 2025)](https://allazureblog.wordpress.com/2025/12/05/building-a-zero-trust-web-application-architecture-in-azure/)
- [Apply Zero Trust to Azure Services](https://learn.microsoft.com/en-us/security/zero-trust/apply-zero-trust-azure-services-overview)
- [Zero Trust with Azure Firewall and Application Gateway](https://learn.microsoft.com/en-us/azure/architecture/example-scenario/gateway/application-gateway-before-azure-firewall)
- [Implementing Zero Trust in Azure (MS Cloud Bros)](https://www.mscloudbros.com/2025/09/05/implementing-zero-trust-architecture-in-azure-security/)
- [Microsoft Zero Trust Strategy](https://www.microsoft.com/en-us/security/business/zero-trust)
- [Zero Trust Architecture 2026 Guide](https://www.live-laugh-love.world/blog/zero-trust-architecture-implementation-guide-2026/)

---

## 15. Comparison with AWS/GCP

### 15.1 Identity and Access Management

| Capability | Azure | AWS | GCP |
|-----------|-------|-----|-----|
| Identity Provider | Entra ID | IAM + Identity Center | Cloud IAM + Cloud Identity |
| MFA | Entra ID MFA + Conditional Access | IAM MFA + AWS SSO | Cloud Identity MFA |
| Managed Identity | Managed Identity | IAM Roles for Services | Service Account + Workload Identity |
| Conditional Access | Entra Conditional Access | IAM Conditions + SCP | IAM Conditions + BeyondCorp |
| Privileged Access | PIM (JIT) | AWS SSO + Permission Sets | PAM (Privileged Access Manager) |
| External Identity | Entra External ID (B2C) | Cognito | Identity Platform |

**Azure advantage:** Deep integration with Microsoft 365 and Active Directory. Most comprehensive conditional access with device compliance.
**AWS advantage:** Longest track record, most mature cross-account role assumption model.
**GCP advantage:** BeyondCorp zero-trust access, global IAM without regional boundaries.

### 15.2 Network Security

| Capability | Azure | AWS | GCP |
|-----------|-------|-----|-----|
| Firewall | Azure Firewall (L3-L7) | AWS Network Firewall / WAF | Cloud Armor + Cloud Firewall |
| WAF | Azure WAF (App GW / Front Door) | AWS WAF (CloudFront / ALB) | Cloud Armor |
| DDoS | DDoS Protection (Network/IP) | Shield (Standard/Advanced) | Cloud Armor (Adaptive) |
| VPC/VNet | Regional VNets | Regional VPCs | Global VPCs |
| Private Connectivity | Private Link/Endpoints | PrivateLink/Endpoints | Private Service Connect |
| NSG/Security Groups | NSGs (subnet/NIC level) | Security Groups (instance level) | VPC Firewall Rules |
| CDN | Front Door / Azure CDN | CloudFront | Cloud CDN |

**Azure advantage:** Azure Front Door provides integrated CDN + WAF + DDoS in a single service. Azure Firewall Premium includes IDPS and TLS inspection natively.
**AWS advantage:** AWS Shield Advanced includes DDoS cost protection and dedicated response team. CloudFront has the largest CDN edge network.
**GCP advantage:** Global VPC simplifies multi-region networking. Cloud Armor has built-in adaptive protection and ML-based threat detection.

### 15.3 Secrets and Key Management

| Capability | Azure | AWS | GCP |
|-----------|-------|-----|-----|
| Secrets Manager | Key Vault | Secrets Manager + SSM Parameter Store | Secret Manager |
| KMS | Key Vault (Keys) | KMS + CloudHSM | Cloud KMS + Cloud HSM |
| Auto-Rotation | Key rotation (built-in), Secret rotation (Event Grid + Functions) | Built-in automatic rotation | Automatic rotation via Cloud Functions |
| HSM | Key Vault Premium (FIPS 140-2 L3) | CloudHSM (FIPS 140-2 L3) | Cloud HSM (FIPS 140-2 L3) |

**Azure advantage:** Unified vault for secrets, keys, and certificates. Key Vault references in App Service for zero-code secret injection.
**AWS advantage:** Secrets Manager has built-in rotation for RDS, Redshift, DocumentDB without custom code.
**GCP advantage:** Secret Manager has simpler pricing and native Terraform/Pulumi integration.

### 15.4 Threat Detection and SIEM

| Capability | Azure | AWS | GCP |
|-----------|-------|-----|-----|
| SIEM | Microsoft Sentinel | Amazon Security Lake + OpenSearch | Chronicle SIEM |
| Threat Detection | Defender for Cloud | GuardDuty | Security Command Center |
| CSPM | Defender CSPM | Security Hub | Security Command Center |
| Vulnerability Scanning | MDVM + Qualys/Trivy | Inspector | Web Security Scanner |
| Runtime Protection | Defender for App Service | GuardDuty Runtime Monitoring | Container Threat Detection |

**Azure advantage:** Sentinel is deeply integrated with Microsoft's threat intelligence. Multi-cloud CSPM (covers AWS and GCP too).
**AWS advantage:** GuardDuty is simple to enable and provides immediate value with minimal configuration.
**GCP advantage:** Chronicle offers petabyte-scale SIEM with Google's threat intelligence. BeyondCorp Enterprise for zero-trust access.

### 15.5 Compliance and Certifications

| Certification | Azure | AWS | GCP |
|--------------|-------|-----|-----|
| FedRAMP High | Yes | Yes | Yes |
| ISO 27001 | Yes | Yes | Yes |
| SOC 2 Type II | Yes | Yes | Yes |
| PCI DSS | Yes | Yes | Yes |
| HIPAA | Yes (BAA) | Yes (BAA) | Yes (BAA) |
| Government Cloud | Azure Government (IL5/IL6) | GovCloud (IL5) | Assured Workloads |
| Data Sovereignty | EU Data Boundary (2024) | European Sovereign Cloud (2026) | Sovereign Controls |

**Azure advantage:** Most government certifications globally, particularly strong in US DoD (IL5/IL6) and EU government. EU Data Boundary completed in 2024.
**AWS advantage:** Longest compliance track record. GovCloud has the most mature isolation model.
**GCP advantage:** Default encryption for all data. Confidential Computing with custom silicon.

### 15.6 Encryption

| Feature | Azure | AWS | GCP |
|---------|-------|-----|-----|
| Encryption at rest | Default (platform-managed keys) | Default (S3, EBS, etc.) | Default (all services) |
| Customer-managed keys | Key Vault CMK | KMS CMK | Cloud KMS CMEK |
| Client-side encryption | Azure SDK support | AWS SDK support | Tink library |
| Default encrypt in transit | Configurable (enforce TLS) | Configurable | Default for most services |
| Confidential Computing | Azure Confidential Computing (DCsv3, SGX/SEV) | Nitro Enclaves | Confidential VMs (AMD SEV) |

**GCP advantage:** Encrypts all data at rest AND in transit by default across all services -- no configuration needed.

**Sources:**
- [AWS vs Azure vs Google Cloud 2026 (Cloudwards)](https://www.cloudwards.net/aws-vs-azure-vs-google/)
- [Cloud Security Comparison (Pluralsight)](https://www.pluralsight.com/resources/blog/cloud/cloud-security-comparison-aws-vs-azure-vs-gcp)
- [Top Cloud Service Providers 2026 (EC-Council)](https://www.eccouncil.org/cybersecurity-exchange/cloud-security/biggest-cloud-service-providers/)
- [AWS vs Azure vs Google Cloud Comparison (PilotCore)](https://pilotcore.io/blog/aws-vs-azure-vs-google-cloud-comparison)
- [Choosing the Right Cloud Platform 2026 (Kanerika)](https://kanerika.com/blogs/aws-vs-azure-vs-google-cloud/)

---

## 16. Recent CVEs and Vulnerability Intelligence

### 16.1 Critical Azure CVEs (2025)

| CVE | CVSS | Component | Description | Status |
|-----|------|-----------|-------------|--------|
| CVE-2025-55241 | 10.0 | Azure Entra ID (Azure AD Graph API) | Elevation of privilege; could create impersonation tokens for cross-tenant access, potentially authenticating as any user including global admins | Mitigated at platform level |
| CVE-2025-29813 | 10.0 | Azure DevOps Pipelines | Pipeline job token hijacking; attackers could swap short-term tokens for long-term ones | Mitigated at platform level |
| CVE-2025-29827 | 9.9 | Azure Automation | Improper authorization allowing privilege escalation across a network | Mitigated at platform level |
| CVE-2025-29972 | 9.9 | Azure Storage Resource Provider | SSRF vulnerability allowing spoofing attacks via crafted requests | Mitigated at platform level |
| CVE-2025-49752 | Critical | Azure Bastion | Authentication bypass allowing remote privilege escalation | Mitigated at platform level |
| CVE-2025-3928 | High | Commvault on Azure | Web server vulnerability exploited in the wild (Commvault, not Azure itself) | Patch available |

### 16.2 Key Takeaways

1. **Platform-level mitigations:** Microsoft mitigated all critical Azure-native CVEs at the platform level before public disclosure -- no customer action was required. This demonstrates the shared responsibility model: Microsoft secures the infrastructure.

2. **Identity is the primary attack surface:** The most critical CVEs (Entra ID, DevOps tokens) target identity and authentication systems. This reinforces the importance of:
   - Monitoring Entra ID sign-in logs
   - Using Conditional Access to limit token usage
   - Implementing MCSB identity controls

3. **SSRF remains a persistent threat:** CVE-2025-29972 (Azure Storage SSRF) and the continued OWASP Top 10 ranking of SSRF (A10) show this category requires application-level defenses in addition to platform protections.

4. **Supply chain risks:** The Commvault breach on Azure infrastructure highlights third-party software risk. Use Defender for Cloud to scan all deployed software.

### 16.3 Proactive Vulnerability Management

```bash
# Enable Azure Service Health notifications
az account get-access-token # Verify access

# Subscribe to Azure Security Advisories
# Via Azure Portal: Service Health > Security Advisories

# Check CVE database programmatically
# https://www.cve.org/CVERecord/SearchResults?query=azure
```

**Sources:**
- [CVE Search Results for Azure](https://www.cve.org/CVERecord/SearchResults?query=azure)
- [Critical Azure and Power Apps Vulnerabilities (GBHackers)](https://gbhackers.com/critical-azure-and-power-apps-vulnerabilities/)
- [Azure Bastion CVE-2025-49752 (ZeroPath)](https://zeropath.com/blog/azure-bastion-cve-2025-49752)
- [Azure Entra ID Flaw (Dark Reading)](https://www.darkreading.com/cloud-security/critical-azure-entra-id-flaw-microsoft-iam-issues)
- [Commvault Azure Breach (AmpCus Cyber)](https://www.ampcuscyber.com/shadowopsintel/commvault-azure-environment-breach-and-cve-2025-3928-exploitation/)
- [Azure Service Health Communications](https://azure.microsoft.com/en-us/blog/understanding-service-health-communications-for-azure-vulnerabilities/)

---

## 17. Compliance Frameworks (NIST/ISO)

### 17.1 ISO 27001 on Azure

Microsoft Azure is ISO/IEC 27001 certified for its core infrastructure. The 2022 update added **Control A 5.23** specifically for cloud services, requiring policies for acquiring, using, managing, and retiring cloud services.

**13 Effective Azure Controls for ISO 27001:**
1. **Identity & Access:** Entra ID + RBAC + Conditional Access + MFA
2. **Encryption:** Key Vault + TLS 1.2+ + SSE with CMK
3. **Network Security:** NSGs + Azure Firewall + Private Endpoints
4. **Monitoring:** Azure Monitor + Sentinel + Defender for Cloud
5. **Incident Response:** Sentinel playbooks + automated remediation
6. **Asset Management:** Azure Resource Graph + tagging + policy
7. **Backup & Recovery:** Azure Backup + geo-redundant storage
8. **Change Management:** Azure DevOps/GitHub + protected branches + IaC
9. **Physical Security:** Microsoft data center security (inherited)
10. **Supplier Management:** Azure Policy + Defender for Cloud multi-cloud
11. **Business Continuity:** Availability Zones + Traffic Manager + Front Door
12. **Vulnerability Management:** Defender CSPM + MDVM + dependency scanning
13. **Audit & Compliance:** Azure Policy compliance dashboard + regulatory initiatives

**Complementary Standards:**
- **ISO 27017:** Cloud-specific security controls (multi-tenancy, data isolation)
- **ISO 27018:** Personal data protection in public clouds (GDPR alignment)
- **ISO 27701:** Privacy information management (PIMS)

### 17.2 NIST Frameworks on Azure

**NIST CSF 2.0 (February 2024):**
Six functions: Govern, Identify, Protect, Detect, Respond, Recover

| NIST CSF 2.0 Function | Azure Implementation |
|----------------------|---------------------|
| Govern | Azure Policy + Management Groups + RBAC hierarchy |
| Identify | Azure Resource Graph + Defender CSPM + asset inventory |
| Protect | Entra ID + Key Vault + NSGs + Encryption + WAF |
| Detect | Sentinel + Defender for Cloud + Azure Monitor + Alerts |
| Respond | Sentinel Playbooks + Logic Apps + automated remediation |
| Recover | Azure Backup + Site Recovery + Availability Zones |

**NIST SP 800-53 Rev. 5:**
Azure Policy has a built-in regulatory compliance initiative mapping Azure controls to NIST 800-53 Rev. 5 controls. Over 200 policy definitions mapped.

**NIST SP 800-171 Rev. 2:**
For protecting Controlled Unclassified Information (CUI). Azure Government and Azure Commercial both provide mappings.

### 17.3 Compliance Dashboard

```bash
# Assign NIST 800-53 Rev. 5 initiative
az policy assignment create \
  --name "NIST-800-53-R5" \
  --policy-set-definition "179d1daa-458f-4e47-8086-2a68d0d6c38f" \
  --scope /subscriptions/<subscription-id>

# Check compliance state
az policy state summarize --filter "complianceState eq 'NonCompliant'"
```

**Sources:**
- [ISO 27001 Compliance on Azure (Konfirmity)](https://www.konfirmity.com/blog/iso-27001-cloud-compliance-on-azure)
- [ISO/IEC 27001 - Azure Compliance](https://learn.microsoft.com/en-us/azure/compliance/offerings/offering-iso-27001)
- [13 Azure Controls for ISO 27001 (INE)](https://ine.com/blog/13-effective-security-controls-in-microsoft-azure-for-iso-27001-compliance)
- [Azure Compliance Documentation](https://learn.microsoft.com/en-us/azure/compliance/)
- [NIST SP 800-53 Azure Policy](https://learn.microsoft.com/en-us/azure/governance/policy/samples/iso-27001)
- [Azure & NIST Standards (Medium)](https://medium.com/@learning.aspect/microsoft-azure-nist-standard-75a5faccbc79)

---

## 18. Implementation Checklist

### Phase 1: Foundation (Week 1-2)

- [ ] **Identity:** Configure Entra ID tenant, enable Security Defaults or Conditional Access
- [ ] **MFA:** Enforce MFA for all users and administrators
- [ ] **RBAC:** Define role assignments for all team members and service accounts
- [ ] **Key Vault:** Create Key Vault per environment, migrate to RBAC permission model
- [ ] **Managed Identity:** Enable system-assigned or user-assigned managed identity on App Service
- [ ] **Secrets:** Move all secrets from environment variables/config files to Key Vault
- [ ] **TLS:** Enforce TLS 1.2+ minimum, HTTPS-only on App Service

### Phase 2: Network Security (Week 3-4)

- [ ] **VNet:** Create VNet with proper subnet design (app, database, management, endpoints)
- [ ] **VNet Integration:** Integrate App Service with VNet for outbound traffic
- [ ] **Private Endpoints:** Create private endpoints for PostgreSQL, Key Vault, Storage
- [ ] **Private DNS:** Configure private DNS zones for all private endpoints
- [ ] **NSGs:** Apply NSGs to all subnets with explicit deny-all outbound rules
- [ ] **WAF:** Deploy Azure Front Door with WAF in Detection mode
- [ ] **Access Restrictions:** Configure App Service to accept traffic only from Front Door

### Phase 3: Monitoring and Detection (Week 5-6)

- [ ] **Diagnostic Logs:** Enable all diagnostic log categories for App Service, PostgreSQL, Key Vault
- [ ] **Log Analytics:** Create central Log Analytics workspace, route all logs
- [ ] **Defender for Cloud:** Enable Defender plans for App Service, Databases, Key Vault, Storage
- [ ] **Application Insights:** Deploy and configure for the application
- [ ] **Alerts:** Create alerts for security events (failed logins, WAF blocks, Key Vault anomalies)
- [ ] **Sentinel:** Deploy and configure data connectors and analytics rules

### Phase 4: Compliance and Hardening (Week 7-8)

- [ ] **Azure Policy:** Assign MCSB initiative and application-specific policies
- [ ] **WAF Prevention:** Switch WAF to Prevention mode after tuning
- [ ] **Secret Rotation:** Implement automated secret rotation via Event Grid + Functions
- [ ] **Certificate Management:** Configure auto-renewal for all certificates
- [ ] **CORS:** Restrict to specific origins only
- [ ] **Passwordless:** Migrate all database connections to managed identity authentication
- [ ] **Security Score:** Review and remediate all Defender for Cloud recommendations
- [ ] **Penetration Test:** Conduct initial penetration test

### Phase 5: Continuous Security (Ongoing)

- [ ] **Dependency Scanning:** Automated in CI/CD pipeline
- [ ] **Regular Audits:** Monthly review of RBAC assignments, app registrations, secrets expiry
- [ ] **Incident Response:** Document and test incident response procedures
- [ ] **Compliance Reporting:** Weekly compliance dashboard review
- [ ] **Threat Modeling:** Update threat model with each significant architecture change
- [ ] **Security Training:** Regular team security awareness training
- [ ] **CVE Monitoring:** Subscribe to Azure Security Advisories and relevant CVE feeds

---

## Summary of Key Recommendations

1. **Eliminate passwords entirely:** Use managed identities for all Azure-to-Azure communication, including PostgreSQL. This is the single highest-impact security improvement.

2. **Migrate Key Vault to RBAC:** The 2026-02-01 API makes RBAC the default. Migrate proactively before February 2026.

3. **Deploy Azure Front Door with WAF:** Provides global DDoS protection, WAF, and origin security in a single service. Use Private Link to connect Front Door to your origins.

4. **Enable Defender for Cloud on everything:** The threat detection, vulnerability scanning, and security recommendations provide continuous security posture improvement.

5. **Private Endpoints for all PaaS services:** Eliminate public endpoints for PostgreSQL, Key Vault, and Storage. Route all traffic through the Microsoft backbone.

6. **Implement Zero Trust principles:** Verify explicitly (Conditional Access), use least privilege (RBAC + PIM), assume breach (Sentinel + micro-segmentation).

7. **Automate compliance:** Use Azure Policy initiatives for MCSB/NIST/ISO compliance with automated remediation where possible.

8. **Plan for 2026 certificate changes:** 200-day max validity requires more frequent renewal. Ensure auto-renewal is configured and monitored.

---

*Report generated: February 11, 2026*
*Last updated: February 11, 2026*
*Next review: March 11, 2026*
