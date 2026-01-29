import { Router, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { prisma } from '../lib/prisma';
import { requireAuth, requireAgent, AuthRequest } from '../middleware/auth';
import { generateTicketSummary, generateKnowledgeBasedSolution, getKnowledgeContent } from '../services/aiService';
import { getOrCreateEmailThread, sendTicketCreatedEmail, sendTicketResolvedEmail } from '../services/emailService';

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

// Get AI-generated solution suggestion based on knowledge from solved tickets
router.get('/suggestions', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    // Check if ticket suggestions feature is enabled
    const settings = await prisma.settings.findFirst();
    if (!settings?.ticketSuggestionsEnabled) {
      return res.json({ solution: null, ticketCount: 0 });
    }

    const { subject, description, formId } = req.query;

    // Accept subject and description separately
    const subjectText = (typeof subject === 'string' ? subject : '').trim();
    const descriptionText = (typeof description === 'string' ? description : '').trim();
    const combinedText = `${subjectText} ${descriptionText}`.trim();

    if (combinedText.length < 10) {
      return res.json({ solution: null, ticketCount: 0 });
    }

    // Get form name for context
    let formName = 'General Support';
    if (formId && typeof formId === 'string') {
      const form = await prisma.form.findUnique({
        where: { id: formId },
        select: { name: true }
      });
      if (form) {
        formName = form.name;
      }
    }

    // Extract keywords from both subject and description (words with 3+ characters)
    const keywords = combinedText
      .toLowerCase()
      .split(/\s+/)
      .filter(word => word.length >= 3)
      .slice(0, 10);

    if (keywords.length === 0) {
      return res.json({ solution: null, ticketCount: 0 });
    }

    // Build search conditions for subject matching
    const searchConditions = keywords.map(keyword => ({
      subject: {
        contains: keyword,
        mode: 'insensitive' as const
      }
    }));

    // Find solved/closed tickets with matching subjects
    // Include the last agent comment as the resolution
    const matchingTickets = await prisma.ticket.findMany({
      where: {
        status: {
          in: ['SOLVED', 'CLOSED']
        },
        OR: searchConditions
      },
      select: {
        id: true,
        subject: true,
        comments: {
          where: {
            isSystem: false,
            isInternal: false,
            author: {
              role: {
                in: ['AGENT', 'ADMIN']
              }
            }
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            bodyPlain: true
          }
        }
      },
      orderBy: { solvedAt: 'desc' },
      take: 25 // Fetch more tickets for better matching
    });

    // Build knowledge base from matching tickets
    const ticketKnowledge = matchingTickets
      .filter(t => t.comments.length > 0 && t.comments[0].bodyPlain.length > 20)
      .map(t => ({
        subject: t.subject,
        resolution: t.comments[0].bodyPlain.substring(0, 500) // Limit resolution length
      }))
      .slice(0, 10); // Use top 10 for knowledge

    // Get external knowledge from cache (or refresh if expired)
    const externalKnowledge = await getKnowledgeContent();

    // Generate AI solution based on knowledge
    const solution = await generateKnowledgeBasedSolution(
      subjectText,
      descriptionText,
      formName,
      ticketKnowledge,
      externalKnowledge
    );

    return res.json({
      solution,
      ticketCount: ticketKnowledge.length
    });
  } catch (error) {
    console.error('Error fetching ticket suggestions:', error);
    return res.status(500).json({ error: 'Failed to fetch suggestions' });
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
          select: { id: true, email: true, firstName: true, lastName: true, isBlocked: true, blockedReason: true, timezone: true, timezoneOffset: true }
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
        },
        mergedInto: {
          select: {
            id: true,
            ticketNumber: true,
            subject: true,
            status: true
          }
        },
        mergedTickets: {
          select: {
            id: true,
            ticketNumber: true,
            subject: true,
            mergedAt: true,
            requester: {
              select: { id: true, email: true, firstName: true, lastName: true }
            }
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
    body('formResponses.*.value').optional().isString(),
    body('userAgent').optional().isString().isLength({ max: 500 }),
    body('shownAiSuggestion').optional().isString()
  ],
  async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { subject, channel, priority, categoryId, formId, relatedTicketId, description, formResponses, userAgent, shownAiSuggestion } = req.body;
      const userId = req.userId!;

      // Get IP address from request
      const ipAddress = (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
                       req.socket.remoteAddress ||
                       'unknown';

      // Get country from Cloudflare header if available, otherwise use a placeholder
      const country = (req.headers['cf-ipcountry'] as string) ||
                     (req.headers['x-country'] as string) ||
                     null;

      // Get user agent from request body (sent by frontend) or fallback to request header
      const clientUserAgent = userAgent || req.headers['user-agent'] || null;

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
            userAgent: clientUserAgent,
            shownAiSuggestion: shownAiSuggestion || null,
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

      // Create email thread for reply tracking
      if (ticket) {
        getOrCreateEmailThread(ticket.id).catch(err => {
          console.error('[Email] Failed to create email thread:', err);
        });

        // Send ticket created email notification
        sendTicketCreatedEmail({
          id: ticket.id,
          ticketNumber: ticket.ticketNumber,
          subject: ticket.subject,
          requester: ticket.requester
        }).catch(err => {
          console.error('[Email] Failed to send ticket created email:', err);
        });
      }

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

      // Fetch current ticket to check status
      const currentTicket = await prisma.ticket.findUnique({
        where: { id },
        select: { status: true }
      });

      if (!currentTicket) {
        return res.status(404).json({ error: 'Ticket not found' });
      }

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

        // Auto-set status to OPEN when assigning a NEW ticket
        if (assigneeId && currentTicket.status === 'NEW' && !status) {
          updateData.status = 'OPEN';
          activities.push({
            userId,
            action: 'status_changed',
            details: { newStatus: 'OPEN', reason: 'auto_on_assign' }
          });
        }
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

      // Send ticket resolved email when status changes to SOLVED
      if (status === 'SOLVED' && ticket.requester) {
        sendTicketResolvedEmail({
          id: ticket.id,
          ticketNumber: ticket.ticketNumber,
          subject: ticket.subject,
          requester: ticket.requester
        }).catch(err => {
          console.error('[Email] Failed to send ticket resolved email:', err);
        });
      }

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

// Merge tickets - merge source tickets into a target ticket
router.post('/merge',
  requireAuth,
  requireAgent,
  [
    body('sourceTicketIds').isArray({ min: 1 }).withMessage('At least one source ticket is required'),
    body('sourceTicketIds.*').isUUID(),
    body('targetTicketId').isUUID().withMessage('Target ticket ID is required'),
    body('mergeComment').optional().isString()
  ],
  async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { sourceTicketIds, targetTicketId, mergeComment } = req.body;
      const userId = req.userId!;

      // Validate source and target are different
      if (sourceTicketIds.includes(targetTicketId)) {
        return res.status(400).json({ error: 'Cannot merge a ticket into itself' });
      }

      // Fetch target ticket
      const targetTicket = await prisma.ticket.findUnique({
        where: { id: targetTicketId },
        include: {
          requester: {
            select: { id: true, email: true, firstName: true, lastName: true }
          }
        }
      });

      if (!targetTicket) {
        return res.status(404).json({ error: 'Target ticket not found' });
      }

      // Target ticket cannot be SOLVED or CLOSED
      if (targetTicket.status === 'SOLVED' || targetTicket.status === 'CLOSED') {
        return res.status(400).json({ error: 'Cannot merge into a solved or closed ticket' });
      }

      // Fetch source tickets
      const sourceTickets = await prisma.ticket.findMany({
        where: { id: { in: sourceTicketIds } },
        include: {
          requester: {
            select: { id: true, email: true, firstName: true, lastName: true }
          },
          comments: {
            orderBy: { createdAt: 'desc' },
            take: 1, // Get most recent comment
            include: {
              author: {
                select: { id: true, email: true, firstName: true, lastName: true }
              }
            }
          }
        }
      });

      if (sourceTickets.length !== sourceTicketIds.length) {
        return res.status(404).json({ error: 'One or more source tickets not found' });
      }

      // Validate source tickets - cannot merge SOLVED or CLOSED tickets
      const invalidTickets = sourceTickets.filter(t =>
        t.status === 'SOLVED' || t.status === 'CLOSED'
      );
      if (invalidTickets.length > 0) {
        return res.status(400).json({
          error: 'Cannot merge solved or closed tickets',
          invalidTickets: invalidTickets.map(t => t.ticketNumber)
        });
      }

      // Check if all source tickets have same requester as target (optional validation)
      const differentRequesters = sourceTickets.filter(t => t.requesterId !== targetTicket.requesterId);

      // Perform the merge in a transaction
      const result = await prisma.$transaction(async (tx) => {
        const now = new Date();
        const mergedTicketNumbers = sourceTickets.map(t => `#${t.ticketNumber}`).join(', ');

        // Update all source tickets to mark them as merged
        await tx.ticket.updateMany({
          where: { id: { in: sourceTicketIds } },
          data: {
            status: 'CLOSED',
            mergedIntoId: targetTicketId,
            mergedAt: now,
            closedAt: now
          }
        });

        // Create activity log for each source ticket
        for (const sourceTicket of sourceTickets) {
          await tx.ticketActivity.create({
            data: {
              ticketId: sourceTicket.id,
              userId,
              action: 'ticket_merged',
              details: {
                mergedIntoTicketId: targetTicketId,
                mergedIntoTicketNumber: targetTicket.ticketNumber,
                reason: 'closed_by_merge'
              }
            }
          });

          // Add a system comment to source ticket
          await tx.comment.create({
            data: {
              ticketId: sourceTicket.id,
              authorId: userId,
              body: `<p>This ticket has been merged into <a href="/tickets/${targetTicketId}">Ticket #${targetTicket.ticketNumber}</a>.</p>`,
              bodyPlain: `This ticket has been merged into Ticket #${targetTicket.ticketNumber}.`,
              isInternal: false,
              isSystem: true,
              channel: 'SYSTEM'
            }
          });
        }

        // Create activity log for target ticket
        await tx.ticketActivity.create({
          data: {
            ticketId: targetTicketId,
            userId,
            action: 'tickets_merged_in',
            details: {
              mergedTicketIds: sourceTicketIds,
              mergedTicketNumbers: sourceTickets.map(t => t.ticketNumber),
              hasDifferentRequesters: differentRequesters.length > 0
            }
          }
        });

        // Add a comment to target ticket with merge info
        const mergeCommentBody = mergeComment
          ? `<p>${mergeComment}</p><p><em>Merged from tickets: ${mergedTicketNumbers}</em></p>`
          : `<p><em>The following tickets have been merged into this ticket: ${mergedTicketNumbers}</em></p>`;

        await tx.comment.create({
          data: {
            ticketId: targetTicketId,
            authorId: userId,
            body: mergeCommentBody,
            bodyPlain: mergeComment
              ? `${mergeComment}\n\nMerged from tickets: ${mergedTicketNumbers}`
              : `The following tickets have been merged into this ticket: ${mergedTicketNumbers}`,
            isInternal: true, // Internal note about the merge
            isSystem: true,
            channel: 'SYSTEM'
          }
        });

        // If there are different requesters, add them to the comment as context
        if (differentRequesters.length > 0) {
          const requesterInfo = differentRequesters.map(t =>
            `${t.requester.firstName || ''} ${t.requester.lastName || ''} (${t.requester.email})`
          ).join(', ');

          await tx.comment.create({
            data: {
              ticketId: targetTicketId,
              authorId: userId,
              body: `<p><em>Note: Merged tickets had different requesters: ${requesterInfo}</em></p>`,
              bodyPlain: `Note: Merged tickets had different requesters: ${requesterInfo}`,
              isInternal: true,
              isSystem: true,
              channel: 'SYSTEM'
            }
          });
        }

        // Return updated target ticket
        return await tx.ticket.findUnique({
          where: { id: targetTicketId },
          include: {
            requester: {
              select: { id: true, email: true, firstName: true, lastName: true }
            },
            assignee: {
              select: { id: true, email: true, firstName: true, lastName: true }
            },
            mergedTickets: {
              select: {
                id: true,
                ticketNumber: true,
                subject: true,
                mergedAt: true
              }
            }
          }
        });
      });

      return res.json({
        success: true,
        message: `Successfully merged ${sourceTickets.length} ticket(s) into #${targetTicket.ticketNumber}`,
        targetTicket: result,
        mergedTickets: sourceTickets.map(t => ({
          id: t.id,
          ticketNumber: t.ticketNumber,
          subject: t.subject
        }))
      });
    } catch (error) {
      console.error('Error merging tickets:', error);
      return res.status(500).json({ error: 'Failed to merge tickets' });
    }
  }
);

// Get tickets available for merge (same requester, open status)
router.get('/merge-candidates/:ticketId', requireAuth, requireAgent, async (req: AuthRequest, res: Response) => {
  try {
    const { ticketId } = req.params;

    // Get the source ticket to find its requester
    const sourceTicket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      select: { requesterId: true, ticketNumber: true }
    });

    if (!sourceTicket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    // Find other open tickets from the same requester
    const candidates = await prisma.ticket.findMany({
      where: {
        id: { not: ticketId },
        requesterId: sourceTicket.requesterId,
        status: { notIn: ['SOLVED', 'CLOSED'] },
        mergedIntoId: null // Not already merged
      },
      select: {
        id: true,
        ticketNumber: true,
        subject: true,
        status: true,
        createdAt: true,
        _count: {
          select: { comments: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 20
    });

    return res.json(candidates);
  } catch (error) {
    console.error('Error fetching merge candidates:', error);
    return res.status(500).json({ error: 'Failed to fetch merge candidates' });
  }
});

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

// Generate AI summary for a ticket
router.post('/:id/generate-summary', requireAuth, requireAgent, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Check if ticket exists
    const ticket = await prisma.ticket.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    // Generate summary using AI service
    const summary = await generateTicketSummary(id);

    // Update ticket with the generated summary
    const updatedTicket = await prisma.ticket.update({
      where: { id },
      data: {
        aiSummary: summary,
        aiSummaryGeneratedAt: new Date(),
      },
      select: {
        aiSummary: true,
        aiSummaryGeneratedAt: true,
      },
    });

    return res.json(updatedTicket);
  } catch (error: any) {
    console.error('Error generating AI summary:', error);
    const message = error?.message || 'Failed to generate summary';
    return res.status(500).json({ error: message });
  }
});

export default router;
