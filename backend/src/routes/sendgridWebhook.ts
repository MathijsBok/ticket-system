import { Router, Request, Response } from 'express';
import multer from 'multer';
import { prisma } from '../lib/prisma';
import {
  extractReplyToken,
  extractReplyContent,
  normalizeEmail,
  textToHtml,
  getOrCreateEmailThread,
  sendTicketCreatedEmail
} from '../services/emailService';

const router = Router();

// SendGrid sends multipart/form-data, use multer to parse
const upload = multer();

/**
 * POST /webhooks/sendgrid/inbound
 *
 * Receives incoming emails from SendGrid Inbound Parse.
 * SendGrid sends parsed email data as multipart/form-data.
 *
 * Key fields from SendGrid:
 * - from: Sender email (e.g., "John Doe <john@example.com>")
 * - to: Recipient email (reply+{token}@domain)
 * - subject: Email subject
 * - text: Plain text body
 * - html: HTML body (if available)
 * - headers: Raw email headers
 * - envelope: JSON with sender/recipient info
 */
router.post('/inbound', upload.none(), async (req: Request, res: Response) => {
  try {
    const {
      from,
      to,
      subject,
      text,
      html,
      headers
    } = req.body;

    console.log('[Inbound Email] Received:', {
      from,
      to,
      subject: subject?.substring(0, 50),
      hasText: !!text,
      hasHtml: !!html,
      timestamp: new Date().toISOString()
    });

    // Extract reply token from the "to" address
    const replyToken = extractReplyToken(to || '');

    if (!replyToken) {
      console.log('[Inbound Email] No valid reply token found in "to" address:', to);
      // Return 200 to prevent SendGrid retries
      return res.status(200).json({ status: 'ignored', reason: 'no_reply_token' });
    }

    // Find the email thread by reply token
    const emailThread = await prisma.emailThread.findUnique({
      where: { replyToken },
      include: {
        ticket: {
          include: {
            requester: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true
              }
            }
          }
        }
      }
    });

    if (!emailThread) {
      console.log('[Inbound Email] No ticket found for reply token:', replyToken.substring(0, 8) + '...');
      return res.status(200).json({ status: 'ignored', reason: 'ticket_not_found' });
    }

    const ticket = emailThread.ticket;

    // Extract sender email from the "from" field
    // Format can be "John Doe <john@example.com>" or just "john@example.com"
    const fromEmailMatch = from?.match(/<([^>]+)>/) || [null, from];
    const senderEmail = fromEmailMatch[1]?.trim() || from?.trim() || '';

    // Validate sender matches ticket requester
    const normalizedSender = normalizeEmail(senderEmail);
    const normalizedRequester = normalizeEmail(ticket.requester.email);

    if (normalizedSender !== normalizedRequester) {
      console.log('[Inbound Email] Sender mismatch:', {
        sender: senderEmail,
        requester: ticket.requester.email,
        ticketNumber: ticket.ticketNumber
      });
      // Security: Don't process emails from unknown senders
      return res.status(200).json({ status: 'rejected', reason: 'sender_mismatch' });
    }

    // Extract clean reply content (strip quoted text and signatures)
    const emailBody = text || '';
    const cleanContent = extractReplyContent(emailBody);

    if (!cleanContent || cleanContent.length < 2) {
      console.log('[Inbound Email] Empty or too short reply content');
      return res.status(200).json({ status: 'ignored', reason: 'empty_content' });
    }

    // Convert to HTML for storage
    const htmlContent = textToHtml(cleanContent);

    // Extract Message-ID from headers for threading
    let emailMessageId: string | undefined;
    if (headers) {
      const messageIdMatch = headers.match(/Message-ID:\s*(<[^>]+>)/i);
      if (messageIdMatch) {
        emailMessageId = messageIdMatch[1];
      }
    }

    // Handle CLOSED tickets: Create a new follow-up ticket instead of adding a comment
    if (ticket.status === 'CLOSED') {
      console.log('[Inbound Email] Ticket is CLOSED, creating follow-up ticket');

      // Create a new ticket with reference to the closed one
      const newTicket = await prisma.ticket.create({
        data: {
          subject: `Follow-up: ${ticket.subject}`,
          channel: 'EMAIL',
          priority: 'NORMAL',
          requesterId: ticket.requester.id,
          formId: ticket.formId,
          relatedTicketId: ticket.id, // Reference to the original closed ticket
          comments: {
            create: {
              authorId: ticket.requester.id,
              body: htmlContent,
              bodyPlain: cleanContent,
              channel: 'EMAIL',
              isSystem: false,
              emailMessageId,
              emailFrom: senderEmail
            }
          },
          activities: {
            create: {
              userId: ticket.requester.id,
              action: 'ticket_created',
              details: {
                subject: `Follow-up: ${ticket.subject}`,
                channel: 'EMAIL',
                source: 'email_reply_to_closed',
                relatedTicketId: ticket.id,
                relatedTicketNumber: ticket.ticketNumber
              }
            }
          }
        },
        include: {
          requester: {
            select: { id: true, email: true, firstName: true, lastName: true }
          }
        }
      });

      // Create email thread for the new ticket
      await getOrCreateEmailThread(newTicket.id);

      // Add a system comment to the original closed ticket noting the follow-up
      await prisma.comment.create({
        data: {
          ticketId: ticket.id,
          authorId: ticket.requester.id,
          body: `<p><em>Customer replied via email. A new follow-up ticket <a href="/tickets/${newTicket.id}">#${newTicket.ticketNumber}</a> has been created.</em></p>`,
          bodyPlain: `Customer replied via email. A new follow-up ticket #${newTicket.ticketNumber} has been created.`,
          isInternal: false,
          isSystem: true,
          channel: 'SYSTEM'
        }
      });

      // Send ticket created email for the new ticket
      sendTicketCreatedEmail({
        id: newTicket.id,
        ticketNumber: newTicket.ticketNumber,
        subject: newTicket.subject,
        requester: newTicket.requester
      }).catch(err => {
        console.error('[Email] Failed to send ticket created email for follow-up:', err);
      });

      console.log(`[Inbound Email] Created follow-up ticket #${newTicket.ticketNumber} from closed ticket #${ticket.ticketNumber}`);

      return res.status(200).json({
        status: 'success',
        action: 'follow_up_created',
        originalTicketNumber: ticket.ticketNumber,
        newTicketNumber: newTicket.ticketNumber,
        newTicketId: newTicket.id
      });
    }

    // For non-closed tickets: Create comment as usual
    const comment = await prisma.comment.create({
      data: {
        ticketId: ticket.id,
        authorId: ticket.requester.id,
        body: htmlContent,
        bodyPlain: cleanContent,
        isInternal: false,
        isSystem: false,
        channel: 'EMAIL',
        emailMessageId,
        emailFrom: senderEmail
      }
    });

    console.log('[Inbound Email] Created comment:', {
      commentId: comment.id,
      ticketNumber: ticket.ticketNumber,
      contentLength: cleanContent.length
    });

    // Update ticket status if needed
    // PENDING -> OPEN when customer replies
    if (ticket.status === 'PENDING') {
      await prisma.ticket.update({
        where: { id: ticket.id },
        data: { status: 'OPEN' }
      });

      // Log activity
      await prisma.ticketActivity.create({
        data: {
          ticketId: ticket.id,
          userId: ticket.requester.id,
          action: 'status_changed',
          details: {
            from: 'PENDING',
            to: 'OPEN',
            source: 'email_reply'
          }
        }
      });

      console.log('[Inbound Email] Updated ticket status: PENDING -> OPEN');
    }

    // Reopen SOLVED tickets if customer replies
    if (ticket.status === 'SOLVED') {
      await prisma.ticket.update({
        where: { id: ticket.id },
        data: {
          status: 'OPEN',
          solvedAt: null
        }
      });

      await prisma.ticketActivity.create({
        data: {
          ticketId: ticket.id,
          userId: ticket.requester.id,
          action: 'status_changed',
          details: {
            from: 'SOLVED',
            to: 'OPEN',
            source: 'email_reply'
          }
        }
      });

      console.log('[Inbound Email] Reopened solved ticket: SOLVED -> OPEN');
    }

    // Log comment activity
    await prisma.ticketActivity.create({
      data: {
        ticketId: ticket.id,
        userId: ticket.requester.id,
        action: 'comment_added',
        details: {
          channel: 'EMAIL',
          source: 'inbound_email'
        }
      }
    });

    // Update email thread with the incoming message ID for threading
    if (emailMessageId) {
      await prisma.emailThread.update({
        where: { id: emailThread.id },
        data: {
          messageId: emailMessageId,
          updatedAt: new Date()
        }
      });
    }

    console.log(`[Inbound Email] Successfully processed email for ticket #${ticket.ticketNumber}`);

    return res.status(200).json({
      status: 'success',
      ticketNumber: ticket.ticketNumber,
      commentId: comment.id
    });

  } catch (error) {
    console.error('[Inbound Email] Error processing:', error);
    // Always return 200 to prevent SendGrid retries
    // Log the error for investigation
    return res.status(200).json({ status: 'error', message: 'Internal processing error' });
  }
});

export default router;
