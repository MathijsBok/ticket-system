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
  }) =>
    api.post('/tickets', data),

  update: (id: string, data: {
    status?: string;
    priority?: string;
    assigneeId?: string;
    categoryId?: string;
  }) =>
    api.patch(`/tickets/${id}`, data),

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

// Form API
export const formApi = {
  getAll: () =>
    api.get('/forms'),

  getById: (id: string) =>
    api.get(`/forms/${id}`),

  create: (data: {
    name: string;
    description?: string;
    fields: any[];
    isActive?: boolean;
  }) =>
    api.post('/forms', data),

  update: (id: string, data: {
    name?: string;
    description?: string;
    fields?: any[];
    isActive?: boolean;
  }) =>
    api.patch(`/forms/${id}`, data),

  delete: (id: string) =>
    api.delete(`/forms/${id}`)
};

// Analytics API
export const analyticsApi = {
  getAgentStats: () =>
    api.get('/analytics/agents'),

  getSystemStats: () =>
    api.get('/analytics/system'),

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
    api.get('/sessions/current')
};
