import { Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import { requireAuth, requireAdmin, AuthRequest } from '../middleware/auth';
import {
  getChatWidgetSettings,
  generateChatResponse,
  regenerateChatResponse,
  getOrCreateActiveSession,
  endChatSession,
  recordMessageFeedback
} from '../services/chatService';

const router = Router();

// Get chat widget settings (for frontend to check if widget should be shown)
router.get('/settings', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userRole = req.userRole || 'USER';
    const settings = await getChatWidgetSettings();

    // Check if widget should be visible for this user's role
    const isVisible =
      (userRole === 'USER' && settings.visibleToUsers) ||
      ((userRole === 'AGENT' || userRole === 'ADMIN') && settings.visibleToAgents);

    return res.json({
      enabled: settings.enabled && isVisible,
      welcomeMessage: settings.welcomeMessage,
      escalationThreshold: settings.escalationThreshold
    });
  } catch (error) {
    console.error('Error getting chat settings:', error);
    return res.status(500).json({ error: 'Failed to get chat settings' });
  }
});

// Send a message and get AI response
router.post('/', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { message, sessionId } = req.body;

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Check if chat is enabled
    const settings = await getChatWidgetSettings();
    if (!settings.enabled) {
      return res.status(403).json({ error: 'Chat widget is not enabled' });
    }

    // Get or create session
    let activeSessionId = sessionId;
    if (!activeSessionId) {
      activeSessionId = await getOrCreateActiveSession(userId);
    } else {
      // Verify session belongs to user
      const session = await prisma.chatSession.findFirst({
        where: {
          id: activeSessionId,
          userId
        }
      });
      if (!session) {
        activeSessionId = await getOrCreateActiveSession(userId);
      }
    }

    // Generate response
    const { response, messageId } = await generateChatResponse(
      activeSessionId,
      message.trim()
    );

    return res.json({
      sessionId: activeSessionId,
      response,
      messageId
    });
  } catch (error) {
    console.error('Error in chat:', error);
    return res.status(500).json({ error: 'Failed to process chat message' });
  }
});

// Get messages for a session
router.get('/sessions/:id/messages', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const userRole = req.userRole!;
    const sessionId = req.params.id;

    // Verify session access
    const session = await prisma.chatSession.findUnique({
      where: { id: sessionId }
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Only allow access to own sessions (unless admin)
    if (session.userId !== userId && userRole !== 'ADMIN') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const messages = await prisma.chatMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        role: true,
        content: true,
        wasHelpful: true,
        createdAt: true
      }
    });

    return res.json(messages);
  } catch (error) {
    console.error('Error getting session messages:', error);
    return res.status(500).json({ error: 'Failed to get messages' });
  }
});

// End a chat session
router.post('/sessions/:id/end', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const sessionId = req.params.id;
    const { resolved } = req.body;

    // Verify session belongs to user
    const session = await prisma.chatSession.findFirst({
      where: {
        id: sessionId,
        userId
      }
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    await endChatSession(sessionId, resolved === true);

    return res.json({ success: true });
  } catch (error) {
    console.error('Error ending session:', error);
    return res.status(500).json({ error: 'Failed to end session' });
  }
});

// Provide feedback on a message
router.post('/sessions/:id/feedback', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const sessionId = req.params.id;
    const { messageId, wasHelpful } = req.body;

    if (!messageId || typeof wasHelpful !== 'boolean') {
      return res.status(400).json({ error: 'messageId and wasHelpful are required' });
    }

    // Verify session belongs to user
    const session = await prisma.chatSession.findFirst({
      where: {
        id: sessionId,
        userId
      }
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Verify message belongs to session
    const message = await prisma.chatMessage.findFirst({
      where: {
        id: messageId,
        sessionId
      }
    });

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    await recordMessageFeedback(messageId, wasHelpful, userId);

    return res.json({ success: true });
  } catch (error) {
    console.error('Error recording feedback:', error);
    return res.status(500).json({ error: 'Failed to record feedback' });
  }
});

// Regenerate a response (when user marks as not helpful)
router.post('/sessions/:id/regenerate', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const sessionId = req.params.id;
    const { messageId } = req.body;

    if (!messageId) {
      return res.status(400).json({ error: 'messageId is required' });
    }

    // Verify session belongs to user
    const session = await prisma.chatSession.findFirst({
      where: {
        id: sessionId,
        userId
      }
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Verify message belongs to session and is an assistant message
    const message = await prisma.chatMessage.findFirst({
      where: {
        id: messageId,
        sessionId,
        role: 'ASSISTANT'
      }
    });

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    // Regenerate the response
    const { response, messageId: newMessageId } = await regenerateChatResponse(sessionId, messageId);

    return res.json({
      response,
      messageId: newMessageId
    });
  } catch (error) {
    console.error('Error regenerating response:', error);
    return res.status(500).json({ error: 'Failed to regenerate response' });
  }
});

// Admin: Get all chat sessions
router.get('/sessions', requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { status, page = '1', limit = '20' } = req.query;
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};
    if (status && ['ACTIVE', 'RESOLVED', 'CONVERTED_TO_TICKET'].includes(status as string)) {
      where.status = status;
    }

    const [sessions, total] = await Promise.all([
      prisma.chatSession.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { updatedAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true
            }
          },
          _count: {
            select: { messages: true }
          }
        }
      }),
      prisma.chatSession.count({ where })
    ]);

    return res.json({
      sessions: sessions.map(s => ({
        id: s.id,
        userId: s.userId,
        user: s.user,
        status: s.status,
        ticketId: s.ticketId,
        messageCount: s._count.messages,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt
      })),
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum)
    });
  } catch (error) {
    console.error('Error getting chat sessions:', error);
    return res.status(500).json({ error: 'Failed to get chat sessions' });
  }
});

// Admin: Get a specific chat session with all messages
router.get('/sessions/:id', requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const sessionId = req.params.id;

    const session = await prisma.chatSession.findUnique({
      where: { id: sessionId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true
          }
        },
        messages: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            role: true,
            content: true,
            wasHelpful: true,
            createdAt: true
          }
        },
        ticket: {
          select: {
            id: true,
            ticketNumber: true,
            subject: true
          }
        }
      }
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    return res.json(session);
  } catch (error) {
    console.error('Error getting chat session:', error);
    return res.status(500).json({ error: 'Failed to get chat session' });
  }
});

export default router;
