import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useUser } from '@clerk/clerk-react';
import toast from 'react-hot-toast';
import { ticketApi, commentApi, userApi, macroApi } from '../lib/api';
import { Macro } from '../types';
import { useView } from '../contexts/ViewContext';
import Layout from '../components/Layout';
import { format } from 'date-fns';

const TicketDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useUser();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { currentView } = useView();
  const userRole = user?.publicMetadata?.role as string;

  const [replyBody, setReplyBody] = useState('');
  const [isInternal, setIsInternal] = useState(false);

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

  const replyMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await commentApi.create(data);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Reply sent successfully');
      setReplyBody('');
      setIsInternal(false);
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

  const handleReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyBody.trim()) {
      toast.error('Reply cannot be empty');
      return;
    }

    replyMutation.mutate({
      ticketId: id!,
      body: replyBody,
      bodyPlain: replyBody,
      isInternal
    });
  };

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newStatus = e.target.value;
    if (newStatus && newStatus !== ticket?.status) {
      updateStatusMutation.mutate(newStatus);
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      NEW: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      OPEN: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      PENDING: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      ON_HOLD: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
      SOLVED: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
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
          onClick={() => {
            // Navigate back to the appropriate dashboard based on current view
            if (userRole === 'ADMIN') {
              switch (currentView) {
                case 'USER':
                  navigate('/user');
                  break;
                case 'AGENT':
                  navigate('/agent');
                  break;
                case 'ADMIN':
                  navigate('/admin');
                  break;
                default:
                  navigate(-1);
              }
            } else {
              navigate(-1);
            }
          }}
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

          <div className="mt-4 flex gap-6 text-sm text-gray-600 dark:text-gray-400">
            <div>
              <span className="font-medium">Created:</span> {format(new Date(ticket.createdAt), 'MMM d, yyyy HH:mm')}
            </div>
            <div>
              <span className="font-medium">Priority:</span> <span className="capitalize">{ticket.priority.toLowerCase()}</span>
            </div>
            <div>
              <span className="font-medium">Requester:</span> {
                ticket.requester.firstName || ticket.requester.lastName
                  ? `${ticket.requester.firstName || ''} ${ticket.requester.lastName || ''}`.trim()
                  : ticket.requester.email
              }
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

        {/* Form Responses */}
        {ticket.formResponses && ticket.formResponses.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Form Submission Details
            </h3>
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {ticket.formResponses.map((response: any) => (
                <div key={response.id} className="border-b border-gray-200 dark:border-gray-700 pb-3">
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                    {response.field.label}
                    {response.field.required && <span className="text-red-500 ml-1">*</span>}
                  </dt>
                  <dd className="text-sm text-gray-900 dark:text-white break-words">
                    {response.value || <span className="text-gray-400 dark:text-gray-500">-</span>}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        )}

        {/* Comments/Conversation */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Conversation</h3>
          <div className="space-y-6">
            {ticket.comments
              .filter((comment: any) => isAgent || !comment.isInternal)
              .reverse()
              .map((comment: any) => (
                <div
                  key={comment.id}
                  className={`p-4 rounded-lg ${
                    comment.isInternal
                      ? 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800'
                      : 'bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600'
                  }`}
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
                <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                  {comment.bodyPlain}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Reply form */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Add Reply</h3>

          {/* Show closed message for non-agents when ticket is closed */}
          {ticketClosed && !isAgent ? (
            <div className="space-y-4">
              <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-orange-600 dark:text-orange-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <div>
                    <h4 className="text-sm font-semibold text-orange-800 dark:text-orange-300 mb-1">
                      This ticket is {ticket.status === 'CLOSED' ? 'auto-closed' : 'closed'}
                    </h4>
                    <p className="text-sm text-orange-700 dark:text-orange-400">
                      {ticket.status === 'CLOSED'
                        ? 'This ticket was automatically closed after being solved for more than 48 hours. You cannot add replies to closed tickets.'
                        : 'This ticket has been solved for more than 48 hours and is now closed. You cannot add replies to closed tickets.'
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
              {/* Macro selector for agents */}
              {isAgent && macros && macros.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Apply Macro
                  </label>
                  <select
                    onChange={(e) => {
                      const macro = macros.find(m => m.id === e.target.value);
                      if (macro) {
                        setReplyBody(macro.content);
                      }
                      e.target.value = '';
                    }}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  >
                    <option value="">Select a macro to insert...</option>
                    {macros.map(macro => (
                      <option key={macro.id} value={macro.id}>
                        {macro.category ? `[${macro.category}] ` : ''}{macro.name}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Selecting a macro will replace the reply text. You can edit it before sending.
                  </p>
                </div>
              )}

              <textarea
                value={replyBody}
                onChange={(e) => setReplyBody(e.target.value)}
                rows={5}
                className={`w-full px-3 py-2 border rounded-md shadow-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent ${
                  isInternal
                    ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-300 dark:border-yellow-700'
                    : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600'
                }`}
                placeholder={isInternal ? "Type your internal note here..." : "Type your reply here..."}
                required
              />

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

        {/* Activity Log */}
        {ticket.activities && ticket.activities.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Activity Log</h3>
            <div className="space-y-3">
              {ticket.activities.map((activity: any) => (
                <div key={activity.id} className="flex items-start gap-3 text-sm">
                  <div className="w-2 h-2 mt-1.5 rounded-full bg-primary"></div>
                  <div className="flex-1">
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
    </Layout>
  );
};

export default TicketDetail;
