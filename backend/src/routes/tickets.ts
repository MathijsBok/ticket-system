import { Router, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { prisma } from '../lib/prisma';
import { requireAuth, requireAgent, AuthRequest } from '../middleware/auth';

const router = Router();

// Get all tickets (with filters for agents)
router.get('/', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { status, assigneeId, requesterId } = req.query;
    const userRole = req.userRole;
    const userId = req.userId;

    const where: any = {};

    // Users can only see their own tickets
    if (userRole === 'USER') {
      where.requesterId = userId;
    }

    // Agents can see all tickets (optional filtering)
    if (status && typeof status === 'string') {
      where.status = status.toUpperCase();
    }

    if (assigneeId && typeof assigneeId === 'string') {
      where.assigneeId = assigneeId;
    }

    if (requesterId && typeof requesterId === 'string') {
      where.requesterId = requesterId;
    }

    const tickets = await prisma.ticket.findMany({
      where,
      include: {
        requester: {
          select: { id: true, email: true, firstName: true, lastName: true, isBlocked: true, blockedReason: true }
        },
        assignee: {
          select: { id: true, email: true, firstName: true, lastName: true }
        },
        category: true,
        form: true,
        _count: {
          select: { comments: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return res.json(tickets);
  } catch (error) {
    console.error('Error fetching tickets:', error);
    return res.status(500).json({ error: 'Failed to fetch tickets' });
  }
});

// Get single ticket by ID
router.get('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.userId;
    const userRole = req.userRole;

    const ticket = await prisma.ticket.findUnique({
      where: { id },
      include: {
        requester: {
          select: { id: true, email: true, firstName: true, lastName: true, isBlocked: true, blockedReason: true }
        },
        assignee: {
          select: { id: true, email: true, firstName: true, lastName: true }
        },
        category: true,
        form: true,
        comments: {
          where: userRole === 'USER' ? { isInternal: false } : {},
          include: {
            author: {
              select: { id: true, email: true, firstName: true, lastName: true }
            },
            attachments: true
          },
          orderBy: { createdAt: 'asc' }
        },
        attachments: true,
        activities: {
          include: {
            user: {
              select: { id: true, email: true, firstName: true, lastName: true }
            }
          },
          orderBy: { createdAt: 'desc' },
          take: 50
        },
        formResponses: {
          include: {
            field: true
          }
        },
        relatedTicket: {
          select: {
            id: true,
            ticketNumber: true,
            subject: true,
            status: true
          }
        },
        followUpTickets: {
          select: {
            id: true,
            ticketNumber: true,
            subject: true,
            status: true,
            createdAt: true
          }
        }
      }
    });

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    // Users can only view their own tickets
    if (userRole === 'USER' && ticket.requesterId !== userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    return res.json(ticket);
  } catch (error) {
    console.error('Error fetching ticket:', error);
    return res.status(500).json({ error: 'Failed to fetch ticket' });
  }
});

// Create new ticket
router.post('/',
  requireAuth,
  [
    body('subject').isString().notEmpty().isLength({ max: 500 }),
    body('channel').isIn(['EMAIL', 'WEB', 'API', 'SLACK', 'INTERNAL']),
    body('priority').optional().isIn(['LOW', 'NORMAL', 'HIGH', 'URGENT']),
    body('categoryId').optional().isUUID(),
    body('formId').optional().isUUID(),
    body('relatedTicketId').optional().isUUID(),
    body('description').isString().notEmpty(),
    body('formResponses').optional().isArray(),
    body('formResponses.*.fieldId').optional().isUUID(),
    body('formResponses.*.value').optional().isString()
  ],
  async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { subject, channel, priority, categoryId, formId, relatedTicketId, description, formResponses } = req.body;
      const userId = req.userId!;

      // Get IP address from request
      const ipAddress = (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
                       req.socket.remoteAddress ||
                       'unknown';

      // Get country from Cloudflare header if available, otherwise use a placeholder
      const country = (req.headers['cf-ipcountry'] as string) ||
                     (req.headers['x-country'] as string) ||
                     null;

      // Create ticket with initial comment and form responses in a transaction
      const ticket = await prisma.$transaction(async (tx) => {
        const newTicket = await tx.ticket.create({
          data: {
            subject,
            channel,
            priority: priority || 'NORMAL',
            requesterId: userId,
            categoryId: categoryId || null,
            formId: formId || null,
            relatedTicketId: relatedTicketId || null,
            country,
            ipAddress,
            comments: {
              create: {
                authorId: userId,
                body: description,
                bodyPlain: description,
                channel: 'WEB',
                isSystem: false
              }
            },
            activities: {
              create: {
                userId,
                action: 'ticket_created',
                details: { subject, channel }
              }
            }
          },
          include: {
            requester: {
              select: { id: true, email: true, firstName: true, lastName: true }
            },
            comments: true
          }
        });

        // Create form responses if provided
        if (formResponses && Array.isArray(formResponses) && formResponses.length > 0) {
          await tx.formResponse.createMany({
            data: formResponses.map((response: { fieldId: string; value: string }) => ({
              ticketId: newTicket.id,
              fieldId: response.fieldId,
              value: response.value
            }))
          });
        }

        // Fetch ticket with form responses
        return await tx.ticket.findUnique({
          where: { id: newTicket.id },
          include: {
            requester: {
              select: { id: true, email: true, firstName: true, lastName: true }
            },
            comments: true,
            formResponses: {
              include: {
                field: true
              }
            }
          }
        });
      });

      return res.status(201).json(ticket);
    } catch (error) {
      console.error('Error creating ticket:', error);
      return res.status(500).json({ error: 'Failed to create ticket' });
    }
  }
);

// Update ticket (status, assignment, etc.)
router.patch('/:id',
  requireAuth,
  requireAgent,
  [
    body('status').optional().isIn(['NEW', 'OPEN', 'PENDING', 'ON_HOLD', 'SOLVED', 'CLOSED']),
    body('priority').optional().isIn(['LOW', 'NORMAL', 'HIGH', 'URGENT']),
    body('assigneeId').optional().isUUID(),
    body('categoryId').optional().isUUID()
  ],
  async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { id } = req.params;
      const { status, priority, assigneeId, categoryId } = req.body;
      const userId = req.userId!;

      const updateData: any = {};
      const activities: any[] = [];

      if (status) {
        updateData.status = status;

        // Track status changes
        if (status === 'SOLVED') {
          updateData.solvedAt = new Date();
        }

        activities.push({
          userId,
          action: 'status_changed',
          details: { newStatus: status }
        });
      }

      if (priority) {
        updateData.priority = priority;
        activities.push({
          userId,
          action: 'priority_changed',
          details: { newPriority: priority }
        });
      }

      if (assigneeId !== undefined) {
        // Validate assignee exists and has AGENT or ADMIN role
        if (assigneeId) {
          const assignee = await prisma.user.findUnique({
            where: { id: assigneeId },
            select: { id: true, role: true, email: true }
          });

          if (!assignee) {
            return res.status(400).json({ error: 'Assignee not found' });
          }

          if (assignee.role !== 'AGENT' && assignee.role !== 'ADMIN') {
            return res.status(400).json({
              error: 'Can only assign tickets to agents or admins',
              details: `User ${assignee.email} has role ${assignee.role}`
            });
          }
        }

        updateData.assigneeId = assigneeId;
        activities.push({
          userId,
          action: 'assigned',
          details: { assigneeId }
        });
      }

      if (categoryId !== undefined) {
        updateData.categoryId = categoryId;
      }

      updateData.updatedAt = new Date();

      const ticket = await prisma.ticket.update({
        where: { id },
        data: {
          ...updateData,
          activities: {
            create: activities
          }
        },
        include: {
          requester: {
            select: { id: true, email: true, firstName: true, lastName: true }
          },
          assignee: {
            select: { id: true, email: true, firstName: true, lastName: true }
          },
          category: true
        }
      });

      return res.json(ticket);
    } catch (error) {
      console.error('Error updating ticket:', error);
      return res.status(500).json({ error: 'Failed to update ticket' });
    }
  }
);

// Bulk update tickets
router.patch('/bulk/update',
  requireAuth,
  requireAgent,
  [
    body('ticketIds').isArray().notEmpty(),
    body('ticketIds.*').isUUID(),
    body('status').optional().isIn(['NEW', 'OPEN', 'PENDING', 'ON_HOLD', 'SOLVED', 'CLOSED'])
  ],
  async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { ticketIds, status } = req.body;
      const userId = req.userId!;

      const updateData: any = { updatedAt: new Date() };

      if (status) {
        updateData.status = status;

        if (status === 'SOLVED') {
          updateData.solvedAt = new Date();
        }
      }

      await prisma.ticket.updateMany({
        where: { id: { in: ticketIds } },
        data: updateData
      });

      // Create activity logs for each ticket
      if (status) {
        await Promise.all(
          ticketIds.map((ticketId: string) =>
            prisma.ticketActivity.create({
              data: {
                ticketId,
                userId,
                action: 'status_changed',
                details: { newStatus: status }
              }
            })
          )
        );
      }

      return res.json({ success: true, updated: ticketIds.length });
    } catch (error) {
      console.error('Error bulk updating tickets:', error);
      return res.status(500).json({ error: 'Failed to bulk update tickets' });
    }
  }
);

// Bulk delete tickets
router.delete('/bulk/delete',
  requireAuth,
  requireAgent,
  [
    body('ticketIds').isArray().notEmpty(),
    body('ticketIds.*').isUUID()
  ],
  async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { ticketIds } = req.body;

      await prisma.ticket.deleteMany({
        where: { id: { in: ticketIds } }
      });

      return res.json({ success: true, deleted: ticketIds.length });
    } catch (error) {
      console.error('Error bulk deleting tickets:', error);
      return res.status(500).json({ error: 'Failed to bulk delete tickets' });
    }
  }
);

// Get ticket statistics (for dashboard)
router.get('/stats/overview', requireAuth, requireAgent, async (_req: AuthRequest, res) => {
  try {
    // Agents and Admins see all ticket stats
    const where = {};

    const [total, newCount, openCount, pendingCount, onHoldCount, solvedCount, closedCount] = await Promise.all([
      prisma.ticket.count({ where }),
      prisma.ticket.count({ where: { ...where, status: 'NEW' } }),
      prisma.ticket.count({ where: { ...where, status: 'OPEN' } }),
      prisma.ticket.count({ where: { ...where, status: 'PENDING' } }),
      prisma.ticket.count({ where: { ...where, status: 'ON_HOLD' } }),
      prisma.ticket.count({ where: { ...where, status: 'SOLVED' } }),
      prisma.ticket.count({ where: { ...where, status: 'CLOSED' } })
    ]);

    return res.json({
      total,
      byStatus: {
        new: newCount,
        open: openCount,
        pending: pendingCount,
        onHold: onHoldCount,
        solved: solvedCount,
        closed: closedCount
      }
    });
  } catch (error) {
    console.error('Error fetching ticket stats:', error);
    return res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

export default router;
