# User Guide

Complete guide for using the Ticket Management System.

## For End Users (Customers)

### Submitting a Ticket

1. Click "New Ticket" in the navigation
2. Fill in the form:
   - **Subject**: Brief description of your issue
   - **Priority**: Select urgency level (Low, Normal, High, Urgent)
   - **Description**: Detailed explanation of your issue
3. Click "Create Ticket"
4. You'll receive a unique ticket number (e.g., #0, #1, #2)

### Viewing Your Tickets

- Go to "My Tickets" dashboard
- See all your tickets with:
  - Ticket number
  - Subject
  - Current status
  - Priority level
  - Creation date
  - Number of replies

### Responding to Tickets

1. Click on a ticket to open it
2. View the full conversation history
3. Type your reply in the text box at the bottom
4. Click "Send Reply"

### Ticket Statuses Explained

- **New**: Just submitted, waiting for agent assignment
- **Open**: Agent is actively working on it
- **Pending**: Waiting for your response
- **On Hold**: Temporarily paused (waiting for internal action)
- **Solved**: Issue has been resolved
- **Closed**: Ticket archived

## For Agents

### Accessing the Agent Dashboard

After logging in, you'll see the Agent Dashboard with:
- Total ticket count
- Tickets by status (Open, Pending, On Hold, Solved)
- Filter buttons to view specific ticket types
- Complete ticket list with all details

### Managing Tickets

#### Viewing Tickets
- Click on any ticket number or subject to open the detail view
- See full conversation history
- View ticket metadata (requester, dates, priority)

#### Assigning Tickets
1. Open a ticket
2. Click "Assign to Me" button
3. Ticket is now in your queue

#### Responding to Tickets
1. Open a ticket
2. Type your response in the reply box
3. For internal notes (not visible to customer):
   - Check "Internal note" checkbox
   - Only agents and admins can see these
4. Click "Send Reply"

**Important**: When you reply to a NEW ticket, it automatically changes to OPEN status.

#### Updating Ticket Status
1. Open a ticket
2. Use the status dropdown in the top-right
3. Select new status:
   - **Open**: You're working on it
   - **Pending**: Waiting for customer response
   - **On Hold**: Waiting for internal action
   - **Solved**: Issue resolved (waiting for confirmation)
   - **Closed**: Ticket archived

#### Session Tracking
Your activity is automatically tracked:
- Login time
- Session duration
- Number of replies sent
- Tickets assigned to you

This data is visible to admins for performance monitoring.

### Best Practices for Agents

1. **Assign tickets promptly**: Take ownership of tickets you're working on
2. **Update status regularly**: Keep customers informed
3. **Use internal notes**: Communicate with other agents without notifying customer
4. **Close resolved tickets**: Mark tickets as Solved when issue is fixed
5. **Respond quickly**: First response time is tracked

## For Administrators

### Admin Dashboard

The admin dashboard shows comprehensive analytics:

#### System Overview
- Total tickets in system
- Total users
- Total agents
- Tickets by status breakdown
- Tickets by priority

#### Agent Performance Metrics

For each agent, you can see:
- **Status**: Online/Offline indicator
- **Total Sessions**: Number of login sessions
- **Avg Duration**: Average session length
- **Total Replies**: Total responses sent
- **Assigned Tickets**: Tickets currently or previously assigned
- **Solved**: Number of tickets marked as solved
- **Solve Rate**: Percentage of assigned tickets solved
- **Last Active**: Last login timestamp

This helps you:
- Identify top performers
- Balance workload across agents
- Track response times
- Monitor agent availability

### Managing Custom Forms

Navigate to "Forms" in the admin menu.

#### Creating a Form
1. Click "New Form"
2. Enter form name and description
3. Add fields:
   - Click "+ Add Field"
   - Enter field label
   - Select field type (Text, Textarea, Select, Checkbox)
   - Mark as required if needed
4. Click "Create Form"

#### Form Field Types
- **Text**: Single-line input
- **Textarea**: Multi-line input
- **Select**: Dropdown menu
- **Checkbox**: Yes/no option

#### Managing Existing Forms
- View all forms in the table
- Toggle active/inactive status
- Delete forms (note: doesn't delete tickets created with that form)

### User Role Management

Roles are managed in Clerk dashboard:

1. Go to Clerk Dashboard > Users
2. Click on a user
3. Edit "Public metadata"
4. Set role:
   ```json
   {"role": "USER"}
   ```
   or
   ```json
   {"role": "AGENT"}
   ```
   or
   ```json
   {"role": "ADMIN"}
   ```

**Role Permissions**:
- **USER**: Submit tickets, view own tickets, reply to own tickets
- **AGENT**: All USER permissions + view all tickets, assign tickets, change status, send internal notes, session tracking
- **ADMIN**: All AGENT permissions + analytics dashboard, form management, user management

## Theme Switching

Both users and agents can switch between dark and light themes:

1. Click the sun/moon icon in the header
2. Theme preference is saved to your browser
3. Persists across sessions

## Activity Log

Every ticket has an activity log showing:
- Who created the ticket
- Status changes (who changed, when)
- Assignment changes
- Comments added
- Timestamps for all actions

This provides complete audit trail for each ticket.

## File Attachments

### Uploading Files
1. Open a ticket
2. When adding a reply, look for upload button
3. Select file (max 10MB by default)
4. File is attached to your reply

### Downloading Files
- Click on any attachment link to download
- Users can only download from their own tickets
- Agents can download from any ticket

## Tips and Tricks

### For Users
- Include detailed information in your initial ticket to get faster resolution
- Respond promptly when status is "Pending" (waiting for your response)
- Use appropriate priority levels (don't mark everything as Urgent)

### For Agents
- Use keyboard shortcuts (if implemented) for faster navigation
- Filter by status to focus on specific ticket types
- Use internal notes to coordinate with other agents
- Keep tickets updated so customers know the current state

### For Admins
- Review agent analytics weekly to identify training needs
- Create forms for common ticket types to standardize submissions
- Monitor solve rates to identify bottlenecks
- Balance ticket assignments across agents

## Troubleshooting

### Can't see my tickets
- Ensure you're logged in
- Check that you're on the correct dashboard for your role

### Can't submit a ticket
- Verify all required fields are filled
- Check that subject and description are not empty
- Ensure you have USER role assigned

### Not receiving notifications
- Email notifications are not yet implemented
- Check the ticket detail page for updates

### Theme not saving
- Ensure your browser allows localStorage
- Try clearing cache and setting theme again

## Support

For issues with the ticket system itself:
- Contact your system administrator
- Check the README.md for technical documentation
- Report bugs to the development team
