#!/bin/bash

# Deploy to Production Environment
# Usage: ./deploy-prod.sh
# Run this on your server

set -e

echo "========================================"
echo "  Deploying to PRODUCTION Environment"
echo "  support.kleverchain.cloud"
echo "========================================"
echo ""

APP_DIR="/var/www/ticket-system-prod"
REPO_URL="git@github.com:klever-io/ticket-system.git"
BRANCH="main"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Confirmation prompt
echo -e "${RED}WARNING: You are deploying to PRODUCTION!${NC}"
read -p "Are you sure you want to continue? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Deployment cancelled."
    exit 1
fi

echo -e "${YELLOW}[1/7] Pulling latest code from ${BRANCH}...${NC}"
cd $APP_DIR
git fetch origin
git checkout $BRANCH
git pull origin $BRANCH

echo -e "${YELLOW}[2/7] Installing backend dependencies...${NC}"
cd $APP_DIR/backend
npm ci --production

echo -e "${YELLOW}[3/7] Building backend...${NC}"
npm run build

echo -e "${YELLOW}[4/7] Running database migrations...${NC}"
npm run db:migrate

echo -e "${YELLOW}[5/7] Installing frontend dependencies...${NC}"
cd $APP_DIR/frontend
npm ci

echo -e "${YELLOW}[6/7] Building frontend for production...${NC}"
npm run build

echo -e "${YELLOW}[7/7] Restarting PM2 processes...${NC}"
pm2 restart ticket-prod-backend

echo ""
echo -e "${GREEN}========================================"
echo "  Production deployment complete!"
echo "  https://support.kleverchain.cloud"
echo "========================================${NC}"
