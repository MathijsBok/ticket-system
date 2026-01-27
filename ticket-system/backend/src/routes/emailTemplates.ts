import { Router, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { prisma } from '../lib/prisma';
import { requireAuth, requireAdmin, requireAgent, AuthRequest } from '../middleware/auth';
import { EmailTemplateType } from '@prisma/client';

const router = Router();

// Default email templates with professional styling
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
    bodyHtml: `<table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #f8fafc; padding: 40px 20px;">
  <tr>
    <td align="center">
      <table cellpadding="0" cellspacing="0" border="0" width="600" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
        <tr>
          <td style="padding: 40px 40px 30px 40px;">
            <h1 style="margin: 0 0 8px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 24px; font-weight: 600; color: #1e293b;">Ticket Created</h1>
            <p style="margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 15px; color: #64748b;">Your request has been received</p>
          </td>
        </tr>
        <tr>
          <td style="padding: 0 40px;">
            <div style="height: 1px; background-color: #e2e8f0;"></div>
          </td>
        </tr>
        <tr>
          <td style="padding: 30px 40px;">
            <p style="margin: 0 0 20px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 15px; line-height: 1.6; color: #334155;">Hello <strong>{{userName}}</strong>,</p>
            <p style="margin: 0 0 24px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 15px; line-height: 1.6; color: #334155;">Thank you for reaching out. Your support ticket has been successfully created and our team will review it shortly.</p>
            <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #f1f5f9; border-radius: 8px; margin-bottom: 24px;">
              <tr>
                <td style="padding: 20px;">
                  <table cellpadding="0" cellspacing="0" border="0" width="100%">
                    <tr>
                      <td style="padding-bottom: 12px;">
                        <span style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b;">Ticket Number</span><br>
                        <span style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 18px; font-weight: 600; color: #0f172a;">#{{ticketNumber}}</span>
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <span style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b;">Subject</span><br>
                        <span style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 15px; color: #334155;">{{ticketSubject}}</span>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
            <p style="margin: 0 0 24px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 15px; line-height: 1.6; color: #334155;">You can track the progress of your ticket and add additional information by clicking the button below.</p>
            <table cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="background-color: #3b82f6; border-radius: 8px;">
                  <a href="{{ticketUrl}}" style="display: inline-block; padding: 14px 28px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 15px; font-weight: 600; color: #ffffff; text-decoration: none;">View Ticket</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding: 30px 40px 40px 40px;">
            <p style="margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 13px; color: #94a3b8;">Thank you for contacting us. We'll get back to you as soon as possible.</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`,
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
    bodyHtml: `<table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #f8fafc; padding: 40px 20px;">
  <tr>
    <td align="center">
      <table cellpadding="0" cellspacing="0" border="0" width="600" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
        <tr>
          <td style="padding: 40px 40px 30px 40px;">
            <h1 style="margin: 0 0 8px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 24px; font-weight: 600; color: #1e293b;">New Reply</h1>
            <p style="margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 15px; color: #64748b;">An agent has responded to your ticket</p>
          </td>
        </tr>
        <tr>
          <td style="padding: 0 40px;">
            <div style="height: 1px; background-color: #e2e8f0;"></div>
          </td>
        </tr>
        <tr>
          <td style="padding: 30px 40px;">
            <p style="margin: 0 0 20px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 15px; line-height: 1.6; color: #334155;">Hello <strong>{{userName}}</strong>,</p>
            <p style="margin: 0 0 24px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 15px; line-height: 1.6; color: #334155;"><strong>{{agentName}}</strong> has replied to your support ticket. Please log in to view the full response and continue the conversation.</p>
            <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #f1f5f9; border-radius: 8px; margin-bottom: 24px;">
              <tr>
                <td style="padding: 20px;">
                  <table cellpadding="0" cellspacing="0" border="0" width="100%">
                    <tr>
                      <td style="padding-bottom: 12px;">
                        <span style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b;">Ticket Number</span><br>
                        <span style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 18px; font-weight: 600; color: #0f172a;">#{{ticketNumber}}</span>
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <span style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b;">Subject</span><br>
                        <span style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 15px; color: #334155;">{{ticketSubject}}</span>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
            <table cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="background-color: #3b82f6; border-radius: 8px;">
                  <a href="{{ticketUrl}}" style="display: inline-block; padding: 14px 28px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 15px; font-weight: 600; color: #ffffff; text-decoration: none;">View Reply</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding: 30px 40px 40px 40px;">
            <p style="margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 13px; color: #94a3b8;">Reply to this ticket to continue the conversation.</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`,
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
    bodyHtml: `<table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #f8fafc; padding: 40px 20px;">
  <tr>
    <td align="center">
      <table cellpadding="0" cellspacing="0" border="0" width="600" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
        <tr>
          <td style="padding: 40px 40px 30px 40px;">
            <h1 style="margin: 0 0 8px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 24px; font-weight: 600; color: #1e293b;">Ticket Resolved</h1>
            <p style="margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 15px; color: #16a34a;">Your issue has been marked as resolved</p>
          </td>
        </tr>
        <tr>
          <td style="padding: 0 40px;">
            <div style="height: 1px; background-color: #e2e8f0;"></div>
          </td>
        </tr>
        <tr>
          <td style="padding: 30px 40px;">
            <p style="margin: 0 0 20px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 15px; line-height: 1.6; color: #334155;">Hello <strong>{{userName}}</strong>,</p>
            <p style="margin: 0 0 24px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 15px; line-height: 1.6; color: #334155;">Great news! Your support ticket has been resolved. We hope we were able to help you.</p>
            <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; margin-bottom: 24px;">
              <tr>
                <td style="padding: 20px;">
                  <table cellpadding="0" cellspacing="0" border="0" width="100%">
                    <tr>
                      <td style="padding-bottom: 12px;">
                        <span style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b;">Ticket Number</span><br>
                        <span style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 18px; font-weight: 600; color: #0f172a;">#{{ticketNumber}}</span>
                      </td>
                      <td style="padding-bottom: 12px; text-align: right;">
                        <span style="display: inline-block; padding: 4px 12px; background-color: #22c55e; border-radius: 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 12px; font-weight: 600; color: #ffffff;">Resolved</span>
                      </td>
                    </tr>
                    <tr>
                      <td colspan="2">
                        <span style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b;">Subject</span><br>
                        <span style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 15px; color: #334155;">{{ticketSubject}}</span>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
            <p style="margin: 0 0 24px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 15px; line-height: 1.6; color: #334155;">If you have any further questions or if the issue persists, please don't hesitate to reopen this ticket or create a new one.</p>
            <table cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="background-color: #22c55e; border-radius: 8px;">
                  <a href="{{ticketUrl}}" style="display: inline-block; padding: 14px 28px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 15px; font-weight: 600; color: #ffffff; text-decoration: none;">View Ticket</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding: 30px 40px 40px 40px;">
            <p style="margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 13px; color: #94a3b8;">Thank you for using our support service.</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`,
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
    bodyHtml: `<table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #f8fafc; padding: 40px 20px;">
  <tr>
    <td align="center">
      <table cellpadding="0" cellspacing="0" border="0" width="600" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
        <tr>
          <td style="padding: 40px 40px 30px 40px;">
            <h1 style="margin: 0 0 8px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 24px; font-weight: 600; color: #1e293b;">Response Needed</h1>
            <p style="margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 15px; color: #d97706;">Your ticket is awaiting your reply</p>
          </td>
        </tr>
        <tr>
          <td style="padding: 0 40px;">
            <div style="height: 1px; background-color: #e2e8f0;"></div>
          </td>
        </tr>
        <tr>
          <td style="padding: 30px 40px;">
            <p style="margin: 0 0 20px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 15px; line-height: 1.6; color: #334155;">Hello <strong>{{userName}}</strong>,</p>
            <p style="margin: 0 0 24px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 15px; line-height: 1.6; color: #334155;">This is a friendly reminder that <strong>{{agentName}}</strong> has responded to your ticket and is waiting for additional information from you.</p>
            <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; margin-bottom: 24px;">
              <tr>
                <td style="padding: 20px;">
                  <table cellpadding="0" cellspacing="0" border="0" width="100%">
                    <tr>
                      <td style="padding-bottom: 12px;">
                        <span style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b;">Ticket Number</span><br>
                        <span style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 18px; font-weight: 600; color: #0f172a;">#{{ticketNumber}}</span>
                      </td>
                      <td style="padding-bottom: 12px; text-align: right;">
                        <span style="display: inline-block; padding: 4px 12px; background-color: #f59e0b; border-radius: 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 12px; font-weight: 600; color: #ffffff;">Pending</span>
                      </td>
                    </tr>
                    <tr>
                      <td colspan="2">
                        <span style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b;">Subject</span><br>
                        <span style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 15px; color: #334155;">{{ticketSubject}}</span>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
            <table cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="background-color: #f59e0b; border-radius: 8px;">
                  <a href="{{ticketUrl}}" style="display: inline-block; padding: 14px 28px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 15px; font-weight: 600; color: #ffffff; text-decoration: none;">Respond Now</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding: 30px 40px 40px 40px;">
            <p style="margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 13px; color: #94a3b8;">Please respond so we can continue helping you resolve your issue.</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`,
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
    bodyHtml: `<table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #f8fafc; padding: 40px 20px;">
  <tr>
    <td align="center">
      <table cellpadding="0" cellspacing="0" border="0" width="600" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
        <tr>
          <td style="padding: 40px 40px 30px 40px;">
            <h1 style="margin: 0 0 8px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 24px; font-weight: 600; color: #1e293b;">Action Required</h1>
            <p style="margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 15px; color: #dc2626;">Your ticket will be auto-resolved soon</p>
          </td>
        </tr>
        <tr>
          <td style="padding: 0 40px;">
            <div style="height: 1px; background-color: #e2e8f0;"></div>
          </td>
        </tr>
        <tr>
          <td style="padding: 30px 40px;">
            <p style="margin: 0 0 20px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 15px; line-height: 1.6; color: #334155;">Hello <strong>{{userName}}</strong>,</p>
            <p style="margin: 0 0 24px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 15px; line-height: 1.6; color: #334155;"><strong>Important:</strong> Your support ticket has been pending for 48 hours. If we don't hear back from you, it will be automatically marked as resolved.</p>
            <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; margin-bottom: 24px;">
              <tr>
                <td style="padding: 20px;">
                  <table cellpadding="0" cellspacing="0" border="0" width="100%">
                    <tr>
                      <td style="padding-bottom: 12px;">
                        <span style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b;">Ticket Number</span><br>
                        <span style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 18px; font-weight: 600; color: #0f172a;">#{{ticketNumber}}</span>
                      </td>
                      <td style="padding-bottom: 12px; text-align: right;">
                        <span style="display: inline-block; padding: 4px 12px; background-color: #ef4444; border-radius: 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 12px; font-weight: 600; color: #ffffff;">Action Required</span>
                      </td>
                    </tr>
                    <tr>
                      <td colspan="2">
                        <span style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b;">Subject</span><br>
                        <span style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 15px; color: #334155;">{{ticketSubject}}</span>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
            <p style="margin: 0 0 24px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 15px; line-height: 1.6; color: #334155;">If you still need assistance, please respond as soon as possible to keep your ticket open.</p>
            <table cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="background-color: #ef4444; border-radius: 8px;">
                  <a href="{{ticketUrl}}" style="display: inline-block; padding: 14px 28px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 15px; font-weight: 600; color: #ffffff; text-decoration: none;">Respond Now</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding: 30px 40px 40px 40px;">
            <p style="margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 13px; color: #94a3b8;">If your issue has already been resolved, no action is needed.</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`,
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
