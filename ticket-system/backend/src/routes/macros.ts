import { Router, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { prisma } from '../lib/prisma';
import { requireAuth, requireAdmin, requireAgent, AuthRequest } from '../middleware/auth';

const router = Router();

// Get all macros
// Agents see only active macros, admins see all
router.get('/', requireAuth, requireAgent, async (req: AuthRequest, res: Response) => {
  try {
    const userRole = req.userRole;
    const category = req.query.category as string | undefined;

    const whereClause: any = {};

    // Only admins see inactive macros
    if (userRole !== 'ADMIN') {
      whereClause.isActive = true;
    }

    // Filter by category if provided
    if (category) {
      whereClause.category = category;
    }

    const macros = await prisma.macro.findMany({
      where: whereClause,
      orderBy: { order: 'asc' }
    });

    return res.json(macros);
  } catch (error) {
    console.error('Error fetching macros:', error);
    return res.status(500).json({ error: 'Failed to fetch macros' });
  }
});

// Reorder macros (admin only) - MUST be before /:id routes
router.patch('/reorder', requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { macroIds } = req.body;

    if (!Array.isArray(macroIds)) {
      return res.status(400).json({ error: 'macroIds must be an array' });
    }

    // Update order for each macro
    await prisma.$transaction(
      macroIds.map((id: string, index: number) =>
        prisma.macro.update({
          where: { id },
          data: { order: index }
        })
      )
    );

    return res.json({ message: 'Macros reordered successfully' });
  } catch (error) {
    console.error('Error reordering macros:', error);
    return res.status(500).json({ error: 'Failed to reorder macros' });
  }
});

// Get single macro
router.get('/:id', requireAuth, requireAgent, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const macro = await prisma.macro.findUnique({
      where: { id }
    });

    if (!macro) {
      return res.status(404).json({ error: 'Macro not found' });
    }

    return res.json(macro);
  } catch (error) {
    console.error('Error fetching macro:', error);
    return res.status(500).json({ error: 'Failed to fetch macro' });
  }
});

// Create new macro (admin only)
router.post('/',
  requireAuth,
  requireAdmin,
  [
    body('name').isString().notEmpty().withMessage('Name is required'),
    body('content').isString().notEmpty().withMessage('Content is required'),
    body('category').optional().isString()
  ],
  async (req: AuthRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { name, content, category } = req.body;

      // Get highest order value to add new macro at the end
      const lastMacro = await prisma.macro.findFirst({
        orderBy: { order: 'desc' }
      });
      const newOrder = lastMacro ? lastMacro.order + 1 : 0;

      const macro = await prisma.macro.create({
        data: {
          name,
          content,
          category: category || null,
          order: newOrder
        }
      });

      return res.status(201).json(macro);
    } catch (error) {
      console.error('Error creating macro:', error);
      return res.status(500).json({ error: 'Failed to create macro' });
    }
  }
);

// Update macro (admin only)
router.patch('/:id',
  requireAuth,
  requireAdmin,
  [
    body('name').optional().isString().notEmpty(),
    body('content').optional().isString().notEmpty(),
    body('category').optional().isString(),
    body('isActive').optional().isBoolean()
  ],
  async (req: AuthRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      const { name, content, category, isActive } = req.body;

      // Check if macro exists
      const existingMacro = await prisma.macro.findUnique({
        where: { id }
      });

      if (!existingMacro) {
        return res.status(404).json({ error: 'Macro not found' });
      }

      const updateData: any = {};
      if (name !== undefined) updateData.name = name;
      if (content !== undefined) updateData.content = content;
      if (category !== undefined) updateData.category = category || null;
      if (isActive !== undefined) updateData.isActive = isActive;

      const macro = await prisma.macro.update({
        where: { id },
        data: updateData
      });

      return res.json(macro);
    } catch (error) {
      console.error('Error updating macro:', error);
      return res.status(500).json({ error: 'Failed to update macro' });
    }
  }
);

// Delete macro (admin only)
router.delete('/:id', requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Check if macro exists
    const existingMacro = await prisma.macro.findUnique({
      where: { id }
    });

    if (!existingMacro) {
      return res.status(404).json({ error: 'Macro not found' });
    }

    await prisma.macro.delete({
      where: { id }
    });

    return res.json({ message: 'Macro deleted successfully' });
  } catch (error) {
    console.error('Error deleting macro:', error);
    return res.status(500).json({ error: 'Failed to delete macro' });
  }
});

export default router;
