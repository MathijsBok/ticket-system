import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useUser } from '@clerk/clerk-react';
import toast from 'react-hot-toast';
import { ticketApi, formApi, attachmentApi, aiAnalyticsApi, userApi } from '../lib/api';
import Layout from '../components/Layout';
import CustomSelect from '../components/CustomSelect';
import FormRenderer from '../components/FormRenderer';
import { Form, User } from '../types';

interface SuggestionResponse {
  solution: string | null;
  ticketCount: number;
}

const CreateTicket: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useUser();
  const userRole = (user?.publicMetadata?.role as string) || 'USER';
  const isAgentOrAdmin = userRole === 'AGENT' || userRole === 'ADMIN';
  const relatedTicketId = searchParams.get('relatedTicketId');
  const [priority, setPriority] = useState('NORMAL');
  const [categoryId, _setCategoryId] = useState('');
  const [selectedFormId, setSelectedFormId] = useState<string | null>(null);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [aiSolution, setAiSolution] = useState<string | null>(null);
  const [solutionTicketCount, setSolutionTicketCount] = useState(0);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [dismissedSuggestions, setDismissedSuggestions] = useState(false);
  const [acknowledgedSuggestion, setAcknowledgedSuggestion] = useState(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // User selection for agents (create ticket on behalf of user)
  const [requesterEmail, setRequesterEmail] = useState('');
  const [userSearchResults, setUserSearchResults] = useState<User[]>([]);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const userSearchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Simple form fields for agents (when no form is selected)
  const [simpleSubject, setSimpleSubject] = useState('');
  const [simpleDescription, setSimpleDescription] = useState('');

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
  const { data: selectedForm, isLoading: isLoadingForm } = useQuery({
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

  // Debounced search for AI solution suggestions
  const searchSuggestions = useCallback(async (subject: string, description: string, formId: string | null) => {
    // Require BOTH subject AND description to be filled (minimum 5 chars each)
    if (!subject.trim() || subject.trim().length < 5 || !description.trim() || description.trim().length < 10 || dismissedSuggestions || !formId) {
      setAiSolution(null);
      setSolutionTicketCount(0);
      return;
    }

    setIsLoadingSuggestions(true);
    setAcknowledgedSuggestion(false); // Reset acknowledgment when loading new suggestions
    try {
      const response = await ticketApi.getSuggestions(subject, description, formId);
      const data = response.data as SuggestionResponse;
      setAiSolution(data.solution);
      setSolutionTicketCount(data.ticketCount);

      // Track that a suggestion was shown
      if (data.solution) {
        aiAnalyticsApi.recordSuggestionFeedback({
          eventType: 'SUGGESTION_SHOWN',
          formId: formId || undefined
        }).catch(console.error);
      }
    } catch (error) {
      console.error('Error fetching suggestions:', error);
      setAiSolution(null);
      setSolutionTicketCount(0);
    } finally {
      setIsLoadingSuggestions(false);
    }
  }, [dismissedSuggestions]);

  // Effect to trigger suggestions search when form values change
  useEffect(() => {
    if (!selectedForm || !selectedFormId || dismissedSuggestions) return;

    // Find subject and description fields
    const subjectField = selectedForm.formFields?.find(ff =>
      ff.field.label.toLowerCase() === 'subject'
    );
    const descriptionField = selectedForm.formFields?.find(ff =>
      ff.field.label.toLowerCase() === 'description'
    );

    const subject = subjectField ? formValues[subjectField.fieldId] || '' : '';
    const description = descriptionField ? formValues[descriptionField.fieldId] || '' : '';

    // Clear existing timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Debounce the search by 2 seconds to reduce API costs
    searchTimeoutRef.current = setTimeout(() => {
      searchSuggestions(subject, description, selectedFormId);
    }, 2000);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [formValues, selectedForm, selectedFormId, searchSuggestions, dismissedSuggestions]);

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

    // For agents without form: validate simple fields
    if (isAgentOrAdmin && !selectedFormId) {
      if (!simpleSubject.trim()) {
        toast.error('Please enter a subject');
        return;
      }
      if (!requesterEmail || !isValidEmail(requesterEmail)) {
        toast.error('Please enter a valid email address for the requester');
        return;
      }

      createMutation.mutate({
        subject: simpleSubject.trim(),
        description: simpleDescription.trim() || 'No description provided',
        channel: 'WEB',
        priority,
        categoryId: categoryId || undefined,
        relatedTicketId: relatedTicketId || undefined,
        userAgent: navigator.userAgent,
        requesterEmail
      });
      return;
    }

    // Require form selection for regular users
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

    // Validate requester email for agent ticket creation
    if (isAgentOrAdmin && requesterEmail && !isValidEmail(requesterEmail)) {
      toast.error('Please enter a valid email address for the requester');
      return;
    }

    createMutation.mutate({
      subject: subject || 'No subject provided',
      description: description || 'No description provided',
      channel: 'WEB',
      priority,
      categoryId: categoryId || undefined,
      formId: selectedFormId || undefined,
      formResponses,
      relatedTicketId: relatedTicketId || undefined,
      userAgent: navigator.userAgent,
      shownAiSuggestion: aiSolution || undefined,
      requesterEmail: isAgentOrAdmin && requesterEmail ? requesterEmail : undefined
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
    // Reset suggestions when form changes
    setAiSolution(null);
    setSolutionTicketCount(0);
    setDismissedSuggestions(false);
    setAcknowledgedSuggestion(false);
  };

  // Handle user search for agent ticket creation
  const handleUserSearch = (query: string) => {
    setRequesterEmail(query);
    setSelectedUser(null);

    if (userSearchTimeoutRef.current) {
      clearTimeout(userSearchTimeoutRef.current);
    }

    if (query.length < 2) {
      setUserSearchResults([]);
      setShowUserDropdown(false);
      return;
    }

    userSearchTimeoutRef.current = setTimeout(async () => {
      setIsSearchingUsers(true);
      try {
        const response = await userApi.searchUsers(query);
        setUserSearchResults(response.data as User[]);
        setShowUserDropdown(true);
      } catch (error) {
        console.error('Error searching users:', error);
        setUserSearchResults([]);
      } finally {
        setIsSearchingUsers(false);
      }
    }, 300);
  };

  const handleSelectUser = (user: User) => {
    setSelectedUser(user);
    setRequesterEmail(user.email);
    setShowUserDropdown(false);
    setUserSearchResults([]);
  };

  const isValidEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
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

  // Render the user selection component for agents
  const renderUserSelection = () => {
    if (!isAgentOrAdmin) return null;

    return (
      <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Create Ticket For
        </h2>
        <div className="relative">
          <label htmlFor="requesterEmail" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Enter user email or search for existing user
          </label>
          <div className="relative">
            <input
              type="email"
              id="requesterEmail"
              value={requesterEmail}
              onChange={(e) => handleUserSearch(e.target.value)}
              onFocus={() => requesterEmail.length >= 2 && setShowUserDropdown(true)}
              onBlur={() => setTimeout(() => setShowUserDropdown(false), 200)}
              placeholder="user@example.com"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
            {isSearchingUsers && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
              </div>
            )}
          </div>

          {/* User search dropdown */}
          {showUserDropdown && userSearchResults.length > 0 && (
            <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg max-h-60 overflow-auto">
              {userSearchResults.map((user) => (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => handleSelectUser(user)}
                  className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                >
                  <div className="text-sm font-medium text-gray-900 dark:text-white">
                    {user.firstName && user.lastName
                      ? `${user.firstName} ${user.lastName}`
                      : user.email}
                  </div>
                  {user.firstName && user.lastName && (
                    <div className="text-xs text-gray-500 dark:text-gray-400">{user.email}</div>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Selected user or new email indicator */}
          {requesterEmail && isValidEmail(requesterEmail) && (
            <div className="mt-2">
              {selectedUser ? (
                <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>
                    Ticket will be created for: {selectedUser.firstName && selectedUser.lastName
                      ? `${selectedUser.firstName} ${selectedUser.lastName} (${selectedUser.email})`
                      : selectedUser.email}
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span>New user will be created for: {requesterEmail}</span>
                </div>
              )}
            </div>
          )}

          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            Leave empty to create the ticket for yourself
          </p>
        </div>
      </div>
    );
  };

  // Render the simple form for agents (quick ticket creation)
  const renderSimpleAgentForm = () => {
    if (!isAgentOrAdmin) return null;

    return (
      <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Quick Ticket Creation
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Create a ticket with just the essential fields, or select a form below for more options.
        </p>
        <div className="space-y-4">
          <div>
            <label htmlFor="simpleSubject" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Subject <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="simpleSubject"
              value={simpleSubject}
              onChange={(e) => setSimpleSubject(e.target.value)}
              placeholder="Enter ticket subject"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>
          <div>
            <label htmlFor="simpleDescription" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Description
            </label>
            <textarea
              id="simpleDescription"
              value={simpleDescription}
              onChange={(e) => setSimpleDescription(e.target.value)}
              placeholder="Enter ticket description (optional)"
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>
          <div>
            <label htmlFor="simplePriority" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Priority
            </label>
            <CustomSelect
              id="simplePriority"
              value={priority}
              onChange={(v) => setPriority(v)}
              options={[
                { value: 'LOW', label: 'Low' },
                { value: 'NORMAL', label: 'Normal' },
                { value: 'HIGH', label: 'High' },
                { value: 'URGENT', label: 'Urgent' },
              ]}
            />
          </div>
          <div className="pt-2">
            <button
              type="submit"
              disabled={createMutation.isPending || !simpleSubject.trim() || !requesterEmail || !isValidEmail(requesterEmail)}
              className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium bg-primary text-primary-foreground hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {createMutation.isPending ? 'Creating...' : 'Create Ticket'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Render the form selector component
  const renderFormSelector = () => (
    <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg border border-gray-200 dark:border-gray-700 p-6">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        {isAgentOrAdmin ? 'Or Select a Form' : 'Select Request Type'} {!isAgentOrAdmin && <span className="text-red-500">*</span>}
      </h2>
      <div>
        <label htmlFor="formId" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {isAgentOrAdmin ? 'Select a form for additional fields' : 'Please select the type of request you want to submit'}
        </label>
        <CustomSelect
          id="formId"
          value={selectedFormId || ''}
          onChange={(v) => handleFormSelection(v)}
          placeholder="-- Select a form --"
          required={!isAgentOrAdmin}
          options={(forms || []).map((form) => ({
            value: form.id,
            label: form.name,
          }))}
        />
      </div>
    </div>
  );

  // Render the AI solution panel component
  const renderSuggestionsPanel = () => {
    if (!selectedFormId || dismissedSuggestions || (!aiSolution && !isLoadingSuggestions)) {
      return null;
    }

    return (
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6 shadow-sm">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-800 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-300">
                Suggested Solution
              </h3>
              <p className="text-sm text-blue-700 dark:text-blue-400">
                Based on {solutionTicketCount} similar resolved {solutionTicketCount === 1 ? 'ticket' : 'tickets'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setDismissedSuggestions(true)}
            className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 p-1"
            title="Dismiss suggestion"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {isLoadingSuggestions ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 dark:border-blue-400"></div>
            <span className="ml-3 text-sm text-blue-700 dark:text-blue-400">Analyzing similar issues...</span>
          </div>
        ) : aiSolution && (
          <div className="space-y-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-blue-200 dark:border-blue-700 p-4">
              <div className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed whitespace-pre-line">
                {aiSolution}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => {
                  // Track that suggestion was helpful
                  aiAnalyticsApi.recordSuggestionFeedback({
                    eventType: 'SUGGESTION_HELPFUL',
                    formId: selectedFormId || undefined
                  }).catch(console.error);
                  toast.success('Glad this helped! No ticket needed.');
                  navigate(-1);
                }}
                className="w-full inline-flex justify-center items-center gap-2 px-4 py-2.5 text-sm font-medium text-green-700 dark:text-green-300 bg-green-100 dark:bg-green-900/50 hover:bg-green-200 dark:hover:bg-green-900 border border-green-300 dark:border-green-700 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                This solved my issue
              </button>

              {!acknowledgedSuggestion && (
                <button
                  type="button"
                  onClick={() => {
                    // Track that suggestion was not helpful
                    aiAnalyticsApi.recordSuggestionFeedback({
                      eventType: 'SUGGESTION_NOT_HELPFUL',
                      formId: selectedFormId || undefined
                    }).catch(console.error);
                    setAcknowledgedSuggestion(true);
                    toast('You can now submit your ticket', { icon: '📝' });
                  }}
                  className="w-full inline-flex justify-center items-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 border border-gray-300 dark:border-gray-600 rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  This did not solve my issue
                </button>
              )}

              {acknowledgedSuggestion && (
                <p className="text-xs text-center text-gray-500 dark:text-gray-400">
                  You can now submit your ticket using the button below.
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <Layout>
      <div className="max-w-6xl mx-auto">
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

        <form onSubmit={handleSubmit}>
          {/* Single column layout before form selection */}
          {!selectedFormId && (
            <div className="max-w-3xl mx-auto space-y-6">
              {/* User Selection for Agents */}
              {renderUserSelection()}

              {/* Simple Agent Form - Quick ticket creation */}
              {renderSimpleAgentForm()}

              {/* Form Selection - Optional for agents, required for users */}
              {forms && forms.length > 0 && renderFormSelector()}

              {/* Important Support Information - Only show for regular users when no form is selected */}
              {!isAgentOrAdmin && (
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-400 dark:border-yellow-600 p-6 rounded-r-lg shadow-sm">
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <svg className="h-6 w-6 text-yellow-600 dark:text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <div className="ml-4 flex-1">
                    <h3 className="text-lg font-semibold text-yellow-800 dark:text-yellow-200 mb-3">
                      Important Support Information
                    </h3>
                    <div className="text-sm text-yellow-700 dark:text-yellow-300 space-y-3">
                      <p>
                        Please note that we can only assist with issues directly related to <strong>Klever Wallet</strong> and <strong>Klever Exchange</strong>.
                        Requests submitted under the correct category will be processed faster.
                      </p>

                      <div>
                        <p className="font-semibold mb-1">Processing Time</p>
                        <p>Requests are generally processed within 1–12 hours.</p>
                      </div>

                      <div>
                        <p className="font-semibold mb-1">Request Category</p>
                        <p>If your request is related to the <strong>EXCHANGE</strong> or <strong>WALLET</strong>, please clearly mention this in your message.</p>
                      </div>

                      <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-md p-3 mt-3">
                        <p className="font-semibold text-red-800 dark:text-red-200 mb-2">Security Notice</p>
                        <p className="text-red-700 dark:text-red-300 mb-2">KLEVER will NEVER ask you to:</p>
                        <ul className="list-disc list-inside space-y-1 text-red-700 dark:text-red-300 ml-2">
                          <li>Transfer funds to any address</li>
                          <li>Share private information of any kind</li>
                        </ul>
                        <p className="text-red-700 dark:text-red-300 mt-2 font-medium">If anyone asks you to do so, this is a scam.</p>

                        <p className="font-semibold text-red-800 dark:text-red-200 mt-3 mb-1">Never Share:</p>
                        <ul className="list-disc list-inside space-y-1 text-red-700 dark:text-red-300 ml-2">
                          <li>Your private key</li>
                          <li>Your mnemonic / recovery phrase</li>
                          <li>Any other sensitive personal information</li>
                        </ul>
                      </div>

                      <div>
                        <p className="font-semibold mb-1">Supported Languages</p>
                        <p>English (fastest support), German, Spanish, Hindi, Persian, Dutch</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              )}
            </div>
          )}

          {/* Loading state when form is being fetched */}
          {selectedFormId && isLoadingForm && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              <span className="ml-3 text-sm text-gray-600 dark:text-gray-400">Loading form...</span>
            </div>
          )}

          {/* Two-column layout after form selection (desktop only) */}
          {selectedFormId && selectedForm && !isLoadingForm && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column - Form Fields (2/3 width on desktop) */}
              <div className="lg:col-span-2 space-y-6">
                {/* User Selection for Agents (when form is selected) */}
                {renderUserSelection()}

                {/* Form Fields */}
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

                {/* Attachments Section */}
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
                              PNG, JPG, GIF, WEBP, SVG, MP4, WEBM, MOV (Max 5MB each)
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

                {/* Suggestions Panel - Mobile only (below attachments) */}
                <div className="lg:hidden">
                  {renderSuggestionsPanel()}
                </div>

                {/* Priority Selection (Only visible for agents/admins) */}
                {isAgentOrAdmin && (
                  <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                      Priority Level
                    </h2>
                    <div>
                      <label htmlFor="priority" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        How urgent is your request?
                      </label>
                      <CustomSelect
                        id="priority"
                        value={priority}
                        onChange={(v) => setPriority(v)}
                        options={[
                          { value: 'LOW', label: 'Low - General inquiry' },
                          { value: 'NORMAL', label: 'Normal - Standard request' },
                          { value: 'HIGH', label: 'High - Important issue' },
                          { value: 'URGENT', label: 'Urgent - Critical problem' },
                        ]}
                      />
                    </div>
                  </div>
                )}

                {/* Form actions */}
                <div className="flex flex-col gap-3">
                  {/* Warning when AI suggestion needs acknowledgment */}
                  {aiSolution && !dismissedSuggestions && !acknowledgedSuggestion && (
                    <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                      <svg className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      <p className="text-sm text-amber-800 dark:text-amber-200">
                        Please review the suggested solution above and confirm whether it solved your issue before submitting.
                      </p>
                    </div>
                  )}

                  <div className="flex gap-4">
                    <button
                      type="submit"
                      disabled={createMutation.isPending || isUploading || (!!aiSolution && !dismissedSuggestions && !acknowledgedSuggestion)}
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
                </div>
              </div>

              {/* Right Column - Form Selector + Suggestions (1/3 width on desktop, appears first on mobile) */}
              <div className="lg:col-span-1 space-y-6 lg:sticky lg:top-4 lg:self-start order-first lg:order-none">
                {/* Form Selection */}
                {forms && forms.length > 0 && renderFormSelector()}

                {/* Suggestions Panel - Desktop only */}
                <div className="hidden lg:block">
                  {renderSuggestionsPanel()}
                </div>
              </div>
            </div>
          )}
        </form>
      </div>
    </Layout>
  );
};

export default CreateTicket;
