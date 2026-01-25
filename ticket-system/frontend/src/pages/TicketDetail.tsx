import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useUser } from '@clerk/clerk-react';
import toast from 'react-hot-toast';
import { ticketApi, commentApi } from '../lib/api';
import Layout from '../components/Layout';
import { format } from 'date-fns';

const TicketDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useUser();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const userRole = user?.publicMetadata?.role as string;

  const [replyBody, setReplyBody] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState('');

  const { data: ticket, isLoading } = useQuery({
    queryKey: ['ticket', id],
    queryFn: async () => {
      const response = await ticketApi.getById(id!);
      return response.data;
    },
    enabled: !!id
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
      const userId = user?.id;
      const response = await ticketApi.update(id!, { assigneeId: userId });
      return response.data;
    },
    onSuccess: () => {
      toast.success('Ticket assigned to you');
      queryClient.invalidateQueries({ queryKey: ['ticket', id] });
    },
    onError: () => {
      toast.error('Failed to assign ticket');
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
      CLOSED: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
    };
    return colors[status] || colors.NEW;
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
          <div className="flex justify-between items-start">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Ticket #{ticket.ticketNumber}
                </h1>
                <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(ticket.status)}`}>
                  {ticket.status.replace('_', ' ')}
                </span>
              </div>
              <h2 className="mt-2 text-xl text-gray-700 dark:text-gray-300">{ticket.subject}</h2>
              <div className="mt-4 flex gap-6 text-sm text-gray-600 dark:text-gray-400">
                <div>
                  <span className="font-medium">Created:</span> {format(new Date(ticket.createdAt), 'MMM d, yyyy HH:mm')}
                </div>
                <div>
                  <span className="font-medium">Priority:</span> <span className="capitalize">{ticket.priority.toLowerCase()}</span>
                </div>
                <div>
                  <span className="font-medium">Requester:</span> {ticket.requester.email}
                </div>
                {ticket.assignee && (
                  <div>
                    <span className="font-medium">Assigned to:</span> {ticket.assignee.email}
                  </div>
                )}
              </div>
            </div>

            {/* Agent actions */}
            {isAgent && (
              <div className="flex gap-3">
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
                  value={selectedStatus || ticket.status}
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
              </div>
            )}
          </div>
        </div>

        {/* Comments/Conversation */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Conversation</h3>
          <div className="space-y-6">
            {ticket.comments.map((comment: any) => (
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
                      {comment.author.email}
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
          <form onSubmit={handleReply} className="space-y-4">
            <textarea
              value={replyBody}
              onChange={(e) => setReplyBody(e.target.value)}
              rows={5}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              placeholder="Type your reply here..."
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
                {replyMutation.isPending ? 'Sending...' : 'Send Reply'}
              </button>
            </div>
          </form>
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
                      <span className="font-medium">{activity.action.replace('_', ' ')}</span>
                      {activity.details && (
                        <span className="text-gray-500 dark:text-gray-400">
                          {' '}- {JSON.stringify(activity.details)}
                        </span>
                      )}
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
