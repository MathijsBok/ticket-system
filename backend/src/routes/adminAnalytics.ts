import { Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import { requireAuth, requireAdmin, AuthRequest } from '../middleware/auth';

const router = Router();

// Get comprehensive ticket analytics with agent contributions
router.get('/ticket-contributions', requireAuth, requireAdmin, async (_req: AuthRequest, res: Response) => {
  try {
    // Get all tickets with their time entries and comments
    const tickets = await prisma.ticket.findMany({
      include: {
        timeEntries: {
          include: {
            agent: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true
              }
            }
          }
        },
        comments: {
          include: {
            author: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                role: true
              }
            }
          }
        },
        requester: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true
          }
        },
        assignee: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Calculate agent contributions for each ticket
    const ticketContributions = tickets.map(ticket => {
      const agentContributions: Record<string, any> = {};

      // Calculate time spent by each agent
      ticket.timeEntries.forEach(entry => {
        if (!agentContributions[entry.agentId]) {
          agentContributions[entry.agentId] = {
            agent: entry.agent,
            timeSpent: 0,
            replyCount: 0
          };
        }
        agentContributions[entry.agentId].timeSpent += entry.duration || 0;
      });

      // Calculate reply count by each agent (exclude system and internal comments for contribution)
      ticket.comments.forEach(comment => {
        if (comment.author.role === 'AGENT' || comment.author.role === 'ADMIN') {
          if (!agentContributions[comment.authorId]) {
            agentContributions[comment.authorId] = {
              agent: comment.author,
              timeSpent: 0,
              replyCount: 0
            };
          }
          agentContributions[comment.authorId].replyCount += 1;
        }
      });

      // Calculate contribution percentage for each agent
      const totalTime = Object.values(agentContributions).reduce((sum: number, contrib: any) => sum + contrib.timeSpent, 0);
      const totalReplies = Object.values(agentContributions).reduce((sum: number, contrib: any) => sum + contrib.replyCount, 0);

      Object.keys(agentContributions).forEach(agentId => {
        const contrib = agentContributions[agentId];

        // Calculate weighted contribution (60% time, 40% replies)
        const timePercentage = totalTime > 0 ? (contrib.timeSpent / totalTime) : 0;
        const replyPercentage = totalReplies > 0 ? (contrib.replyCount / totalReplies) : 0;

        contrib.contributionPercentage = Math.round((timePercentage * 0.6 + replyPercentage * 0.4) * 100);
      });

      return {
        id: ticket.id,
        ticketNumber: ticket.ticketNumber,
        subject: ticket.subject,
        status: ticket.status,
        priority: ticket.priority,
        createdAt: ticket.createdAt,
        solvedAt: ticket.solvedAt,
        requester: ticket.requester,
        assignee: ticket.assignee,
        totalTime: totalTime,
        totalReplies: totalReplies,
        agentContributions: Object.values(agentContributions)
      };
    });

    return res.json({
      tickets: ticketContributions
    });
  } catch (error) {
    console.error('Error fetching ticket contributions:', error);
    return res.status(500).json({ error: 'Failed to fetch ticket contributions' });
  }
});

// Get agent performance metrics
router.get('/agent-performance', requireAuth, requireAdmin, async (_req: AuthRequest, res: Response) => {
  try {
    // Get all agents and admins
    const agents = await prisma.user.findMany({
      where: {
        OR: [
          { role: 'AGENT' },
          { role: 'ADMIN' }
        ]
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true
      }
    });

    // Calculate performance metrics for each agent
    const agentPerformance = await Promise.all(
      agents.map(async (agent) => {
        // Get all comments by this agent (excluding system comments)
        const comments = await prisma.comment.findMany({
          where: {
            authorId: agent.id,
            isSystem: false
          },
          include: {
            ticket: {
              select: {
                id: true
              }
            }
          }
        });

        // Total replies (each comment counts individually)
        const totalReplies = comments.length;

        // Get unique tickets the agent worked on
        const uniqueTicketIds = new Set<string>();
        comments.forEach(comment => uniqueTicketIds.add(comment.ticket.id));
        const totalTickets = uniqueTicketIds.size;

        // Calculate average replies per ticket
        const avgRepliesPerTicket = totalTickets > 0
          ? (totalReplies / totalTickets).toFixed(1)
          : '0.0';

        // Calculate contribution: average contribution per ticket
        // For each ticket: (agent's comments) / (total comments on ticket) × 100
        // Then average across all tickets
        let contribution = 0;
        if (totalTickets > 0) {
          const ticketContributions: number[] = [];

          for (const ticketId of uniqueTicketIds) {
            // Count agent's comments on this ticket
            const agentCommentsOnTicket = comments.filter(c => c.ticket.id === ticketId).length;

            // Count total comments on this ticket (from all users, excluding system)
            const totalCommentsOnTicket = await prisma.comment.count({
              where: {
                ticketId: ticketId,
                isSystem: false
              }
            });

            if (totalCommentsOnTicket > 0) {
              const ticketContribution = (agentCommentsOnTicket / totalCommentsOnTicket) * 100;
              ticketContributions.push(ticketContribution);
            }
          }

          // Average contribution across all tickets
          if (ticketContributions.length > 0) {
            contribution = Math.round(
              ticketContributions.reduce((sum, c) => sum + c, 0) / ticketContributions.length
            );
          }
        }

        return {
          agent,
          totalReplies,
          totalTickets,
          avgRepliesPerTicket,
          contribution
        };
      })
    );

    // Sort by total replies descending
    agentPerformance.sort((a, b) => b.totalReplies - a.totalReplies);

    return res.json({
      agents: agentPerformance
    });
  } catch (error) {
    console.error('Error fetching agent performance:', error);
    return res.status(500).json({ error: 'Failed to fetch agent performance' });
  }
});

export default router;
