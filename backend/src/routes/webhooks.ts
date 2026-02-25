import { Router, Request, Response } from 'express';
import { Webhook } from 'svix';
import { prisma } from '../lib/prisma';

const router = Router();

// Clerk webhook handler for user sync
router.post('/clerk', async (req: Request, res: Response) => {
  try {
    const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

    if (!WEBHOOK_SECRET) {
      return res.status(500).json({ error: 'Webhook secret not configured' });
    }

    // Verify webhook signature
    const wh = new Webhook(WEBHOOK_SECRET);
    const payload = wh.verify(JSON.stringify(req.body), {
      'svix-id': req.headers['svix-id'] as string,
      'svix-timestamp': req.headers['svix-timestamp'] as string,
      'svix-signature': req.headers['svix-signature'] as string,
    });

    const event = payload as any;

    switch (event.type) {
      case 'user.created': {
        // Create user in database
        const role = event.data.public_metadata?.role || 'USER';
        await prisma.user.create({
          data: {
            clerkId: event.data.id,
            email: event.data.email_addresses[0]?.email_address,
            firstName: event.data.first_name,
            lastName: event.data.last_name,
            role: role.toUpperCase()
          }
        });
        break;
      }

      case 'user.updated': {
        // Update user in database
        const updatedRole = event.data.public_metadata?.role || 'USER';
        const has2FA = event.data.two_factor_enabled || false;

        // Get existing user to check if this is first 2FA enrollment
        const existingUser = await prisma.user.findUnique({
          where: { clerkId: event.data.id },
          select: { has2FAEnabled: true, has2FAEnrolledAt: true }
        });

        await prisma.user.update({
          where: { clerkId: event.data.id },
          data: {
            email: event.data.email_addresses[0]?.email_address,
            firstName: event.data.first_name,
            lastName: event.data.last_name,
            role: updatedRole.toUpperCase(),
            has2FAEnabled: has2FA,
            has2FAEnrolledAt: has2FA && (!existingUser || !existingUser.has2FAEnabled)
              ? new Date()
              : existingUser?.has2FAEnrolledAt,
            twoFactorLastSyncedAt: new Date()
          }
        });
        break;
      }

      case 'user.deleted': {
        // Soft delete or handle user deletion
        await prisma.user.delete({
          where: { clerkId: event.data.id }
        });
        break;
      }
    }

    return res.json({ success: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return res.status(400).json({ error: 'Webhook verification failed' });
  }
});

export default router;
