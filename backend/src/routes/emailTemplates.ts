import { Router, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { prisma } from '../lib/prisma';
import { requireAuth, requireAdmin, requireAgent, AuthRequest } from '../middleware/auth';
import { EmailTemplateType } from '@prisma/client';

const router = Router();

// Default email templates - simple and easy to edit
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
    bodyHtml: `<h2>Ticket Created</h2>
<p>Your request has been received</p>

<p>Hello <strong>{{userName}}</strong>,</p>

<p>Thank you for reaching out. Your support ticket has been successfully created and our team will review it shortly.</p>

<p><strong>Ticket Number:</strong> #{{ticketNumber}}<br>
<strong>Subject:</strong> {{ticketSubject}}</p>

<p>You can track the progress of your ticket here:<br>
<a href="{{ticketUrl}}">View Ticket</a></p>

<p>Thank you for contacting us. We'll get back to you as soon as possible.</p>`,
    bodyPlain: `Ticket Created - Your request has been received

Hello {{userName}},

Thank you for reaching out. Your support ticket has been successfully created and our team will review it shortly.

Ticket Number: #{{ticketNumber}}
Subject: {{ticketSubject}}

You can track the progress of your ticket at: {{ticketUrl}}

Thank you for contacting us. We'll get back to you as soon as possible.`
  },
  {
    type: 'NEW_REPLY',
    name: 'New Reply',
    subject: 'New reply on ticket #{{ticketNumber}}',
    bodyHtml: `<h2>New Reply</h2>
<p>An agent has responded to your ticket</p>

<p>Hello <strong>{{userName}}</strong>,</p>

<p><strong>{{agentName}}</strong> has replied to your support ticket. Please log in to view the full response and continue the conversation.</p>

<p><strong>Ticket Number:</strong> #{{ticketNumber}}<br>
<strong>Subject:</strong> {{ticketSubject}}</p>

<p><a href="{{ticketUrl}}">View Reply</a></p>

<p>Reply to this ticket to continue the conversation.</p>`,
    bodyPlain: `New Reply - An agent has responded to your ticket

Hello {{userName}},

{{agentName}} has replied to your support ticket. Please log in to view the full response and continue the conversation.

Ticket Number: #{{ticketNumber}}
Subject: {{ticketSubject}}

View your ticket at: {{ticketUrl}}

Reply to this ticket to continue the conversation.`
  },
  {
    type: 'TICKET_RESOLVED',
    name: 'Ticket Resolved',
    subject: 'Ticket #{{ticketNumber}} has been resolved',
    bodyHtml: `<h2>Ticket Resolved</h2>
<p>Your issue has been marked as resolved</p>

<p>Hello <strong>{{userName}}</strong>,</p>

<p>Great news! Your support ticket has been resolved. We hope we were able to help you.</p>

<p><strong>Ticket Number:</strong> #{{ticketNumber}}<br>
<strong>Subject:</strong> {{ticketSubject}}<br>
<strong>Status:</strong> Resolved</p>

<p>If you have any further questions or if the issue persists, please don't hesitate to reopen this ticket or create a new one.</p>

<p><a href="{{ticketUrl}}">View Ticket</a></p>

<p>Thank you for using our support service.</p>`,
    bodyPlain: `Ticket Resolved - Your issue has been marked as resolved

Hello {{userName}},

Great news! Your support ticket has been resolved. We hope we were able to help you.

Ticket Number: #{{ticketNumber}}
Subject: {{ticketSubject}}
Status: Resolved

If you have any further questions or if the issue persists, please don't hesitate to reopen this ticket or create a new one.

View your ticket at: {{ticketUrl}}

Thank you for using our support service.`
  },
  {
    type: 'PENDING_REMINDER_24H',
    name: 'Pending Reminder (24 hours)',
    subject: 'Reminder: Your ticket #{{ticketNumber}} is awaiting your response',
    bodyHtml: `<h2>Response Needed</h2>
<p>Your ticket is awaiting your reply</p>

<p>Hello <strong>{{userName}}</strong>,</p>

<p>This is a friendly reminder that <strong>{{agentName}}</strong> has responded to your ticket and is waiting for additional information from you.</p>

<p><strong>Ticket Number:</strong> #{{ticketNumber}}<br>
<strong>Subject:</strong> {{ticketSubject}}<br>
<strong>Status:</strong> Pending your reply</p>

<p><a href="{{ticketUrl}}">Respond Now</a></p>

<p>Please respond so we can continue helping you resolve your issue.</p>`,
    bodyPlain: `Response Needed - Your ticket is awaiting your reply

Hello {{userName}},

This is a friendly reminder that {{agentName}} has responded to your ticket and is waiting for additional information from you.

Ticket Number: #{{ticketNumber}}
Subject: {{ticketSubject}}
Status: Pending your reply

Respond at: {{ticketUrl}}

Please respond so we can continue helping you resolve your issue.`
  },
  {
    type: 'PENDING_REMINDER_48H',
    name: 'Pending Reminder (48 hours)',
    subject: 'Final reminder: Ticket #{{ticketNumber}} will be auto-resolved soon',
    bodyHtml: `<h2>Action Required</h2>
<p>Your ticket will be auto-resolved soon</p>

<p>Hello <strong>{{userName}}</strong>,</p>

<p><strong>Important:</strong> Your support ticket has been pending for 48 hours. If we don't hear back from you, it will be automatically marked as resolved.</p>

<p><strong>Ticket Number:</strong> #{{ticketNumber}}<br>
<strong>Subject:</strong> {{ticketSubject}}<br>
<strong>Status:</strong> Action Required</p>

<p>If you still need assistance, please respond as soon as possible to keep your ticket open.</p>

<p><a href="{{ticketUrl}}">Respond Now</a></p>

<p>If your issue has already been resolved, no action is needed.</p>`,
    bodyPlain: `Action Required - Your ticket will be auto-resolved soon

Hello {{userName}},

IMPORTANT: Your support ticket has been pending for 48 hours. If we don't hear back from you, it will be automatically marked as resolved.

Ticket Number: #{{ticketNumber}}
Subject: {{ticketSubject}}
Status: Action Required

If you still need assistance, please respond as soon as possible.

Respond at: {{ticketUrl}}

If your issue has already been resolved, no action is needed.`
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
router.get('/', requireAuth, requireAgent, async (_req: AuthRequest, res: Response) => {
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
