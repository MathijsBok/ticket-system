import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add auth token to requests
api.interceptors.request.use(async (config) => {
  const token = await window.Clerk?.session?.getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Ticket API
export const ticketApi = {
  getAll: (params?: {
    status?: string;
    type?: string;
    assigneeId?: string;
    page?: number;
    limit?: number;
    sortField?: string;
    sortDirection?: string;
    search?: string;
    myRequests?: boolean;
    myAssigned?: boolean;
    unassigned?: boolean;
    solvedAfter?: string;
  }) =>
    api.get('/tickets', { params }),

  getById: (id: string) =>
    api.get(`/tickets/${id}`),

  create: (data: {
    subject: string;
    description: string;
    channel: string;
    priority?: string;
    categoryId?: string;
    formId?: string;
    formResponses?: Array<{ fieldId: string; value: string }>;
  }) =>
    api.post('/tickets', data),

  update: (id: string, data: {
    status?: string;
    priority?: string;
    assigneeId?: string;
    categoryId?: string;
    subject?: string;
    type?: string;
    problemId?: string | null;
  }) =>
    api.patch(`/tickets/${id}`, data),

  bulkUpdate: (data: { ticketIds: string[]; status?: string; assigneeId?: string | null }) =>
    api.patch('/tickets/bulk/update', data),

  bulkDelete: (ticketIds: string[]) =>
    api.delete('/tickets/bulk/delete', { data: { ticketIds } }),

  getStats: () =>
    api.get('/tickets/stats/overview'),

  merge: (data: { sourceTicketIds: string[]; targetTicketId: string; mergeComment?: string }) =>
    api.post('/tickets/merge', data),

  getMergeCandidates: (ticketId: string) =>
    api.get(`/tickets/merge-candidates/${ticketId}`),

  searchProblems: (query?: string, excludeId?: string) =>
    api.get('/tickets/problems/search', { params: { q: query, excludeId } }),

  markAsScam: (id: string) =>
    api.post(`/tickets/${id}/mark-scam`),

  generateSummary: (ticketId: string) =>
    api.post(`/tickets/${ticketId}/generate-summary`),

  getSuggestions: (subject: string, description: string, formId?: string) =>
    api.get('/tickets/suggestions', { params: { subject, description, formId } })
};

// Comment API
export const commentApi = {
  create: (data: {
    ticketId: string;
    body: string;
    bodyPlain: string;
    isInternal?: boolean;
    mentionedUserIds?: string[];
  }) =>
    api.post('/comments', data),

  getByTicket: (ticketId: string) =>
    api.get(`/comments/ticket/${ticketId}`)
};

// Attachment API
export const attachmentApi = {
  upload: (file: File, ticketId: string, commentId?: string) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('ticketId', ticketId);
    if (commentId) formData.append('commentId', commentId);

    return api.post('/attachments/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
  },

  download: (id: string) =>
    api.get(`/attachments/${id}/download`, {
      responseType: 'blob'
    })
};

// Field Library API
export const fieldLibraryApi = {
  getAll: () =>
    api.get('/fields'),

  getById: (id: string) =>
    api.get(`/fields/${id}`),

  create: (data: {
    label: string;
    fieldType: 'text' | 'textarea' | 'select' | 'checkbox' | 'radio';
    required?: boolean;
    options?: string[];
    placeholder?: string;
    defaultValue?: string;
  }) =>
    api.post('/fields', data),

  update: (id: string, data: {
    label?: string;
    fieldType?: 'text' | 'textarea' | 'select' | 'checkbox' | 'radio';
    required?: boolean;
    options?: string[];
    placeholder?: string;
    defaultValue?: string;
  }) =>
    api.patch(`/fields/${id}`, data),

  delete: (id: string) =>
    api.delete(`/fields/${id}`)
};

// Form API
export const formApi = {
  getAll: () =>
    api.get('/forms'),

  getById: (id: string) =>
    api.get(`/forms/${id}`),

  create: (data: {
    name: string;
    description?: string;
    fields?: Array<{ fieldId: string; required: boolean }>;
    isActive?: boolean;
  }) =>
    api.post('/forms', data),

  update: (id: string, data: {
    name?: string;
    description?: string;
    fields?: Array<{ fieldId: string; required: boolean }>;
    isActive?: boolean;
  }) =>
    api.patch(`/forms/${id}`, data),

  reorder: (formIds: string[]) =>
    api.patch('/forms/reorder', { formIds }),

  delete: (id: string) =>
    api.delete(`/forms/${id}`)
};

// Analytics API
export const analyticsApi = {
  getAgentStats: () =>
    api.get('/analytics/agents'),

  getSystemStats: () =>
    api.get('/analytics/system'),

  getDashboard: () =>
    api.get('/analytics/dashboard'),

  getSolvedByMonth: (year?: number) =>
    api.get('/analytics/solved-by-month', {
      params: { year }
    }),

  getCountriesByYear: (year?: number) =>
    api.get('/analytics/countries-by-year', {
      params: { year }
    }),

  getFormsByYear: (year?: number) =>
    api.get('/analytics/forms-by-year', {
      params: { year }
    }),

  backfillCountries: () =>
    api.post('/analytics/backfill-countries'),

  backfillForms: () =>
    api.post('/analytics/backfill-forms'),

  getAgentSessions: (agentId: string, limit?: number) =>
    api.get(`/analytics/agents/${agentId}/sessions`, {
      params: { limit }
    }),

  getBacklogHistory: () =>
    api.get('/analytics/backlog-history'),

  backfillBacklog: (days?: number) =>
    api.post('/analytics/backfill-backlog', { days: days || 90 }),

  importBacklog: (snapshots: Array<{ date: string; new: number; open: number; pending: number; hold: number }>) =>
    api.post('/analytics/import-backlog', { snapshots }),

  getChannelByYear: (year?: number) =>
    api.get('/analytics/channel-by-year', {
      params: { year }
    }),

  getPriorityByYear: (year?: number) =>
    api.get('/analytics/priority-by-year', {
      params: { year }
    }),

  getWeekdayByYear: (year?: number) =>
    api.get('/analytics/weekday-by-year', {
      params: { year }
    }),

  getHourlyByYear: (year?: number) =>
    api.get('/analytics/hourly-by-year', {
      params: { year }
    })
};

// Session API
export const sessionApi = {
  start: (data: { ipAddress?: string; userAgent?: string }) =>
    api.post('/sessions/start', data),

  end: (sessionId: string) =>
    api.post(`/sessions/end/${sessionId}`),

  getCurrent: () =>
    api.get('/sessions/current'),

  cleanupOld: () =>
    api.post('/sessions/cleanup-old')
};

// Time Tracking API
export const timeTrackingApi = {
  start: (data: { ticketId: string; description?: string }) =>
    api.post('/time-tracking/start', data),

  stop: (entryId: string) =>
    api.post(`/time-tracking/stop/${entryId}`),

  getByTicket: (ticketId: string) =>
    api.get(`/time-tracking/ticket/${ticketId}`),

  getActive: (ticketId: string) =>
    api.get(`/time-tracking/active/${ticketId}`)
};

// Admin Analytics API
export const adminAnalyticsApi = {
  getTicketContributions: () =>
    api.get('/admin-analytics/ticket-contributions'),

  getAgentPerformance: (year?: number) =>
    api.get('/admin-analytics/agent-performance', { params: { year } }),

  recalculateAgentPerformance: () =>
    api.post('/admin-analytics/recalculate-agent-performance')
};

// User API
export const userApi = {
  getMe: () =>
    api.get('/users/me'),

  getAgents: () =>
    api.get('/users/agents'),

  searchAgents: (query: string) =>
    api.get('/users/agents/search', { params: { q: query } }),

  searchUsers: (query: string) =>
    api.get('/users/search', { params: { q: query } }),

  getAll: () =>
    api.get('/users'),

  update: (id: string, data: {
    email?: string;
    firstName?: string;
    lastName?: string;
    role?: 'USER' | 'AGENT' | 'ADMIN';
  }) =>
    api.patch(`/users/${id}`, data),

  updateRole: (id: string, role: 'USER' | 'AGENT' | 'ADMIN') =>
    api.patch(`/users/${id}/role`, { role }),

  block: (id: string, isBlocked: boolean, reason?: string) =>
    api.patch(`/users/${id}/block`, { isBlocked, reason }),

  delete: (id: string) =>
    api.delete(`/users/${id}`)
};

// Settings API
export const settingsApi = {
  get: () =>
    api.get('/settings'),

  update: (id: string, data: any) =>
    api.patch(`/settings/${id}`, data),

  getAIStatus: () =>
    api.get('/settings/ai-status'),

  getAgentPermissions: () =>
    api.get('/settings/agent-permissions'),

  refreshKnowledgeCache: () =>
    api.post('/settings/refresh-knowledge-cache')
};

// Zendesk Import API
export const zendeskApi = {
  import: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);

    return api.post('/zendesk/import', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      },
      timeout: 600000 // 10 minutes for large imports
    });
  },
  importUsers: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);

    return api.post('/zendesk/import-users', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      },
      timeout: 300000 // 5 minutes for user imports
    });
  },
  resetTicketSequence: () =>
    api.post('/zendesk/reset-ticket-sequence')
};

// Macro API
export const macroApi = {
  getAll: (category?: string) =>
    api.get('/macros', { params: category ? { category } : {} }),

  getById: (id: string) =>
    api.get(`/macros/${id}`),

  create: (data: {
    name: string;
    content: string;
    category?: string;
  }) =>
    api.post('/macros', data),

  update: (id: string, data: {
    name?: string;
    content?: string;
    category?: string;
    isActive?: boolean;
  }) =>
    api.patch(`/macros/${id}`, data),

  reorder: (macroIds: string[]) =>
    api.patch('/macros/reorder', { macroIds }),

  delete: (id: string) =>
    api.delete(`/macros/${id}`),

  import: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);

    return api.post('/macros/import', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      },
      timeout: 300000 // 5 minutes for imports
    });
  }
};

// Email Template API
export const emailTemplateApi = {
  getAll: () =>
    api.get('/email-templates'),

  getById: (id: string) =>
    api.get(`/email-templates/${id}`),

  update: (id: string, data: {
    subject?: string;
    bodyHtml?: string;
    bodyPlain?: string;
    isActive?: boolean;
  }) =>
    api.patch(`/email-templates/${id}`, data),

  preview: (id: string) =>
    api.post(`/email-templates/${id}/preview`),

  reset: (id: string) =>
    api.post(`/email-templates/${id}/reset`),

  resetAll: () =>
    api.post('/email-templates/reset-all'),

  sendTest: (id: string, email: string) =>
    api.post(`/email-templates/${id}/send-test`, { email })
};

// Notification API
export const notificationApi = {
  getAll: () =>
    api.get('/notifications'),

  getUnreadCount: () =>
    api.get('/notifications/unread-count'),

  markAsRead: (id: string) =>
    api.patch(`/notifications/${id}/read`),

  markAllAsRead: () =>
    api.patch('/notifications/read-all'),

  delete: (id: string) =>
    api.delete(`/notifications/${id}`)
};

// Bug API
export const bugApi = {
  getAll: () =>
    api.get('/bugs'),

  create: (data: { title: string; description: string; type: 'TECHNICAL' | 'VISUAL'; attachments?: File[] }) => {
    const formData = new FormData();
    formData.append('title', data.title);
    formData.append('description', data.description);
    formData.append('type', data.type);
    if (data.attachments) {
      data.attachments.forEach(file => {
        formData.append('attachments', file);
      });
    }
    return api.post('/bugs', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },

  solve: (id: string) =>
    api.patch(`/bugs/${id}/solve`),

  reopen: (id: string) =>
    api.patch(`/bugs/${id}/reopen`),

  delete: (id: string) =>
    api.delete(`/bugs/${id}`),

  viewAttachment: (id: string) =>
    `${API_URL}/bugs/attachments/${id}/view`,

  downloadAttachment: (id: string) =>
    `${API_URL}/bugs/attachments/${id}/download`
};

// Export API
export const exportApi = {
  analyticsPdf: () =>
    api.get('/export/analytics/pdf', {
      responseType: 'blob'
    }),

  ticketsJson: (startDate?: string, endDate?: string) =>
    api.get('/export/tickets/json', {
      params: { startDate, endDate },
      responseType: 'blob'
    }),

  usersJson: (startDate?: string, endDate?: string) =>
    api.get('/export/users/json', {
      params: { startDate, endDate },
      responseType: 'blob'
    })
};

// API Key API
export const apiKeyApi = {
  getAll: () =>
    api.get('/api-keys'),

  getForms: () =>
    api.get('/api-keys/forms'),

  create: (data: { name: string; description?: string; formId?: string }) =>
    api.post('/api-keys', data),

  revoke: (id: string) =>
    api.patch(`/api-keys/${id}/revoke`),

  delete: (id: string) =>
    api.delete(`/api-keys/${id}`)
};

// AI Analytics API
export const aiAnalyticsApi = {
  // For agents - summary events on ticket detail page
  recordEvent: (data: {
    ticketId?: string;
    eventType: 'SUMMARY_GENERATED' | 'SUMMARY_REGENERATED';
    formId?: string
  }) =>
    api.post('/ai-summary-analytics/event', data),

  // For users - suggestion feedback on create ticket page
  recordSuggestionFeedback: (data: {
    eventType: 'SUGGESTION_SHOWN' | 'SUGGESTION_HELPFUL' | 'SUGGESTION_NOT_HELPFUL';
    formId?: string
  }) =>
    api.post('/ai-summary-analytics/suggestion-feedback', data),

  getStats: (year?: number) =>
    api.get('/ai-summary-analytics/stats', { params: { year } }),

  // Backfill AI summary analytics from existing tickets
  backfillSummaries: () =>
    api.post('/ai-summary-analytics/backfill-summaries')
};

// Keep old name as alias for backwards compatibility
export const aiSummaryAnalyticsApi = aiAnalyticsApi;

// Chat Widget API
export const chatApi = {
  getSettings: () =>
    api.get('/chat/settings'),

  sendMessage: (data: { message: string; sessionId?: string }) =>
    api.post('/chat', data),

  getMessages: (sessionId: string) =>
    api.get(`/chat/sessions/${sessionId}/messages`),

  endSession: (sessionId: string, resolved: boolean) =>
    api.post(`/chat/sessions/${sessionId}/end`, { resolved }),

  giveFeedback: (sessionId: string, messageId: string, wasHelpful: boolean) =>
    api.post(`/chat/sessions/${sessionId}/feedback`, { messageId, wasHelpful }),

  regenerateResponse: (sessionId: string, messageId: string) =>
    api.post(`/chat/sessions/${sessionId}/regenerate`, { messageId }),

  // Admin endpoints
  getSessions: (params?: { status?: string; page?: number; limit?: number }) =>
    api.get('/chat/sessions', { params }),

  getSession: (id: string) =>
    api.get(`/chat/sessions/${id}`)
};

// Database API (admin only)
export const databaseApi = {
  import: (file: File, confirmImport: string) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('confirmImport', confirmImport);
    return api.post('/database/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 600000 // 10 minute timeout for large imports
    });
  },

  export: (format: 'dump' | 'sql' = 'dump') =>
    api.get(`/database/export${format === 'sql' ? '?format=sql' : ''}`, {
      responseType: 'blob',
      timeout: 600000 // 10 minute timeout for large exports
    })
};

// Feedback API
export const feedbackApi = {
  getAll: (year?: number) =>
    api.get('/feedback', { params: year ? { year } : {} })
};
