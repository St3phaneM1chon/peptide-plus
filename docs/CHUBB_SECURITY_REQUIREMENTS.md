# 🔒 EXIGENCES DE SÉCURITÉ - FOURNISSEUR CHUBB ASSURANCE

## 📋 Table des Matières
1. [Vue d'Ensemble](#vue-densemble)
2. [Certifications Obligatoires](#certifications-obligatoires)
3. [Réglementations Applicables](#réglementations-applicables)
4. [Exigences Azure](#exigences-azure)
5. [Sécurité des Applications Web](#sécurité-des-applications-web)
6. [Protection des Données](#protection-des-données)
7. [Checklist de Conformité](#checklist-de-conformité)
8. [Architecture Recommandée](#architecture-recommandée)

---

## 🎯 Vue d'Ensemble

### Contexte Chubb
Chubb est l'un des plus grands assureurs au monde. En tant que fournisseur, vous devez respecter:
- Le **Supplier Code of Conduct** de Chubb
- Les standards **CIPS Corporate Code of Ethics**
- Les exigences de **Third-Party Risk Management (TPRM)**

### Principes Fondamentaux Chubb
1. **Intégrité** - Conduite éthique dans toutes les relations
2. **Transparence** - Documentation complète des processus
3. **Responsabilité** - Accountability pour la protection des données
4. **Conformité** - Respect des réglementations applicables

---

## 📜 Certifications Obligatoires

### 🥇 Niveau 1 - Essentielles

| Certification | Description | Priorité |
|--------------|-------------|----------|
| **SOC 2 Type II** | Audit indépendant des contrôles de sécurité | 🔴 CRITIQUE |
| **ISO/IEC 27001:2022** | Système de gestion de la sécurité de l'information | 🔴 CRITIQUE |
| **PCI DSS v4.0** | Si traitement de paiements | 🟡 SI APPLICABLE |

### 🥈 Niveau 2 - Recommandées

| Certification | Description | Priorité |
|--------------|-------------|----------|
| **ISO 27017** | Contrôles de sécurité cloud | 🟡 RECOMMANDÉ |
| **ISO 27018** | Protection des données personnelles dans le cloud | 🟡 RECOMMANDÉ |
| **CSA STAR** | Cloud Security Alliance certification | 🟢 BONUS |

### Détails SOC 2 Type II
Les 5 principes de confiance à respecter:
1. **Security** - Protection contre les accès non autorisés
2. **Availability** - Disponibilité des systèmes
3. **Processing Integrity** - Intégrité du traitement des données
4. **Confidentiality** - Protection des informations confidentielles
5. **Privacy** - Protection des données personnelles

---

## ⚖️ Réglementations Applicables

### 🇺🇸 NYDFS 23 NYCRR 500 (New York)
**Applicable si vous traitez des données de clients NY**

#### Exigences Clés (2024-2025):

| Exigence | Date Limite | Status |
|----------|-------------|--------|
| **MFA obligatoire** pour accès distant | Nov 2024 | ⚠️ EN VIGUEUR |
| **MFA étendu** à tous les systèmes | Nov 2025 | 📅 À VENIR |
| **Chiffrement** données en transit | Nov 2024 | ⚠️ EN VIGUEUR |
| **Inventaire des actifs** documenté | Nov 2025 | 📅 À VENIR |
| **Test incident response** annuel | Continu | ⚠️ EN VIGUEUR |
| **Formation cybersécurité** annuelle | Continu | ⚠️ EN VIGUEUR |
| **Certification annuelle** | 15 avril | ⚠️ EN VIGUEUR |

#### Gouvernance Requise:
- [ ] Désigner un **CISO** (Chief Information Security Officer)
- [ ] Rapport régulier au **senior leadership**
- [ ] Plans de **remédiation** documentés
- [ ] Supervision par le **conseil d'administration**

### 🇨🇦 PIPEDA (Canada)
**10 Principes de Protection des Données:**

1. **Responsabilité** - Désigner un responsable de la protection des données
2. **Identification des fins** - Documenter pourquoi les données sont collectées
3. **Consentement** - Obtenir un consentement éclairé
4. **Limitation de la collecte** - Ne collecter que le nécessaire
5. **Limitation de l'utilisation** - Ne pas utiliser pour d'autres fins
6. **Exactitude** - Maintenir les données à jour
7. **Mesures de sécurité** - Protéger les données
8. **Transparence** - Politiques de confidentialité accessibles
9. **Accès individuel** - Permettre l'accès et la correction
10. **Contestation** - Mécanisme de plainte

### 🇪🇺 GDPR (Si clients européens)
**Droits des personnes à implémenter:**
- Droit d'accès
- Droit de rectification
- Droit à l'effacement ("droit à l'oubli")
- Droit à la portabilité
- Droit d'opposition
- Droit de limitation du traitement

---

## ☁️ Exigences Azure

### Certifications Azure Disponibles
Azure possède **100+ certifications** de conformité:
- ✅ SOC 2 Type II
- ✅ ISO 27001:2022
- ✅ PCI DSS v4.0 (Level 1)
- ✅ HIPAA
- ✅ FedRAMP
- ✅ CSA STAR

### ⚠️ Modèle de Responsabilité Partagée

| Responsabilité | Microsoft | Vous |
|----------------|-----------|------|
| Infrastructure physique | ✅ | - |
| Réseau Azure | ✅ | - |
| Système d'exploitation (PaaS) | ✅ | - |
| **Configuration sécurité** | - | ✅ |
| **Données** | - | ✅ |
| **Identités & accès** | - | ✅ |
| **Applications** | - | ✅ |
| **Chiffrement données** | - | ✅ |

### Services Azure Recommandés

#### Sécurité
```
Azure Security Center          → Monitoring sécurité
Azure Sentinel                 → SIEM/SOAR
Azure Key Vault               → Gestion des secrets
Azure DDoS Protection         → Protection DDoS
Azure Firewall                → Firewall managé
Azure Private Link            → Connexions privées
```

#### Identité & Accès
```
Azure Active Directory (Entra ID)  → Identité
Azure MFA                          → Multi-facteur
Azure Conditional Access           → Accès conditionnel
Azure PIM                          → Privileged Identity Management
```

#### Conformité
```
Azure Policy                  → Gouvernance
Azure Blueprints             → Templates conformes
Microsoft Defender for Cloud → Posture de sécurité
Azure Monitor                → Logging & alertes
```

### Configuration Minimale Requise

```yaml
# azure-security-baseline.yaml

encryption:
  at_rest: AES-256
  in_transit: TLS 1.3
  key_management: Azure Key Vault

authentication:
  mfa: required_for_all_users
  password_policy:
    min_length: 14
    complexity: high
    expiration: 90_days
    history: 24_passwords
  session_timeout: 15_minutes_idle

network:
  ddos_protection: enabled
  firewall: azure_firewall
  private_endpoints: required
  public_access: restricted_by_ip

logging:
  retention: 365_days
  destinations:
    - azure_monitor
    - azure_sentinel
  alerts:
    - failed_logins
    - privilege_escalation
    - data_exfiltration_attempts

backup:
  frequency: daily
  retention: 30_days
  geo_redundant: true
  encryption: enabled
```

---

## 🌐 Sécurité des Applications Web

### OWASP Top 10 (2024) - Checklist

| # | Risque | Contrôle Requis | Status |
|---|--------|-----------------|--------|
| 1 | **Broken Access Control** | RBAC, validation côté serveur | ⬜ |
| 2 | **Cryptographic Failures** | TLS 1.3, AES-256, hashing bcrypt | ⬜ |
| 3 | **Injection** | Requêtes paramétrées, ORM, validation input | ⬜ |
| 4 | **Insecure Design** | Threat modeling, security patterns | ⬜ |
| 5 | **Security Misconfiguration** | Hardening, pas de defaults | ⬜ |
| 6 | **Vulnerable Components** | Dépendances à jour, scanning | ⬜ |
| 7 | **Auth Failures** | MFA, rate limiting, secure sessions | ⬜ |
| 8 | **Data Integrity Failures** | Signatures, CI/CD sécurisé | ⬜ |
| 9 | **Logging Failures** | Audit trail complet, alertes | ⬜ |
| 10 | **SSRF** | Validation URLs, allowlists | ⬜ |

### Headers de Sécurité Obligatoires

```http
# Headers HTTP de sécurité
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: geolocation=(), microphone=(), camera=()
```

### Authentification & Sessions

```yaml
authentication:
  method: OAuth 2.0 / OpenID Connect
  provider: Azure AD (Entra ID)
  mfa: required
  
session:
  storage: server_side_only
  token_type: JWT (signed + encrypted)
  expiration: 1_hour
  refresh_token: 7_days
  secure_cookie: true
  httponly: true
  samesite: strict

password_requirements:
  min_length: 14
  uppercase: required
  lowercase: required
  numbers: required
  special_chars: required
  no_common_passwords: true
  no_user_info: true
```

### Validation des Entrées

```javascript
// Exemple de validation stricte
const validationRules = {
  email: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
  phone: /^\+?[1-9]\d{1,14}$/,
  name: /^[a-zA-ZÀ-ÿ\s'-]{2,50}$/,
  
  // Toujours:
  // 1. Valider côté serveur (jamais faire confiance au client)
  // 2. Utiliser des allowlists plutôt que des blocklists
  // 3. Encoder les outputs (HTML, URL, SQL)
  // 4. Limiter la taille des inputs
};
```

---

## 🔐 Protection des Données

### Classification des Données

| Niveau | Type | Exemples | Contrôles |
|--------|------|----------|-----------|
| 🔴 **Hautement Confidentiel** | PII sensibles | SSN, données santé, financières | Chiffrement + accès restreint + audit |
| 🟠 **Confidentiel** | PII standard | Nom, email, adresse | Chiffrement + contrôle d'accès |
| 🟡 **Interne** | Données business | Rapports, analytics | Contrôle d'accès |
| 🟢 **Public** | Marketing | Site web, brochures | Aucun |

### Chiffrement

```yaml
encryption_standards:
  at_rest:
    algorithm: AES-256-GCM
    key_management: Azure Key Vault
    key_rotation: 90_days
    
  in_transit:
    protocol: TLS 1.3
    cipher_suites:
      - TLS_AES_256_GCM_SHA384
      - TLS_CHACHA20_POLY1305_SHA256
    certificate: Azure App Service Managed
    
  application_level:
    sensitive_fields: 
      - ssn
      - credit_card
      - health_data
    algorithm: AES-256-GCM
    key_derivation: PBKDF2 (100,000 iterations)
```

### Rétention des Données

| Type de Données | Rétention | Suppression |
|-----------------|-----------|-------------|
| Logs de sécurité | 1 an minimum | Automatique |
| Données clients actifs | Durée du contrat | Sur demande |
| Données clients inactifs | 7 ans (légal) | Automatique |
| Backups | 30 jours | Rotation |

---

## ✅ Checklist de Conformité

### Phase 1: Fondations (Semaines 1-4)

#### Gouvernance
- [ ] Désigner un **responsable sécurité** (DPO/CISO)
- [ ] Créer une **politique de sécurité** documentée
- [ ] Établir un **comité de sécurité** avec réunions mensuelles
- [ ] Documenter les **rôles et responsabilités**

#### Infrastructure Azure
- [ ] Configurer **Azure Security Center**
- [ ] Activer **Azure Sentinel** (SIEM)
- [ ] Configurer **Azure Key Vault** pour les secrets
- [ ] Mettre en place **Azure Monitor** et alertes
- [ ] Activer **Microsoft Defender for Cloud**

### Phase 2: Contrôles Techniques (Semaines 5-8)

#### Authentification
- [ ] Implémenter **Azure AD (Entra ID)**
- [ ] Activer **MFA obligatoire** pour tous les utilisateurs
- [ ] Configurer **Conditional Access Policies**
- [ ] Mettre en place **Privileged Identity Management (PIM)**

#### Réseau
- [ ] Configurer **Azure Firewall**
- [ ] Activer **DDoS Protection**
- [ ] Utiliser **Private Endpoints** pour les services
- [ ] Segmenter le réseau (VNets, NSGs)

#### Application
- [ ] Implémenter tous les **headers de sécurité**
- [ ] Configurer **WAF (Web Application Firewall)**
- [ ] Scanner les **dépendances** (Dependabot, Snyk)
- [ ] Tests de sécurité automatisés dans **CI/CD**

### Phase 3: Opérations (Semaines 9-12)

#### Monitoring
- [ ] Centraliser les **logs** (365 jours rétention)
- [ ] Configurer les **alertes** de sécurité
- [ ] Mettre en place un **dashboard** de sécurité
- [ ] Surveiller les **anomalies** comportementales

#### Incident Response
- [ ] Documenter le **plan de réponse aux incidents**
- [ ] Définir les **procédures d'escalade**
- [ ] Former l'équipe sur les **procédures**
- [ ] Tester le plan avec des **simulations**

#### Business Continuity
- [ ] Configurer les **backups** automatiques
- [ ] Tester la **restauration** régulièrement
- [ ] Documenter le **DR Plan** (Disaster Recovery)
- [ ] Définir les **RTO/RPO** (Recovery Time/Point Objectives)

### Phase 4: Conformité (Semaines 13-16)

#### Documentation
- [ ] **Politique de confidentialité** conforme PIPEDA/GDPR
- [ ] **Conditions d'utilisation** 
- [ ] **Accord de traitement des données** (DPA)
- [ ] **Inventaire des données** collectées

#### Audits
- [ ] Planifier l'audit **SOC 2 Type II**
- [ ] Préparer la certification **ISO 27001**
- [ ] Effectuer un **pentest** externe
- [ ] Documenter les **preuves de conformité**

#### Formation
- [ ] Formation **sécurité** annuelle pour tous
- [ ] Formation **OWASP** pour les développeurs
- [ ] Tests de **phishing** simulés
- [ ] Documentation des **bonnes pratiques**

---

## 🏗️ Architecture Recommandée

### Diagramme Conceptuel

```
┌─────────────────────────────────────────────────────────────────┐
│                         INTERNET                                 │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                   ┌────────▼────────┐
                   │  Azure Front    │  CDN + WAF + DDoS
                   │     Door        │
                   └────────┬────────┘
                            │
              ┌─────────────▼─────────────┐
              │     Azure Firewall        │  Inspection du trafic
              └─────────────┬─────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
┌───────▼───────┐   ┌───────▼───────┐   ┌───────▼───────┐
│   Web App     │   │   API App     │   │   Functions   │
│   (Frontend)  │   │   (Backend)   │   │  (Serverless) │
└───────┬───────┘   └───────┬───────┘   └───────┬───────┘
        │                   │                   │
        └───────────────────┼───────────────────┘
                            │ Private Endpoints
              ┌─────────────▼─────────────┐
              │      Azure VNet           │
              │   (Réseau Privé)          │
              └─────────────┬─────────────┘
                            │
    ┌───────────────────────┼───────────────────────┐
    │                       │                       │
┌───▼────┐           ┌──────▼──────┐         ┌──────▼──────┐
│ Azure  │           │   Azure     │         │   Azure     │
│ SQL DB │           │   Storage   │         │  Key Vault  │
│(Chiffré)│          │  (Chiffré)  │         │  (Secrets)  │
└────────┘           └─────────────┘         └─────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                     MONITORING & SECURITY                       │
├─────────────────┬─────────────────┬─────────────────────────────┤
│ Azure Sentinel  │ Azure Monitor   │ Microsoft Defender for Cloud│
│ (SIEM)          │ (Logs/Metrics)  │ (Security Posture)          │
└─────────────────┴─────────────────┴─────────────────────────────┘
```

### Services Azure Requis

| Catégorie | Service | Fonction |
|-----------|---------|----------|
| **Compute** | App Service / Container Apps | Hébergement applications |
| **Database** | Azure SQL / Cosmos DB | Stockage données (chiffré) |
| **Storage** | Azure Blob Storage | Fichiers (chiffré) |
| **Identity** | Azure AD (Entra ID) | Authentification |
| **Security** | Key Vault | Gestion des secrets |
| **Network** | Front Door + WAF | CDN + Protection |
| **Monitoring** | Azure Monitor + Sentinel | Logs + SIEM |

---

## 📞 Prochaines Étapes

### Pour Chubb Spécifiquement
1. **Contacter** le département Procurement/Vendor Management de Chubb
2. **Obtenir** leur questionnaire de sécurité fournisseur
3. **Documenter** votre conformité selon leurs exigences spécifiques
4. **Planifier** un audit de sécurité si requis

### Pour Votre Template
1. **Implémenter** l'architecture Azure sécurisée
2. **Intégrer** tous les contrôles de sécurité OWASP
3. **Automatiser** les tests de sécurité dans CI/CD
4. **Documenter** les procédures de conformité

---

## 📚 Ressources

### Documentation Officielle
- [Azure Security Documentation](https://docs.microsoft.com/azure/security/)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework)
- [NYDFS 23 NYCRR 500](https://www.dfs.ny.gov/industry_guidance/cybersecurity)

### Outils de Conformité Azure
- [Azure Security Center](https://azure.microsoft.com/services/security-center/)
- [Azure Compliance Manager](https://docs.microsoft.com/microsoft-365/compliance/compliance-manager)
- [Service Trust Portal](https://servicetrust.microsoft.com/)

---

*Document généré le 21 janvier 2026*
*À réviser trimestriellement pour intégrer les nouvelles exigences*
