#!/bin/bash

# Deploy Prisma migrations to server
# Usage: ./scripts/push-schema-to-server.sh
#
# Note: Create migrations locally first with:
#   cd backend && npx prisma migrate dev --name migration_name

set -e

SERVER="root@151.106.34.63"
REMOTE_PATH="/var/www/ticket-system-dev/backend"

echo "=== Deploying Migrations to Server ==="
echo ""

# Step 1: Deploy migrations on server
echo "1. Deploying Prisma migrations on server..."
ssh $SERVER "cd $REMOTE_PATH && git pull && npx prisma migrate deploy"
echo "   Done."

# Step 2: Rebuild backend
echo "2. Rebuilding backend..."
ssh $SERVER "cd $REMOTE_PATH && npm run build"
echo "   Done."

# Step 3: Restart PM2
echo "3. Restarting backend service..."
ssh $SERVER "pm2 restart ticket-dev-backend"
echo "   Done."

echo ""
echo "=== Migrations deployed to server! ==="
