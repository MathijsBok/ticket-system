# Quick Start Guide

This guide will help you get the ticket system running in under 10 minutes.

## Step 1: Run Setup Script

```bash
cd ticket-system
./setup.sh
```

This will install all dependencies for both frontend and backend.

## Step 2: Set Up Clerk

1. Visit https://clerk.com and sign up for free
2. Create a new application
3. Copy your keys from the API Keys page

## Step 3: Configure Environment

### Backend
```bash
cd backend
cp .env.example .env
```

Edit `.env` and add your Clerk keys:
```
CLERK_PUBLISHABLE_KEY=pk_test_xxxxx
CLERK_SECRET_KEY=sk_test_xxxxx
DATABASE_URL="postgresql://postgres:yourpassword@localhost:5432/ticket_system"
```

### Frontend
```bash
cd ../frontend
cp .env.example .env
```

Edit `.env` and add:
```
VITE_CLERK_PUBLISHABLE_KEY=pk_test_xxxxx
```

## Step 4: Set Up Database

```bash
# Create database
createdb ticket_system

# Run migrations
cd backend
npm run db:migrate
```

## Step 5: Start Application

From the root directory:
```bash
npm run dev
```

This starts both backend (port 3001) and frontend (port 5173).

## Step 6: Create Your First Admin User

1. Open http://localhost:5173
2. Sign up with your email
3. Go to Clerk Dashboard > Users
4. Click on your user
5. Add to Public metadata: `{"role": "ADMIN"}`
6. Refresh the app

You're now an admin with full access!

## Creating Additional Users

For testing, create multiple accounts and assign different roles:
- `{"role": "USER"}` - Can submit and view their own tickets
- `{"role": "AGENT"}` - Can view all tickets and respond
- `{"role": "ADMIN"}` - Full system access with analytics

## Troubleshooting

### Database Connection Error
- Ensure PostgreSQL is running: `pg_ctl status`
- Check your DATABASE_URL in backend/.env
- Verify database exists: `psql -l`

### Clerk Authentication Error
- Verify your Clerk keys are correct
- Check that keys match between frontend and backend
- Ensure your Clerk app is in development mode

### Port Already in Use
- Backend (3001): Change PORT in backend/.env
- Frontend (5173): Change port in frontend/vite.config.ts

## Default Credentials

This system uses Clerk authentication, so there are no default credentials. You create your own account during signup.

## Testing the System

1. Sign in as a USER and create a ticket
2. Sign in as an AGENT (different account) and respond to the ticket
3. Sign in as ADMIN and view analytics dashboard

Enjoy your ticket management system!
