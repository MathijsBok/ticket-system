import { Router, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { prisma } from '../lib/prisma';
import { requireAuth, requireAdmin, AuthRequest } from '../middleware/auth';
import { EmailTemplateType } from '@prisma/client';

const router = Router();

// Default email templates
const defaultTemplates: Array<{
  type: EmailTemplateType;
  name: string;
  subject: string;
  bodyHtml: string;
  bodyPlain: string;
}> = [
  {
    type: 'TICKET_CREATED',
    name: 'Ticket Created',
    subject: 'Your ticket #{{ticketNumber}} has been created',
    bodyHtml: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #333;">Hello {{userName}},</h2>
  <p>Your support ticket has been successfully created.</p>
  <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
    <p><strong>Ticket Number:</strong> #{{ticketNumber}}</p>
    <p><strong>Subject:</strong> {{ticketSubject}}</p>
  </div>
  <p>Our team will review your request and get back to you as soon as possible.</p>
  <p><a href="{{ticketUrl}}" style="display: inline-block; padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px;">View Ticket</a></p>
  <p style="color: #666; font-size: 12px; margin-top: 30px;">Thank you for contacting us.</p>
</div>`,
    bodyPlain: `Hello {{userName}},

Your support ticket has been successfully created.

Ticket Number: #{{ticketNumber}}
Subject: {{ticketSubject}}

Our team will review your request and get back to you as soon as possible.

View your ticket at: {{ticketUrl}}

Thank you for contacting us.`
  },
  {
    type: 'NEW_REPLY',
    name: 'New Reply',
    subject: 'New reply on ticket #{{ticketNumber}}',
    bodyHtml: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #333;">Hello {{userName}},</h2>
  <p>There is a new reply on your support ticket.</p>
  <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
    <p><strong>Ticket Number:</strong> #{{ticketNumber}}</p>
    <p><strong>Subject:</strong> {{ticketSubject}}</p>
    <p><strong>Replied by:</strong> {{agentName}}</p>
  </div>
  <p>Please log in to view the full response and continue the conversation.</p>
  <p><a href="{{ticketUrl}}" style="display: inline-block; padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px;">View Ticket</a></p>
</div>`,
    bodyPlain: `Hello {{userName}},

There is a new reply on your support ticket.

Ticket Number: #{{ticketNumber}}
Subject: {{ticketSubject}}
Replied by: {{agentName}}

Please log in to view the full response and continue the conversation.

View your ticket at: {{ticketUrl}}`
  },
  {
    type: 'TICKET_RESOLVED',
    name: 'Ticket Resolved',
    subject: 'Ticket #{{ticketNumber}} has been resolved',
    bodyHtml: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #333;">Hello {{userName}},</h2>
  <p>Your support ticket has been marked as resolved.</p>
  <div style="background-color: #d4edda; padding: 15px; border-radius: 5px; margin: 20px 0;">
    <p><strong>Ticket Number:</strong> #{{ticketNumber}}</p>
    <p><strong>Subject:</strong> {{ticketSubject}}</p>
    <p><strong>Status:</strong> <span style="color: #155724;">Resolved</span></p>
  </div>
  <p>If you have any further questions or if the issue persists, please reply to this ticket or create a new one.</p>
  <p><a href="{{ticketUrl}}" style="display: inline-block; padding: 10px 20px; background-color: #28a745; color: white; text-decoration: none; border-radius: 5px;">View Ticket</a></p>
  <p style="color: #666; font-size: 12px; margin-top: 30px;">Thank you for using our support service.</p>
</div>`,
    bodyPlain: `Hello {{userName}},

Your support ticket has been marked as resolved.

Ticket Number: #{{ticketNumber}}
Subject: {{ticketSubject}}
Status: Resolved

If you have any further questions or if the issue persists, please reply to this ticket or create a new one.

View your ticket at: {{ticketUrl}}

Thank you for using our support service.`
  },
  {
    type: 'PENDING_REMINDER_24H',
    name: 'Pending Reminder (24 hours)',
    subject: 'Reminder: Your ticket #{{ticketNumber}} is awaiting your response',
    bodyHtml: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #333;">Hello {{userName}},</h2>
  <p>This is a friendly reminder that your support ticket is awaiting your response.</p>
  <div style="background-color: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0;">
    <p><strong>Ticket Number:</strong> #{{ticketNumber}}</p>
    <p><strong>Subject:</strong> {{ticketSubject}}</p>
    <p><strong>Status:</strong> <span style="color: #856404;">Pending your reply</span></p>
  </div>
  <p>Our support agent {{agentName}} has responded to your ticket and is waiting for additional information from you.</p>
  <p><a href="{{ticketUrl}}" style="display: inline-block; padding: 10px 20px; background-color: #ffc107; color: #212529; text-decoration: none; border-radius: 5px;">Respond Now</a></p>
</div>`,
    bodyPlain: `Hello {{userName}},

This is a friendly reminder that your support ticket is awaiting your response.

Ticket Number: #{{ticketNumber}}
Subject: {{ticketSubject}}
Status: Pending your reply

Our support agent {{agentName}} has responded to your ticket and is waiting for additional information from you.

Respond at: {{ticketUrl}}`
  },
  {
    type: 'PENDING_REMINDER_48H',
    name: 'Pending Reminder (48 hours)',
    subject: 'Final reminder: Ticket #{{ticketNumber}} will be auto-resolved soon',
    bodyHtml: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #333;">Hello {{userName}},</h2>
  <p><strong>Important:</strong> Your support ticket has been pending for 48 hours and will be automatically resolved if we don't hear back from you soon.</p>
  <div style="background-color: #f8d7da; padding: 15px; border-radius: 5px; margin: 20px 0;">
    <p><strong>Ticket Number:</strong> #{{ticketNumber}}</p>
    <p><strong>Subject:</strong> {{ticketSubject}}</p>
    <p><strong>Status:</strong> <span style="color: #721c24;">Pending - Action Required</span></p>
  </div>
  <p>If you still need assistance, please respond to this ticket as soon as possible.</p>
  <p><a href="{{ticketUrl}}" style="display: inline-block; padding: 10px 20px; background-color: #dc3545; color: white; text-decoration: none; border-radius: 5px;">Respond Now</a></p>
  <p style="color: #666; font-size: 12px; margin-top: 30px;">If your issue has been resolved, no action is needed.</p>
</div>`,
    bodyPlain: `Hello {{userName}},

IMPORTANT: Your support ticket has been pending for 48 hours and will be automatically resolved if we don't hear back from you soon.

Ticket Number: #{{ticketNumber}}
Subject: {{ticketSubject}}
Status: Pending - Action Required

If you still need assistance, please respond to this ticket as soon as possible.

Respond at: {{ticketUrl}}

If your issue has been resolved, no action is needed.`
  }
];

// Helper function to replace placeholders
function replacePlaceholders(template: string, data: Record<string, string>): string {
  let result = template;
  Object.entries(data).forEach(([key, value]) => {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    result = result.replace(regex, value);
  });
  return result;
}

// Get all email templates (creates defaults if none exist)
router.get('/', requireAuth, requireAdmin, async (_req: AuthRequest, res: Response) => {
  try {
    // Check if templates exist
    const existingTemplates = await prisma.emailTemplate.findMany();

    // If no templates, create defaults
    if (existingTemplates.length === 0) {
      await prisma.emailTemplate.createMany({
        data: defaultTemplates
      });

      const templates = await prisma.emailTemplate.findMany({
        orderBy: { type: 'asc' }
      });
      return res.json(templates);
    }

    // Check if all template types exist, create missing ones
    const existingTypes = existingTemplates.map(t => t.type);
    const missingTemplates = defaultTemplates.filter(t => !existingTypes.includes(t.type));

    if (missingTemplates.length > 0) {
      await prisma.emailTemplate.createMany({
        data: missingTemplates
      });
    }

    const templates = await prisma.emailTemplate.findMany({
      orderBy: { type: 'asc' }
    });

    return res.json(templates);
  } catch (error) {
    console.error('Error fetching email templates:', error);
    return res.status(500).json({ error: 'Failed to fetch email templates' });
  }
});

// Get single email template
router.get('/:id', requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const template = await prisma.emailTemplate.findUnique({
      where: { id }
    });

    if (!template) {
      return res.status(404).json({ error: 'Email template not found' });
    }

    return res.json(template);
  } catch (error) {
    console.error('Error fetching email template:', error);
    return res.status(500).json({ error: 'Failed to fetch email template' });
  }
});

// Update email template
router.patch('/:id',
  requireAuth,
  requireAdmin,
  [
    body('subject').optional().isString().notEmpty(),
    body('bodyHtml').optional().isString().notEmpty(),
    body('bodyPlain').optional().isString().notEmpty(),
    body('isActive').optional().isBoolean()
  ],
  async (req: AuthRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      const { subject, bodyHtml, bodyPlain, isActive } = req.body;

      // Check if template exists
      const existingTemplate = await prisma.emailTemplate.findUnique({
        where: { id }
      });

      if (!existingTemplate) {
        return res.status(404).json({ error: 'Email template not found' });
      }

      const updateData: any = {};
      if (subject !== undefined) updateData.subject = subject;
      if (bodyHtml !== undefined) updateData.bodyHtml = bodyHtml;
      if (bodyPlain !== undefined) updateData.bodyPlain = bodyPlain;
      if (isActive !== undefined) updateData.isActive = isActive;

      const template = await prisma.emailTemplate.update({
        where: { id },
        data: updateData
      });

      return res.json(template);
    } catch (error) {
      console.error('Error updating email template:', error);
      return res.status(500).json({ error: 'Failed to update email template' });
    }
  }
);

// Preview email template with sample data
router.post('/:id/preview', requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const template = await prisma.emailTemplate.findUnique({
      where: { id }
    });

    if (!template) {
      return res.status(404).json({ error: 'Email template not found' });
    }

    // Sample data for preview
    const sampleData = {
      userName: 'John Doe',
      ticketNumber: '12345',
      ticketSubject: 'Sample Ticket Subject',
      ticketUrl: 'https://support.example.com/tickets/123',
      agentName: 'Support Agent'
    };

    const preview = {
      subject: replacePlaceholders(template.subject, sampleData),
      bodyHtml: replacePlaceholders(template.bodyHtml, sampleData),
      bodyPlain: replacePlaceholders(template.bodyPlain, sampleData)
    };

    return res.json(preview);
  } catch (error) {
    console.error('Error generating email preview:', error);
    return res.status(500).json({ error: 'Failed to generate preview' });
  }
});

// Reset template to default
router.post('/:id/reset', requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const template = await prisma.emailTemplate.findUnique({
      where: { id }
    });

    if (!template) {
      return res.status(404).json({ error: 'Email template not found' });
    }

    // Find default template by type
    const defaultTemplate = defaultTemplates.find(t => t.type === template.type);

    if (!defaultTemplate) {
      return res.status(404).json({ error: 'Default template not found' });
    }

    const updatedTemplate = await prisma.emailTemplate.update({
      where: { id },
      data: {
        subject: defaultTemplate.subject,
        bodyHtml: defaultTemplate.bodyHtml,
        bodyPlain: defaultTemplate.bodyPlain
      }
    });

    return res.json(updatedTemplate);
  } catch (error) {
    console.error('Error resetting email template:', error);
    return res.status(500).json({ error: 'Failed to reset template' });
  }
});

export default router;
