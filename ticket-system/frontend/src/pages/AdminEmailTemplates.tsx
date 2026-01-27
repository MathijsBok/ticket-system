import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { emailTemplateApi } from '../lib/api';
import Layout from '../components/Layout';
import toast from 'react-hot-toast';
import { EmailTemplate, EmailPreview } from '../types';

const templateDescriptions: Record<string, string> = {
  TICKET_CREATED: 'Sent to the user when they create a new support ticket',
  NEW_REPLY: 'Sent to the user when an agent replies to their ticket',
  TICKET_RESOLVED: 'Sent to the user when their ticket is marked as resolved',
  PENDING_REMINDER_24H: 'Sent after 24 hours if the user hasn\'t responded to an agent\'s reply',
  PENDING_REMINDER_48H: 'Final reminder sent after 48 hours before auto-resolve'
};

const placeholderInfo = [
  { placeholder: '{{userName}}', description: 'The name of the ticket requester' },
  { placeholder: '{{ticketNumber}}', description: 'The ticket number (e.g., 12345)' },
  { placeholder: '{{ticketSubject}}', description: 'The subject line of the ticket' },
  { placeholder: '{{ticketUrl}}', description: 'Direct link to view the ticket' },
  { placeholder: '{{agentName}}', description: 'The name of the assigned agent' }
];

const AdminEmailTemplates: React.FC = () => {
  const queryClient = useQueryClient();
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const [previewData, setPreviewData] = useState<EmailPreview | null>(null);
  const [showPlaceholders, setShowPlaceholders] = useState(true);
  const [formData, setFormData] = useState({
    subject: '',
    bodyHtml: '',
    bodyPlain: ''
  });

  const { data: templates, isLoading } = useQuery({
    queryKey: ['emailTemplates'],
    queryFn: async () => {
      const response = await emailTemplateApi.getAll();
      return response.data as EmailTemplate[];
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { subject?: string; bodyHtml?: string; bodyPlain?: string; isActive?: boolean } }) =>
      emailTemplateApi.update(id, data),
    onSuccess: () => {
      toast.success('Template updated successfully');
      queryClient.invalidateQueries({ queryKey: ['emailTemplates'] });
      setEditingTemplate(null);
    },
    onError: () => {
      toast.error('Failed to update template');
    }
  });

  const previewMutation = useMutation({
    mutationFn: (id: string) => emailTemplateApi.preview(id),
    onSuccess: (response) => {
      setPreviewData(response.data as EmailPreview);
    },
    onError: () => {
      toast.error('Failed to generate preview');
    }
  });

  const resetMutation = useMutation({
    mutationFn: (id: string) => emailTemplateApi.reset(id),
    onSuccess: () => {
      toast.success('Template reset to default');
      queryClient.invalidateQueries({ queryKey: ['emailTemplates'] });
      setEditingTemplate(null);
    },
    onError: () => {
      toast.error('Failed to reset template');
    }
  });

  const handleEdit = (template: EmailTemplate) => {
    setEditingTemplate(template);
    setFormData({
      subject: template.subject,
      bodyHtml: template.bodyHtml,
      bodyPlain: template.bodyPlain
    });
    setPreviewData(null);
  };

  const handleSave = () => {
    if (!editingTemplate) return;
    updateMutation.mutate({
      id: editingTemplate.id,
      data: formData
    });
  };

  const handleToggleActive = (template: EmailTemplate) => {
    updateMutation.mutate({
      id: template.id,
      data: { isActive: !template.isActive }
    });
  };

  const handlePreview = () => {
    if (!editingTemplate) return;
    // Save first, then preview
    updateMutation.mutate(
      { id: editingTemplate.id, data: formData },
      {
        onSuccess: () => {
          previewMutation.mutate(editingTemplate.id);
        }
      }
    );
  };

  const handleReset = () => {
    if (!editingTemplate) return;
    if (window.confirm('Are you sure you want to reset this template to the default? This cannot be undone.')) {
      resetMutation.mutate(editingTemplate.id);
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Email Templates</h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Customize the email notifications sent to users
          </p>
        </div>

        {/* Placeholders Reference */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <button
            onClick={() => setShowPlaceholders(!showPlaceholders)}
            className="flex items-center justify-between w-full text-left"
          >
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="font-medium text-blue-800 dark:text-blue-200">Available Placeholders</span>
            </div>
            <svg
              className={`w-5 h-5 text-blue-600 dark:text-blue-400 transition-transform ${showPlaceholders ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {showPlaceholders && (
            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {placeholderInfo.map(({ placeholder, description }) => (
                <div key={placeholder} className="flex items-start gap-2">
                  <code className="px-2 py-1 bg-blue-100 dark:bg-blue-800 text-blue-800 dark:text-blue-200 rounded text-sm font-mono">
                    {placeholder}
                  </code>
                  <span className="text-sm text-blue-700 dark:text-blue-300">{description}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Edit Modal/Panel */}
        {editingTemplate && (
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Edit: {editingTemplate.name}
              </h2>
              <button
                onClick={() => setEditingTemplate(null)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Subject Line
                </label>
                <input
                  type="text"
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  HTML Body
                </label>
                <textarea
                  value={formData.bodyHtml}
                  onChange={(e) => setFormData({ ...formData, bodyHtml: e.target.value })}
                  rows={10}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent font-mono text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Plain Text Body
                </label>
                <textarea
                  value={formData.bodyPlain}
                  onChange={(e) => setFormData({ ...formData, bodyPlain: e.target.value })}
                  rows={6}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent font-mono text-sm"
                />
              </div>

              <div className="flex justify-between">
                <button
                  onClick={handleReset}
                  disabled={resetMutation.isPending}
                  className="px-4 py-2 text-sm font-medium text-orange-600 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-md hover:bg-orange-100 dark:hover:bg-orange-900/30 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500"
                >
                  Reset to Default
                </button>
                <div className="flex gap-3">
                  <button
                    onClick={handlePreview}
                    disabled={previewMutation.isPending || updateMutation.isPending}
                    className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
                  >
                    {previewMutation.isPending ? 'Loading...' : 'Preview'}
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={updateMutation.isPending}
                    className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-md hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50"
                  >
                    {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </div>

            {/* Preview Panel */}
            {previewData && (
              <div className="mt-6 border-t border-gray-200 dark:border-gray-700 pt-6">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Preview</h3>
                <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 space-y-4">
                  <div>
                    <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Subject:</span>
                    <p className="text-gray-900 dark:text-white">{previewData.subject}</p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-500 dark:text-gray-400">HTML Preview:</span>
                    <div
                      className="mt-2 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 p-4"
                      dangerouslySetInnerHTML={{ __html: previewData.bodyHtml }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Templates List */}
        {isLoading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <p className="mt-2 text-gray-600 dark:text-gray-400">Loading templates...</p>
          </div>
        ) : templates && templates.length > 0 ? (
          <div className="grid gap-4">
            {templates.map((template) => (
              <div
                key={template.id}
                className={`bg-white dark:bg-gray-800 rounded-lg border ${
                  template.isActive
                    ? 'border-gray-200 dark:border-gray-700'
                    : 'border-gray-200 dark:border-gray-700 opacity-60'
                } p-4`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                        {template.name}
                      </h3>
                      {!template.isActive && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
                          Inactive
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                      {templateDescriptions[template.type]}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      <span className="font-medium">Subject:</span> {template.subject}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <button
                      onClick={() => handleToggleActive(template)}
                      className={`p-2 rounded-md transition-colors ${
                        template.isActive
                          ? 'text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20'
                          : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                      }`}
                      title={template.isActive ? 'Deactivate' : 'Activate'}
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        {template.isActive ? (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        ) : (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        )}
                      </svg>
                    </button>
                    <button
                      onClick={() => handleEdit(template)}
                      className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md transition-colors"
                      title="Edit"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No email templates</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Email templates will be created automatically.
            </p>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default AdminEmailTemplates;
