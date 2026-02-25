#!/bin/bash

# Sync database from production server to local MacBook
# Usage: ./scripts/sync-db-from-server.sh
#
# Required environment variables (set in .env.deploy or export before running):
#   DEPLOY_SERVER - SSH connection string (e.g., user@hostname)
#   REMOTE_DB     - Remote database name
#   LOCAL_DB      - Local database name (default: ticket_system)

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

REMOTE_DB="${REMOTE_DB:-ticket_system_dev}"
LOCAL_DB="${LOCAL_DB:-ticket_system}"
DUMP_FILE="/tmp/ticket_db_backup.dump"

echo "=== Database Sync: Server -> Local ==="
echo ""

# Step 1: Create dump on server
echo "1. Creating database dump on server..."
ssh $DEPLOY_SERVER "pg_dump -U postgres -d $REMOTE_DB -F c -f $DUMP_FILE"
echo "   Done."

# Step 2: Download dump file
echo "2. Downloading dump file..."
scp $DEPLOY_SERVER:$DUMP_FILE $DUMP_FILE
echo "   Done."

# Step 3: Drop and recreate local database
echo "3. Recreating local database..."
dropdb $LOCAL_DB 2>/dev/null || true
createdb $LOCAL_DB
echo "   Done."

# Step 4: Restore dump locally
echo "4. Restoring database..."
pg_restore -d $LOCAL_DB $DUMP_FILE --no-owner --no-acl 2>/dev/null || true
echo "   Done."

# Step 5: Regenerate Prisma client
echo "5. Regenerating Prisma client..."
cd "$(dirname "$0")/../backend"
npx prisma generate
echo "   Done."

# Cleanup
rm -f $DUMP_FILE
ssh $DEPLOY_SERVER "rm -f $DUMP_FILE"

echo ""
echo "=== Database sync complete! ==="
echo "Local database '$LOCAL_DB' now matches server '$REMOTE_DB'"
