import { Router, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { prisma } from '../lib/prisma';
import { requireAuth, requireAgent, requireAgentPermission, AuthRequest } from '../middleware/auth';

const router = Router();

/**
 * GET /api/fields
 * Get all field library entries
 * Accessible to authenticated users (for form builders)
 */
router.get('/', requireAuth, async (_req: AuthRequest, res: Response) => {
  try {
    const fields = await prisma.formFieldLibrary.findMany({
      orderBy: [
        { label: 'asc' }
      ],
      include: {
        _count: {
          select: {
            formFields: true,
            formResponses: true
          }
        }
      }
    });

    return res.json(fields);
  } catch (error) {
    console.error('Error fetching field library:', error);
    return res.status(500).json({ error: 'Failed to fetch field library' });
  }
});

/**
 * GET /api/fields/:id
 * Get a single field library entry by ID
 */
router.get('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const field = await prisma.formFieldLibrary.findUnique({
      where: { id },
      include: {
        formFields: {
          include: {
            form: {
              select: {
                id: true,
                name: true
              }
            }
          }
        },
        _count: {
          select: {
            formResponses: true
          }
        }
      }
    });

    if (!field) {
      return res.status(404).json({ error: 'Field not found' });
    }

    return res.json(field);
  } catch (error) {
    console.error('Error fetching field:', error);
    return res.status(500).json({ error: 'Failed to fetch field' });
  }
});

/**
 * POST /api/fields
 * Create a new field library entry
 * Admin only
 */
router.post('/',
  requireAuth,
  requireAgent,
  requireAgentPermission('agentCanAccessFieldLibrary'),
  [
    body('label').isString().trim().notEmpty().withMessage('Label is required'),
    body('fieldType').isIn(['text', 'textarea', 'select', 'checkbox', 'radio'])
      .withMessage('Invalid field type'),
    body('required').optional().isBoolean(),
    body('options').optional().isArray(),
    body('placeholder').optional().isString(),
    body('defaultValue').optional().isString()
  ],
  async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { label, fieldType, required, options, placeholder, defaultValue } = req.body;

      // Validate that select, radio, and checkbox fields have options
      if (['select', 'radio', 'checkbox'].includes(fieldType)) {
        if (!options || !Array.isArray(options) || options.length === 0) {
          return res.status(400).json({
            error: `Field type '${fieldType}' requires at least one option`
          });
        }
      }

      const field = await prisma.formFieldLibrary.create({
        data: {
          label,
          fieldType,
          required: required || false,
          options: options || null,
          placeholder: placeholder || null,
          defaultValue: defaultValue || null
        }
      });

      return res.status(201).json(field);
    } catch (error) {
      console.error('Error creating field:', error);
      return res.status(500).json({ error: 'Failed to create field' });
    }
  }
);

/**
 * PATCH /api/fields/:id
 * Update a field library entry
 * Admin only
 */
router.patch('/:id',
  requireAuth,
  requireAgent,
  requireAgentPermission('agentCanAccessFieldLibrary'),
  [
    body('label').optional().isString().trim().notEmpty(),
    body('fieldType').optional().isIn(['text', 'textarea', 'select', 'checkbox', 'radio']),
    body('required').optional().isBoolean(),
    body('options').optional().isArray(),
    body('placeholder').optional().isString(),
    body('defaultValue').optional().isString()
  ],
  async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { id } = req.params;
      const { label, fieldType, required, options, placeholder, defaultValue } = req.body;

      // Check if field exists
      const existingField = await prisma.formFieldLibrary.findUnique({
        where: { id }
      });

      if (!existingField) {
        return res.status(404).json({ error: 'Field not found' });
      }

      // Get the final fieldType (either updated or existing)
      const finalFieldType = fieldType || existingField.fieldType;

      // Validate options for select/radio/checkbox
      if (['select', 'radio', 'checkbox'].includes(finalFieldType)) {
        const finalOptions = options !== undefined ? options : existingField.options;
        if (!finalOptions || !Array.isArray(finalOptions) || finalOptions.length === 0) {
          return res.status(400).json({
            error: `Field type '${finalFieldType}' requires at least one option`
          });
        }
      }

      const field = await prisma.formFieldLibrary.update({
        where: { id },
        data: {
          ...(label && { label }),
          ...(fieldType && { fieldType }),
          ...(required !== undefined && { required }),
          ...(options !== undefined && { options }),
          ...(placeholder !== undefined && { placeholder }),
          ...(defaultValue !== undefined && { defaultValue })
        }
      });

      return res.json(field);
    } catch (error) {
      console.error('Error updating field:', error);
      return res.status(500).json({ error: 'Failed to update field' });
    }
  }
);

/**
 * DELETE /api/fields/:id
 * Delete a field library entry
 * Admin only
 * Note: Will fail if field is used in any forms (foreign key constraint)
 */
router.delete('/:id', requireAuth, requireAgent, requireAgentPermission('agentCanAccessFieldLibrary'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Check if field exists
    const field = await prisma.formFieldLibrary.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            formFields: true,
            formResponses: true
          }
        }
      }
    });

    if (!field) {
      return res.status(404).json({ error: 'Field not found' });
    }

    // Check if field is in use
    if (field._count.formFields > 0) {
      return res.status(400).json({
        error: 'Cannot delete field that is used in forms',
        usedInForms: field._count.formFields
      });
    }

    if (field._count.formResponses > 0) {
      return res.status(400).json({
        error: 'Cannot delete field that has responses',
        responseCount: field._count.formResponses
      });
    }

    await prisma.formFieldLibrary.delete({
      where: { id }
    });

    return res.json({ message: 'Field deleted successfully' });
  } catch (error) {
    console.error('Error deleting field:', error);
    return res.status(500).json({ error: 'Failed to delete field' });
  }
});

export default router;
