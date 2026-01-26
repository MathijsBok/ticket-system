import { Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import { requireAuth, requireAgent, requireAdmin, AuthRequest } from '../middleware/auth';

const router = Router();

// Start agent session (called on login)
router.post('/start', requireAuth, requireAgent, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { ipAddress, userAgent } = req.body;

    // Close any existing open sessions for this agent (handles cases where session wasn't properly closed)
    const existingOpenSessions = await prisma.agentSession.findMany({
      where: {
        agentId: userId,
        logoutAt: null
      }
    });

    // Close existing open sessions
    if (existingOpenSessions.length > 0) {
      const now = new Date();
      await Promise.all(
        existingOpenSessions.map(existingSession => {
          const duration = Math.floor((now.getTime() - existingSession.loginAt.getTime()) / 1000);
          return prisma.agentSession.update({
            where: { id: existingSession.id },
            data: {
              logoutAt: now,
              duration
            }
          });
        })
      );
    }

    // Create new session
    const session = await prisma.agentSession.create({
      data: {
        agentId: userId,
        ipAddress: ipAddress || null,
        userAgent: userAgent || null
      }
    });

    return res.status(201).json(session);
  } catch (error) {
    console.error('Error starting session:', error);
    return res.status(500).json({ error: 'Failed to start session' });
  }
});

// End agent session (called on logout)
router.post('/end/:sessionId', requireAuth, requireAgent, async (req: AuthRequest, res: Response) => {
  try {
    const { sessionId } = req.params;
    const userId = req.userId!;

    const session = await prisma.agentSession.findUnique({
      where: { id: sessionId }
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (session.agentId !== userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const logoutAt = new Date();
    const duration = Math.floor((logoutAt.getTime() - session.loginAt.getTime()) / 1000);

    const updatedSession = await prisma.agentSession.update({
      where: { id: sessionId },
      data: {
        logoutAt,
        duration
      }
    });

    return res.json(updatedSession);
  } catch (error) {
    console.error('Error ending session:', error);
    return res.status(500).json({ error: 'Failed to end session' });
  }
});

// Get current active session
router.get('/current', requireAuth, requireAgent, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;

    const session = await prisma.agentSession.findFirst({
      where: {
        agentId: userId,
        logoutAt: null
      },
      orderBy: { loginAt: 'desc' }
    });

    return res.json(session);
  } catch (error) {
    console.error('Error fetching current session:', error);
    return res.status(500).json({ error: 'Failed to fetch session' });
  }
});

// Clean up old sessions (admin only)
// Closes sessions that have been open for more than 24 hours
router.post('/cleanup-old', requireAuth, requireAdmin, async (_req: AuthRequest, res: Response) => {
  try {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Find sessions that are still open but were created more than 24 hours ago
    const oldSessions = await prisma.agentSession.findMany({
      where: {
        logoutAt: null,
        loginAt: {
          lt: twentyFourHoursAgo
        }
      }
    });

    if (oldSessions.length === 0) {
      return res.json({ message: 'No old sessions found', closed: 0 });
    }

    // Close old sessions
    const now = new Date();
    const updatedSessions = await Promise.all(
      oldSessions.map(session => {
        const duration = Math.floor((now.getTime() - session.loginAt.getTime()) / 1000);
        return prisma.agentSession.update({
          where: { id: session.id },
          data: {
            logoutAt: now,
            duration
          }
        });
      })
    );

    return res.json({
      message: `Closed ${updatedSessions.length} old session(s)`,
      closed: updatedSessions.length,
      sessions: updatedSessions
    });
  } catch (error) {
    console.error('Error cleaning up old sessions:', error);
    return res.status(500).json({ error: 'Failed to cleanup old sessions' });
  }
});

export default router;
