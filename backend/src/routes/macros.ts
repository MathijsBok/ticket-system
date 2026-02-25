import { Router, Response } from 'express';
import { body, validationResult } from 'express-validator';
import multer from 'multer';
import { prisma } from '../lib/prisma';
import { requireAuth, requireAgent, requireAgentPermission, AuthRequest } from '../middleware/auth';

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

const router = Router();

// Get all macros
// Agents and admins see all macros (both active and inactive)
router.get('/', requireAuth, requireAgent, requireAgentPermission('agentCanAccessMacros'), async (req: AuthRequest, res: Response) => {
  try {
    const category = req.query.category as string | undefined;

    const whereClause: any = {};

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

// Reorder macros (agents and admins) - MUST be before /:id routes
router.patch('/reorder', requireAuth, requireAgent, requireAgentPermission('agentCanAccessMacros'), async (req: AuthRequest, res: Response) => {
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

// Import macros from Zendesk JSON (agents and admins)
router.post('/import', requireAuth, requireAgent, requireAgentPermission('agentCanAccessMacros'), upload.single('file'), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const fileContent = req.file.buffer.toString('utf-8');
    let data: any;

    try {
      data = JSON.parse(fileContent);
    } catch (parseError) {
      return res.status(400).json({ error: 'Invalid JSON file' });
    }

    // Handle Zendesk macro export format
    const macros = data.macros || data;

    if (!Array.isArray(macros)) {
      return res.status(400).json({ error: 'Invalid format: expected an array of macros or object with macros property' });
    }

    let imported = 0;
    let skipped = 0;
    let updated = 0;
    const errors: string[] = [];

    // Get the current highest order
    const lastMacro = await prisma.macro.findFirst({
      orderBy: { order: 'desc' }
    });
    let nextOrder = lastMacro ? lastMacro.order + 1 : 0;

    for (const macro of macros) {
      try {
        // Extract name from title or raw_title (truncate to 255 chars for DB column limit)
        const rawName = macro.title || macro.raw_title || macro.name;
        if (!rawName) {
          errors.push(`Skipped macro without name`);
          skipped++;
          continue;
        }
        const name = rawName.substring(0, 255);

        // Extract content from actions (look for comment_value_html or comment_value)
        let content = '';
        if (macro.actions && Array.isArray(macro.actions)) {
          const commentAction = macro.actions.find((a: any) =>
            a.field === 'comment_value_html' || a.field === 'comment_value'
          );
          if (commentAction) {
            content = commentAction.value || '';
          }
        }
        // Fallback to direct content field
        if (!content && macro.content) {
          content = macro.content;
        }

        if (!content) {
          errors.push(`Skipped macro "${name}" - no content found`);
          skipped++;
          continue;
        }

        // Only use explicit category field (description is explanatory text, not a category)
        const rawCategory = macro.category || null;
        const category = rawCategory ? rawCategory.substring(0, 100) : null;
        const isActive = macro.active !== undefined ? macro.active : (macro.isActive !== undefined ? macro.isActive : true);
        const order = macro.position !== undefined ? macro.position : (macro.order !== undefined ? macro.order : nextOrder++);

        // Check if macro with same name already exists
        const existingMacro = await prisma.macro.findFirst({
          where: { name }
        });

        if (existingMacro) {
          // Update existing macro
          await prisma.macro.update({
            where: { id: existingMacro.id },
            data: {
              content,
              category,
              isActive,
              order
            }
          });
          updated++;
        } else {
          // Create new macro
          await prisma.macro.create({
            data: {
              name,
              content,
              category,
              isActive,
              order
            }
          });
          imported++;
        }
      } catch (macroError) {
        const errorMessage = macroError instanceof Error ? macroError.message : 'Unknown error';
        errors.push(`Error processing macro: ${errorMessage}`);
        skipped++;
      }
    }

    return res.json({
      success: true,
      imported,
      updated,
      skipped,
      total: macros.length,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    console.error('Error importing macros:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to import macros'
    });
  }
});

// Get single macro
router.get('/:id', requireAuth, requireAgent, requireAgentPermission('agentCanAccessMacros'), async (req: AuthRequest, res: Response) => {
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

// Create new macro (agents and admins)
router.post('/',
  requireAuth,
  requireAgent,
  requireAgentPermission('agentCanAccessMacros'),
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

// Update macro (agents and admins)
router.patch('/:id',
  requireAuth,
  requireAgent,
  requireAgentPermission('agentCanAccessMacros'),
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

// Delete macro (agents and admins)
router.delete('/:id', requireAuth, requireAgent, requireAgentPermission('agentCanAccessMacros'), async (req: AuthRequest, res: Response) => {
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
