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
  getAll: (params?: { status?: string; assigneeId?: string }) =>
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
  }) =>
    api.patch(`/tickets/${id}`, data),

  bulkUpdate: (data: { ticketIds: string[]; status?: string }) =>
    api.patch('/tickets/bulk/update', data),

  bulkDelete: (ticketIds: string[]) =>
    api.delete('/tickets/bulk/delete', { data: { ticketIds } }),

  getStats: () =>
    api.get('/tickets/stats/overview')
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

  getAgentSessions: (agentId: string, limit?: number) =>
    api.get(`/analytics/agents/${agentId}/sessions`, {
      params: { limit }
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

  getAgentPerformance: () =>
    api.get('/admin-analytics/agent-performance')
};

// User API
export const userApi = {
  getMe: () =>
    api.get('/users/me'),

  getAgents: () =>
    api.get('/users/agents'),

  searchAgents: (query: string) =>
    api.get('/users/agents/search', { params: { q: query } }),

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
    api.patch(`/settings/${id}`, data)
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
    api.delete(`/macros/${id}`)
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
    api.post(`/email-templates/${id}/reset`)
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

  create: (data: { title: string; description: string }) =>
    api.post('/bugs', data),

  solve: (id: string) =>
    api.patch(`/bugs/${id}/solve`),

  reopen: (id: string) =>
    api.patch(`/bugs/${id}/reopen`),

  delete: (id: string) =>
    api.delete(`/bugs/${id}`)
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
