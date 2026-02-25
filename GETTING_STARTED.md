# Getting Started

Complete walkthrough for setting up and using your ticket system for the first time.

## Prerequisites Checklist

Before you begin, make sure you have:
- [ ] Node.js 18 or higher (`node -v`)
- [ ] PostgreSQL 14 or higher (`psql --version`)
- [ ] npm or yarn package manager
- [ ] A Clerk account (free at https://clerk.com)
- [ ] PostgreSQL running locally or remotely

## Step-by-Step Setup

### 1. Install Dependencies

Run the automated setup script:
```bash
cd ticket-system
./setup.sh
```

Or manually:
```bash
npm install
cd backend && npm install
cd ../frontend && npm install
```

### 2. Set Up Clerk Authentication

#### Create Clerk Application
1. Go to https://clerk.com and sign up
2. Click "Create Application"
3. Choose "Email" as authentication method
4. Name it "Klever Support"

#### Get Your Keys
1. Go to "API Keys" in Clerk dashboard
2. Copy your **Publishable Key** (starts with `pk_test_`)
3. Copy your **Secret Key** (starts with `sk_test_`)

#### Configure User Roles
1. Go to "User & Authentication" > "Metadata"
2. Click "Add public metadata"
3. We'll use this to store user roles (USER, AGENT, ADMIN)

### 3. Configure Environment Files

#### Backend Configuration
```bash
cd backend
cp .env.example .env
```

Edit `backend/.env`:
```bash
# Database - Update with your PostgreSQL credentials
DATABASE_URL="postgresql://postgres:yourpassword@localhost:5432/ticket_system?schema=public"

# Server
PORT=3001
NODE_ENV=development

# Clerk - Add your keys from step 2
CLERK_PUBLISHABLE_KEY=pk_test_xxxxx
CLERK_SECRET_KEY=sk_test_xxxxx
CLERK_WEBHOOK_SECRET=whsec_xxxxx  # Get this from Clerk webhooks (step 4)

# File Upload
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=10485760

# CORS
FRONTEND_URL=http://localhost:5173
```

#### Frontend Configuration
```bash
cd ../frontend
cp .env.example .env
```

Edit `frontend/.env`:
```bash
VITE_CLERK_PUBLISHABLE_KEY=pk_test_xxxxx  # Same as backend
VITE_API_URL=http://localhost:3001/api
```

### 4. Set Up Clerk Webhooks (Important!)

This syncs Clerk users to your database:

1. In Clerk Dashboard, go to "Webhooks"
2. Click "Add Endpoint"
3. Enter URL: `http://localhost:3001/webhooks/clerk` (for development)
4. Select events:
   - `user.created`
   - `user.updated`
   - `user.deleted`
5. Copy the "Signing Secret" (starts with `whsec_`)
6. Add to `backend/.env` as `CLERK_WEBHOOK_SECRET`

**For local development**, use a tool like ngrok to expose localhost:
```bash
ngrok http 3001
# Use the ngrok URL in Clerk webhook configuration
# Example: https://abc123.ngrok.io/webhooks/clerk
```

### 5. Set Up PostgreSQL Database

#### Create Database
```bash
createdb ticket_system
```

Or using psql:
```sql
CREATE DATABASE ticket_system;
```

#### Run Migrations
```bash
cd backend
npm run db:generate   # Generate Prisma client
npm run db:migrate    # Run migrations
```

You should see output like:
```
✔ Generated Prisma Client
✔ Database migrations applied successfully
```

#### Seed Initial Data (Optional)
```bash
npm run db:seed
```

This creates:
- Sample categories (Technical Support, Billing, General)
- Sample ticket form

### 6. Start the Application

From the root directory:
```bash
npm run dev
```

This starts:
- Backend on http://localhost:3001
- Frontend on http://localhost:5173

You should see:
```
🚀 Server running on http://localhost:3001
  ➜  Local:   http://localhost:5173/
```

### 7. Create Your First Admin User

1. Open http://localhost:5173 in your browser
2. You'll be redirected to Clerk sign-in
3. Click "Sign up" and create an account with your email
4. Verify your email if prompted

#### Assign Admin Role
1. Go to Clerk Dashboard > Users
2. Click on your newly created user
3. Scroll to "Public metadata"
4. Click "Edit"
5. Add:
   ```json
   {"role": "ADMIN"}
   ```
6. Click "Save"
7. Go back to http://localhost:5173 and refresh

You should now see the Admin Dashboard!

### 8. Create Test Users

For testing, create additional accounts:

#### Create an Agent
1. Sign up with a different email
2. In Clerk dashboard, set public metadata:
   ```json
   {"role": "AGENT"}
   ```

#### Create a Regular User
1. Sign up with another email
2. In Clerk dashboard, set public metadata:
   ```json
   {"role": "USER"}
   ```

## Testing the System

### As a User (Customer)
1. Log in with your USER account
2. Click "New Ticket"
3. Fill in:
   - Subject: "Cannot log in to mobile app"
   - Priority: High
   - Description: "I'm getting an error when trying to log in..."
4. Submit ticket
5. Note the ticket number (should be #0 for first ticket)

### As an Agent
1. Log out and log in with your AGENT account
2. You'll see the Agent Dashboard
3. See the ticket you just created
4. Click on the ticket
5. Click "Assign to Me"
6. Type a reply: "Thanks for contacting us. Can you tell me which device you're using?"
7. Click "Send Reply"
8. Change status to "Pending" (waiting for customer response)

### As the User Again
1. Log out and log in with your USER account
2. Go to "My Tickets"
3. Click on your ticket
4. See the agent's reply
5. Note the status is "Pending"
6. Reply: "I'm using iPhone 14 with iOS 17"

### As an Admin
1. Log in with your ADMIN account
2. Go to Admin Dashboard
3. See system statistics:
   - Total tickets: 1
   - Tickets by status
   - Agent performance metrics
4. See your agent account in the table with:
   - 1 session
   - 1 reply
   - 1 assigned ticket
   - Online status

5. Go to "Forms" menu
6. Create a custom form for "Bug Report"

## Verifying Everything Works

### Check Database
```bash
cd backend
npm run db:studio
```

This opens Prisma Studio where you can:
- See all your tickets
- View users synced from Clerk
- Check comments and activities
- Verify agent sessions

### Check API Health
```bash
curl http://localhost:3001/health
```

Should return:
```json
{"status":"ok","timestamp":"2024-01-25T..."}
```

### Check Theme Toggle
1. Click the sun/moon icon in header
2. Page should switch between light and dark mode
3. Refresh the page - theme should persist

## Common Issues

### "Cannot connect to database"
- Check PostgreSQL is running: `pg_ctl status`
- Verify DATABASE_URL in backend/.env
- Ensure database exists: `psql -l | grep ticket_system`

### "Unauthorized" error in API calls
- Check Clerk keys are correct in both .env files
- Verify you're logged in
- Check network tab for 401 errors
- Ensure webhook is configured and user is synced to database

### "Port already in use"
- Backend: Change PORT in backend/.env
- Frontend: Change port in frontend/vite.config.ts server section

### Webhook not working
- For local dev, use ngrok to expose localhost
- Check CLERK_WEBHOOK_SECRET matches Clerk dashboard
- Verify webhook endpoint is accessible

### User not appearing in database
- Check webhook is configured correctly
- Manually create user in database if needed:
  ```sql
  INSERT INTO "User" (id, "clerkId", email, role, "createdAt", "updatedAt")
  VALUES (
    gen_random_uuid(),
    'user_clerk_id_from_clerk_dashboard',
    'user@example.com',
    'ADMIN',
    NOW(),
    NOW()
  );
  ```

## What to Do Next

### Customize the System
1. Update branding in frontend/src/components/Layout.tsx
2. Modify color scheme in frontend/tailwind.config.js
3. Add your logo to frontend/public/
4. Customize email templates (when implemented)

### Add More Features
See PROJECT_SUMMARY.md for suggested enhancements.

### Deploy to Production
See DEPLOYMENT.md for production deployment guide.

## Getting Help

- Check README.md for technical details
- See USER_GUIDE.md for usage instructions
- Review API endpoints in PROJECT_SUMMARY.md
- Check Prisma schema for database structure

## Success Criteria

You'll know everything is working when:
- ✅ You can sign up and log in
- ✅ Users see their dashboard
- ✅ Agents see all tickets dashboard
- ✅ Admins see analytics dashboard
- ✅ You can create a ticket
- ✅ Agents can reply to tickets
- ✅ Status updates work
- ✅ Theme toggle works
- ✅ Session tracking appears in admin dashboard
- ✅ Activity log shows in ticket detail

Congratulations! Your ticket system is ready to use.
