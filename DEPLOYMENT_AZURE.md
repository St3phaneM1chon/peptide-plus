# 🚀 Déploiement Azure - BioCycle Peptides

## 📋 Prérequis

1. **Compte Azure** avec abonnement actif
2. **Azure CLI** installé (`az --version`)
3. **Domaine** biocyclepeptides.com (configuré chez GoDaddy)
4. **Courriels Microsoft 365** configurés

## 🏗️ Architecture Azure

```
┌─────────────────────────────────────────────────────────────┐
│                     Azure Resource Group                     │
│                   "biocycle-peptides-prod"                  │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   ┌─────────────────┐    ┌─────────────────┐               │
│   │   App Service   │    │   PostgreSQL    │               │
│   │   (Linux/Node)  │───▶│ Flexible Server │               │
│   │     P1v3        │    │    Burstable    │               │
│   └────────┬────────┘    └─────────────────┘               │
│            │                                                │
│            │                                                │
│   ┌────────▼────────┐    ┌─────────────────┐               │
│   │   Key Vault     │    │    Storage      │               │
│   │   (Secrets)     │    │   (Images/CDN)  │               │
│   └─────────────────┘    └─────────────────┘               │
│                                                              │
│   ┌─────────────────┐    ┌─────────────────┐               │
│   │  App Insights   │    │  Log Analytics  │               │
│   │  (Monitoring)   │    │   (365 days)    │               │
│   └─────────────────┘    └─────────────────┘               │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## 🔐 Étape 1: Configuration Azure CLI

```bash
# Login Azure
az login

# Sélectionner l'abonnement
az account set --subscription "YOUR_SUBSCRIPTION_ID"

# Créer le groupe de ressources
az group create \
  --name biocycle-peptides-prod \
  --location canadacentral
```

## 🗄️ Étape 2: Créer PostgreSQL

```bash
# Créer le serveur PostgreSQL Flexible
az postgres flexible-server create \
  --resource-group biocycle-peptides-prod \
  --name biocyclepeptides-db \
  --location canadacentral \
  --admin-user biocycleadmin \
  --admin-password "VOTRE_MOT_DE_PASSE_SECURISE" \
  --sku-name Standard_B1ms \
  --tier Burstable \
  --storage-size 32 \
  --version 15 \
  --yes

# Créer la base de données
az postgres flexible-server db create \
  --resource-group biocycle-peptides-prod \
  --server-name biocyclepeptides-db \
  --database-name peptide_plus

# Configurer le firewall (autoriser Azure services)
az postgres flexible-server firewall-rule create \
  --resource-group biocycle-peptides-prod \
  --name biocyclepeptides-db \
  --rule-name AllowAzureServices \
  --start-ip-address 0.0.0.0 \
  --end-ip-address 0.0.0.0
```

## 🌐 Étape 3: Créer App Service

```bash
# Créer le plan App Service (Linux)
az appservice plan create \
  --resource-group biocycle-peptides-prod \
  --name biocycle-plan \
  --is-linux \
  --sku P1V3 \
  --location canadacentral

# Créer l'application Web
az webapp create \
  --resource-group biocycle-peptides-prod \
  --plan biocycle-plan \
  --name biocyclepeptides \
  --runtime "NODE:20-lts"

# Configurer les paramètres
az webapp config appsettings set \
  --resource-group biocycle-peptides-prod \
  --name biocyclepeptides \
  --settings \
    WEBSITE_NODE_DEFAULT_VERSION="~20" \
    NODE_ENV="production" \
    NEXTAUTH_URL="https://biocyclepeptides.com" \
    NEXT_PUBLIC_APP_URL="https://biocyclepeptides.com"
```

## 🔑 Étape 4: Key Vault pour les secrets

```bash
# Créer Key Vault
az keyvault create \
  --resource-group biocycle-peptides-prod \
  --name biocycle-prod-kv \
  --location canadacentral \
  --enable-rbac-authorization true

# Ajouter les secrets (exemple)
az keyvault secret set \
  --vault-name biocycle-prod-kv \
  --name "DATABASE-URL" \
  --value "postgresql://biocycleadmin:PASSWORD@biocyclepeptides-db.postgres.database.azure.com:5432/peptide_plus?sslmode=require"

az keyvault secret set \
  --vault-name biocycle-prod-kv \
  --name "NEXTAUTH-SECRET" \
  --value "$(openssl rand -base64 32)"

az keyvault secret set \
  --vault-name biocycle-prod-kv \
  --name "STRIPE-SECRET-KEY" \
  --value "sk_live_XXXX"

az keyvault secret set \
  --vault-name biocycle-prod-kv \
  --name "STRIPE-WEBHOOK-SECRET" \
  --value "whsec_XXXX"

az keyvault secret set \
  --vault-name biocycle-prod-kv \
  --name "OPENAI-API-KEY" \
  --value "sk-proj-XXXX"
```

## 🌍 Étape 5: Domaine personnalisé

```bash
# Ajouter le domaine personnalisé
az webapp config hostname add \
  --resource-group biocycle-peptides-prod \
  --webapp-name biocyclepeptides \
  --hostname biocyclepeptides.com

az webapp config hostname add \
  --resource-group biocycle-peptides-prod \
  --webapp-name biocyclepeptides \
  --hostname www.biocyclepeptides.com
```

### Configuration DNS (GoDaddy)

Ajouter les enregistrements suivants:

| Type | Nom | Valeur | TTL |
|------|-----|--------|-----|
| A | @ | IP de l'App Service | 1h |
| CNAME | www | biocyclepeptides.azurewebsites.net | 1h |
| TXT | asuid | ID de vérification Azure | 1h |

## 🔒 Étape 6: Certificat SSL

```bash
# Créer un certificat managé gratuit
az webapp config ssl create \
  --resource-group biocycle-peptides-prod \
  --name biocyclepeptides \
  --hostname biocyclepeptides.com

# Lier le certificat
az webapp config ssl bind \
  --resource-group biocycle-peptides-prod \
  --name biocyclepeptides \
  --certificate-thumbprint THUMBPRINT \
  --ssl-type SNI
```

## 📊 Étape 7: Application Insights

```bash
# Créer Application Insights
az monitor app-insights component create \
  --resource-group biocycle-peptides-prod \
  --app biocycle-insights \
  --location canadacentral \
  --kind web \
  --application-type web
```

## 🚀 Étape 8: Déploiement

### Option A: GitHub Actions (recommandé)

1. Configurer les secrets GitHub:
   - `AZURE_CLIENT_ID`
   - `AZURE_CLIENT_SECRET`
   - `AZURE_SUBSCRIPTION_ID`
   - `AZURE_TENANT_ID`

2. Push sur la branche `main` déclenche le déploiement

### Option B: Azure CLI

```bash
# Build local
npm run build

# Créer un zip
zip -r deploy.zip .next package.json node_modules public prisma

# Déployer
az webapp deploy \
  --resource-group biocycle-peptides-prod \
  --name biocyclepeptides \
  --src-path deploy.zip \
  --type zip
```

## 🔄 Étape 9: Migration de base de données

```bash
# Depuis une machine autorisée (avec accès à Azure PostgreSQL)
DATABASE_URL="postgresql://biocycleadmin:PASSWORD@biocyclepeptides-db.postgres.database.azure.com:5432/peptide_plus?sslmode=require" \
npx prisma migrate deploy

# Seed initial
DATABASE_URL="..." npx prisma db seed

# Créer les utilisateurs
DATABASE_URL="..." npx tsx prisma/create-users.ts
```

## ✅ Vérification post-déploiement

```bash
# Vérifier le site
curl -I https://biocyclepeptides.com

# Vérifier l'API santé
curl https://biocyclepeptides.com/api/health

# Vérifier les logs
az webapp log tail \
  --resource-group biocycle-peptides-prod \
  --name biocyclepeptides
```

## 📧 Courriels configurés

Les courriels sont configurés avec Microsoft 365:

| Adresse | Utilisation |
|---------|-------------|
| contact@biocyclepeptides.com | Contact général |
| support@biocyclepeptides.com | Support client |
| orders@biocyclepeptides.com | Commandes |
| info@biocyclepeptides.com | Informations |
| noreply@biocyclepeptides.com | Envoi automatique |
| stephane.michon@biocyclepeptides.com | Propriétaire |

## 👥 Utilisateurs créés

| Email | Rôle | Mot de passe |
|-------|------|--------------|
| superuser@biocyclepeptides.com | OWNER | St3ph@ne1234 |
| client@biocyclepeptides.com | CLIENT | St3ph@ne1234 |
| customer@biocyclepeptides.com | CUSTOMER | St3ph@ne1234 |

⚠️ **IMPORTANT**: Changer les mots de passe en production!

## 💰 Coûts estimés (CAD/mois)

| Service | Taille | Coût |
|---------|--------|------|
| App Service | P1V3 | ~$100 |
| PostgreSQL | B1ms | ~$30 |
| Storage | 10GB | ~$5 |
| Key Vault | Standard | ~$1 |
| **Total** | | **~$136/mois** |

## 🆘 Support

Pour toute question: support@biocyclepeptides.com
