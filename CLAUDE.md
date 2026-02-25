# Ticket System - Claude Code Memory

## Database Workflow

### Schema Changes - Use Migrations
**IMPORTANT**: Avoid changing the schema.prisma file directly. Instead, prefer creating migrations that do so. This ensures that databases already running are correctly updated.

```bash
# Create a migration locally
cd backend && npx prisma migrate dev --name descriptive_migration_name

# Deploy migrations to server (uses env vars from .env.deploy)
./scripts/push-schema-to-server.sh
```

### Syncing Database from Server to Local
When working with database changes:
1. Clone the production database from server to local MacBook
2. Apply schema changes both locally AND on the server
3. Always run `npx prisma migrate dev` or migrations on both environments

```bash
# Sync database from server to local (uses env vars from .env.deploy)
./scripts/sync-db-from-server.sh
```

### Web UI Import/Export
The application now has a built-in database import/export feature in the Admin Settings > Maintenance tab:
- **Export**: Downloads a pg_dump custom format backup
- **Import**: Uploads and restores a .dump, .sql, or .backup file
- Warning: Import REPLACES ALL DATA - requires confirmation

## Project Structure
- `/backend` - Express.js API with Prisma ORM
- `/frontend` - React frontend with TypeScript

## Common Commands
- Build backend: `cd backend && npm run build`
- Create migration: `npx prisma migrate dev --name migration_name`
- Deploy migrations: `npx prisma migrate deploy`
- Generate client: `npx prisma generate`

## UI/UX Guidelines

### No Native Browser Popups
**MANDATORY**: Never use native browser dialogs (`window.alert()`, `window.confirm()`, `window.prompt()`).
- Always use in-app modals, toast notifications, or custom confirmation dialogs
- Native popups break the app's design and user experience
- Use `react-hot-toast` for notifications
- Create custom modal components for confirmations
