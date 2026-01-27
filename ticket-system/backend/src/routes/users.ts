import { Router, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { clerkClient } from '@clerk/express';
import { prisma } from '../lib/prisma';
import { requireAuth, requireAdmin, AuthRequest } from '../middleware/auth';

const router = Router();

// Get current user profile
router.get('/me', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        clerkId: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        createdAt: true
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json(user);
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return res.status(500).json({ error: 'Failed to fetch user profile' });
  }
});

// Get all agents (for assignment dropdown)
router.get('/agents', requireAuth, async (_req: AuthRequest, res: Response) => {
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
        role: true
      },
      orderBy: { email: 'asc' }
    });

    return res.json(agents);
  } catch (error) {
    console.error('Error fetching agents:', error);
    return res.status(500).json({ error: 'Failed to fetch agents' });
  }
});

// Get all users (admin only)
router.get('/', requireAuth, requireAdmin, async (_req: AuthRequest, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        clerkId: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        createdAt: true,
        _count: {
          select: {
            ticketsCreated: true
          }
        }
      },
      orderBy: [
        { role: 'asc' }, // ADMIN, AGENT, USER alphabetically
        { email: 'asc' }
      ]
    });

    // Sort by role priority: ADMIN first, then AGENT, then USER
    const roleOrder = { ADMIN: 0, AGENT: 1, USER: 2 };
    const sortedUsers = users.sort((a, b) => {
      const roleCompare = (roleOrder[a.role as keyof typeof roleOrder] || 2) - (roleOrder[b.role as keyof typeof roleOrder] || 2);
      if (roleCompare !== 0) return roleCompare;
      return a.email.localeCompare(b.email);
    });

    return res.json(sortedUsers);
  } catch (error) {
    console.error('Error fetching users:', error);
    return res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Update user details (admin only)
router.patch(
  '/:id',
  requireAuth,
  requireAdmin,
  [
    body('email').optional().isEmail().withMessage('Invalid email'),
    body('firstName').optional().isString(),
    body('lastName').optional().isString(),
    body('role').optional().isIn(['USER', 'AGENT', 'ADMIN']).withMessage('Invalid role')
  ],
  async (req: AuthRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      const { email, firstName, lastName, role } = req.body;

      // Find the user
      const user = await prisma.user.findUnique({
        where: { id },
        select: { id: true, clerkId: true, role: true, email: true }
      });

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Prevent admin from demoting themselves
      if (user.id === req.userId && role && role !== 'ADMIN') {
        return res.status(400).json({ error: 'You cannot change your own role' });
      }

      // Check if email is already taken by another user
      if (email && email !== user.email) {
        const existingUser = await prisma.user.findUnique({
          where: { email }
        });
        if (existingUser) {
          return res.status(400).json({ error: 'Email is already in use' });
        }
      }

      // Build update data
      const updateData: any = {};
      if (email !== undefined) updateData.email = email;
      if (firstName !== undefined) updateData.firstName = firstName;
      if (lastName !== undefined) updateData.lastName = lastName;
      if (role !== undefined) updateData.role = role;

      // Update user in database
      const updatedUser = await prisma.user.update({
        where: { id },
        data: updateData,
        select: {
          id: true,
          clerkId: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          createdAt: true,
          _count: {
            select: {
              ticketsCreated: true
            }
          }
        }
      });

      // Also update in Clerk
      try {
        const clerkUpdateData: any = {};
        if (firstName !== undefined) clerkUpdateData.firstName = firstName;
        if (lastName !== undefined) clerkUpdateData.lastName = lastName;
        if (role !== undefined) clerkUpdateData.publicMetadata = { role };

        if (Object.keys(clerkUpdateData).length > 0) {
          await clerkClient.users.updateUser(user.clerkId, clerkUpdateData);
        }
      } catch (clerkError) {
        console.error('Failed to update Clerk user:', clerkError);
        // Don't fail the request, the database is updated
      }

      return res.json(updatedUser);
    } catch (error) {
      console.error('Error updating user:', error);
      return res.status(500).json({ error: 'Failed to update user' });
    }
  }
);

// Update user role (admin only) - kept for backwards compatibility
router.patch(
  '/:id/role',
  requireAuth,
  requireAdmin,
  [body('role').isIn(['USER', 'AGENT', 'ADMIN']).withMessage('Invalid role')],
  async (req: AuthRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      const { role } = req.body;

      // Find the user
      const user = await prisma.user.findUnique({
        where: { id },
        select: { id: true, clerkId: true, role: true }
      });

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Prevent admin from demoting themselves
      if (user.id === req.userId && role !== 'ADMIN') {
        return res.status(400).json({ error: 'You cannot change your own role' });
      }

      // Update user role in database
      const updatedUser = await prisma.user.update({
        where: { id },
        data: { role },
        select: {
          id: true,
          clerkId: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          createdAt: true,
          _count: {
            select: {
              ticketsCreated: true
            }
          }
        }
      });

      // Also update role in Clerk metadata
      try {
        await clerkClient.users.updateUser(user.clerkId, {
          publicMetadata: { role }
        });
      } catch (clerkError) {
        console.error('Failed to update Clerk metadata:', clerkError);
        // Don't fail the request, the database is updated
      }

      return res.json(updatedUser);
    } catch (error) {
      console.error('Error updating user role:', error);
      return res.status(500).json({ error: 'Failed to update user role' });
    }
  }
);

export default router;
