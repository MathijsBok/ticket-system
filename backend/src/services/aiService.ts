import Anthropic from '@anthropic-ai/sdk';
import { prisma } from '../lib/prisma';

export async function getAISettings() {
  const settings = await prisma.settings.findFirst();
  return {
    enabled: settings?.aiSummaryEnabled ?? false,
    apiKey: settings?.anthropicApiKey ?? null,
  };
}

export async function getTicketSuggestionsSettings() {
  const settings = await prisma.settings.findFirst();
  return {
    enabled: settings?.ticketSuggestionsEnabled ?? false,
    apiKey: settings?.ticketSuggestionsApiKey ?? null,
    knowledgeUrls: settings?.aiKnowledgeUrls ?? null,
    knowledgeCache: settings?.aiKnowledgeCache ?? null,
    knowledgeCacheUpdatedAt: settings?.aiKnowledgeCacheUpdatedAt ?? null,
    knowledgeRefreshDays: settings?.aiKnowledgeRefreshDays ?? 7,
    settingsId: settings?.id ?? null,
  };
}

// Check if the cache needs to be refreshed
export function isCacheExpired(lastUpdated: Date | null, refreshDays: number): boolean {
  if (!lastUpdated) return true;

  const now = new Date();
  const cacheAge = now.getTime() - lastUpdated.getTime();
  const maxAge = refreshDays * 24 * 60 * 60 * 1000; // Convert days to milliseconds

  return cacheAge > maxAge;
}

// Refresh the knowledge cache and save to database
export async function refreshKnowledgeCache(settingsId: string, urlsText: string | null): Promise<string | null> {
  console.log('[AI Knowledge] Refreshing knowledge cache...');

  const content = await fetchKnowledgeContent(urlsText);

  // Save to database
  await prisma.settings.update({
    where: { id: settingsId },
    data: {
      aiKnowledgeCache: content,
      aiKnowledgeCacheUpdatedAt: new Date(),
    }
  });

  console.log(`[AI Knowledge] Cache refreshed. Content length: ${content?.length ?? 0} characters`);
  return content;
}

// Get knowledge content (from cache or fresh fetch if expired)
export async function getKnowledgeContent(): Promise<string | null> {
  const settings = await getTicketSuggestionsSettings();

  if (!settings.knowledgeUrls || !settings.settingsId) {
    return null;
  }

  // Check if cache is valid
  if (!isCacheExpired(settings.knowledgeCacheUpdatedAt, settings.knowledgeRefreshDays) && settings.knowledgeCache) {
    console.log('[AI Knowledge] Using cached content');
    return settings.knowledgeCache;
  }

  // Cache is expired or empty, refresh it
  return await refreshKnowledgeCache(settings.settingsId, settings.knowledgeUrls);
}

// Fetch content from a URL (for AI knowledge base)
export async function fetchUrlContent(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'KleverSupportBot/1.0',
        'Accept': 'text/html,text/plain,application/json'
      }
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`[AI Knowledge] Failed to fetch ${url}: ${response.status}`);
      return null;
    }

    const contentType = response.headers.get('content-type') || '';
    const text = await response.text();

    // Strip HTML tags if it's HTML content
    if (contentType.includes('text/html')) {
      // Simple HTML stripping - remove tags, decode entities, clean up whitespace
      return text
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 20000); // Limit content length per URL
    }

    return text.substring(0, 20000); // Limit content length per URL
  } catch (error) {
    console.warn(`[AI Knowledge] Error fetching ${url}:`, error);
    return null;
  }
}

// Fetch all knowledge URLs and return combined content
export async function fetchKnowledgeContent(urlsText: string | null): Promise<string | null> {
  if (!urlsText || !urlsText.trim()) {
    return null;
  }

  const urls = urlsText
    .split('\n')
    .map(url => url.trim())
    .filter(url => url.startsWith('http://') || url.startsWith('https://'));

  if (urls.length === 0) {
    return null;
  }

  console.log(`[AI Knowledge] Fetching content from ${urls.length} URLs`);

  const contents: string[] = [];

  // Fetch URLs in parallel with a limit
  const results = await Promise.allSettled(
    urls.slice(0, 10).map(async (url) => { // Limit to 10 URLs
      const content = await fetchUrlContent(url);
      if (content && content.length > 100) {
        return { url, content };
      }
      return null;
    })
  );

  for (const result of results) {
    if (result.status === 'fulfilled' && result.value) {
      contents.push(`Source: ${result.value.url}\n${result.value.content}`);
    }
  }

  if (contents.length === 0) {
    return null;
  }

  console.log(`[AI Knowledge] Successfully fetched content from ${contents.length} URLs`);
  return contents.join('\n\n---\n\n');
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

// Knowledge item from solved tickets
interface TicketKnowledge {
  subject: string;
  resolution: string;
}

// Generate a comprehensive AI solution based on ticket knowledge
export async function generateKnowledgeBasedSolution(
  subject: string,
  description: string,
  formName: string,
  ticketKnowledge: TicketKnowledge[],
  externalKnowledge?: string | null
): Promise<string | null> {
  const suggestionsSettings = await getTicketSuggestionsSettings();

  if (!suggestionsSettings.enabled || !suggestionsSettings.apiKey) {
    return null;
  }

  // Need either ticket knowledge or external knowledge
  if (ticketKnowledge.length === 0 && !externalKnowledge) {
    return null;
  }

  const anthropic = new Anthropic({
    apiKey: suggestionsSettings.apiKey,
  });

  // Build knowledge base context from solved tickets
  const ticketKnowledgeContext = ticketKnowledge.length > 0
    ? ticketKnowledge
        .map((k, i) => `Issue ${i + 1}: "${k.subject}"\nResolution: ${k.resolution}`)
        .join('\n\n')
    : '';

  // Build user context with subject and description separately
  const userContext = description
    ? `Subject: "${subject}"\nDetailed Description: "${description}"`
    : `Subject: "${subject}"`;

  // Build the knowledge sections
  let knowledgeSections = '';

  if (ticketKnowledgeContext) {
    knowledgeSections += `\n\nKnowledge from previously resolved similar issues:\n${ticketKnowledgeContext}`;
  }

  if (externalKnowledge) {
    knowledgeSections += `\n\nAdditional reference documentation:\n${externalKnowledge}`;
  }

  const prompt = `You are a helpful support assistant for Klever (cryptocurrency wallet and exchange platform). A user is about to submit a support ticket. Based on your knowledge from previously resolved similar issues and reference documentation, provide helpful guidance that might solve their problem without needing to submit a ticket.

User's Issue Category: ${formName}
${userContext}
${knowledgeSections}

Write a helpful solution summary for the user. Pay close attention to BOTH their subject line AND their detailed description to provide a relevant, personalized response that addresses their specific situation. Use information from both the resolved issues and the reference documentation when applicable.

Format your response as follows:
- Start with a brief empathetic opening (1 sentence)
- Then explain the solution clearly, addressing the specific details they mentioned (2-3 sentences)
- If there are steps, list them on separate lines
- End with an encouraging closing (1 sentence)

Important formatting rules:
- Use blank lines between paragraphs for readability
- Keep each paragraph short (2-3 sentences max)
- If listing steps, put each step on its own line

Do NOT mention that you're an AI or reference the knowledge base or documentation directly. Write as if you're providing direct support guidance.`;

  try {
    const message = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 400,
      messages: [{ role: 'user', content: prompt }],
    });

    const textContent = message.content.find(block => block.type === 'text');
    if (textContent && textContent.type === 'text') {
      return textContent.text.trim();
    }
  } catch (error) {
    console.error('Error generating knowledge-based solution:', error);
  }

  return null;
}
