import Anthropic from '@anthropic-ai/sdk';
import { prisma } from '../lib/prisma';

export async function getAISettings() {
  const settings = await prisma.settings.findFirst();
  return {
    enabled: settings?.aiSummaryEnabled ?? false,
    apiKey: settings?.anthropicApiKey ?? null,
  };
}

export async function generateTicketSummary(ticketId: string): Promise<string> {
  // Get AI settings
  const aiSettings = await getAISettings();

  if (!aiSettings.enabled) {
    throw new Error('AI summary feature is disabled');
  }

  if (!aiSettings.apiKey) {
    throw new Error('Anthropic API key is not configured');
  }

  // Initialize Anthropic client with API key from settings
  const anthropic = new Anthropic({
    apiKey: aiSettings.apiKey,
  });

  // Fetch ticket with all relevant data
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: {
      comments: {
        orderBy: { createdAt: 'asc' },
        select: {
          body: true,
          bodyPlain: true,
          isInternal: true,
          isSystem: true,
          createdAt: true,
          author: {
            select: {
              firstName: true,
              lastName: true,
              role: true,
            },
          },
        },
      },
      formResponses: {
        include: {
          field: {
            select: {
              label: true,
              fieldType: true,
            },
          },
        },
      },
      requester: {
        select: {
          firstName: true,
          lastName: true,
          email: true,
        },
      },
    },
  });

  if (!ticket) {
    throw new Error('Ticket not found');
  }

  // Build the prompt content
  const requesterName = [ticket.requester.firstName, ticket.requester.lastName]
    .filter(Boolean)
    .join(' ') || ticket.requester.email;

  // Format comments (exclude system messages)
  const formattedComments = ticket.comments
    .filter(comment => !comment.isSystem)
    .map(comment => {
      const authorName = [comment.author.firstName, comment.author.lastName]
        .filter(Boolean)
        .join(' ') || 'Unknown';
      const role = comment.author.role === 'USER' ? 'Customer' : 'Agent';
      const visibility = comment.isInternal ? ' (Internal Note)' : '';
      return `[${role}${visibility}] ${authorName}: ${comment.bodyPlain}`;
    })
    .join('\n\n');

  // Format form responses
  const formattedFormData = ticket.formResponses
    .map(response => `${response.field.label}: ${response.value}`)
    .join('\n');

  const prompt = `You are a helpful assistant that summarizes support tickets. Given the following ticket information, provide a concise 2-3 sentence summary that captures the main issue, any important context, and current status.

Ticket Subject: ${ticket.subject}
Status: ${ticket.status}
Priority: ${ticket.priority}
Requester: ${requesterName}

${formattedFormData ? `Form Responses:\n${formattedFormData}\n\n` : ''}Comments:
${formattedComments || 'No comments yet.'}

Provide a brief, professional summary in 2-3 sentences. Focus on what the customer needs and any key details. Do not use phrases like "The customer" - be direct and concise.`;

  const message = await anthropic.messages.create({
    model: 'claude-3-haiku-20240307',
    max_tokens: 256,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  });

  // Extract text from response
  const textContent = message.content.find(block => block.type === 'text');
  if (!textContent || textContent.type !== 'text') {
    throw new Error('No text response from AI');
  }

  return textContent.text;
}
