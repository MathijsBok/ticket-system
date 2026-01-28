import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useUser } from '@clerk/clerk-react';
import toast from 'react-hot-toast';
import { ticketApi, commentApi, userApi, macroApi, attachmentApi } from '../lib/api';
import { Macro, Attachment } from '../types';
import { useView } from '../contexts/ViewContext';
import Layout from '../components/Layout';
import RichTextEditor from '../components/RichTextEditor';
import MentionableRichTextEditor from '../components/MentionableRichTextEditor';
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
  const { currentView } = useView();
  // Default to 'USER' role if no role is set (new users)
  const userRole = (user?.publicMetadata?.role as string) || 'USER';

  const [replyBody, setReplyBody] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [macroFilter, setMacroFilter] = useState('');
  const [showAssignDropdown, setShowAssignDropdown] = useState(false);
  const [mentionedUserIds, setMentionedUserIds] = useState<string[]>([]);
  const [selectedAttachment, setSelectedAttachment] = useState<Attachment | null>(null);
  const [attachmentLoading, setAttachmentLoading] = useState(false);

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

  const handleMacroSelect = (macro: Macro) => {
    const processedContent = replaceMacroPlaceholders(macro.content);
    setReplyBody(processedContent);
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
      const response = await ticketApi.update(id!, { assigneeId });
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

  const handleReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (isHtmlEmpty(replyBody)) {
      toast.error('Reply cannot be empty');
      return;
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

  // Determine if user should see agent controls based on role and view context
  const effectiveRole = userRole === 'ADMIN' ? currentView : userRole;
  const isAgent = effectiveRole === 'AGENT' || effectiveRole === 'ADMIN';

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
      <div className="space-y-6">
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
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex justify-between items-start mb-4">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Ticket #{ticket.ticketNumber}
            </h1>

            <div className="flex items-center gap-3">
              <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(ticket.status)}`}>
                {ticket.status.replace('_', ' ')}
              </span>

              {/* Agent actions */}
              {isAgent && (
                <>
                  {!ticket.assignee && (
                    <button
                      onClick={() => assignToMeMutation.mutate()}
                      disabled={assignToMeMutation.isPending}
                      className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:opacity-90 text-sm font-medium disabled:opacity-50 transition-colors"
                    >
                      Assign to Me
                    </button>
                  )}
                  {/* Assign to Agent dropdown */}
                  <div className="relative">
                    <button
                      onClick={() => setShowAssignDropdown(!showAssignDropdown)}
                      className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-primary transition-colors flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      Assign
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
                        <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-lg z-20 max-h-64 overflow-y-auto">
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
                                <span>
                                  {agent.firstName || agent.lastName
                                    ? `${agent.firstName || ''} ${agent.lastName || ''}`.trim()
                                    : agent.email}
                                </span>
                                {ticket.assigneeId === agent.id && (
                                  <svg className="w-4 h-4 text-primary" fill="currentColor" viewBox="0 0 20 20">
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
                  <select
                    value={ticket.status}
                    onChange={handleStatusChange}
                    disabled={updateStatusMutation.isPending}
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="NEW">New</option>
                    <option value="OPEN">Open</option>
                    <option value="PENDING">Pending</option>
                    <option value="ON_HOLD">On Hold</option>
                    <option value="SOLVED">Solved</option>
                    <option value="CLOSED">Closed</option>
                  </select>
                </>
              )}
            </div>
          </div>

          <div className="flex justify-between items-center">
            <h2 className="text-xl text-gray-700 dark:text-gray-300">{ticket.subject}</h2>

            {/* Create Follow-up Ticket Button */}
            {ticket.status === 'CLOSED' && (
              <Link
                to={`/tickets/new?relatedTicketId=${ticket.id}`}
                className="inline-flex items-center px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-colors"
              >
                <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Create Follow-up Ticket
              </Link>
            )}
          </div>

          {/* Closed ticket warning */}
          {ticketClosed && !isAgent && (
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

          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-gray-600 dark:text-gray-400">
            <div>
              <span className="font-medium">Created:</span> {format(new Date(ticket.createdAt), 'MMM d, yyyy HH:mm')}
            </div>
            {ticket.updatedAt && ticket.updatedAt !== ticket.createdAt && (
              <div>
                <span className="font-medium">Updated:</span> {format(new Date(ticket.updatedAt), 'MMM d, yyyy HH:mm')}
              </div>
            )}
            {ticket.solvedAt && (
              <div>
                <span className="font-medium">Solved:</span> {format(new Date(ticket.solvedAt), 'MMM d, yyyy HH:mm')}
              </div>
            )}
            <div>
              <span className="font-medium">Priority:</span> <span className="capitalize">{ticket.priority.toLowerCase()}</span>
            </div>
            {ticket.category && (
              <div>
                <span className="font-medium">Category:</span> {ticket.category.name}
              </div>
            )}
            <div>
              <span className="font-medium">Requester:</span> {
                ticket.requester.firstName || ticket.requester.lastName
                  ? `${ticket.requester.firstName || ''} ${ticket.requester.lastName || ''}`.trim()
                  : ticket.requester.email
              }
              <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">({ticket.requester.email})</span>
            </div>
            {ticket.assignee && (
              <div>
                <span className="font-medium">Assigned to:</span> {
                  ticket.assignee.firstName || ticket.assignee.lastName
                    ? `${ticket.assignee.firstName || ''} ${ticket.assignee.lastName || ''}`.trim()
                    : ticket.assignee.email
                }
              </div>
            )}
          </div>

          {/* Related Ticket Info */}
          {ticket.relatedTicket && (
            <div className="mt-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-sm text-blue-800 dark:text-blue-300">
                  Created from previous ticket:{' '}
                  <Link
                    to={`/tickets/${ticket.relatedTicket.id}`}
                    className="font-medium underline hover:no-underline"
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
          <div className="lg:col-span-1 space-y-6 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto lg:pb-4">
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

            {/* Activity Log - Desktop only (agents/admins only) */}
            {isAgent && ticket.activities && ticket.activities.length > 0 && (
              <div className="hidden lg:block bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Activity Log</h3>
                <div className="space-y-3">
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
              </div>
            )}
          </div>

          {/* Right Column - Conversation and Reply */}
          <div className="lg:col-span-2 space-y-6">
            {/* Comments/Conversation */}
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Conversation</h3>
              <div className="space-y-6">
                {ticket.comments
                  .filter((comment: any) => isAgent || !comment.isInternal)
                  .reverse()
                  .map((comment: any) => {
                    // Determine message style based on author and type
                    const isFromRequester = comment.author?.id === ticket.requester?.id;
                    let messageStyle = '';
                    if (comment.isInternal) {
                      // Internal notes: yellow
                      messageStyle = 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800';
                    } else if (isFromRequester) {
                      // User/requester messages: light blue
                      messageStyle = 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800';
                    } else {
                      // Agent/admin messages: light gray
                      messageStyle = 'bg-gray-100 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600';
                    }
                    return (
                    <div
                      key={comment.id}
                      className={`p-4 rounded-lg ${messageStyle}`}
                    >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900 dark:text-white">
                          {comment.author.firstName || comment.author.lastName
                            ? `${comment.author.firstName || ''} ${comment.author.lastName || ''}`.trim()
                            : comment.author.email}
                        </span>
                        {comment.isInternal && (
                          <span className="px-2 py-0.5 bg-yellow-200 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-200 text-xs rounded-full">
                            Internal
                          </span>
                        )}
                        {comment.isSystem && (
                          <span className="px-2 py-0.5 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 text-xs rounded-full">
                            System
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {format(new Date(comment.createdAt), 'MMM d, yyyy HH:mm')}
                      </span>
                    </div>
                    <div
                      className="text-sm text-gray-700 dark:text-gray-300 prose prose-sm dark:prose-invert max-w-none break-words overflow-hidden"
                      dangerouslySetInnerHTML={{ __html: comment.body || comment.bodyPlain }}
                    />
                  </div>
                    );
                  })}
              </div>
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
                    <button
                      type="submit"
                      disabled={replyMutation.isPending}
                      className="ml-auto inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium bg-primary text-primary-foreground hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {replyMutation.isPending ? 'Sending...' : (isInternal ? 'Send Internal Note' : 'Send Reply')}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>

        {/* Activity Log - Mobile only (at bottom, agents/admins only) */}
        {isAgent && ticket.activities && ticket.activities.length > 0 && (
          <div className="lg:hidden bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Activity Log</h3>
            <div className="space-y-3">
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
          </div>
        )}

        {/* Attachment Preview Modal */}
        {selectedAttachment && (
          <div
            className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedAttachment(null)}
          >
            <div
              className="bg-white dark:bg-gray-800 rounded-lg max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-3 min-w-0">
                  {selectedAttachment.mimeType.startsWith('image/') ? (
                    <svg className="w-5 h-5 text-blue-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5 text-purple-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  )}
                  <div className="min-w-0">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
                      {selectedAttachment.filename}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {formatFileSize(selectedAttachment.fileSize)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
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
              <div className="p-4 overflow-auto max-h-[calc(90vh-80px)] flex items-center justify-center bg-gray-100 dark:bg-gray-900">
                {selectedAttachment.mimeType.startsWith('image/') ? (
                  <img
                    src={`${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}/attachments/${selectedAttachment.id}/view`}
                    alt={selectedAttachment.filename}
                    className="max-w-full max-h-[70vh] object-contain rounded"
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
      </div>
    </Layout>
  );
};

export default TicketDetail;
