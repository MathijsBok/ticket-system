import sgMail from '@sendgrid/mail';
import crypto from 'crypto';
import { prisma } from '../lib/prisma';

// Environment variable fallbacks
const ENV_SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const ENV_SENDGRID_FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL || 'support@example.com';
const ENV_SENDGRID_FROM_NAME = process.env.SENDGRID_FROM_NAME || 'Support Team';
const ENV_SENDGRID_INBOUND_DOMAIN = process.env.SENDGRID_INBOUND_DOMAIN || 'reply.example.com';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// Cache for SendGrid settings to avoid repeated DB lookups
let cachedSettings: {
  sendgridEnabled: boolean;
  sendgridApiKey: string | null;
  sendgridFromEmail: string | null;
  sendgridFromName: string | null;
  sendgridInboundDomain: string | null;
} | null = null;
let settingsCacheTime = 0;
const SETTINGS_CACHE_TTL = 60000; // 1 minute cache

// Get SendGrid settings from database (with caching)
async function getSendGridSettings() {
  const now = Date.now();
  if (cachedSettings && (now - settingsCacheTime) < SETTINGS_CACHE_TTL) {
    return cachedSettings;
  }

  const settings = await prisma.settings.findFirst();
  cachedSettings = {
    sendgridEnabled: settings?.sendgridEnabled ?? false,
    sendgridApiKey: settings?.sendgridApiKey ?? null,
    sendgridFromEmail: settings?.sendgridFromEmail ?? null,
    sendgridFromName: settings?.sendgridFromName ?? null,
    sendgridInboundDomain: settings?.sendgridInboundDomain ?? null,
  };
  settingsCacheTime = now;
  return cachedSettings;
}

// Get effective SendGrid configuration (database first, then env fallback)
async function getEffectiveConfig() {
  const dbSettings = await getSendGridSettings();

  // If SendGrid is enabled in DB and has API key, use DB settings
  if (dbSettings.sendgridEnabled && dbSettings.sendgridApiKey) {
    return {
      enabled: true,
      apiKey: dbSettings.sendgridApiKey,
      fromEmail: dbSettings.sendgridFromEmail || ENV_SENDGRID_FROM_EMAIL,
      fromName: dbSettings.sendgridFromName || ENV_SENDGRID_FROM_NAME,
      inboundDomain: dbSettings.sendgridInboundDomain || ENV_SENDGRID_INBOUND_DOMAIN,
    };
  }

  // Fall back to environment variables
  if (ENV_SENDGRID_API_KEY) {
    return {
      enabled: true,
      apiKey: ENV_SENDGRID_API_KEY,
      fromEmail: ENV_SENDGRID_FROM_EMAIL,
      fromName: ENV_SENDGRID_FROM_NAME,
      inboundDomain: ENV_SENDGRID_INBOUND_DOMAIN,
    };
  }

  return {
    enabled: false,
    apiKey: null,
    fromEmail: ENV_SENDGRID_FROM_EMAIL,
    fromName: ENV_SENDGRID_FROM_NAME,
    inboundDomain: ENV_SENDGRID_INBOUND_DOMAIN,
  };
}

// Check if email sending is configured
export async function isEmailConfigured(): Promise<boolean> {
  const config = await getEffectiveConfig();
  return config.enabled && !!config.apiKey && !!config.fromEmail;
}

// Get inbound domain for generating reply addresses
export async function getInboundDomain(): Promise<string> {
  const config = await getEffectiveConfig();
  return config.inboundDomain;
}

// Generate a unique reply token
function generateReplyToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

// Generate Reply-To address for a ticket (sync version using passed domain)
export function generateReplyToAddress(replyToken: string, inboundDomain?: string): string {
  return `reply+${replyToken}@${inboundDomain || ENV_SENDGRID_INBOUND_DOMAIN}`;
}

// Generate Message-ID for email threading
function generateMessageId(ticketNumber: number, fromEmail: string): string {
  const domain = fromEmail.split('@')[1] || 'tickets.local';
  return `<ticket-${ticketNumber}-${Date.now()}@${domain}>`;
}

// Replace placeholders in template
function replacePlaceholders(template: string, data: Record<string, string>): string {
  let result = template;
  Object.entries(data).forEach(([key, value]) => {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    result = result.replace(regex, value || '');
  });
  return result;
}

// Get or create email thread for a ticket
export async function getOrCreateEmailThread(ticketId: string): Promise<{
  id: string;
  replyToken: string;
  messageId: string | null;
}> {
  let thread = await prisma.emailThread.findUnique({
    where: { ticketId }
  });

  if (!thread) {
    thread = await prisma.emailThread.create({
      data: {
        ticketId,
        replyToken: generateReplyToken()
      }
    });
  }

  return {
    id: thread.id,
    replyToken: thread.replyToken,
    messageId: thread.messageId
  };
}

// Update email thread after sending an email
async function updateEmailThread(ticketId: string, messageId: string): Promise<void> {
  await prisma.emailThread.update({
    where: { ticketId },
    data: {
      messageId,
      updatedAt: new Date()
    }
  });
}

// Send agent reply notification email
export async function sendAgentReplyEmail(
  ticket: {
    id: string;
    ticketNumber: number;
    subject: string;
    requester: {
      email: string;
      firstName: string | null;
      lastName: string | null;
    };
  },
  comment: {
    bodyPlain: string;
    author: {
      firstName: string | null;
      lastName: string | null;
    };
  }
): Promise<boolean> {
  // Get effective SendGrid configuration
  const config = await getEffectiveConfig();
  if (!config.enabled || !config.apiKey) {
    console.log('[Email] SendGrid not configured, skipping email');
    return false;
  }

  try {
    // Set API key dynamically
    sgMail.setApiKey(config.apiKey);

    // Check if email notifications are enabled
    const settings = await prisma.settings.findFirst();
    if (!settings?.sendTicketResolvedEmail) {
      // Using this as a general "send emails" toggle for now
      console.log('[Email] Email notifications disabled in settings');
      return false;
    }

    // Get email template
    const template = await prisma.emailTemplate.findUnique({
      where: { type: 'NEW_REPLY' }
    });

    if (!template || !template.isActive) {
      console.log('[Email] NEW_REPLY template not found or inactive');
      return false;
    }

    // Get or create email thread
    const thread = await getOrCreateEmailThread(ticket.id);
    const replyToAddress = generateReplyToAddress(thread.replyToken, config.inboundDomain);
    const messageId = generateMessageId(ticket.ticketNumber, config.fromEmail);

    // Build placeholder data
    const userName = [ticket.requester.firstName, ticket.requester.lastName]
      .filter(Boolean)
      .join(' ') || 'Customer';
    const agentName = [comment.author.firstName, comment.author.lastName]
      .filter(Boolean)
      .join(' ') || 'Support Agent';
    const ticketUrl = `${FRONTEND_URL}/tickets/${ticket.id}`;

    const placeholders: Record<string, string> = {
      userName,
      ticketNumber: ticket.ticketNumber.toString(),
      ticketSubject: ticket.subject,
      ticketUrl,
      agentName,
      replyContent: comment.bodyPlain,
      replyInstructions: 'You can reply directly to this email to respond to the ticket.'
    };

    // Replace placeholders in template
    const subject = replacePlaceholders(template.subject, placeholders);
    const htmlBody = replacePlaceholders(template.bodyHtml, placeholders);
    const textBody = replacePlaceholders(template.bodyPlain, placeholders);

    // Build email headers for threading
    const headers: Record<string, string> = {
      'Message-ID': messageId,
      'X-Ticket-Number': ticket.ticketNumber.toString(),
      'X-Ticket-ID': ticket.id
    };

    // Add In-Reply-To and References if we have previous messages
    if (thread.messageId) {
      headers['In-Reply-To'] = thread.messageId;
      headers['References'] = thread.messageId;
    }

    // Send email via SendGrid
    await sgMail.send({
      to: ticket.requester.email,
      from: {
        email: config.fromEmail,
        name: config.fromName
      },
      replyTo: {
        email: replyToAddress,
        name: `Ticket #${ticket.ticketNumber}`
      },
      subject,
      text: textBody,
      html: htmlBody,
      headers
    });

    // Update thread with new message ID
    await updateEmailThread(ticket.id, messageId);

    console.log(`[Email] Sent reply notification for ticket #${ticket.ticketNumber} to ${ticket.requester.email}`);
    return true;
  } catch (error) {
    console.error('[Email] Failed to send agent reply email:', error);
    return false;
  }
}

// Send ticket created confirmation email
export async function sendTicketCreatedEmail(
  ticket: {
    id: string;
    ticketNumber: number;
    subject: string;
    requester: {
      email: string;
      firstName: string | null;
      lastName: string | null;
    };
  }
): Promise<boolean> {
  // Get effective SendGrid configuration
  const config = await getEffectiveConfig();
  if (!config.enabled || !config.apiKey) {
    console.log('[Email] SendGrid not configured, skipping email');
    return false;
  }

  try {
    // Set API key dynamically
    sgMail.setApiKey(config.apiKey);

    // Check if email notifications are enabled
    const settings = await prisma.settings.findFirst();
    if (!settings?.sendTicketCreatedEmail) {
      console.log('[Email] Ticket created email notifications disabled');
      return false;
    }

    // Get email template
    const template = await prisma.emailTemplate.findUnique({
      where: { type: 'TICKET_CREATED' }
    });

    if (!template || !template.isActive) {
      console.log('[Email] TICKET_CREATED template not found or inactive');
      return false;
    }

    // Get or create email thread
    const thread = await getOrCreateEmailThread(ticket.id);
    const replyToAddress = generateReplyToAddress(thread.replyToken, config.inboundDomain);
    const messageId = generateMessageId(ticket.ticketNumber, config.fromEmail);

    // Build placeholder data
    const userName = [ticket.requester.firstName, ticket.requester.lastName]
      .filter(Boolean)
      .join(' ') || 'Customer';
    const ticketUrl = `${FRONTEND_URL}/tickets/${ticket.id}`;

    const placeholders: Record<string, string> = {
      userName,
      ticketNumber: ticket.ticketNumber.toString(),
      ticketSubject: ticket.subject,
      ticketUrl,
      replyInstructions: 'You can reply directly to this email to add more information to your ticket.'
    };

    // Replace placeholders in template
    const subject = replacePlaceholders(template.subject, placeholders);
    const htmlBody = replacePlaceholders(template.bodyHtml, placeholders);
    const textBody = replacePlaceholders(template.bodyPlain, placeholders);

    // Send email via SendGrid
    await sgMail.send({
      to: ticket.requester.email,
      from: {
        email: config.fromEmail,
        name: config.fromName
      },
      replyTo: {
        email: replyToAddress,
        name: `Ticket #${ticket.ticketNumber}`
      },
      subject,
      text: textBody,
      html: htmlBody,
      headers: {
        'Message-ID': messageId,
        'X-Ticket-Number': ticket.ticketNumber.toString(),
        'X-Ticket-ID': ticket.id
      }
    });

    // Update thread with message ID
    await updateEmailThread(ticket.id, messageId);

    console.log(`[Email] Sent ticket created confirmation for #${ticket.ticketNumber} to ${ticket.requester.email}`);
    return true;
  } catch (error) {
    console.error('[Email] Failed to send ticket created email:', error);
    return false;
  }
}

// Send ticket resolved notification email
export async function sendTicketResolvedEmail(
  ticket: {
    id: string;
    ticketNumber: number;
    subject: string;
    requester: {
      email: string;
      firstName: string | null;
      lastName: string | null;
    };
  }
): Promise<boolean> {
  // Get effective SendGrid configuration
  const config = await getEffectiveConfig();
  if (!config.enabled || !config.apiKey) {
    console.log('[Email] SendGrid not configured, skipping email');
    return false;
  }

  try {
    // Set API key dynamically
    sgMail.setApiKey(config.apiKey);

    // Check if email notifications are enabled
    const settings = await prisma.settings.findFirst();
    if (!settings?.sendTicketResolvedEmail) {
      console.log('[Email] Ticket resolved email notifications disabled');
      return false;
    }

    // Get email template
    const template = await prisma.emailTemplate.findUnique({
      where: { type: 'TICKET_RESOLVED' }
    });

    if (!template || !template.isActive) {
      console.log('[Email] TICKET_RESOLVED template not found or inactive');
      return false;
    }

    // Get email thread
    const thread = await getOrCreateEmailThread(ticket.id);
    const replyToAddress = generateReplyToAddress(thread.replyToken, config.inboundDomain);
    const messageId = generateMessageId(ticket.ticketNumber, config.fromEmail);

    // Build placeholder data
    const userName = [ticket.requester.firstName, ticket.requester.lastName]
      .filter(Boolean)
      .join(' ') || 'Customer';
    const ticketUrl = `${FRONTEND_URL}/tickets/${ticket.id}`;

    const placeholders: Record<string, string> = {
      userName,
      ticketNumber: ticket.ticketNumber.toString(),
      ticketSubject: ticket.subject,
      ticketUrl,
      replyInstructions: 'If you need further assistance, you can reply to this email to reopen the ticket.'
    };

    // Replace placeholders in template
    const subject = replacePlaceholders(template.subject, placeholders);
    const htmlBody = replacePlaceholders(template.bodyHtml, placeholders);
    const textBody = replacePlaceholders(template.bodyPlain, placeholders);

    // Build headers
    const headers: Record<string, string> = {
      'Message-ID': messageId,
      'X-Ticket-Number': ticket.ticketNumber.toString(),
      'X-Ticket-ID': ticket.id
    };

    if (thread.messageId) {
      headers['In-Reply-To'] = thread.messageId;
      headers['References'] = thread.messageId;
    }

    // Send email via SendGrid
    await sgMail.send({
      to: ticket.requester.email,
      from: {
        email: config.fromEmail,
        name: config.fromName
      },
      replyTo: {
        email: replyToAddress,
        name: `Ticket #${ticket.ticketNumber}`
      },
      subject,
      text: textBody,
      html: htmlBody,
      headers
    });

    // Update thread with message ID
    await updateEmailThread(ticket.id, messageId);

    console.log(`[Email] Sent ticket resolved notification for #${ticket.ticketNumber} to ${ticket.requester.email}`);
    return true;
  } catch (error) {
    console.error('[Email] Failed to send ticket resolved email:', error);
    return false;
  }
}

// Extract reply token from email address
export function extractReplyToken(toAddress: string): string | null {
  // Pattern: reply+{token}@domain
  const match = toAddress.match(/reply\+([a-f0-9]{64})@/i);
  return match ? match[1] : null;
}

// Normalize email for comparison (handle Gmail +tags, case, etc.)
export function normalizeEmail(email: string): string {
  const [localPart, domain] = email.toLowerCase().trim().split('@');
  // Remove +tag suffixes (user+tag@gmail.com -> user@gmail.com)
  const cleanLocal = localPart.split('+')[0];
  return `${cleanLocal}@${domain}`;
}

// Extract reply content from email body (strip quoted text and signatures)
export function extractReplyContent(body: string): string {
  let content = body;

  // Patterns to detect quoted content
  const quotePatterns = [
    // Gmail: "On Mon, Jan 1, 2024 at 12:00 PM John Doe <john@example.com> wrote:"
    /On\s+.{10,100}\s+wrote:\s*$/im,
    // Outlook: "From: ... Sent: ... To: ... Subject: ..."
    /^-+\s*Original Message\s*-+$/im,
    /^From:.*\r?\nSent:.*\r?\nTo:.*\r?\nSubject:/im,
    // Apple Mail
    /^On\s.+,\s.+wrote:$/im,
    // Generic quoted lines marker
    /^>+\s*/m,
    // Common separators
    /^_{10,}$/m,
    /^-{10,}$/m
  ];

  // Signature patterns
  const signaturePatterns = [
    /^--\s*$/m,           // Standard signature delimiter
    /^Sent from my iPhone/im,
    /^Sent from my Android/im,
    /^Get Outlook for/im,
    /^Sent from Mail for Windows/im
  ];

  // Find the earliest occurrence of any pattern
  let cutoffIndex = content.length;

  for (const pattern of [...quotePatterns, ...signaturePatterns]) {
    const match = content.match(pattern);
    if (match && match.index !== undefined && match.index < cutoffIndex) {
      cutoffIndex = match.index;
    }
  }

  // Cut content at the earliest pattern
  content = content.substring(0, cutoffIndex);

  // Remove lines that start with > (quoted lines)
  content = content.split('\n')
    .filter(line => !line.trim().startsWith('>'))
    .join('\n');

  // Clean up whitespace
  content = content.trim();

  // Remove excessive blank lines
  content = content.replace(/\n{3,}/g, '\n\n');

  return content;
}

// Convert plain text to simple HTML
export function textToHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>\n')
    .replace(/  /g, '&nbsp;&nbsp;');
}

// Send feedback request email
export async function sendFeedbackRequestEmail(
  ticket: {
    id: string;
    ticketNumber: number;
    subject: string;
    requester: {
      email: string;
      firstName: string | null;
      lastName: string | null;
    };
  }
): Promise<boolean> {
  // Get effective SendGrid configuration
  const config = await getEffectiveConfig();
  if (!config.enabled || !config.apiKey) {
    console.log('[Email] SendGrid not configured, skipping feedback request email');
    return false;
  }

  try {
    // Set API key dynamically
    sgMail.setApiKey(config.apiKey);

    // Get email template
    const template = await prisma.emailTemplate.findUnique({
      where: { type: 'FEEDBACK_REQUEST' }
    });

    if (!template || !template.isActive) {
      console.log('[Email] FEEDBACK_REQUEST template not found or inactive');
      return false;
    }

    // Create or get existing feedback record
    let feedback = await prisma.feedback.findUnique({
      where: { ticketId: ticket.id }
    });

    if (!feedback) {
      // Generate unique feedback token
      const feedbackToken = crypto.randomBytes(32).toString('hex');

      feedback = await prisma.feedback.create({
        data: {
          ticketId: ticket.id,
          token: feedbackToken
        }
      });
    }

    // Build feedback URL
    const feedbackUrl = `${FRONTEND_URL}/feedback?token=${feedback.token}`;

    // Build placeholder data
    const userName = [ticket.requester.firstName, ticket.requester.lastName]
      .filter(Boolean)
      .join(' ') || 'Customer';
    const ticketUrl = `${FRONTEND_URL}/tickets/${ticket.id}`;

    const placeholders: Record<string, string> = {
      userName,
      ticketNumber: ticket.ticketNumber.toString(),
      ticketSubject: ticket.subject,
      ticketUrl,
      feedbackUrl
    };

    // Replace placeholders in template
    const subject = replacePlaceholders(template.subject, placeholders);
    const htmlBody = replacePlaceholders(template.bodyHtml, placeholders);
    const textBody = replacePlaceholders(template.bodyPlain, placeholders);

    // Get email thread for headers
    const thread = await getOrCreateEmailThread(ticket.id);
    const messageId = generateMessageId(ticket.ticketNumber, config.fromEmail);

    // Build headers
    const headers: Record<string, string> = {
      'Message-ID': messageId,
      'X-Ticket-Number': ticket.ticketNumber.toString(),
      'X-Ticket-ID': ticket.id
    };

    if (thread.messageId) {
      headers['In-Reply-To'] = thread.messageId;
      headers['References'] = thread.messageId;
    }

    // Send email via SendGrid
    await sgMail.send({
      to: ticket.requester.email,
      from: {
        email: config.fromEmail,
        name: config.fromName
      },
      subject,
      text: textBody,
      html: htmlBody,
      headers
    });

    console.log(`[Email] Sent feedback request for ticket #${ticket.ticketNumber} to ${ticket.requester.email}`);
    return true;
  } catch (error) {
    console.error('[Email] Failed to send feedback request email:', error);
    return false;
  }
}
