import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAuth, requireAdmin } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

// Get settings (create default if doesn't exist)
router.get('/', requireAuth, requireAdmin, async (_req, res) => {
  try {
    let settings = await prisma.settings.findFirst();

    // If no settings exist, create default settings
    if (!settings) {
      settings = await prisma.settings.create({
        data: {}
      });
    }

    return res.json(settings);
  } catch (error) {
    console.error('Error fetching settings:', error);
    return res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// Update settings
router.patch('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Validate numeric fields
    if (updateData.pendingTicketReminderHours !== undefined && updateData.pendingTicketReminderHours < 1) {
      return res.status(400).json({ error: 'Pending ticket reminder hours must be at least 1' });
    }

    if (updateData.autoCloseHours !== undefined && updateData.autoCloseHours < 1) {
      return res.status(400).json({ error: 'Auto-close hours must be at least 1' });
    }

    if (updateData.autoSolveHours !== undefined && updateData.autoSolveHours < 1) {
      return res.status(400).json({ error: 'Auto-solve hours must be at least 1' });
    }

    const settings = await prisma.settings.update({
      where: { id },
      data: updateData
    });

    return res.json(settings);
  } catch (error) {
    console.error('Error updating settings:', error);
    return res.status(500).json({ error: 'Failed to update settings' });
  }
});

export default router;
