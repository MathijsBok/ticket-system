import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useUser } from '@clerk/clerk-react';
import { useView } from '../contexts/ViewContext';
import toast from 'react-hot-toast';
import { ticketApi, formApi, attachmentApi } from '../lib/api';
import Layout from '../components/Layout';
import FormRenderer from '../components/FormRenderer';
import { Form } from '../types';

const CreateTicket: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useUser();
  const userRole = (user?.publicMetadata?.role as string) || 'USER';
  const { currentView } = useView();
  const effectiveRole = userRole === 'ADMIN' ? currentView : userRole;
  const isAgentOrAdmin = effectiveRole === 'AGENT' || effectiveRole === 'ADMIN';
  const relatedTicketId = searchParams.get('relatedTicketId');
  const [priority, setPriority] = useState('NORMAL');
  const [categoryId, _setCategoryId] = useState('');
  const [selectedFormId, setSelectedFormId] = useState<string | null>(null);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  // Allowed file types
  const ALLOWED_EXTENSIONS = '.png,.jpg,.jpeg,.gif,.webp,.bmp,.svg,.mp4,.webm,.mov,.avi';
  const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp', 'image/bmp', 'image/svg+xml', 'video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo'];

  // Fetch available forms
  const { data: forms } = useQuery({
    queryKey: ['forms'],
    queryFn: async () => {
      const response = await formApi.getAll();
      return response.data as Form[];
    }
  });

  // Fetch selected form details
  const { data: selectedForm } = useQuery({
    queryKey: ['form', selectedFormId],
    queryFn: async () => {
      if (!selectedFormId) return null;
      const response = await formApi.getById(selectedFormId);
      return response.data as Form;
    },
    enabled: !!selectedFormId
  });

  // Fetch related ticket if creating a follow-up
  const { data: relatedTicket } = useQuery({
    queryKey: ['relatedTicket', relatedTicketId],
    queryFn: async () => {
      if (!relatedTicketId) return null;
      const response = await ticketApi.getById(relatedTicketId);
      return response.data;
    },
    enabled: !!relatedTicketId
  });

  // Auto-fill subject when related ticket is loaded
  useEffect(() => {
    if (relatedTicket && selectedForm) {
      const subjectField = selectedForm.formFields?.find(ff =>
        ff.field.label.toLowerCase() === 'subject'
      );
      if (subjectField && !formValues[subjectField.fieldId]) {
        setFormValues(prev => ({
          ...prev,
          [subjectField.fieldId]: `Follow-up: ${relatedTicket.subject}`
        }));
      }
    }
  }, [relatedTicket, selectedForm, formValues]);

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await ticketApi.create(data);
      return response.data;
    },
    onSuccess: async (data) => {
      // Upload attachments if any
      if (selectedFiles.length > 0) {
        setIsUploading(true);
        try {
          for (const file of selectedFiles) {
            await attachmentApi.upload(file, data.id);
          }
          toast.success('Ticket created with attachments!');
        } catch (error) {
          console.error('Failed to upload some attachments:', error);
          toast.success('Ticket created, but some attachments failed to upload');
        } finally {
          setIsUploading(false);
        }
      } else {
        toast.success('Ticket created successfully!');
      }
      navigate(`/tickets/${data.id}`);
    },
    onError: () => {
      toast.error('Failed to create ticket');
    }
  });

  const handleFormFieldChange = (fieldId: string, value: string) => {
    setFormValues(prev => ({ ...prev, [fieldId]: value }));
    // Clear error for this field when user starts typing
    if (formErrors[fieldId]) {
      setFormErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[fieldId];
        return newErrors;
      });
    }
  };

  const validateFormFields = (): boolean => {
    if (!selectedForm) return true;

    const errors: Record<string, string> = {};
    let isValid = true;

    selectedForm.formFields?.forEach(fieldAssignment => {
      const { field, required } = fieldAssignment;
      const value = formValues[field.id];

      if (required && (!value || value.trim() === '')) {
        errors[field.id] = `${field.label} is required`;
        isValid = false;
      }
    });

    setFormErrors(errors);
    return isValid;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Require form selection
    if (!selectedFormId) {
      toast.error('Please select a form to continue');
      return;
    }

    // Validate form fields
    if (!validateFormFields()) {
      toast.error('Please fill in all required form fields');
      return;
    }

    // Find Subject and Description from form fields
    const subjectField = selectedForm?.formFields?.find(ff =>
      ff.field.label.toLowerCase() === 'subject'
    );
    const descriptionField = selectedForm?.formFields?.find(ff =>
      ff.field.label.toLowerCase() === 'description'
    );

    const subject = subjectField ? formValues[subjectField.fieldId] : '';
    const description = descriptionField ? formValues[descriptionField.fieldId] : '';

    // Prepare form responses if a form is selected
    const formResponses = selectedFormId && selectedForm
      ? selectedForm.formFields?.map(fieldAssignment => ({
          fieldId: fieldAssignment.fieldId,
          value: formValues[fieldAssignment.fieldId] || ''
        })).filter(response => response.value) // Only include non-empty values
      : undefined;

    createMutation.mutate({
      subject: subject || 'No subject provided',
      description: description || 'No description provided',
      channel: 'WEB',
      priority,
      categoryId: categoryId || undefined,
      formId: selectedFormId || undefined,
      formResponses,
      relatedTicketId: relatedTicketId || undefined
    });
  };

  const handleFormSelection = (formId: string) => {
    if (formId === '') {
      setSelectedFormId(null);
      setFormValues({});
      setFormErrors({});
    } else {
      setSelectedFormId(formId);
      setFormValues({});
      setFormErrors({});
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const validFiles = files.filter(file => ALLOWED_TYPES.includes(file.type));

    if (validFiles.length !== files.length) {
      toast.error('Some files were rejected. Only images and videos are allowed.');
    }

    setSelectedFiles(prev => [...prev, ...validFiles]);
    e.target.value = ''; // Reset input to allow re-selecting same file
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <Layout>
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Create New Ticket</h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Submit a support request and our team will get back to you.
          </p>
        </div>

        {/* Related Ticket Info */}
        {relatedTicket && (
          <div className="mb-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-300 mb-1">
                  Creating Follow-up Ticket
                </h3>
                <p className="text-sm text-blue-800 dark:text-blue-300">
                  This ticket will be created as a follow-up to:{' '}
                  <Link
                    to={`/tickets/${relatedTicket.id}`}
                    className="font-medium underline hover:no-underline"
                  >
                    #{relatedTicket.ticketNumber} - {relatedTicket.subject}
                  </Link>
                </p>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Form Selection - REQUIRED */}
          {forms && forms.length > 0 && (
            <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Select Request Type <span className="text-red-500">*</span>
              </h2>
              <div>
                <label htmlFor="formId" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Please select the type of request you want to submit
                </label>
                <select
                  id="formId"
                  value={selectedFormId || ''}
                  onChange={(e) => handleFormSelection(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  required
                >
                  <option value="">-- Select a form --</option>
                  {forms.map((form) => (
                    <option key={form.id} value={form.id}>
                      {form.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Important Support Information - Only show when no form is selected */}
          {!selectedFormId && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-400 dark:border-yellow-600 p-6 rounded-r-lg shadow-sm">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <svg className="h-6 w-6 text-yellow-600 dark:text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div className="ml-4 flex-1">
                  <h3 className="text-lg font-semibold text-yellow-800 dark:text-yellow-200 mb-3">
                    ⚠️ Important Support Information
                  </h3>
                  <div className="text-sm text-yellow-700 dark:text-yellow-300 space-y-3">
                    <p>
                      Please note that we can only assist with issues directly related to <strong>Klever Wallet</strong> and <strong>Klever Exchange</strong>.
                      Requests submitted under the correct category will be processed faster.
                    </p>

                    <div>
                      <p className="font-semibold mb-1">⏱ Processing Time</p>
                      <p>Requests are generally processed within 1–12 hours.</p>
                    </div>

                    <div>
                      <p className="font-semibold mb-1">🏷 Request Category</p>
                      <p>If your request is related to the <strong>EXCHANGE</strong> or <strong>WALLET</strong>, please clearly mention this in your message.</p>
                    </div>

                    <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-md p-3 mt-3">
                      <p className="font-semibold text-red-800 dark:text-red-200 mb-2">🔐 Security Notice</p>
                      <p className="text-red-700 dark:text-red-300 mb-2">KLEVER will NEVER ask you to:</p>
                      <ul className="list-disc list-inside space-y-1 text-red-700 dark:text-red-300 ml-2">
                        <li>Transfer funds to any address</li>
                        <li>Share private information of any kind</li>
                      </ul>
                      <p className="text-red-700 dark:text-red-300 mt-2 font-medium">If anyone asks you to do so, this is a scam.</p>

                      <p className="font-semibold text-red-800 dark:text-red-200 mt-3 mb-1">🚫 Never Share:</p>
                      <ul className="list-disc list-inside space-y-1 text-red-700 dark:text-red-300 ml-2">
                        <li>Your private key</li>
                        <li>Your mnemonic / recovery phrase</li>
                        <li>Any other sensitive personal information</li>
                      </ul>
                    </div>

                    <div>
                      <p className="font-semibold mb-1">🌍 Supported Languages</p>
                      <p>English (fastest support), German, Hindi, Persian, Dutch</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Show form description and fields if a form is selected */}
          {selectedForm && (
            <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg border border-gray-200 dark:border-gray-700 p-6">
              {selectedForm.description && (
                <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    {selectedForm.description}
                  </p>
                </div>
              )}

              {selectedForm.formFields && selectedForm.formFields.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    Request Details
                  </h3>
                  <FormRenderer
                    fields={selectedForm.formFields.sort((a, b) => a.order - b.order)}
                    values={formValues}
                    onChange={handleFormFieldChange}
                    errors={formErrors}
                  />
                </div>
              )}
            </div>
          )}

          {/* Attachments Section */}
          {selectedFormId && (
            <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Attachments
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Add images or videos (optional)
                  </label>
                  <div className="flex items-center justify-center w-full">
                    <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:hover:border-gray-500">
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <svg className="w-8 h-8 mb-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                        <p className="mb-2 text-sm text-gray-500 dark:text-gray-400">
                          <span className="font-semibold">Click to upload</span> or drag and drop
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          PNG, JPG, GIF, WEBP, SVG, MP4, WEBM, MOV (Max 10MB each)
                        </p>
                      </div>
                      <input
                        type="file"
                        className="hidden"
                        multiple
                        accept={ALLOWED_EXTENSIONS}
                        onChange={handleFileSelect}
                      />
                    </label>
                  </div>
                </div>

                {/* Selected files list */}
                {selectedFiles.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Selected files ({selectedFiles.length})
                    </p>
                    <ul className="divide-y divide-gray-200 dark:divide-gray-600 border border-gray-200 dark:border-gray-600 rounded-lg">
                      {selectedFiles.map((file, index) => (
                        <li key={index} className="flex items-center justify-between px-4 py-3">
                          <div className="flex items-center gap-3">
                            {file.type.startsWith('image/') ? (
                              <svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                            ) : (
                              <svg className="w-5 h-5 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                            )}
                            <div>
                              <p className="text-sm font-medium text-gray-900 dark:text-white truncate max-w-xs">
                                {file.name}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                {formatFileSize(file.size)}
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeFile(index)}
                            className="text-red-500 hover:text-red-700 p-1"
                          >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Priority Selection (Only visible for agents/admins when form is selected) */}
          {selectedFormId && isAgentOrAdmin && (
            <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Priority Level
              </h2>
              <div>
                <label htmlFor="priority" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  How urgent is your request?
                </label>
                <select
                  id="priority"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                >
                  <option value="LOW">Low - General inquiry</option>
                  <option value="NORMAL">Normal - Standard request</option>
                  <option value="HIGH">High - Important issue</option>
                  <option value="URGENT">Urgent - Critical problem</option>
                </select>
              </div>
            </div>
          )}

          {/* Form actions - Only show after form is selected */}
          {selectedFormId && (
            <div className="flex gap-4">
              <button
                type="submit"
                disabled={createMutation.isPending || isUploading}
                className="flex-1 inline-flex justify-center items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium bg-primary text-primary-foreground hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isUploading ? 'Uploading attachments...' : createMutation.isPending ? 'Creating...' : 'Create Ticket'}
              </button>
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-colors"
              >
                Cancel
              </button>
            </div>
          )}
        </form>
      </div>
    </Layout>
  );
};

export default CreateTicket;
