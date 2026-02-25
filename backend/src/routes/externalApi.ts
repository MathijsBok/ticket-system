import { Router, Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import { prisma } from '../lib/prisma';

const router = Router();

// Extended request type for API key auth
interface ApiKeyRequest extends Request {
  apiKey?: {
    id: string;
    name: string;
    formId: string | null;
  };
}

// API Key authentication middleware
const requireApiKey = async (req: ApiKeyRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Missing or invalid Authorization header. Use: Bearer <api_key>'
      });
    }

    const apiKey = authHeader.substring(7); // Remove 'Bearer ' prefix

    const keyRecord = await prisma.apiKey.findUnique({
      where: { key: apiKey },
      select: {
        id: true,
        name: true,
        formId: true,
        isActive: true
      }
    });

    if (!keyRecord) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid API key'
      });
    }

    if (!keyRecord.isActive) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'API key has been revoked'
      });
    }

    // Update last used timestamp and usage count
    await prisma.apiKey.update({
      where: { id: keyRecord.id },
      data: {
        lastUsedAt: new Date(),
        usageCount: { increment: 1 }
      }
    });

    req.apiKey = {
      id: keyRecord.id,
      name: keyRecord.name,
      formId: keyRecord.formId
    };

    return next();
  } catch (error) {
    console.error('API key auth error:', error);
    return res.status(500).json({ error: 'Authentication failed' });
  }
};

// Get API documentation and info (validates API key and returns available resources)
router.get('/docs', requireApiKey, async (req: ApiKeyRequest, res: Response) => {
  try {
    // Get forms available to this API key
    const formsWhereClause: any = { isActive: true };
    if (req.apiKey?.formId) {
      formsWhereClause.id = req.apiKey.formId;
    }

    const forms = await prisma.form.findMany({
      where: formsWhereClause,
      select: {
        id: true,
        name: true,
        description: true
      },
      orderBy: { order: 'asc' }
    });

    // Get all fields from field library
    const fields = await prisma.formFieldLibrary.findMany({
      select: {
        id: true,
        label: true,
        fieldType: true,
        required: true,
        options: true,
        placeholder: true
      },
      orderBy: { label: 'asc' }
    });

    // Get form name if restricted
    let formRestriction = null;
    if (req.apiKey?.formId) {
      const restrictedForm = forms.find(f => f.id === req.apiKey?.formId);
      formRestriction = restrictedForm?.name || null;
    }

    return res.json({
      keyName: req.apiKey?.name || 'Unknown',
      formRestriction,
      forms,
      fields
    });
  } catch (error) {
    console.error('Error fetching API docs:', error);
    return res.status(500).json({ error: 'Failed to fetch API documentation' });
  }
});

// Get form schema (for external integrations to know what fields to send)
router.get('/forms/:formId/schema', requireApiKey, async (req: ApiKeyRequest, res: Response) => {
  try {
    const { formId } = req.params;

    // If API key is restricted to a form, verify it matches
    if (req.apiKey?.formId && req.apiKey.formId !== formId) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'This API key is restricted to a different form'
      });
    }

    const form = await prisma.form.findUnique({
      where: { id: formId, isActive: true },
      include: {
        formFields: {
          include: {
            field: {
              select: {
                id: true,
                label: true,
                fieldType: true,
                options: true,
                placeholder: true
              }
            }
          },
          orderBy: { order: 'asc' }
        }
      }
    });

    if (!form) {
      return res.status(404).json({ error: 'Form not found' });
    }

    const schema = {
      formId: form.id,
      formName: form.name,
      description: form.description,
      fields: form.formFields.map(ff => ({
        fieldId: ff.field.id,
        label: ff.field.label,
        type: ff.field.fieldType,
        required: ff.required,
        options: ff.field.options,
        placeholder: ff.field.placeholder
      }))
    };

    return res.json(schema);
  } catch (error) {
    console.error('Error fetching form schema:', error);
    return res.status(500).json({ error: 'Failed to fetch form schema' });
  }
});

// List all available forms (if API key is not restricted)
router.get('/forms', requireApiKey, async (req: ApiKeyRequest, res: Response) => {
  try {
    // If API key is restricted to a form, only return that form
    const whereClause: any = { isActive: true };
    if (req.apiKey?.formId) {
      whereClause.id = req.apiKey.formId;
    }

    const forms = await prisma.form.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        description: true
      },
      orderBy: { order: 'asc' }
    });

    return res.json(forms);
  } catch (error) {
    console.error('Error fetching forms:', error);
    return res.status(500).json({ error: 'Failed to fetch forms' });
  }
});

// List all available fields from field library
router.get('/fields', requireApiKey, async (_req: ApiKeyRequest, res: Response) => {
  try {
    const fields = await prisma.formFieldLibrary.findMany({
      select: {
        id: true,
        label: true,
        fieldType: true,
        required: true,
        options: true,
        placeholder: true,
        defaultValue: true
      },
      orderBy: { label: 'asc' }
    });

    return res.json(fields);
  } catch (error) {
    console.error('Error fetching fields:', error);
    return res.status(500).json({ error: 'Failed to fetch fields' });
  }
});

// Get a specific field by ID
router.get('/fields/:fieldId', requireApiKey, async (req: ApiKeyRequest, res: Response) => {
  try {
    const { fieldId } = req.params;

    const field = await prisma.formFieldLibrary.findUnique({
      where: { id: fieldId },
      select: {
        id: true,
        label: true,
        fieldType: true,
        required: true,
        options: true,
        placeholder: true,
        defaultValue: true
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

// Create ticket via external API
router.post('/tickets',
  requireApiKey,
  [
    body('email').isEmail().withMessage('Valid email is required'),
    body('subject').isString().notEmpty().isLength({ max: 500 }).withMessage('Subject is required (max 500 chars)'),
    body('description').isString().notEmpty().withMessage('Description is required'),
    body('formId').optional().isUUID().withMessage('formId must be a valid UUID'),
    body('formResponses').optional().isArray().withMessage('formResponses must be an array'),
    body('formResponses.*.fieldId').optional().isUUID().withMessage('Each formResponse needs a valid fieldId'),
    body('formResponses.*.value').optional().isString().withMessage('Each formResponse needs a value'),
    body('priority').optional().isIn(['LOW', 'NORMAL', 'HIGH', 'URGENT']),
    body('country').optional().isString().isLength({ max: 100 }),
    body('userAgent').optional().isString().isLength({ max: 500 }),
    body('metadata').optional().isObject()
  ],
  async (req: ApiKeyRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    try {
      const { formId, email, subject, description, formResponses, priority, country, userAgent, metadata } = req.body;

      // If API key is restricted to a form, formId must match (or be that form if not provided)
      if (req.apiKey?.formId) {
        if (formId && req.apiKey.formId !== formId) {
          return res.status(403).json({
            error: 'Forbidden',
            message: 'This API key is restricted to a different form'
          });
        }
        // If no formId provided but API key is restricted, use the restricted form
        if (!formId) {
          return res.status(400).json({
            error: 'Bad Request',
            message: 'This API key requires using a specific form. Please provide formId.'
          });
        }
      }

      // Verify form exists and is active (if formId provided)
      let form = null;
      if (formId) {
        form = await prisma.form.findUnique({
          where: { id: formId, isActive: true },
          include: {
            formFields: {
              include: { field: true }
            }
          }
        });

        if (!form) {
          return res.status(404).json({ error: 'Form not found or inactive' });
        }
      }

      // Find or create user by email
      let user = await prisma.user.findUnique({ where: { email } });

      if (!user) {
        // Create a new user for this email
        user = await prisma.user.create({
          data: {
            clerkId: `api_${Date.now()}_${Math.random().toString(36).substring(7)}`,
            email,
            role: 'USER'
          }
        });
      }

      // Get request metadata
      const ipAddress = (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
                       req.socket.remoteAddress ||
                       'unknown';

      // Use country from request body, or fall back to headers
      const ticketCountry = country ||
                           (req.headers['cf-ipcountry'] as string) ||
                           (req.headers['x-country'] as string) ||
                           null;

      // Use userAgent from request body, or fall back to header
      const ticketUserAgent = userAgent || req.headers['user-agent'] || null;

      // Create ticket with optional form responses
      const ticket = await prisma.$transaction(async (tx) => {
        const newTicket = await tx.ticket.create({
          data: {
            subject,
            channel: 'API',
            priority: priority || 'NORMAL',
            requesterId: user!.id,
            formId: formId || null,
            country: ticketCountry,
            ipAddress,
            userAgent: ticketUserAgent,
            comments: {
              create: {
                authorId: user!.id,
                body: description,
                bodyPlain: description,
                channel: 'API',
                isSystem: false
              }
            },
            activities: {
              create: {
                userId: user!.id,
                action: 'ticket_created',
                details: {
                  subject,
                  channel: 'API',
                  apiKeyName: req.apiKey?.name,
                  metadata: metadata || {}
                }
              }
            }
          }
        });

        // Create form responses
        if (formResponses && formResponses.length > 0) {
          await tx.formResponse.createMany({
            data: formResponses.map((response: { fieldId: string; value: string }) => ({
              ticketId: newTicket.id,
              fieldId: response.fieldId,
              value: response.value
            }))
          });
        }

        // Return ticket with details
        return tx.ticket.findUnique({
          where: { id: newTicket.id },
          include: {
            requester: {
              select: { id: true, email: true }
            },
            form: {
              select: { id: true, name: true }
            },
            formResponses: {
              include: {
                field: {
                  select: { id: true, label: true }
                }
              }
            }
          }
        });
      });

      return res.status(201).json({
        success: true,
        ticket: {
          id: ticket!.id,
          ticketNumber: ticket!.ticketNumber,
          subject: ticket!.subject,
          status: ticket!.status,
          priority: ticket!.priority,
          channel: ticket!.channel,
          formId: ticket!.formId,
          formName: ticket!.form?.name,
          requesterEmail: ticket!.requester.email,
          createdAt: ticket!.createdAt
        }
      });
    } catch (error) {
      console.error('Error creating ticket via API:', error);
      return res.status(500).json({ error: 'Failed to create ticket' });
    }
  }
);

// Get ticket status (for external systems to check)
router.get('/tickets/:ticketNumber', requireApiKey, async (req: ApiKeyRequest, res: Response) => {
  try {
    const ticketNumber = parseInt(req.params.ticketNumber);

    if (isNaN(ticketNumber)) {
      return res.status(400).json({ error: 'Invalid ticket number' });
    }

    const ticket = await prisma.ticket.findUnique({
      where: { ticketNumber },
      include: {
        requester: {
          select: { email: true }
        },
        form: {
          select: { id: true, name: true }
        }
      }
    });

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    // If API key is restricted to a form, verify the ticket belongs to that form
    if (req.apiKey?.formId && ticket.formId !== req.apiKey.formId) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'This API key cannot access tickets from this form'
      });
    }

    return res.json({
      ticketNumber: ticket.ticketNumber,
      subject: ticket.subject,
      status: ticket.status,
      priority: ticket.priority,
      formId: ticket.formId,
      formName: ticket.form?.name,
      requesterEmail: ticket.requester.email,
      createdAt: ticket.createdAt,
      updatedAt: ticket.updatedAt,
      solvedAt: ticket.solvedAt
    });
  } catch (error) {
    console.error('Error fetching ticket:', error);
    return res.status(500).json({ error: 'Failed to fetch ticket' });
  }
});

export default router;
