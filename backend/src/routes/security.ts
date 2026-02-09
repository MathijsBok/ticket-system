import { Router, Response } from 'express';
import { body, validationResult } from 'express-validator';
import rateLimit from 'express-rate-limit';
import { clerkClient } from '@clerk/express';
import { prisma } from '../lib/prisma';
import { requireAuth, requireAdmin, AuthRequest } from '../middleware/auth';

const router = Router();

// Rate limiting for security endpoints to prevent abuse
const securityRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute
  message: { error: 'Too many requests, please try again later' }
});

const syncRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 syncs per minute (calls external Clerk API)
  message: { error: 'Too many sync requests, please try again later' }
});

router.use(securityRateLimit);

// Get current user's 2FA status and grace period
router.get('/status', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
        has2FAEnabled: true,
        has2FAEnrolledAt: true,
        twoFactorGracePeriodEnd: true,
        twoFactorLastSyncedAt: true
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const settings = await prisma.settings.findFirst();
    if (!settings) {
      return res.status(500).json({ error: 'Settings not found' });
    }

    // Calculate if 2FA is required for this user
    const is2FARequired =
      (user.role === 'ADMIN' && settings.require2FAForAdmins) ||
      (user.role === 'AGENT' && settings.require2FAForAgents);

    // Calculate grace period status
    let gracePeriodDaysRemaining = null;
    let gracePeriodExpired = false;

    if (user.twoFactorGracePeriodEnd) {
      const now = new Date();
      const gracePeriodEnd = new Date(user.twoFactorGracePeriodEnd);

      // Match middleware logic: expired when now >= gracePeriodEnd
      gracePeriodExpired = now >= gracePeriodEnd;

      if (!gracePeriodExpired) {
        const diffTime = gracePeriodEnd.getTime() - now.getTime();
        gracePeriodDaysRemaining = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
      } else {
        gracePeriodDaysRemaining = 0;
      }
    }

    return res.json({
      has2FAEnabled: user.has2FAEnabled,
      has2FAEnrolledAt: user.has2FAEnrolledAt,
      is2FARequired,
      enforcementEnabled: settings.twoFactorEnforcementEnabled,
      gracePeriodEnd: user.twoFactorGracePeriodEnd,
      gracePeriodDaysRemaining,
      gracePeriodExpired,
      lastSyncedAt: user.twoFactorLastSyncedAt
    });
  } catch (error) {
    console.error('Error fetching 2FA status:', error);
    return res.status(500).json({ error: 'Failed to fetch 2FA status' });
  }
});

// Force sync 2FA status from Clerk
router.post('/sync', syncRateLimit, requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, clerkId: true, has2FAEnabled: true, has2FAEnrolledAt: true }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Fetch 2FA status from Clerk
    const clerkUser = await clerkClient.users.getUser(user.clerkId);
    const has2FA = clerkUser.twoFactorEnabled || false;

    // Update database
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        has2FAEnabled: has2FA,
        has2FAEnrolledAt: has2FA && !user.has2FAEnabled ? new Date() : user.has2FAEnrolledAt,
        twoFactorLastSyncedAt: new Date()
      },
      select: {
        has2FAEnabled: true,
        has2FAEnrolledAt: true,
        twoFactorLastSyncedAt: true
      }
    });

    return res.json(updatedUser);
  } catch (error) {
    console.error('Error syncing 2FA status:', error);
    return res.status(500).json({ error: 'Failed to sync 2FA status' });
  }
});

// Get role-based 2FA requirements
router.get('/requirements', requireAuth, async (_req: AuthRequest, res: Response) => {
  try {
    const settings = await prisma.settings.findFirst({
      select: {
        require2FAForAgents: true,
        require2FAForAdmins: true,
        allow2FAForUsers: true,
        twoFactorGracePeriodDays: true,
        twoFactorEnforcementEnabled: true
      }
    });

    if (!settings) {
      return res.status(500).json({ error: 'Settings not found' });
    }

    return res.json(settings);
  } catch (error) {
    console.error('Error fetching 2FA requirements:', error);
    return res.status(500).json({ error: 'Failed to fetch 2FA requirements' });
  }
});

// Extend grace period for a specific user (admin only)
router.post(
  '/grace-period/extend/:userId',
  requireAuth,
  requireAdmin,
  [
    body('days').isInt({ min: 1, max: 90 }).withMessage('Days must be between 1 and 90')
  ],
  async (req: AuthRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { userId } = req.params;
      const { days } = req.body;

      const user = await prisma.user.findUnique({
        where: { id: userId }
      });

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Calculate new grace period end date
      const newGracePeriodEnd = new Date();
      newGracePeriodEnd.setDate(newGracePeriodEnd.getDate() + days);

      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
          twoFactorGracePeriodEnd: newGracePeriodEnd
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          twoFactorGracePeriodEnd: true
        }
      });

      return res.json(updatedUser);
    } catch (error) {
      console.error('Error extending grace period:', error);
      return res.status(500).json({ error: 'Failed to extend grace period' });
    }
  }
);

// Get 2FA adoption statistics (admin only)
router.get('/stats', requireAuth, requireAdmin, async (_req: AuthRequest, res: Response) => {
  try {
    const [adminsTotal, adminsWithout2FA, agentsTotal, agentsWithout2FA, usersTotal, usersWith2FA] = await Promise.all([
      prisma.user.count({ where: { role: 'ADMIN' } }),
      prisma.user.count({ where: { role: 'ADMIN', has2FAEnabled: false } }),
      prisma.user.count({ where: { role: 'AGENT' } }),
      prisma.user.count({ where: { role: 'AGENT', has2FAEnabled: false } }),
      prisma.user.count({ where: { role: 'USER' } }),
      prisma.user.count({ where: { role: 'USER', has2FAEnabled: true } })
    ]);

    return res.json({
      admins: {
        total: adminsTotal,
        with2FA: adminsTotal - adminsWithout2FA,
        without2FA: adminsWithout2FA,
        percentage: adminsTotal > 0 ? Math.round(((adminsTotal - adminsWithout2FA) / adminsTotal) * 100) : 0
      },
      agents: {
        total: agentsTotal,
        with2FA: agentsTotal - agentsWithout2FA,
        without2FA: agentsWithout2FA,
        percentage: agentsTotal > 0 ? Math.round(((agentsTotal - agentsWithout2FA) / agentsTotal) * 100) : 0
      },
      users: {
        total: usersTotal,
        with2FA: usersWith2FA,
        without2FA: usersTotal - usersWith2FA,
        percentage: usersTotal > 0 ? Math.round((usersWith2FA / usersTotal) * 100) : 0
      }
    });
  } catch (error) {
    console.error('Error fetching 2FA stats:', error);
    return res.status(500).json({ error: 'Failed to fetch 2FA statistics' });
  }
});

export default router;
