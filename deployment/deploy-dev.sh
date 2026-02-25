#!/bin/bash

# Deploy to Development Environment
# Usage: ./deploy-dev.sh
# Run this on your server

set -e

echo "========================================"
echo "  Deploying to DEVELOPMENT Environment"
echo "  dev.kleverchain.cloud"
echo "========================================"
echo ""

APP_DIR="/var/www/ticket-system-dev"
REPO_URL="git@github.com:klever-io/ticket-system.git"
BRANCH="develop"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}[1/6] Pulling latest code from ${BRANCH}...${NC}"
cd $APP_DIR
git fetch origin
git checkout $BRANCH
git pull origin $BRANCH

echo -e "${YELLOW}[2/6] Installing backend dependencies...${NC}"
cd $APP_DIR/backend
npm install

echo -e "${YELLOW}[3/6] Building backend...${NC}"
npm run build

echo -e "${YELLOW}[4/6] Running database migrations...${NC}"
npm run db:migrate

echo -e "${YELLOW}[5/6] Installing frontend dependencies...${NC}"
cd $APP_DIR/frontend
npm install

echo -e "${YELLOW}[6/6] Restarting PM2 processes...${NC}"
pm2 restart ticket-dev-backend
pm2 restart ticket-dev-frontend

echo ""
echo -e "${GREEN}========================================"
echo "  Development deployment complete!"
echo "  https://dev.kleverchain.cloud"
echo "========================================${NC}"
