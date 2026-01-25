# Ticket Management System

A comprehensive ticket management system with role-based access control, real-time updates, and analytics.

## Features

### User Features
- Submit support tickets with subject, description, and priority
- View all personal tickets in a dashboard
- Track ticket status (New, Open, Pending, On Hold, Solved, Closed)
- Reply to tickets and view conversation history
- Dark/Light theme toggle

### Agent Features
- View all tickets across the system
- Filter tickets by status (New, Open, Pending, On Hold, Solved)
- Assign tickets to themselves
- Reply to tickets (public and internal notes)
- Update ticket status and priority
- Automatic session tracking (login time, duration, reply counts)
- Dashboard with ticket statistics

### Admin Features
- Complete agent performance analytics dashboard
- Track agent sessions (login/logout times, duration, activity)
- View agent metrics (total replies, tickets assigned, solve rate)
- Monitor system-wide statistics
- Create and manage custom ticket forms
- Full access to all agent features

### System Features
- Ticket numbering starting from 0
- Activity log for each ticket (who responded, when)
- File attachments support
- Custom ticket forms
- Role-based permissions (User, Agent, Admin)
- RESTful API architecture
- Dark and Light theme support

## Tech Stack

### Backend
- Node.js with Express
- TypeScript
- PostgreSQL database
- Prisma ORM
- Clerk authentication

### Frontend
- React with TypeScript
- Vite build tool
- TailwindCSS for styling
- React Router for navigation
- React Query for data fetching
- Clerk React SDK

## Prerequisites

Before you begin, ensure you have:
- Node.js 18+ installed
- PostgreSQL 14+ installed and running
- A Clerk account (free tier available at https://clerk.com)

## Setup Instructions

### 1. Install Dependencies

```bash
# Install root dependencies
npm install

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install

cd ..
```

### 2. Set Up Clerk Authentication

1. Go to https://clerk.com and create a free account
2. Create a new application in Clerk dashboard
3. Get your Publishable Key and Secret Key from the API Keys section
4. In Clerk dashboard, go to "User & Authentication" > "Metadata"
5. Add a public metadata field called "role" (this will store USER, AGENT, or ADMIN)

### 3. Configure Environment Variables

#### Backend (.env)
```bash
cd backend
cp .env.example .env
```

Edit `backend/.env`:
```
DATABASE_URL="postgresql://postgres:yourpassword@localhost:5432/ticket_system?schema=public"
PORT=3001
NODE_ENV=development

CLERK_PUBLISHABLE_KEY=pk_test_your_key_here
CLERK_SECRET_KEY=sk_test_your_key_here

UPLOAD_DIR=./uploads
MAX_FILE_SIZE=10485760

FRONTEND_URL=http://localhost:5173
```

#### Frontend (.env)
```bash
cd ../frontend
cp .env.example .env
```

Edit `frontend/.env`:
```
VITE_CLERK_PUBLISHABLE_KEY=pk_test_your_key_here
VITE_API_URL=http://localhost:3001/api
```

### 4. Set Up Database

```bash
cd backend

# Generate Prisma client
npm run db:generate

# Run database migrations
npm run db:migrate

# Optional: Open Prisma Studio to view/manage data
npm run db:studio
```

### 5. Start the Application

Open two terminal windows:

Terminal 1 (Backend):
```bash
cd backend
npm run dev
```

Terminal 2 (Frontend):
```bash
cd frontend
npm run dev
```

The application will be available at:
- Frontend: http://localhost:5173
- Backend: http://localhost:3001

## Setting Up User Roles

Since this is a new installation, you'll need to manually set user roles in Clerk:

1. Sign up a user through the application
2. Go to Clerk Dashboard > Users
3. Click on the user
4. Scroll to "Public metadata"
5. Add: `{"role": "ADMIN"}` for admin, `{"role": "AGENT"}` for agent, or `{"role": "USER"}` for regular user
6. Save changes

## Database Schema

### Core Tables
- **Users**: Stores user accounts with roles (USER, AGENT, ADMIN)
- **Tickets**: Main ticket entity with status, priority, assignments
- **Comments**: Ticket replies and internal notes
- **Attachments**: File uploads linked to tickets
- **Forms**: Custom ticket submission forms (created by admin)
- **Categories**: Ticket categorization
- **TicketActivity**: Activity log for each ticket
- **AgentSession**: Agent login/logout tracking with metrics

### Ticket Statuses
- NEW: Freshly created ticket
- OPEN: Agent is working on it
- PENDING: Waiting for customer response
- ON_HOLD: Temporarily paused
- SOLVED: Issue resolved
- CLOSED: Ticket archived

### Priority Levels
- LOW
- NORMAL
- HIGH
- URGENT

## API Endpoints

### Tickets
- `GET /api/tickets` - Get all tickets (filtered by user role)
- `GET /api/tickets/:id` - Get single ticket with comments
- `POST /api/tickets` - Create new ticket
- `PATCH /api/tickets/:id` - Update ticket (status, priority, assignment)
- `GET /api/tickets/stats/overview` - Get ticket statistics

### Comments
- `POST /api/comments` - Add reply to ticket
- `GET /api/comments/ticket/:ticketId` - Get all comments for a ticket

### Attachments
- `POST /api/attachments/upload` - Upload file
- `GET /api/attachments/:id/download` - Download file

### Forms (Admin only)
- `GET /api/forms` - Get all active forms
- `GET /api/forms/:id` - Get single form
- `POST /api/forms` - Create new form
- `PATCH /api/forms/:id` - Update form
- `DELETE /api/forms/:id` - Delete form

### Analytics (Admin only)
- `GET /api/analytics/agents` - Get agent performance metrics
- `GET /api/analytics/system` - Get system-wide statistics
- `GET /api/analytics/agents/:agentId/sessions` - Get agent session history

### Sessions (Agent only)
- `POST /api/sessions/start` - Start agent session
- `POST /api/sessions/end/:sessionId` - End agent session
- `GET /api/sessions/current` - Get current active session

## Theme System

The application supports dark and light themes:
- Toggle button in the header (sun/moon icon)
- Preference saved to localStorage
- Persists across sessions
- Applies to all pages and components

## Development

### Running Tests
```bash
# Backend tests (when implemented)
cd backend
npm test

# Frontend tests (when implemented)
cd frontend
npm test
```

### Building for Production
```bash
# Build backend
cd backend
npm run build
npm start

# Build frontend
cd frontend
npm run build
npm run preview
```

## Project Structure

```
ticket-system/
├── backend/
│   ├── src/
│   │   ├── routes/          # API route handlers
│   │   ├── middleware/      # Auth and validation middleware
│   │   ├── lib/             # Utilities (Prisma client)
│   │   └── server.ts        # Express app entry point
│   ├── prisma/
│   │   └── schema.prisma    # Database schema
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── pages/           # Route components
│   │   ├── components/      # Reusable UI components
│   │   ├── contexts/        # React contexts (Theme)
│   │   ├── lib/             # API client utilities
│   │   ├── App.tsx          # Main app component
│   │   ├── main.tsx         # Entry point
│   │   └── index.css        # Global styles
│   ├── package.json
│   └── vite.config.ts
└── package.json             # Root package.json

```

## Security Notes

- All routes are protected with Clerk authentication
- Role-based access control enforced on both frontend and backend
- Users can only view their own tickets
- Agents/Admins can view all tickets
- Internal notes only visible to agents and admins
- File uploads have size limits and type validation
- SQL injection protection via Prisma ORM
- XSS protection via input sanitization

## Next Steps

After basic setup, consider adding:
- Email notifications for ticket updates
- Real-time updates using WebSockets
- Advanced search and filtering
- Custom SLA rules and escalation
- Knowledge base integration
- Multi-language support
- Export tickets to CSV/PDF

## License

MIT
