import { Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import { requireAuth, requireAgent, requireAdmin, AuthRequest } from '../middleware/auth';

const router = Router();

// Valid event types
const VALID_EVENT_TYPES = [
  'SUMMARY_GENERATED',
  'SUMMARY_REGENERATED',
  'SUGGESTION_SHOWN',
  'SUGGESTION_HELPFUL',
  'SUGGESTION_NOT_HELPFUL',
  'CHAT_RESPONSE_GENERATED',
  'CHAT_FEEDBACK_HELPFUL',
  'CHAT_FEEDBACK_NOT_HELPFUL'
];

// Record an AI analytics event (for agents - summary events)
router.post('/event', requireAuth, requireAgent, async (req: AuthRequest, res: Response) => {
  try {
    const { ticketId, eventType, formId } = req.body;
    const userId = req.userId!;

    if (!eventType) {
      return res.status(400).json({ error: 'eventType is required' });
    }

    if (!VALID_EVENT_TYPES.includes(eventType)) {
      return res.status(400).json({ error: 'Invalid eventType' });
    }

    const event = await prisma.aiAnalyticsEvent.create({
      data: {
        ticketId: ticketId || null,
        userId,
        eventType,
        formId: formId || null
      }
    });

    return res.json(event);
  } catch (error) {
    console.error('Error recording AI analytics event:', error);
    return res.status(500).json({ error: 'Failed to record AI analytics event' });
  }
});

// Record suggestion feedback (for regular users on create ticket page)
router.post('/suggestion-feedback', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { eventType, formId } = req.body;
    const userId = req.userId!;

    if (!eventType) {
      return res.status(400).json({ error: 'eventType is required' });
    }

    // Only allow suggestion-related events from this endpoint
    const allowedTypes = ['SUGGESTION_SHOWN', 'SUGGESTION_HELPFUL', 'SUGGESTION_NOT_HELPFUL'];
    if (!allowedTypes.includes(eventType)) {
      return res.status(400).json({ error: 'Invalid eventType for suggestion feedback' });
    }

    const event = await prisma.aiAnalyticsEvent.create({
      data: {
        ticketId: null, // No ticket yet for suggestions
        userId,
        eventType,
        formId: formId || null
      }
    });

    return res.json(event);
  } catch (error) {
    console.error('Error recording suggestion feedback:', error);
    return res.status(500).json({ error: 'Failed to record suggestion feedback' });
  }
});

// Get AI analytics stats
router.get('/stats', requireAuth, requireAgent, async (req: AuthRequest, res: Response) => {
  try {
    const year = parseInt(req.query.year as string) || new Date().getFullYear();
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year + 1, 0, 1);

    // Get available years
    const availableYears = await prisma.$queryRaw<Array<{ year: number }>>`
      SELECT DISTINCT EXTRACT(YEAR FROM "createdAt")::integer as year
      FROM "AiAnalyticsEvent"
      ORDER BY year DESC
    `;

    // Get counts by event type for the selected year
    const eventCounts = await prisma.aiAnalyticsEvent.groupBy({
      by: ['eventType'],
      _count: true,
      where: {
        createdAt: {
          gte: startDate,
          lt: endDate
        }
      }
    });

    // Convert to a more usable format
    const counts = {
      // Summary events
      summaryGenerated: 0,
      summaryRegenerated: 0,
      // Suggestion events
      suggestionShown: 0,
      suggestionHelpful: 0,
      suggestionNotHelpful: 0,
      // Chat widget events
      chatResponseGenerated: 0,
      chatFeedbackHelpful: 0,
      chatFeedbackNotHelpful: 0
    };

    eventCounts.forEach(item => {
      switch (item.eventType) {
        case 'SUMMARY_GENERATED':
          counts.summaryGenerated = item._count;
          break;
        case 'SUMMARY_REGENERATED':
          counts.summaryRegenerated = item._count;
          break;
        case 'SUGGESTION_SHOWN':
          counts.suggestionShown = item._count;
          break;
        case 'SUGGESTION_HELPFUL':
          counts.suggestionHelpful = item._count;
          break;
        case 'SUGGESTION_NOT_HELPFUL':
          counts.suggestionNotHelpful = item._count;
          break;
        case 'CHAT_RESPONSE_GENERATED':
          counts.chatResponseGenerated = item._count;
          break;
        case 'CHAT_FEEDBACK_HELPFUL':
          counts.chatFeedbackHelpful = item._count;
          break;
        case 'CHAT_FEEDBACK_NOT_HELPFUL':
          counts.chatFeedbackNotHelpful = item._count;
          break;
      }
    });

    // Calculate totals
    const totalSummaryGenerations = counts.summaryGenerated + counts.summaryRegenerated;
    const totalSuggestionFeedback = counts.suggestionHelpful + counts.suggestionNotHelpful;
    const suggestionHelpfulRate = totalSuggestionFeedback > 0
      ? Math.round((counts.suggestionHelpful / totalSuggestionFeedback) * 100)
      : 0;
    const totalChatFeedback = counts.chatFeedbackHelpful + counts.chatFeedbackNotHelpful;
    const chatHelpfulRate = totalChatFeedback > 0
      ? Math.round((counts.chatFeedbackHelpful / totalChatFeedback) * 100)
      : 0;

    // Get monthly breakdown for chart
    const monthlyData = await prisma.$queryRaw<Array<{ month: number; event_type: string; count: bigint }>>`
      SELECT
        EXTRACT(MONTH FROM "createdAt")::integer as month,
        "eventType" as event_type,
        COUNT(*)::bigint as count
      FROM "AiAnalyticsEvent"
      WHERE "createdAt" >= ${startDate} AND "createdAt" < ${endDate}
      GROUP BY month, "eventType"
      ORDER BY month
    `;

    // Format monthly data for chart
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthlyChart = months.map((name, index) => {
      const monthNum = index + 1;
      const monthEvents = monthlyData.filter(m => m.month === monthNum);

      let summaryGenerated = 0;
      let summaryRegenerated = 0;
      let suggestionShown = 0;
      let suggestionHelpful = 0;
      let suggestionNotHelpful = 0;
      let chatResponseGenerated = 0;
      let chatFeedbackHelpful = 0;
      let chatFeedbackNotHelpful = 0;

      monthEvents.forEach(e => {
        const count = Number(e.count);
        switch (e.event_type) {
          case 'SUMMARY_GENERATED':
            summaryGenerated = count;
            break;
          case 'SUMMARY_REGENERATED':
            summaryRegenerated = count;
            break;
          case 'SUGGESTION_SHOWN':
            suggestionShown = count;
            break;
          case 'SUGGESTION_HELPFUL':
            suggestionHelpful = count;
            break;
          case 'SUGGESTION_NOT_HELPFUL':
            suggestionNotHelpful = count;
            break;
          case 'CHAT_RESPONSE_GENERATED':
            chatResponseGenerated = count;
            break;
          case 'CHAT_FEEDBACK_HELPFUL':
            chatFeedbackHelpful = count;
            break;
          case 'CHAT_FEEDBACK_NOT_HELPFUL':
            chatFeedbackNotHelpful = count;
            break;
        }
      });

      return {
        name,
        summaryGenerated,
        summaryRegenerated,
        suggestionShown,
        suggestionHelpful,
        suggestionNotHelpful,
        chatResponseGenerated,
        chatFeedbackHelpful,
        chatFeedbackNotHelpful
      };
    });

    return res.json({
      year,
      availableYears: availableYears.length > 0 ? availableYears.map(y => y.year) : [new Date().getFullYear()],
      counts,
      totalSummaryGenerations,
      totalSuggestionFeedback,
      suggestionHelpfulRate,
      totalChatFeedback,
      chatHelpfulRate,
      monthlyChart
    });
  } catch (error) {
    console.error('Error fetching AI analytics:', error);
    return res.status(500).json({ error: 'Failed to fetch AI analytics' });
  }
});

// Backfill AI Summary analytics from existing tickets
router.post('/backfill-summaries', requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    // Find all tickets that have an AI summary but might not have an analytics event
    const ticketsWithSummary = await prisma.ticket.findMany({
      where: {
        aiSummary: { not: null },
        aiSummaryGeneratedAt: { not: null }
      },
      select: {
        id: true,
        aiSummaryGeneratedAt: true,
        assigneeId: true,
        formId: true
      }
    });

    // Get existing events to avoid duplicates
    const existingEvents = await prisma.aiAnalyticsEvent.findMany({
      where: {
        eventType: 'SUMMARY_GENERATED',
        ticketId: { in: ticketsWithSummary.map(t => t.id) }
      },
      select: {
        ticketId: true
      }
    });

    const existingTicketIds = new Set(existingEvents.map(e => e.ticketId));

    // Filter out tickets that already have events
    const ticketsToBackfill = ticketsWithSummary.filter(t => !existingTicketIds.has(t.id));

    if (ticketsToBackfill.length === 0) {
      return res.json({
        message: 'No tickets to backfill. All tickets with AI summaries already have analytics events.',
        created: 0,
        skipped: ticketsWithSummary.length
      });
    }

    // Get a default agent/admin to attribute the events to (the current user making the request)
    const defaultUserId = req.userId!;

    // Create events for each ticket
    const eventsToCreate = ticketsToBackfill.map(ticket => ({
      ticketId: ticket.id,
      userId: ticket.assigneeId || defaultUserId, // Use assignee if available, otherwise current user
      eventType: 'SUMMARY_GENERATED' as const,
      formId: ticket.formId,
      createdAt: ticket.aiSummaryGeneratedAt! // Use the summary generation timestamp
    }));

    // Batch create events
    const result = await prisma.aiAnalyticsEvent.createMany({
      data: eventsToCreate
    });

    return res.json({
      message: `Successfully backfilled ${result.count} AI summary analytics events.`,
      created: result.count,
      skipped: existingTicketIds.size,
      totalTicketsWithSummary: ticketsWithSummary.length
    });
  } catch (error) {
    console.error('Error backfilling AI summary analytics:', error);
    return res.status(500).json({ error: 'Failed to backfill AI summary analytics' });
  }
});

export default router;
