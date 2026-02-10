#!/bin/bash
# BioCycle Peptides - Deployment Script
# Usage: ./scripts/deploy.sh [environment]

set -e

ENV=${1:-production}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "🚀 BioCycle Peptides - Deployment"
echo "=================================="
echo "Environment: $ENV"
echo "Project: $PROJECT_DIR"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Functions
log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Pre-deployment checks
log_info "Running pre-deployment checks..."

# Check Node version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
  log_error "Node.js 18+ required. Current: $(node -v)"
  exit 1
fi
log_info "Node.js version: $(node -v) ✓"

# Check environment file
if [ ! -f "$PROJECT_DIR/.env.local" ] && [ ! -f "$PROJECT_DIR/.env.production" ]; then
  log_warn "No .env file found. Make sure environment variables are set."
fi

# Install dependencies
log_info "Installing dependencies..."
cd "$PROJECT_DIR"
npm ci --production=false

# Run linting
log_info "Running linting..."
npm run lint || log_warn "Linting warnings detected (non-blocking)"

# Run tests
log_info "Running tests..."
npm test || {
  log_error "Tests failed. Aborting deployment."
  exit 1
}

# Build application
log_info "Building application..."
npm run build || {
  log_error "Build failed. Aborting deployment."
  exit 1
}

# Database migrations (if needed)
if [ "$ENV" = "production" ]; then
  log_info "Running database migrations..."
  npx prisma migrate deploy || log_warn "Migration warning (may be up to date)"
fi

log_info "=================================="
log_info "✅ Build successful!"
log_info ""
log_info "To deploy to Vercel:"
log_info "  vercel --prod"
log_info ""
log_info "To deploy to Azure:"
log_info "  az webapp up --name biocyclepeptides"
log_info ""
log_info "To run locally in production mode:"
log_info "  npm start"
