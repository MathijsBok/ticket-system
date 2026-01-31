# Ticket System - Claude Code Memory

## Database Workflow

### Syncing Database from Server to Local
When working with database changes:
1. Clone the production database from server to local MacBook
2. Apply schema changes both locally AND on the server
3. Always run `npx prisma db push` or migrations on both environments

### Clone Database Commands

**From server to local:**
```bash
# SSH into server and dump the database
ssh root@151.106.34.63 "pg_dump -U postgres -d ticket_system_dev -F c -f /tmp/ticket_db_backup.dump"

# Copy dump file to local
scp root@151.106.34.63:/tmp/ticket_db_backup.dump /tmp/

# Restore locally (drops and recreates)
dropdb ticket_system 2>/dev/null; createdb ticket_system
pg_restore -d ticket_system /tmp/ticket_db_backup.dump
```

**After schema changes:**
```bash
# Local
cd backend && npx prisma db push && npx prisma generate

# Server
ssh root@151.106.34.63 "cd /var/www/ticket-system-dev/backend && npx prisma db push && npm run build && pm2 restart ticket-dev-backend"
```

### Web UI Import/Export
The application now has a built-in database import/export feature in the Admin Settings > Maintenance tab:
- **Export**: Downloads a pg_dump custom format backup
- **Import**: Uploads and restores a .dump, .sql, or .backup file
- Warning: Import REPLACES ALL DATA - requires confirmation

### Server Details
- Server IP: 151.106.34.63
- Database: ticket_system_dev (production/dev server)
- Local Database: ticket_system

## Project Structure
- `/backend` - Express.js API with Prisma ORM
- `/frontend` - React frontend with TypeScript

## Common Commands
- Build backend: `cd backend && npm run build`
- Restart server: `pm2 restart ticket-dev-backend`
- Run migrations: `npx prisma db push`
- Generate client: `npx prisma generate`
