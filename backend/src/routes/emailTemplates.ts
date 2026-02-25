import { Router, Response } from 'express';
import { body, validationResult } from 'express-validator';
import sgMail from '@sendgrid/mail';
import { prisma } from '../lib/prisma';
import { requireAuth, requireAgent, requireAgentPermission, AuthRequest } from '../middleware/auth';
import { EmailTemplateType } from '@prisma/client';
import { getEffectiveConfig, wrapInEmailLayout, replacePlaceholders as serviceReplacePlaceholders } from '../services/emailService';

const router = Router();

// Default email templates with inline styles for cross-client compatibility
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
    bodyHtml: `<h2 style="margin: 0 0 8px 0; font-size: 22px; font-weight: 700; color: #1e293b;">Ticket Created</h2>
<p style="margin: 0 0 20px 0; font-size: 14px; color: #64748b; line-height: 1.5;">Your request has been received</p>

<p style="margin: 0 0 16px 0; font-size: 15px; color: #374151; line-height: 1.6;">Hello <strong style="color: #111827;">{{userName}}</strong>,</p>

<p style="margin: 0 0 16px 0; font-size: 15px; color: #374151; line-height: 1.6;">Thank you for reaching out. Your support ticket has been successfully created and our team will review it shortly.</p>

<p style="margin: 0 0 16px 0; font-size: 15px; color: #374151; line-height: 1.6;"><strong style="color: #111827;">Ticket Number:</strong> #{{ticketNumber}}<br>
<strong style="color: #111827;">Subject:</strong> {{ticketSubject}}</p>

<p style="margin: 0 0 16px 0; font-size: 15px; color: #374151; line-height: 1.6;">You can track the progress of your ticket here:<br>
<a href="{{ticketUrl}}" style="color: #2563eb; text-decoration: underline;">View Ticket</a></p>

<p style="margin: 0; font-size: 15px; color: #374151; line-height: 1.6;">Thank you for contacting us. We'll get back to you as soon as possible.</p>`,
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
    bodyHtml: `<h2 style="margin: 0 0 8px 0; font-size: 22px; font-weight: 700; color: #1e293b;">New Reply</h2>
<p style="margin: 0 0 20px 0; font-size: 14px; color: #64748b; line-height: 1.5;">An agent has responded to your ticket</p>

<p style="margin: 0 0 16px 0; font-size: 15px; color: #374151; line-height: 1.6;">Hello <strong style="color: #111827;">{{userName}}</strong>,</p>

<p style="margin: 0 0 16px 0; font-size: 15px; color: #374151; line-height: 1.6;"><strong style="color: #111827;">{{agentName}}</strong> has replied to your support ticket. Please log in to view the full response and continue the conversation.</p>

<p style="margin: 0 0 16px 0; font-size: 15px; color: #374151; line-height: 1.6;"><strong style="color: #111827;">Ticket Number:</strong> #{{ticketNumber}}<br>
<strong style="color: #111827;">Subject:</strong> {{ticketSubject}}</p>

<p style="margin: 0 0 16px 0;"><a href="{{ticketUrl}}" style="display: inline-block; padding: 10px 24px; background-color: #2563eb; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 14px; font-weight: 600;">View Reply</a></p>

<p style="margin: 0; font-size: 15px; color: #374151; line-height: 1.6;">Reply to this ticket to continue the conversation.</p>`,
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
    bodyHtml: `<h2 style="margin: 0 0 8px 0; font-size: 22px; font-weight: 700; color: #1e293b;">Ticket Resolved</h2>
<p style="margin: 0 0 20px 0; font-size: 14px; color: #64748b; line-height: 1.5;">Your issue has been marked as resolved</p>

<p style="margin: 0 0 16px 0; font-size: 15px; color: #374151; line-height: 1.6;">Hello <strong style="color: #111827;">{{userName}}</strong>,</p>

<p style="margin: 0 0 16px 0; font-size: 15px; color: #374151; line-height: 1.6;">Great news! Your support ticket has been resolved. We hope we were able to help you.</p>

<p style="margin: 0 0 16px 0; font-size: 15px; color: #374151; line-height: 1.6;"><strong style="color: #111827;">Ticket Number:</strong> #{{ticketNumber}}<br>
<strong style="color: #111827;">Subject:</strong> {{ticketSubject}}<br>
<strong style="color: #111827;">Status:</strong> <span style="color: #16a34a; font-weight: 600;">Resolved</span></p>

<p style="margin: 0 0 16px 0; font-size: 15px; color: #374151; line-height: 1.6;">If you have any further questions or if the issue persists, please don't hesitate to reopen this ticket or create a new one.</p>

<p style="margin: 0 0 16px 0;"><a href="{{ticketUrl}}" style="display: inline-block; padding: 10px 24px; background-color: #2563eb; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 14px; font-weight: 600;">View Ticket</a></p>

<p style="margin: 0; font-size: 15px; color: #374151; line-height: 1.6;">Thank you for using our support service.</p>`,
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
    bodyHtml: `<h2 style="margin: 0 0 8px 0; font-size: 22px; font-weight: 700; color: #1e293b;">Response Needed</h2>
<p style="margin: 0 0 20px 0; font-size: 14px; color: #64748b; line-height: 1.5;">Your ticket is awaiting your reply</p>

<p style="margin: 0 0 16px 0; font-size: 15px; color: #374151; line-height: 1.6;">Hello <strong style="color: #111827;">{{userName}}</strong>,</p>

<p style="margin: 0 0 16px 0; font-size: 15px; color: #374151; line-height: 1.6;">This is a friendly reminder that <strong style="color: #111827;">{{agentName}}</strong> has responded to your ticket and is waiting for additional information from you.</p>

<p style="margin: 0 0 16px 0; font-size: 15px; color: #374151; line-height: 1.6;"><strong style="color: #111827;">Ticket Number:</strong> #{{ticketNumber}}<br>
<strong style="color: #111827;">Subject:</strong> {{ticketSubject}}<br>
<strong style="color: #111827;">Status:</strong> <span style="color: #d97706; font-weight: 600;">Pending your reply</span></p>

<p style="margin: 0 0 16px 0;"><a href="{{ticketUrl}}" style="display: inline-block; padding: 10px 24px; background-color: #2563eb; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 14px; font-weight: 600;">Respond Now</a></p>

<p style="margin: 0; font-size: 15px; color: #374151; line-height: 1.6;">Please respond so we can continue helping you resolve your issue.</p>`,
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
    bodyHtml: `<h2 style="margin: 0 0 8px 0; font-size: 22px; font-weight: 700; color: #1e293b;">Action Required</h2>
<p style="margin: 0 0 20px 0; font-size: 14px; color: #64748b; line-height: 1.5;">Your ticket will be auto-resolved soon</p>

<p style="margin: 0 0 16px 0; font-size: 15px; color: #374151; line-height: 1.6;">Hello <strong style="color: #111827;">{{userName}}</strong>,</p>

<p style="margin: 0 0 16px 0; font-size: 15px; color: #374151; line-height: 1.6;"><strong style="color: #dc2626;">Important:</strong> Your support ticket has been pending for 48 hours. If we don't hear back from you, it will be automatically marked as resolved.</p>

<p style="margin: 0 0 16px 0; font-size: 15px; color: #374151; line-height: 1.6;"><strong style="color: #111827;">Ticket Number:</strong> #{{ticketNumber}}<br>
<strong style="color: #111827;">Subject:</strong> {{ticketSubject}}<br>
<strong style="color: #111827;">Status:</strong> <span style="color: #dc2626; font-weight: 600;">Action Required</span></p>

<p style="margin: 0 0 16px 0; font-size: 15px; color: #374151; line-height: 1.6;">If you still need assistance, please respond as soon as possible to keep your ticket open.</p>

<p style="margin: 0 0 16px 0;"><a href="{{ticketUrl}}" style="display: inline-block; padding: 10px 24px; background-color: #dc2626; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 14px; font-weight: 600;">Respond Now</a></p>

<p style="margin: 0; font-size: 15px; color: #374151; line-height: 1.6;">If your issue has already been resolved, no action is needed.</p>`,
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
router.get('/', requireAuth, requireAgent, requireAgentPermission('agentCanAccessEmailTemplates'), async (_req: AuthRequest, res: Response) => {
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
router.get('/:id', requireAuth, requireAgent, requireAgentPermission('agentCanAccessEmailTemplates'), async (req: AuthRequest, res: Response) => {
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
  requireAgent,
  requireAgentPermission('agentCanAccessEmailTemplates'),
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
router.post('/:id/preview', requireAuth, requireAgent, requireAgentPermission('agentCanAccessEmailTemplates'), async (req: AuthRequest, res: Response) => {
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
router.post('/:id/reset', requireAuth, requireAgent, requireAgentPermission('agentCanAccessEmailTemplates'), async (req: AuthRequest, res: Response) => {
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

// Reset all templates to default
router.post('/reset-all', requireAuth, requireAgent, requireAgentPermission('agentCanAccessEmailTemplates'), async (_req: AuthRequest, res: Response) => {
  try {
    const results = [];
    for (const defaultTemplate of defaultTemplates) {
      const existing = await prisma.emailTemplate.findUnique({
        where: { type: defaultTemplate.type }
      });

      if (existing) {
        const updated = await prisma.emailTemplate.update({
          where: { id: existing.id },
          data: {
            subject: defaultTemplate.subject,
            bodyHtml: defaultTemplate.bodyHtml,
            bodyPlain: defaultTemplate.bodyPlain
          }
        });
        results.push(updated);
      }
    }

    return res.json({ success: true, count: results.length, templates: results });
  } catch (error) {
    console.error('Error resetting all email templates:', error);
    return res.status(500).json({ error: 'Failed to reset templates' });
  }
});

// Send test email
router.post('/:id/send-test',
  requireAuth,
  requireAgent,
  requireAgentPermission('agentCanAccessEmailTemplates'),
  [
    body('email').isEmail().withMessage('Valid email address is required')
  ],
  async (req: AuthRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      const { email } = req.body;

      // Check SendGrid configuration
      const config = await getEffectiveConfig();
      if (!config.enabled || !config.apiKey) {
        return res.status(400).json({ error: 'SendGrid is not configured. Please set up SendGrid in Admin Settings first.' });
      }

      // Get the template
      const template = await prisma.emailTemplate.findUnique({
        where: { id }
      });

      if (!template) {
        return res.status(404).json({ error: 'Email template not found' });
      }

      // Sample data for test email
      const sampleData: Record<string, string> = {
        userName: 'John Doe',
        ticketNumber: '12345',
        ticketSubject: 'Sample Ticket Subject',
        ticketUrl: `${config.frontendUrl}/tickets/test-123`,
        agentName: 'Support Agent',
        feedbackUrl: `${config.frontendUrl}/feedback?token=test-token-sample`
      };

      // Replace placeholders and wrap in layout
      const subject = `[TEST] ${serviceReplacePlaceholders(template.subject, sampleData)}`;
      const htmlBody = wrapInEmailLayout(serviceReplacePlaceholders(template.bodyHtml, sampleData), config.fromName);
      const textBody = serviceReplacePlaceholders(template.bodyPlain, sampleData);

      // Send via SendGrid
      sgMail.setApiKey(config.apiKey);
      await sgMail.send({
        to: email,
        from: {
          email: config.fromEmail,
          name: config.fromName
        },
        subject,
        text: textBody,
        html: htmlBody
      });

      console.log(`[Email] Sent test email for template "${template.name}" to ${email}`);
      return res.json({ success: true, message: `Test email sent to ${email}` });
    } catch (error: any) {
      console.error('Error sending test email:', error);
      const message = error?.response?.body?.errors?.[0]?.message || error?.message || 'Failed to send test email';
      return res.status(500).json({ error: message });
    }
  }
);

export default router;
