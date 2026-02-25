import React, { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useClerk, useUser } from '@clerk/clerk-react';
import { ticketApi, sessionApi, userApi } from '../lib/api';
import Layout from '../components/Layout';
import CustomSelect from '../components/CustomSelect';
import ViewsSidebar from '../components/ViewsSidebar';
import { format } from 'date-fns';
import { useNotification } from '../contexts/NotificationContext';
import { useTicketNotifications } from '../hooks/useTicketNotifications';
import toast from 'react-hot-toast';
import FeedbackStatsWidget from '../components/FeedbackStatsWidget';
import ConfirmModal from '../components/ConfirmModal';

type SortField = 'ticketNumber' | 'subject' | 'requester' | 'status' | 'priority' | 'assignee' | 'updatedAt';
type SortDirection = 'asc' | 'desc';

const AgentDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const clerk = useClerk();
  const { user } = useUser();
  // Default to 'USER' role if no role is set (new users)
  const userRole = (user?.publicMetadata?.role as string) || 'USER';

  // Get initial view from URL or default to 'open'
  const urlView = searchParams.get('view') || 'open';

  const [statusFilter, setStatusFilter] = useState<string>('OPEN');
  const [viewBaseStatus, setViewBaseStatus] = useState<string>('OPEN'); // Track view's base status
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [myRequests, setMyRequests] = useState<boolean>(false);
  const [myAssigned, setMyAssigned] = useState<boolean>(false);
  const [unassigned, setUnassigned] = useState<boolean>(false);
  const [solvedAfter, setSolvedAfter] = useState<string | undefined>(undefined);
  const [activeViewId, setActiveViewId] = useState<string>(urlView);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [selectedTickets, setSelectedTickets] = useState<string[]>([]);
  const [bulkStatus, setBulkStatus] = useState<string>('');
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [bulkAssignee, setBulkAssignee] = useState<string>('');
  const [showAssignDropdown, setShowAssignDropdown] = useState(false);
  const [sortField, setSortField] = useState<SortField>('updatedAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [searchQuery, setSearchQuery] = useState('');
  const [isRefreshingStats, setIsRefreshingStats] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; type: 'delete' | 'spam' | null }>({ isOpen: false, type: null });

  const { permission, requestPermission, isSupported } = useNotification();
  const { newTicketCount, isPolling } = useTicketNotifications({
    enabled: notificationsEnabled,
    pollingInterval: 30000 // Poll every 30 seconds
  });

  // View filter definitions - used to sync state when URL changes (e.g., browser back)
  const viewFilters: Record<string, { status?: string | string[]; allStatuses?: string[]; type?: string; assignee?: string; createdByMe?: boolean; solvedAfter?: string }> = {
    'your-unsolved': { assignee: 'me', status: 'OPEN', allStatuses: ['OPEN', 'PENDING', 'ON_HOLD'] },
    'unassigned': { assignee: 'unassigned' },
    'open': { status: 'OPEN' },
    'pending': { status: 'PENDING' },
    'on-hold': { status: 'ON_HOLD' },
    'problem': { type: 'PROBLEM', status: ['OPEN', 'PENDING', 'ON_HOLD', 'SOLVED'], allStatuses: ['OPEN', 'PENDING', 'ON_HOLD', 'SOLVED'] },
    'incident': { type: 'INCIDENT', status: ['OPEN', 'PENDING', 'ON_HOLD', 'SOLVED'], allStatuses: ['OPEN', 'PENDING', 'ON_HOLD', 'SOLVED'] },
    'all-unsolved': { status: ['OPEN', 'PENDING', 'ON_HOLD'] },
    'solved': { status: 'SOLVED' },
    'all': {},
    'my-created': { createdByMe: true, status: 'OPEN', allStatuses: ['NEW', 'OPEN', 'PENDING', 'ON_HOLD', 'SOLVED', 'CLOSED'] }
  };

  // Sync view state when URL changes (e.g., browser back/forward navigation)
  useEffect(() => {
    if (urlView !== activeViewId) {
      const filter = viewFilters[urlView] || viewFilters['open'];
      setActiveViewId(urlView);
      const initialStatus = Array.isArray(filter.status) ? filter.status.join(',') : (filter.status || '');
      setStatusFilter(initialStatus);
      const allStatus = filter.allStatuses ? filter.allStatuses.join(',') : initialStatus;
      setViewBaseStatus(allStatus);
      setTypeFilter(filter.type || '');
      setMyRequests(filter.createdByMe === true);
      setMyAssigned(filter.assignee === 'me');
      setUnassigned(filter.assignee === 'unassigned');
      setSolvedAfter(filter.solvedAfter);
      setCurrentPage(1);
    }
  }, [urlView]);

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

  // Debounced search query for server
  const [debouncedSearch, setDebouncedSearch] = useState(searchQuery);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const { data: ticketResponse, isLoading } = useQuery({
    queryKey: ['agentTickets', statusFilter, typeFilter, currentPage, itemsPerPage, sortField, sortDirection, debouncedSearch, myRequests, myAssigned, unassigned, solvedAfter],
    queryFn: async () => {
      // When searching, ignore view filters and search globally
      const isSearching = !!debouncedSearch;
      const response = await ticketApi.getAll({
        status: isSearching ? undefined : (statusFilter || undefined),
        type: isSearching ? undefined : (typeFilter || undefined),
        page: currentPage,
        limit: itemsPerPage,
        sortField,
        sortDirection,
        search: debouncedSearch || undefined,
        myRequests: isSearching ? undefined : (myRequests || undefined),
        myAssigned: isSearching ? undefined : (myAssigned || undefined),
        unassigned: isSearching ? undefined : (unassigned || undefined),
        solvedAfter: isSearching ? undefined : (solvedAfter || undefined)
      });
      return response.data;
    },
    placeholderData: (previousData) => previousData // Keep previous data while loading
  });

  const tickets = ticketResponse?.tickets || [];
  const pagination = ticketResponse?.pagination;

  const { data: stats, refetch: refetchStats } = useQuery({
    queryKey: ['ticketStats'],
    queryFn: async () => {
      const response = await ticketApi.getStats();
      return response.data;
    }
  });

  // Wrapper function to ensure loading state is visible for at least 500ms
  const handleRefreshStats = async () => {
    setIsRefreshingStats(true);
    const startTime = Date.now();

    await refetchStats();

    const elapsed = Date.now() - startTime;
    const remainingTime = Math.max(0, 500 - elapsed);

    if (remainingTime > 0) {
      setTimeout(() => setIsRefreshingStats(false), remainingTime);
    } else {
      setIsRefreshingStats(false);
    }
  };

  // Fetch agents for bulk assign dropdown
  const { data: agents } = useQuery({
    queryKey: ['agents'],
    queryFn: async () => {
      const response = await userApi.getAgents();
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
    setCurrentPage(1); // Reset to page 1 when sorting changes
  };

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, typeFilter, debouncedSearch, myRequests, myAssigned, unassigned, solvedAfter]);

  // Pagination from server response
  const totalTickets = pagination?.totalCount || 0;
  const totalPages = pagination?.totalPages || 1;
  const startIndex = ((pagination?.page || 1) - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + tickets.length, totalTickets);

  // Tickets are already paginated from server
  const paginatedTickets = tickets;

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
    mutationFn: async (data: { ticketIds: string[]; status?: string; assigneeId?: string | null }) => {
      return await ticketApi.bulkUpdate(data);
    },
    onSuccess: () => {
      toast.success('Tickets updated successfully');
      setSelectedTickets([]);
      setBulkStatus('');
      setBulkAssignee('');
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
    const allCurrentPageSelected = currentPageIds.every((id: string) => selectedTickets.includes(id));

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

  const handleBulkAssign = () => {
    if (selectedTickets.length === 0) return;
    // Empty string means unassign, otherwise assign to selected agent
    const assigneeId = bulkAssignee === '' ? null : bulkAssignee;
    bulkUpdateMutation.mutate({ ticketIds: selectedTickets, assigneeId });
  };

  const handleBulkDelete = () => {
    if (selectedTickets.length === 0) return;
    setConfirmModal({ isOpen: true, type: 'delete' });
  };

  const blockUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      return await userApi.block(userId, true, 'Marked as spam by agent');
    }
  });

  const handleMarkAsSpam = () => {
    if (selectedTickets.length === 0) return;
    setConfirmModal({ isOpen: true, type: 'spam' });
  };

  const handleConfirmAction = async () => {
    if (confirmModal.type === 'delete') {
      bulkDeleteMutation.mutate(selectedTickets);
    } else if (confirmModal.type === 'spam') {
      const selectedTicketData = paginatedTickets?.filter((t: any) => selectedTickets.includes(t.id)) || [];
      const requesterIds = [...new Set(selectedTicketData.map((t: any) => t.requesterId))];
      try {
        await Promise.all(requesterIds.map(id => blockUserMutation.mutateAsync(id as string)));
        toast.success(`${requesterIds.length} user(s) blocked`);
        bulkUpdateMutation.mutate({ ticketIds: selectedTickets, status: 'SOLVED' });
        queryClient.invalidateQueries({ queryKey: ['allUsers'] });
      } catch (error) {
        toast.error('Failed to block some users');
      }
    }
    setConfirmModal({ isOpen: false, type: null });
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
      NEW: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      OPEN: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
      PENDING: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      ON_HOLD: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
      SOLVED: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      CLOSED: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
    };
    return colors[status] || colors.NEW;
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

  // Handle view change from sidebar
  const handleViewChange = (viewId: string, filter: { status?: string | string[]; allStatuses?: string[]; type?: string; assignee?: string; createdByMe?: boolean; solvedAfter?: string }) => {
    setActiveViewId(viewId);
    // Update URL with the new view (preserves history for back button)
    setSearchParams({ view: viewId }, { replace: false });
    // Handle status filter - can be string, array, or empty
    const initialStatus = Array.isArray(filter.status) ? filter.status.join(',') : (filter.status || '');
    setStatusFilter(initialStatus);
    // Track what "All" button should filter by (allStatuses if provided, otherwise same as initial)
    const allStatus = filter.allStatuses ? filter.allStatuses.join(',') : initialStatus;
    setViewBaseStatus(allStatus);
    setTypeFilter(filter.type || '');
    // Handle personal filters
    setMyRequests(filter.createdByMe === true);
    setMyAssigned(filter.assignee === 'me');
    setUnassigned(filter.assignee === 'unassigned');
    // Handle date filters
    setSolvedAfter(filter.solvedAfter);
    setCurrentPage(1);
  };

  return (
    <Layout hidePadding>
      <div className="flex h-[calc(100vh-64px)]">
        {/* Views Sidebar */}
        <ViewsSidebar
          stats={stats}
          activeView={activeViewId}
          onViewChange={handleViewChange}
          isCollapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
          isMobileOpen={mobileSidebarOpen}
          onMobileClose={() => setMobileSidebarOpen(false)}
          onRefresh={handleRefreshStats}
          isRefreshing={isRefreshingStats}
        />

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-6">
          <div className="space-y-4 sm:space-y-6">
            {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {/* Mobile hamburger button */}
            <button
              onClick={() => setMobileSidebarOpen(true)}
              className="md:hidden p-2 -ml-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
              title="Open views menu"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div>
              <h1 className="text-xl sm:text-3xl font-bold text-gray-900 dark:text-white">{userRole === 'ADMIN' ? 'Admin Dashboard' : 'Agent Dashboard'}</h1>
              <p className="hidden sm:block mt-1 text-sm text-gray-600 dark:text-gray-400">
                Manage and respond to customer tickets
              </p>
            </div>
          </div>

          {/* Notification Settings */}
          {isSupported && (
            <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
              {isPolling && (
                <div className="hidden sm:flex items-center gap-2 px-3 py-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-sm text-green-700 dark:text-green-300">
                    {newTicketCount > 0 ? `${newTicketCount} new` : 'Monitoring'}
                  </span>
                </div>
              )}
              <button
                onClick={handleToggleNotifications}
                className={`relative inline-flex items-center justify-center p-2 sm:px-4 sm:py-2 rounded-md text-sm font-medium transition-colors ${
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
                <svg className="w-5 h-5 sm:mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                <span className="hidden sm:inline">{notificationsEnabled ? 'Notifications On' : 'Enable Notifications'}</span>
              </button>
            </div>
          )}
        </div>

        {/* Search and Status Filters */}
        <div className="flex flex-col gap-3">
          {/* Search Input - Full width on mobile, right side on desktop */}
          <div className="relative w-full sm:w-auto sm:ml-auto sm:order-2">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tickets..."
              className="block w-full sm:w-96 pl-10 pr-10 py-2 border border-gray-300 dark:border-gray-600 rounded-md leading-5 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary text-sm"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* Status Filter Buttons - Hidden for views that filter by single status or assignee only */}
          {!['unassigned', 'pending', 'on-hold', 'open', 'solved'].includes(activeViewId) && (
            <div className="flex gap-1.5 sm:gap-2 flex-wrap sm:order-1 -mx-1 sm:mx-0 overflow-x-auto pb-1 sm:pb-0">
              {/* "All" button resets to the view's base status */}
              <button
                onClick={() => setStatusFilter(viewBaseStatus)}
                className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-md text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${
                  statusFilter === viewBaseStatus
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                All
              </button>
              {/* Show different options based on the active view */}
              {(activeViewId === 'your-unsolved' || activeViewId === 'all-unsolved'
                ? [
                    { value: 'OPEN', label: 'Open' },
                    { value: 'PENDING', label: 'Pending' },
                    { value: 'ON_HOLD', label: 'On Hold' }
                  ]
                : activeViewId === 'incident' || activeViewId === 'problem'
                ? [
                    { value: 'OPEN', label: 'Open' },
                    { value: 'PENDING', label: 'Pending' },
                    { value: 'ON_HOLD', label: 'On Hold' },
                    { value: 'SOLVED', label: 'Solved' }
                  ]
                : [
                    { value: 'NEW', label: 'New' },
                    { value: 'OPEN', label: 'Open' },
                    { value: 'PENDING', label: 'Pending' },
                    { value: 'ON_HOLD', label: 'On Hold' },
                    { value: 'SOLVED', label: 'Solved' },
                    { value: 'CLOSED', label: 'Closed' }
                  ]
              ).map((filter) => (
                <button
                  key={filter.value}
                  onClick={() => setStatusFilter(filter.value)}
                  className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-md text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${
                    statusFilter === filter.value
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Bulk Actions Toolbar - Fixed at bottom */}
        {selectedTickets.length > 0 && (
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-blue-500 dark:bg-blue-600 border-t-2 border-blue-600 dark:border-blue-500 shadow-lg p-3 sm:p-4">
            <div className="max-w-7xl mx-auto">
              {/* Mobile: Compact layout */}
              <div className="flex items-center justify-between mb-2 sm:mb-0 sm:hidden">
                <span className="text-sm font-medium text-white">
                  {selectedTickets.length} selected
                </span>
                <button
                  onClick={() => setSelectedTickets([])}
                  className="px-3 py-1 text-white hover:text-gray-200 text-sm font-medium transition-colors"
                >
                  Clear
                </button>
              </div>

              {/* Mobile: Scrollable actions */}
              <div className="flex sm:hidden gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <CustomSelect
                    value={bulkStatus}
                    onChange={(v) => setBulkStatus(v)}
                    placeholder="Status..."
                    options={[
                      { value: 'NEW', label: 'New' },
                      { value: 'OPEN', label: 'Open' },
                      { value: 'PENDING', label: 'Pending' },
                      { value: 'ON_HOLD', label: 'On Hold' },
                      { value: 'SOLVED', label: 'Solved' },
                    ]}
                    size="sm"
                  />
                  <button
                    onClick={handleBulkStatusChange}
                    disabled={!bulkStatus || bulkUpdateMutation.isPending}
                    className="px-2 py-1.5 bg-white text-blue-600 rounded-md text-xs font-medium disabled:opacity-50"
                  >
                    Apply
                  </button>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <CustomSelect
                    value={bulkAssignee}
                    onChange={(v) => setBulkAssignee(v)}
                    placeholder="Assign..."
                    options={[
                      { value: '', label: 'Unassign' },
                      ...(agents?.map((agent: any) => ({
                        value: agent.id,
                        label: agent.firstName && agent.lastName
                          ? `${agent.firstName} ${agent.lastName}`
                          : agent.email,
                      })) || []),
                    ]}
                    size="sm"
                    className="max-w-[150px] sm:max-w-[180px]"
                  />
                  <button
                    onClick={handleBulkAssign}
                    disabled={bulkUpdateMutation.isPending}
                    className="px-2 py-1.5 bg-white text-blue-600 rounded-md text-xs font-medium disabled:opacity-50"
                  >
                    Assign
                  </button>
                </div>
                <button
                  onClick={handleMarkAsSpam}
                  disabled={bulkUpdateMutation.isPending}
                  className="px-3 py-1.5 bg-orange-500 text-white rounded-md text-xs font-medium disabled:opacity-50 flex-shrink-0"
                >
                  Spam
                </button>
                <button
                  onClick={handleBulkDelete}
                  disabled={bulkDeleteMutation.isPending}
                  className="px-3 py-1.5 bg-red-600 text-white rounded-md text-xs font-medium disabled:opacity-50 flex-shrink-0"
                >
                  Delete
                </button>
              </div>

              {/* Desktop: Original layout */}
              <div className="hidden sm:flex items-center gap-4 flex-wrap">
                <span className="text-sm font-medium text-white">
                  {selectedTickets.length} ticket(s) selected
                </span>

                <div className="flex items-center gap-2 relative">
                  <div className="relative">
                    <button
                      onClick={() => setShowStatusDropdown(!showStatusDropdown)}
                      className="px-3 py-2 border border-blue-500 dark:border-blue-800 rounded-md shadow-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-white flex items-center gap-2 min-w-[140px] sm:min-w-[160px] justify-between"
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
                              setBulkStatus('NEW');
                              setShowStatusDropdown(false);
                            }}
                            className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 first:rounded-t-md"
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

                {/* Assign to Agent Dropdown */}
                <div className="flex items-center gap-2 relative">
                  <div className="relative">
                    <button
                      onClick={() => setShowAssignDropdown(!showAssignDropdown)}
                      className="px-3 py-2 border border-blue-500 dark:border-blue-800 rounded-md shadow-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-white flex items-center gap-2 min-w-[140px] sm:min-w-[160px] justify-between"
                    >
                      <span>
                        {bulkAssignee
                          ? agents?.find((a: any) => a.id === bulkAssignee)?.email || 'Select Agent...'
                          : 'Assign to...'}
                      </span>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {showAssignDropdown && (
                      <>
                        <div
                          className="fixed inset-0 z-10"
                          onClick={() => setShowAssignDropdown(false)}
                        />
                        <div className="absolute bottom-full left-0 mb-1 w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg z-20 max-h-48 overflow-y-auto">
                          <button
                            onClick={() => {
                              setBulkAssignee('');
                              setShowAssignDropdown(false);
                            }}
                            className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 first:rounded-t-md"
                          >
                            Unassign
                          </button>
                          {agents?.map((agent: any) => (
                            <button
                              key={agent.id}
                              onClick={() => {
                                setBulkAssignee(agent.id);
                                setShowAssignDropdown(false);
                              }}
                              className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 last:rounded-b-md"
                            >
                              {agent.firstName && agent.lastName
                                ? `${agent.firstName} ${agent.lastName}`
                                : agent.email}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                  <button
                    onClick={handleBulkAssign}
                    disabled={bulkUpdateMutation.isPending}
                    className="px-4 py-2 bg-white text-blue-600 rounded-md hover:bg-gray-100 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Assign
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
          </div>
        )}

        {/* Feedback Stats Widget */}
        <FeedbackStatsWidget />

        {/* Loading state */}
        {isLoading && (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <p className="mt-2 text-gray-600 dark:text-gray-400">Loading tickets...</p>
          </div>
        )}

        {/* Tickets - Mobile Cards View */}
        {paginatedTickets && paginatedTickets.length > 0 && (
          <>
            {/* Mobile Card View */}
            <div className="md:hidden space-y-3">
              {/* Select All on Mobile */}
              <div className="flex items-center justify-between px-1">
                <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <input
                    type="checkbox"
                    checked={paginatedTickets.length > 0 && paginatedTickets.every((t: any) => selectedTickets.includes(t.id))}
                    onChange={handleSelectAll}
                    className="rounded border-gray-300 dark:border-gray-600 text-primary focus:ring-primary"
                  />
                  Select all
                </label>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {totalTickets} tickets
                </span>
              </div>

              {paginatedTickets.map((ticket: any) => (
                <div
                  key={ticket.id}
                  className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden"
                >
                  <div className="p-3">
                    {/* Top row: Checkbox, Ticket #, Status */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={selectedTickets.includes(ticket.id)}
                          onChange={(e) => handleSelectTicket(ticket.id, e as any)}
                          onClick={(e) => e.stopPropagation()}
                          className="rounded border-gray-300 dark:border-gray-600 text-primary focus:ring-primary"
                        />
                        <span
                          onClick={() => navigate(`/tickets/${ticket.id}`)}
                          className="text-sm font-medium text-primary cursor-pointer"
                        >
                          #{ticket.ticketNumber}
                        </span>
                      </div>
                      <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${getStatusColor(ticket.status)}`}>
                        {ticket.status.replace('_', ' ')}
                      </span>
                    </div>

                    {/* Subject */}
                    <h3
                      onClick={() => navigate(`/tickets/${ticket.id}`)}
                      className="text-sm font-medium text-gray-900 dark:text-white mb-2 line-clamp-2 cursor-pointer"
                    >
                      {ticket.subject}
                    </h3>

                    {/* Requester */}
                    <div className="flex items-center gap-1 mb-2">
                      <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      <span className={`text-xs truncate ${ticket.requester.isBlocked ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'}`}>
                        {ticket.requester.firstName && ticket.requester.lastName
                          ? `${ticket.requester.firstName} ${ticket.requester.lastName}`
                          : ticket.requester.name || ticket.requester.email}
                      </span>
                      {ticket.requester.isBlocked && (
                        <span className="px-1 py-0.5 text-[10px] font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 rounded">
                          BLOCKED
                        </span>
                      )}
                    </div>

                    {/* Bottom row: Priority, Assignee, Updated */}
                    <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 pt-2 border-t border-gray-100 dark:border-gray-700">
                      <div className="flex items-center gap-3">
                        <span className="capitalize">{ticket.priority.toLowerCase()}</span>
                        <span className="truncate max-w-[100px]">
                          {ticket.assignee
                            ? (ticket.assignee.firstName && ticket.assignee.lastName
                                ? `${ticket.assignee.firstName} ${ticket.assignee.lastName}`
                                : ticket.assignee.email.split('@')[0])
                            : 'Unassigned'}
                        </span>
                      </div>
                      <span>{format(new Date(ticket.updatedAt), 'MMM d, HH:mm')}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block bg-white dark:bg-gray-800 shadow-sm rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full divide-y divide-gray-200 dark:divide-gray-700" style={{ tableLayout: 'fixed' }}>
                  <colgroup>
                    <col style={{ width: '40px' }} />
                    <col style={{ width: '90px' }} />
                    <col style={{ width: '100px' }} />
                    <col style={{ width: '300px' }} />
                    <col style={{ width: '160px' }} />
                    <col style={{ width: '80px' }} />
                    <col style={{ width: '160px' }} />
                    <col style={{ width: '100px' }} />
                  </colgroup>
                  <thead className="bg-gray-50 dark:bg-gray-900">
                    <tr>
                      <th className="px-4 py-3 text-left">
                        <input
                          type="checkbox"
                          checked={paginatedTickets.length > 0 && paginatedTickets.every((t: any) => selectedTickets.includes(t.id))}
                          onChange={handleSelectAll}
                          className="rounded border-gray-300 dark:border-gray-600 text-primary focus:ring-primary"
                        />
                      </th>
                      <th
                        onClick={() => handleSort('ticketNumber')}
                        className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                      >
                        <div className="flex items-center">
                          Ticket #
                          <SortIcon field="ticketNumber" />
                        </div>
                      </th>
                      <th
                        onClick={() => handleSort('status')}
                        className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                      >
                        <div className="flex items-center">
                          Status
                          <SortIcon field="status" />
                        </div>
                      </th>
                      <th
                        onClick={() => handleSort('subject')}
                        className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                      >
                        <div className="flex items-center">
                          Subject
                          <SortIcon field="subject" />
                        </div>
                      </th>
                      <th
                        onClick={() => handleSort('requester')}
                        className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                      >
                        <div className="flex items-center">
                          Requester
                          <SortIcon field="requester" />
                        </div>
                      </th>
                      <th
                        onClick={() => handleSort('priority')}
                        className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                      >
                        <div className="flex items-center">
                          Priority
                          <SortIcon field="priority" />
                        </div>
                      </th>
                      <th
                        onClick={() => handleSort('assignee')}
                        className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                      >
                        <div className="flex items-center">
                          Assignee
                          <SortIcon field="assignee" />
                        </div>
                      </th>
                      <th
                        onClick={() => handleSort('updatedAt')}
                        className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
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
                        <td className="px-4 py-2">
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
                          className="px-4 py-2 text-sm font-medium text-primary cursor-pointer"
                        >
                          #{ticket.ticketNumber}
                        </td>
                        <td
                          onClick={() => navigate(`/tickets/${ticket.id}`)}
                          className="px-4 py-2 cursor-pointer"
                        >
                          <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full whitespace-nowrap ${getStatusColor(ticket.status)}`}>
                            {ticket.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td
                          onClick={() => navigate(`/tickets/${ticket.id}`)}
                          className="px-4 py-2 text-sm text-gray-900 dark:text-white cursor-pointer overflow-hidden"
                        >
                          <div className="truncate" title={ticket.subject}>
                            {ticket.subject}
                          </div>
                        </td>
                        <td
                          onClick={() => navigate(`/tickets/${ticket.id}`)}
                          className="px-4 py-2 text-sm cursor-pointer overflow-hidden"
                        >
                          <div className="flex items-center gap-2">
                            <span className={`truncate ${ticket.requester.isBlocked ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'}`}>
                              {ticket.requester.name || ticket.requester.email}
                            </span>
                            {ticket.requester.isBlocked && (
                              <span className="flex-shrink-0 px-1.5 py-0.5 text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 rounded" title={ticket.requester.blockedReason || 'Blocked'}>
                                BLOCKED
                              </span>
                            )}
                          </div>
                        </td>
                        <td
                          onClick={() => navigate(`/tickets/${ticket.id}`)}
                          className="px-4 py-2 text-sm text-gray-900 dark:text-white capitalize cursor-pointer"
                        >
                          {ticket.priority.toLowerCase()}
                        </td>
                        <td
                          onClick={() => navigate(`/tickets/${ticket.id}`)}
                          className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400 cursor-pointer overflow-hidden"
                        >
                          <div className="truncate">
                            {ticket.assignee ? ticket.assignee.email : 'Unassigned'}
                          </div>
                        </td>
                        <td
                          onClick={() => navigate(`/tickets/${ticket.id}`)}
                          className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400 cursor-pointer whitespace-nowrap"
                        >
                          {format(new Date(ticket.updatedAt), 'MMM d, HH:mm')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pagination Controls - Shared for both mobile and desktop */}
            {totalPages > 0 && (
              <div className="bg-white dark:bg-gray-800 px-3 sm:px-6 py-3 flex items-center justify-between border border-gray-200 dark:border-gray-700 rounded-lg mt-3">
                {/* Mobile pagination */}
                <div className="flex-1 flex items-center justify-between md:hidden">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {startIndex + 1}-{endIndex} of {totalTickets}
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                      className="relative inline-flex items-center px-3 py-1.5 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Prev
                    </button>
                    <span className="inline-flex items-center px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300">
                      {currentPage}/{totalPages}
                    </span>
                    <button
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      className="relative inline-flex items-center px-3 py-1.5 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                </div>
                {/* Desktop pagination */}
                <div className="hidden md:flex-1 md:flex md:items-center md:justify-between">
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
                      <CustomSelect
                        id="itemsPerPage"
                        value={String(itemsPerPage)}
                        onChange={(v) => handleItemsPerPageChange(Number(v))}
                        options={[
                          { value: '25', label: '25' },
                          { value: '50', label: '50' },
                          { value: '75', label: '75' },
                          { value: '100', label: '100' },
                        ]}
                        size="sm"
                      />
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
          </>
        )}

        {/* Empty state */}
        {paginatedTickets && paginatedTickets.length === 0 && (
          <div className="text-center py-8 sm:py-12 px-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <svg className="mx-auto h-10 w-10 sm:h-12 sm:w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No tickets found</h3>
            <p className="mt-1 text-xs sm:text-sm text-gray-500 dark:text-gray-400">
              {searchQuery
                ? `No tickets match "${searchQuery}".`
                : statusFilter
                ? `No ${statusFilter.toLowerCase().replace('_', ' ')} tickets at the moment.`
                : 'No tickets in the system.'}
            </p>
          </div>
        )}
          </div>
        </div>
      </div>

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.type === 'spam' ? 'Mark as Spam' : 'Delete Tickets'}
        message={
          confirmModal.type === 'spam'
            ? `Mark ${selectedTickets.length} ticket(s) as spam and block the requester(s)? This will close the selected tickets and block the requester(s) from accessing the system.`
            : `Are you sure you want to delete ${selectedTickets.length} ticket(s)?`
        }
        confirmLabel={confirmModal.type === 'spam' ? 'Mark as Spam' : 'Delete'}
        confirmVariant="danger"
        onConfirm={handleConfirmAction}
        onCancel={() => setConfirmModal({ isOpen: false, type: null })}
      />
    </Layout>
  );
};

export default AgentDashboard;
