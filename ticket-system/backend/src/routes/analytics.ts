import { Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import { requireAuth, requireAdmin, AuthRequest } from '../middleware/auth';

const router = Router();

// Get agent performance analytics (admin only)
router.get('/agents', requireAuth, requireAdmin, async (_req: AuthRequest, res: Response) => {
  try {
    const agents = await prisma.user.findMany({
      where: {
        role: { in: ['AGENT', 'ADMIN'] }
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        createdAt: true
      }
    });

    const agentStats = await Promise.all(
      agents.map(async (agent) => {
        // Get session statistics
        const sessions = await prisma.agentSession.findMany({
          where: { agentId: agent.id },
          orderBy: { loginAt: 'desc' }
        });

        const totalSessions = sessions.length;
        const completedSessions = sessions.filter(s => s.logoutAt !== null);
        const totalDuration = completedSessions.reduce((sum, s) => sum + (s.duration || 0), 0);
        const avgDuration = completedSessions.length > 0 ? totalDuration / completedSessions.length : 0;
        const totalReplies = sessions.reduce((sum, s) => sum + s.replyCount, 0);

        const lastLogin = sessions[0]?.loginAt || null;
        const isOnline = sessions.some(s => s.logoutAt === null);

        // Get ticket assignment stats
        const [assignedTickets, solvedTickets] = await Promise.all([
          prisma.ticket.count({ where: { assigneeId: agent.id } }),
          prisma.ticket.count({ where: { assigneeId: agent.id, status: 'SOLVED' } })
        ]);

        return {
          agent: {
            id: agent.id,
            email: agent.email,
            name: `${agent.firstName || ''} ${agent.lastName || ''}`.trim() || agent.email,
            role: agent.role
          },
          sessions: {
            total: totalSessions,
            totalDuration,
            avgDuration: Math.round(avgDuration),
            lastLogin,
            isOnline
          },
          tickets: {
            assigned: assignedTickets,
            solved: solvedTickets,
            solveRate: assignedTickets > 0 ? (solvedTickets / assignedTickets) * 100 : 0
          },
          replies: {
            total: totalReplies,
            avgPerSession: totalSessions > 0 ? totalReplies / totalSessions : 0
          }
        };
      })
    );

    return res.json(agentStats);
  } catch (error) {
    console.error('Error fetching agent analytics:', error);
    return res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// Get system-wide statistics (admin only)
router.get('/system', requireAuth, requireAdmin, async (_req: AuthRequest, res: Response) => {
  try {
    const [
      totalTickets,
      totalUsers,
      totalAgents,
      ticketsByStatus,
      ticketsByPriority,
      recentTickets
    ] = await Promise.all([
      prisma.ticket.count(),
      prisma.user.count({ where: { role: 'USER' } }),
      prisma.user.count({ where: { role: { in: ['AGENT', 'ADMIN'] } } }),

      prisma.ticket.groupBy({
        by: ['status'],
        _count: true
      }),

      prisma.ticket.groupBy({
        by: ['priority'],
        _count: true
      }),

      prisma.ticket.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          requester: {
            select: { email: true, firstName: true, lastName: true }
          },
          assignee: {
            select: { email: true, firstName: true, lastName: true }
          }
        }
      })
    ]);

    const statusMap = ticketsByStatus.reduce((acc, item) => {
      acc[item.status.toLowerCase()] = item._count;
      return acc;
    }, {} as Record<string, number>);

    const priorityMap = ticketsByPriority.reduce((acc, item) => {
      acc[item.priority.toLowerCase()] = item._count;
      return acc;
    }, {} as Record<string, number>);

    return res.json({
      overview: {
        totalTickets,
        totalUsers,
        totalAgents
      },
      tickets: {
        byStatus: statusMap,
        byPriority: priorityMap,
        recent: recentTickets
      }
    });
  } catch (error) {
    console.error('Error fetching system analytics:', error);
    return res.status(500).json({ error: 'Failed to fetch system analytics' });
  }
});

// Get agent session history (admin only)
router.get('/agents/:agentId/sessions', requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { agentId } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;

    const sessions = await prisma.agentSession.findMany({
      where: { agentId },
      orderBy: { loginAt: 'desc' },
      take: limit,
      include: {
        agent: {
          select: { email: true, firstName: true, lastName: true }
        }
      }
    });

    return res.json(sessions);
  } catch (error) {
    console.error('Error fetching agent sessions:', error);
    return res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

export default router;
