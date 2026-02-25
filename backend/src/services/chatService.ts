import Anthropic from '@anthropic-ai/sdk';
import { prisma } from '../lib/prisma';
import { getKnowledgeContent } from './aiService';

// Get chat widget settings from database
export async function getChatWidgetSettings() {
  const settings = await prisma.settings.findFirst();
  return {
    enabled: settings?.chatWidgetEnabled ?? false,
    // Use ticket suggestions API key as fallback
    apiKey: settings?.ticketSuggestionsApiKey ?? settings?.anthropicApiKey ?? null,
    welcomeMessage: settings?.chatWidgetWelcomeMessage ?? 'Hi! How can I help you today?',
    visibleToUsers: settings?.chatWidgetVisibleToUsers ?? true,
    visibleToAgents: settings?.chatWidgetVisibleToAgents ?? false,
    escalationThreshold: settings?.chatWidgetEscalationThreshold ?? 3,
    // Training settings
    systemInstructions: settings?.chatWidgetSystemInstructions ?? null,
    companyName: settings?.chatWidgetCompanyName ?? null,
    tone: settings?.chatWidgetTone ?? 'professional',
    faqItems: settings?.chatWidgetFaqItems as Array<{ question: string; answer: string }> | null,
  };
}

// Search solved tickets for relevant knowledge based on user message
export async function searchSolvedTickets(query: string, limit: number = 5): Promise<Array<{ subject: string; resolution: string }>> {
  // Extract keywords from the query (simple approach)
  const keywords = query
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(word => word.length > 3);

  if (keywords.length === 0) {
    return [];
  }

  // Find solved/closed tickets with matching subjects
  const tickets = await prisma.ticket.findMany({
    where: {
      status: { in: ['SOLVED', 'CLOSED'] },
      OR: keywords.map(keyword => ({
        subject: { contains: keyword, mode: 'insensitive' as const }
      }))
    },
    select: {
      id: true,
      subject: true,
      comments: {
        where: {
          isSystem: false,
          isInternal: false,
          author: {
            role: { in: ['AGENT', 'ADMIN'] }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: {
          bodyPlain: true
        }
      }
    },
    take: limit * 2, // Get extra to filter out ones without resolutions
    orderBy: { updatedAt: 'desc' }
  });

  // Extract the last agent comment as the resolution
  const results: Array<{ subject: string; resolution: string }> = [];

  for (const ticket of tickets) {
    if (ticket.comments.length > 0 && ticket.comments[0].bodyPlain.length > 20) {
      results.push({
        subject: ticket.subject,
        resolution: ticket.comments[0].bodyPlain.substring(0, 500) // Limit resolution length
      });
      if (results.length >= limit) break;
    }
  }

  return results;
}

// Build context for the chat AI
interface ChatContext {
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>;
  ticketKnowledge: Array<{ subject: string; resolution: string }>;
  externalKnowledge: string | null;
}

async function buildChatContext(sessionId: string, currentMessage: string): Promise<ChatContext> {
  // Get previous messages in this session (limit to last 10)
  const previousMessages = await prisma.chatMessage.findMany({
    where: { sessionId },
    orderBy: { createdAt: 'asc' },
    take: 10,
    select: {
      role: true,
      content: true
    }
  });

  const conversationHistory = previousMessages.map(msg => ({
    role: msg.role === 'USER' ? 'user' as const : 'assistant' as const,
    content: msg.content
  }));

  // Search for relevant knowledge from solved tickets
  const ticketKnowledge = await searchSolvedTickets(currentMessage);

  // Get external knowledge from cached URLs
  const externalKnowledge = await getKnowledgeContent();

  return {
    conversationHistory,
    ticketKnowledge,
    externalKnowledge
  };
}

// Training settings interface
interface TrainingSettings {
  systemInstructions: string | null;
  companyName: string | null;
  tone: string;
  faqItems: Array<{ question: string; answer: string }> | null;
}

// Build the system prompt for the chat
function buildSystemPrompt(
  context: ChatContext,
  welcomeMessage: string,
  training: TrainingSettings,
  isRegeneration: boolean = false
): string {
  // Determine tone description
  const toneDescriptions: Record<string, string> = {
    professional: 'professional and courteous',
    friendly: 'friendly and warm',
    casual: 'casual and relaxed',
  };
  const toneStyle = toneDescriptions[training.tone] || 'professional and courteous';

  // Build base prompt
  let prompt = `You are a helpful support assistant chatbot${training.companyName ? ` for ${training.companyName}` : ' for a customer support system'}. Your role is to help users solve their problems quickly without needing to create a support ticket.

Communication Style:
- Be ${toneStyle} in your responses
- Keep responses brief and to the point (2-4 sentences when possible)
- Do not mention that you are an AI or reference your knowledge sources directly

Guidelines:
- If you can solve the user's issue, do so clearly
- If you cannot help or the issue is complex, suggest they create a support ticket
- If the user asks about something unrelated to support, politely redirect them`;

  // Add custom instructions if provided
  if (training.systemInstructions) {
    prompt += `\n\nAdditional Instructions:\n${training.systemInstructions}`;
  }

  // Add regeneration context
  if (isRegeneration) {
    prompt += `\n\nIMPORTANT: The user indicated that your previous response was not helpful. Please provide a different, more detailed, or alternative answer. Try a different approach or ask clarifying questions if needed.`;
  }

  prompt += `\n\nWelcome message context: "${welcomeMessage}"`;

  // Add FAQ items if provided
  if (training.faqItems && training.faqItems.length > 0) {
    prompt += '\n\nFrequently Asked Questions (use these for accurate responses):\n';
    training.faqItems.forEach((faq, i) => {
      prompt += `\nQ${i + 1}: ${faq.question}\nA${i + 1}: ${faq.answer}\n`;
    });
  }

  // Add knowledge from solved tickets
  if (context.ticketKnowledge.length > 0) {
    prompt += '\n\nKnowledge from previously resolved similar issues:\n';
    context.ticketKnowledge.forEach((k, i) => {
      prompt += `\nIssue ${i + 1}: "${k.subject}"\nResolution: ${k.resolution}\n`;
    });
  }

  // Add external knowledge
  if (context.externalKnowledge) {
    // Limit external knowledge to avoid token limits
    const truncatedKnowledge = context.externalKnowledge.substring(0, 5000);
    prompt += `\n\nReference documentation:\n${truncatedKnowledge}`;
  }

  return prompt;
}

// Generate a chat response
export async function generateChatResponse(
  sessionId: string,
  userMessage: string
): Promise<{ response: string; messageId: string }> {
  const settings = await getChatWidgetSettings();

  if (!settings.enabled) {
    throw new Error('Chat widget is not enabled');
  }

  if (!settings.apiKey) {
    throw new Error('AI API key is not configured');
  }

  // Save the user message first
  await prisma.chatMessage.create({
    data: {
      sessionId,
      role: 'USER',
      content: userMessage
    }
  });

  // Update session timestamp
  await prisma.chatSession.update({
    where: { id: sessionId },
    data: { updatedAt: new Date() }
  });

  try {
    // Build context for the AI
    const context = await buildChatContext(sessionId, userMessage);

    // Initialize Anthropic client
    const anthropic = new Anthropic({
      apiKey: settings.apiKey,
    });

    // Build training settings
    const training: TrainingSettings = {
      systemInstructions: settings.systemInstructions,
      companyName: settings.companyName,
      tone: settings.tone,
      faqItems: settings.faqItems,
    };

    // Build the system prompt
    const systemPrompt = buildSystemPrompt(context, settings.welcomeMessage, training);

    // Build messages array with conversation history
    const messages = [
      ...context.conversationHistory,
      { role: 'user' as const, content: userMessage }
    ];

    // Generate response
    const response = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 500,
      system: systemPrompt,
      messages
    });

    // Extract text from response
    const textContent = response.content.find(block => block.type === 'text');
    const assistantResponse = textContent && textContent.type === 'text'
      ? textContent.text
      : 'I apologize, but I was unable to generate a response. Please try again or create a support ticket.';

    // Save the assistant message
    const assistantMsg = await prisma.chatMessage.create({
      data: {
        sessionId,
        role: 'ASSISTANT',
        content: assistantResponse
      }
    });

    // Record analytics event for chat response
    const session = await prisma.chatSession.findUnique({
      where: { id: sessionId },
      select: { userId: true }
    });
    if (session) {
      await prisma.aiAnalyticsEvent.create({
        data: {
          userId: session.userId,
          eventType: 'CHAT_RESPONSE_GENERATED'
        }
      });
    }

    return {
      response: assistantResponse,
      messageId: assistantMsg.id
    };
  } catch (error) {
    console.error('Error generating chat response:', error);

    // Save an error message
    const errorMsg = await prisma.chatMessage.create({
      data: {
        sessionId,
        role: 'ASSISTANT',
        content: 'I apologize, but I encountered an error. Please try again or create a support ticket for assistance.'
      }
    });

    return {
      response: errorMsg.content,
      messageId: errorMsg.id
    };
  }
}

// Regenerate a chat response (when user marks as not helpful)
export async function regenerateChatResponse(
  sessionId: string,
  originalMessageId: string
): Promise<{ response: string; messageId: string }> {
  const settings = await getChatWidgetSettings();

  if (!settings.enabled) {
    throw new Error('Chat widget is not enabled');
  }

  if (!settings.apiKey) {
    throw new Error('AI API key is not configured');
  }

  // Get the original message and the user message before it
  const originalMessage = await prisma.chatMessage.findUnique({
    where: { id: originalMessageId }
  });

  if (!originalMessage || originalMessage.sessionId !== sessionId) {
    throw new Error('Message not found');
  }

  // Get the last user message before the original assistant message
  const userMessage = await prisma.chatMessage.findFirst({
    where: {
      sessionId,
      role: 'USER',
      createdAt: { lt: originalMessage.createdAt }
    },
    orderBy: { createdAt: 'desc' }
  });

  if (!userMessage) {
    throw new Error('No user message found to regenerate response for');
  }

  try {
    // Build context for the AI (excluding the original unhelpful response)
    const previousMessages = await prisma.chatMessage.findMany({
      where: {
        sessionId,
        createdAt: { lt: originalMessage.createdAt }
      },
      orderBy: { createdAt: 'asc' },
      take: 10,
      select: {
        role: true,
        content: true
      }
    });

    const conversationHistory = previousMessages.map(msg => ({
      role: msg.role === 'USER' ? 'user' as const : 'assistant' as const,
      content: msg.content
    }));

    // Search for relevant knowledge
    const ticketKnowledge = await searchSolvedTickets(userMessage.content);
    const externalKnowledge = await getKnowledgeContent();

    const context: ChatContext = {
      conversationHistory,
      ticketKnowledge,
      externalKnowledge
    };

    // Initialize Anthropic client
    const anthropic = new Anthropic({
      apiKey: settings.apiKey,
    });

    // Build training settings
    const training: TrainingSettings = {
      systemInstructions: settings.systemInstructions,
      companyName: settings.companyName,
      tone: settings.tone,
      faqItems: settings.faqItems,
    };

    // Build the system prompt with regeneration flag
    const systemPrompt = buildSystemPrompt(context, settings.welcomeMessage, training, true);

    // Build messages array
    const messages = conversationHistory;

    // Generate new response
    const response = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 500,
      system: systemPrompt,
      messages
    });

    // Extract text from response
    const textContent = response.content.find(block => block.type === 'text');
    const assistantResponse = textContent && textContent.type === 'text'
      ? textContent.text
      : 'I apologize, but I was unable to generate a response. Please try again or create a support ticket.';

    // Update the original message with the new response
    const updatedMsg = await prisma.chatMessage.update({
      where: { id: originalMessageId },
      data: {
        content: assistantResponse,
        wasHelpful: null // Reset feedback
      }
    });

    // Record analytics event for regeneration
    const session = await prisma.chatSession.findUnique({
      where: { id: sessionId },
      select: { userId: true }
    });
    if (session) {
      await prisma.aiAnalyticsEvent.create({
        data: {
          userId: session.userId,
          eventType: 'CHAT_RESPONSE_GENERATED'
        }
      });
    }

    return {
      response: assistantResponse,
      messageId: updatedMsg.id
    };
  } catch (error) {
    console.error('Error regenerating chat response:', error);
    throw new Error('Failed to regenerate response');
  }
}

// Create a new chat session
export async function createChatSession(userId: string): Promise<string> {
  const session = await prisma.chatSession.create({
    data: {
      userId,
      status: 'ACTIVE'
    }
  });
  return session.id;
}

// End a chat session
export async function endChatSession(sessionId: string, resolved: boolean): Promise<void> {
  await prisma.chatSession.update({
    where: { id: sessionId },
    data: {
      status: resolved ? 'RESOLVED' : 'ACTIVE'
    }
  });
}

// Record feedback on a message
export async function recordMessageFeedback(
  messageId: string,
  wasHelpful: boolean,
  userId: string
): Promise<void> {
  await prisma.chatMessage.update({
    where: { id: messageId },
    data: { wasHelpful }
  });

  // Record analytics event for feedback
  await prisma.aiAnalyticsEvent.create({
    data: {
      userId,
      eventType: wasHelpful ? 'CHAT_FEEDBACK_HELPFUL' : 'CHAT_FEEDBACK_NOT_HELPFUL'
    }
  });
}

// Get or create an active session for a user
export async function getOrCreateActiveSession(userId: string): Promise<string> {
  // Look for an existing active session
  const existingSession = await prisma.chatSession.findFirst({
    where: {
      userId,
      status: 'ACTIVE'
    },
    orderBy: { updatedAt: 'desc' }
  });

  if (existingSession) {
    return existingSession.id;
  }

  // Create a new session
  return createChatSession(userId);
}
