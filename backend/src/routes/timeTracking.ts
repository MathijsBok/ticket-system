import { Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import { requireAuth, requireAgent, AuthRequest } from '../middleware/auth';

const router = Router();

// Start tracking time on a ticket
router.post('/start', requireAuth, requireAgent, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { ticketId, description } = req.body;

    if (!ticketId) {
      return res.status(400).json({ error: 'Ticket ID is required' });
    }

    // Check if ticket exists
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId }
    });

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    // Check if agent already has an active time entry for this ticket
    const activeEntry = await prisma.ticketTimeEntry.findFirst({
      where: {
        ticketId,
        agentId: userId,
        endedAt: null
      }
    });

    if (activeEntry) {
      return res.status(400).json({
        error: 'You already have an active time entry for this ticket',
        activeEntry
      });
    }

    // Create new time entry
    const timeEntry = await prisma.ticketTimeEntry.create({
      data: {
        ticketId,
        agentId: userId,
        description: description || null
      },
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
    });

    return res.status(201).json(timeEntry);
  } catch (error) {
    console.error('Error starting time tracking:', error);
    return res.status(500).json({ error: 'Failed to start time tracking' });
  }
});

// Stop tracking time on a ticket
router.post('/stop/:entryId', requireAuth, requireAgent, async (req: AuthRequest, res: Response) => {
  try {
    const { entryId } = req.params;
    const userId = req.userId!;

    const timeEntry = await prisma.ticketTimeEntry.findUnique({
      where: { id: entryId }
    });

    if (!timeEntry) {
      return res.status(404).json({ error: 'Time entry not found' });
    }

    if (timeEntry.agentId !== userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    if (timeEntry.endedAt) {
      return res.status(400).json({ error: 'Time entry already stopped' });
    }

    const endedAt = new Date();
    const duration = Math.floor((endedAt.getTime() - timeEntry.startedAt.getTime()) / 1000);

    const updatedEntry = await prisma.ticketTimeEntry.update({
      where: { id: entryId },
      data: {
        endedAt,
        duration
      },
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
    });

    return res.json(updatedEntry);
  } catch (error) {
    console.error('Error stopping time tracking:', error);
    return res.status(500).json({ error: 'Failed to stop time tracking' });
  }
});

// Get time entries for a ticket
router.get('/ticket/:ticketId', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { ticketId } = req.params;

    const timeEntries = await prisma.ticketTimeEntry.findMany({
      where: { ticketId },
      include: {
        agent: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true
          }
        }
      },
      orderBy: { startedAt: 'desc' }
    });

    // Calculate total time per agent
    const timeByAgent = timeEntries.reduce((acc: any, entry) => {
      const agentId = entry.agentId;
      if (!acc[agentId]) {
        acc[agentId] = {
          agent: entry.agent,
          totalDuration: 0,
          entries: []
        };
      }
      acc[agentId].totalDuration += entry.duration || 0;
      acc[agentId].entries.push(entry);
      return acc;
    }, {});

    return res.json({
      entries: timeEntries,
      byAgent: Object.values(timeByAgent)
    });
  } catch (error) {
    console.error('Error fetching time entries:', error);
    return res.status(500).json({ error: 'Failed to fetch time entries' });
  }
});

// Get active time entry for current agent on a specific ticket
router.get('/active/:ticketId', requireAuth, requireAgent, async (req: AuthRequest, res: Response) => {
  try {
    const { ticketId } = req.params;
    const userId = req.userId!;

    const activeEntry = await prisma.ticketTimeEntry.findFirst({
      where: {
        ticketId,
        agentId: userId,
        endedAt: null
      },
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
    });

    return res.json(activeEntry);
  } catch (error) {
    console.error('Error fetching active time entry:', error);
    return res.status(500).json({ error: 'Failed to fetch active time entry' });
  }
});

export default router;
