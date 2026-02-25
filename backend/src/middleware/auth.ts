import { Request, Response, NextFunction } from 'express';
import { getAuth, clerkClient } from '@clerk/express';
import { prisma } from '../lib/prisma';

export interface AuthRequest extends Request {
  userId?: string;
  userRole?: string;
}

export const requireAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { userId } = getAuth(req);

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get user from database with role
    let user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { id: true, role: true }
    });

    // Auto-create user if they don't exist (for local development without webhooks)
    if (!user) {
      try {
        const clerkUser = await clerkClient.users.getUser(userId);
        const email = clerkUser.emailAddresses[0]?.emailAddress || '';
        const roleFromMetadata = (clerkUser.publicMetadata?.role as string) || 'USER';
        const role = roleFromMetadata.toUpperCase() as 'USER' | 'AGENT' | 'ADMIN';

        // Use upsert to handle case where email exists but clerkId is different
        user = await prisma.user.upsert({
          where: { email },
          update: {
            clerkId: userId,
            firstName: clerkUser.firstName || null,
            lastName: clerkUser.lastName || null
          },
          create: {
            clerkId: userId,
            email,
            firstName: clerkUser.firstName || null,
            lastName: clerkUser.lastName || null,
            role
          },
          select: { id: true, role: true }
        });

        console.log(`Auto-created/updated user: ${user.id} with role ${user.role}`);
      } catch (createError) {
        console.error('Error auto-creating user:', createError);
        return res.status(401).json({ error: 'User not found and could not be created' });
      }
    }

    req.userId = user.id;
    req.userRole = user.role;
    return next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(401).json({ error: 'Authentication failed' });
  }
};

export const requireRole = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.userRole || !roles.includes(req.userRole)) {
      return res.status(403).json({ error: 'Forbidden: Insufficient permissions' });
    }
    return next();
  };
};

// Middleware to enforce two-factor authentication based on role
export const requireTwoFactor = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId;
    const userRole = req.userRole;

    console.log('[2FA Middleware] Checking 2FA - userId:', userId, 'role:', userRole);

    if (!userId || !userRole) {
      // This should not happen if requireAuth was called first
      console.log('[2FA Middleware] No userId or userRole, skipping check');
      return next();
    }

    // Get settings to check if enforcement is enabled
    const settings = await prisma.settings.findFirst();
    console.log('[2FA Middleware] Settings - enforcement:', settings?.twoFactorEnforcementEnabled,
                'requireForAdmins:', settings?.require2FAForAdmins,
                'requireForAgents:', settings?.require2FAForAgents);

    if (!settings || !settings.twoFactorEnforcementEnabled) {
      // Enforcement is globally disabled
      console.log('[2FA Middleware] Enforcement disabled globally, allowing access');
      return next();
    }

    // Check if 2FA is required for this role
    const is2FARequired =
      (userRole === 'ADMIN' && settings.require2FAForAdmins) ||
      (userRole === 'AGENT' && settings.require2FAForAgents);

    console.log('[2FA Middleware] 2FA required for', userRole, ':', is2FARequired);

    if (!is2FARequired) {
      // 2FA not required for this role
      console.log('[2FA Middleware] 2FA not required for this role, allowing access');
      return next();
    }

    // Get user's 2FA status
    let user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        clerkId: true,
        has2FAEnabled: true,
        has2FAEnrolledAt: true,
        twoFactorGracePeriodEnd: true,
        twoFactorLastSyncedAt: true
      }
    });

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    // Check if cache is stale (older than 1 hour) and sync from Clerk
    const ONE_HOUR = 60 * 60 * 1000;
    const isCacheStale = !user.twoFactorLastSyncedAt ||
      (new Date().getTime() - new Date(user.twoFactorLastSyncedAt).getTime()) > ONE_HOUR;

    console.log('[2FA Middleware] Cache check - stale:', isCacheStale, 'lastSynced:', user.twoFactorLastSyncedAt);

    if (isCacheStale) {
      console.log('[2FA Middleware] Syncing 2FA status from Clerk...');
      try {
        const clerkUser = await clerkClient.users.getUser(user.clerkId);
        const has2FA = clerkUser.twoFactorEnabled || false;
        console.log('[2FA Middleware] Clerk reports 2FA enabled:', has2FA);

        // Update database with fresh data
        user = await prisma.user.update({
          where: { id: userId },
          data: {
            has2FAEnabled: has2FA,
            has2FAEnrolledAt: has2FA && !user.has2FAEnabled ? new Date() : user.has2FAEnrolledAt,
            twoFactorLastSyncedAt: new Date()
          },
          select: {
            clerkId: true,
            has2FAEnabled: true,
            has2FAEnrolledAt: true,
            twoFactorGracePeriodEnd: true,
            twoFactorLastSyncedAt: true
          }
        });
      } catch (clerkError: any) {
        // Fail open only for transient errors (network/timeout)
        const isTransient = clerkError?.code === 'ECONNREFUSED' ||
          clerkError?.code === 'ETIMEDOUT' ||
          clerkError?.code === 'ENOTFOUND' ||
          clerkError?.status === 503 ||
          clerkError?.status === 429;

        if (isTransient) {
          console.warn('[2FA Middleware] Transient Clerk API error, allowing access:', clerkError.message);
          return next();
        }

        console.error('[2FA Middleware] Unexpected Clerk API error, blocking access:', clerkError);
        return res.status(500).json({ error: 'Authentication service unavailable' });
      }
    }

    console.log('[2FA Middleware] User 2FA status:', {
      has2FA: user.has2FAEnabled,
      enrolledAt: user.has2FAEnrolledAt,
      gracePeriodEnd: user.twoFactorGracePeriodEnd,
      lastSynced: user.twoFactorLastSyncedAt
    });

    // If user has 2FA enabled, allow access
    if (user.has2FAEnabled) {
      console.log('[2FA Middleware] User has 2FA enabled, allowing access');
      return next();
    }

    // User doesn't have 2FA enabled - check grace period
    if (!user.twoFactorGracePeriodEnd) {
      // Grace period hasn't started yet - set it now
      const gracePeriodEnd = new Date();
      gracePeriodEnd.setDate(gracePeriodEnd.getDate() + settings.twoFactorGracePeriodDays);

      console.log('[2FA Middleware] Starting grace period until:', gracePeriodEnd.toISOString());

      await prisma.user.update({
        where: { id: userId },
        data: { twoFactorGracePeriodEnd: gracePeriodEnd }
      });

      // Allow access (within grace period)
      console.log('[2FA Middleware] Grace period started, allowing access');
      return next();
    }

    // Check if grace period has expired
    const now = new Date();
    const gracePeriodEnd = new Date(user.twoFactorGracePeriodEnd);
    const daysRemaining = Math.ceil((gracePeriodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    console.log('[2FA Middleware] Grace period check - now:', now.toISOString(),
                'ends:', gracePeriodEnd.toISOString(), 'days remaining:', daysRemaining);

    if (now < gracePeriodEnd) {
      // Still within grace period - allow access
      console.log('[2FA Middleware] Within grace period, allowing access');
      return next();
    }

    // Grace period expired and no 2FA - block access
    console.warn('[2FA Middleware] BLOCKING ACCESS - Grace period expired, no 2FA enabled');
    return res.status(403).json({
      error: 'Two-factor authentication is required',
      code: 'TWO_FACTOR_REQUIRED',
      gracePeriodEnd: user.twoFactorGracePeriodEnd
    });
  } catch (error) {
    console.error('[2FA Middleware] Unexpected error, blocking access:', error);
    return res.status(500).json({ error: 'Authentication service unavailable' });
  }
};

// Middleware to check agent-specific permission flags from settings.
// Admins always pass through. Agents are checked against the settings flag.
export const requireAgentPermission = (permissionKey: string) => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    // Admins bypass agent permission checks
    if (req.userRole === 'ADMIN') {
      return next();
    }

    try {
      const settings = await prisma.settings.findFirst();
      const allowed = settings ? (settings as any)[permissionKey] : true;

      // Default to true if setting doesn't exist (fail open for backwards compatibility)
      if (allowed === false) {
        return res.status(403).json({ error: 'Forbidden: You do not have access to this feature' });
      }

      return next();
    } catch (error) {
      console.error('Error checking agent permission:', error);
      // Fail open to prevent lockouts
      return next();
    }
  };
};

// Note: requireAgent and requireAdmin now include 2FA enforcement
// Express will flatten these arrays when used in routes
export const requireAgent = [requireAuth, requireTwoFactor, requireRole('AGENT', 'ADMIN')];
export const requireAdmin = [requireAuth, requireTwoFactor, requireRole('ADMIN')];
