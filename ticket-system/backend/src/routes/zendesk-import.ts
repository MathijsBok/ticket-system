import { Router, Response } from 'express';
import { PrismaClient, TicketStatus, TicketPriority, TicketChannel, UserRole } from '@prisma/client';
import { requireAuth, requireAdmin, AuthRequest } from '../middleware/auth';
import { getAuth } from '@clerk/express';
import multer from 'multer';

const router = Router();
const prisma = new PrismaClient();

// Configure multer for JSON file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/json') {
      cb(null, true);
    } else {
      cb(new Error('Only JSON files are allowed'));
    }
  }
});

// Configure multer for CSV file uploads
const uploadCsv = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  }
});

// Map Zendesk field types to our field types
const mapZendeskFieldType = (zendeskType: string): string => {
  const typeMap: Record<string, string> = {
    'checkbox': 'checkbox',
    'text': 'text',
    'numeric': 'text',
    'multi-line': 'textarea',
    'drop-down': 'select'
  };
  return typeMap[zendeskType.toLowerCase()] || 'text';
};

// Zendesk data interfaces
interface ZendeskUser {
  id: number;
  email?: string;
  name?: string;
}

interface ZendeskComment {
  id: number;
  author_id: number;
  body?: string;
  html_body?: string;
  plain_body?: string;
  public: boolean;
  created_at?: string;
}

interface ZendeskCustomField {
  id: number;
  value: any;
}

interface ZendeskTicket {
  id: number;
  subject?: string;
  description?: string;
  status: string;
  priority?: string;
  requester?: ZendeskUser;
  requester_id?: number;
  assignee?: ZendeskUser;
  assignee_id?: number;
  submitter?: ZendeskUser;
  comments?: ZendeskComment[];
  custom_fields?: ZendeskCustomField[];
  created_at?: string;
  updated_at?: string;
  solved_at?: string;
}

// Map Zendesk status to our status
const mapStatus = (zendeskStatus: string): TicketStatus => {
  const statusMap: Record<string, TicketStatus> = {
    'new': 'NEW',
    'open': 'OPEN',
    'pending': 'PENDING',
    'hold': 'ON_HOLD',
    'solved': 'SOLVED',
    'closed': 'SOLVED'
  };
  return statusMap[zendeskStatus.toLowerCase()] || 'NEW';
};

// Map Zendesk priority to our priority
const mapPriority = (zendeskPriority: string | null): TicketPriority => {
  if (!zendeskPriority) return 'NORMAL';
  const priorityMap: Record<string, TicketPriority> = {
    'low': 'LOW',
    'normal': 'NORMAL',
    'high': 'HIGH',
    'urgent': 'URGENT'
  };
  return priorityMap[zendeskPriority.toLowerCase()] || 'NORMAL';
};

// Parse name into first and last name
const parseName = (name?: string): { firstName: string; lastName: string } => {
  if (!name) return { firstName: 'Imported', lastName: 'User' };
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: '' };
  }
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' ')
  };
};

// Extract unique users from tickets
const extractUsersFromTickets = (tickets: ZendeskTicket[]): Map<number, ZendeskUser> => {
  const users = new Map<number, ZendeskUser>();

  for (const ticket of tickets) {
    if (ticket.requester) {
      users.set(ticket.requester.id, ticket.requester);
    }
    if (ticket.assignee) {
      users.set(ticket.assignee.id, ticket.assignee);
    }
    if (ticket.submitter) {
      users.set(ticket.submitter.id, ticket.submitter);
    }
    // Extract comment authors too
    for (const comment of ticket.comments || []) {
      if (comment.author_id && !users.has(comment.author_id)) {
        // We only have the ID, will need to resolve later
        users.set(comment.author_id, { id: comment.author_id });
      }
    }
  }

  return users;
};

// Extract unique custom field IDs from tickets
const extractCustomFieldIds = (tickets: ZendeskTicket[]): Set<number> => {
  const fieldIds = new Set<number>();

  for (const ticket of tickets) {
    if (ticket.custom_fields) {
      for (const field of ticket.custom_fields) {
        if (field.id) {
          fieldIds.add(field.id);
        }
      }
    }
  }

  return fieldIds;
};

// Create or find FormFieldLibrary entries for Zendesk custom fields
const createOrFindCustomFields = async (
  fieldIds: Set<number>
): Promise<Map<number, string>> => {
  const fieldMap = new Map<number, string>();

  for (const zendeskId of fieldIds) {
    // Look up by zendeskFieldId first
    let existingField = await prisma.formFieldLibrary.findFirst({
      where: { zendeskFieldId: BigInt(zendeskId) }
    });

    if (existingField) {
      fieldMap.set(zendeskId, existingField.id);
    } else {
      // Create a placeholder field - import the fields CSV to get proper names
      const newField = await prisma.formFieldLibrary.create({
        data: {
          label: `Zendesk Field ${zendeskId}`,
          fieldType: 'text',
          required: false,
          zendeskFieldId: BigInt(zendeskId)
        }
      });
      fieldMap.set(zendeskId, newField.id);
    }
  }

  return fieldMap;
};

// Create FormResponse entries for a ticket's custom fields
const createFormResponses = async (
  ticketId: string,
  customFields: ZendeskCustomField[],
  fieldMap: Map<number, string>
): Promise<number> => {
  let createdCount = 0;

  for (const field of customFields) {
    // Skip null/undefined/false/empty values
    if (field.value === null || field.value === undefined || field.value === false || field.value === '') {
      continue;
    }

    const formFieldId = fieldMap.get(field.id);
    if (!formFieldId) {
      continue;
    }

    // Convert value to string
    const stringValue = typeof field.value === 'object'
      ? JSON.stringify(field.value)
      : String(field.value);

    try {
      await prisma.formResponse.create({
        data: {
          ticketId,
          fieldId: formFieldId,
          value: stringValue
        }
      });
      createdCount++;
    } catch (error) {
      // Skip if there's an error (e.g., duplicate)
      console.error(`Failed to create form response for field ${field.id}:`, error);
    }
  }

  return createdCount;
};

// Import tickets from Zendesk JSON export
router.post('/import', requireAuth, requireAdmin, upload.single('file'), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const fileContent = req.file.buffer.toString().trim();

    // Parse JSON - handle multiple formats:
    // 1. JSONL format (one JSON object per line)
    // 2. Single array of tickets
    // 3. Object with { tickets: [...] } wrapper
    let tickets: ZendeskTicket[];

    try {
      // First, try parsing as single JSON
      const jsonData = JSON.parse(fileContent);

      if (Array.isArray(jsonData)) {
        tickets = jsonData;
      } else if (Array.isArray(jsonData.tickets)) {
        tickets = jsonData.tickets;
      } else if (jsonData.id && jsonData.status) {
        // Single ticket object
        tickets = [jsonData];
      } else {
        return res.status(400).json({
          error: 'Invalid Zendesk export format.'
        });
      }
    } catch {
      // JSON parse failed - try JSONL format (one JSON object per line)
      const lines = fileContent.split('\n').filter(line => line.trim());
      tickets = [];

      for (const line of lines) {
        try {
          const ticket = JSON.parse(line);
          if (ticket.id && ticket.status) {
            tickets.push(ticket);
          }
        } catch {
          // Skip invalid lines
          continue;
        }
      }

      if (tickets.length === 0) {
        return res.status(400).json({
          error: 'Invalid Zendesk export format. Could not parse any tickets from the file.'
        });
      }
    }

    let importedCount = 0;
    let skippedCount = 0;
    let createdUsersCount = 0;
    let createdFieldsCount = 0;
    let createdResponsesCount = 0;
    const errors: string[] = [];

    // Extract and create custom field definitions
    const customFieldIds = extractCustomFieldIds(tickets);
    const customFieldMap = await createOrFindCustomFields(customFieldIds);
    createdFieldsCount = customFieldMap.size;

    // Get the admin user who is importing
    const { userId } = getAuth(req);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const adminUser = await prisma.user.findUnique({
      where: { clerkId: userId }
    });

    if (!adminUser) {
      return res.status(404).json({ error: 'Admin user not found' });
    }

    // Extract all unique users from the tickets
    const zendeskUsers = extractUsersFromTickets(tickets);

    // Create a map of Zendesk user IDs to system user IDs
    const userMap = new Map<number, string>();
    const agentZendeskIds = new Set<number>();

    // Identify which Zendesk users are agents (assignees)
    for (const ticket of tickets) {
      if (ticket.assignee) {
        agentZendeskIds.add(ticket.assignee.id);
      }
    }

    // Match or create users
    for (const [zendeskId, zendeskUser] of zendeskUsers) {
      // First, try to match by email
      if (zendeskUser.email) {
        const existingUser = await prisma.user.findUnique({
          where: { email: zendeskUser.email }
        });

        if (existingUser) {
          userMap.set(zendeskId, existingUser.id);
          continue;
        }
      }

      // Check if we already created a user for this Zendesk ID
      const importClerkId = `zendesk-import-${zendeskId}`;
      const existingImportedUser = await prisma.user.findUnique({
        where: { clerkId: importClerkId }
      });

      if (existingImportedUser) {
        userMap.set(zendeskId, existingImportedUser.id);
        continue;
      }

      // Create a new user if we have email
      if (zendeskUser.email) {
        const { firstName, lastName } = parseName(zendeskUser.name);
        const isAgent = agentZendeskIds.has(zendeskId);

        try {
          const newUser = await prisma.user.create({
            data: {
              clerkId: importClerkId,
              email: zendeskUser.email,
              firstName,
              lastName,
              role: isAgent ? UserRole.AGENT : UserRole.USER
            }
          });
          userMap.set(zendeskId, newUser.id);
          createdUsersCount++;
        } catch (error: any) {
          // User creation failed (maybe duplicate email), use admin as fallback
          console.error(`Failed to create user for Zendesk ID ${zendeskId}:`, error.message);
          userMap.set(zendeskId, adminUser.id);
        }
      } else {
        // No email, use admin as fallback
        userMap.set(zendeskId, adminUser.id);
      }
    }

    // Process each ticket
    let duplicateCount = 0;
    for (const zendeskTicket of tickets) {
      try {
        // Check if ticket with this number already exists
        const existingTicket = await prisma.ticket.findUnique({
          where: { ticketNumber: zendeskTicket.id }
        });

        if (existingTicket) {
          duplicateCount++;
          continue; // Skip duplicate tickets
        }

        // Get requester ID - try embedded object first, then requester_id
        let requesterId = adminUser.id;
        if (zendeskTicket.requester) {
          requesterId = userMap.get(zendeskTicket.requester.id) || adminUser.id;
        } else if (zendeskTicket.requester_id) {
          requesterId = userMap.get(zendeskTicket.requester_id) || adminUser.id;
        }

        // Get assignee ID - try embedded object first, then assignee_id
        let assigneeId: string | undefined = undefined;
        if (zendeskTicket.assignee) {
          assigneeId = userMap.get(zendeskTicket.assignee.id);
        } else if (zendeskTicket.assignee_id) {
          assigneeId = userMap.get(zendeskTicket.assignee_id);
        }

        // Determine solved date
        let solvedAt: Date | undefined = undefined;
        if (zendeskTicket.solved_at) {
          solvedAt = new Date(zendeskTicket.solved_at);
        } else if (zendeskTicket.status === 'solved' || zendeskTicket.status === 'closed') {
          solvedAt = zendeskTicket.updated_at ? new Date(zendeskTicket.updated_at) : new Date();
        }

        // Create ticket with original Zendesk ticket number
        const ticket = await prisma.ticket.create({
          data: {
            ticketNumber: zendeskTicket.id,
            subject: zendeskTicket.subject || 'Imported from Zendesk',
            status: mapStatus(zendeskTicket.status),
            priority: mapPriority(zendeskTicket.priority || null),
            channel: TicketChannel.WEB,
            requesterId,
            assigneeId,
            createdAt: zendeskTicket.created_at ? new Date(zendeskTicket.created_at) : undefined,
            updatedAt: zendeskTicket.updated_at ? new Date(zendeskTicket.updated_at) : undefined,
            solvedAt
          }
        });

        // Import embedded comments (skip attachments)
        const ticketComments = zendeskTicket.comments || [];
        for (const comment of ticketComments) {
          const commentAuthorId = userMap.get(comment.author_id) || adminUser.id;

          await prisma.comment.create({
            data: {
              ticketId: ticket.id,
              authorId: commentAuthorId,
              body: comment.html_body || comment.body || 'No content',
              bodyPlain: comment.plain_body || comment.body || 'No content',
              isInternal: comment.public === false,
              isSystem: false,
              channel: 'SYSTEM',
              createdAt: comment.created_at ? new Date(comment.created_at) : undefined
            }
          });
        }

        // Import custom field values as FormResponses
        if (zendeskTicket.custom_fields && zendeskTicket.custom_fields.length > 0) {
          const responsesCreated = await createFormResponses(
            ticket.id,
            zendeskTicket.custom_fields,
            customFieldMap
          );
          createdResponsesCount += responsesCreated;
        }

        importedCount++;
      } catch (error: any) {
        console.error(`Error importing ticket ${zendeskTicket.id}:`, error);
        errors.push(`Ticket ${zendeskTicket.id}: ${error.message}`);
        skippedCount++;
      }
    }

    return res.json({
      success: true,
      imported: importedCount,
      duplicates: duplicateCount,
      skipped: skippedCount,
      usersCreated: createdUsersCount,
      customFieldsCreated: createdFieldsCount,
      formResponsesCreated: createdResponsesCount,
      errors: errors.length > 0 ? errors.slice(0, 10) : undefined // Return max 10 errors
    });

  } catch (error: any) {
    console.error('Error importing Zendesk data:', error);
    return res.status(500).json({
      error: 'Failed to import Zendesk data',
      details: error.message
    });
  }
});

// Zendesk user data interface
interface ZendeskUserImport {
  id: number;
  email: string;
  name?: string;
  role: string;
  created_at?: string;
  last_login_at?: string;
  time_zone?: string;
  iana_time_zone?: string;
}

// Convert IANA timezone to UTC offset string
const getTimezoneOffset = (ianaTimezone?: string): string | null => {
  if (!ianaTimezone) return null;

  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: ianaTimezone,
      timeZoneName: 'shortOffset'
    });
    const parts = formatter.formatToParts(now);
    const offsetPart = parts.find(p => p.type === 'timeZoneName');
    return offsetPart?.value || ianaTimezone;
  } catch {
    return ianaTimezone; // Return original if conversion fails
  }
};

// Map Zendesk role to our UserRole
const mapUserRole = (zendeskRole: string): UserRole => {
  const roleMap: Record<string, UserRole> = {
    'admin': UserRole.ADMIN,
    'agent': UserRole.AGENT,
    'end-user': UserRole.USER
  };
  return roleMap[zendeskRole.toLowerCase()] || UserRole.USER;
};

// Import users from Zendesk JSON export
router.post('/import-users', requireAuth, requireAdmin, upload.single('file'), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const fileContent = req.file.buffer.toString().trim();

    // Parse JSON - handle JSONL format (one user per line) or array
    let users: ZendeskUserImport[];

    try {
      const jsonData = JSON.parse(fileContent);
      if (Array.isArray(jsonData)) {
        users = jsonData;
      } else if (jsonData.users && Array.isArray(jsonData.users)) {
        users = jsonData.users;
      } else if (jsonData.id && jsonData.email) {
        users = [jsonData];
      } else {
        return res.status(400).json({
          error: 'Invalid user export format.'
        });
      }
    } catch {
      // Try JSONL format
      const lines = fileContent.split('\n').filter(line => line.trim());
      users = [];

      for (const line of lines) {
        try {
          const user = JSON.parse(line);
          if (user.id && user.email) {
            users.push(user);
          }
        } catch {
          continue;
        }
      }

      if (users.length === 0) {
        return res.status(400).json({
          error: 'Invalid user export format. Could not parse any users from the file.'
        });
      }
    }

    let importedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    const errors: string[] = [];

    for (const zendeskUser of users) {
      try {
        if (!zendeskUser.email) {
          skippedCount++;
          errors.push(`User ${zendeskUser.id}: No email address`);
          continue;
        }

        // Parse name into first and last
        const { firstName, lastName } = parseName(zendeskUser.name);

        // Get timezone with UTC offset
        const timezone = getTimezoneOffset(zendeskUser.iana_time_zone);

        // Check if user already exists by email
        const existingUser = await prisma.user.findUnique({
          where: { email: zendeskUser.email }
        });

        if (existingUser) {
          // Update existing user - only fill in missing fields
          await prisma.user.update({
            where: { email: zendeskUser.email },
            data: {
              firstName: existingUser.firstName || firstName,
              lastName: existingUser.lastName || lastName,
              timezone: existingUser.timezone || timezone,
              lastSeenAt: existingUser.lastSeenAt || (zendeskUser.last_login_at ? new Date(zendeskUser.last_login_at) : undefined)
            }
          });
          updatedCount++;
          continue;
        }

        // Check if we already have a zendesk-import user for this ID
        const importClerkId = `zendesk-import-${zendeskUser.id}`;
        const existingImportedUser = await prisma.user.findUnique({
          where: { clerkId: importClerkId }
        });

        if (existingImportedUser) {
          // Update existing imported user - only fill in missing fields
          await prisma.user.update({
            where: { clerkId: importClerkId },
            data: {
              firstName: existingImportedUser.firstName || firstName,
              lastName: existingImportedUser.lastName || lastName,
              timezone: existingImportedUser.timezone || timezone,
              lastSeenAt: existingImportedUser.lastSeenAt || (zendeskUser.last_login_at ? new Date(zendeskUser.last_login_at) : undefined)
            }
          });
          updatedCount++;
          continue;
        }

        // Create new user
        await prisma.user.create({
          data: {
            clerkId: importClerkId,
            email: zendeskUser.email,
            firstName,
            lastName,
            role: mapUserRole(zendeskUser.role),
            timezone,
            lastSeenAt: zendeskUser.last_login_at ? new Date(zendeskUser.last_login_at) : undefined,
            createdAt: zendeskUser.created_at ? new Date(zendeskUser.created_at) : undefined
          }
        });
        importedCount++;

      } catch (error: any) {
        console.error(`Error importing user ${zendeskUser.id}:`, error);
        errors.push(`User ${zendeskUser.id}: ${error.message}`);
        skippedCount++;
      }
    }

    return res.json({
      success: true,
      imported: importedCount,
      updated: updatedCount,
      skipped: skippedCount,
      errors: errors.length > 0 ? errors.slice(0, 10) : undefined
    });

  } catch (error: any) {
    console.error('Error importing user data:', error);
    return res.status(500).json({
      error: 'Failed to import user data',
      details: error.message
    });
  }
});

// Import ticket fields from Zendesk CSV export
router.post('/import-fields', requireAuth, requireAdmin, uploadCsv.single('file'), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const fileContent = req.file.buffer.toString().trim();
    const lines = fileContent.split('\n').filter(line => line.trim());

    if (lines.length < 2) {
      return res.status(400).json({ error: 'CSV file is empty or has no data rows' });
    }

    // Skip header row
    const dataLines = lines.slice(1);

    let importedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    const errors: string[] = [];

    for (const line of dataLines) {
      try {
        // Parse CSV line (handle commas in quoted fields)
        const match = line.match(/^"?([^",]*)"?,\s*"?([^",]*)"?,\s*"?(\d+)"?,\s*"?([^",]*)"?,\s*"?([^",]*)"?$/);
        if (!match) {
          skippedCount++;
          continue;
        }

        const [, displayName, fieldType, fieldIdStr] = match;
        const zendeskFieldId = BigInt(fieldIdStr.trim());
        const mappedType = mapZendeskFieldType(fieldType.trim());

        // Check if field already exists by zendeskFieldId
        const existingField = await prisma.formFieldLibrary.findFirst({
          where: { zendeskFieldId }
        });

        if (existingField) {
          // Update label and type if needed
          await prisma.formFieldLibrary.update({
            where: { id: existingField.id },
            data: {
              label: displayName.trim(),
              fieldType: mappedType
            }
          });
          updatedCount++;
        } else {
          // Check if there's a placeholder "Zendesk Field {id}" entry
          const placeholderLabel = `Zendesk Field ${zendeskFieldId}`;
          const placeholderField = await prisma.formFieldLibrary.findFirst({
            where: { label: placeholderLabel }
          });

          if (placeholderField) {
            // Update placeholder with real data
            await prisma.formFieldLibrary.update({
              where: { id: placeholderField.id },
              data: {
                label: displayName.trim(),
                fieldType: mappedType,
                zendeskFieldId
              }
            });
            updatedCount++;
          } else {
            // Create new field
            await prisma.formFieldLibrary.create({
              data: {
                label: displayName.trim(),
                fieldType: mappedType,
                required: false,
                zendeskFieldId
              }
            });
            importedCount++;
          }
        }
      } catch (error: any) {
        errors.push(`Line: ${error.message}`);
        skippedCount++;
      }
    }

    return res.json({
      success: true,
      imported: importedCount,
      updated: updatedCount,
      skipped: skippedCount,
      errors: errors.length > 0 ? errors.slice(0, 10) : undefined
    });

  } catch (error: any) {
    console.error('Error importing ticket fields:', error);
    return res.status(500).json({
      error: 'Failed to import ticket fields',
      details: error.message
    });
  }
});

export default router;
