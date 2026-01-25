# Ticket Management System

A comprehensive ticket management system built with React, Node.js, and PostgreSQL. Features role-based dashboards, real-time ticket tracking, agent performance analytics, and customizable forms.

## Features

### User Features
- Submit and track support tickets
- View ticket history and status updates
- Add comments and replies to tickets
- File attachment support
- Light/Dark theme toggle

### Agent Features
- View and manage all customer tickets
- Assign tickets to self
- Update ticket status (New, Open, Pending, On Hold, Solved, Closed)
- Add internal notes (not visible to customers)
- Session tracking with automatic login/logout
- Filter tickets by status
- View ticket statistics dashboard

### Admin Features
- System analytics and overview
- Agent performance metrics
  - Session duration tracking
  - Reply count statistics
  - Ticket resolution rates
  - Online/Offline status
- Custom form builder for ticket submission
- User and agent management
- Ticket statistics by status

## Tech Stack

### Frontend
- **React** with TypeScript
- **TailwindCSS** for styling
- **React Query** for server state management
- **React Router** for navigation
- **Clerk** for authentication
- **date-fns** for date formatting
- **react-hot-toast** for notifications

### Backend
- **Node.js** with Express
- **TypeScript**
- **Prisma ORM** for database management
- **PostgreSQL** database
- **Clerk** for authentication and user management
- **Multer** for file uploads

## Prerequisites

- Node.js (v16 or higher)
- PostgreSQL (v14 or higher)
- npm or yarn
- Clerk account (free tier available)

## Installation

### 1. Clone the repository

```bash
git clone <repository-url>
cd ticket-system
```

### 2. Install dependencies

```bash
# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### 3. Set up PostgreSQL

```bash
# Install PostgreSQL (macOS)
brew install postgresql@14
brew services start postgresql@14

# Create database
createdb ticket_system
```

### 4. Configure environment variables

#### Backend (.env)

Create a `.env` file in the `backend` directory:

```env
# Database
DATABASE_URL="postgresql://YOUR_USERNAME@localhost:5432/ticket_system?schema=public"

# Clerk Authentication
CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
CLERK_SECRET_KEY=your_clerk_secret_key

# Server
PORT=3001
CORS_ORIGIN=http://localhost:5173

# Uploads
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=5242880
```

#### Frontend (.env)

Create a `.env` file in the `frontend` directory:

```env
# Clerk Authentication
VITE_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key

# Backend API URL
VITE_API_URL=http://localhost:3001/api
```

### 5. Set up Clerk Authentication

1. Create a free account at [clerk.com](https://clerk.com)
2. Create a new application
3. Copy the publishable key and secret key to your `.env` files
4. Configure OAuth providers (optional):
   - Go to "User & Authentication" > "Social Connections"
   - Enable Google, GitHub, or other providers

### 6. Run database migrations

```bash
cd backend
npx prisma migrate dev
npx prisma db seed
```

This will create the database schema and seed it with:
- 3 default categories (Technical Support, Billing, General Inquiry)
- 1 default ticket form

### 7. Start the development servers

```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend
cd frontend
npm run dev
```

The application will be available at:
- Frontend: http://localhost:5173
- Backend API: http://localhost:3001

## Project Structure

```
ticket-system/
├── backend/
│   ├── src/
│   │   ├── middleware/      # Auth and error handling middleware
│   │   ├── routes/          # API route handlers
│   │   ├── lib/             # Prisma client and utilities
│   │   ├── scripts/         # Helper scripts
│   │   └── server.ts        # Express server setup
│   ├── prisma/
│   │   ├── schema.prisma    # Database schema
│   │   └── seed.ts          # Database seeding
│   └── uploads/             # File upload storage
│
├── frontend/
│   ├── src/
│   │   ├── components/      # Reusable UI components
│   │   ├── pages/           # Page components
│   │   ├── contexts/        # React contexts (Theme)
│   │   ├── lib/             # API client and utilities
│   │   └── main.tsx         # Application entry point
│   └── public/              # Static assets
│
└── README.md
```

## User Roles

The system supports three user roles:

1. **USER** (Default)
   - Can create and view their own tickets
   - Can add comments to their tickets
   - Dashboard: `/user`

2. **AGENT**
   - Can view and manage all tickets
   - Can assign tickets and update status
   - Session tracking enabled
   - Dashboard: `/agent`

3. **ADMIN**
   - Full system access
   - View analytics and agent performance
   - Create and manage custom forms
   - Dashboard: `/admin`

### Changing User Roles

User roles are automatically set to `USER` on first login. To change roles:

1. Go to your Clerk Dashboard
2. Navigate to "Users"
3. Select a user
4. Click "Metadata" > "Public metadata"
5. Add: `{ "role": "AGENT" }` or `{ "role": "ADMIN" }`
6. User will get the new role on next login

## API Endpoints

### Tickets
- `GET /api/tickets` - Get all tickets (with filters)
- `GET /api/tickets/stats` - Get ticket statistics
- `GET /api/tickets/:id` - Get ticket by ID
- `POST /api/tickets` - Create new ticket
- `PATCH /api/tickets/:id` - Update ticket

### Comments
- `POST /api/tickets/:id/comments` - Add comment to ticket

### Forms
- `GET /api/forms` - Get all forms
- `POST /api/forms` - Create new form (Admin only)
- `DELETE /api/forms/:id` - Delete form (Admin only)

### Analytics
- `GET /api/analytics/agents` - Get agent statistics (Admin only)
- `GET /api/analytics/system` - Get system overview (Admin only)

### Sessions
- `POST /api/sessions/start` - Start agent session
- `POST /api/sessions/:id/end` - End agent session

## Database Schema

Key entities:
- **Users**: System users with role-based access
- **Tickets**: Support tickets with auto-incrementing numbers
- **Comments**: Ticket replies and internal notes
- **Activities**: Audit log for ticket changes
- **Categories**: Ticket categorization
- **Forms**: Custom ticket submission forms
- **Sessions**: Agent login/logout tracking
- **Attachments**: File uploads

## Development

### Running migrations

```bash
cd backend
npx prisma migrate dev --name migration_name
```

### Resetting the database

```bash
cd backend
npx prisma migrate reset
```

### Generating Prisma Client

```bash
cd backend
npx prisma generate
```

### Viewing the database

```bash
cd backend
npx prisma studio
```

## Production Build

### Backend

```bash
cd backend
npm run build
npm start
```

### Frontend

```bash
cd frontend
npm run build
npm run preview
```

## Theme Support

The application includes a light/dark theme toggle:
- Theme preference is saved to localStorage
- Automatic system preference detection
- CSS custom properties for easy customization
- Edit colors in `frontend/src/index.css`

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License.

## Support

For issues and questions, please create an issue in the GitHub repository.
