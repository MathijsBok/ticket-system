#!/bin/bash

# Push Prisma schema changes to server
# Usage: ./scripts/push-schema-to-server.sh

set -e

SERVER="root@151.106.34.63"
REMOTE_PATH="/var/www/ticket-system-dev/backend"

echo "=== Pushing Schema Changes to Server ==="
echo ""

# Step 1: Apply schema changes on server
echo "1. Applying Prisma schema on server..."
ssh $SERVER "cd $REMOTE_PATH && git pull && npx prisma db push"
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
echo "=== Schema changes deployed to server! ==="
