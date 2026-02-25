import { Router, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { prisma } from '../lib/prisma';
import { requireAuth, requireAgent, requireAdmin, AuthRequest } from '../middleware/auth';
import { generateTicketSummary, generateKnowledgeBasedSolution, getKnowledgeContent } from '../services/aiService';
import { getOrCreateEmailThread, sendTicketCreatedEmail, sendTicketResolvedEmail, sendFeedbackRequestEmail } from '../services/emailService';
import { getCountryFromIP } from '../lib/geolocation';

const router = Router();

// Get all tickets (with filters and pagination for agents)
router.get('/', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { status, assigneeId, requesterId, page, limit, sortField, sortDirection, search, type, myRequests, myAssigned, unassigned, solvedAfter } = req.query;
    const userRole = req.userRole;
    const userId = req.userId;

    // Pagination defaults
    const pageNum = Math.max(1, parseInt(page as string) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string) || 25));
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};

    // Users can only see their own tickets
    if (userRole === 'USER') {
      where.requesterId = userId;
    }

    // Filter for tickets where current user is the requester (My Tickets)
    if (myRequests === 'true' && (userRole === 'AGENT' || userRole === 'ADMIN')) {
      where.requesterId = userId;
    }

    // Filter for tickets assigned to current user
    if (myAssigned === 'true' && (userRole === 'AGENT' || userRole === 'ADMIN')) {
      where.assigneeId = userId;
    }

    // Filter for unassigned tickets (no assignee)
    if (unassigned === 'true' && (userRole === 'AGENT' || userRole === 'ADMIN')) {
      where.assigneeId = null;
    }

    // Filter for tickets solved after a certain date (for "Recently solved" view)
    if (solvedAfter && typeof solvedAfter === 'string') {
      const solvedAfterDate = new Date(solvedAfter);
      if (!isNaN(solvedAfterDate.getTime())) {
        where.solvedAt = { gte: solvedAfterDate };
      }
    }

    // Agents can see all tickets (optional filtering)
    // Support comma-separated status values (e.g., "OPEN,PENDING,ON_HOLD")
    if (status && typeof status === 'string') {
      const statuses = status.split(',').map(s => s.trim().toUpperCase());
      if (statuses.length === 1) {
        where.status = statuses[0];
      } else {
        where.status = { in: statuses };
      }
    }

    // Filter by ticket type (NORMAL, PROBLEM, INCIDENT)
    if (type && typeof type === 'string') {
      where.type = type.toUpperCase();
    }

    if (assigneeId && typeof assigneeId === 'string') {
      where.assigneeId = assigneeId;
    }

    if (requesterId && typeof requesterId === 'string') {
      where.requesterId = requesterId;
    }

    // Search filter (searches ticket number, subject, requester email/name)
    if (search && typeof search === 'string' && search.trim()) {
      const searchTerm = search.trim();
      const searchNum = parseInt(searchTerm);

      where.OR = [
        { subject: { contains: searchTerm, mode: 'insensitive' } },
        { requester: { email: { contains: searchTerm, mode: 'insensitive' } } },
        { requester: { firstName: { contains: searchTerm, mode: 'insensitive' } } },
        { requester: { lastName: { contains: searchTerm, mode: 'insensitive' } } },
        // Exact match for ticket number
        ...(!isNaN(searchNum) && searchNum > 0 ? [{ ticketNumber: searchNum }] : [])
      ];
    }

    // Sorting
    const validSortFields = ['ticketNumber', 'subject', 'status', 'priority', 'createdAt', 'updatedAt'];
    const sortBy = validSortFields.includes(sortField as string) ? sortField as string : 'updatedAt';
    const sortDir = sortDirection === 'asc' ? 'asc' : 'desc';

    // Get total count for pagination
    const totalCount = await prisma.ticket.count({ where });

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
      orderBy: { [sortBy]: sortDir },
      skip,
      take: limitNum
    });

    return res.json({
      tickets,
      pagination: {
        page: pageNum,
        limit: limitNum,
        totalCount,
        totalPages: Math.ceil(totalCount / limitNum)
      }
    });
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
          select: { id: true, email: true, firstName: true, lastName: true, isBlocked: true, blockedReason: true, timezone: true, timezoneOffset: true, country: true }
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
        },
        problem: {
          select: {
            id: true,
            ticketNumber: true,
            subject: true,
            status: true
          }
        },
        incidents: {
          select: {
            id: true,
            ticketNumber: true,
            subject: true,
            status: true,
            createdAt: true,
            requester: {
              select: { id: true, email: true, firstName: true, lastName: true }
            }
          },
          orderBy: { createdAt: 'desc' }
        },
        feedback: {
          select: {
            rating: true,
            userComment: true,
            submittedAt: true
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
    body('shownAiSuggestion').optional().isString(),
    body('requesterEmail').optional().isEmail().withMessage('Invalid email format')
  ],
  async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { subject, channel, priority, categoryId, formId, relatedTicketId, description, formResponses, userAgent, shownAiSuggestion, requesterEmail } = req.body;
      const userId = req.userId!;
      const userRole = req.userRole;

      // Check if the user is blocked
      if (userRole === 'USER') {
        const currentUser = await prisma.user.findUnique({
          where: { id: userId },
          select: { isBlocked: true }
        });
        if (currentUser?.isBlocked) {
          return res.status(403).json({ error: 'Your account has been blocked. You cannot create tickets.' });
        }
      }

      // Determine the requester ID
      let requesterId = userId;

      // If agent/admin provides a requesterEmail, find or create that user
      if (requesterEmail && (userRole === 'AGENT' || userRole === 'ADMIN')) {
        let requesterUser = await prisma.user.findUnique({
          where: { email: requesterEmail.toLowerCase() }
        });

        if (!requesterUser) {
          // Create new user with just the email
          requesterUser = await prisma.user.create({
            data: {
              email: requesterEmail.toLowerCase(),
              clerkId: `pending_${Date.now()}_${Math.random().toString(36).slice(2)}`,
              role: 'USER'
            }
          });
        }

        requesterId = requesterUser.id;
      }

      // Get IP address from request
      const ipAddress = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
                       req.socket.remoteAddress ||
                       'unknown';

      // Get country from Cloudflare header or IP geolocation
      const cfCountry = (req.headers['cf-ipcountry'] as string) ||
                       (req.headers['x-country'] as string) ||
                       null;

      const country = await getCountryFromIP(ipAddress, cfCountry);

      // Always update user's country and fill in missing timezone data
      if (requesterId) {
        const requesterUser = await prisma.user.findUnique({
          where: { id: requesterId },
          select: { country: true, timezoneOffset: true }
        });

        if (requesterUser) {
          // Update country if we detected one from IP (don't infer timezone from country)
          if (country && !requesterUser.country) {
            await prisma.user.update({
              where: { id: requesterId },
              data: { country }
            });
          }
        }
      }

      // Get user agent from request body (sent by frontend) or fallback to request header
      const clientUserAgent = userAgent || req.headers['user-agent'] || null;

      // Create ticket with initial comment and form responses in a transaction
      const ticket = await prisma.$transaction(async (tx) => {
        const newTicket = await tx.ticket.create({
          data: {
            subject,
            channel,
            priority: priority || 'NORMAL',
            requesterId,
            categoryId: categoryId || null,
            formId: formId || null,
            relatedTicketId: relatedTicketId || null,
            country,
            ipAddress,
            userAgent: clientUserAgent,
            shownAiSuggestion: shownAiSuggestion || null,
            comments: {
              create: {
                authorId: requesterId,
                body: description,
                bodyPlain: description,
                channel: 'WEB',
                isSystem: false
              }
            },
            activities: {
              create: {
                userId: requesterId,
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
    body('categoryId').optional().isUUID(),
    body('subject').optional().isString().trim().isLength({ min: 1, max: 500 }),
    body('type').optional().isIn(['NORMAL', 'PROBLEM', 'INCIDENT']),
    body('problemId').optional({ nullable: true }).isUUID()
  ],
  async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { id } = req.params;
      const { status, priority, assigneeId, categoryId, subject, type, problemId } = req.body;
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

      if (subject) {
        updateData.subject = subject;
        activities.push({
          userId,
          action: 'subject_changed',
          details: { newSubject: subject }
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

      // Handle ticket type changes
      if (type) {
        updateData.type = type;
        activities.push({
          userId,
          action: 'type_changed',
          details: { newType: type }
        });

        // Auto-set priority to URGENT for INCIDENT and PROBLEM tickets
        if (type === 'INCIDENT' || type === 'PROBLEM') {
          updateData.priority = 'URGENT';
          activities.push({
            userId,
            action: 'priority_changed',
            details: { newPriority: 'URGENT', reason: 'Auto-set for ' + type + ' ticket' }
          });
        }

        // If changing to INCIDENT without a problemId, clear any existing problemId
        // If changing to NORMAL or PROBLEM, clear problemId
        if (type !== 'INCIDENT') {
          updateData.problemId = null;
        }
      }

      // Handle linking incident to problem
      if (problemId !== undefined) {
        if (problemId === null) {
          // Unlinking from problem
          updateData.problemId = null;
          activities.push({
            userId,
            action: 'unlinked_from_problem',
            details: {}
          });
        } else {
          // Validate the problem ticket exists and is actually a PROBLEM type
          const problemTicket = await prisma.ticket.findUnique({
            where: { id: problemId },
            select: { id: true, ticketNumber: true, type: true, subject: true }
          });

          if (!problemTicket) {
            return res.status(400).json({ error: 'Problem ticket not found' });
          }

          if (problemTicket.type !== 'PROBLEM') {
            return res.status(400).json({
              error: 'Can only link incidents to PROBLEM type tickets',
              details: `Ticket #${problemTicket.ticketNumber} is type ${problemTicket.type}`
            });
          }

          updateData.problemId = problemId;
          // Also ensure this ticket is marked as INCIDENT with URGENT priority
          if (!type) {
            updateData.type = 'INCIDENT';
            updateData.priority = 'URGENT';
            activities.push({
              userId,
              action: 'priority_changed',
              details: { newPriority: 'URGENT', reason: 'Auto-set for INCIDENT ticket' }
            });
          }
          activities.push({
            userId,
            action: 'linked_to_problem',
            details: { problemId, problemTicketNumber: problemTicket.ticketNumber }
          });
        }
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

        // Also send feedback request email
        sendFeedbackRequestEmail({
          id: ticket.id,
          ticketNumber: ticket.ticketNumber,
          subject: ticket.subject,
          requester: ticket.requester
        }).catch(err => {
          console.error('[Email] Failed to send feedback request email:', err);
        });
      }

      // Auto-solve all linked incidents when a PROBLEM ticket is solved
      if (status === 'SOLVED') {
        const fullTicket = await prisma.ticket.findUnique({
          where: { id },
          select: { type: true, incidents: { select: { id: true, status: true, ticketNumber: true, requester: true } } }
        });

        if (fullTicket?.type === 'PROBLEM' && fullTicket.incidents.length > 0) {
          // Get the latest comment from this problem ticket to copy to incidents
          const latestComment = await prisma.comment.findFirst({
            where: { ticketId: id, isInternal: false },
            orderBy: { createdAt: 'desc' },
            select: { body: true, bodyPlain: true }
          });

          // Solve all linked incidents that aren't already solved
          const incidentsToSolve = fullTicket.incidents.filter(i => i.status !== 'SOLVED' && i.status !== 'CLOSED');

          for (const incident of incidentsToSolve) {
            // Update incident status to SOLVED
            await prisma.ticket.update({
              where: { id: incident.id },
              data: {
                status: 'SOLVED',
                solvedAt: new Date(),
                updatedAt: new Date(),
                activities: {
                  create: {
                    userId,
                    action: 'status_changed',
                    details: {
                      newStatus: 'SOLVED',
                      reason: 'auto_solved_with_problem',
                      problemTicketId: id,
                      problemTicketNumber: ticket.ticketNumber
                    }
                  }
                }
              }
            });

            // Copy the resolution comment to the incident
            if (latestComment) {
              await prisma.comment.create({
                data: {
                  ticketId: incident.id,
                  authorId: userId,
                  body: `<p><em>Resolution copied from Problem Ticket #${ticket.ticketNumber}:</em></p>${latestComment.body}`,
                  bodyPlain: `Resolution copied from Problem Ticket #${ticket.ticketNumber}:\n${latestComment.bodyPlain}`,
                  isInternal: false,
                  isSystem: true,
                  channel: 'SYSTEM'
                }
              });
            }

            // Send resolved email for each incident
            if (incident.requester) {
              sendTicketResolvedEmail({
                id: incident.id,
                ticketNumber: incident.ticketNumber,
                subject: ticket.subject, // Use problem ticket subject
                requester: incident.requester as any
              }).catch(err => {
                console.error(`[Email] Failed to send resolved email for incident #${incident.ticketNumber}:`, err);
              });

              // Also send feedback request email
              sendFeedbackRequestEmail({
                id: incident.id,
                ticketNumber: incident.ticketNumber,
                subject: ticket.subject,
                requester: incident.requester as any
              }).catch(err => {
                console.error(`[Email] Failed to send feedback request email for incident #${incident.ticketNumber}:`, err);
              });
            }
          }

          console.log(`[Problem/Incident] Auto-solved ${incidentsToSolve.length} incidents for problem ticket #${ticket.ticketNumber}`);
        }
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
    body('status').optional().isIn(['NEW', 'OPEN', 'PENDING', 'ON_HOLD', 'SOLVED', 'CLOSED']),
    body('assigneeId').optional().isUUID()
  ],
  async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { ticketIds, status, assigneeId } = req.body;
      const userId = req.userId!;

      const updateData: any = { updatedAt: new Date() };

      if (status) {
        updateData.status = status;

        if (status === 'SOLVED') {
          updateData.solvedAt = new Date();
        }
      }

      if (assigneeId !== undefined) {
        updateData.assigneeId = assigneeId;
      }

      await prisma.ticket.updateMany({
        where: { id: { in: ticketIds } },
        data: updateData
      });

      // Create activity logs for each ticket
      const activityPromises: Promise<any>[] = [];

      if (status) {
        ticketIds.forEach((ticketId: string) => {
          activityPromises.push(
            prisma.ticketActivity.create({
              data: {
                ticketId,
                userId,
                action: 'status_changed',
                details: { newStatus: status }
              }
            })
          );
        });
      }

      if (assigneeId !== undefined) {
        ticketIds.forEach((ticketId: string) => {
          activityPromises.push(
            prisma.ticketActivity.create({
              data: {
                ticketId,
                userId,
                action: 'assigned',
                details: { assigneeId: assigneeId || 'unassigned' }
              }
            })
          );
        });
      }

      if (activityPromises.length > 0) {
        await Promise.all(activityPromises);
      }

      return res.json({ success: true, updated: ticketIds.length });
    } catch (error) {
      console.error('Error bulk updating tickets:', error);
      return res.status(500).json({ error: 'Failed to bulk update tickets' });
    }
  }
);

// Bulk delete tickets (admin only - destructive operation)
router.delete('/bulk/delete',
  requireAuth,
  requireAdmin,
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

// Mark ticket as scam - blocks the requester and deletes the ticket
router.post('/:id/mark-scam',
  requireAuth,
  requireAgent,
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;

      // Get the ticket with requester info
      const ticket = await prisma.ticket.findUnique({
        where: { id },
        include: {
          requester: {
            select: { id: true, role: true, email: true }
          }
        }
      });

      if (!ticket) {
        return res.status(404).json({ error: 'Ticket not found' });
      }

      if (!ticket.requester) {
        return res.status(400).json({ error: 'Ticket has no requester' });
      }

      // Prevent blocking admins
      if (ticket.requester.role === 'ADMIN') {
        return res.status(400).json({ error: 'Cannot mark admin user as scam' });
      }

      // Block the requester
      await prisma.user.update({
        where: { id: ticket.requester.id },
        data: {
          isBlocked: true,
          blockedAt: new Date(),
          blockedReason: `Marked as scam from ticket #${ticket.ticketNumber}`
        }
      });

      // Delete the ticket
      await prisma.ticket.delete({
        where: { id }
      });

      return res.json({
        success: true,
        message: `User ${ticket.requester.email} blocked and ticket #${ticket.ticketNumber} deleted`
      });
    } catch (error) {
      console.error('Error marking ticket as scam:', error);
      return res.status(500).json({ error: 'Failed to mark ticket as scam' });
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

      // Cross-requester merges require admin role
      const differentRequesters = sourceTickets.filter(t => t.requesterId !== targetTicket.requesterId);
      if (differentRequesters.length > 0 && req.userRole !== 'ADMIN') {
        return res.status(403).json({
          error: 'Only admins can merge tickets from different requesters'
        });
      }

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

// Search for PROBLEM tickets to link incidents to
router.get('/problems/search', requireAuth, requireAgent, async (req: AuthRequest, res: Response) => {
  try {
    const { q, excludeId } = req.query;

    const where: any = {
      type: 'PROBLEM',
      status: { notIn: ['CLOSED'] } // Allow linking to solved problems too
    };

    // Exclude current ticket if provided
    if (excludeId && typeof excludeId === 'string') {
      where.id = { not: excludeId };
    }

    // Search by ticket number or subject
    if (q && typeof q === 'string' && q.trim()) {
      const searchTerm = q.trim();
      const ticketNumber = parseInt(searchTerm, 10);

      if (!isNaN(ticketNumber)) {
        // Search by ticket number
        where.ticketNumber = ticketNumber;
      } else {
        // Search by subject
        where.subject = { contains: searchTerm, mode: 'insensitive' };
      }
    }

    const problems = await prisma.ticket.findMany({
      where,
      select: {
        id: true,
        ticketNumber: true,
        subject: true,
        status: true,
        createdAt: true,
        _count: {
          select: { incidents: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 20
    });

    return res.json(problems);
  } catch (error) {
    console.error('Error searching problem tickets:', error);
    return res.status(500).json({ error: 'Failed to search problem tickets' });
  }
});

// Get ticket statistics (for dashboard)
router.get('/stats/overview', requireAuth, requireAgent, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    // Agents and Admins see all ticket stats
    const where = {};

    const [
      total,
      newCount,
      openCount,
      pendingCount,
      onHoldCount,
      solvedCount,
      closedCount,
      myUnsolvedCount,
      myRequestsCount,
      problemCount,
      incidentCount,
      unassignedCount
    ] = await Promise.all([
      prisma.ticket.count({ where }),
      prisma.ticket.count({ where: { ...where, status: 'NEW' } }),
      prisma.ticket.count({ where: { ...where, status: 'OPEN' } }),
      prisma.ticket.count({ where: { ...where, status: 'PENDING' } }),
      prisma.ticket.count({ where: { ...where, status: 'ON_HOLD' } }),
      prisma.ticket.count({ where: { ...where, status: 'SOLVED' } }),
      prisma.ticket.count({ where: { ...where, status: 'CLOSED' } }),
      // Count unsolved tickets assigned to current user
      prisma.ticket.count({ where: { assigneeId: userId, status: { in: ['OPEN', 'PENDING', 'ON_HOLD'] } } }),
      // Count tickets where current user is the requester
      prisma.ticket.count({ where: { requesterId: userId } }),
      prisma.ticket.count({ where: { ...where, type: 'PROBLEM' } }),
      prisma.ticket.count({ where: { ...where, type: 'INCIDENT' } }),
      // Count tickets with no assignee
      prisma.ticket.count({ where: { ...where, assigneeId: null } })
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
      },
      byType: {
        problem: problemCount,
        incident: incidentCount
      },
      myUnsolvedCount,
      myRequestsCount,
      unassignedCount
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
