import { Router, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { prisma } from '../lib/prisma';
import { requireAuth, requireAgent, requireAgentPermission, AuthRequest } from '../middleware/auth';

const router = Router();

// Get all forms (public endpoint for users creating tickets)
router.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userRole = req.userRole;

    // Admins and agents see all forms, regular users only see active forms
    const whereClause = (userRole === 'ADMIN' || userRole === 'AGENT') ? {} : { isActive: true };

    const forms = await prisma.form.findMany({
      where: whereClause,
      orderBy: { order: 'asc' },
      include: {
        formFields: {
          include: {
            field: true
          },
          orderBy: {
            order: 'asc'
          }
        }
      }
    });

    return res.json(forms);
  } catch (error) {
    console.error('Error fetching forms:', error);
    return res.status(500).json({ error: 'Failed to fetch forms' });
  }
});

// Reorder forms (admin only) - MUST be before /:id routes
router.patch('/reorder', requireAuth, requireAgent, requireAgentPermission('agentCanAccessForms'), async (req: AuthRequest, res: Response) => {
  try {
    const { formIds } = req.body;

    if (!Array.isArray(formIds)) {
      return res.status(400).json({ error: 'formIds must be an array' });
    }

    // Update order for each form
    await prisma.$transaction(
      formIds.map((id: string, index: number) =>
        prisma.form.update({
          where: { id },
          data: { order: index }
        })
      )
    );

    return res.json({ message: 'Forms reordered successfully' });
  } catch (error) {
    console.error('Error reordering forms:', error);
    return res.status(500).json({ error: 'Failed to reorder forms' });
  }
});

// Get single form
router.get('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const form = await prisma.form.findUnique({
      where: { id },
      include: {
        formFields: {
          include: {
            field: true
          },
          orderBy: {
            order: 'asc'
          }
        }
      }
    });

    if (!form) {
      return res.status(404).json({ error: 'Form not found' });
    }

    return res.json(form);
  } catch (error) {
    console.error('Error fetching form:', error);
    return res.status(500).json({ error: 'Failed to fetch form' });
  }
});

// Create new form (admin only)
router.post('/',
  requireAuth,
  requireAgent,
  requireAgentPermission('agentCanAccessForms'),
  [
    body('name').isString().notEmpty(),
    body('description').optional().isString(),
    body('fields').optional().isArray(),
    body('fields.*.fieldId').optional().isUUID(),
    body('fields.*.required').optional().isBoolean(),
    body('isActive').optional().isBoolean()
  ],
  async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { name, description, fields, isActive } = req.body;

      // Create form with field associations in a transaction
      const form = await prisma.$transaction(async (tx) => {
        const newForm = await tx.form.create({
          data: {
            name,
            description: description || null,
            isActive: isActive !== undefined ? isActive : true
          }
        });

        // Create FormField associations if fields provided
        if (fields && Array.isArray(fields) && fields.length > 0) {
          await tx.formField.createMany({
            data: fields.map((field: { fieldId: string; required?: boolean }, index: number) => ({
              formId: newForm.id,
              fieldId: field.fieldId,
              order: index,
              required: field.required !== undefined ? field.required : false
            }))
          });
        }

        // Fetch form with fields
        return await tx.form.findUnique({
          where: { id: newForm.id },
          include: {
            formFields: {
              include: {
                field: true
              },
              orderBy: {
                order: 'asc'
              }
            }
          }
        });
      });

      return res.status(201).json(form);
    } catch (error) {
      console.error('Error creating form:', error);
      return res.status(500).json({ error: 'Failed to create form' });
    }
  }
);

// Update form (admin only)
router.patch('/:id',
  requireAuth,
  requireAgent,
  requireAgentPermission('agentCanAccessForms'),
  [
    body('name').optional().isString(),
    body('description').optional().isString(),
    body('fields').optional().isArray(),
    body('fields.*.fieldId').optional().isUUID(),
    body('fields.*.required').optional().isBoolean(),
    body('isActive').optional().isBoolean()
  ],
  async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { id } = req.params;
      const { name, description, fields, isActive } = req.body;

      const form = await prisma.$transaction(async (tx) => {
        // Update form basic info
        await tx.form.update({
          where: { id },
          data: {
            ...(name && { name }),
            ...(description !== undefined && { description }),
            ...(isActive !== undefined && { isActive }),
            updatedAt: new Date()
          }
        });

        // Update field associations if fields provided
        if (fields !== undefined && Array.isArray(fields)) {
          // Delete existing field associations
          await tx.formField.deleteMany({
            where: { formId: id }
          });

          // Create new associations
          if (fields.length > 0) {
            await tx.formField.createMany({
              data: fields.map((field: { fieldId: string; required?: boolean }, index: number) => ({
                formId: id,
                fieldId: field.fieldId,
                order: index,
                required: field.required !== undefined ? field.required : false
              }))
            });
          }
        }

        // Fetch form with updated fields
        return await tx.form.findUnique({
          where: { id },
          include: {
            formFields: {
              include: {
                field: true
              },
              orderBy: {
                order: 'asc'
              }
            }
          }
        });
      });

      return res.json(form);
    } catch (error) {
      console.error('Error updating form:', error);
      return res.status(500).json({ error: 'Failed to update form' });
    }
  }
);

// Delete form (admin only)
router.delete('/:id', requireAuth, requireAgent, requireAgentPermission('agentCanAccessForms'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    await prisma.form.delete({
      where: { id }
    });

    return res.json({ message: 'Form deleted successfully' });
  } catch (error) {
    console.error('Error deleting form:', error);
    return res.status(500).json({ error: 'Failed to delete form' });
  }
});

export default router;
