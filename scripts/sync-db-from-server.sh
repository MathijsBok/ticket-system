#!/bin/bash

# Sync database from production server to local MacBook
# Usage: ./scripts/sync-db-from-server.sh

set -e

SERVER="root@151.106.34.63"
REMOTE_DB="ticket_system_dev"
LOCAL_DB="ticket_system"
DUMP_FILE="/tmp/ticket_db_backup.dump"

echo "=== Database Sync: Server -> Local ==="
echo ""

# Step 1: Create dump on server
echo "1. Creating database dump on server..."
ssh $SERVER "pg_dump -U postgres -d $REMOTE_DB -F c -f $DUMP_FILE"
echo "   Done."

# Step 2: Download dump file
echo "2. Downloading dump file..."
scp $SERVER:$DUMP_FILE $DUMP_FILE
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
ssh $SERVER "rm -f $DUMP_FILE"

echo ""
echo "=== Database sync complete! ==="
echo "Local database '$LOCAL_DB' now matches server '$REMOTE_DB'"
