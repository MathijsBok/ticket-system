import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { analyticsApi, adminAnalyticsApi, aiSummaryAnalyticsApi, feedbackApi } from '../lib/api';
import Layout from '../components/Layout';
import CustomSelect from '../components/CustomSelect';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, LineChart, Line, XAxis, YAxis, CartesianGrid, BarChart, Bar } from 'recharts';

// Format label - handles ISO dates and other formats
const formatLabel = (label: any): string => {
  if (!label) return '';
  const str = String(label);
  // Check if it looks like an ISO date (e.g., "2026-01-14T00:00:00.000Z" or "2026-01-14")
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    const date = new Date(str);
    if (!isNaN(date.getTime())) {
      return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    }
  }
  return str;
};

// Custom tooltip props interface for recharts
interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}

// Custom Tooltip Component with proper dark mode support
const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
  if (active && payload && payload.length) {
    // Detect dark mode by checking if html element has 'dark' class
    const isDarkMode = document.documentElement.classList.contains('dark');
    const formattedLabel = formatLabel(label);

    return (
      <div
        className="rounded-xl shadow-2xl border transition-all duration-200"
        style={{
          backgroundColor: isDarkMode ? 'rgba(31, 41, 55, 0.95)' : 'rgba(255, 255, 255, 0.95)',
          borderColor: isDarkMode ? 'rgba(75, 85, 99, 0.5)' : 'rgba(229, 231, 235, 0.5)',
          padding: '12px 16px',
          backdropFilter: 'blur(8px)'
        }}
      >
        {formattedLabel && (
          <p className="text-sm font-semibold mb-2 text-gray-900 dark:text-white">
            {formattedLabel}
          </p>
        )}
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center gap-2 mb-1 last:mb-0">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {entry.name}:
            </span>
            <span className="text-sm font-bold text-gray-900 dark:text-white">
              {entry.value}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

const AnalyticsDashboard: React.FC = () => {
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [countryYear, setCountryYear] = useState<number>(new Date().getFullYear());
  const [formYear, setFormYear] = useState<number>(new Date().getFullYear());
  const [channelYear, setChannelYear] = useState<number>(new Date().getFullYear());
  const [priorityYear, setPriorityYear] = useState<number>(new Date().getFullYear());
  const [weekdayYear, setWeekdayYear] = useState<number>(new Date().getFullYear());
  const [hourlyYear, setHourlyYear] = useState<number>(new Date().getFullYear());
  const [agentPerfYear, setAgentPerfYear] = useState<number>(new Date().getFullYear());
  const [aiSummaryYear, setAiSummaryYear] = useState<number>(new Date().getFullYear());
  const [feedbackYear, setFeedbackYear] = useState<number>(new Date().getFullYear());

  const { data: dashboardData, isLoading, error } = useQuery({
    queryKey: ['dashboardAnalytics'],
    queryFn: async () => {
      const response = await analyticsApi.getDashboard();
      return response.data;
    },
    refetchInterval: 60000 // Refresh every minute
  });

  const { data: agentPerformanceData } = useQuery({
    queryKey: ['agentPerformance', agentPerfYear],
    queryFn: async () => {
      const response = await adminAnalyticsApi.getAgentPerformance(agentPerfYear);
      return response.data;
    },
    refetchInterval: 60000,
    placeholderData: (previousData) => previousData
  });

  const { data: aiSummaryData } = useQuery({
    queryKey: ['aiSummaryAnalytics', aiSummaryYear],
    queryFn: async () => {
      const response = await aiSummaryAnalyticsApi.getStats(aiSummaryYear);
      return response.data;
    },
    refetchInterval: 60000,
    placeholderData: (previousData) => previousData
  });

  const { data: feedbackData } = useQuery({
    queryKey: ['feedbackAnalytics', feedbackYear],
    queryFn: async () => {
      const response = await feedbackApi.getAll(feedbackYear);
      return response.data;
    },
    refetchInterval: 60000,
    placeholderData: (previousData) => previousData
  });

  const { data: solvedByMonthData } = useQuery({
    queryKey: ['solvedByMonth', selectedYear],
    queryFn: async () => {
      const response = await analyticsApi.getSolvedByMonth(selectedYear);
      return response.data;
    },
    refetchInterval: 60000
  });

  const { data: countriesByYearData } = useQuery({
    queryKey: ['countriesByYear', countryYear],
    queryFn: async () => {
      const response = await analyticsApi.getCountriesByYear(countryYear);
      return response.data;
    },
    refetchInterval: 60000
  });

  const { data: formsByYearData } = useQuery({
    queryKey: ['formsByYear', formYear],
    queryFn: async () => {
      const response = await analyticsApi.getFormsByYear(formYear);
      return response.data;
    },
    refetchInterval: 60000
  });

  const { data: backlogHistoryData } = useQuery({
    queryKey: ['backlogHistory'],
    queryFn: async () => {
      const response = await analyticsApi.getBacklogHistory();
      return response.data;
    },
    refetchInterval: 60000
  });

  const { data: channelByYearData } = useQuery({
    queryKey: ['channelByYear', channelYear],
    queryFn: async () => {
      const response = await analyticsApi.getChannelByYear(channelYear);
      return response.data;
    },
    refetchInterval: 60000
  });

  const { data: priorityByYearData } = useQuery({
    queryKey: ['priorityByYear', priorityYear],
    queryFn: async () => {
      const response = await analyticsApi.getPriorityByYear(priorityYear);
      return response.data;
    },
    refetchInterval: 60000
  });

  const { data: weekdayByYearData } = useQuery({
    queryKey: ['weekdayByYear', weekdayYear],
    queryFn: async () => {
      const response = await analyticsApi.getWeekdayByYear(weekdayYear);
      return response.data;
    },
    refetchInterval: 60000
  });

  const { data: hourlyByYearData } = useQuery({
    queryKey: ['hourlyByYear', hourlyYear],
    queryFn: async () => {
      const response = await analyticsApi.getHourlyByYear(hourlyYear);
      return response.data;
    },
    refetchInterval: 60000
  });

  // Color schemes for different charts
  const BACKLOG_COLORS = {
    new: '#F59E0B',      // Yellow/Amber
    open: '#EF4444',     // Red
    pending: '#3B82F6',  // Blue
    hold: '#4B5563'      // Gray/Teal
  };
  const PRIORITY_COLORS = {
    LOW: '#10B981',      // Green
    NORMAL: '#3B82F6',   // Blue
    HIGH: '#F97316',     // Orange
    URGENT: '#EF4444'    // Red
  };

  const COUNTRY_COLORS = [
    '#8B5CF6', '#3B82F6', '#10B981', '#F59E0B',
    '#EF4444', '#EC4899', '#06B6D4', '#84CC16',
    '#F97316', '#6366F1'
  ];

  const CHANNEL_COLORS = {
    WEB: '#3B82F6',
    EMAIL: '#10B981',
    API: '#8B5CF6',
    SLACK: '#F59E0B',
    INTERNAL: '#6B7280'
  };

  const renderCustomLabel = (entry: any) => {
    return `${entry.value}`;
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="flex justify-center items-center h-96">
          <div className="relative">
            <div className="inline-block animate-spin rounded-full h-16 w-16 border-4 border-primary border-t-transparent"></div>
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
              <div className="w-8 h-8 bg-primary rounded-full animate-pulse"></div>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <div className="text-center py-12">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full mb-4">
            <svg className="w-8 h-8 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <p className="text-xl font-semibold text-red-600 dark:text-red-400">Error loading analytics</p>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">{(error as Error).message}</p>
        </div>
      </Layout>
    );
  }

  if (!dashboardData) {
    return (
      <Layout>
        <div className="text-center py-12">
          <p className="text-gray-600 dark:text-gray-400">No analytics data available</p>
        </div>
      </Layout>
    );
  }

  const { overview, charts, trend } = dashboardData;

  return (
    <Layout>
      <div className="space-y-8 animate-fadeIn">
        {/* Header with gradient background */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-purple-500/10 to-pink-500/10 dark:from-primary/20 dark:via-purple-500/20 dark:to-pink-500/20 p-8 border border-primary/20">
          <div className="absolute inset-0 bg-grid-white/5"></div>
          <div className="relative">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
              Analytics Dashboard
            </h1>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              Real-time insights and comprehensive ticket system metrics
            </p>
          </div>
        </div>

        {/* Overview Cards with hover effects - Compact */}
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          <div className="group relative overflow-hidden bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5">
            <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <div className="relative p-4 text-white">
              <div className="flex items-center justify-between mb-2">
                <div className="bg-white/20 backdrop-blur-sm rounded-lg p-2">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
              </div>
              <p className="text-xs font-medium text-blue-100 mb-0.5">Total Tickets</p>
              <p className="text-2xl font-bold">{overview.totalTickets?.toLocaleString()}</p>
            </div>
          </div>

          <div className="group relative overflow-hidden bg-gradient-to-br from-green-500 to-green-600 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5">
            <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <div className="relative p-4 text-white">
              <div className="flex items-center justify-between mb-2">
                <div className="bg-white/20 backdrop-blur-sm rounded-lg p-2">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
              </div>
              <p className="text-xs font-medium text-green-100 mb-0.5">Open Tickets</p>
              <p className="text-2xl font-bold">{overview.openTickets?.toLocaleString()}</p>
            </div>
          </div>

          <div className="group relative overflow-hidden bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5">
            <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <div className="relative p-4 text-white">
              <div className="flex items-center justify-between mb-2">
                <div className="bg-white/20 backdrop-blur-sm rounded-lg p-2">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              <p className="text-xs font-medium text-purple-100 mb-0.5">Solved Tickets</p>
              <p className="text-2xl font-bold">{overview.solvedTickets?.toLocaleString()}</p>
            </div>
          </div>

          <div className="group relative overflow-hidden bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5">
            <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <div className="relative p-4 text-white">
              <div className="flex items-center justify-between mb-2">
                <div className="bg-white/20 backdrop-blur-sm rounded-lg p-2">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                </div>
              </div>
              <p className="text-xs font-medium text-orange-100 mb-0.5">Solve Rate</p>
              <p className="text-2xl font-bold">{overview.solveRate}%</p>
            </div>
          </div>

          <div className="group relative overflow-hidden bg-gradient-to-br from-pink-500 to-pink-600 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5">
            <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <div className="relative p-4 text-white">
              <div className="flex items-center justify-between mb-2">
                <div className="bg-white/20 backdrop-blur-sm rounded-lg p-2">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                </div>
              </div>
              <p className="text-xs font-medium text-pink-100 mb-0.5">Total Users</p>
              <p className="text-2xl font-bold">{overview.totalUsers?.toLocaleString() || 0}</p>
            </div>
          </div>

          <div className="group relative overflow-hidden bg-gradient-to-br from-cyan-500 to-cyan-600 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5">
            <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <div className="relative p-4 text-white">
              <div className="flex items-center justify-between mb-2">
                <div className="bg-white/20 backdrop-blur-sm rounded-lg p-2">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                  </svg>
                </div>
              </div>
              <p className="text-xs font-medium text-cyan-100 mb-0.5">Total Comments</p>
              <p className="text-2xl font-bold">{overview.totalComments?.toLocaleString() || 0}</p>
            </div>
          </div>

          <div className="group relative overflow-hidden bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5">
            <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <div className="relative p-4 text-white">
              <div className="flex items-center justify-between mb-2">
                <div className="bg-white/20 backdrop-blur-sm rounded-lg p-2">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                  </svg>
                </div>
              </div>
              <p className="text-xs font-medium text-indigo-100 mb-0.5">Avg Comments/Ticket</p>
              <p className="text-2xl font-bold">{overview.avgCommentsPerTicket || '0'}</p>
            </div>
          </div>

          <div className="group relative overflow-hidden bg-gradient-to-br from-teal-500 to-teal-600 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5">
            <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <div className="relative p-4 text-white">
              <div className="flex items-center justify-between mb-2">
                <div className="bg-white/20 backdrop-blur-sm rounded-lg p-2">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                  </svg>
                </div>
              </div>
              <p className="text-xs font-medium text-teal-100 mb-0.5">Form Responses</p>
              <p className="text-2xl font-bold">{overview.totalFormResponses?.toLocaleString() || 0}</p>
            </div>
          </div>
        </div>

        {/* Charts Grid with modern cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          {/* Tickets Solved per Month */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 p-6 border border-gray-100 dark:border-gray-700">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-xl flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">Tickets Solved per Month</h3>
              </div>
              {/* Year Selector */}
              <CustomSelect
                value={String(selectedYear)}
                onChange={(v) => setSelectedYear(Number(v))}
                options={(solvedByMonthData?.availableYears || [new Date().getFullYear()]).map((year: number) => ({ value: String(year), label: String(year) }))}
                size="sm"
              />
            </div>
            <div className="h-[200px] sm:h-[250px]"><ResponsiveContainer width="100%" height="100%">
              <BarChart data={solvedByMonthData?.data || []} margin={{ left: 0, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
                <XAxis dataKey="name" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" name="Solved" fill="#8B5CF6" radius={[8, 8, 0, 0]} label={{ position: 'top', fill: '#6B7280', fontSize: 10, fontWeight: 600 }} />
              </BarChart>
            </ResponsiveContainer></div>
          </div>

          {/* Tickets by Priority - Horizontal Bar Chart */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 p-6 border border-gray-100 dark:border-gray-700">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-red-500 rounded-xl flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">Tickets by Priority</h3>
              </div>
              {/* Year Selector */}
              <CustomSelect
                value={String(priorityYear)}
                onChange={(v) => setPriorityYear(Number(v))}
                options={(priorityByYearData?.availableYears || [new Date().getFullYear()]).map((year: number) => ({ value: String(year), label: String(year) }))}
                size="sm"
              />
            </div>
            <div className="h-[160px] sm:h-[200px]"><ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={(priorityByYearData?.data || charts.priority).map((p: any) => ({ ...p, name: p.label || p.name }))}
                layout="vertical"
                margin={{ left: 20, right: 40 }}
              >
                <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" horizontal={false} />
                <XAxis type="number" className="text-xs" />
                <YAxis type="category" dataKey="name" className="text-xs" width={70} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="value" radius={[0, 8, 8, 0]} label={{ position: 'right', fill: '#6B7280', fontSize: 12, fontWeight: 600 }}>
                  {(priorityByYearData?.data || charts.priority).map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={PRIORITY_COLORS[entry.name as keyof typeof PRIORITY_COLORS] || '#6B7280'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer></div>
          </div>

          {/* Top Countries per Year */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 p-6 border border-gray-100 dark:border-gray-700">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-teal-500 rounded-xl flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">Top Countries</h3>
              </div>
              {/* Year Selector */}
              <CustomSelect
                value={String(countryYear)}
                onChange={(v) => setCountryYear(Number(v))}
                options={(countriesByYearData?.availableYears || [new Date().getFullYear()]).map((year: number) => ({ value: String(year), label: String(year) }))}
                size="sm"
              />
            </div>
            {countriesByYearData?.data && countriesByYearData.data.length > 0 ? (
              <div className="h-[220px] sm:h-[300px]"><ResponsiveContainer width="100%" height="100%">
                <BarChart data={countriesByYearData.data} margin={{ left: 0, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
                  <XAxis dataKey="name" className="text-xs" angle={-45} textAnchor="end" height={80} interval={0} />
                  <YAxis className="text-xs" />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="count" name="Tickets" fill="#10B981" radius={[8, 8, 0, 0]} label={{ position: 'top', fill: '#6B7280', fontSize: 10, fontWeight: 600 }}>
                    {countriesByYearData.data.map((_entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COUNTRY_COLORS[index % COUNTRY_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer></div>
            ) : (
              <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                No country data available for {countryYear}
              </div>
            )}
          </div>

          {/* Tickets by Channel */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 p-6 border border-gray-100 dark:border-gray-700">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-pink-500 to-purple-500 rounded-xl flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">Tickets by Channel</h3>
              </div>
              {/* Year Selector */}
              <CustomSelect
                value={String(channelYear)}
                onChange={(v) => setChannelYear(Number(v))}
                options={(channelByYearData?.availableYears || [new Date().getFullYear()]).map((year: number) => ({ value: String(year), label: String(year) }))}
                size="sm"
              />
            </div>
            <div className="h-[220px] sm:h-[300px]"><ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={channelByYearData?.data || charts.channel}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={renderCustomLabel}
                  outerRadius={100}
                  innerRadius={60}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {(channelByYearData?.data || charts.channel).map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={CHANNEL_COLORS[entry.name as keyof typeof CHANNEL_COLORS] || '#6B7280'} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend verticalAlign="bottom" height={36} />
              </PieChart>
            </ResponsiveContainer></div>
          </div>

          {/* Tickets by Weekday */}
          {(weekdayByYearData?.data || charts.weekday) && (weekdayByYearData?.data || charts.weekday).length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 p-6 border border-gray-100 dark:border-gray-700">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-blue-500 rounded-xl flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">Tickets by Day of Week</h3>
                </div>
                {/* Year Selector */}
                <CustomSelect
                  value={String(weekdayYear)}
                  onChange={(v) => setWeekdayYear(Number(v))}
                  options={(weekdayByYearData?.availableYears || [new Date().getFullYear()]).map((year: number) => ({ value: String(year), label: String(year) }))}
                  size="sm"
                />
              </div>
              <div className="h-[220px] sm:h-[300px]"><ResponsiveContainer width="100%" height="100%">
                <BarChart data={weekdayByYearData?.data || charts.weekday}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
                  <XAxis dataKey="name" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="value" fill="url(#colorGradient)" radius={[8, 8, 0, 0]} />
                  <defs>
                    <linearGradient id="colorGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.8}/>
                      <stop offset="100%" stopColor="#8B5CF6" stopOpacity={0.8}/>
                    </linearGradient>
                  </defs>
                </BarChart>
              </ResponsiveContainer></div>
            </div>
          )}

          {/* Tickets by Hour of Day */}
          {(hourlyByYearData?.data || charts.hourly) && (hourlyByYearData?.data || charts.hourly).length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 p-6 border border-gray-100 dark:border-gray-700">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">Tickets by Hour of Day</h3>
                </div>
                {/* Year Selector */}
                <CustomSelect
                  value={String(hourlyYear)}
                  onChange={(v) => setHourlyYear(Number(v))}
                  options={(hourlyByYearData?.availableYears || [new Date().getFullYear()]).map((year: number) => ({ value: String(year), label: String(year) }))}
                  size="sm"
                />
              </div>
              <div className="h-[220px] sm:h-[300px]"><ResponsiveContainer width="100%" height="100%">
                <BarChart data={hourlyByYearData?.data || charts.hourly}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
                  <XAxis dataKey="label" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="count" fill="url(#colorGradient2)" radius={[8, 8, 0, 0]} />
                  <defs>
                    <linearGradient id="colorGradient2" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#8B5CF6" stopOpacity={0.8}/>
                      <stop offset="100%" stopColor="#EC4899" stopOpacity={0.8}/>
                    </linearGradient>
                  </defs>
                </BarChart>
              </ResponsiveContainer></div>
            </div>
          )}

          {/* Categories */}
          {charts.categories && charts.categories.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 p-6 border border-gray-100 dark:border-gray-700">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-xl flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">Tickets by Category</h3>
              </div>
              <div className="h-[220px] sm:h-[300px]"><ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={charts.categories}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={renderCustomLabel}
                    outerRadius={100}
                    innerRadius={60}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {charts.categories.map((_entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COUNTRY_COLORS[index % COUNTRY_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend verticalAlign="bottom" height={36} />
                </PieChart>
              </ResponsiveContainer></div>
            </div>
          )}
        </div>

        {/* Ticket Trend Chart - Full width */}
        {trend && trend.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 p-6 border border-gray-100 dark:border-gray-700">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-blue-500 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">30-Day Ticket Trend</h3>
            </div>
            <div className="h-[280px] sm:h-[350px]"><ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
                <XAxis
                  dataKey="date"
                  className="text-xs"
                  tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                />
                <YAxis className="text-xs" />
                <Tooltip
                  content={<CustomTooltip />}
                  labelFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                />
                <Legend />
                <Line type="monotone" dataKey="count" stroke="#3B82F6" strokeWidth={3} name="Created Tickets" dot={{ fill: '#3B82F6', r: 4 }} activeDot={{ r: 6 }} />
                <Line type="monotone" dataKey="solved" stroke="#10B981" strokeWidth={3} name="Solved" dot={{ fill: '#10B981', r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer></div>
          </div>
        )}

        {/* Historical Backlog Charts */}
        {backlogHistoryData && (
          <div className="grid grid-cols-1 gap-6">
            {/* Daily Historical Backlog by Status (30 days) */}
            {backlogHistoryData.daily && backlogHistoryData.daily.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 p-6 border border-gray-100 dark:border-gray-700">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">Daily historical backlog by status (30 days)</h3>
                </div>
                <div className="flex items-center gap-4 mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: BACKLOG_COLORS.new }}></div>
                    <span className="text-sm text-gray-600 dark:text-gray-400">New</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: BACKLOG_COLORS.open }}></div>
                    <span className="text-sm text-gray-600 dark:text-gray-400">Open</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: BACKLOG_COLORS.pending }}></div>
                    <span className="text-sm text-gray-600 dark:text-gray-400">Pending</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: BACKLOG_COLORS.hold }}></div>
                    <span className="text-sm text-gray-600 dark:text-gray-400">Hold</span>
                  </div>
                </div>
                <div className="h-[280px] sm:h-[350px]"><ResponsiveContainer width="100%" height="100%">
                  <BarChart data={backlogHistoryData.daily}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
                    <XAxis
                      dataKey="date"
                      className="text-xs"
                      tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}
                      interval={2}
                    />
                    <YAxis className="text-xs" />
                    <Tooltip
                      content={<CustomTooltip />}
                      labelFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                    />
                    <Bar dataKey="new" stackId="backlog" fill={BACKLOG_COLORS.new} name="New" />
                    <Bar dataKey="open" stackId="backlog" fill={BACKLOG_COLORS.open} name="Open" />
                    <Bar dataKey="pending" stackId="backlog" fill={BACKLOG_COLORS.pending} name="Pending" />
                    <Bar dataKey="hold" stackId="backlog" fill={BACKLOG_COLORS.hold} name="Hold" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer></div>
              </div>
            )}

            {/* Weekly Historical Backlog by Status (12 weeks) */}
            {backlogHistoryData.weekly && backlogHistoryData.weekly.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 p-6 border border-gray-100 dark:border-gray-700">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-purple-500 rounded-xl flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">Weekly historical backlog by status (12 weeks)</h3>
                </div>
                <div className="flex items-center gap-4 mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: BACKLOG_COLORS.new }}></div>
                    <span className="text-sm text-gray-600 dark:text-gray-400">New</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: BACKLOG_COLORS.open }}></div>
                    <span className="text-sm text-gray-600 dark:text-gray-400">Open</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: BACKLOG_COLORS.pending }}></div>
                    <span className="text-sm text-gray-600 dark:text-gray-400">Pending</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: BACKLOG_COLORS.hold }}></div>
                    <span className="text-sm text-gray-600 dark:text-gray-400">Hold</span>
                  </div>
                </div>
                <div className="h-[280px] sm:h-[350px]"><ResponsiveContainer width="100%" height="100%">
                  <BarChart data={backlogHistoryData.weekly}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
                    <XAxis
                      dataKey="weekStart"
                      className="text-xs"
                      tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}
                    />
                    <YAxis className="text-xs" />
                    <Tooltip
                      content={<CustomTooltip />}
                      labelFormatter={(value) => `Week of ${new Date(value).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`}
                    />
                    <Bar dataKey="new" stackId="backlog" fill={BACKLOG_COLORS.new} name="New" />
                    <Bar dataKey="open" stackId="backlog" fill={BACKLOG_COLORS.open} name="Open" />
                    <Bar dataKey="pending" stackId="backlog" fill={BACKLOG_COLORS.pending} name="Pending" />
                    <Bar dataKey="hold" stackId="backlog" fill={BACKLOG_COLORS.hold} name="Hold" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer></div>
              </div>
            )}
          </div>
        )}

        {/* Agent Performance Table */}
        {agentPerformanceData && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 p-6 border border-gray-100 dark:border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-teal-500 to-green-500 rounded-xl flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">Agent Performance</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Metrics based on ticket replies</p>
                </div>
              </div>
              {/* Year Selector */}
              <CustomSelect
                value={String(agentPerfYear)}
                onChange={(v) => setAgentPerfYear(Number(v))}
                options={(agentPerformanceData?.availableYears || [new Date().getFullYear()]).map((year: number) => ({ value: String(year), label: String(year) }))}
                size="sm"
              />
            </div>
            {/* Calculation Explanation */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-3 mb-4">
              <p className="text-xs text-blue-700 dark:text-blue-400">
                <span className="font-semibold">Contribution:</span> Average of (agent's replies ÷ total replies) per ticket the agent worked on.
              </p>
            </div>
            {agentPerformanceData.agents && agentPerformanceData.agents.filter((p: any) => p.totalReplies > 0).length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Agent</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Tickets</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Replies</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Avg/Ticket</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Contribution</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {agentPerformanceData.agents.filter((p: any) => p.totalReplies > 0).map((perf: any, index: number) => (
                      <tr key={perf.agent.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-gradient-to-br from-teal-500 to-green-500 rounded-full flex items-center justify-center text-white text-sm font-bold">
                              {index + 1}
                            </div>
                            <div>
                              <span className="text-sm font-medium text-gray-900 dark:text-white block">
                                {perf.agent.firstName && perf.agent.lastName
                                  ? `${perf.agent.firstName} ${perf.agent.lastName}`
                                  : perf.agent.email}
                              </span>
                              <span className="text-xs text-gray-500 dark:text-gray-400">{perf.agent.email}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200">
                            {perf.totalTickets.toLocaleString()}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200">
                            {perf.totalReplies.toLocaleString()}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200">
                            {perf.avgRepliesPerTicket}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <div className="flex-1 min-w-[100px] bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden">
                              <div
                                className="bg-gradient-to-r from-green-500 to-emerald-500 h-2.5 rounded-full transition-all duration-500"
                                style={{ width: `${perf.contribution}%` }}
                              ></div>
                            </div>
                            <span className="text-sm font-semibold text-gray-900 dark:text-white min-w-[3rem]">{perf.contribution}%</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                No agent performance data available for {agentPerfYear}
              </div>
            )}
          </div>
        )}

        {/* AI Analytics */}
        {aiSummaryData && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 p-6 border border-gray-100 dark:border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-xl flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">AI Analytics</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">AI Summary, Suggestions, and Chat Widget usage</p>
                </div>
              </div>
              {/* Year Selector */}
              <CustomSelect
                value={String(aiSummaryYear)}
                onChange={(v) => setAiSummaryYear(Number(v))}
                options={(aiSummaryData?.availableYears || [new Date().getFullYear()]).map((year: number) => ({ value: String(year), label: String(year) }))}
                size="sm"
              />
            </div>

            {/* AI Summary Stats (Ticket Detail Page) */}
            <div className="mb-6">
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">AI Summary (Ticket Detail)</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <svg className="w-5 h-5 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    <span className="text-xs font-medium text-indigo-600 dark:text-indigo-400">Summary Generated</span>
                  </div>
                  <p className="text-2xl font-bold text-indigo-700 dark:text-indigo-300">{aiSummaryData.counts?.summaryGenerated || 0}</p>
                </div>
                <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <svg className="w-5 h-5 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    <span className="text-xs font-medium text-purple-600 dark:text-purple-400">Summary Regenerated</span>
                  </div>
                  <p className="text-2xl font-bold text-purple-700 dark:text-purple-300">{aiSummaryData.counts?.summaryRegenerated || 0}</p>
                </div>
              </div>
            </div>

            {/* AI Suggestions Stats (Create Ticket Page) */}
            <div className="mb-6">
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">AI Suggestions (Create Ticket)</h4>
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    <span className="text-xs font-medium text-blue-600 dark:text-blue-400">Suggestions Shown</span>
                  </div>
                  <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">{aiSummaryData.counts?.suggestionShown || 0}</p>
                </div>
                <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
                    </svg>
                    <span className="text-xs font-medium text-green-600 dark:text-green-400">Solved Issue</span>
                  </div>
                  <p className="text-2xl font-bold text-green-700 dark:text-green-300">{aiSummaryData.counts?.suggestionHelpful || 0}</p>
                </div>
                <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <svg className="w-5 h-5 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.736 3h4.018a2 2 0 01.485.06l3.76.94m-7 10v5a2 2 0 002 2h.096c.5 0 .905-.405.905-.905 0-.714.211-1.412.608-2.006L17 13V4m-7 10h2m5-10h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.5" />
                    </svg>
                    <span className="text-xs font-medium text-red-600 dark:text-red-400">Did Not Solve</span>
                  </div>
                  <p className="text-2xl font-bold text-red-700 dark:text-red-300">{aiSummaryData.counts?.suggestionNotHelpful || 0}</p>
                </div>
              </div>
            </div>

            {/* Chat Widget Stats */}
            <div className="mb-6">
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Chat Widget</h4>
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-cyan-50 dark:bg-cyan-900/20 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <svg className="w-5 h-5 text-cyan-600 dark:text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    <span className="text-xs font-medium text-cyan-600 dark:text-cyan-400">Responses Generated</span>
                  </div>
                  <p className="text-2xl font-bold text-cyan-700 dark:text-cyan-300">{aiSummaryData.counts?.chatResponseGenerated || 0}</p>
                </div>
                <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <svg className="w-5 h-5 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
                    </svg>
                    <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Helpful</span>
                  </div>
                  <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{aiSummaryData.counts?.chatFeedbackHelpful || 0}</p>
                </div>
                <div className="bg-orange-50 dark:bg-orange-900/20 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <svg className="w-5 h-5 text-orange-600 dark:text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.736 3h4.018a2 2 0 01.485.06l3.76.94m-7 10v5a2 2 0 002 2h.096c.5 0 .905-.405.905-.905 0-.714.211-1.412.608-2.006L17 13V4m-7 10h2m5-10h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.5" />
                    </svg>
                    <span className="text-xs font-medium text-orange-600 dark:text-orange-400">Not Helpful</span>
                  </div>
                  <p className="text-2xl font-bold text-orange-700 dark:text-orange-300">{aiSummaryData.counts?.chatFeedbackNotHelpful || 0}</p>
                </div>
              </div>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Summary Generations</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">{aiSummaryData.totalSummaryGenerations || 0}</p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Suggestion Helpful Rate</p>
                <div className="flex items-center gap-2">
                  <p className="text-xl font-bold text-gray-900 dark:text-white">{aiSummaryData.suggestionHelpfulRate || 0}%</p>
                  {aiSummaryData.totalSuggestionFeedback > 0 && (
                    <div className="flex-1 bg-gray-200 dark:bg-gray-600 rounded-full h-2.5 overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-green-500 to-emerald-500 h-2.5 rounded-full transition-all duration-500"
                        style={{ width: `${aiSummaryData.suggestionHelpfulRate || 0}%` }}
                      ></div>
                    </div>
                  )}
                </div>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Chat Responses</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">{aiSummaryData.counts?.chatResponseGenerated || 0}</p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Chat Helpful Rate</p>
                <div className="flex items-center gap-2">
                  <p className="text-xl font-bold text-gray-900 dark:text-white">{aiSummaryData.chatHelpfulRate || 0}%</p>
                  {aiSummaryData.totalChatFeedback > 0 && (
                    <div className="flex-1 bg-gray-200 dark:bg-gray-600 rounded-full h-2.5 overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-cyan-500 to-teal-500 h-2.5 rounded-full transition-all duration-500"
                        style={{ width: `${aiSummaryData.chatHelpfulRate || 0}%` }}
                      ></div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Monthly Chart */}
            {aiSummaryData.monthlyChart && aiSummaryData.monthlyChart.some((m: any) => m.summaryGenerated > 0 || m.suggestionHelpful > 0 || m.suggestionNotHelpful > 0 || m.chatResponseGenerated > 0) && (
              <div>
                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Monthly Breakdown</h4>
                <div className="h-[200px] sm:h-[250px]"><ResponsiveContainer width="100%" height="100%">
                  <BarChart data={aiSummaryData.monthlyChart} margin={{ left: 0, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
                    <XAxis dataKey="name" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Bar dataKey="summaryGenerated" name="Summary Generated" fill="#6366F1" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="summaryRegenerated" name="Summary Regenerated" fill="#A855F7" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="suggestionHelpful" name="Solved Issue" fill="#10B981" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="suggestionNotHelpful" name="Did Not Solve" fill="#EF4444" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="chatResponseGenerated" name="Chat Responses" fill="#06B6D4" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer></div>
              </div>
            )}

            {aiSummaryData.totalSummaryGenerations === 0 && aiSummaryData.totalSuggestionFeedback === 0 && (aiSummaryData.counts?.chatResponseGenerated || 0) === 0 && (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                No AI analytics data available for {aiSummaryYear}
              </div>
            )}
          </div>
        )}

        {/* Most Used Forms */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 p-6 border border-gray-100 dark:border-gray-700">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-rose-500 to-pink-500 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">Most Used Forms</h3>
            </div>
            {/* Year Selector */}
            <CustomSelect
              value={String(formYear)}
              onChange={(v) => setFormYear(Number(v))}
              options={(formsByYearData?.availableYears || [new Date().getFullYear()]).map((year: number) => ({ value: String(year), label: String(year) }))}
              size="sm"
            />
          </div>
          {formsByYearData?.data && formsByYearData.data.length > 0 ? (
            <div className="space-y-4">
              {formsByYearData.data.map((form: any, index: number) => {
                const maxValue = Math.max(...formsByYearData.data.map((f: any) => f.count));
                const percentage = (form.count / maxValue) * 100;

                return (
                  <div key={index} className="group">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-semibold text-gray-900 dark:text-white group-hover:text-primary transition-colors">{form.name}</span>
                      <span className="text-sm font-bold text-gray-900 dark:text-white">{form.count}</span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-primary to-purple-500 h-3 rounded-full transition-all duration-700 ease-out"
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              No form data available for {formYear}
            </div>
          )}
        </div>

        {/* Most Used Form Fields */}
        {charts.fieldUsage && charts.fieldUsage.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 p-6 border border-gray-100 dark:border-gray-700">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                </svg>
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">Most Used Form Fields</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">Top 15 fields by usage in ticket forms</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Field Name</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Type</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Responses</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Usage</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {charts.fieldUsage.map((field: any, index: number) => {
                    const maxResponses = Math.max(...charts.fieldUsage.map((f: any) => f.responseCount));
                    const percentage = (field.responseCount / maxResponses) * 100;

                    return (
                      <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                              {index + 1}
                            </div>
                            <span className="text-sm font-medium text-gray-900 dark:text-white">{field.name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 capitalize">
                            {field.fieldType}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-200">
                            {field.responseCount}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex-1 min-w-[120px] bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden">
                              <div
                                className="bg-gradient-to-r from-emerald-500 to-teal-500 h-2.5 rounded-full transition-all duration-500"
                                style={{ width: `${percentage}%` }}
                              ></div>
                            </div>
                            <span className="text-sm font-semibold text-gray-900 dark:text-white min-w-[3rem]">
                              {percentage.toFixed(0)}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Customer Feedback Analytics */}
        {feedbackData?.analytics && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 p-6 border border-gray-100 dark:border-gray-700">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-xl flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">Customer Satisfaction</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Feedback from resolved tickets</p>
                </div>
              </div>
              {/* Year Selector */}
              <CustomSelect
                value={String(feedbackYear)}
                onChange={(v) => setFeedbackYear(Number(v))}
                options={Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map((year) => ({ value: String(year), label: String(year) }))}
                size="sm"
              />
            </div>

            {feedbackData.analytics.totalFeedback > 0 ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Satisfaction Score */}
                <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl p-6 border border-green-200 dark:border-green-800">
                  <div className="text-center">
                    <div className="text-6xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent mb-2">
                      {feedbackData.analytics.satisfactionPercentage}%
                    </div>
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Satisfaction Rate</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {feedbackData.analytics.satisfiedCount} satisfied out of {feedbackData.analytics.totalFeedback} responses
                    </p>
                  </div>
                </div>

                {/* Rating Distribution */}
                <div className="space-y-3">
                  {[
                    { key: 'VERY_SATISFIED', emoji: '🤩', label: 'Very Satisfied', color: 'emerald' },
                    { key: 'SATISFIED', emoji: '😊', label: 'Satisfied', color: 'green' },
                    { key: 'NEUTRAL', emoji: '😐', label: 'Neutral', color: 'gray' },
                    { key: 'DISSATISFIED', emoji: '😕', label: 'Dissatisfied', color: 'orange' },
                    { key: 'VERY_DISSATISFIED', emoji: '😞', label: 'Very Dissatisfied', color: 'red' }
                  ].map((rating) => {
                    const count = feedbackData.analytics.ratingCounts[rating.key] || 0;
                    const percentage = feedbackData.analytics.totalFeedback > 0
                      ? Math.round((count / feedbackData.analytics.totalFeedback) * 100)
                      : 0;

                    if (count === 0) return null;

                    return (
                      <div key={rating.key} className="flex items-center gap-3">
                        <span className="text-2xl">{rating.emoji}</span>
                        <div className="flex-1">
                          <div className="flex justify-between text-sm mb-1">
                            <span className="font-medium text-gray-700 dark:text-gray-300">{rating.label}</span>
                            <span className="text-gray-500 dark:text-gray-400">{count} ({percentage}%)</span>
                          </div>
                          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                            <div
                              className={`bg-gradient-to-r from-${rating.color}-500 to-${rating.color}-600 h-2 rounded-full transition-all duration-300`}
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                No feedback collected for {feedbackYear}
              </div>
            )}
          </div>
        )}
      </div>

      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-fadeIn {
          animation: fadeIn 0.6s ease-out;
        }
      `}</style>
    </Layout>
  );
};

export default AnalyticsDashboard;
