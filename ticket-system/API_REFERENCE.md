# API Reference

Complete reference for all API endpoints.

## Base URL
Development: `http://localhost:3001/api`

## Authentication
All API requests require authentication via Clerk JWT token.

Include token in header:
```
Authorization: Bearer <clerk_jwt_token>
```

## Common Response Codes
- 200: Success
- 201: Created
- 400: Bad Request (validation error)
- 401: Unauthorized (not logged in)
- 403: Forbidden (insufficient permissions)
- 404: Not Found
- 500: Internal Server Error

---

## Tickets

### Get All Tickets
```
GET /api/tickets
```

Query Parameters:
- `status` (optional): Filter by status (NEW, OPEN, PENDING, ON_HOLD, SOLVED, CLOSED)
- `assigneeId` (optional): Filter by assigned agent (UUID)
- `requesterId` (optional): Filter by requester (UUID)

Response:
```json
[
  {
    "id": "uuid",
    "ticketNumber": 0,
    "subject": "Cannot login",
    "status": "NEW",
    "priority": "HIGH",
    "channel": "WEB",
    "requesterId": "uuid",
    "assigneeId": null,
    "createdAt": "2024-01-25T10:00:00.000Z",
    "updatedAt": "2024-01-25T10:00:00.000Z",
    "requester": {
      "id": "uuid",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe"
    },
    "assignee": null,
    "_count": {
      "comments": 1
    }
  }
]
```

### Get Single Ticket
```
GET /api/tickets/:id
```

Response:
```json
{
  "id": "uuid",
  "ticketNumber": 0,
  "subject": "Cannot login",
  "status": "OPEN",
  "comments": [
    {
      "id": "uuid",
      "body": "Initial description...",
      "bodyPlain": "Initial description...",
      "isInternal": false,
      "author": {
        "email": "user@example.com"
      },
      "createdAt": "2024-01-25T10:00:00.000Z"
    }
  ],
  "activities": [
    {
      "id": "uuid",
      "action": "ticket_created",
      "details": {},
      "createdAt": "2024-01-25T10:00:00.000Z"
    }
  ]
}
```

### Create Ticket
```
POST /api/tickets
```

Request Body:
```json
{
  "subject": "Cannot login to mobile app",
  "description": "Getting error 500 when trying to login",
  "channel": "WEB",
  "priority": "HIGH",
  "categoryId": "uuid" // optional
}
```

Response: `201 Created`
```json
{
  "id": "uuid",
  "ticketNumber": 5,
  "subject": "Cannot login to mobile app",
  "status": "NEW",
  "comments": [...]
}
```

### Update Ticket
```
PATCH /api/tickets/:id
```

Requires: AGENT or ADMIN role

Request Body (all fields optional):
```json
{
  "status": "OPEN",
  "priority": "URGENT",
  "assigneeId": "uuid",
  "categoryId": "uuid"
}
```

### Get Ticket Statistics
```
GET /api/tickets/stats/overview
```

Response:
```json
{
  "total": 42,
  "byStatus": {
    "new": 5,
    "open": 12,
    "pending": 8,
    "onHold": 3,
    "solved": 10,
    "closed": 4
  }
}
```

---

## Comments

### Create Comment
```
POST /api/comments
```

Request Body:
```json
{
  "ticketId": "uuid",
  "body": "Thanks for reporting. Can you provide more details?",
  "bodyPlain": "Thanks for reporting. Can you provide more details?",
  "isInternal": false  // optional, agents only
}
```

Response: `201 Created`
```json
{
  "id": "uuid",
  "ticketId": "uuid",
  "authorId": "uuid",
  "body": "Thanks for reporting...",
  "isInternal": false,
  "createdAt": "2024-01-25T10:30:00.000Z",
  "author": {
    "email": "agent@example.com"
  }
}
```

### Get Comments by Ticket
```
GET /api/comments/ticket/:ticketId
```

Response:
```json
[
  {
    "id": "uuid",
    "body": "Comment text",
    "bodyPlain": "Comment text",
    "isInternal": false,
    "isSystem": false,
    "author": {
      "email": "user@example.com"
    },
    "createdAt": "2024-01-25T10:00:00.000Z"
  }
]
```

---

## Attachments

### Upload Attachment
```
POST /api/attachments/upload
```

Content-Type: `multipart/form-data`

Form Data:
- `file`: File (required)
- `ticketId`: UUID (required)
- `commentId`: UUID (optional)

Response: `201 Created`
```json
{
  "id": "uuid",
  "ticketId": "uuid",
  "filename": "screenshot.png",
  "fileSize": "1048576",
  "mimeType": "image/png",
  "createdAt": "2024-01-25T10:00:00.000Z"
}
```

### Download Attachment
```
GET /api/attachments/:id/download
```

Returns file as binary stream.

---

## Forms (Admin Only)

### Get All Forms
```
GET /api/forms
```

Response:
```json
[
  {
    "id": "uuid",
    "name": "Technical Support Request",
    "description": "For technical issues",
    "isActive": true,
    "fields": [
      {
        "id": "field_1",
        "label": "Product",
        "type": "select",
        "required": true,
        "options": ["Web", "Mobile", "API"]
      }
    ],
    "createdAt": "2024-01-25T10:00:00.000Z"
  }
]
```

### Get Single Form
```
GET /api/forms/:id
```

### Create Form
```
POST /api/forms
```

Requires: ADMIN role

Request Body:
```json
{
  "name": "Bug Report Form",
  "description": "Report software bugs",
  "fields": [
    {
      "id": "field_1",
      "label": "Bug severity",
      "type": "select",
      "required": true,
      "options": ["Low", "Medium", "High", "Critical"]
    },
    {
      "id": "field_2",
      "label": "Steps to reproduce",
      "type": "textarea",
      "required": true
    }
  ],
  "isActive": true
}
```

### Update Form
```
PATCH /api/forms/:id
```

Requires: ADMIN role

Request Body (all optional):
```json
{
  "name": "Updated Form Name",
  "description": "Updated description",
  "fields": [...],
  "isActive": false
}
```

### Delete Form
```
DELETE /api/forms/:id
```

Requires: ADMIN role

---

## Analytics (Admin Only)

### Get Agent Statistics
```
GET /api/analytics/agents
```

Requires: ADMIN role

Response:
```json
[
  {
    "agent": {
      "id": "uuid",
      "email": "agent@example.com",
      "name": "John Agent",
      "role": "AGENT"
    },
    "sessions": {
      "total": 15,
      "totalDuration": 54000,  // seconds
      "avgDuration": 3600,     // seconds
      "lastLogin": "2024-01-25T09:00:00.000Z",
      "isOnline": true
    },
    "tickets": {
      "assigned": 45,
      "solved": 38,
      "solveRate": 84.4
    },
    "replies": {
      "total": 127,
      "avgPerSession": 8.5
    }
  }
]
```

### Get System Statistics
```
GET /api/analytics/system
```

Requires: ADMIN role

Response:
```json
{
  "overview": {
    "totalTickets": 150,
    "totalUsers": 87,
    "totalAgents": 5
  },
  "tickets": {
    "byStatus": {
      "new": 8,
      "open": 23,
      "pending": 12,
      "on_hold": 4,
      "solved": 78,
      "closed": 25
    },
    "byPriority": {
      "low": 45,
      "normal": 72,
      "high": 28,
      "urgent": 5
    },
    "recent": [...]  // Last 10 tickets
  }
}
```

### Get Agent Session History
```
GET /api/analytics/agents/:agentId/sessions?limit=50
```

Requires: ADMIN role

Response:
```json
[
  {
    "id": "uuid",
    "agentId": "uuid",
    "loginAt": "2024-01-25T09:00:00.000Z",
    "logoutAt": "2024-01-25T17:00:00.000Z",
    "duration": 28800,  // seconds (8 hours)
    "replyCount": 23,
    "ipAddress": "192.168.1.1",
    "userAgent": "Mozilla/5.0..."
  }
]
```

---

## Sessions (Agent Only)

### Start Session
```
POST /api/sessions/start
```

Requires: AGENT or ADMIN role

Request Body:
```json
{
  "ipAddress": "192.168.1.1",  // optional
  "userAgent": "Mozilla/5.0..."  // optional
}
```

Response: `201 Created`
```json
{
  "id": "uuid",
  "agentId": "uuid",
  "loginAt": "2024-01-25T09:00:00.000Z",
  "replyCount": 0
}
```

### End Session
```
POST /api/sessions/end/:sessionId
```

Requires: AGENT or ADMIN role

Response:
```json
{
  "id": "uuid",
  "logoutAt": "2024-01-25T17:00:00.000Z",
  "duration": 28800
}
```

### Get Current Session
```
GET /api/sessions/current
```

Requires: AGENT or ADMIN role

Returns active session or null.

---

## Webhooks

### Clerk User Sync
```
POST /webhooks/clerk
```

Headers required:
- `svix-id`
- `svix-timestamp`
- `svix-signature`

Handles events:
- `user.created` - Creates user in database
- `user.updated` - Updates user in database
- `user.deleted` - Deletes user from database

---

## Data Models

### Ticket Object
```typescript
{
  id: string;              // UUID
  ticketNumber: number;    // Auto-increment, starts at 0
  subject: string;         // Max 500 chars
  status: TicketStatus;    // NEW | OPEN | PENDING | ON_HOLD | SOLVED | CLOSED
  priority: TicketPriority; // LOW | NORMAL | HIGH | URGENT
  channel: TicketChannel;  // EMAIL | WEB | API | SLACK | INTERNAL
  requesterId: string;     // UUID
  assigneeId?: string;     // UUID
  dueAt?: string;          // ISO timestamp
  firstResponseAt?: string;
  solvedAt?: string;
  closedAt?: string;
  createdAt: string;
  updatedAt: string;
}
```

### Comment Object
```typescript
{
  id: string;
  ticketId: string;
  authorId: string;
  body: string;           // HTML allowed
  bodyPlain: string;      // Plain text
  isInternal: boolean;    // Internal note flag
  isSystem: boolean;      // System message flag
  channel: CommentChannel;
  createdAt: string;
  updatedAt: string;
}
```

### Activity Object
```typescript
{
  id: string;
  ticketId: string;
  userId?: string;
  action: string;         // e.g., "status_changed", "assigned"
  details: object;        // Additional context
  createdAt: string;
}
```

---

## Error Responses

All errors follow this format:
```json
{
  "error": {
    "message": "Error description",
    "status": 400
  }
}
```

Validation errors:
```json
{
  "errors": [
    {
      "msg": "Invalid value",
      "param": "subject",
      "location": "body"
    }
  ]
}
```

---

## Rate Limiting

Not currently implemented. Recommended for production:
- 100 requests per minute per user
- 1000 requests per hour per IP

---

## Testing the API

### Using cURL

Create a ticket:
```bash
curl -X POST http://localhost:3001/api/tickets \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "subject": "Test ticket",
    "description": "This is a test",
    "channel": "WEB",
    "priority": "NORMAL"
  }'
```

Get all tickets:
```bash
curl http://localhost:3001/api/tickets \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Using Postman

1. Import the base URL: `http://localhost:3001`
2. Set up authentication:
   - Type: Bearer Token
   - Token: Get from Clerk (from browser dev tools or frontend)
3. Create requests for each endpoint

### Using the Frontend

The frontend already includes all API integrations. Check `frontend/src/lib/api.ts` for all API functions.

---

## Pagination (Future Enhancement)

Not currently implemented. Recommended format:
```
GET /api/tickets?page=1&limit=20
```

Response:
```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  }
}
```
