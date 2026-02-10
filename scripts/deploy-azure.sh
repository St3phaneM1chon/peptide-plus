#!/bin/bash
# =====================================================
# BIOCYCLE PEPTIDES - Azure Deployment Script
# =====================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}
╔═══════════════════════════════════════════════════╗
║     BioCycle Peptides - Azure Deployment          ║
╚═══════════════════════════════════════════════════╝
${NC}"

# Configuration
RESOURCE_GROUP="biocycle-peptides-prod"
LOCATION="canadacentral"
APP_NAME="biocyclepeptides"
DB_NAME="biocyclepeptides-db"
PLAN_NAME="biocycle-plan"
KV_NAME="biocycle-prod-kv"
DOMAIN="biocyclepeptides.com"

# Check Azure CLI
echo -e "${YELLOW}Checking Azure CLI...${NC}"
if ! command -v az &> /dev/null; then
    echo -e "${RED}Azure CLI not found. Please install it first.${NC}"
    exit 1
fi

# Check login status
echo -e "${YELLOW}Checking Azure login...${NC}"
az account show > /dev/null 2>&1 || {
    echo -e "${YELLOW}Not logged in. Running az login...${NC}"
    az login
}

# Get subscription
SUBSCRIPTION=$(az account show --query id -o tsv)
echo -e "${GREEN}Using subscription: $SUBSCRIPTION${NC}"

# =====================================================
# Create Resource Group
# =====================================================
echo -e "\n${BLUE}Step 1: Creating Resource Group...${NC}"
az group create \
    --name $RESOURCE_GROUP \
    --location $LOCATION \
    --tags Application=BioCyclePeptides Environment=Production

# =====================================================
# Create PostgreSQL Flexible Server
# =====================================================
echo -e "\n${BLUE}Step 2: Creating PostgreSQL Server...${NC}"
read -sp "Enter PostgreSQL admin password: " DB_PASSWORD
echo

az postgres flexible-server create \
    --resource-group $RESOURCE_GROUP \
    --name $DB_NAME \
    --location $LOCATION \
    --admin-user biocycleadmin \
    --admin-password "$DB_PASSWORD" \
    --sku-name Standard_B1ms \
    --tier Burstable \
    --storage-size 32 \
    --version 15 \
    --yes

# Create database
echo -e "${YELLOW}Creating database...${NC}"
az postgres flexible-server db create \
    --resource-group $RESOURCE_GROUP \
    --server-name $DB_NAME \
    --database-name peptide_plus

# Allow Azure services
az postgres flexible-server firewall-rule create \
    --resource-group $RESOURCE_GROUP \
    --name $DB_NAME \
    --rule-name AllowAzureServices \
    --start-ip-address 0.0.0.0 \
    --end-ip-address 0.0.0.0

# =====================================================
# Create App Service Plan
# =====================================================
echo -e "\n${BLUE}Step 3: Creating App Service Plan...${NC}"
az appservice plan create \
    --resource-group $RESOURCE_GROUP \
    --name $PLAN_NAME \
    --is-linux \
    --sku P1V3 \
    --location $LOCATION

# =====================================================
# Create Web App
# =====================================================
echo -e "\n${BLUE}Step 4: Creating Web App...${NC}"
az webapp create \
    --resource-group $RESOURCE_GROUP \
    --plan $PLAN_NAME \
    --name $APP_NAME \
    --runtime "NODE:20-lts"

# Configure app settings
echo -e "${YELLOW}Configuring app settings...${NC}"
az webapp config appsettings set \
    --resource-group $RESOURCE_GROUP \
    --name $APP_NAME \
    --settings \
        WEBSITE_NODE_DEFAULT_VERSION="~20" \
        NODE_ENV="production" \
        NEXTAUTH_URL="https://$DOMAIN" \
        NEXT_PUBLIC_APP_URL="https://$DOMAIN" \
        NEXT_PUBLIC_SITE_NAME="BioCycle Peptides" \
        DATABASE_URL="postgresql://biocycleadmin:$DB_PASSWORD@$DB_NAME.postgres.database.azure.com:5432/peptide_plus?sslmode=require"

# Enable HTTPS only
az webapp update \
    --resource-group $RESOURCE_GROUP \
    --name $APP_NAME \
    --https-only true

# =====================================================
# Create Key Vault
# =====================================================
echo -e "\n${BLUE}Step 5: Creating Key Vault...${NC}"
az keyvault create \
    --resource-group $RESOURCE_GROUP \
    --name $KV_NAME \
    --location $LOCATION \
    --enable-rbac-authorization true

# Store secrets
echo -e "${YELLOW}Storing secrets in Key Vault...${NC}"
NEXTAUTH_SECRET=$(openssl rand -base64 32)

az keyvault secret set --vault-name $KV_NAME --name "DATABASE-URL" \
    --value "postgresql://biocycleadmin:$DB_PASSWORD@$DB_NAME.postgres.database.azure.com:5432/peptide_plus?sslmode=require"

az keyvault secret set --vault-name $KV_NAME --name "NEXTAUTH-SECRET" \
    --value "$NEXTAUTH_SECRET"

# =====================================================
# Create Application Insights
# =====================================================
echo -e "\n${BLUE}Step 6: Creating Application Insights...${NC}"
az monitor app-insights component create \
    --resource-group $RESOURCE_GROUP \
    --app biocycle-insights \
    --location $LOCATION \
    --kind web \
    --application-type web

# Get connection string
APPINSIGHTS_CONN=$(az monitor app-insights component show \
    --resource-group $RESOURCE_GROUP \
    --app biocycle-insights \
    --query connectionString -o tsv)

az webapp config appsettings set \
    --resource-group $RESOURCE_GROUP \
    --name $APP_NAME \
    --settings APPLICATIONINSIGHTS_CONNECTION_STRING="$APPINSIGHTS_CONN"

# =====================================================
# Configure Custom Domain
# =====================================================
echo -e "\n${BLUE}Step 7: Configuring Custom Domain...${NC}"
echo -e "${YELLOW}Adding custom domain $DOMAIN...${NC}"

# Get verification ID
VERIFY_ID=$(az webapp show \
    --resource-group $RESOURCE_GROUP \
    --name $APP_NAME \
    --query customDomainVerificationId -o tsv)

echo -e "${GREEN}
╔═══════════════════════════════════════════════════════════╗
║                DNS Configuration Required                  ║
╠═══════════════════════════════════════════════════════════╣
║ Add these records to GoDaddy DNS:                         ║
║                                                            ║
║ Type: TXT                                                  ║
║ Name: asuid                                                ║
║ Value: $VERIFY_ID
║                                                            ║
║ Type: CNAME                                                ║
║ Name: www                                                  ║
║ Value: $APP_NAME.azurewebsites.net                        ║
║                                                            ║
║ Type: A (or ALIAS)                                         ║
║ Name: @                                                    ║
║ Value: Get from 'az webapp show' after domain verified     ║
╚═══════════════════════════════════════════════════════════╝
${NC}"

read -p "Press Enter after DNS records are configured..."

# Add hostname
az webapp config hostname add \
    --resource-group $RESOURCE_GROUP \
    --webapp-name $APP_NAME \
    --hostname $DOMAIN

az webapp config hostname add \
    --resource-group $RESOURCE_GROUP \
    --webapp-name $APP_NAME \
    --hostname www.$DOMAIN

# =====================================================
# Create SSL Certificate
# =====================================================
echo -e "\n${BLUE}Step 8: Creating SSL Certificate...${NC}"
az webapp config ssl create \
    --resource-group $RESOURCE_GROUP \
    --name $APP_NAME \
    --hostname $DOMAIN

# =====================================================
# Summary
# =====================================================
echo -e "\n${GREEN}
╔═══════════════════════════════════════════════════════════╗
║                 Deployment Complete!                       ║
╠═══════════════════════════════════════════════════════════╣
║                                                            ║
║  Web App URL: https://$APP_NAME.azurewebsites.net         ║
║  Custom URL:  https://$DOMAIN                             ║
║                                                            ║
║  PostgreSQL:  $DB_NAME.postgres.database.azure.com        ║
║  Key Vault:   $KV_NAME.vault.azure.net                    ║
║                                                            ║
║  Next Steps:                                               ║
║  1. Configure remaining secrets in Key Vault               ║
║  2. Deploy the application code                            ║
║  3. Run database migrations                                ║
║  4. Configure Stripe webhooks                              ║
║                                                            ║
╚═══════════════════════════════════════════════════════════╝
${NC}"

echo -e "${YELLOW}NEXTAUTH_SECRET (save this):${NC}"
echo "$NEXTAUTH_SECRET"

echo -e "\n${YELLOW}To deploy the code:${NC}"
echo "npm run build"
echo "zip -r deploy.zip .next package.json node_modules public prisma"
echo "az webapp deploy --resource-group $RESOURCE_GROUP --name $APP_NAME --src-path deploy.zip --type zip"
