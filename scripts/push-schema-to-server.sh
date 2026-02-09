#!/bin/bash

# Deploy Prisma migrations to server
# Usage: ./scripts/push-schema-to-server.sh
#
# Required environment variables (set in .env.deploy or export before running):
#   DEPLOY_SERVER - SSH connection string (e.g., user@hostname)
#   DEPLOY_PATH   - Remote project path (default: /var/www/ticket-system-dev/backend)
#
# Note: Create migrations locally first with:
#   cd backend && npx prisma migrate dev --name migration_name

set -e

# Load deploy config if available
if [ -f "$(dirname "$0")/../.env.deploy" ]; then
  source "$(dirname "$0")/../.env.deploy"
fi

# Validate required variables
if [ -z "$DEPLOY_SERVER" ]; then
  echo "Error: DEPLOY_SERVER is not set. Set it in .env.deploy or export it."
  echo "Example: export DEPLOY_SERVER=user@hostname"
  exit 1
fi

DEPLOY_PATH="${DEPLOY_PATH:-/var/www/ticket-system-dev/backend}"

echo "=== Deploying Migrations to Server ==="
echo ""

# Step 1: Deploy migrations on server
echo "1. Deploying Prisma migrations on server..."
ssh $DEPLOY_SERVER "cd $DEPLOY_PATH && git pull && npx prisma migrate deploy"
echo "   Done."

# Step 2: Rebuild backend
echo "2. Rebuilding backend..."
ssh $DEPLOY_SERVER "cd $DEPLOY_PATH && npm run build"
echo "   Done."

# Step 3: Restart PM2
echo "3. Restarting backend service..."
ssh $DEPLOY_SERVER "pm2 restart ticket-dev-backend"
echo "   Done."

echo ""
echo "=== Migrations deployed to server! ==="
