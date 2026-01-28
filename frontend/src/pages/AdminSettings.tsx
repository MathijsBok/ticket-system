import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { settingsApi, zendeskApi, exportApi } from '../lib/api';
import Layout from '../components/Layout';

type TabType = 'notifications' | 'automation' | 'import' | 'export';

const AdminSettings: React.FC = () => {
  const queryClient = useQueryClient();
  const ticketFileInputRef = useRef<HTMLInputElement>(null);
  const userFileInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<TabType>('notifications');
  const [isImportingTickets, setIsImportingTickets] = useState(false);
  const [isImportingUsers, setIsImportingUsers] = useState(false);
  const [isResettingSequence, setIsResettingSequence] = useState(false);
  const [ticketImportResult, setTicketImportResult] = useState<any>(null);
  const [userImportResult, setUserImportResult] = useState<any>(null);
  const [sequenceResetResult, setSequenceResetResult] = useState<any>(null);
  const [isExportingAnalytics, setIsExportingAnalytics] = useState(false);
  const [isExportingTickets, setIsExportingTickets] = useState(false);
  const [isExportingUsers, setIsExportingUsers] = useState(false);
  const [ticketExportStartDate, setTicketExportStartDate] = useState('');
  const [ticketExportEndDate, setTicketExportEndDate] = useState('');
  const [userExportStartDate, setUserExportStartDate] = useState('');
  const [userExportEndDate, setUserExportEndDate] = useState('');

  const { data: settings, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const response = await settingsApi.get();
      return response.data;
    }
  });

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      if (!settings?.id) throw new Error('Settings not loaded');
      return await settingsApi.update(settings.id, data);
    },
    onSuccess: () => {
      toast.success('Settings updated successfully');
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to update settings');
    }
  });

  const handleToggle = (field: string, value: boolean) => {
    updateMutation.mutate({ [field]: value });
  };

  const handleNumberChange = (field: string, value: number) => {
    if (value < 1) {
      toast.error('Value must be at least 1');
      return;
    }
    updateMutation.mutate({ [field]: value });
  };

  const handleTicketFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.json')) {
      toast.error('Please select a JSON file');
      return;
    }

    setIsImportingTickets(true);
    setTicketImportResult(null);

    try {
      const response = await zendeskApi.import(file);
      const result = response.data;

      setTicketImportResult(result);

      if (result.success) {
        toast.success(`Successfully imported ${result.imported} tickets`);
        if (result.skipped > 0) {
          toast.error(`${result.skipped} tickets were skipped due to errors`);
        }
        queryClient.invalidateQueries({ queryKey: ['tickets'] });
      }
    } catch (error: any) {
      const errorMessage = typeof error.response?.data?.error === 'string'
        ? error.response.data.error
        : error.response?.data?.message || error.message || 'Failed to import tickets';
      const errorDetails = error.response?.data?.details;
      toast.error(errorDetails ? `${errorMessage}: ${errorDetails}` : errorMessage);
      setTicketImportResult({
        success: false,
        error: errorDetails || errorMessage
      });
    } finally {
      setIsImportingTickets(false);
      if (ticketFileInputRef.current) {
        ticketFileInputRef.current.value = '';
      }
    }
  };

  const handleUserFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.json')) {
      toast.error('Please select a JSON file');
      return;
    }

    setIsImportingUsers(true);
    setUserImportResult(null);

    try {
      const response = await zendeskApi.importUsers(file);
      const result = response.data;

      setUserImportResult(result);

      if (result.success) {
        toast.success(`Successfully imported ${result.imported} users`);
        if (result.updated > 0) {
          toast.success(`Updated ${result.updated} existing users`);
        }
        queryClient.invalidateQueries({ queryKey: ['users'] });
      }
    } catch (error: any) {
      const errorMessage = typeof error.response?.data?.error === 'string'
        ? error.response.data.error
        : error.response?.data?.message || error.message || 'Failed to import users';
      toast.error(errorMessage);
      setUserImportResult({
        success: false,
        error: error.response?.data?.details || errorMessage
      });
    } finally {
      setIsImportingUsers(false);
      if (userFileInputRef.current) {
        userFileInputRef.current.value = '';
      }
    }
  };

  const handleResetTicketSequence = async () => {
    setIsResettingSequence(true);
    setSequenceResetResult(null);

    try {
      const response = await zendeskApi.resetTicketSequence();
      const result = response.data;

      setSequenceResetResult(result);

      if (result.success) {
        toast.success(`Ticket sequence reset. Next ticket will be #${result.nextTicketNumber}`);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to reset ticket sequence');
      setSequenceResetResult({
        success: false,
        error: error.response?.data?.details || error.message
      });
    } finally {
      setIsResettingSequence(false);
    }
  };

  const handleExportAnalytics = async () => {
    setIsExportingAnalytics(true);
    try {
      const response = await exportApi.analyticsPdf();
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `analytics-report-${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success('Analytics report downloaded successfully');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to export analytics');
    } finally {
      setIsExportingAnalytics(false);
    }
  };

  const handleExportTickets = async () => {
    setIsExportingTickets(true);
    try {
      const response = await exportApi.ticketsJson(
        ticketExportStartDate || undefined,
        ticketExportEndDate || undefined
      );
      const blob = new Blob([response.data], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `tickets-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success('Tickets exported successfully');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to export tickets');
    } finally {
      setIsExportingTickets(false);
    }
  };

  const handleExportUsers = async () => {
    setIsExportingUsers(true);
    try {
      const response = await exportApi.usersJson(
        userExportStartDate || undefined,
        userExportEndDate || undefined
      );
      const blob = new Blob([response.data], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `users-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success('Users exported successfully');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to export users');
    } finally {
      setIsExportingUsers(false);
    }
  };

  const tabs = [
    { id: 'notifications' as TabType, label: 'Notifications', icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
      </svg>
    )},
    { id: 'automation' as TabType, label: 'Automation', icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    )},
    { id: 'import' as TabType, label: 'Import', icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
      </svg>
    )},
    { id: 'export' as TabType, label: 'Export', icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
      </svg>
    )}
  ];

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Settings</h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Configure system behavior, notifications, and data management
          </p>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="-mb-px flex space-x-8">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'border-primary text-primary'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          {/* Notifications Tab */}
          {activeTab === 'notifications' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                  Email Notifications
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                  Configure when email notifications are sent to users and agents
                </p>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium text-gray-900 dark:text-white">
                      Ticket Created Notifications
                    </label>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Send email when a new ticket is created
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings?.sendTicketCreatedEmail || false}
                      onChange={(e) => handleToggle('sendTicketCreatedEmail', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 dark:peer-focus:ring-primary/40 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium text-gray-900 dark:text-white">
                      Ticket Assigned Notifications
                    </label>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Notify agents when a ticket is assigned to them
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings?.sendTicketAssignedEmail || false}
                      onChange={(e) => handleToggle('sendTicketAssignedEmail', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 dark:peer-focus:ring-primary/40 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium text-gray-900 dark:text-white">
                      Ticket Resolved Notifications
                    </label>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Notify users when their ticket is marked as solved
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings?.sendTicketResolvedEmail || false}
                      onChange={(e) => handleToggle('sendTicketResolvedEmail', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 dark:peer-focus:ring-primary/40 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary"></div>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Automation Tab */}
          {activeTab === 'automation' && (
            <div className="space-y-8">
              {/* Ticket Automation */}
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                  Ticket Automation
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                  Automatically manage ticket lifecycle based on activity
                </p>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <label className="text-sm font-medium text-gray-900 dark:text-white">
                        Pending Ticket Reminders
                      </label>
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          Remind users about pending tickets after
                        </p>
                        <input
                          type="number"
                          min="1"
                          value={settings?.pendingTicketReminderHours || 24}
                          onChange={(e) => handleNumberChange('pendingTicketReminderHours', parseInt(e.target.value))}
                          onBlur={(e) => handleNumberChange('pendingTicketReminderHours', parseInt(e.target.value))}
                          disabled={!settings?.sendPendingTicketReminder}
                          className="w-16 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                        />
                        <p className="text-sm text-gray-500 dark:text-gray-400">hours of our last reply</p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer ml-4">
                      <input
                        type="checkbox"
                        checked={settings?.sendPendingTicketReminder || false}
                        onChange={(e) => handleToggle('sendPendingTicketReminder', e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 dark:peer-focus:ring-primary/40 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <label className="text-sm font-medium text-gray-900 dark:text-white">
                        Auto-solve Pending Tickets
                      </label>
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          Mark pending tickets as solved after
                        </p>
                        <input
                          type="number"
                          min="1"
                          value={settings?.autoSolveHours || 48}
                          onChange={(e) => handleNumberChange('autoSolveHours', parseInt(e.target.value))}
                          onBlur={(e) => handleNumberChange('autoSolveHours', parseInt(e.target.value))}
                          disabled={!settings?.autoSolveEnabled}
                          className="w-16 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                        />
                        <p className="text-sm text-gray-500 dark:text-gray-400">hours with no user reply</p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer ml-4">
                      <input
                        type="checkbox"
                        checked={settings?.autoSolveEnabled || false}
                        onChange={(e) => handleToggle('autoSolveEnabled', e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 dark:peer-focus:ring-primary/40 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <label className="text-sm font-medium text-gray-900 dark:text-white">
                        Auto-close Solved Tickets
                      </label>
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          Automatically close solved tickets after
                        </p>
                        <input
                          type="number"
                          min="1"
                          value={settings?.autoCloseHours || 48}
                          onChange={(e) => handleNumberChange('autoCloseHours', parseInt(e.target.value))}
                          onBlur={(e) => handleNumberChange('autoCloseHours', parseInt(e.target.value))}
                          disabled={!settings?.autoCloseEnabled}
                          className="w-16 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                        />
                        <p className="text-sm text-gray-500 dark:text-gray-400">hours</p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer ml-4">
                      <input
                        type="checkbox"
                        checked={settings?.autoCloseEnabled || false}
                        onChange={(e) => handleToggle('autoCloseEnabled', e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 dark:peer-focus:ring-primary/40 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary"></div>
                    </label>
                  </div>
                </div>
              </div>

              {/* Storage Automation */}
              <div className="border-t border-gray-200 dark:border-gray-700 pt-8">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                  Storage Management
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                  Automatically manage disk space by cleaning up old files
                </p>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <label className="text-sm font-medium text-gray-900 dark:text-white">
                        Auto-delete Attachments
                      </label>
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          Automatically delete attachments after
                        </p>
                        <input
                          type="number"
                          min="1"
                          value={settings?.autoDeleteAttachmentsDays || 90}
                          onChange={(e) => handleNumberChange('autoDeleteAttachmentsDays', parseInt(e.target.value))}
                          onBlur={(e) => handleNumberChange('autoDeleteAttachmentsDays', parseInt(e.target.value))}
                          disabled={!settings?.autoDeleteAttachmentsEnabled}
                          className="w-16 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                        />
                        <p className="text-sm text-gray-500 dark:text-gray-400">days to save disk space</p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer ml-4">
                      <input
                        type="checkbox"
                        checked={settings?.autoDeleteAttachmentsEnabled || false}
                        onChange={(e) => handleToggle('autoDeleteAttachmentsEnabled', e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 dark:peer-focus:ring-primary/40 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary"></div>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Import Tab */}
          {activeTab === 'import' && (
            <div className="space-y-8">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                  Import Data
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                  Import users and tickets from Zendesk or other platforms
                </p>
              </div>

              {/* User Import Section */}
              <div className="border-b border-gray-200 dark:border-gray-700 pb-8">
                <h3 className="text-md font-medium text-gray-900 dark:text-white mb-2">
                  Import Users
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Import users from a Zendesk user export JSON file. Imports email, name, role, timezone, and last login.
                </p>

                <input
                  ref={userFileInputRef}
                  type="file"
                  accept=".json"
                  onChange={handleUserFileSelect}
                  disabled={isImportingUsers}
                  className="hidden"
                />

                <button
                  onClick={() => userFileInputRef.current?.click()}
                  disabled={isImportingUsers}
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-primary-foreground bg-primary hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isImportingUsers ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Importing Users...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                      </svg>
                      Import Users JSON
                    </>
                  )}
                </button>

                {userImportResult && (
                  <div className={`mt-4 p-4 rounded-md ${
                    userImportResult.success
                      ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                      : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
                  }`}>
                    <h3 className={`text-sm font-medium ${
                      userImportResult.success
                        ? 'text-green-800 dark:text-green-300'
                        : 'text-red-800 dark:text-red-300'
                    }`}>
                      {userImportResult.success ? 'User Import Successful' : 'User Import Failed'}
                    </h3>
                    {userImportResult.success && (
                      <div className="mt-2 text-sm text-green-700 dark:text-green-400">
                        <p>Imported: {userImportResult.imported} users</p>
                        {userImportResult.updated > 0 && (
                          <p>Updated: {userImportResult.updated} users</p>
                        )}
                        {userImportResult.skipped > 0 && (
                          <p>Skipped: {userImportResult.skipped} users</p>
                        )}
                      </div>
                    )}
                    {!userImportResult.success && (
                      <p className="mt-2 text-sm text-red-700 dark:text-red-400">
                        {userImportResult.error}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Ticket Import Section */}
              <div className="border-b border-gray-200 dark:border-gray-700 pb-8">
                <h3 className="text-md font-medium text-gray-900 dark:text-white mb-2">
                  Import Tickets
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Import tickets from a Zendesk ticket export JSON file. Users will be matched by email or created if they don't exist.
                </p>

                <input
                  ref={ticketFileInputRef}
                  type="file"
                  accept=".json"
                  onChange={handleTicketFileSelect}
                  disabled={isImportingTickets}
                  className="hidden"
                />

                <button
                  onClick={() => ticketFileInputRef.current?.click()}
                  disabled={isImportingTickets}
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-primary-foreground bg-primary hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isImportingTickets ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Importing Tickets...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Import Tickets JSON
                    </>
                  )}
                </button>

                {ticketImportResult && (
                  <div className={`mt-4 p-4 rounded-md ${
                    ticketImportResult.success
                      ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                      : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
                  }`}>
                    <h3 className={`text-sm font-medium ${
                      ticketImportResult.success
                        ? 'text-green-800 dark:text-green-300'
                        : 'text-red-800 dark:text-red-300'
                    }`}>
                      {ticketImportResult.success ? 'Ticket Import Successful' : 'Ticket Import Failed'}
                    </h3>
                    {ticketImportResult.success && (
                      <div className="mt-2 text-sm text-green-700 dark:text-green-400">
                        <p>Imported: {ticketImportResult.imported} tickets</p>
                        {ticketImportResult.usersCreated > 0 && (
                          <p>Users created: {ticketImportResult.usersCreated}</p>
                        )}
                        {ticketImportResult.duplicates > 0 && (
                          <p>Duplicates skipped: {ticketImportResult.duplicates}</p>
                        )}
                        {ticketImportResult.skipped > 0 && (
                          <p>Errors: {ticketImportResult.skipped} tickets</p>
                        )}
                        {ticketImportResult.errors && ticketImportResult.errors.length > 0 && (
                          <details className="mt-2">
                            <summary className="cursor-pointer">View errors</summary>
                            <ul className="list-disc list-inside mt-1 space-y-1">
                              {ticketImportResult.errors.map((error: string, index: number) => (
                                <li key={index} className="text-xs">{error}</li>
                              ))}
                            </ul>
                          </details>
                        )}
                      </div>
                    )}
                    {!ticketImportResult.success && (
                      <p className="mt-2 text-sm text-red-700 dark:text-red-400">
                        {ticketImportResult.error}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Ticket Sequence Reset */}
              <div>
                <h3 className="text-md font-medium text-gray-900 dark:text-white mb-2">
                  Fix Ticket Numbers
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  If new tickets are getting incorrect numbers after importing, use this to reset the ticket sequence to the highest existing ticket number.
                </p>

                <button
                  onClick={handleResetTicketSequence}
                  disabled={isResettingSequence}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isResettingSequence ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Resetting...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Reset Ticket Sequence
                    </>
                  )}
                </button>

                {sequenceResetResult && (
                  <div className={`mt-4 p-4 rounded-md ${
                    sequenceResetResult.success
                      ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                      : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
                  }`}>
                    <p className={`text-sm ${
                      sequenceResetResult.success
                        ? 'text-green-700 dark:text-green-400'
                        : 'text-red-700 dark:text-red-400'
                    }`}>
                      {sequenceResetResult.success
                        ? `${sequenceResetResult.message}. New tickets will start from #${sequenceResetResult.nextTicketNumber}.`
                        : sequenceResetResult.error
                      }
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Export Tab */}
          {activeTab === 'export' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                  Export Data
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                  Export your data for backup or migration purposes
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Export Tickets */}
                <div className="p-6 border border-gray-200 dark:border-gray-700 rounded-lg">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                      <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-md font-medium text-gray-900 dark:text-white">Export Tickets</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Download tickets as JSON with date filtering</p>
                    </div>
                  </div>
                  <div className="space-y-3 mb-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">From Date</label>
                        <input
                          type="date"
                          value={ticketExportStartDate}
                          onChange={(e) => setTicketExportStartDate(e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">To Date</label>
                        <input
                          type="date"
                          value={ticketExportEndDate}
                          onChange={(e) => setTicketExportEndDate(e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                      </div>
                    </div>
                    <p className="text-xs text-gray-400 dark:text-gray-500">Leave empty to export all tickets</p>
                  </div>
                  <button
                    onClick={handleExportTickets}
                    disabled={isExportingTickets}
                    className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-primary-foreground bg-primary hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isExportingTickets ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Exporting...
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        Download Tickets JSON
                      </>
                    )}
                  </button>
                </div>

                {/* Export Users */}
                <div className="p-6 border border-gray-200 dark:border-gray-700 rounded-lg">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                      <svg className="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-md font-medium text-gray-900 dark:text-white">Export Users</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Download users as JSON with date filtering</p>
                    </div>
                  </div>
                  <div className="space-y-3 mb-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">From Date</label>
                        <input
                          type="date"
                          value={userExportStartDate}
                          onChange={(e) => setUserExportStartDate(e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">To Date</label>
                        <input
                          type="date"
                          value={userExportEndDate}
                          onChange={(e) => setUserExportEndDate(e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                      </div>
                    </div>
                    <p className="text-xs text-gray-400 dark:text-gray-500">Leave empty to export all users</p>
                  </div>
                  <button
                    onClick={handleExportUsers}
                    disabled={isExportingUsers}
                    className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-primary-foreground bg-primary hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isExportingUsers ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Exporting...
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        Download Users JSON
                      </>
                    )}
                  </button>
                </div>

                {/* Export Analytics */}
                <div className="p-6 border border-gray-200 dark:border-gray-700 rounded-lg">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                      <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-md font-medium text-gray-900 dark:text-white">Export Analytics</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Download analytics report as PDF with AI insights</p>
                    </div>
                  </div>
                  <button
                    onClick={handleExportAnalytics}
                    disabled={isExportingAnalytics}
                    className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-primary-foreground bg-primary hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isExportingAnalytics ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Generating PDF...
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        Download PDF Report
                      </>
                    )}
                  </button>
                </div>

                {/* Full Backup */}
                <div className="p-6 border border-gray-200 dark:border-gray-700 rounded-lg">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                      <svg className="w-6 h-6 text-orange-600 dark:text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-md font-medium text-gray-900 dark:text-white">Full Backup</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Download complete system backup</p>
                    </div>
                  </div>
                  <button
                    disabled
                    className="w-full inline-flex justify-center items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Coming Soon
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default AdminSettings;
