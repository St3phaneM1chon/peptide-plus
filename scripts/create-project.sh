#!/bin/bash

# ============================================
# 🚀 CRÉATION D'UN NOUVEAU PROJET SÉCURISÉ
# Template conforme Chubb - Azure Ready
# ============================================

set -e

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Logo
echo ""
echo -e "${PURPLE}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${PURPLE}║${NC}  ${CYAN}🔒 SECURE WEB TEMPLATE - Conforme Chubb${NC}               ${PURPLE}║${NC}"
echo -e "${PURPLE}║${NC}  ${YELLOW}Création d'un nouveau projet sécurisé${NC}                 ${PURPLE}║${NC}"
echo -e "${PURPLE}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""

# Chemin du template
TEMPLATE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROJECTS_DIR="/Volumes/AI_Project"

# Vérifier que le template existe
if [ ! -d "$TEMPLATE_DIR/src" ]; then
    echo -e "${RED}❌ Erreur: Template non trouvé dans $TEMPLATE_DIR${NC}"
    exit 1
fi

# ============================================
# ÉTAPE 1: Nom du projet
# ============================================

echo -e "${CYAN}📝 CONFIGURATION DU PROJET${NC}"
echo ""

# Demander le nom du site
read -p "$(echo -e ${YELLOW}Nom du site \(sera le nom du répertoire\): ${NC})" SITE_NAME

# Valider le nom
if [ -z "$SITE_NAME" ]; then
    echo -e "${RED}❌ Le nom du site est requis${NC}"
    exit 1
fi

# Nettoyer le nom pour le répertoire
DIR_NAME=$(echo "$SITE_NAME" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/--*/-/g' | sed 's/^-//' | sed 's/-$//')

if [ -z "$DIR_NAME" ]; then
    echo -e "${RED}❌ Nom de répertoire invalide${NC}"
    exit 1
fi

# ============================================
# ÉTAPE 2: Informations supplémentaires
# ============================================

echo ""
read -p "$(echo -e ${YELLOW}Nom d\'affichage du site \[${SITE_NAME}\]: ${NC})" DISPLAY_NAME
DISPLAY_NAME=${DISPLAY_NAME:-$SITE_NAME}

read -p "$(echo -e ${YELLOW}URL du site \(ex: https://example.com\): ${NC})" SITE_URL

read -p "$(echo -e ${YELLOW}Email de contact: ${NC})" CONTACT_EMAIL

echo ""
echo -e "${CYAN}Type de projet:${NC}"
echo "  1) Formation / E-learning"
echo "  2) E-commerce"
echo "  3) SaaS"
echo "  4) Corporate"
echo "  5) Autre"
read -p "$(echo -e ${YELLOW}Choix \[1\]: ${NC})" PROJECT_TYPE
PROJECT_TYPE=${PROJECT_TYPE:-1}

case $PROJECT_TYPE in
    1) TYPE_NAME="formation" ;;
    2) TYPE_NAME="ecommerce" ;;
    3) TYPE_NAME="saas" ;;
    4) TYPE_NAME="corporate" ;;
    *) TYPE_NAME="custom" ;;
esac

# ============================================
# ÉTAPE 3: Destination
# ============================================

echo ""
read -p "$(echo -e ${YELLOW}Répertoire parent \[${PROJECTS_DIR}\]: ${NC})" PARENT_DIR
PARENT_DIR=${PARENT_DIR:-$PROJECTS_DIR}

PROJECT_DIR="$PARENT_DIR/$DIR_NAME"

# Vérifier si le répertoire existe déjà
if [ -d "$PROJECT_DIR" ]; then
    echo -e "${RED}❌ Le répertoire $PROJECT_DIR existe déjà${NC}"
    read -p "$(echo -e ${YELLOW}Voulez-vous le remplacer? \(o/N\): ${NC})" REPLACE
    if [ "$REPLACE" != "o" ] && [ "$REPLACE" != "O" ]; then
        echo -e "${YELLOW}Annulé.${NC}"
        exit 0
    fi
    rm -rf "$PROJECT_DIR"
fi

# ============================================
# ÉTAPE 4: Confirmation
# ============================================

echo ""
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}📋 RÉCAPITULATIF${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo -e "  Nom du site:      ${WHITE}$DISPLAY_NAME${NC}"
echo -e "  Répertoire:       ${WHITE}$PROJECT_DIR${NC}"
echo -e "  URL:              ${WHITE}${SITE_URL:-"(à configurer)"}${NC}"
echo -e "  Email:            ${WHITE}${CONTACT_EMAIL:-"(à configurer)"}${NC}"
echo -e "  Type:             ${WHITE}$TYPE_NAME${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo ""

read -p "$(echo -e ${YELLOW}Créer le projet? \(O/n\): ${NC})" CONFIRM
if [ "$CONFIRM" = "n" ] || [ "$CONFIRM" = "N" ]; then
    echo -e "${YELLOW}Annulé.${NC}"
    exit 0
fi

# ============================================
# ÉTAPE 5: Création du projet
# ============================================

echo ""
echo -e "${CYAN}🚀 Création du projet...${NC}"

# Créer le répertoire
mkdir -p "$PROJECT_DIR"

# Copier le template (exclure node_modules, .next, etc.)
echo -e "  ${GREEN}✓${NC} Copie du template..."
rsync -av --progress "$TEMPLATE_DIR/" "$PROJECT_DIR/" \
    --exclude 'node_modules' \
    --exclude '.next' \
    --exclude '.git' \
    --exclude 'scripts/create-project.sh' \
    --exclude '.env.local' \
    --exclude '*.log' \
    > /dev/null 2>&1

# ============================================
# ÉTAPE 6: Configuration
# ============================================

echo -e "  ${GREEN}✓${NC} Configuration du projet..."

# Créer le fichier .env.local
cat > "$PROJECT_DIR/.env.local" << EOF
# ============================================
# CONFIGURATION - $DISPLAY_NAME
# Généré le $(date +%Y-%m-%d)
# ============================================

# Application
NEXT_PUBLIC_APP_NAME="$DISPLAY_NAME"
NEXT_PUBLIC_APP_URL="${SITE_URL:-http://localhost:3000}"
NEXT_PUBLIC_CONTACT_EMAIL="${CONTACT_EMAIL:-contact@example.com}"
SITE_ID="$DIR_NAME"

# Base de données
DATABASE_URL="sqlserver://localhost:1433;database=${DIR_NAME};user=sa;password=YOUR_PASSWORD;encrypt=true;trustServerCertificate=true"

# NextAuth
NEXTAUTH_URL="${SITE_URL:-http://localhost:3000}"
NEXTAUTH_SECRET="$(openssl rand -base64 32)"

# Chiffrement
ENCRYPTION_KEY="$(openssl rand -hex 32)"

# Azure Key Vault (à configurer)
# AZURE_KEY_VAULT_URL=https://your-vault.vault.azure.net/
# AZURE_CLIENT_ID=
# AZURE_CLIENT_SECRET=
# AZURE_TENANT_ID=

# OAuth Providers (à configurer)
# GOOGLE_CLIENT_ID=
# GOOGLE_CLIENT_SECRET=
# APPLE_CLIENT_ID=
# APPLE_CLIENT_SECRET=
# FACEBOOK_CLIENT_ID=
# FACEBOOK_CLIENT_SECRET=
# TWITTER_CLIENT_ID=
# TWITTER_CLIENT_SECRET=

# Stripe (à configurer)
# STRIPE_PUBLISHABLE_KEY=
# STRIPE_SECRET_KEY=
# STRIPE_WEBHOOK_SECRET=

# PayPal (à configurer)
# PAYPAL_CLIENT_ID=
# PAYPAL_CLIENT_SECRET=
EOF

# Mettre à jour le package.json
echo -e "  ${GREEN}✓${NC} Mise à jour de package.json..."
sed -i.bak "s/\"name\": \"secure-web-template\"/\"name\": \"$DIR_NAME\"/" "$PROJECT_DIR/package.json"
rm -f "$PROJECT_DIR/package.json.bak"

# Mettre à jour la config du site
if [ -f "$PROJECT_DIR/src/config/site.ts" ]; then
    sed -i.bak "s/SITE_ID: .*/SITE_ID: '$DIR_NAME',/" "$PROJECT_DIR/src/config/site.ts"
    sed -i.bak "s/name: .*/name: '$DISPLAY_NAME',/" "$PROJECT_DIR/src/config/site.ts"
    rm -f "$PROJECT_DIR/src/config/site.ts.bak"
fi

# ============================================
# ÉTAPE 7: Initialisation Git
# ============================================

echo -e "  ${GREEN}✓${NC} Initialisation Git..."
cd "$PROJECT_DIR"
git init > /dev/null 2>&1
git add . > /dev/null 2>&1
git commit -m "🎉 Initial commit - $DISPLAY_NAME (from secure-web-template)" > /dev/null 2>&1

# ============================================
# TERMINÉ
# ============================================

echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ PROJET CRÉÉ AVEC SUCCÈS!${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "  📁 Répertoire: ${CYAN}$PROJECT_DIR${NC}"
echo ""
echo -e "${YELLOW}Prochaines étapes:${NC}"
echo ""
echo -e "  1. ${CYAN}cd $PROJECT_DIR${NC}"
echo -e "  2. ${CYAN}npm install${NC}"
echo -e "  3. Configurer ${CYAN}.env.local${NC} avec vos clés API"
echo -e "  4. ${CYAN}npx prisma generate${NC}"
echo -e "  5. ${CYAN}npx prisma db push${NC}"
echo -e "  6. ${CYAN}npm run dev${NC}"
echo ""
echo -e "${PURPLE}🔒 N'oubliez pas de configurer Azure Key Vault pour la production!${NC}"
echo ""
