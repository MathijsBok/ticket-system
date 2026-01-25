export type UserRole = 'USER' | 'AGENT' | 'ADMIN';

export type TicketStatus = 'NEW' | 'OPEN' | 'PENDING' | 'ON_HOLD' | 'SOLVED' | 'CLOSED';

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
  createdAt: string;
  updatedAt: string;
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
  closedAt?: string;
  createdAt: string;
  updatedAt: string;
  requester: User;
  assignee?: User;
  comments?: Comment[];
  attachments?: Attachment[];
  activities?: TicketActivity[];
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

export interface Form {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  fields: FormField[];
  createdAt: string;
  updatedAt: string;
}

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
    closed: number;
  };
}
