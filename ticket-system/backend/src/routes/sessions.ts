import { Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import { requireAuth, requireAgent, AuthRequest } from '../middleware/auth';

const router = Router();

// Start agent session (called on login)
router.post('/start', requireAuth, requireAgent, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { ipAddress, userAgent } = req.body;

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

export default router;
