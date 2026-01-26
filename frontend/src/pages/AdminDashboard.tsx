import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { analyticsApi, ticketApi, adminAnalyticsApi } from '../lib/api';
import Layout from '../components/Layout';
import { format } from 'date-fns';
import { useNotification } from '../contexts/NotificationContext';
import { useTicketNotifications } from '../hooks/useTicketNotifications';

const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'analytics' | 'tickets' | 'performance'>('analytics');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

  const { permission, requestPermission, isSupported } = useNotification();
  const { newTicketCount, isPolling } = useTicketNotifications({
    enabled: notificationsEnabled,
    pollingInterval: 30000
  });
  const { data: agentStats, isLoading: loadingAgents } = useQuery({
    queryKey: ['agentAnalytics'],
    queryFn: async () => {
      const response = await analyticsApi.getAgentStats();
      return response.data;
    },
    enabled: activeTab === 'analytics'
  });

  const { data: systemStats } = useQuery({
    queryKey: ['systemStats'],
    queryFn: async () => {
      const response = await analyticsApi.getSystemStats();
      return response.data;
    },
    enabled: activeTab === 'analytics'
  });

  const { data: tickets, isLoading: loadingTickets } = useQuery({
    queryKey: ['adminTickets', statusFilter],
    queryFn: async () => {
      const response = await ticketApi.getAll(
        statusFilter ? { status: statusFilter } : undefined
      );
      return response.data;
    },
    enabled: activeTab === 'tickets'
  });

  const { data: ticketStats } = useQuery({
    queryKey: ['ticketStats'],
    queryFn: async () => {
      const response = await ticketApi.getStats();
      return response.data;
    },
    enabled: activeTab === 'tickets'
  });

  const { data: agentPerformance, isLoading: loadingPerformance } = useQuery({
    queryKey: ['agentPerformance'],
    queryFn: async () => {
      const response = await adminAnalyticsApi.getAgentPerformance();
      return response.data;
    },
    enabled: activeTab === 'performance'
  });

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
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

  const handleToggleNotifications = async () => {
    if (!isSupported) return;

    if (permission === 'granted') {
      setNotificationsEnabled(!notificationsEnabled);
    } else if (permission === 'default') {
      await requestPermission();
      if (Notification.permission === 'granted') {
        setNotificationsEnabled(true);
      }
    }
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

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Admin Dashboard</h1>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              {activeTab === 'analytics'
                ? 'System analytics and agent performance metrics'
                : activeTab === 'performance'
                ? 'Detailed agent contributions and solve rates based on time and replies'
                : 'Manage and respond to tickets'}
            </p>
          </div>

          {/* Notification Settings */}
          {isSupported && activeTab === 'tickets' && (
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
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3l18 18" />
                  )}
                </svg>
                {notificationsEnabled ? 'Notifications On' : 'Enable Notifications'}
              </button>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="-mb-px flex gap-6">
            <button
              onClick={() => setActiveTab('analytics')}
              className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'analytics'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              Analytics
            </button>
            <button
              onClick={() => setActiveTab('performance')}
              className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'performance'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              Agent Performance
            </button>
            <button
              onClick={() => setActiveTab('tickets')}
              className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'tickets'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              Tickets
              {ticketStats && (
                <span className="ml-2 px-2 py-0.5 bg-primary/10 text-primary rounded-full text-xs">
                  {ticketStats.total}
                </span>
              )}
            </button>
          </nav>
        </div>

        {/* Analytics Tab */}
        {activeTab === 'analytics' && systemStats && (
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">System Overview</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                <div className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Tickets</div>
                <div className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">
                  {systemStats.overview.totalTickets}
                </div>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                <div className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Users</div>
                <div className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">
                  {systemStats.overview.totalUsers}
                </div>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                <div className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Agents</div>
                <div className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">
                  {systemStats.overview.totalAgents}
                </div>
              </div>
            </div>

            {/* Ticket status breakdown */}
            <div className="mt-6 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Tickets by Status</h3>
              <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                {Object.entries(systemStats.tickets.byStatus).map(([status, count]) => (
                  <div key={status} className="text-center">
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">{count as number}</div>
                    <div className="text-xs text-gray-600 dark:text-gray-400 uppercase mt-1">{status.replace('_', ' ')}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Agent Performance */}
        {activeTab === 'analytics' && (
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Agent Performance</h2>

          {loadingAgents && (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          )}

          {agentStats && agentStats.length > 0 && (
            <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Agent
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Total Sessions
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Avg Duration
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Total Replies
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Assigned Tickets
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Solved
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Solve Rate
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Last Active
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {agentStats.map((stat: any) => (
                    <tr key={stat.agent.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">{stat.agent.name}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">{stat.agent.email}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                          stat.sessions.isOnline
                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                            : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                        }`}>
                          {stat.sessions.isOnline ? 'Online' : 'Offline'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        {stat.sessions.total}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        {formatDuration(stat.sessions.avgDuration)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        {stat.replies.total}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        {stat.tickets.assigned}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        {stat.tickets.solved}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        {stat.tickets.solveRate.toFixed(1)}%
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {stat.sessions.lastLogin ? format(new Date(stat.sessions.lastLogin), 'MMM d, HH:mm') : 'Never'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {agentStats && agentStats.length === 0 && (
            <div className="text-center py-8 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <p className="text-gray-600 dark:text-gray-400">No agent data available</p>
            </div>
          )}
        </div>
        )}

        {/* Agent Performance Tab */}
        {activeTab === 'performance' && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Agent Performance & Contributions</h2>

            {loadingPerformance && (
              <div className="text-center py-12">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                <p className="mt-2 text-gray-600 dark:text-gray-400">Loading performance data...</p>
              </div>
            )}

            {agentPerformance && agentPerformance.agents && agentPerformance.agents.length > 0 && (
              <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-900">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Agent
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Total Tickets
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Solved Tickets
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Solve Rate
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Total Time Spent
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Avg Time/Ticket
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Total Replies
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {agentPerformance.agents.map((perf: any) => (
                      <tr key={perf.agent.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {perf.agent.firstName && perf.agent.lastName
                              ? `${perf.agent.firstName} ${perf.agent.lastName}`
                              : perf.agent.email}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">{perf.agent.email}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          {perf.totalTickets}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          {perf.solvedTickets}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2 max-w-[100px]">
                              <div
                                className="bg-green-600 h-2 rounded-full"
                                style={{ width: `${perf.solveRate}%` }}
                              ></div>
                            </div>
                            <span className="text-sm font-medium text-gray-900 dark:text-white">
                              {perf.solveRate}%
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          {formatDuration(perf.totalTimeSpent)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          {formatDuration(perf.avgTimePerTicket)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          {perf.totalReplies}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {agentPerformance && agentPerformance.agents && agentPerformance.agents.length === 0 && (
              <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                <p className="text-gray-600 dark:text-gray-400">No agent performance data available</p>
              </div>
            )}
          </div>
        )}

        {/* Tickets Tab */}
        {activeTab === 'tickets' && (
          <div className="space-y-6">
            {/* Statistics Cards */}
            {ticketStats && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <button
                  onClick={() => setStatusFilter('NEW')}
                  className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                >
                  <div className="text-sm font-medium text-gray-600 dark:text-gray-400">New</div>
                  <div className="mt-2 text-3xl font-bold text-blue-600 dark:text-blue-400">{ticketStats.byStatus.new || 0}</div>
                </button>
                <button
                  onClick={() => setStatusFilter('OPEN')}
                  className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                >
                  <div className="text-sm font-medium text-gray-600 dark:text-gray-400">Open</div>
                  <div className="mt-2 text-3xl font-bold text-green-600 dark:text-green-400">{ticketStats.byStatus.open || 0}</div>
                </button>
                <button
                  onClick={() => setStatusFilter('PENDING')}
                  className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                >
                  <div className="text-sm font-medium text-gray-600 dark:text-gray-400">Pending</div>
                  <div className="mt-2 text-3xl font-bold text-yellow-600 dark:text-yellow-400">{ticketStats.byStatus.pending || 0}</div>
                </button>
                <button
                  onClick={() => setStatusFilter('ON_HOLD')}
                  className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                >
                  <div className="text-sm font-medium text-gray-600 dark:text-gray-400">On Hold</div>
                  <div className="mt-2 text-3xl font-bold text-orange-600 dark:text-orange-400">{ticketStats.byStatus.on_hold || 0}</div>
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
                  {ticketStats && filter.value && (
                    <span className="ml-2 px-2 py-0.5 rounded-full bg-white/20 text-xs">
                      {ticketStats.byStatus[filter.value.toLowerCase()] || 0}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Loading state */}
            {loadingTickets && (
              <div className="text-center py-12">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                <p className="mt-2 text-gray-600 dark:text-gray-400">Loading tickets...</p>
              </div>
            )}

            {/* Tickets table */}
            {tickets && tickets.length > 0 && (
              <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-900">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Ticket #
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Subject
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Requester
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Priority
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Assignee
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Updated
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {tickets.map((ticket: any) => (
                      <tr
                        key={ticket.id}
                        onClick={() => navigate(`/tickets/${ticket.id}`)}
                        className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer"
                      >
                        <td className="px-6 py-2 whitespace-nowrap text-sm font-medium text-primary">
                          #{ticket.ticketNumber}
                        </td>
                        <td className="px-6 py-2 text-sm text-gray-900 dark:text-white">
                          {ticket.subject}
                        </td>
                        <td className="px-6 py-2 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {ticket.requester.email}
                        </td>
                        <td className="px-6 py-2 whitespace-nowrap">
                          <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(ticket.status)}`}>
                            {ticket.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-6 py-2 whitespace-nowrap text-sm text-gray-900 dark:text-white capitalize">
                          {ticket.priority.toLowerCase()}
                        </td>
                        <td className="px-6 py-2 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {ticket.assignee ? ticket.assignee.email : 'Unassigned'}
                        </td>
                        <td className="px-6 py-2 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {format(new Date(ticket.updatedAt), 'MMM d, HH:mm')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Empty state */}
            {tickets && tickets.length === 0 && (
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
        )}
      </div>
    </Layout>
  );
};

export default AdminDashboard;
