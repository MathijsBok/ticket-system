import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { emailTemplateApi } from '../lib/api';
import Layout from '../components/Layout';
import RichTextEditor from '../components/RichTextEditor';
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
  const navigate = useNavigate();
  const { id: urlTemplateId } = useParams<{ id: string }>();

  const [previewData, setPreviewData] = useState<EmailPreview | null>(null);
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
      navigate('/admin/email-templates');
    },
    onError: () => {
      toast.error('Failed to update template');
    }
  });

  const resetMutation = useMutation({
    mutationFn: (id: string) => emailTemplateApi.reset(id),
    onSuccess: () => {
      toast.success('Template reset to default');
      queryClient.invalidateQueries({ queryKey: ['emailTemplates'] });
      navigate('/admin/email-templates');
    },
    onError: () => {
      toast.error('Failed to reset template');
    }
  });

  const handleEdit = (template: EmailTemplate) => {
    // Navigate to the edit URL
    navigate(`/admin/email-templates/${template.id}`);
  };

  // Get the editing template from URL param
  const editingTemplate = urlTemplateId && templates
    ? templates.find(t => t.id === urlTemplateId) || null
    : null;

  // Populate form when editing (URL changes to /admin/email-templates/:id)
  useEffect(() => {
    if (editingTemplate) {
      setFormData({
        subject: editingTemplate.subject,
        bodyHtml: editingTemplate.bodyHtml,
        bodyPlain: editingTemplate.bodyPlain
      });
      setPreviewData(null);
    } else if (!urlTemplateId) {
      // Reset form when back on list view
      setFormData({ subject: '', bodyHtml: '', bodyPlain: '' });
      setPreviewData(null);
    }
  }, [editingTemplate, urlTemplateId]);

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

  // Sample data for client-side preview
  const sampleData: Record<string, string> = {
    userName: 'John Doe',
    ticketNumber: '12345',
    ticketSubject: 'Sample Ticket Subject',
    ticketUrl: 'https://support.example.com/tickets/123',
    agentName: 'Support Agent'
  };

  // Replace placeholders with sample data
  const replacePlaceholders = (template: string): string => {
    let result = template;
    Object.entries(sampleData).forEach(([key, value]) => {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      result = result.replace(regex, value);
    });
    return result;
  };

  const handlePreview = () => {
    if (!editingTemplate) return;
    // Generate preview client-side without saving
    setPreviewData({
      subject: replacePlaceholders(formData.subject),
      bodyHtml: replacePlaceholders(formData.bodyHtml),
      bodyPlain: replacePlaceholders(formData.bodyPlain)
    });
  };

  const handleReset = (template: EmailTemplate) => {
    if (window.confirm(`Are you sure you want to reset "${template.name}" to the default? This cannot be undone.`)) {
      resetMutation.mutate(template.id);
    }
  };

  // Helper to strip HTML and convert to plain text
  const htmlToPlainText = (html: string): string => {
    // Replace block elements with newlines before stripping HTML
    let text = html
      // Replace closing </p> tags with double newline (paragraph break)
      .replace(/<\/p>/gi, '\n\n')
      // Replace <br> tags with single newline
      .replace(/<br\s*\/?>/gi, '\n')
      // Remove opening <p> tags
      .replace(/<p[^>]*>/gi, '');

    // Strip remaining HTML tags
    const temp = document.createElement('div');
    temp.innerHTML = text;
    text = temp.textContent || temp.innerText || '';

    // Clean up excessive newlines (more than 2 consecutive) and trim
    return text.replace(/\n{3,}/g, '\n\n').trim();
  };

  // Update HTML body and auto-generate plain text
  const handleHtmlChange = (value: string) => {
    const plainText = htmlToPlainText(value);
    setFormData({
      ...formData,
      bodyHtml: value,
      bodyPlain: plainText
    });
  };

  // Insert placeholder into the editor content
  const insertPlaceholder = (placeholder: string) => {
    if (!editingTemplate) {
      toast.error('Please select a template to edit first');
      return;
    }
    let currentContent = formData.bodyHtml;
    if (currentContent.endsWith('</p>')) {
      currentContent = currentContent.slice(0, -4) + placeholder + '</p>';
    } else if (currentContent === '' || currentContent === '<p><br></p>') {
      currentContent = `<p>${placeholder}</p>`;
    } else {
      currentContent = currentContent + placeholder;
    }
    handleHtmlChange(currentContent);
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

        {/* Edit Panel - Full width when editing */}
        {editingTemplate && (
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Edit: {editingTemplate.name}
              </h2>
              <button
                onClick={() => navigate(-1)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              {/* Left: Placeholders */}
              <div className="lg:col-span-1">
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600 p-4 sticky top-4">
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                    Available Placeholders
                  </h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                    Click to insert into the email body
                  </p>
                  <div className="space-y-2">
                    {placeholderInfo.map(({ placeholder, description }) => (
                      <button
                        key={placeholder}
                        type="button"
                        onClick={() => insertPlaceholder(placeholder)}
                        className="w-full text-left p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors group"
                      >
                        <code className="text-xs font-mono text-primary group-hover:text-primary/80">
                          {placeholder}
                        </code>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          {description}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right: Editor */}
              <div className="lg:col-span-3 space-y-4">
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
                    Email Body
                  </label>
                  <RichTextEditor
                    value={formData.bodyHtml}
                    onChange={handleHtmlChange}
                    placeholder="Compose your email template here..."
                    minHeight="250px"
                  />
                  <div className="mt-2 flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md border border-blue-100 dark:border-blue-800">
                    <svg className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-xs text-blue-700 dark:text-blue-300">
                      Email templates are rendered with a white background in email clients. Use the Preview button to see how your email will appear to recipients.
                    </p>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Plain Text Version
                    <span className="ml-2 text-xs font-normal text-gray-500 dark:text-gray-400">(auto-generated)</span>
                  </label>
                  <textarea
                    value={formData.bodyPlain}
                    onChange={(e) => setFormData({ ...formData, bodyPlain: e.target.value })}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent font-mono text-sm"
                    placeholder="Plain text version for email clients that don't support HTML"
                  />
                </div>

                <div className="flex justify-between pt-2">
                  <button
                    onClick={() => handleReset(editingTemplate)}
                    disabled={resetMutation.isPending}
                    className="px-4 py-2 text-sm font-medium text-orange-600 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-md hover:bg-orange-100 dark:hover:bg-orange-900/30 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500"
                  >
                    Reset to Default
                  </button>
                  <div className="flex gap-3">
                    <button
                      onClick={handlePreview}
                      className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
                    >
                      Preview
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

                {/* Preview Panel */}
                {previewData && (
                  <div className="border-t border-gray-200 dark:border-gray-700 pt-6 mt-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-medium text-gray-900 dark:text-white">Email Preview</h3>
                      <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Shown as it appears in email clients
                      </span>
                    </div>
                    <div className="rounded-lg border border-gray-200 dark:border-gray-600 overflow-hidden">
                      {/* Email header simulation */}
                      <div className="bg-gray-100 dark:bg-gray-700 px-4 py-3 border-b border-gray-200 dark:border-gray-600">
                        <div className="flex items-center gap-2 text-sm">
                          <span className="font-medium text-gray-600 dark:text-gray-300">Subject:</span>
                          <span className="text-gray-900 dark:text-white">{previewData.subject}</span>
                        </div>
                      </div>
                      {/* Email body - always white background for accurate email preview */}
                      <style>{`
                        .email-preview-content p { margin: 0; line-height: 1.5; }
                        .email-preview-content p:has(> br:only-child) { min-height: 1.5em; }
                        .email-preview-content p:empty { min-height: 1.5em; }
                      `}</style>
                      <div
                        className="email-preview-content p-4 overflow-auto max-h-[600px] prose prose-sm max-w-none"
                        style={{ minHeight: '200px', backgroundColor: '#ffffff', color: '#1e293b' }}
                        dangerouslySetInnerHTML={{ __html: previewData.bodyHtml }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 2-Column Layout: Placeholders + Templates List */}
        {!editingTemplate && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Left Column: Placeholders */}
            <div className="lg:col-span-1">
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 sticky top-4">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                  <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                  </svg>
                  Available Placeholders
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                  Select a template to edit, then click a placeholder to insert it
                </p>
                <div className="space-y-2">
                  {placeholderInfo.map(({ placeholder, description }) => (
                    <div
                      key={placeholder}
                      className="p-2 rounded-md bg-gray-50 dark:bg-gray-700/50"
                    >
                      <code className="text-xs font-mono text-primary">
                        {placeholder}
                      </code>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {description}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Column: Templates List */}
            <div className="lg:col-span-3">
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
                      onClick={() => handleEdit(template)}
                      className={`bg-white dark:bg-gray-800 rounded-lg border cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 hover:border-primary/50 transition-colors ${
                        template.isActive
                          ? 'border-gray-200 dark:border-gray-700'
                          : 'border-gray-200 dark:border-gray-700 opacity-60'
                      } p-4`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
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
                          <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
                            <span className="font-medium">Subject:</span> {template.subject}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 ml-4" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => handleEdit(template)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md transition-colors"
                            title="Edit"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleToggleActive(template)}
                            className={`p-1.5 rounded-md transition-colors ${
                              template.isActive
                                ? 'text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20'
                                : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                            }`}
                            title={template.isActive ? 'Deactivate' : 'Activate'}
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              {template.isActive ? (
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              ) : (
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              )}
                            </svg>
                          </button>
                          <button
                            onClick={() => handleReset(template)}
                            className="p-1.5 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded-md transition-colors"
                            title="Reset to Default"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
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
          </div>
        )}
      </div>
    </Layout>
  );
};

export default AdminEmailTemplates;
