# 🏗️ ARCHITECTURE - Site Transactionnel de Formation

## 📋 Vue d'Ensemble

Site e-commerce de vente de cours/formations avec gestion multi-niveaux d'utilisateurs.

---

## 👥 Niveaux d'Utilisateurs

| Rôle | Description | Accès |
|------|-------------|-------|
| **Public** | Visiteur non connecté | Catalogue, détails produits |
| **Customer** | Étudiant (individuel ou associé à un Client) | Mes cours, notes, certifications |
| **Client** | Compagnie d'assurance | Gestion profil, gestion étudiants |
| **Employee** | Gestionnaire du site | Gestion comptes clients |
| **Owner** | Propriétaire (vous) | Tout + facturation + analytics |

### Hiérarchie
```
Owner
  └── Employee
        └── Client (Compagnie)
              └── Customer (Étudiant)
                    
Public → (Inscription) → Customer (standalone) ou Customer (associé à Client)
```

---

## 🗺️ Structure des Pages

### Pages Publiques
```
/                           → Page d'accueil (Hero + Top 6 produits + Catégories)
/catalogue                  → Liste complète des cours
/catalogue/[category]       → Cours par catégorie
/cours/[slug]              → Détail d'un cours
/auth/signin               → Connexion (multi-providers)
/auth/signup               → Inscription
```

### Pages Customer (Étudiant)
```
/dashboard/customer         → Tableau de bord étudiant
/dashboard/customer/cours   → Mes cours achetés
/dashboard/customer/notes   → Mes notes et résultats
/dashboard/customer/certificats → Mes certifications
/dashboard/customer/profil  → Mon profil
/dashboard/customer/achats  → Historique achats + reçus
```

### Pages Client (Compagnie)
```
/dashboard/client           → Tableau de bord compagnie
/dashboard/client/etudiants → Gestion des étudiants
/dashboard/client/achats    → Achats pour l'entreprise
/dashboard/client/rapports  → Rapports de formation
/dashboard/client/profil    → Profil entreprise
```

### Pages Employee
```
/admin/dashboard            → Dashboard admin
/admin/clients              → Gestion des clients
/admin/clients/[id]         → Détail client
/admin/customers            → Gestion des étudiants
/admin/association          → Associer email → client
/admin/produits             → Gestion produits
```

### Pages Owner
```
/owner/dashboard            → Dashboard owner
/owner/facturation          → Facturation complète
/owner/analytics            → Analytics avancés
/owner/revenus              → Suivi des revenus
/owner/employees            → Gestion employés
+ Tout ce que Employee voit
```

---

## 💳 Système de Paiement

### Providers Supportés
| Provider | Type | Implementation |
|----------|------|----------------|
| **Stripe** | Orchestrateur principal | API + Webhooks |
| **Apple Pay** | Via Stripe | Payment Request API |
| **Google Pay** | Via Stripe | Payment Request API |
| **PayPal** | Direct | PayPal JS SDK |
| **Visa Click to Pay** | Via Stripe | Stripe Link |
| **Mastercard Click to Pay** | Via Stripe | Stripe Link |
| **Carte de crédit** | Via Stripe | Stripe Elements |

### Flux de Paiement
```
1. Client clique "Acheter"
   ↓
2. Si non connecté → Redirection auth (voir point 3)
   ↓
3. Page de paiement avec options
   ↓
4. Sélection méthode de paiement
   ↓
5. Traitement Stripe/PayPal
   ↓
6. Webhook confirme paiement
   ↓
7. Création accès au cours
   ↓
8. Email confirmation + reçu
   ↓
9. Mise à jour dashboard client/customer
```

### Sauvegarde des Cartes
- Stripe Customer Portal pour gérer les cartes
- Tokenisation sécurisée (PCI DSS compliant)
- Option "Sauvegarder pour achats futurs"

---

## 🔐 Authentification

### Providers
| Provider | Package | Notes |
|----------|---------|-------|
| Google | next-auth | OAuth 2.0 |
| Apple | next-auth | Sign in with Apple |
| Facebook | next-auth | OAuth 2.0 |
| X (Twitter) | next-auth | OAuth 2.0 |
| Email/Password | next-auth + credentials | Avec MFA obligatoire |

### MFA Obligatoire (2 niveaux)
1. **Niveau 1**: Email/Password OU OAuth
2. **Niveau 2**: 
   - TOTP (Google Authenticator, etc.)
   - SMS OTP
   - Email OTP

### Flux d'Authentification
```
Login Email/Password:
  Email + Password → Validation → MFA Challenge → Session

Login OAuth:
  Provider → Callback → MFA Challenge (si première connexion) → Session
```

---

## 🗄️ Modèle de Données

### Tables Principales
```sql
-- Utilisateurs
users (
  id, email, name, role, mfa_enabled, mfa_secret,
  stripe_customer_id, created_at, updated_at
)

-- Compagnies (Clients)
companies (
  id, name, contact_email, billing_address,
  owner_user_id, created_at
)

-- Association Client-Customer
company_customers (
  company_id, customer_user_id, added_at, added_by
)

-- Produits (Cours)
products (
  id, name, slug, description, price, category_id,
  image_url, is_active, created_at
)

-- Catégories
categories (
  id, name, slug, description, image_url
)

-- Achats
purchases (
  id, user_id, product_id, company_id (nullable),
  amount, stripe_payment_id, status, created_at
)

-- Accès aux cours
course_access (
  id, user_id, product_id, purchase_id,
  progress, completed_at, certificate_url
)

-- Notes et résultats
grades (
  id, user_id, product_id, module_id,
  score, passed, completed_at
)
```

---

## 📁 Structure des Fichiers

```
src/
├── app/
│   ├── (public)/                 # Routes publiques
│   │   ├── page.tsx              # Accueil
│   │   ├── catalogue/
│   │   │   ├── page.tsx          # Liste cours
│   │   │   └── [category]/
│   │   └── cours/
│   │       └── [slug]/
│   ├── (auth)/                   # Routes auth
│   │   └── auth/
│   │       ├── signin/
│   │       ├── signup/
│   │       └── mfa/
│   ├── dashboard/                # Dashboard Customer
│   │   └── customer/
│   ├── client/                   # Dashboard Client
│   ├── admin/                    # Dashboard Employee
│   └── owner/                    # Dashboard Owner
├── components/
│   ├── ui/                       # Composants UI de base
│   ├── auth/                     # Composants auth
│   ├── payment/                  # Composants paiement
│   ├── products/                 # Composants produits
│   └── dashboard/                # Composants dashboard
├── lib/
│   ├── auth.ts                   # Config NextAuth
│   ├── stripe.ts                 # Config Stripe
│   ├── paypal.ts                 # Config PayPal
│   ├── db.ts                     # Config base de données
│   └── mfa.ts                    # Gestion MFA
└── types/
    └── index.ts                  # Types TypeScript
```

---

## 🔧 Technologies

| Catégorie | Technologie |
|-----------|-------------|
| Frontend | Next.js 14 (App Router) |
| Styling | Tailwind CSS |
| Auth | NextAuth.js v5 |
| Paiements | Stripe + PayPal |
| Base de données | Azure SQL / PostgreSQL |
| ORM | Prisma |
| Email | Azure Communication Services / SendGrid |
| Storage | Azure Blob Storage |
| Hosting | Azure App Service |

---

## 📊 Composants Clés à Implémenter

### Phase 1: Foundation
- [ ] Structure de base Next.js
- [ ] Authentification multi-providers
- [ ] MFA (TOTP)
- [ ] Modèle de données (Prisma)
- [ ] Gestion des rôles

### Phase 2: Public & Catalogue
- [ ] Page d'accueil
- [ ] Catalogue de cours
- [ ] Page détail cours
- [ ] Recherche et filtres

### Phase 3: Paiements
- [ ] Intégration Stripe
- [ ] Apple Pay / Google Pay
- [ ] PayPal
- [ ] Sauvegarde des cartes
- [ ] Webhooks

### Phase 4: Dashboards
- [ ] Dashboard Customer
- [ ] Dashboard Client
- [ ] Dashboard Employee
- [ ] Dashboard Owner

### Phase 5: Features
- [ ] Gestion des notes
- [ ] Certifications
- [ ] Reçus imprimables
- [ ] Rapports
