import React, { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useClerk } from '@clerk/clerk-react';
import { adminAnalyticsApi, sessionApi } from '../lib/api';
import Layout from '../components/Layout';

const AdminDashboard: React.FC = () => {
  const clerk = useClerk();
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

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
      try {
        const token = await window.Clerk?.session?.getToken();
        if (token) {
          fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}/sessions/end/${activeSessionId}`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            keepalive: true
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

  const { data: agentPerformance, isLoading: loadingPerformance } = useQuery({
    queryKey: ['agentPerformance'],
    queryFn: async () => {
      const response = await adminAnalyticsApi.getAgentPerformance();
      return response.data;
    }
  });

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Admin Dashboard</h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Detailed agent contributions and solve rates based on time and replies
          </p>
        </div>

        {/* Agent Performance Content */}
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Agent Performance & Contributions</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">Detailed metrics based on time tracking and replies</p>
            </div>
          </div>

          {loadingPerformance && (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-10 w-10 border-4 border-gray-200 border-t-primary"></div>
              <p className="mt-3 text-gray-600 dark:text-gray-400">Loading performance data...</p>
            </div>
          )}

          {agentPerformance && agentPerformance.agents && agentPerformance.agents.length > 0 && (
            <div className="bg-white dark:bg-gray-800 shadow-lg rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                        Agent
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                        Total Tickets
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                        Solved Tickets
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                        Solve Rate
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                        Total Time Spent
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                        Avg Time/Ticket
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                        Total Replies
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {agentPerformance.agents.map((perf: any, index: number) => (
                      <tr key={perf.agent.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                              {index + 1}
                            </div>
                            <div>
                              <div className="text-sm font-semibold text-gray-900 dark:text-white">
                                {perf.agent.firstName && perf.agent.lastName
                                  ? `${perf.agent.firstName} ${perf.agent.lastName}`
                                  : perf.agent.email}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">{perf.agent.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center px-3 py-1 rounded-md text-sm font-semibold bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                            {perf.totalTickets}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center px-3 py-1 rounded-md text-sm font-semibold bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300">
                            {perf.solvedTickets}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2 w-24">
                              <div
                                className="bg-gradient-to-r from-green-500 to-emerald-500 h-2 rounded-full transition-all duration-500"
                                style={{ width: `${perf.solveRate}%` }}
                              ></div>
                            </div>
                            <span className="text-sm font-bold text-gray-900 dark:text-white min-w-[3rem] text-right">
                              {perf.solveRate}%
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center px-3 py-1 rounded-md text-sm font-semibold bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">
                            {formatDuration(perf.totalTimeSpent)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center px-3 py-1 rounded-md text-sm font-semibold bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300">
                            {formatDuration(perf.avgTimePerTicket)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center px-3 py-1 rounded-md text-sm font-semibold bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300">
                            {perf.totalReplies}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {agentPerformance && agentPerformance.agents && agentPerformance.agents.length === 0 && (
            <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-lg">
              <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <p className="text-gray-600 dark:text-gray-400 font-medium">No agent performance data available</p>
              <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">Performance metrics will appear when agents start tracking time</p>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default AdminDashboard;
