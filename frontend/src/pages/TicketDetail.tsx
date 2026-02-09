import React, { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useUser } from '@clerk/clerk-react';
import toast from 'react-hot-toast';
import { ticketApi, commentApi, userApi, macroApi, attachmentApi, settingsApi, aiSummaryAnalyticsApi } from '../lib/api';
import { parseUserAgent } from '../lib/deviceDetection';
import { getTimezoneDisplay, getCountryDisplay } from '../lib/geolocation';
import { Macro, Attachment } from '../types';
import Layout from '../components/Layout';
import RichTextEditor from '../components/RichTextEditor';
import MentionableRichTextEditor from '../components/MentionableRichTextEditor';
import TicketFeedback from '../components/TicketFeedback';
import { format } from 'date-fns';

// Format form response values (handles Zendesk snake_case values)
// Tries to match against field options if available
const formatFormValue = (value: string, options?: string[]): string => {
  if (!value) return value;

  // If we have options, try to find a matching one
  if (options && options.length > 0) {
    // Normalize the value for comparison
    const normalizedValue = value
      .replace(/_clone\d*$/i, '')
      .replace(/_/g, ' ')
      .toLowerCase();

    // Try to find a matching option
    for (const option of options) {
      const normalizedOption = option.toLowerCase();
      // Check if the normalized value contains key words from the option
      const optionWords = normalizedOption.split(' ').filter(w => w.length > 2);
      const valueWords = normalizedValue.split(' ').filter(w => w.length > 2);

      // Check for word overlap (fuzzy match)
      const matchingWords = optionWords.filter(ow =>
        valueWords.some(vw => vw.includes(ow) || ow.includes(vw))
      );

      if (matchingWords.length >= Math.min(2, optionWords.length)) {
        return option; // Return the proper label
      }
    }
  }

  // Fallback: format the raw value
  let formatted = value.replace(/_clone\d*$/i, '');
  formatted = formatted.replace(/_/g, ' ');
  formatted = formatted.replace(/\b\w/g, l => l.toUpperCase());
  return formatted;
};

const TicketDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useUser();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  // Default to 'USER' role if no role is set (new users)
  const userRole = (user?.publicMetadata?.role as string) || 'USER';

  const [replyBody, setReplyBody] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [macroFilter, setMacroFilter] = useState('');
  const [showAssignDropdown, setShowAssignDropdown] = useState(false);
  const [mentionedUserIds, setMentionedUserIds] = useState<string[]>([]);
  const [selectedAttachment, setSelectedAttachment] = useState<Attachment | null>(null);
  const [_attachmentLoading, setAttachmentLoading] = useState(false);
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [selectedMergeTarget, setSelectedMergeTarget] = useState<string | null>(null);
  const [mergeComment, setMergeComment] = useState('');
  const [visibleCommentsCount, setVisibleCommentsCount] = useState(5);
  const [submitStatus, setSubmitStatus] = useState<string>('PENDING');
  const [showSubmitDropdown, setShowSubmitDropdown] = useState(false);
  const submitDropdownRef = useRef<HTMLDivElement>(null);
  const [isEditingSubject, setIsEditingSubject] = useState(false);
  const [editedSubject, setEditedSubject] = useState('');
  const subjectInputRef = useRef<HTMLInputElement>(null);
  const [showInternalNotes, setShowInternalNotes] = useState(false);
  const [showActivityLog, setShowActivityLog] = useState(false);
  const [showProblemSearch, setShowProblemSearch] = useState(false);
  const [problemSearchQuery, setProblemSearchQuery] = useState('');
  const [showScamModal, setShowScamModal] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const statusDropdownRef = useRef<HTMLDivElement>(null);
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);
  const typeDropdownRef = useRef<HTMLDivElement>(null);

  // Close status dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(e.target as Node)) {
        setShowStatusDropdown(false);
      }
    };
    if (showStatusDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showStatusDropdown]);

  // Close type dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (typeDropdownRef.current && !typeDropdownRef.current.contains(e.target as Node)) {
        setShowTypeDropdown(false);
      }
    };
    if (showTypeDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showTypeDropdown]);

  // Close submit dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (submitDropdownRef.current && !submitDropdownRef.current.contains(e.target as Node)) {
        setShowSubmitDropdown(false);
      }
    };
    if (showSubmitDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showSubmitDropdown]);

  const { data: ticket, isLoading } = useQuery({
    queryKey: ['ticket', id],
    queryFn: async () => {
      const response = await ticketApi.getById(id!);
      return response.data;
    },
    enabled: !!id
  });

  // Fetch current user's database profile
  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: async () => {
      const response = await userApi.getMe();
      return response.data;
    },
    enabled: userRole === 'AGENT' || userRole === 'ADMIN'
  });

  // Fetch macros for agents
  const { data: macros } = useQuery({
    queryKey: ['macros'],
    queryFn: async () => {
      const response = await macroApi.getAll();
      return response.data as Macro[];
    },
    enabled: userRole === 'AGENT' || userRole === 'ADMIN'
  });

  // Fetch all agents for assignment dropdown
  const { data: agents } = useQuery({
    queryKey: ['agents'],
    queryFn: async () => {
      const response = await userApi.getAgents();
      return response.data;
    },
    enabled: userRole === 'AGENT' || userRole === 'ADMIN'
  });

  // Fetch merge candidates (other open tickets from same requester)
  const { data: mergeCandidates, refetch: refetchMergeCandidates } = useQuery({
    queryKey: ['mergeCandidates', id],
    queryFn: async () => {
      const response = await ticketApi.getMergeCandidates(id!);
      return response.data;
    },
    enabled: !!id && showMergeModal && (userRole === 'AGENT' || userRole === 'ADMIN')
  });

  // Fetch problem tickets for linking incidents
  const { data: problemTickets } = useQuery({
    queryKey: ['problemTickets', problemSearchQuery, id],
    queryFn: async () => {
      const response = await ticketApi.searchProblems(problemSearchQuery, id);
      return response.data;
    },
    enabled: showProblemSearch && (userRole === 'AGENT' || userRole === 'ADMIN')
  });

  // Fetch AI settings status
  const { data: aiSettings } = useQuery({
    queryKey: ['aiSettings'],
    queryFn: async () => {
      const response = await settingsApi.getAIStatus();
      return response.data as { enabled: boolean; configured: boolean };
    },
    enabled: userRole === 'AGENT' || userRole === 'ADMIN'
  });

  // Merge tickets mutation
  const mergeMutation = useMutation({
    mutationFn: async (data: { sourceTicketIds: string[]; targetTicketId: string; mergeComment?: string }) => {
      const response = await ticketApi.merge(data);
      return response.data;
    },
    onSuccess: (data) => {
      toast.success(data.message || 'Tickets merged successfully');
      setShowMergeModal(false);
      setSelectedMergeTarget(null);
      setMergeComment('');
      queryClient.invalidateQueries({ queryKey: ['ticket', id] });
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to merge tickets');
    }
  });

  // Generate AI summary mutation
  const generateSummaryMutation = useMutation({
    mutationFn: async () => {
      const response = await ticketApi.generateSummary(id!);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Summary generated');
      queryClient.invalidateQueries({ queryKey: ['ticket', id] });

      // Track the generate/regenerate event
      const eventType = ticket?.aiSummary ? 'SUMMARY_REGENERATED' : 'SUMMARY_GENERATED';
      aiSummaryAnalyticsApi.recordEvent({ ticketId: id!, eventType }).catch(console.error);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to generate summary');
    }
  });

  // Replace placeholders in macro content with actual values
  const replaceMacroPlaceholders = (content: string) => {
    if (!ticket) return content;

    const requesterName = ticket.requester.firstName || ticket.requester.lastName
      ? `${ticket.requester.firstName || ''} ${ticket.requester.lastName || ''}`.trim()
      : ticket.requester.email;

    const agentName = currentUser?.firstName || currentUser?.lastName
      ? `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim()
      : currentUser?.email || 'Agent';

    const ticketUrl = `${window.location.origin}/tickets/${ticket.id}`;

    return content
      .replace(/\{\{userName\}\}/g, requesterName)
      .replace(/\{\{ticketNumber\}\}/g, ticket.ticketNumber?.toString() || '')
      .replace(/\{\{ticketSubject\}\}/g, ticket.subject || '')
      .replace(/\{\{ticketUrl\}\}/g, ticketUrl)
      .replace(/\{\{agentName\}\}/g, agentName);
  };

  const handleMacroSelect = async (macro: Macro) => {
    const processedContent = replaceMacroPlaceholders(macro.content);
    setReplyBody(processedContent);

    // If ticket is NEW, auto-assign to agent and change status to OPEN
    if (ticket?.status === 'NEW' && currentUser?.id) {
      try {
        await ticketApi.update(id!, {
          status: 'OPEN',
          assigneeId: currentUser.id
        });
        queryClient.invalidateQueries({ queryKey: ['ticket', id] });
        queryClient.invalidateQueries({ queryKey: ['agentTickets'] });
        queryClient.invalidateQueries({ queryKey: ['ticketStats'] });
        toast.success('Ticket assigned to you and set to Open');
      } catch {
        toast.error('Failed to assign ticket');
      }
    }
  };

  const replyMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await commentApi.create(data);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Reply sent successfully');
      setReplyBody('');
      setIsInternal(false);
      setMentionedUserIds([]);
      queryClient.invalidateQueries({ queryKey: ['ticket', id] });
    },
    onError: () => {
      toast.error('Failed to send reply');
    }
  });

  const updateStatusMutation = useMutation({
    mutationFn: async (status: string) => {
      const response = await ticketApi.update(id!, { status });
      return response.data;
    },
    onSuccess: () => {
      toast.success('Ticket status updated');
      queryClient.invalidateQueries({ queryKey: ['ticket', id] });
      queryClient.invalidateQueries({ queryKey: ['agentTickets'] });
      queryClient.invalidateQueries({ queryKey: ['ticketStats'] });
    },
    onError: () => {
      toast.error('Failed to update status');
    }
  });

  const assignToMeMutation = useMutation({
    mutationFn: async () => {
      if (!currentUser?.id) {
        throw new Error('User profile not loaded');
      }
      const response = await ticketApi.update(id!, { assigneeId: currentUser.id });
      return response.data;
    },
    onSuccess: () => {
      toast.success('Ticket assigned to you');
      queryClient.invalidateQueries({ queryKey: ['ticket', id] });
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.error || 'Failed to assign ticket';
      toast.error(errorMessage);
    }
  });

  const assignToAgentMutation = useMutation({
    mutationFn: async (assigneeId: string | null) => {
      const response = await ticketApi.update(id!, { assigneeId: assigneeId || undefined });
      return response.data;
    },
    onSuccess: () => {
      toast.success('Ticket assignment updated');
      queryClient.invalidateQueries({ queryKey: ['ticket', id] });
      setShowAssignDropdown(false);
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.error || 'Failed to assign ticket';
      toast.error(errorMessage);
    }
  });

  const updateSubjectMutation = useMutation({
    mutationFn: async (newSubject: string) => {
      const response = await ticketApi.update(id!, { subject: newSubject });
      return response.data;
    },
    onSuccess: () => {
      toast.success('Subject updated');
      queryClient.invalidateQueries({ queryKey: ['ticket', id] });
      setIsEditingSubject(false);
    },
    onError: () => {
      toast.error('Failed to update subject');
    }
  });

  const handleSubjectEdit = () => {
    setEditedSubject(ticket?.subject || '');
    setIsEditingSubject(true);
    setTimeout(() => subjectInputRef.current?.focus(), 0);
  };

  const handleSubjectSave = () => {
    if (editedSubject.trim() && editedSubject.trim() !== ticket?.subject) {
      updateSubjectMutation.mutate(editedSubject.trim());
    } else {
      setIsEditingSubject(false);
    }
  };

  const handleSubjectKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubjectSave();
    } else if (e.key === 'Escape') {
      setIsEditingSubject(false);
    }
  };

  // Mutation to update ticket type
  const updateTypeMutation = useMutation({
    mutationFn: async (newType: string) => {
      const response = await ticketApi.update(id!, { type: newType });
      return response.data;
    },
    onSuccess: () => {
      toast.success('Ticket type updated');
      queryClient.invalidateQueries({ queryKey: ['ticket', id] });
    },
    onError: () => {
      toast.error('Failed to update ticket type');
    }
  });

  // Mutation to link/unlink incident to problem
  const linkToProblemMutation = useMutation({
    mutationFn: async (problemId: string | null) => {
      const response = await ticketApi.update(id!, { problemId });
      return response.data;
    },
    onSuccess: () => {
      toast.success(linkToProblemMutation.variables ? 'Linked to problem ticket' : 'Unlinked from problem ticket');
      queryClient.invalidateQueries({ queryKey: ['ticket', id] });
    },
    onError: () => {
      toast.error('Failed to update problem link');
    }
  });

  const markAsScamMutation = useMutation({
    mutationFn: async () => {
      const response = await ticketApi.markAsScam(id!);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Ticket marked as scam and user blocked');
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      queryClient.invalidateQueries({ queryKey: ['agentTickets'] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      navigate('/agent');
    },
    onError: () => {
      toast.error('Failed to mark ticket as scam');
    }
  });

  // Helper to strip HTML and convert to plain text
  const htmlToPlainText = (html: string): string => {
    const temp = document.createElement('div');
    temp.innerHTML = html;
    return temp.textContent || temp.innerText || '';
  };

  // Check if HTML content is effectively empty
  const isHtmlEmpty = (html: string): boolean => {
    const plainText = htmlToPlainText(html);
    return !plainText.trim();
  };

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isHtmlEmpty(replyBody)) {
      toast.error('Reply cannot be empty');
      return;
    }

    // For agents: update status and auto-assign if not already assigned
    if ((userRole === 'AGENT' || userRole === 'ADMIN') && !isInternal) {
      try {
        const updateData: { status?: string; assigneeId?: string } = {
          status: submitStatus
        };
        // Auto-assign to current agent if not already assigned
        if (!ticket?.assigneeId && currentUser?.id) {
          updateData.assigneeId = currentUser.id;
        }
        await ticketApi.update(id!, updateData);
        queryClient.invalidateQueries({ queryKey: ['ticket', id] });
        queryClient.invalidateQueries({ queryKey: ['agentTickets'] });
        queryClient.invalidateQueries({ queryKey: ['ticketStats'] });
      } catch {
        // Continue with reply even if status update fails
      }
    }

    replyMutation.mutate({
      ticketId: id!,
      body: replyBody,
      bodyPlain: htmlToPlainText(replyBody),
      isInternal,
      mentionedUserIds: mentionedUserIds.length > 0 ? mentionedUserIds : undefined
    });
  };

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newStatus = e.target.value;
    if (newStatus && newStatus !== ticket?.status) {
      updateStatusMutation.mutate(newStatus);
    }
  };

  const formatFileSize = (bytes: number | string) => {
    const size = typeof bytes === 'string' ? parseInt(bytes) : bytes;
    if (size < 1024) return size + ' B';
    if (size < 1024 * 1024) return (size / 1024).toFixed(1) + ' KB';
    return (size / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const handleViewAttachment = (attachment: Attachment) => {
    setSelectedAttachment(attachment);
  };

  const handleDownloadAttachment = async (attachment: Attachment) => {
    try {
      const response = await attachmentApi.download(attachment.id);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', attachment.filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      toast.error('Failed to download attachment');
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      NEW: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      OPEN: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
      PENDING: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      ON_HOLD: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
      SOLVED: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      CLOSED: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
    };
    return colors[status] || colors.NEW;
  };

  const formatActivityMessage = (action: string, details: any) => {
    const formatStatus = (status: string) => {
      return status.replace('_', ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
    };

    const formatChannel = (channel: string) => {
      return channel.charAt(0).toUpperCase() + channel.slice(1).toLowerCase();
    };

    switch (action) {
      case 'ticket_created':
        if (details?.subject) {
          return `Ticket created via ${formatChannel(details.channel || 'Web')}: "${details.subject}"`;
        }
        return `Ticket created via ${formatChannel(details?.channel || 'Web')}`;

      case 'status_changed':
        if (details?.oldStatus && details?.newStatus) {
          return `Status changed from ${formatStatus(details.oldStatus)} to ${formatStatus(details.newStatus)}`;
        } else if (details?.newStatus) {
          return `Status changed to ${formatStatus(details.newStatus)}`;
        }
        return 'Status changed';

      case 'assignee_changed':
        if (details?.newAssignee) {
          return `Assigned to ${details.newAssignee}`;
        } else if (details?.oldAssignee) {
          return 'Unassigned';
        }
        return 'Assignee changed';

      case 'priority_changed':
        if (details?.oldPriority && details?.newPriority) {
          return `Priority changed from ${formatStatus(details.oldPriority)} to ${formatStatus(details.newPriority)}`;
        } else if (details?.newPriority) {
          return `Priority changed to ${formatStatus(details.newPriority)}`;
        }
        return 'Priority changed';

      case 'comment_added':
        return details?.isInternal ? 'Internal note added' : 'Reply added';

      case 'category_changed':
        if (details?.newCategory) {
          return `Category changed to ${details.newCategory}`;
        }
        return 'Category changed';

      case 'ticket_auto_closed':
        return 'Ticket Auto-closed';

      case 'ticket_auto_solved':
        return 'Ticket Auto-solved';

      case 'ticket_merged':
        if (details?.mergedIntoTicketNumber) {
          return `Ticket merged into #${details.mergedIntoTicketNumber}`;
        }
        return 'Ticket merged';

      case 'tickets_merged_in':
        if (details?.mergedTicketNumbers && Array.isArray(details.mergedTicketNumbers)) {
          return `Merged in ticket(s): #${details.mergedTicketNumbers.join(', #')}`;
        }
        return 'Tickets merged in';

      case 'type_changed':
        if (details?.newType) {
          return `Type changed to ${details.newType}`;
        }
        return 'Type changed';

      case 'linked_to_problem':
        if (details?.problemTicketNumber) {
          return `Linked to Problem #${details.problemTicketNumber}`;
        }
        return 'Linked to problem ticket';

      case 'unlinked_from_problem':
        return 'Unlinked from problem ticket';

      default:
        return action.replace('_', ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
    }
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <p className="mt-2 text-gray-600 dark:text-gray-400">Loading ticket...</p>
        </div>
      </Layout>
    );
  }

  if (!ticket) {
    return (
      <Layout>
        <div className="text-center py-12">
          <p className="text-gray-600 dark:text-gray-400">Ticket not found</p>
        </div>
      </Layout>
    );
  }

  const isAgent = userRole === 'AGENT' || userRole === 'ADMIN';

  // Check if ticket is closed (either CLOSED status or SOLVED for more than 48 hours)
  const isTicketClosedForReplies = () => {
    // If ticket status is CLOSED, it's closed for replies
    if (ticket.status === 'CLOSED') return true;

    // If ticket is SOLVED for more than 48 hours, it's closed for replies
    if (ticket.status === 'SOLVED' && ticket.solvedAt) {
      const solvedDate = new Date(ticket.solvedAt);
      const hoursSinceSolved = (Date.now() - solvedDate.getTime()) / (1000 * 60 * 60);
      return hoursSinceSolved > 48;
    }

    return false;
  };

  const ticketClosed = isTicketClosedForReplies();

  return (
    <Layout>
      <div className="space-y-4 sm:space-y-6">
        {/* Back button */}
        <button
          onClick={() => navigate(-1)}
          className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>

        {/* Ticket header */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 sm:p-6 overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 mb-4">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
              Ticket #{ticket.ticketNumber}
            </h1>

            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(ticket.status)}`}>
                {ticket.status.replace('_', ' ')}
              </span>
              <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                ticket.priority === 'URGENT' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                ticket.priority === 'HIGH' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' :
                ticket.priority === 'LOW' ? 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300' :
                'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
              }`}>
                {ticket.priority}
              </span>
              {/* Ticket Type Badge */}
              {ticket.type && ticket.type !== 'NORMAL' && (
                <span className="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-purple-50 text-purple-600 dark:bg-purple-800 dark:text-purple-200">
                  {ticket.type}
                </span>
              )}

              {/* Agent actions */}
              {isAgent && (
                <>
                  {!ticket.assignee && (
                    <button
                      onClick={() => assignToMeMutation.mutate()}
                      disabled={assignToMeMutation.isPending}
                      className="px-3 sm:px-4 py-2 bg-primary text-primary-foreground rounded-md hover:opacity-90 text-sm font-medium disabled:opacity-50 transition-colors whitespace-nowrap"
                    >
                      Assign to Me
                    </button>
                  )}
                  {/* Assign to Agent dropdown */}
                  <div className="relative">
                    <button
                      onClick={() => setShowAssignDropdown(!showAssignDropdown)}
                      className="px-3 sm:px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-primary transition-colors flex items-center gap-1 sm:gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      <span className="hidden sm:inline">Assign</span>
                      <svg className={`w-4 h-4 transition-transform ${showAssignDropdown ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {showAssignDropdown && (
                      <>
                        {/* Backdrop to close dropdown */}
                        <div
                          className="fixed inset-0 z-10"
                          onClick={() => setShowAssignDropdown(false)}
                        />
                        <div className="absolute left-0 sm:left-auto sm:right-0 mt-2 w-56 sm:w-64 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-lg z-20 max-h-64 overflow-y-auto">
                          {/* Unassign option */}
                          {ticket.assignee && (
                            <button
                              onClick={() => assignToAgentMutation.mutate(null)}
                              disabled={assignToAgentMutation.isPending}
                              className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 border-b border-gray-200 dark:border-gray-700 disabled:opacity-50"
                            >
                              Unassign
                            </button>
                          )}
                          {/* Agent list */}
                          {agents && agents.length > 0 ? (
                            agents.map((agent: any) => (
                              <button
                                key={agent.id}
                                onClick={() => assignToAgentMutation.mutate(agent.id)}
                                disabled={assignToAgentMutation.isPending || ticket.assigneeId === agent.id}
                                className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 flex items-center justify-between ${
                                  ticket.assigneeId === agent.id
                                    ? 'bg-primary/10 dark:bg-primary/20 text-primary'
                                    : 'text-gray-900 dark:text-white'
                                }`}
                              >
                                <span className="truncate">
                                  {agent.firstName || agent.lastName
                                    ? `${agent.firstName || ''} ${agent.lastName || ''}`.trim()
                                    : agent.email}
                                </span>
                                {ticket.assigneeId === agent.id && (
                                  <svg className="w-4 h-4 text-primary flex-shrink-0 ml-2" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                  </svg>
                                )}
                              </button>
                            ))
                          ) : (
                            <div className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">
                              No agents available
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                  {/* Status dropdown */}
                  <div className="relative" ref={statusDropdownRef}>
                    <button
                      onClick={() => setShowStatusDropdown(!showStatusDropdown)}
                      disabled={updateStatusMutation.isPending}
                      className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary flex items-center gap-2 justify-between disabled:opacity-50"
                    >
                      <span>
                        {ticket.status === 'NEW' && 'New'}
                        {ticket.status === 'OPEN' && 'Open'}
                        {ticket.status === 'PENDING' && 'Pending'}
                        {ticket.status === 'ON_HOLD' && 'On Hold'}
                        {ticket.status === 'SOLVED' && 'Solved'}
                        {ticket.status === 'CLOSED' && 'Closed'}
                      </span>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {showStatusDropdown && (
                      <div className="absolute top-full left-0 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg z-20">
                        {[
                          { value: 'OPEN', label: 'Open' },
                          { value: 'PENDING', label: 'Pending' },
                          { value: 'ON_HOLD', label: 'On Hold' },
                          { value: 'SOLVED', label: 'Solved' },
                        ].map((status, index, arr) => (
                          <button
                            key={status.value}
                            onClick={() => {
                              handleStatusChange({ target: { value: status.value } } as React.ChangeEvent<HTMLSelectElement>);
                              setShowStatusDropdown(false);
                            }}
                            className={`w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-between ${index === 0 ? 'rounded-t-md' : ''} ${index === arr.length - 1 ? 'rounded-b-md' : ''}`}
                          >
                            <span>{status.label}</span>
                            {ticket.status === status.value && (
                              <svg className="w-4 h-4 text-primary" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {/* Merge button - only show for open tickets */}
                  {ticket.status !== 'SOLVED' && ticket.status !== 'CLOSED' && !ticket.mergedIntoId && (
                    <button
                      onClick={() => {
                        setShowMergeModal(true);
                        refetchMergeCandidates();
                      }}
                      className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-primary transition-colors whitespace-nowrap"
                      title="Merge into another ticket"
                    >
                      <svg className="w-4 h-4 sm:mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                      </svg>
                      <span className="hidden sm:inline">Merge</span>
                    </button>
                  )}
                  {/* Mark as Scam button */}
                  <button
                    onClick={() => setShowScamModal(true)}
                    className="inline-flex items-center px-3 py-2 border border-red-300 dark:border-red-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-red-600 dark:text-red-400 text-sm hover:bg-red-50 dark:hover:bg-red-900/20 focus:outline-none focus:ring-2 focus:ring-red-500 transition-colors whitespace-nowrap"
                    title="Mark as scam and block user"
                  >
                    <svg className="w-4 h-4 sm:mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span className="hidden sm:inline">Scam</span>
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
            {isEditingSubject ? (
              <div className="flex items-center gap-2 flex-1">
                <input
                  ref={subjectInputRef}
                  type="text"
                  value={editedSubject}
                  onChange={(e) => setEditedSubject(e.target.value)}
                  onKeyDown={handleSubjectKeyDown}
                  onBlur={handleSubjectSave}
                  className="flex-1 text-lg sm:text-xl text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="Enter subject..."
                />
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl text-gray-700 dark:text-gray-300 break-words">{ticket.subject}</h2>
                {isAgent && (
                  <button
                    onClick={handleSubjectEdit}
                    className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    title="Edit subject"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                )}
              </div>
            )}

            {/* Create Follow-up Ticket Button */}
            {ticket.status === 'CLOSED' && (
              <Link
                to={`/tickets/new?relatedTicketId=${ticket.id}`}
                className="inline-flex items-center px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-colors whitespace-nowrap flex-shrink-0"
              >
                <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span className="hidden sm:inline">Create Follow-up Ticket</span>
                <span className="sm:hidden">Follow-up</span>
              </Link>
            )}
          </div>

          {/* Merged into another ticket banner */}
          {ticket.mergedInto && (
            <div className="mt-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-purple-600 dark:text-purple-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
                <div className="flex-1">
                  <h4 className="text-sm font-semibold text-purple-800 dark:text-purple-300 mb-1">
                    This ticket has been merged
                  </h4>
                  <p className="text-sm text-purple-700 dark:text-purple-400">
                    This ticket was closed and merged into{' '}
                    <Link
                      to={`/tickets/${ticket.mergedInto.id}`}
                      className="font-medium underline hover:text-purple-900 dark:hover:text-purple-200"
                    >
                      Ticket #{ticket.mergedInto.ticketNumber}
                    </Link>
                    {' '}- {ticket.mergedInto.subject}
                  </p>
                </div>
              </div>
            </div>
          )}


          {/* Closed ticket warning */}
          {ticketClosed && !isAgent && !ticket.mergedIntoId && (
            <div className="mt-4 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-orange-600 dark:text-orange-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div className="flex-1">
                  <h4 className="text-sm font-semibold text-orange-800 dark:text-orange-300 mb-1">
                    This ticket has been {ticket.status === 'CLOSED' ? 'auto-closed' : 'closed'}
                  </h4>
                  <p className="text-sm text-orange-700 dark:text-orange-400 mb-2">
                    {ticket.status === 'CLOSED'
                      ? 'This ticket was automatically closed after being solved for more than 48 hours. You cannot add replies to closed tickets.'
                      : 'This ticket has been solved for more than 48 hours and is closed for replies.'
                    }
                  </p>
                  {ticket.status === 'CLOSED' && (
                    <p className="text-sm text-orange-700 dark:text-orange-400">
                      If you need further assistance on the same subject, please create a follow-up ticket using the button above.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-x-4 sm:gap-x-6 gap-y-2 text-sm text-gray-600 dark:text-gray-400">
            <div className="min-w-0">
              <span className="font-medium">Created:</span> {format(new Date(ticket.createdAt), 'MMM d, yyyy HH:mm')}
            </div>
            {ticket.updatedAt && ticket.updatedAt !== ticket.createdAt && (
              <div className="min-w-0">
                <span className="font-medium">Updated:</span> {format(new Date(ticket.updatedAt), 'MMM d, yyyy HH:mm')}
              </div>
            )}
            {ticket.solvedAt && (
              <div className="min-w-0">
                <span className="font-medium">Solved:</span> {format(new Date(ticket.solvedAt), 'MMM d, yyyy HH:mm')}
              </div>
            )}
            {ticket.category && (
              <div className="min-w-0">
                <span className="font-medium">Category:</span> {ticket.category.name}
              </div>
            )}
            <div className="min-w-0 w-full sm:w-auto">
              <span className="font-medium">Requester:</span>{' '}
              <span className="break-all">
                {ticket.requester.firstName || ticket.requester.lastName
                  ? `${ticket.requester.firstName || ''} ${ticket.requester.lastName || ''}`.trim()
                  : ticket.requester.email}
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400 ml-1 break-all">({ticket.requester.email})</span>
            </div>
            {ticket.assignee && (
              <div className="min-w-0">
                <span className="font-medium">Assigned to:</span>{' '}
                <span className="break-all">
                  {ticket.assignee.firstName || ticket.assignee.lastName
                    ? `${ticket.assignee.firstName || ''} ${ticket.assignee.lastName || ''}`.trim()
                    : ticket.assignee.email}
                </span>
              </div>
            )}
          </div>

          {/* Merged tickets + User Environment Row - Only visible to agents/admins */}
          {isAgent && (
            <div className={`mt-4 grid grid-cols-1 ${ticket.mergedTickets && ticket.mergedTickets.length > 0 ? 'lg:grid-cols-4' : ''} gap-4`}>
              {/* Merged tickets - only show if there are merged tickets (1/4 width) */}
              {ticket.mergedTickets && ticket.mergedTickets.length > 0 && (
                <div className="lg:col-span-1 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <svg className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                    <div className="flex-1">
                      <h4 className="text-sm font-semibold text-blue-800 dark:text-blue-300 mb-2">
                        Merged tickets ({ticket.mergedTickets.length})
                      </h4>
                      <div className="space-y-2 max-h-24 overflow-y-auto">
                        {ticket.mergedTickets.map((merged: any) => (
                          <div key={merged.id} className="text-sm text-blue-700 dark:text-blue-400">
                            <div className="flex flex-wrap items-center gap-1 sm:gap-2">
                              <Link
                                to={`/tickets/${merged.id}`}
                                className="font-medium underline hover:text-blue-900 dark:hover:text-blue-200 flex-shrink-0"
                              >
                                #{merged.ticketNumber}
                              </Link>
                              <span className="text-blue-600 dark:text-blue-500 hidden sm:inline">-</span>
                              <span className="truncate max-w-full sm:max-w-xs">{merged.subject}</span>
                            </div>
                            {merged.mergedAt && (
                              <span className="text-xs text-blue-500 dark:text-blue-500 block sm:inline sm:ml-2">
                                merged {format(new Date(merged.mergedAt), 'MMM d, yyyy')}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* User Environment (3/4 width when merged tickets exist, full width otherwise) */}
              <div className={`${ticket.mergedTickets && ticket.mergedTickets.length > 0 ? 'lg:col-span-3' : ''} bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4`}>
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                  {ticket.userAgent ? (() => {
                    const deviceInfo = parseUserAgent(ticket.userAgent);
                    return deviceInfo.deviceType === 'Mobile' ? (
                      <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                    ) : deviceInfo.deviceType === 'Tablet' ? (
                      <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    );
                  })() : (
                    <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  )}
                  User Environment
                </h4>
                {(() => {
                  const deviceInfo = ticket.userAgent ? parseUserAgent(ticket.userAgent) : null;
                  const channelLabels: Record<string, string> = {
                    'EMAIL': 'Email',
                    'WEB': 'Web',
                    'API': 'API',
                    'SLACK': 'Slack',
                    'INTERNAL': 'Internal'
                  };
                  return (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 text-sm">
                      <div className="min-w-0">
                        <span className="text-gray-500 dark:text-gray-400 block text-xs sm:text-sm">Contacted By</span>
                        <span className="text-gray-900 dark:text-white font-medium truncate block">{channelLabels[ticket.channel] || ticket.channel}</span>
                      </div>
                      <div className="min-w-0">
                        <span className="text-gray-500 dark:text-gray-400 block text-xs sm:text-sm">Device</span>
                        <span className="text-gray-900 dark:text-white font-medium truncate block">{deviceInfo?.deviceType || 'Unknown'}</span>
                      </div>
                      <div className="min-w-0">
                        <span className="text-gray-500 dark:text-gray-400 block text-xs sm:text-sm">OS</span>
                        <span className="text-gray-900 dark:text-white font-medium truncate block">{deviceInfo?.os || 'Unknown'}</span>
                      </div>
                      <div className="min-w-0">
                        <span className="text-gray-500 dark:text-gray-400 block text-xs sm:text-sm">Browser</span>
                        <span className="text-gray-900 dark:text-white font-medium truncate block">{deviceInfo?.browser || 'Unknown'}</span>
                      </div>
                      <div className="min-w-0 col-span-2 sm:col-span-1">
                        <span className="text-gray-500 dark:text-gray-400 block text-xs sm:text-sm">Country</span>
                        <span className="text-gray-900 dark:text-white font-medium truncate block">
                          {getCountryDisplay(ticket.country || ticket.requester?.country, ticket.requester?.timezoneOffset)}{' '}
                          {(() => {
                            const tz = getTimezoneDisplay(ticket.requester?.timezoneOffset, ticket.country || ticket.requester?.country);
                            return tz !== '-' ? (
                              <span className="text-gray-500 dark:text-gray-400">
                                {tz.replace('GMT', 'UTC')}
                              </span>
                            ) : null;
                          })()}
                        </span>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {/* Related Ticket Info */}
          {ticket.relatedTicket && (
            <div className="mt-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 overflow-hidden">
              <div className="flex items-start gap-2">
                <svg className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-sm text-blue-800 dark:text-blue-300 min-w-0">
                  <span className="block sm:inline">Created from previous ticket:{' '}</span>
                  <Link
                    to={`/tickets/${ticket.relatedTicket.id}`}
                    className="font-medium underline hover:no-underline break-words"
                  >
                    #{ticket.relatedTicket.ticketNumber} - {ticket.relatedTicket.subject}
                  </Link>
                </span>
              </div>
            </div>
          )}

          {/* Follow-up Tickets */}
          {ticket.followUpTickets && ticket.followUpTickets.length > 0 && (
            <div className="mt-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <svg className="w-4 h-4 text-purple-600 dark:text-purple-400 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="flex-1">
                  <span className="text-sm font-medium text-purple-800 dark:text-purple-300">
                    Follow-up tickets created from this ticket:
                  </span>
                  <ul className="mt-1 space-y-1">
                    {ticket.followUpTickets.map((followUp: any) => (
                      <li key={followUp.id}>
                        <Link
                          to={`/tickets/${followUp.id}`}
                          className="text-sm text-purple-700 dark:text-purple-300 hover:underline"
                        >
                          #{followUp.ticketNumber} - {followUp.subject} ({followUp.status})
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Two-column layout for desktop */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* Left Column - Form Details, Macros, Activity Log (sticky on desktop) */}
          <div className="lg:col-span-1 space-y-6 lg:sticky lg:top-4 lg:self-start">
            {/* AI Summary Section - Agents and Admins only, when AI is enabled */}
            {(userRole === 'AGENT' || userRole === 'ADMIN') && aiSettings?.enabled && aiSettings?.configured && (
              <div className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-indigo-600 dark:text-indigo-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <h4 className="text-sm font-semibold text-indigo-800 dark:text-indigo-300">
                        AI Summary
                      </h4>
                      <button
                        onClick={() => generateSummaryMutation.mutate()}
                        disabled={generateSummaryMutation.isPending}
                        className="inline-flex items-center px-2 py-1 text-xs font-medium text-indigo-700 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-900/50 rounded hover:bg-indigo-200 dark:hover:bg-indigo-800/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {generateSummaryMutation.isPending ? (
                          <>
                            <svg className="animate-spin -ml-0.5 mr-1.5 h-3 w-3" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Generating...
                          </>
                        ) : ticket.aiSummary ? (
                          <>
                            <svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            Regenerate
                          </>
                        ) : (
                          <>
                            <svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                            Generate
                          </>
                        )}
                      </button>
                    </div>
                    {ticket.aiSummary ? (
                      <div>
                        <p className="text-sm text-indigo-700 dark:text-indigo-300 leading-relaxed">
                          {ticket.aiSummary}
                        </p>
                        {ticket.aiSummaryGeneratedAt && (
                          <p className="mt-2 text-xs text-indigo-500 dark:text-indigo-400">
                            Generated {format(new Date(ticket.aiSummaryGeneratedAt), 'MMM d, yyyy h:mm a')}
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-indigo-600 dark:text-indigo-400 italic">
                        Click "Generate" to create an AI-powered summary of this ticket.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Customer Feedback - Agents and Admins only */}
            {isAgent && ticket.feedback && (
              <TicketFeedback feedback={ticket.feedback} />
            )}

            {/* Internal Notes - Desktop only (agents/admins only) */}
            {isAgent && ticket.comments && ticket.comments.filter((c: any) => c.isInternal).length > 0 && (
              <div className="hidden lg:block bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                <button
                  onClick={() => setShowInternalNotes(!showInternalNotes)}
                  className="w-full flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Internal Notes</h3>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      ({ticket.comments.filter((c: any) => c.isInternal).length})
                    </span>
                  </div>
                  <svg
                    className={`w-5 h-5 text-gray-500 transition-transform ${showInternalNotes ? 'rotate-180' : ''}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {showInternalNotes && (
                  <div className="mt-4 max-h-64 overflow-y-auto space-y-3">
                    {ticket.comments
                      .filter((c: any) => c.isInternal)
                      .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                      .map((note: any) => (
                        <div key={note.id} className="p-3 bg-yellow-50 dark:bg-yellow-950/40 border border-yellow-200 dark:border-yellow-900/50 rounded-lg">
                          <div className="flex justify-between items-start mb-2">
                            <span className="text-sm font-medium text-gray-900 dark:text-white">
                              {note.author?.firstName || note.author?.lastName
                                ? `${note.author?.firstName || ''} ${note.author?.lastName || ''}`.trim()
                                : note.author?.email || 'Unknown'}
                            </span>
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {format(new Date(note.createdAt), 'MMM d, yyyy HH:mm')}
                            </span>
                          </div>
                          <div
                            className="text-sm text-gray-700 dark:text-gray-300 break-words [&_a]:text-blue-600 [&_a]:underline [&_a]:hover:text-blue-800 dark:[&_a]:text-blue-400 dark:[&_a]:hover:text-blue-300"
                            dangerouslySetInnerHTML={{ __html: note.body || note.bodyPlain }}
                          />
                        </div>
                      ))}
                  </div>
                )}
              </div>
            )}

            {/* Form Responses */}
            {ticket.formResponses && ticket.formResponses.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Form Submission Details
                </h3>
                <dl className="space-y-4">
                  {ticket.formResponses.map((response: any) => (
                    <div key={response.id} className="border-b border-gray-200 dark:border-gray-700 pb-3 last:border-b-0 last:pb-0">
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                        {response.field.label}
                        {response.field.required && <span className="text-red-500 ml-1">*</span>}
                      </dt>
                      <dd className="text-sm text-gray-900 dark:text-white break-words">
                        {response.value ? formatFormValue(response.value, response.field.options) : <span className="text-gray-400 dark:text-gray-500">-</span>}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}

            {/* Attachments Section */}
            {ticket.attachments && ticket.attachments.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Attachments ({ticket.attachments.length})
                </h3>
                <ul className="space-y-2">
                  {ticket.attachments.map((attachment: Attachment) => (
                    <li key={attachment.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                      <button
                        onClick={() => handleViewAttachment(attachment)}
                        className="flex items-center gap-3 flex-1 min-w-0 text-left"
                      >
                        {attachment.mimeType.startsWith('image/') ? (
                          <svg className="w-5 h-5 text-blue-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        ) : (
                          <svg className="w-5 h-5 text-purple-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        )}
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                            {attachment.filename}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {formatFileSize(attachment.fileSize)}
                          </p>
                        </div>
                      </button>
                      <button
                        onClick={() => handleDownloadAttachment(attachment)}
                        className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 flex-shrink-0"
                        title="Download"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Macro selector for agents - Desktop only in left column (not shown for closed tickets) */}
            {isAgent && macros && macros.length > 0 && !ticketClosed && (
              <div className="hidden lg:block bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Quick Reply</h3>
                <div>
                  <div className="relative mb-2">
                    <input
                      type="text"
                      value={macroFilter}
                      onChange={(e) => setMacroFilter(e.target.value)}
                      placeholder="Filter macros..."
                      className="w-full px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                    />
                    {macroFilter && (
                      <button
                        type="button"
                        onClick={() => setMacroFilter('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                  <div className="h-[176px] overflow-y-auto border border-gray-200 dark:border-gray-600 rounded-md">
                    {macros
                      .filter(macro =>
                        !macroFilter ||
                        macro.name.toLowerCase().includes(macroFilter.toLowerCase()) ||
                        (macro.category && macro.category.toLowerCase().includes(macroFilter.toLowerCase()))
                      )
                      .map((macro, index, filteredArr) => (
                        <button
                          key={macro.id}
                          type="button"
                          onClick={() => handleMacroSelect(macro)}
                          className={`w-full text-left px-3 py-2.5 text-sm hover:bg-primary/10 dark:hover:bg-primary/20 transition-colors ${
                            index !== filteredArr.length - 1 ? 'border-b border-gray-100 dark:border-gray-700' : ''
                          }`}
                        >
                          {macro.category && (
                            <span className="text-xs text-gray-500 dark:text-gray-400 mr-1">[{macro.category}]</span>
                          )}
                          <span className="text-gray-900 dark:text-white">{macro.name}</span>
                        </button>
                      ))}
                    {macros.filter(macro =>
                      !macroFilter ||
                      macro.name.toLowerCase().includes(macroFilter.toLowerCase()) ||
                      (macro.category && macro.category.toLowerCase().includes(macroFilter.toLowerCase()))
                    ).length === 0 && (
                      <div className="px-3 py-4 text-sm text-gray-500 dark:text-gray-400 text-center">
                        No macros found
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Problem/Incident Management - Desktop only (agents/admins only) */}
            {isAgent && (
              <div className="hidden lg:block bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Ticket Type</h3>

                {/* Type selector */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Type</label>
                  <div className="relative" ref={typeDropdownRef}>
                    <button
                      onClick={() => setShowTypeDropdown(!showTypeDropdown)}
                      disabled={updateTypeMutation.isPending}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary flex items-center justify-between disabled:opacity-50"
                    >
                      <span>
                        {(ticket.type || 'NORMAL') === 'NORMAL' && 'Normal'}
                        {ticket.type === 'PROBLEM' && 'Problem'}
                        {ticket.type === 'INCIDENT' && 'Incident'}
                      </span>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {showTypeDropdown && (
                      <div className="absolute top-full left-0 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg z-20">
                        {[
                          { value: 'NORMAL', label: 'Normal' },
                          { value: 'PROBLEM', label: 'Problem' },
                          { value: 'INCIDENT', label: 'Incident' },
                        ].map((type, index, arr) => (
                          <button
                            key={type.value}
                            onClick={() => {
                              updateTypeMutation.mutate(type.value);
                              setShowTypeDropdown(false);
                            }}
                            className={`w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-between ${index === 0 ? 'rounded-t-md' : ''} ${index === arr.length - 1 ? 'rounded-b-md' : ''}`}
                          >
                            <span>{type.label}</span>
                            {(ticket.type || 'NORMAL') === type.value && (
                              <svg className="w-4 h-4 text-primary" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* For INCIDENT tickets: show linked problem or link button */}
                {ticket.type === 'INCIDENT' && (
                  <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Linked Problem</label>
                    {ticket.problem ? (
                      <div className="flex items-center justify-between p-3 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg">
                        <Link
                          to={`/tickets/${ticket.problem.id}`}
                          className="text-sm text-purple-700 dark:text-purple-300 hover:underline"
                        >
                          #{ticket.problem.ticketNumber} - {ticket.problem.subject}
                        </Link>
                        <button
                          onClick={() => linkToProblemMutation.mutate(null)}
                          disabled={linkToProblemMutation.isPending}
                          className="text-red-500 hover:text-red-700 p-1"
                          title="Unlink from problem"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ) : (
                      <div>
                        {showProblemSearch ? (
                          <div className="space-y-2">
                            <input
                              type="text"
                              value={problemSearchQuery}
                              onChange={(e) => setProblemSearchQuery(e.target.value)}
                              placeholder="Search by ticket # or subject..."
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                            />
                            <div className="max-h-40 overflow-y-auto space-y-1">
                              {problemTickets && problemTickets.length > 0 ? (
                                problemTickets.map((problem: any) => (
                                  <button
                                    key={problem.id}
                                    onClick={() => {
                                      linkToProblemMutation.mutate(problem.id);
                                      setShowProblemSearch(false);
                                      setProblemSearchQuery('');
                                    }}
                                    className="w-full text-left p-2 text-sm rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                                  >
                                    <span className="font-medium">#{problem.ticketNumber}</span>
                                    <span className="text-gray-600 dark:text-gray-400 ml-2 truncate">{problem.subject}</span>
                                    <span className="text-xs text-gray-500 ml-2">({problem._count?.incidents || 0} incidents)</span>
                                  </button>
                                ))
                              ) : (
                                <p className="text-sm text-gray-500 dark:text-gray-400 p-2">
                                  {problemSearchQuery ? 'No problem tickets found' : 'Type to search...'}
                                </p>
                              )}
                            </div>
                            <button
                              onClick={() => {
                                setShowProblemSearch(false);
                                setProblemSearchQuery('');
                              }}
                              className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setShowProblemSearch(true)}
                            className="w-full px-3 py-2 border border-dashed border-gray-300 dark:border-gray-600 rounded-md text-sm text-gray-600 dark:text-gray-400 hover:border-primary hover:text-primary transition-colors"
                          >
                            + Link to Problem Ticket
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* For PROBLEM tickets: show linked incidents */}
                {ticket.type === 'PROBLEM' && (
                  <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Linked Incidents ({ticket.incidents?.length || 0})
                    </label>
                    {ticket.incidents && ticket.incidents.length > 0 ? (
                      <div className="max-h-48 overflow-y-auto space-y-2">
                        {ticket.incidents.map((incident: any) => (
                          <Link
                            key={incident.id}
                            to={`/tickets/${incident.id}`}
                            className="block p-2 bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-200 dark:border-cyan-800 rounded-lg hover:bg-cyan-100 dark:hover:bg-cyan-900/30 transition-colors"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium text-cyan-700 dark:text-cyan-300">
                                #{incident.ticketNumber}
                              </span>
                              <span className={`text-xs px-2 py-0.5 rounded-full ${
                                incident.status === 'SOLVED' || incident.status === 'CLOSED'
                                  ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                  : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                              }`}>
                                {incident.status}
                              </span>
                            </div>
                            <p className="text-xs text-gray-600 dark:text-gray-400 truncate mt-1">
                              {incident.subject}
                            </p>
                          </Link>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        No incidents linked to this problem yet.
                      </p>
                    )}
                    {ticket.incidents && ticket.incidents.length > 0 && ticket.status !== 'SOLVED' && ticket.status !== 'CLOSED' && (
                      <p className="mt-3 text-xs text-purple-600 dark:text-purple-400">
                        Solving this problem will auto-solve all {ticket.incidents.length} linked incident{ticket.incidents.length !== 1 ? 's' : ''}.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Activity Log - Desktop only (agents/admins only) */}
            {isAgent && ticket.activities && ticket.activities.length > 0 && (
              <div className="hidden lg:block bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                <button
                  onClick={() => setShowActivityLog(!showActivityLog)}
                  className="w-full flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Activity Log</h3>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      ({ticket.activities.length})
                    </span>
                  </div>
                  <svg
                    className={`w-5 h-5 text-gray-500 transition-transform ${showActivityLog ? 'rotate-180' : ''}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {showActivityLog && (
                  <div className="mt-4 max-h-64 overflow-y-auto space-y-3">
                    {ticket.activities.map((activity: any) => (
                      <div key={activity.id} className="flex items-start gap-3 text-sm">
                        <div className="w-2 h-2 mt-1.5 rounded-full bg-primary flex-shrink-0"></div>
                        <div className="flex-1 min-w-0">
                          <div className="text-gray-700 dark:text-gray-300">
                            {activity.user && (
                              <span className="font-medium text-gray-900 dark:text-white">
                                {activity.user.firstName || activity.user.lastName
                                  ? `${activity.user.firstName || ''} ${activity.user.lastName || ''}`.trim()
                                  : activity.user.email}
                              </span>
                            )}
                            {activity.user ? ' - ' : ''}
                            {formatActivityMessage(activity.action, activity.details)}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            {format(new Date(activity.createdAt), 'MMM d, yyyy HH:mm:ss')}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Column - Conversation and Reply */}
          <div className="lg:col-span-2 space-y-6">
            {/* Comments/Conversation */}
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
              {(() => {
                const filteredComments = ticket.comments
                  .filter((comment: any) => isAgent || !comment.isInternal)
                  .reverse();
                const totalComments = filteredComments.length;
                const visibleComments = filteredComments.slice(0, visibleCommentsCount);
                const hasMore = totalComments > visibleCommentsCount;

                return (
                  <>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Conversation</h3>
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        {totalComments} {totalComments === 1 ? 'message' : 'messages'}
                      </span>
                    </div>
                    <div className="space-y-6">
                      {visibleComments.map((comment: any) => {
                    // Determine message style based on author and type
                    const isFromRequester = comment.author?.id === ticket.requester?.id;
                    let messageStyle = '';
                    let borderAccent = '';
                    if (comment.isInternal) {
                      // Internal notes: yellow with left accent
                      messageStyle = 'bg-yellow-50 dark:bg-yellow-950/40 border-l-4 border-l-yellow-400 dark:border-l-yellow-500';
                      borderAccent = 'border border-yellow-200 dark:border-yellow-900/50';
                    } else if (isFromRequester) {
                      // User/requester messages: blue with left accent
                      messageStyle = 'bg-blue-50 dark:bg-slate-800 border-l-4 border-l-blue-400 dark:border-l-blue-500';
                      borderAccent = 'border border-blue-200 dark:border-slate-600';
                    } else {
                      // Agent/admin messages: gray with left accent
                      messageStyle = 'bg-gray-50 dark:bg-gray-700/70 border-l-4 border-l-gray-400 dark:border-l-gray-500';
                      borderAccent = 'border border-gray-200 dark:border-gray-600';
                    }
                    return (
                    <div
                      key={comment.id}
                      className={`p-5 rounded-lg ${messageStyle} ${borderAccent}`}
                    >
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-900 dark:text-gray-100">
                          {comment.author.firstName || comment.author.lastName
                            ? `${comment.author.firstName || ''} ${comment.author.lastName || ''}`.trim()
                            : comment.author.email}
                        </span>
                        {comment.isInternal && (
                          <span className="px-2 py-0.5 bg-yellow-200 dark:bg-yellow-700 text-yellow-800 dark:text-yellow-100 text-xs font-medium rounded-full">
                            Internal
                          </span>
                        )}
                        {comment.isSystem && (
                          <span className="px-2 py-0.5 bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-100 text-xs font-medium rounded-full">
                            System
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                        {format(new Date(comment.createdAt), 'MMM d, yyyy HH:mm')}
                      </span>
                    </div>
                    <div
                      className="comment-content text-sm max-w-none break-words overflow-hidden [&_p]:mb-2 [&_p:last-child]:mb-0"
                      dangerouslySetInnerHTML={{ __html: comment.body || comment.bodyPlain }}
                    />
                  </div>
                        );
                      })}

                      {/* AI Suggestion shown during ticket creation - displayed at the bottom as it was shown before user submitted */}
                      {ticket.shownAiSuggestion && (
                        <div className="p-5 rounded-lg bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 border-l-4 border-l-purple-500 dark:border-l-purple-400 border border-purple-200 dark:border-purple-800/50">
                          <div className="flex justify-between items-start mb-3">
                            <div className="flex items-center gap-2">
                              <svg className="w-5 h-5 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                              </svg>
                              <span className="font-semibold text-purple-800 dark:text-purple-300">
                                AI Suggestion
                              </span>
                              <span className="px-2 py-0.5 bg-purple-200 dark:bg-purple-700 text-purple-800 dark:text-purple-100 text-xs font-medium rounded-full">
                                Shown at ticket creation
                              </span>
                            </div>
                            <span className="text-xs text-purple-600 dark:text-purple-400">
                              {format(new Date(ticket.createdAt), 'MMM d, yyyy HH:mm')}
                            </span>
                          </div>
                          <div className="prose prose-sm max-w-none text-purple-900 dark:text-purple-100 whitespace-pre-wrap">
                            {ticket.shownAiSuggestion}
                          </div>
                        </div>
                      )}
                    </div>
                    {/* Show more button */}
                    {hasMore && (
                      <div className="mt-6 text-center">
                        <button
                          onClick={() => setVisibleCommentsCount(prev => prev + 5)}
                          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                          Show more ({totalComments - visibleCommentsCount} remaining)
                        </button>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>

            {/* Reply form */}
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Add Reply</h3>

              {/* Show closed message when ticket status is CLOSED (for everyone) or when ticket is closed for replies (for users) */}
              {ticket.status === 'CLOSED' || (ticketClosed && !isAgent) ? (
                <div className="space-y-4">
                  <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <svg className="w-5 h-5 text-orange-600 dark:text-orange-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      <div>
                        <h4 className="text-sm font-semibold text-orange-800 dark:text-orange-300 mb-1">
                          This ticket is {ticket.status === 'CLOSED' ? 'closed' : 'closed for replies'}
                        </h4>
                        <p className="text-sm text-orange-700 dark:text-orange-400">
                          {ticket.status === 'CLOSED'
                            ? 'This ticket has been closed. You cannot add replies to closed tickets.'
                            : 'This ticket has been solved for more than 48 hours and is now closed for replies.'
                          }
                        </p>
                      </div>
                    </div>
                  </div>
                  {ticket.status === 'CLOSED' && (
                    <div className="text-center">
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                        Need further assistance on the same subject? Create a follow-up ticket.
                      </p>
                      <Link
                        to={`/tickets/new?relatedTicketId=${ticket.id}`}
                        className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium bg-primary text-primary-foreground hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-colors"
                      >
                        <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Create Follow-up Ticket
                      </Link>
                    </div>
                  )}
                </div>
              ) : (
                <form onSubmit={handleReply} className="space-y-4">
                  {/* Macro selector for agents - Mobile only (shown inline, not for closed tickets) */}
                  {isAgent && macros && macros.length > 0 && !ticketClosed && (
                    <div className="lg:hidden">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Select a Macro
                      </label>
                      <div className="max-h-40 overflow-y-auto border border-gray-200 dark:border-gray-600 rounded-md">
                        {macros.map((macro, index) => (
                          <button
                            key={macro.id}
                            type="button"
                            onClick={() => handleMacroSelect(macro)}
                            className={`w-full text-left px-3 py-2.5 text-sm hover:bg-primary/10 dark:hover:bg-primary/20 transition-colors ${
                              index !== macros.length - 1 ? 'border-b border-gray-100 dark:border-gray-700' : ''
                            }`}
                          >
                            {macro.category && (
                              <span className="text-xs text-gray-500 dark:text-gray-400 mr-1">[{macro.category}]</span>
                            )}
                            <span className="text-gray-900 dark:text-white">{macro.name}</span>
                          </button>
                        ))}
                      </div>
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        Click a macro to fill the reply field.
                      </p>
                    </div>
                  )}

                  {isAgent ? (
                    <MentionableRichTextEditor
                      value={replyBody}
                      onChange={setReplyBody}
                      onMentionsChange={setMentionedUserIds}
                      placeholder={isInternal ? "Type your internal note here... (@ to mention)" : "Type your reply here... (@ to mention)"}
                      minHeight="240px"
                      resizable
                      isInternal={isInternal}
                      enableMentions={true}
                    />
                  ) : (
                    <RichTextEditor
                      value={replyBody}
                      onChange={setReplyBody}
                      placeholder="Type your reply here..."
                      minHeight="240px"
                      resizable
                    />
                  )}

                  <div className="flex justify-between items-center">
                    {isAgent && (
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={isInternal}
                          onChange={(e) => setIsInternal(e.target.checked)}
                          className="rounded border-gray-300 dark:border-gray-600 text-primary focus:ring-primary"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">Internal note (not visible to customer)</span>
                      </label>
                    )}

                    {/* Submit button with status dropdown for agents */}
                    {isAgent && !isInternal ? (
                      <div className="ml-auto relative" ref={submitDropdownRef}>
                        {(() => {
                          const statusColors: Record<string, { bg: string; border: string; ring: string }> = {
                            OPEN: { bg: 'bg-red-500 hover:bg-red-600', border: 'border-red-400', ring: 'ring-red-500' },
                            PENDING: { bg: 'bg-blue-500 hover:bg-blue-600', border: 'border-blue-400', ring: 'ring-blue-500' },
                            ON_HOLD: { bg: 'bg-gray-500 hover:bg-gray-600', border: 'border-gray-400', ring: 'ring-gray-500' },
                            SOLVED: { bg: 'bg-green-500 hover:bg-green-600', border: 'border-green-400', ring: 'ring-green-500' }
                          };
                          const colors = statusColors[submitStatus] || statusColors.PENDING;
                          return (
                            <div className="flex">
                              <button
                                type="submit"
                                disabled={replyMutation.isPending}
                                className={`inline-flex items-center px-4 py-2 border border-transparent rounded-l-md shadow-sm text-sm font-medium text-white ${colors.bg} focus:outline-none focus:ring-2 focus:ring-offset-2 focus:${colors.ring} disabled:opacity-50 disabled:cursor-not-allowed transition-colors`}
                              >
                                {replyMutation.isPending ? 'Sending...' : `Submit as ${submitStatus === 'ON_HOLD' ? 'On-hold' : submitStatus.charAt(0) + submitStatus.slice(1).toLowerCase()}`}
                              </button>
                              <button
                                type="button"
                                onClick={() => setShowSubmitDropdown(!showSubmitDropdown)}
                                className={`inline-flex items-center px-2 py-2 border-l ${colors.border} rounded-r-md text-white ${colors.bg} focus:outline-none focus:ring-2 focus:ring-offset-2 focus:${colors.ring} transition-colors`}
                              >
                                <svg className={`w-4 h-4 transition-transform ${showSubmitDropdown ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                </svg>
                              </button>
                            </div>
                          );
                        })()}

                        {/* Status dropdown */}
                        {showSubmitDropdown && (
                          <div className="absolute right-0 bottom-full mb-2 w-40 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-10">
                            {[
                              { value: 'OPEN', label: 'Open', color: 'bg-red-500' },
                              { value: 'PENDING', label: 'Pending', color: 'bg-blue-500' },
                              { value: 'ON_HOLD', label: 'On-hold', color: 'bg-gray-500' },
                              { value: 'SOLVED', label: 'Solved', color: 'bg-green-500' }
                            ].map((status) => (
                              <button
                                key={status.value}
                                type="button"
                                onClick={() => {
                                  setSubmitStatus(status.value);
                                  setShowSubmitDropdown(false);
                                }}
                                className={`w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 ${submitStatus === status.value ? 'bg-gray-100 dark:bg-gray-700' : ''}`}
                              >
                                <span className={`w-3 h-3 rounded-sm ${status.color}`}></span>
                                {status.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <button
                        type="submit"
                        disabled={replyMutation.isPending}
                        className="ml-auto inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium bg-primary text-primary-foreground hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {replyMutation.isPending ? 'Sending...' : (isInternal ? 'Send Internal Note' : 'Send Reply')}
                      </button>
                    )}
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>

        {/* Internal Notes - Mobile only (at bottom, agents/admins only) */}
        {isAgent && ticket.comments && ticket.comments.filter((c: any) => c.isInternal).length > 0 && (
          <div className="lg:hidden bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <button
              onClick={() => setShowInternalNotes(!showInternalNotes)}
              className="w-full flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Internal Notes</h3>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  ({ticket.comments.filter((c: any) => c.isInternal).length})
                </span>
              </div>
              <svg
                className={`w-5 h-5 text-gray-500 transition-transform ${showInternalNotes ? 'rotate-180' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {showInternalNotes && (
              <div className="mt-4 max-h-64 overflow-y-auto space-y-3">
                {ticket.comments
                  .filter((c: any) => c.isInternal)
                  .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                  .map((note: any) => (
                    <div key={note.id} className="p-3 bg-yellow-50 dark:bg-yellow-950/40 border border-yellow-200 dark:border-yellow-900/50 rounded-lg">
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {note.author?.firstName || note.author?.lastName
                            ? `${note.author?.firstName || ''} ${note.author?.lastName || ''}`.trim()
                            : note.author?.email || 'Unknown'}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {format(new Date(note.createdAt), 'MMM d, yyyy HH:mm')}
                        </span>
                      </div>
                      <div
                        className="text-sm text-gray-700 dark:text-gray-300 break-words [&_a]:text-blue-600 [&_a]:underline [&_a]:hover:text-blue-800 dark:[&_a]:text-blue-400 dark:[&_a]:hover:text-blue-300"
                        dangerouslySetInnerHTML={{ __html: note.body || note.bodyPlain }}
                      />
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}

        {/* Activity Log - Mobile only (at bottom, agents/admins only) */}
        {isAgent && ticket.activities && ticket.activities.length > 0 && (
          <div className="lg:hidden bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <button
              onClick={() => setShowActivityLog(!showActivityLog)}
              className="w-full flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Activity Log</h3>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  ({ticket.activities.length})
                </span>
              </div>
              <svg
                className={`w-5 h-5 text-gray-500 transition-transform ${showActivityLog ? 'rotate-180' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {showActivityLog && (
              <div className="mt-4 max-h-64 overflow-y-auto space-y-3">
                {ticket.activities.map((activity: any) => (
                  <div key={activity.id} className="flex items-start gap-3 text-sm">
                    <div className="w-2 h-2 mt-1.5 rounded-full bg-primary flex-shrink-0"></div>
                    <div className="flex-1 min-w-0">
                      <div className="text-gray-700 dark:text-gray-300">
                        {activity.user && (
                          <span className="font-medium text-gray-900 dark:text-white">
                            {activity.user.firstName || activity.user.lastName
                              ? `${activity.user.firstName || ''} ${activity.user.lastName || ''}`.trim()
                              : activity.user.email}
                          </span>
                        )}
                        {activity.user ? ' - ' : ''}
                        {formatActivityMessage(activity.action, activity.details)}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {format(new Date(activity.createdAt), 'MMM d, yyyy HH:mm:ss')}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Attachment Preview Modal */}
        {selectedAttachment && (
          <div
            className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-2 sm:p-4"
            onClick={() => setSelectedAttachment(null)}
          >
            <div
              className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between p-3 sm:p-4 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                  {selectedAttachment.mimeType.startsWith('image/') ? (
                    <svg className="w-5 h-5 text-blue-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5 text-purple-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  )}
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm sm:text-lg font-semibold text-gray-900 dark:text-white truncate">
                      {selectedAttachment.filename}
                    </h3>
                    <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                      {formatFileSize(selectedAttachment.fileSize)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                  <button
                    onClick={() => handleDownloadAttachment(selectedAttachment)}
                    className="p-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
                    title="Download"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setSelectedAttachment(null)}
                    className="p-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
                    title="Close"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Modal Content */}
              <div className="p-2 sm:p-4 overflow-auto max-h-[calc(90vh-80px)] flex items-center justify-center bg-gray-100 dark:bg-gray-900">
                {selectedAttachment.mimeType.startsWith('image/') ? (
                  <img
                    src={`${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}/attachments/${selectedAttachment.id}/view`}
                    alt={selectedAttachment.filename}
                    className="max-w-full max-h-[70vh] object-contain rounded"
                    crossOrigin="use-credentials"
                    onLoad={() => setAttachmentLoading(false)}
                    onError={() => {
                      setAttachmentLoading(false);
                      toast.error('Failed to load image');
                    }}
                  />
                ) : selectedAttachment.mimeType.startsWith('video/') ? (
                  <video
                    src={`${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}/attachments/${selectedAttachment.id}/view`}
                    controls
                    className="max-w-full max-h-[70vh] rounded"
                    crossOrigin="use-credentials"
                    onLoadedData={() => setAttachmentLoading(false)}
                    onError={() => {
                      setAttachmentLoading(false);
                      toast.error('Failed to load video');
                    }}
                  >
                    Your browser does not support the video tag.
                  </video>
                ) : (
                  <div className="text-center py-8">
                    <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <p className="text-gray-600 dark:text-gray-400 mb-4">Preview not available for this file type</p>
                    <button
                      onClick={() => handleDownloadAttachment(selectedAttachment)}
                      className="inline-flex items-center px-4 py-2 bg-primary text-primary-foreground rounded-md hover:opacity-90"
                    >
                      <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      Download File
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Merge Tickets Modal */}
        {showMergeModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2 sm:p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-lg w-full overflow-hidden max-h-[90vh] flex flex-col">
              {/* Modal Header */}
              <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
                <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 bg-primary/10 dark:bg-primary/20 rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 sm:w-5 sm:h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">Merge Ticket</h3>
                    <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 truncate">
                      Merge #{ticket?.ticketNumber} into another ticket
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowMergeModal(false);
                    setSelectedMergeTarget(null);
                    setMergeComment('');
                  }}
                  className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex-shrink-0"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Modal Content */}
              <div className="p-4 sm:p-6 overflow-y-auto flex-1">
                <div className="mb-4">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                    This ticket will be closed and merged into the selected target ticket.
                    <span className="text-orange-600 dark:text-orange-400 font-medium"> This action cannot be undone.</span>
                  </p>
                </div>

                {/* Merge candidates list */}
                <div className="space-y-2 mb-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Open tickets from the same requester:
                  </label>
                  {mergeCandidates && mergeCandidates.length > 0 ? (
                    mergeCandidates.map((candidate: any) => (
                      <label
                        key={candidate.id}
                        className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                          selectedMergeTarget === candidate.id
                            ? 'border-primary bg-primary/5 dark:bg-primary/10'
                            : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                        }`}
                      >
                        <input
                          type="radio"
                          name="mergeTarget"
                          value={candidate.id}
                          checked={selectedMergeTarget === candidate.id}
                          onChange={() => setSelectedMergeTarget(candidate.id)}
                          className="mt-0.5 w-4 h-4 text-primary border-gray-300 focus:ring-primary"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-gray-900 dark:text-white">
                              #{candidate.ticketNumber}
                            </span>
                            <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                              candidate.status === 'NEW' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' :
                              candidate.status === 'OPEN' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' :
                              candidate.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' :
                              'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                            }`}>
                              {candidate.status.replace('_', ' ')}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
                            {candidate.subject}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                            {format(new Date(candidate.createdAt), 'MMM d, yyyy')} · {candidate._count?.comments || 0} comments
                          </p>
                        </div>
                      </label>
                    ))
                  ) : (
                    <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                      <svg className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <p>No other open tickets from this requester</p>
                    </div>
                  )}
                </div>

                {/* Optional merge comment */}
                {selectedMergeTarget && (
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Add a note (optional):
                    </label>
                    <textarea
                      value={mergeComment}
                      onChange={(e) => setMergeComment(e.target.value)}
                      placeholder="Why are these tickets being merged?"
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-end gap-2 sm:gap-3 px-4 sm:px-6 py-3 sm:py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex-shrink-0">
                <button
                  onClick={() => {
                    setShowMergeModal(false);
                    setSelectedMergeTarget(null);
                    setMergeComment('');
                  }}
                  className="px-3 sm:px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (selectedMergeTarget && id) {
                      mergeMutation.mutate({
                        sourceTicketIds: [id],
                        targetTicketId: selectedMergeTarget,
                        mergeComment: mergeComment || undefined
                      });
                    }
                  }}
                  disabled={!selectedMergeTarget || mergeMutation.isPending}
                  className="px-3 sm:px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                >
                  {mergeMutation.isPending ? (
                    <>
                      <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <span className="hidden sm:inline">Merging...</span>
                    </>
                  ) : (
                    <span>Merge</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Mark as Scam Confirmation Modal */}
        {showScamModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2 sm:p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full overflow-hidden">
              {/* Modal Header */}
              <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 bg-red-100 dark:bg-red-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 sm:w-5 sm:h-5 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">Mark as Scam</h3>
                    <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                      This action cannot be undone
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowScamModal(false)}
                  className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Modal Content */}
              <div className="p-4 sm:p-6">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Are you sure you want to mark this ticket as scam? This will:
                </p>
                <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-2 mb-4">
                  <li className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                    </svg>
                    <span>Block the user: <strong className="text-gray-900 dark:text-white">{ticket?.requester?.email}</strong></span>
                  </li>
                  <li className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    <span>Delete this ticket permanently</span>
                  </li>
                </ul>
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                  <p className="text-sm text-red-700 dark:text-red-300 font-medium">
                    The blocked user will not be able to create new tickets.
                  </p>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-end gap-2 sm:gap-3 px-4 sm:px-6 py-3 sm:py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                <button
                  onClick={() => setShowScamModal(false)}
                  className="px-3 sm:px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    markAsScamMutation.mutate();
                    setShowScamModal(false);
                  }}
                  disabled={markAsScamMutation.isPending}
                  className="px-3 sm:px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                >
                  {markAsScamMutation.isPending ? (
                    <>
                      <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <span>Processing...</span>
                    </>
                  ) : (
                    <span>Mark as Scam & Block User</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      <style>{`
        .comment-content,
        .comment-content * {
          color: rgb(31 41 55) !important;
        }
        .dark .comment-content,
        .dark .comment-content * {
          color: rgb(229 231 235) !important;
        }
        .comment-content a {
          color: rgb(37 99 235) !important;
          text-decoration: underline;
        }
        .dark .comment-content a {
          color: rgb(96 165 250) !important;
        }
      `}</style>
    </Layout>
  );
};

export default TicketDetail;
