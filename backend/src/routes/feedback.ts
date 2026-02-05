import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { prisma } from '../lib/prisma';
import { requireAuth, requireAgent, AuthRequest } from '../middleware/auth';

const router = Router();

// Submit feedback (public endpoint - no auth required)
router.post('/',
  [
    body('token').isString().notEmpty().withMessage('Token is required'),
    body('rating').isIn(['VERY_DISSATISFIED', 'DISSATISFIED', 'NEUTRAL', 'SATISFIED', 'VERY_SATISFIED']).withMessage('Valid rating is required'),
    body('userComment').optional().isString()
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { token, rating, userComment } = req.body;

      // Find the feedback record by token
      const existingFeedback = await prisma.feedback.findUnique({
        where: { token }
      });

      if (!existingFeedback) {
        return res.status(404).json({ error: 'Invalid feedback token' });
      }

      // Check if feedback has already been submitted (has a rating)
      if (existingFeedback.rating) {
        return res.status(400).json({ error: 'Feedback has already been submitted for this ticket' });
      }

      // Update the feedback with the rating and optional comment
      await prisma.feedback.update({
        where: { token },
        data: {
          rating,
          userComment: userComment || null,
          submittedAt: new Date()
        }
      });

      return res.status(200).json({
        success: true,
        message: 'Thank you for your feedback!'
      });
    } catch (error) {
      console.error('Error submitting feedback:', error);
      return res.status(500).json({ error: 'Failed to submit feedback' });
    }
  }
);

// Get feedback by token (to verify token and show current state)
router.get('/verify/:token', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;

    const feedback = await prisma.feedback.findUnique({
      where: { token },
      include: {
        ticket: {
          select: {
            ticketNumber: true,
            subject: true
          }
        }
      }
    });

    if (!feedback) {
      return res.status(404).json({ error: 'Invalid feedback token' });
    }

    return res.json({
      ticketNumber: feedback.ticket.ticketNumber,
      ticketSubject: feedback.ticket.subject,
      hasSubmitted: !!feedback.rating,
      rating: feedback.rating
    });
  } catch (error) {
    console.error('Error verifying feedback token:', error);
    return res.status(500).json({ error: 'Failed to verify token' });
  }
});

// Get all feedback with analytics (agents and admins only)
router.get('/', requireAuth, requireAgent, async (req: AuthRequest, res: Response) => {
  try {
    const year = req.query.year ? parseInt(req.query.year as string) : undefined;

    // Build where clause
    const whereClause: any = {
      submittedAt: {
        not: null
      }
    };

    // Filter by year if provided
    if (year) {
      const startOfYear = new Date(year, 0, 1);
      const endOfYear = new Date(year + 1, 0, 1);
      whereClause.submittedAt = {
        gte: startOfYear,
        lt: endOfYear
      };
    }

    // Get all feedback (only those with ratings submitted)
    const allFeedback = await prisma.feedback.findMany({
      where: whereClause,
      include: {
        ticket: {
          select: {
            ticketNumber: true,
            subject: true,
            closedAt: true
          }
        }
      },
      orderBy: {
        submittedAt: 'desc'
      }
    });

    // Calculate satisfaction percentage
    const totalFeedback = allFeedback.length;
    const satisfiedCount = allFeedback.filter(f =>
      f.rating === 'SATISFIED' || f.rating === 'VERY_SATISFIED'
    ).length;
    const satisfactionPercentage = totalFeedback > 0
      ? Math.round((satisfiedCount / totalFeedback) * 100)
      : 0;

    // Count by rating
    const ratingCounts = {
      VERY_DISSATISFIED: allFeedback.filter(f => f.rating === 'VERY_DISSATISFIED').length,
      DISSATISFIED: allFeedback.filter(f => f.rating === 'DISSATISFIED').length,
      NEUTRAL: allFeedback.filter(f => f.rating === 'NEUTRAL').length,
      SATISFIED: allFeedback.filter(f => f.rating === 'SATISFIED').length,
      VERY_SATISFIED: allFeedback.filter(f => f.rating === 'VERY_SATISFIED').length
    };

    return res.json({
      feedback: allFeedback,
      analytics: {
        totalFeedback,
        satisfiedCount,
        satisfactionPercentage,
        ratingCounts
      }
    });
  } catch (error) {
    console.error('Error fetching feedback:', error);
    return res.status(500).json({ error: 'Failed to fetch feedback' });
  }
});

export default router;
