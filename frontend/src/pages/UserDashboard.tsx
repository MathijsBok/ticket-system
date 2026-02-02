import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { ticketApi } from '../lib/api';
import Layout from '../components/Layout';
import { format } from 'date-fns';

type SortField = 'ticketNumber' | 'subject' | 'status' | 'priority' | 'createdAt' | 'comments';
type SortDirection = 'asc' | 'desc';

const UserDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [openExpanded, setOpenExpanded] = useState(false);
  const [solvedExpanded, setSolvedExpanded] = useState(false);
  const [closedExpanded, setClosedExpanded] = useState(false);

  const { data: tickets, isLoading, error } = useQuery({
    queryKey: ['userTickets'],
    queryFn: async () => {
      const response = await ticketApi.getAll({ limit: 1000 }); // Users typically have fewer tickets
      return response.data.tickets || response.data; // Handle both new and old format
    }
  });

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortedTickets = useMemo(() => {
    if (!tickets) return [];

    return [...tickets].sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortField) {
        case 'ticketNumber':
          aValue = a.ticketNumber;
          bValue = b.ticketNumber;
          break;
        case 'subject':
          aValue = a.subject.toLowerCase();
          bValue = b.subject.toLowerCase();
          break;
        case 'status':
          aValue = a.status;
          bValue = b.status;
          break;
        case 'priority':
          const priorityOrder = { LOW: 0, NORMAL: 1, HIGH: 2, URGENT: 3 };
          aValue = priorityOrder[a.priority as keyof typeof priorityOrder];
          bValue = priorityOrder[b.priority as keyof typeof priorityOrder];
          break;
        case 'createdAt':
          aValue = new Date(a.createdAt).getTime();
          bValue = new Date(b.createdAt).getTime();
          break;
        case 'comments':
          aValue = a._count.comments;
          bValue = b._count.comments;
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [tickets, sortField, sortDirection]);

  const openTickets = useMemo(() => {
    return sortedTickets.filter((ticket: any) => ticket.status !== 'SOLVED' && ticket.status !== 'CLOSED');
  }, [sortedTickets]);

  const solvedTickets = useMemo(() => {
    return sortedTickets.filter((ticket: any) => ticket.status === 'SOLVED');
  }, [sortedTickets]);

  const closedTickets = useMemo(() => {
    return sortedTickets.filter((ticket: any) => ticket.status === 'CLOSED');
  }, [sortedTickets]);

  // Display arrays (limited to 10 unless expanded)
  const displayOpenTickets = useMemo(() => {
    return openExpanded ? openTickets : openTickets.slice(0, 10);
  }, [openTickets, openExpanded]);

  const displaySolvedTickets = useMemo(() => {
    return solvedExpanded ? solvedTickets : solvedTickets.slice(0, 10);
  }, [solvedTickets, solvedExpanded]);

  const displayClosedTickets = useMemo(() => {
    return closedExpanded ? closedTickets : closedTickets.slice(0, 10);
  }, [closedTickets, closedExpanded]);

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

  const SortIcon: React.FC<{ field: SortField }> = ({ field }) => {
    if (sortField !== field) {
      return (
        <svg className="w-4 h-4 ml-1 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      );
    }
    return sortDirection === 'asc' ? (
      <svg className="w-4 h-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
      </svg>
    ) : (
      <svg className="w-4 h-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    );
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">My Tickets</h1>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              View and manage your support tickets
            </p>
          </div>
          <Link
            to="/tickets/new"
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium bg-primary text-primary-foreground hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-colors"
          >
            <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Ticket
          </Link>
        </div>

        {/* Loading state */}
        {isLoading && (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <p className="mt-2 text-gray-600 dark:text-gray-400">Loading tickets...</p>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <p className="text-red-800 dark:text-red-200">Failed to load tickets. Please try again.</p>
          </div>
        )}

        {/* Tickets list */}
        {sortedTickets && sortedTickets.length === 0 && (
          <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No tickets</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Get started by creating a new ticket.
            </p>
            <div className="mt-6">
              <Link
                to="/tickets/new"
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium bg-primary text-primary-foreground hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-colors"
              >
                Create Ticket
              </Link>
            </div>
          </div>
        )}

        {sortedTickets && sortedTickets.length > 0 && (
          <>
            {/* Open Tickets Section */}
            {openTickets.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">Open Tickets</h2>
                  <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-sm font-semibold rounded-full">
                    {openTickets.length}
                  </span>
                </div>
                {/* Mobile Card View */}
                <div className="md:hidden space-y-3">
                  {displayOpenTickets.map((ticket: any) => (
                    <div
                      key={ticket.id}
                      onClick={() => navigate(`/tickets/${ticket.id}`)}
                      className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm p-4 cursor-pointer active:bg-gray-50 dark:active:bg-gray-700"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-primary">#{ticket.ticketNumber}</span>
                        <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${getStatusColor(ticket.status)}`}>
                          {ticket.status.replace('_', ' ')}
                        </span>
                      </div>
                      <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2 line-clamp-2">
                        {ticket.subject}
                      </h3>
                      <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                        <span className="capitalize">{ticket.priority.toLowerCase()}</span>
                        <span>{format(new Date(ticket.createdAt), 'MMM d, yyyy')}</span>
                      </div>
                    </div>
                  ))}
                </div>
                {/* Desktop Table View */}
                <div className="hidden md:block bg-white dark:bg-gray-800 shadow-sm rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <table className="w-full divide-y divide-gray-200 dark:divide-gray-700" style={{ tableLayout: 'fixed' }}>
                    <colgroup>
                      <col style={{ width: '100px' }} />
                      <col style={{ width: '120px' }} />
                      <col style={{ width: '350px' }} />
                      <col style={{ width: '100px' }} />
                      <col style={{ width: '130px' }} />
                      <col style={{ width: '130px' }} />
                      <col style={{ width: '80px' }} />
                    </colgroup>
                    <thead className="bg-gray-50 dark:bg-gray-900">
                      <tr>
                        <th
                          onClick={() => handleSort('ticketNumber')}
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                        >
                          <div className="flex items-center">
                            Ticket #
                            <SortIcon field="ticketNumber" />
                          </div>
                        </th>
                        <th
                          onClick={() => handleSort('status')}
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                        >
                          <div className="flex items-center">
                            Status
                            <SortIcon field="status" />
                          </div>
                        </th>
                        <th
                          onClick={() => handleSort('subject')}
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                        >
                          <div className="flex items-center">
                            Subject
                            <SortIcon field="subject" />
                          </div>
                        </th>
                        <th
                          onClick={() => handleSort('priority')}
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                        >
                          <div className="flex items-center">
                            Priority
                            <SortIcon field="priority" />
                          </div>
                        </th>
                        <th
                          onClick={() => handleSort('createdAt')}
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                        >
                          <div className="flex items-center">
                            Created
                            <SortIcon field="createdAt" />
                          </div>
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Last Updated
                        </th>
                        <th
                          onClick={() => handleSort('comments')}
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                        >
                          <div className="flex items-center">
                            Replies
                            <SortIcon field="comments" />
                          </div>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      {displayOpenTickets.map((ticket: any) => (
                        <tr
                          key={ticket.id}
                          onClick={() => navigate(`/tickets/${ticket.id}`)}
                          className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer"
                        >
                          <td className="px-6 py-2 whitespace-nowrap text-sm font-medium text-primary">
                            #{ticket.ticketNumber}
                          </td>
                          <td className="px-6 py-2 whitespace-nowrap">
                            <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(ticket.status)}`}>
                              {ticket.status.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="px-6 py-2 text-sm text-gray-900 dark:text-white overflow-hidden">
                            <div className="truncate" title={ticket.subject}>
                              {ticket.subject}
                            </div>
                          </td>
                          <td className="px-6 py-2 whitespace-nowrap text-sm text-gray-900 dark:text-white capitalize">
                            {ticket.priority.toLowerCase()}
                          </td>
                          <td className="px-6 py-2 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                            {format(new Date(ticket.createdAt), 'MMM d, yyyy')}
                          </td>
                          <td className="px-6 py-2 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                            {format(new Date(ticket.updatedAt), 'MMM d, yyyy')}
                          </td>
                          <td className="px-6 py-2 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                            {ticket._count.comments}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {openTickets.length > 10 && (
                  <div className="flex justify-center">
                    <button
                      onClick={() => setOpenExpanded(!openExpanded)}
                      className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-colors"
                    >
                      {openExpanded ? (
                        <>
                          <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                          </svg>
                          Show Less
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                          Show {openTickets.length - 10} More
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Solved Tickets Section */}
            {solvedTickets.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">Solved Tickets</h2>
                  <span className="px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-sm font-semibold rounded-full">
                    {solvedTickets.length}
                  </span>
                </div>
                {/* Mobile Card View */}
                <div className="md:hidden space-y-3">
                  {displaySolvedTickets.map((ticket: any) => (
                    <div
                      key={ticket.id}
                      onClick={() => navigate(`/tickets/${ticket.id}`)}
                      className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm p-4 cursor-pointer active:bg-gray-50 dark:active:bg-gray-700"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-primary">#{ticket.ticketNumber}</span>
                        <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${getStatusColor(ticket.status)}`}>
                          {ticket.status.replace('_', ' ')}
                        </span>
                      </div>
                      <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2 line-clamp-2">
                        {ticket.subject}
                      </h3>
                      <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                        <span className="capitalize">{ticket.priority.toLowerCase()}</span>
                        <span>{format(new Date(ticket.createdAt), 'MMM d, yyyy')}</span>
                      </div>
                    </div>
                  ))}
                </div>
                {/* Desktop Table View */}
                <div className="hidden md:block bg-white dark:bg-gray-800 shadow-sm rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <table className="w-full divide-y divide-gray-200 dark:divide-gray-700" style={{ tableLayout: 'fixed' }}>
                    <colgroup>
                      <col style={{ width: '100px' }} />
                      <col style={{ width: '120px' }} />
                      <col style={{ width: '350px' }} />
                      <col style={{ width: '100px' }} />
                      <col style={{ width: '130px' }} />
                      <col style={{ width: '130px' }} />
                      <col style={{ width: '80px' }} />
                    </colgroup>
                    <thead className="bg-gray-50 dark:bg-gray-900">
                      <tr>
                        <th
                          onClick={() => handleSort('ticketNumber')}
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                        >
                          <div className="flex items-center">
                            Ticket #
                            <SortIcon field="ticketNumber" />
                          </div>
                        </th>
                        <th
                          onClick={() => handleSort('status')}
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                        >
                          <div className="flex items-center">
                            Status
                            <SortIcon field="status" />
                          </div>
                        </th>
                        <th
                          onClick={() => handleSort('subject')}
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                        >
                          <div className="flex items-center">
                            Subject
                            <SortIcon field="subject" />
                          </div>
                        </th>
                        <th
                          onClick={() => handleSort('priority')}
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                        >
                          <div className="flex items-center">
                            Priority
                            <SortIcon field="priority" />
                          </div>
                        </th>
                        <th
                          onClick={() => handleSort('createdAt')}
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                        >
                          <div className="flex items-center">
                            Created
                            <SortIcon field="createdAt" />
                          </div>
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Solved
                        </th>
                        <th
                          onClick={() => handleSort('comments')}
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                        >
                          <div className="flex items-center">
                            Replies
                            <SortIcon field="comments" />
                          </div>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      {displaySolvedTickets.map((ticket: any) => (
                        <tr
                          key={ticket.id}
                          onClick={() => navigate(`/tickets/${ticket.id}`)}
                          className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer"
                        >
                          <td className="px-6 py-2 whitespace-nowrap text-sm font-medium text-primary">
                            #{ticket.ticketNumber}
                          </td>
                          <td className="px-6 py-2 whitespace-nowrap">
                            <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(ticket.status)}`}>
                              {ticket.status.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="px-6 py-2 text-sm text-gray-900 dark:text-white overflow-hidden">
                            <div className="truncate" title={ticket.subject}>
                              {ticket.subject}
                            </div>
                          </td>
                          <td className="px-6 py-2 whitespace-nowrap text-sm text-gray-900 dark:text-white capitalize">
                            {ticket.priority.toLowerCase()}
                          </td>
                          <td className="px-6 py-2 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                            {format(new Date(ticket.createdAt), 'MMM d, yyyy')}
                          </td>
                          <td className="px-6 py-2 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                            {ticket.solvedAt ? format(new Date(ticket.solvedAt), 'MMM d, yyyy') : '-'}
                          </td>
                          <td className="px-6 py-2 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                            {ticket._count.comments}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {solvedTickets.length > 10 && (
                  <div className="flex justify-center">
                    <button
                      onClick={() => setSolvedExpanded(!solvedExpanded)}
                      className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-colors"
                    >
                      {solvedExpanded ? (
                        <>
                          <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                          </svg>
                          Show Less
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                          Show {solvedTickets.length - 10} More
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Closed Tickets Section */}
            {closedTickets.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">Closed Tickets</h2>
                  <span className="px-3 py-1 bg-gray-100 dark:bg-gray-900/30 text-gray-700 dark:text-gray-300 text-sm font-semibold rounded-full">
                    {closedTickets.length}
                  </span>
                </div>
                {/* Mobile Card View */}
                <div className="md:hidden space-y-3">
                  {displayClosedTickets.map((ticket: any) => (
                    <div
                      key={ticket.id}
                      onClick={() => navigate(`/tickets/${ticket.id}`)}
                      className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm p-4 cursor-pointer active:bg-gray-50 dark:active:bg-gray-700"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-primary">#{ticket.ticketNumber}</span>
                        <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${getStatusColor(ticket.status)}`}>
                          {ticket.status.replace('_', ' ')}
                        </span>
                      </div>
                      <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2 line-clamp-2">
                        {ticket.subject}
                      </h3>
                      <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                        <span className="capitalize">{ticket.priority.toLowerCase()}</span>
                        <span>{format(new Date(ticket.createdAt), 'MMM d, yyyy')}</span>
                      </div>
                    </div>
                  ))}
                </div>
                {/* Desktop Table View */}
                <div className="hidden md:block bg-white dark:bg-gray-800 shadow-sm rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <table className="w-full divide-y divide-gray-200 dark:divide-gray-700" style={{ tableLayout: 'fixed' }}>
                    <colgroup>
                      <col style={{ width: '100px' }} />
                      <col style={{ width: '120px' }} />
                      <col style={{ width: '350px' }} />
                      <col style={{ width: '100px' }} />
                      <col style={{ width: '130px' }} />
                      <col style={{ width: '130px' }} />
                      <col style={{ width: '80px' }} />
                    </colgroup>
                    <thead className="bg-gray-50 dark:bg-gray-900">
                      <tr>
                        <th
                          onClick={() => handleSort('ticketNumber')}
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                        >
                          <div className="flex items-center">
                            Ticket #
                            <SortIcon field="ticketNumber" />
                          </div>
                        </th>
                        <th
                          onClick={() => handleSort('status')}
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                        >
                          <div className="flex items-center">
                            Status
                            <SortIcon field="status" />
                          </div>
                        </th>
                        <th
                          onClick={() => handleSort('subject')}
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                        >
                          <div className="flex items-center">
                            Subject
                            <SortIcon field="subject" />
                          </div>
                        </th>
                        <th
                          onClick={() => handleSort('priority')}
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                        >
                          <div className="flex items-center">
                            Priority
                            <SortIcon field="priority" />
                          </div>
                        </th>
                        <th
                          onClick={() => handleSort('createdAt')}
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                        >
                          <div className="flex items-center">
                            Created
                            <SortIcon field="createdAt" />
                          </div>
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Closed
                        </th>
                        <th
                          onClick={() => handleSort('comments')}
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                        >
                          <div className="flex items-center">
                            Replies
                            <SortIcon field="comments" />
                          </div>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      {displayClosedTickets.map((ticket: any) => (
                        <tr
                          key={ticket.id}
                          onClick={() => navigate(`/tickets/${ticket.id}`)}
                          className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer"
                        >
                          <td className="px-6 py-2 whitespace-nowrap text-sm font-medium text-primary">
                            #{ticket.ticketNumber}
                          </td>
                          <td className="px-6 py-2 whitespace-nowrap">
                            <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(ticket.status)}`}>
                              {ticket.status.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="px-6 py-2 text-sm text-gray-900 dark:text-white overflow-hidden">
                            <div className="truncate" title={ticket.subject}>
                              {ticket.subject}
                            </div>
                          </td>
                          <td className="px-6 py-2 whitespace-nowrap text-sm text-gray-900 dark:text-white capitalize">
                            {ticket.priority.toLowerCase()}
                          </td>
                          <td className="px-6 py-2 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                            {format(new Date(ticket.createdAt), 'MMM d, yyyy')}
                          </td>
                          <td className="px-6 py-2 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                            {ticket.closedAt ? format(new Date(ticket.closedAt), 'MMM d, yyyy') : '-'}
                          </td>
                          <td className="px-6 py-2 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                            {ticket._count.comments}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {closedTickets.length > 10 && (
                  <div className="flex justify-center">
                    <button
                      onClick={() => setClosedExpanded(!closedExpanded)}
                      className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-colors"
                    >
                      {closedExpanded ? (
                        <>
                          <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                          </svg>
                          Show Less
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                          Show {closedTickets.length - 10} More
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
};

export default UserDashboard;
