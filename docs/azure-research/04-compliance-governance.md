# Azure Compliance, Regulations, and Governance for E-Commerce Applications

## Comprehensive Compliance Report

**Date:** February 2026
**Scope:** Canadian e-commerce application hosted on Microsoft Azure
**Standard:** Research-based compliance guide covering certifications, privacy laws, PCI DSS, governance tooling, encryption, audit, incident response, and tax compliance

---

## Table of Contents

1. [Compliance Certifications](#1-compliance-certifications)
2. [GDPR Compliance on Azure](#2-gdpr-compliance-on-azure)
3. [Canadian Regulations](#3-canadian-regulations)
4. [PCI DSS for E-Commerce](#4-pci-dss-for-e-commerce)
5. [Azure Compliance Manager](#5-azure-compliance-manager)
6. [Data Residency](#6-data-residency)
7. [Azure Policy](#7-azure-policy)
8. [Azure Blueprints and Successors](#8-azure-blueprints-and-successors)
9. [Audit Logging Requirements](#9-audit-logging-requirements)
10. [Encryption](#10-encryption)
11. [Microsoft Purview Data Governance](#11-microsoft-purview-data-governance)
12. [Incident Response](#12-incident-response)
13. [Third-Party Audit and Penetration Testing](#13-third-party-audit-and-penetration-testing)
14. [Cookie Consent and Privacy Requirements](#14-cookie-consent-and-privacy-requirements)
15. [Tax Compliance](#15-tax-compliance)

---

## 1. Compliance Certifications

### 1.1 SOC 1 / SOC 2 / SOC 3

Azure is independently audited at least annually against the SOC reporting framework by third-party auditors.

| Report | Purpose | Audience | Controls Covered |
|--------|---------|----------|------------------|
| **SOC 1 (Type II)** | Financial reporting controls | Customers and auditors under NDA | Internal controls over financial reporting (ICFR) |
| **SOC 2 (Type II)** | Security, availability, processing integrity, confidentiality, privacy | Customers and auditors under NDA | Trust Services Criteria (TSC) |
| **SOC 3** | General-use report | Public | Same TSC as SOC 2, but summarized |

**Key details:**
- SOC 2 Type II audits cover data security, availability, processing integrity, and confidentiality
- Reports are available through the [Microsoft Service Trust Portal](https://servicetrust.microsoft.com)
- SOC reports cover Azure, Microsoft 365, Dynamics 365, and other cloud services
- SOC 2 Type II is the most relevant for e-commerce: it demonstrates that Azure maintains effective security controls over an extended period (typically 12 months)

**E-commerce relevance:** SOC 2 Type II is often requested by enterprise customers, partners, and payment processors as evidence that your cloud infrastructure provider maintains adequate security controls.

### 1.2 ISO 27001 / 27017 / 27018

| Standard | Focus | Azure Status |
|----------|-------|-------------|
| **ISO/IEC 27001:2022** | Information security management system (ISMS) | Certified |
| **ISO/IEC 27017:2015** | Cloud-specific security controls | Certified |
| **ISO/IEC 27018:2019** | Protection of personally identifiable information (PII) in public clouds | Certified |
| **ISO/IEC 27701:2019** | Privacy information management system (PIMS) | Certified |
| **ISO 9001:2015** | Quality management | Certified |
| **ISO 22301:2019** | Business continuity management | Certified |
| **ISO 20000-1:2018** | IT service management | Certified |

**Critical distinction:** Azure's ISO 27001 certification covers Microsoft's cloud infrastructure. This certification does NOT automatically extend to workloads you deploy on Azure. You must implement your own ISMS controls for your application layer, and optionally pursue your own ISO 27001 certification.

**E-commerce relevance:**
- ISO 27001 provides the foundational security management framework
- ISO 27017 adds cloud-specific controls relevant to shared responsibility
- ISO 27018 is particularly important for e-commerce because it governs PII handling in the cloud, directly relevant to customer data protection

### 1.3 PCI DSS

Azure maintains a **PCI DSS Level 1 Service Provider** attestation of compliance (AOC), validated annually by a Qualified Security Assessor (QSA). This is the highest level of PCI DSS certification.

**What Azure provides:**
- PCI DSS-compliant infrastructure (physical security, network infrastructure, host operating systems)
- Encryption capabilities (Azure Key Vault, TDE, SSE)
- Network segmentation tools (VNets, NSGs, Azure Firewall)
- Logging and monitoring (Azure Monitor, Microsoft Defender for Cloud)

**What you must provide:**
- Application-level security controls
- Cardholder data environment (CDE) segmentation within your architecture
- Access controls for your application
- Secure coding practices
- Your own PCI DSS assessment (SAQ or ROC depending on transaction volume)

### 1.4 HIPAA

While HIPAA is U.S.-focused, it is relevant if your e-commerce platform handles any health-related data (e.g., peptide/supplement e-commerce with health claims):

- Azure offers a **Business Associate Agreement (BAA)** that customers can execute
- Azure aligns with NIST SP 800-66 and NIST SP 800-53 standards that underpin HIPAA Security Rule requirements
- Azure's FedRAMP High P-ATO provides assurance that HIPAA Security Rule safeguards are adequately addressed
- In-scope Azure services are listed in the BAA; only use these services for PHI
- Azure offers physical, technical, and administrative safeguards as required by HIPAA and HITECH Act

### 1.5 FedRAMP

Azure maintains two levels of FedRAMP authorization:

| Authorization | Issued By | Scope |
|---------------|-----------|-------|
| **FedRAMP High P-ATO** | Joint Authorization Board (JAB) | Azure Commercial and Azure Government |
| **400+ Agency ATOs** | Individual federal agencies | Moderate and High levels |

**Key characteristics:**
- FedRAMP is not a point-in-time certification; it includes continuous monitoring provisions
- Ensures deployed security controls remain effective in an evolving threat landscape
- Annual reassessment and continuous monitoring reports

**E-commerce relevance:** If your e-commerce platform serves U.S. government agencies or handles federal data, FedRAMP authorization may be required. Even for commercial use, FedRAMP High provides strong assurance of Azure's security posture.

---

## 2. GDPR Compliance on Azure

### 2.1 Data Residency

Azure allows customers to choose the geographical region where data is stored and processed:

- **Customer Data:** Stays within the selected Azure region at rest
- **Region Selection:** Choose Canada Central (Toronto) or Canada East (Quebec City) to keep data in Canada, or EU regions for GDPR-specific requirements
- **Data Processing Addendum (DPA):** Microsoft Products and Services DPA defines obligations for processing and security of Customer Data and Personal Data

**Important:** Even if your primary market is Canada, if you serve EU customers, GDPR applies regardless of where your servers are located. Consider deploying a secondary instance in EU regions if you have significant EU customer base.

### 2.2 Data Processing Agreements

- **Microsoft DPA:** Covers all Azure services; available at [Microsoft Licensing Terms](https://www.microsoft.com/licensing/docs/view/Microsoft-Products-and-Services-Data-Protection-Addendum-DPA)
- **Subprocessor List:** Microsoft maintains a public [Online Services Subprocessors List](https://servicetrust.microsoft.com) identifying all authorized subprocessors
- All subprocessors are contractually obligated to meet or exceed Microsoft's commitments to customers
- The DPA includes Standard Contractual Clauses (SCCs) for international data transfers

### 2.3 Right to Erasure (Right to be Forgotten)

Azure provides capabilities to support data subject rights:

| Right | Azure Capability |
|-------|-----------------|
| **Right to Access** | Azure portal, APIs, and data export tools |
| **Right to Rectification** | Application-level data update capabilities |
| **Right to Erasure** | Removal of personal data from Customer Data; system-generated logs are also addressed |
| **Right to Portability** | Data export in machine-readable formats |
| **Right to Restrict Processing** | Application-level controls; Azure AD conditional access |

**Important exception:** Audit log information is exempt from erasure requirements to maintain security and compliance integrity.

**Implementation requirements for your e-commerce app:**
- Build data subject request (DSR) workflows into your application
- Implement soft-delete then hard-delete patterns with retention periods
- Ensure backups also honor erasure requests (Azure Backup supports item-level recovery)
- Document your erasure process and timelines (GDPR requires response within 30 days)
- Maintain a data processing record (Article 30 GDPR)

### 2.4 Data Protection Impact Assessments (DPIA)

Microsoft provides a DPIA for Azure services. For your e-commerce application, you must conduct your own DPIAs for:
- New features that process personal data
- Changes to how personal data is collected or used
- Integration with third-party services
- Use of AI/ML for profiling or automated decision-making

---

## 3. Canadian Regulations

### 3.1 PIPEDA (Personal Information Protection and Electronic Documents Act)

PIPEDA is Canada's federal private-sector privacy law. It is built on **10 Fair Information Principles:**

| # | Principle | Requirement |
|---|-----------|-------------|
| 1 | **Accountability** | Appoint a privacy officer responsible for compliance |
| 2 | **Identifying Purposes** | Identify purposes for collection before or at collection time |
| 3 | **Consent** | Obtain meaningful, informed consent for collection, use, and disclosure |
| 4 | **Limiting Collection** | Collect only what is necessary for identified purposes |
| 5 | **Limiting Use, Disclosure, and Retention** | Use data only for stated purposes; retain only as long as necessary |
| 6 | **Accuracy** | Keep personal information accurate, complete, and up-to-date |
| 7 | **Safeguards** | Protect personal information with appropriate security measures |
| 8 | **Openness** | Make privacy policies and practices readily available |
| 9 | **Individual Access** | Provide individuals access to their personal information on request |
| 10 | **Challenging Compliance** | Provide a mechanism for individuals to challenge your compliance |

**PIPEDA consent requirements for e-commerce:**
- **Express consent** is required for sensitive personal information (financial, health, biometric data)
- **Implied consent** may be acceptable for non-sensitive data where the individual would reasonably expect the collection
- Consent must be **meaningful:** individuals must understand what they are consenting to
- Consent can be withdrawn at any time
- **Implied consent (continuing to browse = consent) is NOT sufficient for tracking cookies**

**Mandatory breach notification:** Organizations must report breaches of security safeguards to the Privacy Commissioner and affected individuals if the breach creates a "real risk of significant harm."

**Azure's PIPEDA alignment:** Microsoft provides a Privacy Impact Assessment (PIA) demonstrating how Azure complies with PIPEDA, the Canadian Privacy Act, FIPPA (Ontario), PHIPA (Ontario), CSA Code, and Quebec's private sector law.

### 3.2 Quebec Law 25 (Loi 25 modernisant des dispositions legislatives en matiere de protection des renseignements personnels)

Quebec Law 25 is the **most stringent privacy law in Canada** and the closest North American equivalent to GDPR. Fully in force since September 2024.

#### Key Requirements

| Requirement | Detail |
|-------------|--------|
| **Privacy Officer** | Mandatory appointment; title and contact info published on website |
| **Privacy Impact Assessments** | Required for any new system that collects, uses, or discloses PI; required when PI is shared outside Quebec |
| **Consent** | Must be explicit, free, informed, specific, and given for specific purposes |
| **Cookie Consent** | **Explicit opt-in required** (not opt-out); the ONLY North American law requiring this |
| **Transparency** | Privacy policy must be written in clear, simple language |
| **Automated Decision-Making** | Must inform individuals when decisions are made solely by automated processing; individuals have right to explanation |
| **Data Portability** | Right to request data in commonly used technological format |
| **De-identification** | Specific rules for de-identification and anonymization |
| **Cross-border Transfers** | PIA required before any PI transfer outside Quebec; must ensure equivalent protection |

#### Penalties and Enforcement

| Type | Minimum | Maximum |
|------|---------|---------|
| **Administrative Monetary Penalties (AMPs)** | N/A | CAD $10,000,000 or 2% of global turnover |
| **Penal Proceedings** | CAD $15,000 | CAD $25,000,000 or 4% of global turnover |
| **Individual penalties** | CAD $5,000 | CAD $50,000 |

**Critical:** Quebec Law 25 includes a **private right of action** -- individuals can sue for damages of at least CAD $1,000 and pursue collective action. This is unique among Canadian privacy laws and creates significant litigation risk.

#### Scope and Applicability

- Applies to **any enterprise** that collects, holds, uses, or communicates PI of a Quebec resident
- **No requirement** that the enterprise be based in Quebec
- **No consumer threshold** for applicability (unlike some U.S. state laws)
- Applies regardless of company size

### 3.3 Provincial Privacy Laws

| Province | Law | Status |
|----------|-----|--------|
| **Alberta** | Personal Information Protection Act (PIPA) | Substantially similar to PIPEDA; applies in place of PIPEDA for private sector |
| **British Columbia** | Personal Information Protection Act (PIPA) | Substantially similar to PIPEDA; applies in place of PIPEDA for private sector |
| **Quebec** | Law 25 (formerly Act Respecting the Protection of Personal Information in the Private Sector) | Substantially similar to PIPEDA with significantly stronger protections |
| **Ontario** | No private-sector privacy law | PIPEDA applies; PHIPA applies for health data |
| **Other provinces** | No private-sector privacy laws | PIPEDA applies for commercial activities |

**Practical impact for e-commerce:** If you sell to customers across Canada, you must comply with:
- PIPEDA for all provinces except AB, BC, and QC
- Alberta PIPA for Alberta customers
- British Columbia PIPA for BC customers
- Quebec Law 25 for Quebec customers (the most demanding standard)

**Recommendation:** Design your privacy practices to meet Quebec Law 25 standards, as this will satisfy requirements across all Canadian jurisdictions.

### 3.4 Proposed Federal Legislation: Consumer Privacy Protection Act (CPPA)

Canada has been working on a modernized federal privacy law (Bill C-27, the Digital Charter Implementation Act) which would replace PIPEDA with the CPPA. Key proposed changes:
- Significant penalty increases (up to 5% of global revenue or CAD $25 million)
- Expanded individual rights
- Establishment of a Personal Information and Data Protection Tribunal
- As of early 2026, the bill has not yet been enacted; monitor legislative progress

---

## 4. PCI DSS for E-Commerce

### 4.1 PCI DSS 4.0 -- Mandatory Since March 31, 2025

PCI DSS 4.0 is now fully mandatory, replacing version 3.2.1. All requirements, including those with extended timelines, are now enforceable.

### 4.2 Cardholder Data Environment (CDE)

The CDE includes every system, process, and person that stores, processes, or transmits cardholder data (CHD) or sensitive authentication data (SAD).

**Scoping requirements:**
- Identify and document every system component in or connected to the CDE
- Include all system components that provide security services to the CDE
- Include all system components that could impact CDE security
- Include all virtualization, cloud, and container components

**Azure CDE considerations:**
- Azure as infrastructure provider is a Level 1 PCI DSS Service Provider
- Your application layer and CDE design are YOUR responsibility
- Use Azure's shared responsibility model documentation to understand boundaries

### 4.3 Network Segmentation

| Requirement | PCI DSS 4.0 Detail |
|-------------|---------------------|
| **Purpose** | Reduce CDE scope by isolating cardholder data systems |
| **Merchant Testing** | Segmentation testing at least annually |
| **Service Provider Testing** | Segmentation testing every 6 months |
| **Documentation** | All connections to and from CDE must be documented |
| **New in 4.0** | Explicit requirements for segmentation testing documentation |

**Azure implementation tools:**
- **Azure Virtual Networks (VNets):** Isolate CDE in dedicated VNets
- **Network Security Groups (NSGs):** Control traffic flow at subnet and NIC level
- **Azure Firewall:** Centralized network filtering with threat intelligence
- **Azure Private Link:** Private connectivity to Azure services without public internet exposure
- **Azure Application Gateway with WAF:** Web application firewall for front-end protection

### 4.4 SAQ Types for E-Commerce

| SAQ Type | Scenario | Requirements Count | Typical Use Case |
|----------|----------|-------------------|-----------------|
| **SAQ A** | All payment processing fully outsourced via iframe or redirect | 29 (15 e-commerce specific) | Stripe Checkout, PayPal redirect, embedded iframes from PCI-compliant provider |
| **SAQ A-EP** | Website controls how CHD is redirected but never receives it | 139 | JavaScript widgets, Direct Post methods, API-based integrations where merchant page scripts interact with payment flow |
| **SAQ C** | Payment application connected to internet, no electronic CHD storage | ~160 | Virtual terminal on merchant website |
| **SAQ D (Merchant)** | All other merchants; stores CHD electronically | 300+ | Full-scope merchant processing |

#### SAQ A Eligibility (Preferred for E-Commerce)

To qualify for SAQ A under PCI DSS 4.0:
1. All payment page elements must originate from the PCI DSS validated third-party provider
2. Use iframe or full-page redirect (NOT Direct Post or JavaScript form submission)
3. No storage, processing, or transmission of CHD in your environment
4. Merchant website must NOT impact how CHD is collected
5. You must confirm your payment provider's PCI DSS compliance annually

**New SAQ A requirements in PCI DSS 4.0:**
- Requirement 6.4.3: Manage all payment page scripts loaded in the consumer browser (e.g., Content Security Policy)
- Requirement 11.6.1: Change-detection mechanism for payment pages (e.g., HTTP header monitoring)
- Multi-factor authentication for administrative access

#### SAQ A-EP vs SAQ A

**The critical distinction:** If your website loads ANY JavaScript, uses Direct Post, or runs any script that could affect the payment page -- even if your servers never touch CHD -- you likely need SAQ A-EP (139 requirements) instead of SAQ A (29 requirements).

**Recommendation for the peptide-plus e-commerce app:** Use a PCI-compliant payment provider with an **iframe-based** or **full redirect** integration (e.g., Stripe Elements in iframe mode, or Stripe Checkout redirect) to qualify for SAQ A and minimize PCI scope.

### 4.5 PCI DSS 4.0 Key Changes for E-Commerce

| Change | Impact |
|--------|--------|
| **Requirement 6.4.3** | All scripts on payment pages must be managed and authorized |
| **Requirement 11.6.1** | Change/tamper-detection on payment pages |
| **Requirement 8.3.6** | Minimum password length increased to 12 characters |
| **Requirement 12.3.1** | Targeted risk analysis for flexible requirements |
| **Customized Approach** | New option to meet control objectives through alternative methods |

---

## 5. Azure Compliance Manager (Microsoft Purview Compliance Manager)

### 5.1 Overview

Microsoft Purview Compliance Manager is a feature in the Microsoft Purview compliance portal that helps manage compliance requirements with greater ease and convenience. It is the central tool for assessing and improving your compliance posture.

### 5.2 Compliance Score

- **Risk-based percentage** measuring progress in completing recommended improvement actions
- Points awarded per action per assessment
- Actions scored based on: mandatory vs. discretionary, preventative vs. detective vs. corrective
- Score reflects both Microsoft-managed controls and customer-managed controls
- **Automatic detection:** Compliance Manager detects signals from Microsoft Secure Score and can automatically test certain improvement actions

### 5.3 Assessments

Assessments group relevant controls and improvement actions for a specific regulation or standard.

**Available built-in assessments include:**
- ISO 27001:2013
- PCI DSS 3.2.1 and 4.0
- SOC 2
- GDPR
- HIPAA
- NIST 800-53
- NIST Cybersecurity Framework
- Canada Federal PBMM
- **EU AI Act** (new in 2025)
- **NIST AI RMF** (new in 2025)

### 5.4 Improvement Actions

Each improvement action provides:
- Recommended guidance for implementation
- Assignment to team members
- Testing and evidence documentation
- Implementation status tracking
- Score impact analysis

**2025 AI integration:** Compliance Manager now integrates with Azure AI Foundry to automate compliance evaluations for AI models and agents, with built-in assessments for the EU AI Act, NIST AI RMF, and ISO/IEC standards.

### 5.5 Practical Usage for E-Commerce

1. **Enable assessments** for PCI DSS 4.0, ISO 27001, PIPEDA, and GDPR (if applicable)
2. **Review improvement actions** and assign owners from your development/security team
3. **Track compliance score** as you implement controls
4. **Export reports** for auditors and stakeholders
5. **Use continuous assessment** to detect configuration drift

---

## 6. Data Residency

### 6.1 Azure Canada Regions

| Region | Location | Primary Use |
|--------|----------|-------------|
| **Canada Central** | Toronto, Ontario | Primary workloads, most Azure services available |
| **Canada East** | Quebec City, Quebec | Disaster recovery, paired region for Canada Central |

**Data residency commitment:** Microsoft commits that Customer Data stored in these regions will remain in Canada at rest. This is documented in the Microsoft Products and Services Data Protection Addendum (DPA).

### 6.2 Data Sovereignty Considerations

| Consideration | Detail |
|---------------|--------|
| **PIPEDA** | Does NOT require data to stay in Canada, but cross-border transfers must meet comparable protection standards |
| **Quebec Law 25** | Requires PIA before transferring PI outside Quebec; must ensure equivalent privacy protection |
| **Provincial requirements** | Some provinces or industries may have specific data localization requirements |
| **Government data** | Canadian government (PBMM) requires data residency in Canada |

### 6.3 Service-Specific Data Residency

Not all Azure services guarantee data residency in your selected region. Key considerations:

- **Core services** (Compute, Storage, SQL Database, Cosmos DB): Data at rest stays in selected region
- **Azure AD / Entra ID:** Tenant data may be stored in the service's global infrastructure
- **Azure CDN:** Content cached at edge locations globally
- **Azure Monitor / Log Analytics:** Workspace data stored in selected region
- **Microsoft Sentinel:** Supports regional data storage (verify per workspace)

**Recommendation:** Always verify data residency for each Azure service you use. Use the [Azure data residency page](https://azure.microsoft.com/en-us/explore/global-infrastructure/data-residency) for service-specific details.

### 6.4 Geo-Replication and Disaster Recovery

When using geo-replication for disaster recovery:
- Canada Central pairs with Canada East (both in Canada)
- Data remains within Canadian borders during failover
- For Azure Storage: geo-redundant replication (GRS) between Canada Central and Canada East keeps data in Canada
- Document your geo-replication topology for compliance audits

---

## 7. Azure Policy

### 7.1 Overview

Azure Policy evaluates resources against business rules defined in JSON format (policy definitions). It enables governance at scale by preventing non-compliant resource creation and auditing existing resources.

### 7.2 Built-in Policy Definitions

Azure provides hundreds of built-in policy definitions across categories:

| Category | Examples |
|----------|----------|
| **Compute** | Allowed VM SKUs, disk encryption required |
| **Storage** | HTTPS traffic only, minimum TLS version |
| **Network** | NSG rules, no public IP addresses |
| **SQL** | TDE enabled, audit logging enabled |
| **Key Vault** | Soft delete enabled, minimum key size |
| **Monitoring** | Diagnostic settings required |
| **Tags** | Required tags on resources |
| **General** | Allowed locations, allowed resource types |

### 7.3 Regulatory Compliance Initiative Definitions

Azure Policy includes built-in regulatory compliance initiatives that map to specific standards:

| Initiative | Controls Mapped |
|-----------|----------------|
| **PCI DSS v4.0** | All 12 PCI DSS requirement families |
| **PCI DSS v3.2.1** | All 12 PCI DSS requirement families |
| **ISO 27001:2013** | All 14 control domains |
| **Canada Federal PBMM** | PBMM controls for Canadian government |
| **NIST SP 800-53 Rev. 5** | All control families |
| **HIPAA HITRUST 9.2** | All HITRUST CSF domains |
| **Azure Security Benchmark (MCSB)** | Microsoft's comprehensive cloud security controls |
| **SOC 2 Type 2** | Trust Services Criteria |

### 7.4 Custom Policies

For e-commerce-specific requirements not covered by built-in policies:

```json
// Example: Require all storage accounts to use customer-managed keys
{
  "mode": "Indexed",
  "policyRule": {
    "if": {
      "allOf": [
        {
          "field": "type",
          "equals": "Microsoft.Storage/storageAccounts"
        },
        {
          "field": "Microsoft.Storage/storageAccounts/encryption.keySource",
          "notEquals": "Microsoft.Keyvault"
        }
      ]
    },
    "then": {
      "effect": "deny"
    }
  }
}
```

### 7.5 Initiative Definitions (Policy Sets)

Group multiple policy definitions into a single assignment:

**Recommended custom initiative for Canadian e-commerce:**
1. Enforce encryption at rest (all storage, databases)
2. Enforce TLS 1.2+ for all services
3. Enforce Canada-only region deployments
4. Require diagnostic settings on all resources
5. Enforce network security group rules
6. Require Azure Key Vault for secrets management
7. Enforce tagging for cost and compliance tracking
8. Deny public access to databases and storage

### 7.6 Policy Effects

| Effect | Behavior |
|--------|----------|
| **Deny** | Block non-compliant resource creation/update |
| **Audit** | Log non-compliance but allow creation |
| **AuditIfNotExists** | Audit if a related resource doesn't exist |
| **DeployIfNotExists** | Auto-deploy a related resource if missing |
| **Modify** | Add, update, or remove properties on creation/update |
| **Disabled** | Policy not evaluated |

**Recommendation:** Start with **Audit** to assess current compliance, then transition to **Deny** for critical controls once your team is ready.

---

## 8. Azure Blueprints and Successors

### 8.1 Azure Blueprints (Deprecating July 11, 2026)

Azure Blueprints is being deprecated and will NOT reach General Availability. It provided compliance templates including:

- **ISO 27001 Blueprint:** Governance guardrails for ISO 27001 controls
- **Azure Security Benchmark Foundation:** Baseline infrastructure patterns for secure environments
- **NIST SP 800-53 Blueprint**
- **PCI DSS Blueprint**
- **Canada Federal PBMM Blueprint**
- **CAF Migration Landing Zone**

### 8.2 Migration to Template Specs and Deployment Stacks

**Template Specs:**
- Store and version ARM templates or Bicep files in Azure
- Share templates across the organization
- Support access control via Azure RBAC
- Serve as the "what should be deployed" definition

**Deployment Stacks:**
- Manage lifecycle of resources as a group
- Track what was deployed and detect drift
- Support deny assignments to prevent unauthorized changes
- Serve as the "what was deployed and should be maintained" tracking

### 8.3 Migration Process

1. Convert blueprint artifacts to ARM JSON templates or Bicep files
2. Create Template Specs for reusable infrastructure definitions
3. Create Deployment Stacks for deployment and lifecycle management
4. Use Azure Policy for ongoing compliance enforcement
5. Use Microsoft Defender for Cloud for continuous compliance monitoring

**Timeline:** Begin migration immediately; complete before July 11, 2026 deprecation date.

---

## 9. Audit Logging Requirements

### 9.1 What to Log

For e-commerce compliance (PCI DSS, PIPEDA, GDPR, Law 25), you must log:

| Category | Events to Log |
|----------|---------------|
| **Authentication** | All login attempts (success/failure), MFA events, password changes, session creation/termination |
| **Authorization** | Access to sensitive data, privilege escalation, role changes, permission modifications |
| **Data Access** | Read/write/delete operations on personal data, CHD access, database queries on sensitive tables |
| **Administrative** | Configuration changes, policy changes, user account management, resource provisioning/deprovisioning |
| **Network** | Firewall rule changes, NSG modifications, VPN connections, external API calls |
| **Application** | Errors and exceptions, payment transactions, cart operations, order processing, refunds |
| **Security** | Threat detection alerts, vulnerability scan results, WAF blocks, DDoS events |
| **Compliance** | Data subject requests (access, erasure, portability), consent changes, privacy preference updates |

### 9.2 Azure Logging Services

| Service | Purpose | Default Retention |
|---------|---------|-------------------|
| **Azure Activity Log** | Control-plane operations (resource CRUD) | 90 days (free) |
| **Azure Monitor / Log Analytics** | Centralized log aggregation and analysis | 30 days default; configurable up to 730 days; archive up to 12 years (4,383 days) |
| **Azure Diagnostic Settings** | Resource-level logging to destinations | Depends on destination |
| **Microsoft Entra ID Audit Logs** | Identity events | 7 days (Free), 30 days (P1/P2); extend to 730 days via Log Analytics |
| **Microsoft Entra ID Sign-in Logs** | Authentication events | 7 days (Free), 30 days (P1/P2); extend via Log Analytics |
| **Azure SQL Auditing** | Database operations | Configurable; 90+ days recommended |
| **Azure Storage Analytics** | Storage operations logging | Configurable |
| **Microsoft Defender for Cloud** | Security alerts and recommendations | 90 days (free tier) |
| **Microsoft Sentinel** | SIEM/SOAR with advanced analytics | Configured per workspace |

### 9.3 Retention Requirements by Regulation

| Regulation | Minimum Retention | Recommended |
|------------|-------------------|-------------|
| **PCI DSS 4.0** | 12 months, with 3 months immediately available | 12 months online + archive |
| **PIPEDA** | Duration of purpose + reasonable period | 2+ years |
| **Quebec Law 25** | Duration of purpose + reasonable period | 2+ years |
| **GDPR** | Purpose-dependent; minimize retention | Based on data type |
| **SOC 2** | Sufficient for audit period (typically 12 months) | 12-24 months |
| **ISO 27001** | Defined by your ISMS policy | 12-36 months |

### 9.4 Important 2025 Change

**As of September 30, 2025:** All retention functionality for Diagnostic Settings Storage Retention has been disabled. You must now use **Azure Storage Lifecycle Management** for log retention in storage accounts. This affects any compliance architecture that relied on diagnostic settings for log retention.

### 9.5 Recommended Architecture

```
Azure Resources --> Diagnostic Settings --> Log Analytics Workspace (90-730 days)
                                        --> Storage Account (with Lifecycle Management for long-term)
                                        --> Event Hub (for real-time SIEM integration)

Log Analytics Workspace --> Archive (up to 12 years for compliance)
                       --> Microsoft Sentinel (for SIEM/SOAR)
                       --> Azure Workbooks (for compliance dashboards)
```

---

## 10. Encryption

### 10.1 Encryption at Rest

#### Azure Storage Service Encryption (SSE)

- **Applies to:** Azure Blob Storage, Azure Files, Azure Queue Storage, Azure Table Storage, Azure Data Lake Storage
- **Algorithm:** AES-256 (one of the strongest block ciphers available)
- **Enabled:** Automatically for ALL Azure storage accounts; cannot be disabled
- **Key options:**
  - **Microsoft-managed keys (default):** Microsoft handles key generation, storage, and rotation
  - **Customer-managed keys (CMK):** Keys stored in Azure Key Vault; you control generation, rotation, and revocation
  - **Customer-provided keys:** Keys provided with each request (Blob storage only)

#### Transparent Data Encryption (TDE)

- **Applies to:** Azure SQL Database, Azure SQL Managed Instance, Azure Synapse Analytics
- **Enabled:** By default on all newly created Azure SQL databases
- **Algorithm:** AES-256
- **Key management:**
  - **Service-managed TDE:** Microsoft manages the Database Encryption Key (DEK)
  - **Customer-managed TDE (BYOK):** DEK protected by a customer-managed key in Azure Key Vault

#### Azure Disk Encryption

- **Applies to:** Azure Virtual Machines (OS and data disks)
- **Technology:** BitLocker (Windows) or dm-crypt (Linux)
- **Alternative:** Azure Disk Encryption at host (server-side encryption)
- **Key storage:** Azure Key Vault

#### Azure Key Vault

| Feature | Details |
|---------|---------|
| **Key types** | RSA, EC (Elliptic Curve); software-protected or HSM-protected |
| **HSM validation** | FIPS 140-3 Level 3 validated (Managed HSM) |
| **PCI compliance** | HSM offering is PCI compliant |
| **BYOK** | Import keys from on-premises HSMs |
| **Key rotation** | Automated rotation policies configurable |
| **Access control** | Azure RBAC + Key Vault access policies |
| **Audit logging** | Full audit trail of all key operations |

**Recommendation for e-commerce:** Use Customer-Managed Keys (CMK) via Azure Key Vault for:
- Storage accounts containing personal data
- SQL databases containing customer/order data
- Any data subject to PCI DSS, PIPEDA, or Law 25

CMK closes common audit gaps where compliance frameworks require "customer control over encryption keys." Rotate keys at least every 2 years (Azure best practice).

### 10.2 Encryption in Transit

| Protocol | Status |
|----------|--------|
| **TLS 1.2** | Minimum enforced across all Azure services (mandatory since August 31, 2025) |
| **TLS 1.3** | Supported on many Azure services; adoption expanding |
| **TLS 1.0 / 1.1** | Deprecated and disabled across Azure |
| **HTTPS** | Required for all Azure Storage connections |

**E-commerce implementation:**
- Configure your App Service / Container App to enforce TLS 1.2 minimum
- Use Azure Front Door or Application Gateway for TLS termination with managed certificates
- Enable HSTS (HTTP Strict Transport Security) headers
- Ensure all internal service-to-service communication uses TLS
- Use Azure Private Link for private connectivity to Azure PaaS services (data never traverses public internet)

### 10.3 Double Encryption

Azure supports double encryption for defense-in-depth:
- **Infrastructure layer encryption** (platform-managed key) + **Service layer encryption** (customer-managed key)
- Available for Azure Storage, Azure SQL Database, and other services
- Addresses scenarios where a single encryption layer may be compromised

---

## 11. Microsoft Purview Data Governance

### 11.1 Overview

Microsoft Purview (formerly Azure Purview) provides unified data governance across your entire digital estate -- on-premises, Microsoft 365, Azure, and other public clouds. It discovers, classifies, labels, monitors, and protects data.

### 11.2 Data Classification

| Feature | Detail |
|---------|--------|
| **Built-in classifications** | 200+ system classifications (SSN, credit card numbers, bank accounts, health data, etc.) |
| **Custom classifications** | Create custom classification rules using regex, dictionary, or proximity patterns |
| **Automatic classification** | Data scanned and classified automatically during ingestion |
| **Sensitivity labels** | Apply labels (Public, Internal, Confidential, Highly Confidential) based on classification results |
| **Auto-labeling** | Policies automatically apply sensitivity labels based on data content |

### 11.3 Data Catalog (Unified Catalog)

The Unified Catalog reached General Availability in 2025:
- Single experience for data discovery across the organization
- Search and browse all data assets
- Business glossary for standardized terminology
- Data lineage tracking
- Data quality monitoring

### 11.4 E-Commerce Relevance

For a Canadian e-commerce application, use Microsoft Purview to:

1. **Classify customer PII** (names, emails, addresses, phone numbers)
2. **Classify payment data** (even tokenized references)
3. **Classify health-related data** (if selling supplements/peptides with health claims)
4. **Track data lineage** from collection through processing to storage
5. **Apply sensitivity labels** to enforce DLP policies
6. **Monitor data sharing** to detect unauthorized disclosure
7. **Support DSR (Data Subject Request) fulfillment** by knowing where all personal data resides

### 11.5 AI and Agent Protection (2025 Update)

- Agents inherit the same sensitivity label protections as human users
- Communication Compliance, Audit, Data Lifecycle Management, and eDiscovery now cover human-agent interactions
- Critical for e-commerce platforms using AI chatbots or recommendation engines

---

## 12. Incident Response

### 12.1 Microsoft Defender for Cloud

Microsoft Defender for Cloud (formerly Azure Security Center) provides:

| Feature | Detail |
|---------|--------|
| **Security Alerts** | Notifications triggered by advanced threat detection when Defender plans are enabled |
| **Alert Details** | Affected resources, issues, remediation steps, and MITRE ATT&CK mapping |
| **Security Incidents** | Correlated alerts grouped into incidents for investigation |
| **Regulatory Compliance Dashboard** | Visual representation of compliance posture against multiple standards |
| **Secure Score** | Numerical score representing security posture |
| **CSPM (Cloud Security Posture Management)** | Continuous visibility and actionable guidance |

**Defender Plans relevant for e-commerce:**
- Defender for Servers (VMs)
- Defender for Databases (SQL, Cosmos DB, PostgreSQL)
- Defender for Storage (Blob, Files)
- Defender for App Service
- Defender for Key Vault
- Defender for Containers (if using AKS/containers)
- Defender for DNS

### 12.2 Microsoft Sentinel (SIEM/SOAR)

| Capability | Detail |
|------------|--------|
| **Playbooks** | Automated workflows built on Azure Logic Apps; preconfigured remediation actions |
| **Automation Rules** | Trigger playbooks automatically based on alert/incident conditions |
| **Workbooks** | Interactive dashboards for monitoring and investigation |
| **Hunting Queries** | KQL-based proactive threat hunting |
| **Connectors** | 200+ data connectors for Azure, third-party, and custom sources |

**Important timeline:**
- **March 2026:** Legacy playbooks called from analytics rules will stop working; migrate to automation rules
- **July 2026:** All Azure portal Sentinel users will be redirected to the Defender portal

### 12.3 Incident Response Plan Requirements

For e-commerce compliance, your incident response plan must include:

| Component | Requirement (PCI DSS, PIPEDA, Law 25) |
|-----------|---------------------------------------|
| **Detection** | Real-time monitoring and alerting (Defender for Cloud + Sentinel) |
| **Classification** | Severity assessment, data types affected, scope determination |
| **Containment** | Isolation procedures, network segmentation activation |
| **Notification** | PIPEDA: Report to Privacy Commissioner + affected individuals if "real risk of significant harm"; Law 25: Notify CAI within 72 hours; PCI DSS: Notify payment brands and acquirer |
| **Investigation** | Root cause analysis, evidence preservation, forensic imaging |
| **Remediation** | Vulnerability patching, control implementation, configuration changes |
| **Recovery** | System restoration, validation testing, return to normal operations |
| **Post-Incident** | Lessons learned, control improvements, documentation |

### 12.4 Simulated Alerts (Testing)

Microsoft Defender for Cloud supports simulated alerts that generate realistic alerts with full context on Azure VMs or Arc-connected machines, enabling end-to-end testing of playbooks and SOC readiness without waiting for real incidents.

---

## 13. Third-Party Audit and Penetration Testing

### 13.1 Microsoft Penetration Testing Rules of Engagement

**Pre-approval:** As of June 15, 2017, Microsoft **no longer requires pre-approval** to conduct penetration testing against Azure resources. However, you must comply with the Microsoft Cloud Unified Penetration Testing Rules of Engagement.

### 13.2 Allowed Testing Activities

| Activity | Status |
|----------|--------|
| Penetration testing your own Azure resources | **Allowed** |
| Vulnerability scanning your own Azure VMs | **Allowed** |
| Port scanning your own resources | **Allowed** |
| Fuzzing your own applications | **Allowed** |
| Testing breakout from shared containers (Azure Websites, Functions) | **Allowed** (with responsible reporting) |
| Testing within your own tenant/subscription | **Allowed** |

### 13.3 Prohibited Activities

| Activity | Status |
|----------|--------|
| Testing resources you do not own or have explicit permission to test | **Prohibited** |
| Leveraging a vulnerability beyond initial identification and reporting | **Prohibited** |
| Scanning or testing other tenants, system logs, or databases | **Prohibited** |
| DoS/DDoS attacks against any Azure service | **Prohibited** |
| Social engineering Microsoft employees | **Prohibited** |

### 13.4 Microsoft's Own Testing

Microsoft regularly conducts:
- Penetration testing as part of the Security Development Lifecycle (SDL)
- Vulnerability assessments required by PCI DSS, FedRAMP, and ISO 27001 certifications
- Red team exercises against its own infrastructure
- Results are available through the Service Trust Portal (under NDA)

### 13.5 Third-Party Audit Process for Your E-Commerce Application

| Step | Detail |
|------|--------|
| **1. Scope Definition** | Define which Azure resources and application components are in scope |
| **2. Engage QSA/Auditor** | Hire a PCI Qualified Security Assessor, ISO 27001 auditor, or general security auditor |
| **3. Leverage Azure Artifacts** | Provide auditor with Azure's SOC 2 report, PCI DSS AOC, ISO certificates from Service Trust Portal |
| **4. Penetration Testing** | Commission third-party pentest; no Microsoft pre-approval needed |
| **5. Gap Assessment** | Identify gaps between Azure's controls and your application controls |
| **6. Remediation** | Address identified gaps |
| **7. Formal Assessment** | Complete the audit/assessment cycle |
| **8. Reporting** | Obtain your own compliance attestation/certification |

---

## 14. Cookie Consent and Privacy Requirements for Canadian E-Commerce

### 14.1 Cookie Consent Requirements by Jurisdiction

| Jurisdiction | Consent Type | Key Requirement |
|-------------|-------------|-----------------|
| **PIPEDA (Federal)** | Express consent for tracking cookies | Implied consent (continuing to browse) is NOT sufficient for tracking cookies |
| **Quebec Law 25** | **Explicit opt-in** for all non-essential cookies | Most stringent in North America; equivalent to GDPR |
| **CASL (Anti-Spam)** | Express consent for commercial electronic messages | Opt-in required for marketing emails; double opt-in recommended |
| **Alberta PIPA** | Reasonable consent | Similar to PIPEDA |
| **British Columbia PIPA** | Reasonable consent | Similar to PIPEDA |

### 14.2 Cookie Banner Requirements

A compliant cookie banner for Canadian e-commerce MUST:

1. **Block non-essential cookies until consent is given** (especially for Quebec visitors)
2. **Provide granular controls** (separate toggles for analytics, marketing, functional cookies)
3. **Make it equally easy to accept or reject** (no dark patterns)
4. **Provide clear, plain-language explanation** of what each cookie category does
5. **Allow easy withdrawal of consent** at any time
6. **Record consent** with timestamp for audit purposes
7. **Not use pre-checked boxes** for non-essential cookies
8. **Refresh consent periodically** (recommended every 12 months)

### 14.3 Privacy Policy Requirements

Your privacy policy must include:

| Element | PIPEDA | Law 25 | GDPR (if applicable) |
|---------|--------|--------|---------------------|
| Identity and contact information of organization | Required | Required | Required |
| Privacy officer name and contact | Recommended | **Required (published on website)** | Required (DPO) |
| Types of PI collected | Required | Required | Required |
| Purposes of collection | Required | Required | Required |
| Legal basis for processing | N/A | N/A | Required |
| Third-party disclosures | Required | Required | Required |
| Cross-border transfers | Required (if applicable) | **Required + PIA** | Required + safeguards |
| Retention periods | Required | Required | Required |
| Individual rights and how to exercise them | Required | Required | Required |
| Cookie policy | Required | Required | Required |
| Automated decision-making disclosure | N/A | **Required** | Required |
| Right to complain to authority | Recommended | Required (CAI) | Required |

### 14.4 CASL (Canada's Anti-Spam Legislation) for E-Commerce

| Requirement | Detail |
|-------------|--------|
| **Express consent** for commercial emails | Must obtain before sending; double opt-in recommended |
| **Implied consent** | Exists for 2 years after purchase; 6 months after inquiry |
| **Unsubscribe mechanism** | Must be processed within 10 business days |
| **Identification** | All messages must identify sender and include physical address |
| **Penalties** | Up to CAD $1,000,000 per violation (individuals), CAD $10,000,000 per violation (organizations) |

### 14.5 Implementation Recommendations

1. **Use a Consent Management Platform (CMP):** Tools like CookieYes, OneTrust, Cookiebot, or similar that support Quebec Law 25 opt-in requirements
2. **Geolocation-based consent:** Apply Quebec opt-in rules for Quebec visitors, PIPEDA express consent for rest of Canada
3. **Consent records:** Store all consent events in your database with timestamps
4. **Regular audits:** Scan your site for cookies quarterly; new third-party scripts may introduce unauthorized cookies
5. **Privacy-by-default:** Non-essential cookies blocked by default; only enabled after consent

---

## 15. Tax Compliance

### 15.1 Federal Taxes

#### GST (Goods and Services Tax)
- **Rate:** 5% across all of Canada
- **Registration threshold:** CAD $30,000 in annual taxable sales
- **Administered by:** Canada Revenue Agency (CRA)
- **Applies to:** Most goods and services, including digital products

#### HST (Harmonized Sales Tax)
Provinces that harmonize with GST:

| Province | HST Rate | Federal Portion | Provincial Portion |
|----------|----------|----------------|-------------------|
| Ontario | 13% | 5% | 8% |
| New Brunswick | 15% | 5% | 10% |
| Newfoundland and Labrador | 15% | 5% | 10% |
| Nova Scotia | 15% (was 15%, increased to 14% then 15%) | 5% | 10% |
| Prince Edward Island | 15% | 5% | 10% |

**Note:** Nova Scotia HST increased to 14% effective April 1, 2025; verify current rate.

### 15.2 Provincial Taxes

| Province | Tax Type | Rate | E-Commerce Notes |
|----------|----------|------|-----------------|
| **Quebec** | QST (Quebec Sales Tax) | 9.975% (+ 5% GST = ~15%) | Separate registration with Revenu Quebec required |
| **British Columbia** | PST (Provincial Sales Tax) | 7% (+ 5% GST) | PST applies to software and digital products; marketplace facilitators must collect |
| **Saskatchewan** | PST | 6% (+ 5% GST) | PST applies to electronic distribution services |
| **Manitoba** | RST (Retail Sales Tax) | 7% (+ 5% GST) | Effective January 1, 2026: PST applies to cloud computing services (SaaS, PaaS, IaaS) |
| **Alberta** | No PST | 5% GST only | No provincial sales tax |
| **Territories** | No PST | 5% GST only | No provincial sales taxes |

### 15.3 Digital Products and Services

GST/HST applies to:
- Digital products downloaded over the internet
- Software and SaaS subscriptions
- Streaming services
- Online courses and educational content
- Digital advertising services
- Intellectual property rights

### 15.4 Registration and Collection Requirements

| Requirement | Detail |
|-------------|--------|
| **GST/HST Registration** | Mandatory once CAD $30,000 threshold reached |
| **QST Registration** | Separate registration with Revenu Quebec if selling to Quebec customers |
| **BC PST Registration** | Required if taxable sales in BC exceed CAD $10,000 in 12 months |
| **SK PST Registration** | Required with no threshold |
| **MB RST Registration** | Required with no threshold |
| **Filing frequency** | Monthly, quarterly, or annually based on revenue |
| **Invoice requirements** | Must show business name, address, GST/HST number, date, description, rate, total |

### 15.5 Marketplace Facilitator Rules

If your e-commerce platform is a marketplace facilitator (selling third-party goods):
- **BC:** Must collect and remit PST on facilitated sales to BC customers
- **Saskatchewan:** Must collect and remit PST on facilitated sales
- **Manitoba:** Must collect and remit RST on facilitated sales
- **GST/HST:** May need to collect on behalf of third-party sellers

### 15.6 Digital Services Tax (DST)

- **Rate:** 3% on revenue from specific digital services
- **Targets:** Large businesses with significant digital revenue in Canada
- **Separate from sales tax:** Not a consumer-facing tax
- **Applies to:** Online advertising, social media, online marketplaces, user data
- **Threshold:** Businesses with global revenue exceeding EUR 750 million and Canadian digital services revenue exceeding CAD $20 million

### 15.7 Implementation Recommendations

1. **Use a tax calculation service:** Avalara, TaxJar, or Stripe Tax for real-time rate calculation
2. **Store tax configuration** by province to handle rate changes
3. **Register proactively** in provinces where you have customers
4. **Track thresholds** per province for registration obligations
5. **Separate GST/HST, QST, and PST** in invoices and records
6. **File returns on time** to avoid penalties and interest
7. **Maintain records** for at least 6 years (CRA requirement)
8. **Tax-inclusive pricing** is not required in Canada but must clearly show tax amounts

---

## Summary: Compliance Checklist for Canadian E-Commerce on Azure

### Critical Path Items

| Priority | Item | Regulation |
|----------|------|------------|
| **P0** | Appoint Privacy Officer | Law 25, PIPEDA |
| **P0** | Implement cookie consent with Quebec opt-in | Law 25 |
| **P0** | Use PCI DSS-compliant payment integration (iframe/redirect for SAQ A) | PCI DSS 4.0 |
| **P0** | Register for GST/HST, QST | CRA, Revenu Quebec |
| **P0** | Deploy in Canada Central / Canada East regions | Data residency |
| **P1** | Enable Microsoft Defender for Cloud | Security monitoring |
| **P1** | Configure Azure Policy with regulatory initiatives | Governance |
| **P1** | Enable encryption at rest with CMK via Key Vault | PCI DSS, PIPEDA |
| **P1** | Enforce TLS 1.2+ for all connections | PCI DSS, security |
| **P1** | Configure comprehensive audit logging with 12+ month retention | PCI DSS, PIPEDA |
| **P1** | Publish privacy policy meeting Law 25 requirements | Law 25, PIPEDA |
| **P1** | Implement data subject request workflows | Law 25, PIPEDA, GDPR |
| **P2** | Conduct Privacy Impact Assessment | Law 25 |
| **P2** | Set up Microsoft Purview for data classification | Governance |
| **P2** | Create incident response plan with notification procedures | PCI DSS, PIPEDA, Law 25 |
| **P2** | Enable Microsoft Sentinel for SIEM/SOAR | Security operations |
| **P2** | Register for PST in BC, SK, MB if applicable | Provincial tax |
| **P3** | Commission third-party penetration test | PCI DSS, ISO 27001 |
| **P3** | Pursue ISO 27001 certification for your application | Best practice |
| **P3** | Set up Compliance Manager assessments | Governance tracking |

---

## Sources

### Microsoft Documentation
- [Azure Compliance Documentation](https://learn.microsoft.com/en-us/azure/compliance/)
- [Compliance Offerings for Microsoft Services](https://learn.microsoft.com/en-us/compliance/regulatory/offering-home)
- [ISO/IEC 27001 - Azure Compliance](https://learn.microsoft.com/en-us/azure/compliance/offerings/offering-iso-27001)
- [HIPAA - Azure Compliance](https://learn.microsoft.com/en-us/azure/compliance/offerings/offering-hipaa-us)
- [FedRAMP - Azure Compliance](https://learn.microsoft.com/en-us/azure/compliance/offerings/offering-fedramp)
- [Canada Privacy Laws - Azure Compliance](https://learn.microsoft.com/en-us/azure/compliance/offerings/offering-canada-privacy-laws)
- [Data Residency in Azure](https://azure.microsoft.com/en-us/explore/global-infrastructure/data-residency)
- [Azure Policy Overview](https://learn.microsoft.com/en-us/azure/governance/policy/overview)
- [Azure Policy Built-in Initiatives](https://learn.microsoft.com/en-us/azure/governance/policy/samples/built-in-initiatives)
- [Azure Blueprints Overview (Deprecation Notice)](https://learn.microsoft.com/en-us/azure/governance/blueprints/overview)
- [Migrate Blueprints to Deployment Stacks](https://learn.microsoft.com/en-us/azure/azure-resource-manager/bicep/migrate-blueprint)
- [Azure Encryption Overview](https://learn.microsoft.com/en-us/azure/security/fundamentals/encryption-overview)
- [Azure Data Encryption at Rest](https://learn.microsoft.com/en-us/azure/security/fundamentals/encryption-atrest)
- [Customer-Managed Keys for Azure Storage](https://learn.microsoft.com/en-us/azure/storage/common/customer-managed-keys-overview)
- [Azure Key Vault - About Keys](https://learn.microsoft.com/en-us/azure/key-vault/keys/about-keys)
- [Azure Monitor Diagnostic Settings](https://learn.microsoft.com/en-us/azure/azure-monitor/platform/diagnostic-settings)
- [Log Analytics Data Retention](https://learn.microsoft.com/en-us/azure/azure-monitor/logs/data-retention-configure)
- [Microsoft Purview Compliance Manager](https://learn.microsoft.com/en-us/purview/compliance-manager)
- [Compliance Manager Scoring](https://learn.microsoft.com/en-us/purview/compliance-manager-scoring)
- [Compliance Manager Improvement Actions](https://learn.microsoft.com/en-us/purview/compliance-manager-improvement-actions)
- [Data Classification in Microsoft Purview](https://learn.microsoft.com/en-us/purview/data-map-classification)
- [Sensitivity Labels in Purview Data Map](https://learn.microsoft.com/en-us/purview/data-map-sensitivity-labels)
- [Microsoft Defender for Cloud Alerts](https://learn.microsoft.com/en-us/azure/defender-for-cloud/alerts-overview)
- [Microsoft Sentinel Playbooks](https://learn.microsoft.com/en-us/azure/sentinel/automation/automate-responses-with-playbooks)
- [Regulatory Compliance in Defender for Cloud](https://learn.microsoft.com/en-us/azure/defender-for-cloud/concept-regulatory-compliance-standards)
- [Microsoft Penetration Testing Rules of Engagement](https://www.microsoft.com/en-us/msrc/pentest-rules-of-engagement)
- [Penetration Testing - Azure Security](https://learn.microsoft.com/en-us/azure/security/fundamentals/pen-testing)
- [Azure Data Subject Requests for GDPR](https://learn.microsoft.com/en-us/compliance/regulatory/gdpr-dsr-azure)
- [Canada Federal PBMM - Azure Policy](https://learn.microsoft.com/en-us/azure/governance/policy/samples/canada-federal-pbmm)
- [Entra ID Data Retention](https://learn.microsoft.com/en-us/entra/identity/monitoring-health/reference-reports-data-retention)
- [Audit Log Retention Policies](https://learn.microsoft.com/en-us/purview/audit-log-retention-policies)

### Canadian Government and Legal
- [PIPEDA Fair Information Principles](https://www.priv.gc.ca/en/privacy-topics/privacy-laws-in-canada/the-personal-information-protection-and-electronic-documents-act-pipeda/p_principle/)
- [PIPEDA Requirements in Brief](https://www.priv.gc.ca/en/privacy-topics/privacy-laws-in-canada/the-personal-information-protection-and-electronic-documents-act-pipeda/pipeda_brief/)
- [OPC Guidelines on Online Behavioural Advertising](https://www.priv.gc.ca/en/privacy-topics/technology/online-privacy-tracking-cookies/tracking-and-ads/gl_ba_1112/)
- [GST/HST for Digital Economy Businesses](https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses/digital-economy.html)
- [GST/HST and E-Commerce](https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses/charge-collect-specific-situations/e-commerce.html)

### PCI DSS
- [PCI DSS v4.0 SAQ A-EP](https://listings.pcisecuritystandards.org/documents/PCI-DSS-v4-0-SAQ-A-EP.pdf)
- [PCI DSS 4.0 Compliance Guide - NonaSec](https://nonasec.com/resources/pci-dss-4-compliance-guide)
- [SAQ A vs SAQ A-EP - Schellman](https://www.schellman.com/blog/pci-compliance/saq-a-vs-saq-a-ep)
- [SAQ A Eligibility FAQ - PCI SSC Blog](https://blog.pcisecuritystandards.org/faq-clarifies-new-saq-a-eligibility-criteria-for-e-commerce-merchants)
- [PCI Compliance in the Cloud 2025](https://deepstrike.io/blog/pci-compliance-in-the-cloud-2025-guide)

### Quebec Law 25
- [Quebec Law 25 - OneTrust](https://www.onetrust.com/blog/quebecs-law-25-what-is-it-and-what-do-you-need-to-know/)
- [Quebec Law 25 - BigID](https://bigid.com/blog/quebec-law-25-canada-new-privacy-law-requirements/)
- [Quebec Law 25 - Osano](https://www.osano.com/articles/quebec-law-25)
- [Quebec PIA Guide - McCarthy Tetrault](https://www.mccarthy.ca/en/insights/blogs/techlex/quebec-privacy-regulators-guide-law-25-compliant-privacy-impact-assessments)
- [Quebec Law 25 Compliance Guide - Alation](https://www.alation.com/blog/quebec-law-25-compliance-guide/)
- [Quebec Law 25 - Mindsec](https://mindsec.io/quebecs-loi-25-guide/)

### Cookie Consent
- [Cookie Consent in Canada 2025 Guide](https://www.cookie-banner.ca/blog/cookie-consent-canada-guide-2025)
- [PIPEDA Compliance 2026 Guide](https://geotargetly.com/blog/pipeda-compliance-guide-to-canada-privacy-law)
- [Cookie Consent Trends 2026 - CookieYes](https://www.cookieyes.com/blog/cookie-consent-trends/)

### Tax
- [Canada GST/HST Guide for Digital Businesses 2026 - Quaderno](https://quaderno.io/guides/canada-gst-hst-guide/)
- [Canadian Sales Tax - Avalara](https://www.avalara.com/us/en/vatlive/country-guides/north-america/canada/canadian-vat-compliance-and-rates.html)
- [BC PST Marketplace Facilitators - BC Government](https://www2.gov.bc.ca/assets/gov/taxes/sales-taxes/publications/pst-142-marketplace-facilitators.pdf)
- [Tax Obligations of Marketplaces in Canada - Stripe](https://stripe.com/guides/understanding-the-tax-obligations-of-marketplaces-in-canada)
- [Selling Online in Canada - Taxually](https://www.taxually.com/blog/selling-online-in-canada-everything-you-need-to-know)

### Industry Analysis
- [SOC 2 Compliance on Azure - IS Partners](https://www.ispartnersllc.com/blog/soc-2-compliance-azure/)
- [ISO 27001 on Azure - Konfirmity](https://www.konfirmity.com/blog/iso-27001-cloud-compliance-on-azure)
- [Azure Penetration Testing Guide - Qualysec](https://qualysec.com/azure-penetration-testing-a-complete-guide/)
- [Microsoft Purview 2025 - Refoundry](https://refoundry.com/why-data-governance-matters-and-how-microsoft-purview-is-evolving-in-2025/)
- [GDPR Compliance Guide 2026 - SecurePrivacy](https://secureprivacy.ai/blog/gdpr-compliance-2026)
