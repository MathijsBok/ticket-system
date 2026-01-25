import { Router, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { prisma } from '../lib/prisma';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();

// Create comment/reply on a ticket
router.post('/',
  requireAuth,
  [
    body('ticketId').isUUID(),
    body('body').isString().notEmpty(),
    body('bodyPlain').isString().notEmpty(),
    body('isInternal').optional().isBoolean()
  ],
  async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { ticketId, body: commentBody, bodyPlain, isInternal } = req.body;
      const userId = req.userId!;
      const userRole = req.userRole!;

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

      // Create comment and update ticket
      const comment = await prisma.comment.create({
        data: {
          ticketId,
          authorId: userId,
          body: commentBody,
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

      // Update ticket timestamps
      const updateData: any = { updatedAt: new Date() };

      // If this is the first agent response, track it
      if ((userRole === 'AGENT' || userRole === 'ADMIN') && !ticket.firstResponseAt) {
        updateData.firstResponseAt = new Date();
      }

      // Change status from NEW to OPEN if agent responds
      if ((userRole === 'AGENT' || userRole === 'ADMIN') && ticket.status === 'NEW') {
        updateData.status = 'OPEN';
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
