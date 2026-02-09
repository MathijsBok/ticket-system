import { Router, Response } from 'express';
import { body, validationResult } from 'express-validator';
import sanitizeHtml from 'sanitize-html';
import { prisma } from '../lib/prisma';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { sendAgentReplyEmail } from '../services/emailService';

// Sanitization options: allow safe HTML from rich text editor, strip dangerous tags/attributes
const sanitizeOptions: sanitizeHtml.IOptions = {
  allowedTags: sanitizeHtml.defaults.allowedTags.concat([
    'img', 'span', 'u', 's', 'mark', 'sub', 'sup', 'br', 'hr',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6'
  ]),
  allowedAttributes: {
    ...sanitizeHtml.defaults.allowedAttributes,
    '*': ['class', 'style'],
    'img': ['src', 'alt', 'width', 'height'],
    'a': ['href', 'target', 'rel']
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  allowedStyles: {
    '*': {
      'color': [/^#[0-9a-fA-F]{3,6}$/, /^rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)$/, /^[a-zA-Z]+$/],
      'background-color': [/^#[0-9a-fA-F]{3,6}$/, /^rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)$/, /^[a-zA-Z]+$/],
      'text-align': [/^(left|right|center|justify)$/],
      'font-size': [/^(\d+)(px|em|rem|pt|%)$/],
      'font-weight': [/^(normal|bold|bolder|lighter|\d{3})$/],
      'text-decoration': [/^(none|underline|overline|line-through)$/]
    }
  }
};

const router = Router();

// Create comment/reply on a ticket
router.post('/',
  requireAuth,
  [
    body('ticketId').isUUID(),
    body('body').isString().notEmpty(),
    body('bodyPlain').isString().notEmpty(),
    body('isInternal').optional().isBoolean(),
    body('mentionedUserIds').optional().isArray()
  ],
  async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { ticketId, body: commentBody, bodyPlain, isInternal, mentionedUserIds } = req.body;
      const userId = req.userId!;
      const userRole = req.userRole!;

      // Check if the user is blocked
      if (userRole === 'USER') {
        const currentUser = await prisma.user.findUnique({
          where: { id: userId },
          select: { isBlocked: true }
        });
        if (currentUser?.isBlocked) {
          return res.status(403).json({ error: 'Your account has been blocked. You cannot post comments.' });
        }
      }

      // Verify ticket exists
      const ticket = await prisma.ticket.findUnique({
        where: { id: ticketId }
      });

      if (!ticket) {
        return res.status(404).json({ error: 'Ticket not found' });
      }

      // Only agents can make internal comments
      const isInternalNote = isInternal && (userRole === 'AGENT' || userRole === 'ADMIN');

      // Users can only comment on their own tickets
      if (userRole === 'USER' && ticket.requesterId !== userId) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      // Sanitize HTML content to prevent XSS
      const sanitizedBody = sanitizeHtml(commentBody, sanitizeOptions);

      // Create comment and update ticket
      const comment = await prisma.comment.create({
        data: {
          ticketId,
          authorId: userId,
          body: sanitizedBody,
          bodyPlain,
          isInternal: isInternalNote,
          channel: 'WEB'
        },
        include: {
          author: {
            select: { id: true, email: true, firstName: true, lastName: true }
          }
        }
      });

      // Handle @mentions if provided
      if (mentionedUserIds && mentionedUserIds.length > 0) {
        console.log('[Mentions] Received mentionedUserIds:', mentionedUserIds);
        console.log('[Mentions] Current userId (author):', userId);

        // Filter out invalid UUIDs and the author themselves
        const validMentionIds = mentionedUserIds.filter(
          (id: string) => id !== userId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
        );

        console.log('[Mentions] Valid mention IDs after filtering:', validMentionIds);

        // Create mentions
        if (validMentionIds.length > 0) {
          await prisma.mention.createMany({
            data: validMentionIds.map((mentionedUserId: string) => ({
              commentId: comment.id,
              mentionedUserId
            })),
            skipDuplicates: true
          });

          // Get author name for notification
          const authorName = comment.author.firstName || comment.author.lastName
            ? `${comment.author.firstName || ''} ${comment.author.lastName || ''}`.trim()
            : comment.author.email;

          // Create notifications for mentioned users
          const notificationResult = await prisma.notification.createMany({
            data: validMentionIds.map((mentionedUserId: string) => ({
              userId: mentionedUserId,
              type: 'MENTION' as const,
              title: `You were mentioned in ticket #${ticket.ticketNumber}`,
              message: `${authorName} mentioned you in a comment on "${ticket.subject}"`,
              ticketId: ticket.id,
              commentId: comment.id
            }))
          });
          console.log('[Mentions] Created notifications:', notificationResult);
        }
      }

      // Update ticket timestamps
      const updateData: any = { updatedAt: new Date() };

      // If this is the first agent response, track it
      if ((userRole === 'AGENT' || userRole === 'ADMIN') && !ticket.firstResponseAt) {
        updateData.firstResponseAt = new Date();
      }

      // Change status based on who is replying
      if (userRole === 'AGENT' || userRole === 'ADMIN') {
        // When agent sends a non-internal reply, set status to PENDING (waiting for customer)
        if (!isInternalNote) {
          updateData.status = 'PENDING';
        }
        // Internal notes don't change the status
      } else if (userRole === 'USER') {
        // When customer replies to a PENDING ticket, reopen it
        if (ticket.status === 'PENDING') {
          updateData.status = 'OPEN';
        }
      }

      await prisma.ticket.update({
        where: { id: ticketId },
        data: {
          ...updateData,
          activities: {
            create: {
              userId,
              action: 'comment_added',
              details: { commentId: comment.id, isInternal: isInternalNote }
            }
          }
        }
      });

      // Update agent session reply count
      if (userRole === 'AGENT' || userRole === 'ADMIN') {
        const activeSession = await prisma.agentSession.findFirst({
          where: {
            agentId: userId,
            logoutAt: null
          },
          orderBy: { loginAt: 'desc' }
        });

        if (activeSession) {
          await prisma.agentSession.update({
            where: { id: activeSession.id },
            data: { replyCount: { increment: 1 } }
          });
        }

        // Send email notification to requester for public replies
        if (!isInternalNote) {
          // Fetch ticket with requester info for email
          const ticketWithRequester = await prisma.ticket.findUnique({
            where: { id: ticketId },
            include: {
              requester: {
                select: {
                  email: true,
                  firstName: true,
                  lastName: true
                }
              }
            }
          });

          if (ticketWithRequester) {
            // Send email asynchronously (don't wait for it)
            sendAgentReplyEmail(
              {
                id: ticketWithRequester.id,
                ticketNumber: ticketWithRequester.ticketNumber,
                subject: ticketWithRequester.subject,
                requester: ticketWithRequester.requester
              },
              {
                bodyPlain: bodyPlain,
                author: {
                  firstName: comment.author.firstName,
                  lastName: comment.author.lastName
                }
              }
            ).catch(err => {
              console.error('[Email] Failed to send agent reply email:', err);
            });
          }
        }
      }

      return res.status(201).json(comment);
    } catch (error) {
      console.error('Error creating comment:', error);
      return res.status(500).json({ error: 'Failed to create comment' });
    }
  }
);

// Get comments for a ticket
router.get('/ticket/:ticketId', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { ticketId } = req.params;
    const userId = req.userId!;
    const userRole = req.userRole!;

    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      select: { requesterId: true }
    });

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    // Users can only view comments on their own tickets
    if (userRole === 'USER' && ticket.requesterId !== userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const where: any = { ticketId };

    // Users cannot see internal notes
    if (userRole === 'USER') {
      where.isInternal = false;
    }

    const comments = await prisma.comment.findMany({
      where,
      include: {
        author: {
          select: { id: true, email: true, firstName: true, lastName: true }
        },
        attachments: true
      },
      orderBy: { createdAt: 'asc' }
    });

    return res.json(comments);
  } catch (error) {
    console.error('Error fetching comments:', error);
    return res.status(500).json({ error: 'Failed to fetch comments' });
  }
});

export default router;
