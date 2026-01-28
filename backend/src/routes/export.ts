import { Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import { requireAuth, requireAdmin, AuthRequest } from '../middleware/auth';
import PDFDocument from 'pdfkit';

const router = Router();

// Helper function to generate AI-style insights from analytics data
function generateInsights(data: any): string[] {
  const insights: string[] = [];
  const { overview, charts } = data;

  // Solve rate insights
  const solveRate = parseFloat(overview.solveRate);
  if (solveRate >= 80) {
    insights.push(`Excellent resolution performance with ${overview.solveRate}% solve rate. Your team is effectively resolving customer issues.`);
  } else if (solveRate >= 50) {
    insights.push(`Moderate solve rate at ${overview.solveRate}%. Consider reviewing open tickets for potential quick wins and prioritizing ticket backlog.`);
  } else {
    insights.push(`Solve rate of ${overview.solveRate}% indicates significant backlog. Recommend increasing agent capacity or implementing automation for common issues.`);
  }

  // Resolution time insights
  if (overview.avgResolutionTime > 0) {
    if (overview.avgResolutionTime <= 24) {
      insights.push(`Average resolution time of ${overview.avgResolutionTime} hours shows strong response capability. Customers receive timely support.`);
    } else if (overview.avgResolutionTime <= 72) {
      insights.push(`Average resolution time of ${overview.avgResolutionTime} hours is within acceptable range. Consider implementing SLA reminders for aging tickets.`);
    } else {
      insights.push(`Average resolution time of ${overview.avgResolutionTime} hours may impact customer satisfaction. Review workflow for bottlenecks.`);
    }
  }

  // Status distribution insights
  if (charts.status && charts.status.length > 0) {
    const pendingTickets = charts.status.find((s: any) => s.name === 'PENDING');
    const onHoldTickets = charts.status.find((s: any) => s.name === 'ON_HOLD');
    const newTickets = charts.status.find((s: any) => s.name === 'NEW');

    if (newTickets && newTickets.value > overview.totalTickets * 0.2) {
      insights.push(`${newTickets.value} unassigned tickets (${((newTickets.value / overview.totalTickets) * 100).toFixed(0)}% of total) need attention. Consider auto-assignment rules.`);
    }
    if (pendingTickets && pendingTickets.value > 0) {
      insights.push(`${pendingTickets.value} tickets are pending customer response. Follow-up automation could help reduce wait times.`);
    }
    if (onHoldTickets && onHoldTickets.value > 0) {
      insights.push(`${onHoldTickets.value} tickets are on hold. Regular review of held tickets prevents them from becoming stale.`);
    }
  }

  // Priority insights
  if (charts.priority && charts.priority.length > 0) {
    const urgentTickets = charts.priority.find((p: any) => p.name === 'URGENT');
    const highTickets = charts.priority.find((p: any) => p.name === 'HIGH');
    const criticalCount = (urgentTickets?.value || 0) + (highTickets?.value || 0);

    if (criticalCount > 0) {
      const percentage = ((criticalCount / overview.totalTickets) * 100).toFixed(0);
      insights.push(`${criticalCount} high-priority tickets (${percentage}% of total) require immediate attention from senior agents.`);
    }
  }

  // Channel insights
  if (charts.channel && charts.channel.length > 0) {
    const topChannel = charts.channel.reduce((a: any, b: any) => a.value > b.value ? a : b);
    const channelPercentage = ((topChannel.value / overview.totalTickets) * 100).toFixed(0);
    insights.push(`${topChannel.name} is the primary support channel (${channelPercentage}% of tickets). Ensure this channel is well-staffed.`);
  }

  // Agent performance insights
  if (charts.agents && charts.agents.length > 0) {
    const topPerformer = charts.agents.reduce((a: any, b: any) =>
      parseFloat(a.solveRate || '0') > parseFloat(b.solveRate || '0') ? a : b
    );
    if (parseFloat(topPerformer.solveRate) > 0) {
      insights.push(`Top performing agent "${topPerformer.name}" has ${topPerformer.solveRate}% solve rate. Consider sharing their techniques with the team.`);
    }

    const avgAgentTickets = charts.agents.reduce((sum: number, a: any) => sum + a.total, 0) / charts.agents.length;
    const overloadedAgents = charts.agents.filter((a: any) => a.total > avgAgentTickets * 1.5);
    if (overloadedAgents.length > 0) {
      insights.push(`${overloadedAgents.length} agent(s) handle significantly more tickets than average. Consider workload rebalancing.`);
    }
  }

  // Time-based insights
  if (charts.hourly && charts.hourly.length > 0) {
    const peakHour = charts.hourly.reduce((a: any, b: any) => a.count > b.count ? a : b);
    if (peakHour.count > 0) {
      insights.push(`Peak ticket creation occurs at ${peakHour.label}. Schedule maximum agent coverage during this time.`);
    }
  }

  if (charts.weekday && charts.weekday.length > 0) {
    const busyDays = charts.weekday.filter((d: any) => d.value > 0).sort((a: any, b: any) => b.value - a.value);
    if (busyDays.length > 0) {
      insights.push(`${busyDays[0].name} is the busiest day with ${busyDays[0].value} tickets. Plan staffing accordingly.`);
    }
  }

  // Category insights
  if (charts.categories && charts.categories.length > 0) {
    const topCategory = charts.categories.reduce((a: any, b: any) => a.value > b.value ? a : b);
    const percentage = ((topCategory.value / overview.totalTickets) * 100).toFixed(0);
    insights.push(`"${topCategory.name}" is the most common issue category (${percentage}%). Consider creating dedicated documentation or automation for this area.`);
  }

  return insights;
}

// Export analytics as PDF
router.get('/analytics/pdf', requireAuth, requireAdmin, async (_req: AuthRequest, res: Response) => {
  try {
    // Fetch all analytics data
    const [
      totalTickets,
      openTickets,
      solvedTickets,
      ticketsByStatus,
      ticketsByPriority,
      ticketsByChannel,
      ticketsByAgent,
      ticketsByCategory,
      avgResolutionTime,
      totalComments,
      hourlyDistribution,
      weekdayDistribution,
      totalUsers,
      totalAgents
    ] = await Promise.all([
      prisma.ticket.count(),
      prisma.ticket.count({
        where: { status: { in: ['NEW', 'OPEN', 'PENDING', 'ON_HOLD'] } }
      }),
      prisma.ticket.count({ where: { status: 'SOLVED' } }),
      prisma.ticket.groupBy({ by: ['status'], _count: true }),
      prisma.ticket.groupBy({ by: ['priority'], _count: true }),
      prisma.ticket.groupBy({ by: ['channel'], _count: true }),
      prisma.ticket.groupBy({
        by: ['assigneeId'],
        _count: true,
        where: { assigneeId: { not: null } }
      }),
      prisma.ticket.groupBy({
        by: ['categoryId'],
        _count: true,
        where: { categoryId: { not: null } }
      }),
      prisma.$queryRaw<Array<{ avg_hours: number }>>`
        SELECT AVG(EXTRACT(EPOCH FROM ("solvedAt" - "createdAt")) / 3600) as avg_hours
        FROM "Ticket" WHERE "solvedAt" IS NOT NULL
      `,
      prisma.comment.count(),
      prisma.$queryRaw`
        SELECT EXTRACT(HOUR FROM "createdAt") as hour, COUNT(*) as count
        FROM "Ticket" GROUP BY EXTRACT(HOUR FROM "createdAt") ORDER BY hour ASC
      `,
      prisma.$queryRaw`
        SELECT EXTRACT(DOW FROM "createdAt") as day, COUNT(*) as count
        FROM "Ticket" GROUP BY EXTRACT(DOW FROM "createdAt") ORDER BY day ASC
      `,
      prisma.user.count({ where: { role: 'USER' } }),
      prisma.user.count({ where: { role: { in: ['AGENT', 'ADMIN'] } } })
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

    // Process channel data
    const channelData = ticketsByChannel.map(item => ({
      name: item.channel,
      value: item._count
    }));

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

    // Process category data
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

    // Process hourly data
    const hourlyData = Array.from({ length: 24 }, (_, i) => {
      const found = (hourlyDistribution as any[]).find((h: any) => parseInt(h.hour) === i);
      return {
        hour: i,
        count: found ? Number(found.count) : 0,
        label: `${i}:00`
      };
    });

    // Process weekday data
    const weekdayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const weekdayData = weekdayNames.map((name, i) => {
      const found = (weekdayDistribution as any[]).find((d: any) => parseInt(d.day) === i);
      return {
        name,
        value: found ? Number(found.count) : 0
      };
    });

    const avgResolutionHours = avgResolutionTime[0]?.avg_hours
      ? Math.round(parseFloat(avgResolutionTime[0].avg_hours.toString()))
      : 0;

    // Build analytics object for insights
    const analyticsData = {
      overview: {
        totalTickets,
        openTickets,
        solvedTickets,
        avgResolutionTime: avgResolutionHours,
        solveRate: totalTickets > 0 ? ((solvedTickets / totalTickets) * 100).toFixed(1) : '0',
        totalComments,
        avgCommentsPerTicket: totalTickets > 0 ? (totalComments / totalTickets).toFixed(1) : '0',
        totalUsers,
        totalAgents
      },
      charts: {
        status: statusData,
        priority: priorityData,
        channel: channelData,
        agents: agentData,
        categories: categoryData,
        hourly: hourlyData,
        weekday: weekdayData
      }
    };

    // Generate AI insights
    const insights = generateInsights(analyticsData);

    // Create PDF
    const doc = new PDFDocument({ margin: 50, size: 'A4' });

    // Set response headers
    const filename = `analytics-report-${new Date().toISOString().split('T')[0]}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    // Pipe to response
    doc.pipe(res);

    // Header
    doc.fontSize(24).fillColor('#1f2937').text('Analytics Report', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(12).fillColor('#6b7280').text(`Generated on ${new Date().toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
    })}`, { align: 'center' });
    doc.moveDown(2);

    // Overview Section
    doc.fontSize(18).fillColor('#1f2937').text('Overview', { underline: true });
    doc.moveDown(0.5);

    const overviewItems = [
      { label: 'Total Tickets', value: totalTickets.toString() },
      { label: 'Open Tickets', value: openTickets.toString() },
      { label: 'Solved Tickets', value: solvedTickets.toString() },
      { label: 'Solve Rate', value: `${analyticsData.overview.solveRate}%` },
      { label: 'Avg Resolution Time', value: avgResolutionHours > 0 ? `${avgResolutionHours} hours` : 'N/A' },
      { label: 'Total Comments', value: totalComments.toString() },
      { label: 'Avg Comments/Ticket', value: analyticsData.overview.avgCommentsPerTicket },
      { label: 'Total Users', value: totalUsers.toString() },
      { label: 'Total Agents', value: totalAgents.toString() }
    ];

    doc.fontSize(11).fillColor('#374151');
    overviewItems.forEach(item => {
      doc.text(`${item.label}: `, { continued: true }).fillColor('#1f2937').text(item.value);
      doc.fillColor('#374151');
    });
    doc.moveDown(1.5);

    // Status Distribution
    doc.fontSize(18).fillColor('#1f2937').text('Ticket Status Distribution', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(11).fillColor('#374151');
    statusData.forEach(item => {
      const percentage = totalTickets > 0 ? ((item.value / totalTickets) * 100).toFixed(1) : '0';
      doc.text(`${item.label}: ${item.value} (${percentage}%)`);
    });
    doc.moveDown(1.5);

    // Priority Distribution
    doc.fontSize(18).fillColor('#1f2937').text('Ticket Priority Distribution', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(11).fillColor('#374151');
    priorityData.forEach(item => {
      const percentage = totalTickets > 0 ? ((item.value / totalTickets) * 100).toFixed(1) : '0';
      doc.text(`${item.label}: ${item.value} (${percentage}%)`);
    });
    doc.moveDown(1.5);

    // Channel Distribution
    doc.fontSize(18).fillColor('#1f2937').text('Tickets by Channel', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(11).fillColor('#374151');
    channelData.forEach(item => {
      const percentage = totalTickets > 0 ? ((item.value / totalTickets) * 100).toFixed(1) : '0';
      doc.text(`${item.name}: ${item.value} (${percentage}%)`);
    });
    doc.moveDown(1.5);

    // Agent Performance
    if (agentData.length > 0) {
      doc.addPage();
      doc.fontSize(18).fillColor('#1f2937').text('Agent Performance', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(11).fillColor('#374151');
      agentData.forEach((agent: any) => {
        doc.text(`${agent.name}: ${agent.total} tickets, ${agent.solved} solved (${agent.solveRate}% solve rate)`);
      });
      doc.moveDown(1.5);
    }

    // Category Distribution
    if (categoryData.length > 0) {
      doc.fontSize(18).fillColor('#1f2937').text('Tickets by Category', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(11).fillColor('#374151');
      categoryData.slice(0, 10).forEach((cat: any) => {
        const percentage = totalTickets > 0 ? ((cat.value / totalTickets) * 100).toFixed(1) : '0';
        doc.text(`${cat.name}: ${cat.value} (${percentage}%)`);
      });
      doc.moveDown(1.5);
    }

    // Daily Distribution
    doc.fontSize(18).fillColor('#1f2937').text('Tickets by Day of Week', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(11).fillColor('#374151');
    weekdayData.forEach(day => {
      const bar = '█'.repeat(Math.ceil(day.value / (Math.max(...weekdayData.map(d => d.value)) || 1) * 20));
      doc.text(`${day.name.padEnd(10)}: ${bar} ${day.value}`);
    });
    doc.moveDown(1.5);

    // Hourly Distribution
    doc.fontSize(18).fillColor('#1f2937').text('Peak Hours', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(11).fillColor('#374151');
    const peakHours = hourlyData.filter(h => h.count > 0).sort((a, b) => b.count - a.count).slice(0, 5);
    peakHours.forEach(hour => {
      doc.text(`${hour.label}: ${hour.count} tickets`);
    });
    doc.moveDown(1.5);

    // AI Insights Section
    doc.addPage();
    doc.fontSize(20).fillColor('#1f2937').text('AI-Generated Insights', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor('#6b7280').text('Automated analysis based on your ticket data', { align: 'center' });
    doc.moveDown(1.5);

    // Draw insights with visual styling
    insights.forEach((insight, index) => {
      // Insight box
      doc.fillColor('#f3f4f6')
        .roundedRect(doc.x, doc.y, 495, 60, 5)
        .fill();

      doc.fillColor('#1f2937')
        .fontSize(11)
        .text(`${index + 1}. ${insight}`, doc.x + 10, doc.y + 10, {
          width: 475,
          align: 'left'
        });

      doc.moveDown(2);
    });

    // Footer
    doc.fontSize(9)
      .fillColor('#9ca3af')
      .text(
        'This report was automatically generated by the Support Ticket System.',
        50,
        doc.page.height - 50,
        { align: 'center' }
      );

    // Finalize PDF
    doc.end();
    return;
  } catch (error) {
    console.error('Error generating analytics PDF:', error);
    return res.status(500).json({ error: 'Failed to generate analytics PDF' });
  }
});

// Export tickets as JSON with date filtering
router.get('/tickets/json', requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { startDate, endDate } = req.query;

    const whereClause: any = {};
    if (startDate || endDate) {
      whereClause.createdAt = {};
      if (startDate) {
        whereClause.createdAt.gte = new Date(startDate as string);
      }
      if (endDate) {
        // Add one day to include the end date fully
        const end = new Date(endDate as string);
        end.setDate(end.getDate() + 1);
        whereClause.createdAt.lte = end;
      }
    }

    const tickets = await prisma.ticket.findMany({
      where: whereClause,
      include: {
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
        },
        category: {
          select: {
            id: true,
            name: true
          }
        },
        comments: {
          select: {
            id: true,
            body: true,
            bodyPlain: true,
            isInternal: true,
            createdAt: true,
            author: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true
              }
            }
          },
          orderBy: { createdAt: 'asc' }
        },
        formResponses: {
          include: {
            field: {
              select: {
                id: true,
                label: true,
                fieldType: true
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Format the export data
    const exportData = {
      exportDate: new Date().toISOString(),
      dateRange: {
        start: startDate || null,
        end: endDate || null
      },
      totalTickets: tickets.length,
      tickets: tickets.map(ticket => ({
        id: ticket.id,
        ticketNumber: ticket.ticketNumber,
        subject: ticket.subject,
        status: ticket.status,
        priority: ticket.priority,
        channel: ticket.channel,
        country: ticket.country,
        createdAt: ticket.createdAt,
        updatedAt: ticket.updatedAt,
        solvedAt: ticket.solvedAt,
        closedAt: ticket.closedAt,
        requester: ticket.requester,
        assignee: ticket.assignee,
        category: ticket.category,
        comments: ticket.comments,
        formResponses: ticket.formResponses.map(fr => ({
          fieldLabel: fr.field.label,
          fieldType: fr.field.fieldType,
          value: fr.value
        }))
      }))
    };

    const filename = `tickets-export-${new Date().toISOString().split('T')[0]}.json`;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    return res.json(exportData);
  } catch (error) {
    console.error('Error exporting tickets:', error);
    return res.status(500).json({ error: 'Failed to export tickets' });
  }
});

// Export users as JSON with date filtering
router.get('/users/json', requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { startDate, endDate } = req.query;

    const whereClause: any = {};
    if (startDate || endDate) {
      whereClause.createdAt = {};
      if (startDate) {
        whereClause.createdAt.gte = new Date(startDate as string);
      }
      if (endDate) {
        // Add one day to include the end date fully
        const end = new Date(endDate as string);
        end.setDate(end.getDate() + 1);
        whereClause.createdAt.lte = end;
      }
    }

    const users = await prisma.user.findMany({
      where: whereClause,
      select: {
        id: true,
        clerkId: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        timezone: true,
        isBlocked: true,
        blockedReason: true,
        createdAt: true,
        lastSeenAt: true,
        _count: {
          select: {
            ticketsCreated: true,
            ticketsAssigned: true,
            comments: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Format the export data
    const exportData = {
      exportDate: new Date().toISOString(),
      dateRange: {
        start: startDate || null,
        end: endDate || null
      },
      totalUsers: users.length,
      users: users.map(user => ({
        id: user.id,
        clerkId: user.clerkId,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        timezone: user.timezone,
        isBlocked: user.isBlocked,
        blockedReason: user.blockedReason,
        createdAt: user.createdAt,
        lastSeenAt: user.lastSeenAt,
        stats: {
          ticketsCreated: user._count.ticketsCreated,
          ticketsAssigned: user._count.ticketsAssigned,
          commentsWritten: user._count.comments
        }
      }))
    };

    const filename = `users-export-${new Date().toISOString().split('T')[0]}.json`;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    return res.json(exportData);
  } catch (error) {
    console.error('Error exporting users:', error);
    return res.status(500).json({ error: 'Failed to export users' });
  }
});

export default router;
