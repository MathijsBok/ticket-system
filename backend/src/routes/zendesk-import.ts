import { Router, Response } from 'express';
import { PrismaClient, TicketStatus, TicketPriority, TicketChannel } from '@prisma/client';
import { requireAuth, requireAdmin, AuthRequest } from '../middleware/auth';
import { getAuth } from '@clerk/express';
import multer from 'multer';

const router = Router();
const prisma = new PrismaClient();

// Configure multer for JSON file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/json') {
      cb(null, true);
    } else {
      cb(new Error('Only JSON files are allowed'));
    }
  }
});

// Map Zendesk status to our status
const mapStatus = (zendeskStatus: string): TicketStatus => {
  const statusMap: Record<string, TicketStatus> = {
    'new': 'NEW',
    'open': 'OPEN',
    'pending': 'PENDING',
    'hold': 'ON_HOLD',
    'solved': 'SOLVED',
    'closed': 'SOLVED'
  };
  return statusMap[zendeskStatus.toLowerCase()] || 'NEW';
};

// Map Zendesk priority to our priority
const mapPriority = (zendeskPriority: string | null): TicketPriority => {
  if (!zendeskPriority) return 'NORMAL';
  const priorityMap: Record<string, TicketPriority> = {
    'low': 'LOW',
    'normal': 'NORMAL',
    'high': 'HIGH',
    'urgent': 'URGENT'
  };
  return priorityMap[zendeskPriority.toLowerCase()] || 'NORMAL';
};

// Import tickets from Zendesk JSON export
router.post('/import', requireAuth, requireAdmin, upload.single('file'), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const jsonData = JSON.parse(req.file.buffer.toString());

    // Validate JSON structure
    if (!Array.isArray(jsonData.tickets)) {
      return res.status(400).json({ error: 'Invalid Zendesk export format. Expected tickets array.' });
    }

    const tickets = jsonData.tickets;
    const users = jsonData.users || [];
    const comments = jsonData.comments || [];

    let importedCount = 0;
    let skippedCount = 0;
    const errors: string[] = [];

    // Get the admin user who is importing (will be used as default requester)
    const { userId } = getAuth(req);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const adminUser = await prisma.user.findUnique({
      where: { clerkId: userId }
    });

    if (!adminUser) {
      return res.status(404).json({ error: 'Admin user not found' });
    }

    // Create a map of Zendesk user IDs to system user IDs
    const userMap = new Map<number, string>();
    userMap.set(0, adminUser.id); // Default user

    // Try to match existing users by email
    for (const zendeskUser of users) {
      if (zendeskUser.email) {
        const existingUser = await prisma.user.findUnique({
          where: { email: zendeskUser.email }
        });
        if (existingUser) {
          userMap.set(zendeskUser.id, existingUser.id);
        }
      }
    }

    // Process each ticket
    for (const zendeskTicket of tickets) {
      try {
        // Get requester ID (use admin as fallback)
        const requesterId = userMap.get(zendeskTicket.requester_id) || adminUser.id;
        const assigneeId = zendeskTicket.assignee_id ? userMap.get(zendeskTicket.assignee_id) : null;

        // Create ticket
        const ticket = await prisma.ticket.create({
          data: {
            subject: zendeskTicket.subject || 'Imported from Zendesk',
            status: mapStatus(zendeskTicket.status),
            priority: mapPriority(zendeskTicket.priority),
            channel: TicketChannel.WEB,
            requesterId,
            assigneeId: assigneeId || undefined,
            createdAt: zendeskTicket.created_at ? new Date(zendeskTicket.created_at) : undefined,
            updatedAt: zendeskTicket.updated_at ? new Date(zendeskTicket.updated_at) : undefined,
            solvedAt: zendeskTicket.status === 'solved' || zendeskTicket.status === 'closed'
              ? (zendeskTicket.updated_at ? new Date(zendeskTicket.updated_at) : new Date())
              : undefined
          }
        });

        // Import description as first comment if exists
        if (zendeskTicket.description) {
          await prisma.comment.create({
            data: {
              ticketId: ticket.id,
              authorId: requesterId,
              body: zendeskTicket.description,
              bodyPlain: zendeskTicket.description,
              isInternal: false,
              isSystem: false,
              channel: 'SYSTEM',
              createdAt: zendeskTicket.created_at ? new Date(zendeskTicket.created_at) : undefined
            }
          });
        }

        // Import related comments
        const ticketComments = comments.filter((c: any) => c.ticket_id === zendeskTicket.id);
        for (const comment of ticketComments) {
          const commentAuthorId = userMap.get(comment.author_id) || adminUser.id;

          await prisma.comment.create({
            data: {
              ticketId: ticket.id,
              authorId: commentAuthorId,
              body: comment.body || comment.html_body || 'No content',
              bodyPlain: comment.plain_body || comment.body || 'No content',
              isInternal: comment.public === false,
              isSystem: false,
              channel: 'SYSTEM',
              createdAt: comment.created_at ? new Date(comment.created_at) : undefined
            }
          });
        }

        importedCount++;
      } catch (error: any) {
        console.error(`Error importing ticket ${zendeskTicket.id}:`, error);
        errors.push(`Ticket ${zendeskTicket.id}: ${error.message}`);
        skippedCount++;
      }
    }

    return res.json({
      success: true,
      imported: importedCount,
      skipped: skippedCount,
      errors: errors.length > 0 ? errors.slice(0, 10) : undefined // Return max 10 errors
    });

  } catch (error: any) {
    console.error('Error importing Zendesk data:', error);
    return res.status(500).json({
      error: 'Failed to import Zendesk data',
      details: error.message
    });
  }
});

export default router;
