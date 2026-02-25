import { Router, Response } from 'express';
import { body, validationResult } from 'express-validator';
import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import { requireAuth, requireAdmin, AuthRequest } from '../middleware/auth';

const router = Router();

// Generate a secure API key
const generateApiKey = (): { key: string; prefix: string } => {
  const key = `klv_${crypto.randomBytes(32).toString('hex')}`;
  const prefix = key.substring(0, 12); // "klv_" + first 8 chars
  return { key, prefix };
};

// Get all API keys (admin only)
router.get('/', requireAuth, requireAdmin, async (_req: AuthRequest, res: Response) => {
  try {
    const apiKeys = await prisma.apiKey.findMany({
      include: {
        form: {
          select: { id: true, name: true }
        },
        createdBy: {
          select: { id: true, email: true, firstName: true, lastName: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Don't return the full key, only the prefix
    const safeKeys = apiKeys.map(apiKey => ({
      ...apiKey,
      key: undefined, // Remove full key from response
      keyDisplay: `${apiKey.keyPrefix}...` // Show prefix only
    }));

    return res.json(safeKeys);
  } catch (error) {
    console.error('Error fetching API keys:', error);
    return res.status(500).json({ error: 'Failed to fetch API keys' });
  }
});

// Create new API key (admin only)
router.post('/',
  requireAuth,
  requireAdmin,
  [
    body('name').isString().notEmpty().isLength({ max: 255 }),
    body('description').optional().isString(),
    body('formId').optional().isUUID()
  ],
  async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { name, description, formId } = req.body;
      const userId = req.userId!;

      // Verify form exists if provided
      if (formId) {
        const form = await prisma.form.findUnique({ where: { id: formId } });
        if (!form) {
          return res.status(400).json({ error: 'Form not found' });
        }
      }

      const { key, prefix } = generateApiKey();

      const apiKey = await prisma.apiKey.create({
        data: {
          name,
          description: description || null,
          key,
          keyPrefix: prefix,
          formId: formId || null,
          createdById: userId
        },
        include: {
          form: {
            select: { id: true, name: true }
          },
          createdBy: {
            select: { id: true, email: true, firstName: true, lastName: true }
          }
        }
      });

      // Return the full key only on creation (this is the only time it's shown)
      return res.status(201).json({
        ...apiKey,
        keyDisplay: `${apiKey.keyPrefix}...`,
        // Full key is returned only on creation
        fullKey: key
      });
    } catch (error) {
      console.error('Error creating API key:', error);
      return res.status(500).json({ error: 'Failed to create API key' });
    }
  }
);

// Revoke API key (admin only)
router.patch('/:id/revoke', requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const apiKey = await prisma.apiKey.findUnique({ where: { id } });
    if (!apiKey) {
      return res.status(404).json({ error: 'API key not found' });
    }

    if (!apiKey.isActive) {
      return res.status(400).json({ error: 'API key is already revoked' });
    }

    const updated = await prisma.apiKey.update({
      where: { id },
      data: {
        isActive: false,
        revokedAt: new Date()
      }
    });

    return res.json({
      ...updated,
      key: undefined,
      keyDisplay: `${updated.keyPrefix}...`
    });
  } catch (error) {
    console.error('Error revoking API key:', error);
    return res.status(500).json({ error: 'Failed to revoke API key' });
  }
});

// Delete API key (admin only)
router.delete('/:id', requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const apiKey = await prisma.apiKey.findUnique({ where: { id } });
    if (!apiKey) {
      return res.status(404).json({ error: 'API key not found' });
    }

    await prisma.apiKey.delete({ where: { id } });

    return res.json({ success: true });
  } catch (error) {
    console.error('Error deleting API key:', error);
    return res.status(500).json({ error: 'Failed to delete API key' });
  }
});

// Get available forms for API key creation
router.get('/forms', requireAuth, requireAdmin, async (_req: AuthRequest, res: Response) => {
  try {
    const forms = await prisma.form.findMany({
      where: { isActive: true },
      select: { id: true, name: true, description: true },
      orderBy: { order: 'asc' }
    });

    return res.json(forms);
  } catch (error) {
    console.error('Error fetching forms:', error);
    return res.status(500).json({ error: 'Failed to fetch forms' });
  }
});

export default router;
