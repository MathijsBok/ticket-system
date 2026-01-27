import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useClerk, useUser } from '@clerk/clerk-react';
import { ticketApi, sessionApi } from '../lib/api';
import Layout from '../components/Layout';
import { format } from 'date-fns';
import { useNotification } from '../contexts/NotificationContext';
import { useView } from '../contexts/ViewContext';
import { useTicketNotifications } from '../hooks/useTicketNotifications';
import toast from 'react-hot-toast';

type SortField = 'ticketNumber' | 'subject' | 'requester' | 'status' | 'priority' | 'assignee' | 'updatedAt';
type SortDirection = 'asc' | 'desc';

const AgentDashboard: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const clerk = useClerk();
  const { user } = useUser();
  // Default to 'USER' role if no role is set (new users)
  const userRole = (user?.publicMetadata?.role as string) || 'USER';
  const { currentView } = useView();

  // Use currentView for admins (respects "View as" switcher), userRole for others
  const effectiveRole = userRole === 'ADMIN' ? currentView : userRole;
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [selectedTickets, setSelectedTickets] = useState<string[]>([]);
  const [bulkStatus, setBulkStatus] = useState<string>('');
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [sortField, setSortField] = useState<SortField>('updatedAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);

  const { permission, requestPermission, isSupported } = useNotification();
  const { newTicketCount, isPolling } = useTicketNotifications({
    enabled: notificationsEnabled,
    pollingInterval: 30000 // Poll every 30 seconds
  });

  // Function to end the current session
  const endCurrentSession = useCallback(async (sessionId: string) => {
    try {
      await sessionApi.end(sessionId);
      console.log('Session ended:', sessionId);
    } catch (error) {
      console.error('Failed to end session:', error);
    }
  }, []);

  // Start session on mount
  useEffect(() => {
    const startSession = async () => {
      try {
        const response = await sessionApi.start({
          ipAddress: '',
          userAgent: navigator.userAgent
        });
        setActiveSessionId(response.data.id);
      } catch (error) {
        console.error('Failed to start session:', error);
      }
    };

    startSession();
  }, []);

  // Handle browser/tab close with beforeunload
  useEffect(() => {
    if (!activeSessionId) return;

    const handleBeforeUnload = async () => {
      // Use fetch with keepalive flag for reliable delivery during page unload
      try {
        const token = await window.Clerk?.session?.getToken();
        if (token) {
          fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}/sessions/end/${activeSessionId}`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            keepalive: true // Ensures request completes even if page is closing
          });
        }
      } catch (error) {
        console.error('Failed to end session on unload:', error);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [activeSessionId]);

  // Handle Clerk sign-out
  useEffect(() => {
    if (!activeSessionId) return;

    const handleSignOut = async () => {
      if (activeSessionId) {
        await endCurrentSession(activeSessionId);
        setActiveSessionId(null);
      }
    };

    // Listen for sign-out events
    const originalSignOut = clerk.signOut;
    clerk.signOut = async (options?: any) => {
      await handleSignOut();
      return originalSignOut.call(clerk, options);
    };

    return () => {
      clerk.signOut = originalSignOut;
    };
  }, [activeSessionId, clerk, endCurrentSession]);

  // End session on unmount
  useEffect(() => {
    return () => {
      if (activeSessionId) {
        endCurrentSession(activeSessionId);
      }
    };
  }, [activeSessionId, endCurrentSession]);

  const { data: tickets, isLoading } = useQuery({
    queryKey: ['agentTickets', statusFilter],
    queryFn: async () => {
      const response = await ticketApi.getAll(
        statusFilter ? { status: statusFilter } : undefined
      );
      return response.data;
    }
  });

  const { data: stats } = useQuery({
    queryKey: ['ticketStats'],
    queryFn: async () => {
      const response = await ticketApi.getStats();
      return response.data;
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
        case 'requester':
          aValue = (a.requester.name || a.requester.email).toLowerCase();
          bValue = (b.requester.name || b.requester.email).toLowerCase();
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
        case 'assignee':
          aValue = a.assignee ? a.assignee.email.toLowerCase() : '';
          bValue = b.assignee ? b.assignee.email.toLowerCase() : '';
          break;
        case 'updatedAt':
          aValue = new Date(a.updatedAt).getTime();
          bValue = new Date(b.updatedAt).getTime();
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [tickets, sortField, sortDirection]);

  // Reset to page 1 when filters or sorting changes
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, sortField, sortDirection]);

  // Pagination calculations
  const totalTickets = sortedTickets?.length || 0;
  const totalPages = Math.ceil(totalTickets / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalTickets);

  const paginatedTickets = useMemo(() => {
    return sortedTickets.slice(startIndex, endIndex);
  }, [sortedTickets, startIndex, endIndex]);

  // Handle page changes
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    // Scroll to top of table
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleItemsPerPageChange = (newItemsPerPage: number) => {
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(1);
  };

  const bulkUpdateMutation = useMutation({
    mutationFn: async (data: { ticketIds: string[]; status?: string }) => {
      return await ticketApi.bulkUpdate(data);
    },
    onSuccess: () => {
      toast.success('Tickets updated successfully');
      setSelectedTickets([]);
      setBulkStatus('');
      queryClient.invalidateQueries({ queryKey: ['agentTickets'] });
      queryClient.invalidateQueries({ queryKey: ['ticketStats'] });
    },
    onError: () => {
      toast.error('Failed to update tickets');
    }
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ticketIds: string[]) => {
      return await ticketApi.bulkDelete(ticketIds);
    },
    onSuccess: () => {
      toast.success('Tickets deleted successfully');
      setSelectedTickets([]);
      queryClient.invalidateQueries({ queryKey: ['agentTickets'] });
      queryClient.invalidateQueries({ queryKey: ['ticketStats'] });
    },
    onError: () => {
      toast.error('Failed to delete tickets');
    }
  });

  const handleSelectAll = () => {
    const currentPageIds = paginatedTickets?.map((t: any) => t.id) || [];
    const allCurrentPageSelected = currentPageIds.every(id => selectedTickets.includes(id));

    if (allCurrentPageSelected) {
      // Deselect all tickets on current page
      setSelectedTickets(prev => prev.filter(id => !currentPageIds.includes(id)));
    } else {
      // Select all tickets on current page (add to existing selection)
      setSelectedTickets(prev => [...new Set([...prev, ...currentPageIds])]);
    }
  };

  const handleSelectTicket = (ticketId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    setSelectedTickets(prev =>
      prev.includes(ticketId)
        ? prev.filter(id => id !== ticketId)
        : [...prev, ticketId]
    );
  };

  const handleBulkStatusChange = () => {
    if (!bulkStatus || selectedTickets.length === 0) return;
    bulkUpdateMutation.mutate({ ticketIds: selectedTickets, status: bulkStatus });
  };

  const handleBulkDelete = () => {
    if (selectedTickets.length === 0) return;
    if (window.confirm(`Are you sure you want to delete ${selectedTickets.length} ticket(s)?`)) {
      bulkDeleteMutation.mutate(selectedTickets);
    }
  };

  const handleMarkAsSpam = () => {
    if (selectedTickets.length === 0) return;
    if (window.confirm(`Mark ${selectedTickets.length} ticket(s) as spam and close them?`)) {
      bulkUpdateMutation.mutate({ ticketIds: selectedTickets, status: 'SOLVED' });
    }
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

  const statusFilters = [
    { value: '', label: 'All Tickets' },
    { value: 'NEW', label: 'New' },
    { value: 'OPEN', label: 'Open' },
    { value: 'PENDING', label: 'Pending' },
    { value: 'ON_HOLD', label: 'On Hold' },
    { value: 'SOLVED', label: 'Solved' },
    { value: 'CLOSED', label: 'Closed' }
  ];

  // Helper to get the correct stats key for a status value
  const getStatsKey = (status: string): string => {
    if (status === 'ON_HOLD') return 'onHold';
    return status.toLowerCase();
  };

  const handleToggleNotifications = async () => {
    if (!isSupported) {
      return;
    }

    if (permission === 'granted') {
      setNotificationsEnabled(!notificationsEnabled);
    } else if (permission === 'default') {
      await requestPermission();
      if (Notification.permission === 'granted') {
        setNotificationsEnabled(true);
      }
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{effectiveRole === 'ADMIN' ? 'Admin Dashboard' : 'Agent Dashboard'}</h1>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              Manage and respond to customer tickets
            </p>
          </div>

          {/* Notification Settings */}
          {isSupported && (
            <div className="flex items-center gap-3">
              {isPolling && (
                <div className="flex items-center gap-2 px-3 py-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-sm text-green-700 dark:text-green-300">
                    {newTicketCount > 0 ? `${newTicketCount} new` : 'Monitoring'}
                  </span>
                </div>
              )}
              <button
                onClick={handleToggleNotifications}
                className={`relative inline-flex items-center px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  notificationsEnabled
                    ? 'bg-primary text-primary-foreground hover:opacity-90'
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
                title={
                  permission === 'denied'
                    ? 'Notifications blocked. Please enable in browser settings.'
                    : notificationsEnabled
                    ? 'Disable notifications'
                    : 'Enable notifications'
                }
                disabled={permission === 'denied'}
              >
                <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d={
                      notificationsEnabled
                        ? 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9'
                        : 'M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z'
                    }
                  />
                  {!notificationsEnabled && (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 3l18 18"
                    />
                  )}
                </svg>
                {notificationsEnabled ? 'Notifications On' : 'Enable Notifications'}
              </button>
            </div>
          )}
        </div>

        {/* Statistics Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <button
              onClick={() => setStatusFilter('NEW')}
              className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
            >
              <div className="text-sm font-medium text-gray-600 dark:text-gray-400">New</div>
              <div className="mt-1 text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.byStatus.new || 0}</div>
            </button>
            <button
              onClick={() => setStatusFilter('OPEN')}
              className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
            >
              <div className="text-sm font-medium text-gray-600 dark:text-gray-400">Open</div>
              <div className="mt-1 text-2xl font-bold text-green-600 dark:text-green-400">{stats.byStatus.open || 0}</div>
            </button>
            <button
              onClick={() => setStatusFilter('PENDING')}
              className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
            >
              <div className="text-sm font-medium text-gray-600 dark:text-gray-400">Pending</div>
              <div className="mt-1 text-2xl font-bold text-yellow-600 dark:text-yellow-400">{stats.byStatus.pending || 0}</div>
            </button>
            <button
              onClick={() => setStatusFilter('ON_HOLD')}
              className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
            >
              <div className="text-sm font-medium text-gray-600 dark:text-gray-400">On Hold</div>
              <div className="mt-1 text-2xl font-bold text-orange-600 dark:text-orange-400">{stats.byStatus.onHold || 0}</div>
            </button>
          </div>
        )}

        {/* Status Filters */}
        <div className="flex gap-2 flex-wrap">
          {statusFilters.map((filter) => (
            <button
              key={filter.value}
              onClick={() => setStatusFilter(filter.value)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                statusFilter === filter.value
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              {filter.label}
              {stats && filter.value && (
                <span className="ml-2 px-2 py-0.5 rounded-full bg-white/20 text-xs">
                  {stats.byStatus[getStatsKey(filter.value)] || 0}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Bulk Actions Toolbar - Fixed at bottom */}
        {selectedTickets.length > 0 && (
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-blue-500 dark:bg-blue-600 border-t-2 border-blue-600 dark:border-blue-500 shadow-lg p-4">
            <div className="max-w-7xl mx-auto flex items-center gap-4 flex-wrap">
              <span className="text-sm font-medium text-white">
                {selectedTickets.length} ticket(s) selected
              </span>

              <div className="flex items-center gap-2 relative">
                <div className="relative">
                  <button
                    onClick={() => setShowStatusDropdown(!showStatusDropdown)}
                    className="px-3 py-2 border border-blue-500 dark:border-blue-800 rounded-md shadow-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-white flex items-center gap-2 min-w-[160px] justify-between"
                  >
                    <span>{bulkStatus ? bulkStatus.replace('_', ' ') : 'Change Status...'}</span>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {showStatusDropdown && (
                    <>
                      <div
                        className="fixed inset-0 z-10"
                        onClick={() => setShowStatusDropdown(false)}
                      />
                      <div className="absolute bottom-full left-0 mb-1 w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg z-20">
                        <button
                          onClick={() => {
                            setBulkStatus('');
                            setShowStatusDropdown(false);
                          }}
                          className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 first:rounded-t-md"
                        >
                          Change Status...
                        </button>
                        <button
                          onClick={() => {
                            setBulkStatus('NEW');
                            setShowStatusDropdown(false);
                          }}
                          className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                        >
                          New
                        </button>
                        <button
                          onClick={() => {
                            setBulkStatus('OPEN');
                            setShowStatusDropdown(false);
                          }}
                          className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                        >
                          Open
                        </button>
                        <button
                          onClick={() => {
                            setBulkStatus('PENDING');
                            setShowStatusDropdown(false);
                          }}
                          className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                        >
                          Pending
                        </button>
                        <button
                          onClick={() => {
                            setBulkStatus('ON_HOLD');
                            setShowStatusDropdown(false);
                          }}
                          className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                        >
                          On Hold
                        </button>
                        <button
                          onClick={() => {
                            setBulkStatus('SOLVED');
                            setShowStatusDropdown(false);
                          }}
                          className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 last:rounded-b-md"
                        >
                          Solved
                        </button>
                      </div>
                    </>
                  )}
                </div>
                <button
                  onClick={handleBulkStatusChange}
                  disabled={!bulkStatus || bulkUpdateMutation.isPending}
                  className="px-4 py-2 bg-white text-blue-600 rounded-md hover:bg-gray-100 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Apply
                </button>
              </div>

              <button
                onClick={handleMarkAsSpam}
                disabled={bulkUpdateMutation.isPending}
                className="px-4 py-2 bg-orange-500 text-white rounded-md hover:bg-orange-600 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Mark as Spam
              </button>

              <button
                onClick={handleBulkDelete}
                disabled={bulkDeleteMutation.isPending}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Delete
              </button>

              <button
                onClick={() => setSelectedTickets([])}
                className="ml-auto px-4 py-2 text-white hover:text-gray-200 text-sm font-medium transition-colors"
              >
                Clear Selection
              </button>
            </div>
          </div>
        )}

        {/* Loading state */}
        {isLoading && (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <p className="mt-2 text-gray-600 dark:text-gray-400">Loading tickets...</p>
          </div>
        )}

        {/* Tickets table */}
        {sortedTickets && sortedTickets.length > 0 && (
          <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-6 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={paginatedTickets.length > 0 && paginatedTickets.every((t: any) => selectedTickets.includes(t.id))}
                      onChange={handleSelectAll}
                      className="rounded border-gray-300 dark:border-gray-600 text-primary focus:ring-primary"
                    />
                  </th>
                  <th
                    onClick={() => handleSort('ticketNumber')}
                    className="w-32 px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  >
                    <div className="flex items-center">
                      Ticket #
                      <SortIcon field="ticketNumber" />
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('status')}
                    className="w-40 px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
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
                    onClick={() => handleSort('requester')}
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  >
                    <div className="flex items-center">
                      Requester
                      <SortIcon field="requester" />
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
                    onClick={() => handleSort('assignee')}
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  >
                    <div className="flex items-center">
                      Assignee
                      <SortIcon field="assignee" />
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('updatedAt')}
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  >
                    <div className="flex items-center">
                      Updated
                      <SortIcon field="updatedAt" />
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {paginatedTickets.map((ticket: any) => (
                  <tr
                    key={ticket.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  >
                    <td className="px-6 py-2 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={selectedTickets.includes(ticket.id)}
                        onChange={(e) => handleSelectTicket(ticket.id, e as any)}
                        onClick={(e) => e.stopPropagation()}
                        className="rounded border-gray-300 dark:border-gray-600 text-primary focus:ring-primary"
                      />
                    </td>
                    <td
                      onClick={() => navigate(`/tickets/${ticket.id}`)}
                      className="px-6 py-2 whitespace-nowrap text-sm font-medium text-primary cursor-pointer"
                    >
                      #{ticket.ticketNumber}
                    </td>
                    <td
                      onClick={() => navigate(`/tickets/${ticket.id}`)}
                      className="px-6 py-2 whitespace-nowrap cursor-pointer"
                    >
                      <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(ticket.status)}`}>
                        {ticket.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td
                      onClick={() => navigate(`/tickets/${ticket.id}`)}
                      className="px-6 py-2 text-sm text-gray-900 dark:text-white cursor-pointer"
                    >
                      {ticket.subject}
                    </td>
                    <td
                      onClick={() => navigate(`/tickets/${ticket.id}`)}
                      className="px-6 py-2 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 cursor-pointer"
                    >
                      {ticket.requester.name || ticket.requester.email}
                    </td>
                    <td
                      onClick={() => navigate(`/tickets/${ticket.id}`)}
                      className="px-6 py-2 whitespace-nowrap text-sm text-gray-900 dark:text-white capitalize cursor-pointer"
                    >
                      {ticket.priority.toLowerCase()}
                    </td>
                    <td
                      onClick={() => navigate(`/tickets/${ticket.id}`)}
                      className="px-6 py-2 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 cursor-pointer"
                    >
                      {ticket.assignee ? ticket.assignee.email : 'Unassigned'}
                    </td>
                    <td
                      onClick={() => navigate(`/tickets/${ticket.id}`)}
                      className="px-6 py-2 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 cursor-pointer"
                    >
                      {format(new Date(ticket.updatedAt), 'MMM d, HH:mm')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination Controls */}
            {totalPages > 0 && (
              <div className="bg-white dark:bg-gray-800 px-4 py-3 flex items-center justify-between border-t border-gray-200 dark:border-gray-700 sm:px-6">
                <div className="flex-1 flex justify-between sm:hidden">
                  <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="relative inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
                <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                  <div className="flex items-center gap-4">
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      Showing <span className="font-medium">{startIndex + 1}</span> to{' '}
                      <span className="font-medium">{endIndex}</span> of{' '}
                      <span className="font-medium">{totalTickets}</span> tickets
                    </p>
                    <div className="flex items-center gap-2">
                      <label htmlFor="itemsPerPage" className="text-sm text-gray-700 dark:text-gray-300">
                        Show:
                      </label>
                      <select
                        id="itemsPerPage"
                        value={itemsPerPage}
                        onChange={(e) => handleItemsPerPageChange(Number(e.target.value))}
                        className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
                      >
                        <option value={25}>25</option>
                        <option value={50}>50</option>
                        <option value={75}>75</option>
                        <option value={100}>100</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                      <button
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={currentPage === 1}
                        className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <span className="sr-only">Previous</span>
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                      </button>
                      {/* Page numbers */}
                      {Array.from({ length: totalPages }, (_, i) => i + 1)
                        .filter(page => {
                          // Show first page, last page, current page, and pages around current
                          if (page === 1 || page === totalPages) return true;
                          if (Math.abs(page - currentPage) <= 1) return true;
                          return false;
                        })
                        .map((page, index, array) => {
                          // Add ellipsis between non-consecutive pages
                          const showEllipsisBefore = index > 0 && page - array[index - 1] > 1;
                          return (
                            <React.Fragment key={page}>
                              {showEllipsisBefore && (
                                <span className="relative inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-medium text-gray-700 dark:text-gray-300">
                                  ...
                                </span>
                              )}
                              <button
                                onClick={() => handlePageChange(page)}
                                className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                                  currentPage === page
                                    ? 'z-10 bg-primary border-primary text-primary-foreground'
                                    : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                                }`}
                              >
                                {page}
                              </button>
                            </React.Fragment>
                          );
                        })}
                      <button
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={currentPage === totalPages}
                        className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <span className="sr-only">Next</span>
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    </nav>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Empty state */}
        {sortedTickets && sortedTickets.length === 0 && (
          <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No tickets found</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {statusFilter ? `No ${statusFilter.toLowerCase().replace('_', ' ')} tickets at the moment.` : 'No tickets in the system.'}
            </p>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default AgentDashboard;
