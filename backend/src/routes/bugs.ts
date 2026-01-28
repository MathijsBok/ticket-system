import { Router, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { prisma } from '../lib/prisma';
import { requireAuth, requireAgent, requireAdmin, AuthRequest } from '../middleware/auth';

const router = Router();

// Get all bugs (agents and admins)
router.get('/', requireAuth, requireAgent, async (_req: AuthRequest, res: Response) => {
  try {
    const bugs = await prisma.bug.findMany({
      include: {
        reportedBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true
          }
        },
        solvedBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true
          }
        }
      },
      orderBy: [
        { status: 'asc' }, // OPEN first
        { createdAt: 'desc' }
      ]
    });

    return res.json(bugs);
  } catch (error) {
    console.error('Error fetching bugs:', error);
    return res.status(500).json({ error: 'Failed to fetch bugs' });
  }
});

// Create a new bug (agents and admins)
router.post(
  '/',
  requireAuth,
  requireAgent,
  [
    body('title').trim().notEmpty().withMessage('Title is required'),
    body('description').trim().notEmpty().withMessage('Description is required')
  ],
  async (req: AuthRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { title, description } = req.body;
      const reportedById = req.userId!;

      // Create the bug
      const bug = await prisma.bug.create({
        data: {
          title,
          description,
          reportedById
        },
        include: {
          reportedBy: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              role: true
            }
          }
        }
      });

      // Get all agents and admins to notify them
      const agentsAndAdmins = await prisma.user.findMany({
        where: {
          role: { in: ['AGENT', 'ADMIN'] },
          id: { not: reportedById } // Don't notify the reporter
        },
        select: { id: true }
      });

      // Create notifications for all agents and admins
      if (agentsAndAdmins.length > 0) {
        await prisma.notification.createMany({
          data: agentsAndAdmins.map(user => ({
            userId: user.id,
            type: 'BUG_REPORTED',
            title: 'New Bug Reported',
            message: title // Only the bug title, not the description
          }))
        });
      }

      return res.status(201).json(bug);
    } catch (error) {
      console.error('Error creating bug:', error);
      return res.status(500).json({ error: 'Failed to create bug' });
    }
  }
);

// Mark bug as solved (admin only)
router.patch(
  '/:id/solve',
  requireAuth,
  requireAdmin,
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const solvedById = req.userId!;

      // Check if bug exists
      const existingBug = await prisma.bug.findUnique({
        where: { id }
      });

      if (!existingBug) {
        return res.status(404).json({ error: 'Bug not found' });
      }

      if (existingBug.status === 'SOLVED') {
        return res.status(400).json({ error: 'Bug is already solved' });
      }

      // Update the bug
      const bug = await prisma.bug.update({
        where: { id },
        data: {
          status: 'SOLVED',
          solvedById,
          solvedAt: new Date()
        },
        include: {
          reportedBy: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              role: true
            }
          },
          solvedBy: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              role: true
            }
          }
        }
      });

      return res.json(bug);
    } catch (error) {
      console.error('Error solving bug:', error);
      return res.status(500).json({ error: 'Failed to solve bug' });
    }
  }
);

// Reopen bug (admin only)
router.patch(
  '/:id/reopen',
  requireAuth,
  requireAdmin,
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;

      // Check if bug exists
      const existingBug = await prisma.bug.findUnique({
        where: { id }
      });

      if (!existingBug) {
        return res.status(404).json({ error: 'Bug not found' });
      }

      if (existingBug.status === 'OPEN') {
        return res.status(400).json({ error: 'Bug is already open' });
      }

      // Update the bug
      const bug = await prisma.bug.update({
        where: { id },
        data: {
          status: 'OPEN',
          solvedById: null,
          solvedAt: null
        },
        include: {
          reportedBy: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              role: true
            }
          },
          solvedBy: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              role: true
            }
          }
        }
      });

      return res.json(bug);
    } catch (error) {
      console.error('Error reopening bug:', error);
      return res.status(500).json({ error: 'Failed to reopen bug' });
    }
  }
);

// Delete bug (admin only)
router.delete(
  '/:id',
  requireAuth,
  requireAdmin,
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;

      // Check if bug exists
      const existingBug = await prisma.bug.findUnique({
        where: { id }
      });

      if (!existingBug) {
        return res.status(404).json({ error: 'Bug not found' });
      }

      // Delete the bug
      await prisma.bug.delete({
        where: { id }
      });

      return res.json({ message: 'Bug deleted successfully' });
    } catch (error) {
      console.error('Error deleting bug:', error);
      return res.status(500).json({ error: 'Failed to delete bug' });
    }
  }
);

export default router;
