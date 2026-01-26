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

// Get dashboard analytics with detailed charts data (admin only)
router.get('/dashboard', requireAuth, requireAdmin, async (_req: AuthRequest, res: Response) => {
  try {
    const [
      totalTickets,
      openTickets,
      solvedTickets,
      ticketsByStatus,
      ticketsByPriority,
      ticketsByCountry,
      ticketsByChannel,
      ticketsByForm,
      ticketTrend,
      ticketsByAgent,
      ticketsByCategory,
      avgResolutionTime,
      totalComments,
      hourlyDistribution,
      weekdayDistribution
    ] = await Promise.all([
      // Total tickets
      prisma.ticket.count(),

      // Open tickets (NEW, OPEN, PENDING, ON_HOLD)
      prisma.ticket.count({
        where: { status: { in: ['NEW', 'OPEN', 'PENDING', 'ON_HOLD'] } }
      }),

      // Solved tickets
      prisma.ticket.count({ where: { status: 'SOLVED' } }),

      // Tickets by status
      prisma.ticket.groupBy({
        by: ['status'],
        _count: true
      }),

      // Tickets by priority
      prisma.ticket.groupBy({
        by: ['priority'],
        _count: true
      }),

      // Tickets by country
      prisma.ticket.groupBy({
        by: ['country'],
        _count: true,
        where: { country: { not: null } }
      }),

      // Tickets by channel
      prisma.ticket.groupBy({
        by: ['channel'],
        _count: true
      }),

      // Tickets by form
      prisma.ticket.groupBy({
        by: ['formId'],
        _count: true,
        where: { formId: { not: null } }
      }),

      // Ticket trend (last 30 days, grouped by day)
      prisma.$queryRaw`
        SELECT
          DATE("createdAt") as date,
          COUNT(*) as count,
          COUNT(CASE WHEN status = 'SOLVED' THEN 1 END) as solved
        FROM "Ticket"
        WHERE "createdAt" >= NOW() - INTERVAL '30 days'
        GROUP BY DATE("createdAt")
        ORDER BY date ASC
      `,

      // Tickets by agent (assigned tickets)
      prisma.ticket.groupBy({
        by: ['assigneeId'],
        _count: true,
        where: { assigneeId: { not: null } }
      }),

      // Tickets by category
      prisma.ticket.groupBy({
        by: ['categoryId'],
        _count: true,
        where: { categoryId: { not: null } }
      }),

      // Average resolution time for solved tickets
      prisma.$queryRaw<Array<{ avg_hours: number }>>`
        SELECT
          AVG(EXTRACT(EPOCH FROM ("solvedAt" - "createdAt")) / 3600) as avg_hours
        FROM "Ticket"
        WHERE "solvedAt" IS NOT NULL
      `,

      // Total comments
      prisma.comment.count(),

      // Hourly distribution (when tickets are created)
      prisma.$queryRaw`
        SELECT
          EXTRACT(HOUR FROM "createdAt") as hour,
          COUNT(*) as count
        FROM "Ticket"
        GROUP BY EXTRACT(HOUR FROM "createdAt")
        ORDER BY hour ASC
      `,

      // Weekday distribution
      prisma.$queryRaw`
        SELECT
          EXTRACT(DOW FROM "createdAt") as day,
          COUNT(*) as count
        FROM "Ticket"
        GROUP BY EXTRACT(DOW FROM "createdAt")
        ORDER BY day ASC
      `
    ]);

    // Process status data
    const statusData = ticketsByStatus.map(item => ({
      name: item.status,
      value: item._count,
      label: item.status.replace('_', ' ')
    }));

    // Process priority data
    const priorityData = ticketsByPriority.map(item => ({
      name: item.priority,
      value: item._count,
      label: item.priority.charAt(0) + item.priority.slice(1).toLowerCase()
    }));

    // Process country data
    const countryData = await Promise.all(
      ticketsByCountry.map(async (item) => ({
        name: item.country || 'Unknown',
        value: item._count
      }))
    );

    // Sort and limit to top 10 countries
    const topCountries = countryData
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);

    // Process channel data
    const channelData = ticketsByChannel.map(item => ({
      name: item.channel,
      value: item._count
    }));

    // Process form data with names
    const formDataWithNames = await Promise.all(
      ticketsByForm.map(async (item) => {
        if (!item.formId) return null;
        const form = await prisma.form.findUnique({
          where: { id: item.formId },
          select: { name: true }
        });
        return {
          name: form?.name || 'Unknown Form',
          value: item._count
        };
      })
    );

    const formData = formDataWithNames.filter(Boolean).slice(0, 10);

    // Process agent data with names
    const agentDataWithNames = await Promise.all(
      ticketsByAgent.map(async (item) => {
        if (!item.assigneeId) return null;
        const agent = await prisma.user.findUnique({
          where: { id: item.assigneeId },
          select: { email: true, firstName: true, lastName: true }
        });
        const name = agent
          ? (agent.firstName || agent.lastName
            ? `${agent.firstName || ''} ${agent.lastName || ''}`.trim()
            : agent.email)
          : 'Unknown';

        // Get solved tickets for this agent
        const solvedCount = await prisma.ticket.count({
          where: { assigneeId: item.assigneeId, status: 'SOLVED' }
        });

        return {
          name,
          total: item._count,
          solved: solvedCount,
          solveRate: item._count > 0 ? ((solvedCount / item._count) * 100).toFixed(1) : '0'
        };
      })
    );
    const agentData = agentDataWithNames.filter(Boolean).sort((a: any, b: any) => b.total - a.total);

    // Process category data with names
    const categoryDataWithNames = await Promise.all(
      ticketsByCategory.map(async (item) => {
        if (!item.categoryId) return null;
        const category = await prisma.category.findUnique({
          where: { id: item.categoryId },
          select: { name: true }
        });
        return {
          name: category?.name || 'Unknown Category',
          value: item._count
        };
      })
    );
    const categoryData = categoryDataWithNames.filter(Boolean);

    // Calculate average resolution time in hours
    const avgResolutionHours = avgResolutionTime[0]?.avg_hours
      ? Math.round(parseFloat(avgResolutionTime[0].avg_hours.toString()))
      : 0;

    // Calculate average comments per ticket
    const avgCommentsPerTicket = totalTickets > 0 ? (totalComments / totalTickets).toFixed(1) : '0';

    // Process hourly distribution
    const hourlyData = Array.from({ length: 24 }, (_, i) => {
      const found = (hourlyDistribution as any[]).find((h: any) => parseInt(h.hour) === i);
      return {
        hour: i,
        count: found ? Number(found.count) : 0,
        label: `${i}:00`
      };
    });

    // Process weekday distribution
    const weekdayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const weekdayData = weekdayNames.map((name, i) => {
      const found = (weekdayDistribution as any[]).find((d: any) => parseInt(d.day) === i);
      return {
        name,
        value: found ? Number(found.count) : 0
      };
    });

    // Convert BigInt values in trend data to numbers
    const trendData = (ticketTrend as any[]).map((item: any) => ({
      date: item.date,
      count: Number(item.count),
      solved: Number(item.solved)
    }));

    return res.json({
      overview: {
        totalTickets,
        openTickets,
        solvedTickets,
        avgResolutionTime: avgResolutionHours,
        solveRate: totalTickets > 0 ? ((solvedTickets / totalTickets) * 100).toFixed(1) : '0',
        totalComments,
        avgCommentsPerTicket
      },
      charts: {
        status: statusData,
        priority: priorityData,
        country: topCountries,
        channel: channelData,
        forms: formData,
        agents: agentData,
        categories: categoryData,
        hourly: hourlyData,
        weekday: weekdayData
      },
      trend: trendData
    });
  } catch (error) {
    console.error('Error fetching dashboard analytics:', error);
    return res.status(500).json({ error: 'Failed to fetch dashboard analytics' });
  }
});

export default router;
