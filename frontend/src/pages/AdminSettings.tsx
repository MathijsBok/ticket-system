import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { settingsApi, zendeskApi } from '../lib/api';
import Layout from '../components/Layout';

const AdminSettings: React.FC = () => {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);

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

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.json')) {
      toast.error('Please select a JSON file');
      return;
    }

    setIsImporting(true);
    setImportResult(null);

    try {
      const response = await zendeskApi.import(file);
      const result = response.data;

      setImportResult(result);

      if (result.success) {
        toast.success(`Successfully imported ${result.imported} tickets`);
        if (result.skipped > 0) {
          toast.error(`${result.skipped} tickets were skipped due to errors`);
        }
        queryClient.invalidateQueries({ queryKey: ['tickets'] });
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to import tickets');
      setImportResult({
        success: false,
        error: error.response?.data?.details || error.message
      });
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

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
            Configure system behavior and import data
          </p>
        </div>

        {/* Email Settings */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Email Notifications
          </h2>

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

        {/* Automatic Ticket Settings */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Automatic Ticket Settings
          </h2>

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
                  Enable Auto-close
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

        {/* Zendesk Import */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Import from Zendesk
          </h2>

          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Import tickets and comments from a Zendesk JSON export file. The file should contain tickets, users, and comments data.
              </p>

              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleFileSelect}
                disabled={isImporting}
                className="hidden"
              />

              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isImporting}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-primary-foreground bg-primary hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isImporting ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Importing...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    Select Zendesk JSON File
                  </>
                )}
              </button>
            </div>

            {importResult && (
              <div className={`mt-4 p-4 rounded-md ${
                importResult.success
                  ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                  : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
              }`}>
                <h3 className={`text-sm font-medium ${
                  importResult.success
                    ? 'text-green-800 dark:text-green-300'
                    : 'text-red-800 dark:text-red-300'
                }`}>
                  {importResult.success ? 'Import Successful' : 'Import Failed'}
                </h3>
                {importResult.success && (
                  <div className="mt-2 text-sm text-green-700 dark:text-green-400">
                    <p>Imported: {importResult.imported} tickets</p>
                    {importResult.skipped > 0 && (
                      <p>Skipped: {importResult.skipped} tickets</p>
                    )}
                    {importResult.errors && importResult.errors.length > 0 && (
                      <details className="mt-2">
                        <summary className="cursor-pointer">View errors</summary>
                        <ul className="list-disc list-inside mt-1 space-y-1">
                          {importResult.errors.map((error: string, index: number) => (
                            <li key={index} className="text-xs">{error}</li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </div>
                )}
                {!importResult.success && (
                  <p className="mt-2 text-sm text-red-700 dark:text-red-400">
                    {importResult.error}
                  </p>
                )}
              </div>
            )}

            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-4">
              <div className="flex">
                <svg className="h-5 w-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-blue-800 dark:text-blue-300">
                    Expected JSON Format
                  </h3>
                  <div className="mt-2 text-sm text-blue-700 dark:text-blue-400">
                    <p>The JSON file should contain:</p>
                    <ul className="list-disc list-inside mt-1 space-y-1">
                      <li>tickets: Array of ticket objects</li>
                      <li>users: Array of user objects (optional)</li>
                      <li>comments: Array of comment objects (optional)</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default AdminSettings;
