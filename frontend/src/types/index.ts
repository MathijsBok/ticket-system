export type UserRole = 'USER' | 'AGENT' | 'ADMIN';

export type TicketStatus = 'NEW' | 'OPEN' | 'PENDING' | 'ON_HOLD' | 'SOLVED';

export type TicketPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

export type TicketChannel = 'EMAIL' | 'WEB' | 'API' | 'SLACK' | 'INTERNAL';

export type CommentChannel = 'WEB' | 'EMAIL' | 'SLACK' | 'API' | 'SYSTEM';

export interface User {
  id: string;
  clerkId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role: UserRole;
  organizationId?: string;
  timezone?: string;
  timezoneOffset?: string;
  country?: string;
  lastSeenAt?: string;
  isBlocked?: boolean;
  blockedAt?: string;
  blockedReason?: string;
  createdAt: string;
  updatedAt?: string;
  _count?: {
    ticketsCreated: number;
  };
}

export interface Ticket {
  id: string;
  ticketNumber: number;
  subject: string;
  status: TicketStatus;
  priority: TicketPriority;
  channel: TicketChannel;
  requesterId: string;
  assigneeId?: string;
  organizationId?: string;
  formId?: string;
  categoryId?: string;
  dueAt?: string;
  firstResponseAt?: string;
  solvedAt?: string;
  userAgent?: string;
  ipAddress?: string;
  country?: string;
  createdAt: string;
  updatedAt: string;
  requester: User;
  assignee?: User;
  comments?: Comment[];
  attachments?: Attachment[];
  activities?: TicketActivity[];
  formResponses?: FormResponse[];
  _count?: {
    comments: number;
  };
}

export interface Comment {
  id: string;
  ticketId: string;
  authorId: string;
  body: string;
  bodyPlain: string;
  isInternal: boolean;
  isSystem: boolean;
  channel: CommentChannel;
  createdAt: string;
  updatedAt: string;
  author: User;
  attachments?: Attachment[];
}

export interface Attachment {
  id: string;
  ticketId: string;
  commentId?: string;
  uploaderId: string;
  filename: string;
  filePath: string;
  fileSize: string;
  mimeType: string;
  createdAt: string;
  uploader: User;
}

// Reusable field library entry
export interface FormFieldLibrary {
  id: string;
  label: string;
  fieldType: 'text' | 'textarea' | 'select' | 'checkbox' | 'radio';
  required: boolean;
  options?: string[];
  placeholder?: string;
  defaultValue?: string;
  createdAt: string;
  updatedAt: string;
}

// Junction table linking forms to fields with ordering
export interface FormFieldAssignment {
  id: string;
  formId: string;
  fieldId: string;
  order: number;
  required: boolean;
  field: FormFieldLibrary;
}

// Form response data stored with tickets
export interface FormResponse {
  id: string;
  ticketId: string;
  fieldId: string;
  value: string;
  createdAt: string;
  field: FormFieldLibrary;
}

export interface Form {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  order: number;
  formFields: FormFieldAssignment[];
  createdAt: string;
  updatedAt: string;
}

// Legacy field structure (kept for backward compatibility)
export interface FormField {
  id: string;
  label: string;
  type: 'text' | 'textarea' | 'select' | 'checkbox' | 'radio';
  required: boolean;
  options?: string[];
  placeholder?: string;
  defaultValue?: string;
}

export interface TicketActivity {
  id: string;
  ticketId: string;
  userId?: string;
  action: string;
  details: Record<string, any>;
  createdAt: string;
}

export interface AgentSession {
  id: string;
  agentId: string;
  loginAt: string;
  logoutAt?: string;
  duration?: number;
  replyCount: number;
  ipAddress?: string;
  userAgent?: string;
}

export interface AgentStats {
  agent: {
    id: string;
    email: string;
    name: string;
    role: UserRole;
  };
  sessions: {
    total: number;
    totalDuration: number;
    avgDuration: number;
    lastLogin?: string;
    isOnline: boolean;
  };
  tickets: {
    assigned: number;
    solved: number;
    solveRate: number;
  };
  replies: {
    total: number;
    avgPerSession: number;
  };
}

export interface TicketStats {
  total: number;
  byStatus: {
    new: number;
    open: number;
    pending: number;
    onHold: number;
    solved: number;
  };
}

// Macro - Pre-built reply templates for agents
export interface Macro {
  id: string;
  name: string;
  content: string;
  category?: string;
  isActive: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
}

// Email template types
export type EmailTemplateType =
  | 'TICKET_CREATED'
  | 'NEW_REPLY'
  | 'TICKET_RESOLVED'
  | 'PENDING_REMINDER_24H'
  | 'PENDING_REMINDER_48H';

// Email template for notifications
export interface EmailTemplate {
  id: string;
  type: EmailTemplateType;
  name: string;
  subject: string;
  bodyHtml: string;
  bodyPlain: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// Email preview result
export interface EmailPreview {
  subject: string;
  bodyHtml: string;
  bodyPlain: string;
}

// Notification types
export type NotificationType = 'MENTION' | 'TICKET_ASSIGNED' | 'TICKET_UPDATED' | 'NEW_REPLY' | 'BUG_REPORTED';

// Bug status
export type BugStatus = 'OPEN' | 'SOLVED';

// Bug type
export type BugType = 'TECHNICAL' | 'VISUAL';

// Notification for users
export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  ticketId?: string;
  commentId?: string;
  bugId?: string;
  isRead: boolean;
  readAt?: string;
  createdAt: string;
}

// Agent for mention autocomplete
export interface AgentForMention {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role: UserRole;
}

// Bug attachment
export interface BugAttachment {
  id: string;
  bugId: string;
  filename: string;
  fileSize: string;
  mimeType: string;
  createdAt: string;
}

// Bug report
export interface Bug {
  id: string;
  title: string;
  description: string;
  status: BugStatus;
  type: BugType;
  reportedById: string;
  solvedById?: string;
  createdAt: string;
  solvedAt?: string;
  updatedAt: string;
  reportedBy: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
    role: UserRole;
  };
  solvedBy?: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
    role: UserRole;
  };
  attachments?: BugAttachment[];
}
