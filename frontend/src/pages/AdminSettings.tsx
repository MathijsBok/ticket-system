import React, { useState, useRef, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { settingsApi, zendeskApi, exportApi, apiKeyApi, analyticsApi, adminAnalyticsApi, aiAnalyticsApi, macroApi, databaseApi } from '../lib/api';
import Layout from '../components/Layout';
import CustomSelect from '../components/CustomSelect';

type TabType = 'notifications' | 'automation' | 'sendgrid' | 'import' | 'export' | 'api' | 'maintenance' | 'widget' | 'permissions' | 'security';
const validTabs: TabType[] = ['notifications', 'automation', 'sendgrid', 'import', 'export', 'api', 'maintenance', 'widget', 'permissions', 'security'];

interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  keyDisplay: string;
  description: string | null;
  formId: string | null;
  isActive: boolean;
  lastUsedAt: string | null;
  usageCount: number;
  createdAt: string;
  revokedAt: string | null;
  fullKey?: string;
  form?: { id: string; name: string } | null;
  createdBy?: { id: string; email: string; firstName: string | null; lastName: string | null };
}

interface FormOption {
  id: string;
  name: string;
  description: string | null;
}

const AdminSettings: React.FC = () => {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const ticketFileInputRef = useRef<HTMLInputElement>(null);
  const userFileInputRef = useRef<HTMLInputElement>(null);
  const backlogFileInputRef = useRef<HTMLInputElement>(null);
  const macroFileInputRef = useRef<HTMLInputElement>(null);
  const databaseFileInputRef = useRef<HTMLInputElement>(null);

  // Get active tab from URL, default to 'notifications'
  const tabParam = searchParams.get('tab') as TabType | null;
  const activeTab: TabType = tabParam && validTabs.includes(tabParam) ? tabParam : 'notifications';

  const setActiveTab = (tab: TabType) => {
    setSearchParams({ tab });
  };
  const [isImportingTickets, setIsImportingTickets] = useState(false);
  const [isImportingUsers, setIsImportingUsers] = useState(false);
  const [isImportingMacros, setIsImportingMacros] = useState(false);
  const [isResettingSequence, setIsResettingSequence] = useState(false);
  const [ticketImportResult, setTicketImportResult] = useState<any>(null);
  const [userImportResult, setUserImportResult] = useState<any>(null);
  const [macroImportResult, setMacroImportResult] = useState<any>(null);
  const [sequenceResetResult, setSequenceResetResult] = useState<any>(null);
  const [isExportingAnalytics, setIsExportingAnalytics] = useState(false);
  const [isExportingTickets, setIsExportingTickets] = useState(false);
  const [isExportingUsers, setIsExportingUsers] = useState(false);
  const [isRefreshingCache, setIsRefreshingCache] = useState(false);
  const [ticketExportStartDate, setTicketExportStartDate] = useState('');
  const [ticketExportEndDate, setTicketExportEndDate] = useState('');
  const [userExportStartDate, setUserExportStartDate] = useState('');
  const [userExportEndDate, setUserExportEndDate] = useState('');
  // API Key state
  const [showCreateKeyModal, setShowCreateKeyModal] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyDescription, setNewKeyDescription] = useState('');
  const [newKeyFormId, setNewKeyFormId] = useState('');
  const [createdKey, setCreatedKey] = useState<ApiKey | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);
  // Maintenance state - Countries
  const [backfillLoading, setBackfillLoading] = useState(false);
  const [backfillResult, setBackfillResult] = useState<{
    message: string;
    updatedCount: number;
    countryBreakdown: Record<string, number>;
  } | null>(null);
  // Maintenance state - Forms
  const [backfillFormsLoading, setBackfillFormsLoading] = useState(false);
  const [backfillFormsResult, setBackfillFormsResult] = useState<{
    message: string;
    updatedCount: number;
    formBreakdown: Record<string, number>;
    skippedNoMatch: number;
    skippedMultipleForms: number;
  } | null>(null);
  // Maintenance state - Backlog
  const [backfillBacklogLoading, setBackfillBacklogLoading] = useState(false);
  const [backfillBacklogResult, setBackfillBacklogResult] = useState<{
    message: string;
    snapshots: Array<{ date: string; new: number; open: number; pending: number; hold: number; total: number }>;
  } | null>(null);
  // Maintenance state - Agent Performance
  const [backfillAgentPerfLoading, setBackfillAgentPerfLoading] = useState(false);
  const [backfillAgentPerfResult, setBackfillAgentPerfResult] = useState<{
    message: string;
    agentsProcessed: number;
    performance: Array<{
      agent: { id: string; email: string; name: string };
      totalReplies: number;
      totalTickets: number;
      avgRepliesPerTicket: string;
      contribution: number;
    }>;
  } | null>(null);
  // Maintenance state - AI Summary Backfill
  const [backfillAiSummaryLoading, setBackfillAiSummaryLoading] = useState(false);
  const [backfillAiSummaryResult, setBackfillAiSummaryResult] = useState<{
    message: string;
    created: number;
    skipped: number;
    totalTicketsWithSummary?: number;
  } | null>(null);
  // Import Backlog state
  const [importBacklogLoading, setImportBacklogLoading] = useState(false);
  const [importBacklogResult, setImportBacklogResult] = useState<{
    message: string;
    results: Array<{ date: string; new: number; open: number; pending: number; hold: number; total: number; status: string }>;
  } | null>(null);
  // Database Import/Export state
  const [dbImportLoading, setDbImportLoading] = useState(false);
  const [dbExportLoading, setDbExportLoading] = useState(false);
  const [dbImportResult, setDbImportResult] = useState<{
    success: boolean;
    message: string;
    filename?: string;
    size?: number;
    warnings?: string;
  } | null>(null);
  const [showDbImportConfirm, setShowDbImportConfirm] = useState(false);
  const [pendingDbFile, setPendingDbFile] = useState<File | null>(null);
  // Widget state
  const [widgetForm, setWidgetForm] = useState({
    chatWidgetEnabled: false,
    chatWidgetWelcomeMessage: '',
    chatWidgetVisibleToUsers: true,
    chatWidgetVisibleToAgents: false,
    chatWidgetEscalationThreshold: 3,
    chatWidgetSystemInstructions: '',
    chatWidgetCompanyName: '',
    chatWidgetTone: 'professional',
    chatWidgetFaqItems: [] as Array<{ question: string; answer: string }>,
  });
  const [widgetSaving, setWidgetSaving] = useState(false);
  const [showTrainingModal, setShowTrainingModal] = useState(false);

  const { data: settings, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const response = await settingsApi.get();
      return response.data;
    }
  });

  // Local state for Automation tab (manual save instead of auto-save)
  const [automationForm, setAutomationForm] = useState({
    // Ticket Automation
    sendPendingTicketReminder: false,
    pendingTicketReminderHours: 24,
    autoSolveEnabled: false,
    autoSolveHours: 48,
    autoCloseEnabled: false,
    autoCloseHours: 48,
    // Storage Management
    autoDeleteAttachmentsEnabled: false,
    autoDeleteAttachmentsDays: 90,
    // AI Features
    aiSummaryEnabled: false,
    anthropicApiKey: '',
    ticketSuggestionsEnabled: false,
    ticketSuggestionsApiKey: '',
    aiKnowledgeUrls: '',
    aiKnowledgeRefreshDays: 7,
  });
  const [automationSaving, setAutomationSaving] = useState(false);

  // Sync local automation form state when settings load
  useEffect(() => {
    if (settings) {
      setAutomationForm({
        sendPendingTicketReminder: settings.sendPendingTicketReminder ?? false,
        pendingTicketReminderHours: settings.pendingTicketReminderHours ?? 24,
        autoSolveEnabled: settings.autoSolveEnabled ?? false,
        autoSolveHours: settings.autoSolveHours ?? 48,
        autoCloseEnabled: settings.autoCloseEnabled ?? false,
        autoCloseHours: settings.autoCloseHours ?? 48,
        autoDeleteAttachmentsEnabled: settings.autoDeleteAttachmentsEnabled ?? false,
        autoDeleteAttachmentsDays: settings.autoDeleteAttachmentsDays ?? 90,
        aiSummaryEnabled: settings.aiSummaryEnabled ?? false,
        anthropicApiKey: settings.anthropicApiKey ?? '',
        ticketSuggestionsEnabled: settings.ticketSuggestionsEnabled ?? false,
        ticketSuggestionsApiKey: settings.ticketSuggestionsApiKey ?? '',
        aiKnowledgeUrls: settings.aiKnowledgeUrls ?? '',
        aiKnowledgeRefreshDays: settings.aiKnowledgeRefreshDays ?? 7,
      });
    }
  }, [settings]);

  // Check if automation form has unsaved changes
  const hasAutomationChanges = settings && (
    automationForm.sendPendingTicketReminder !== (settings.sendPendingTicketReminder ?? false) ||
    automationForm.pendingTicketReminderHours !== (settings.pendingTicketReminderHours ?? 24) ||
    automationForm.autoSolveEnabled !== (settings.autoSolveEnabled ?? false) ||
    automationForm.autoSolveHours !== (settings.autoSolveHours ?? 48) ||
    automationForm.autoCloseEnabled !== (settings.autoCloseEnabled ?? false) ||
    automationForm.autoCloseHours !== (settings.autoCloseHours ?? 48) ||
    automationForm.autoDeleteAttachmentsEnabled !== (settings.autoDeleteAttachmentsEnabled ?? false) ||
    automationForm.autoDeleteAttachmentsDays !== (settings.autoDeleteAttachmentsDays ?? 90) ||
    automationForm.aiSummaryEnabled !== (settings.aiSummaryEnabled ?? false) ||
    automationForm.anthropicApiKey !== (settings.anthropicApiKey ?? '') ||
    automationForm.ticketSuggestionsEnabled !== (settings.ticketSuggestionsEnabled ?? false) ||
    automationForm.ticketSuggestionsApiKey !== (settings.ticketSuggestionsApiKey ?? '') ||
    automationForm.aiKnowledgeUrls !== (settings.aiKnowledgeUrls ?? '') ||
    automationForm.aiKnowledgeRefreshDays !== (settings.aiKnowledgeRefreshDays ?? 7)
  );

  // Handle automation form field changes
  const handleAutomationChange = <K extends keyof typeof automationForm>(
    field: K,
    value: typeof automationForm[K]
  ) => {
    setAutomationForm(prev => ({ ...prev, [field]: value }));
  };

  // Save all automation settings
  const handleSaveAutomation = async () => {
    if (!settings?.id) return;
    setAutomationSaving(true);
    try {
      await settingsApi.update(settings.id, automationForm);
      toast.success('Automation settings saved successfully');
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to save settings');
    } finally {
      setAutomationSaving(false);
    }
  };

  // Discard automation changes
  const handleDiscardAutomationChanges = () => {
    if (settings) {
      setAutomationForm({
        sendPendingTicketReminder: settings.sendPendingTicketReminder ?? false,
        pendingTicketReminderHours: settings.pendingTicketReminderHours ?? 24,
        autoSolveEnabled: settings.autoSolveEnabled ?? false,
        autoSolveHours: settings.autoSolveHours ?? 48,
        autoCloseEnabled: settings.autoCloseEnabled ?? false,
        autoCloseHours: settings.autoCloseHours ?? 48,
        autoDeleteAttachmentsEnabled: settings.autoDeleteAttachmentsEnabled ?? false,
        autoDeleteAttachmentsDays: settings.autoDeleteAttachmentsDays ?? 90,
        aiSummaryEnabled: settings.aiSummaryEnabled ?? false,
        anthropicApiKey: settings.anthropicApiKey ?? '',
        ticketSuggestionsEnabled: settings.ticketSuggestionsEnabled ?? false,
        ticketSuggestionsApiKey: settings.ticketSuggestionsApiKey ?? '',
        aiKnowledgeUrls: settings.aiKnowledgeUrls ?? '',
        aiKnowledgeRefreshDays: settings.aiKnowledgeRefreshDays ?? 7,
      });
    }
  };

  // Local state for SendGrid tab (manual save instead of auto-save)
  const [sendgridForm, setSendgridForm] = useState({
    sendgridEnabled: false,
    sendgridApiKey: '',
    sendgridFromEmail: '',
    sendgridFromName: '',
    sendgridInboundDomain: '',
    frontendUrl: '',
  });
  const [sendgridSaving, setSendgridSaving] = useState(false);

  // Sync local sendgrid form state when settings load
  useEffect(() => {
    if (settings) {
      setSendgridForm({
        sendgridEnabled: settings.sendgridEnabled ?? false,
        sendgridApiKey: settings.sendgridApiKey ?? '',
        sendgridFromEmail: settings.sendgridFromEmail ?? '',
        sendgridFromName: settings.sendgridFromName ?? '',
        sendgridInboundDomain: settings.sendgridInboundDomain ?? '',
        frontendUrl: settings.frontendUrl ?? '',
      });
    }
  }, [settings]);

  // Check if sendgrid form has unsaved changes
  const hasSendgridChanges = settings && (
    sendgridForm.sendgridEnabled !== (settings.sendgridEnabled ?? false) ||
    sendgridForm.sendgridApiKey !== (settings.sendgridApiKey ?? '') ||
    sendgridForm.sendgridFromEmail !== (settings.sendgridFromEmail ?? '') ||
    sendgridForm.sendgridFromName !== (settings.sendgridFromName ?? '') ||
    sendgridForm.sendgridInboundDomain !== (settings.sendgridInboundDomain ?? '') ||
    sendgridForm.frontendUrl !== (settings.frontendUrl ?? '')
  );

  // Handle sendgrid form field changes
  const handleSendgridChange = <K extends keyof typeof sendgridForm>(
    field: K,
    value: typeof sendgridForm[K]
  ) => {
    setSendgridForm(prev => ({ ...prev, [field]: value }));
  };

  // Save all sendgrid settings
  const handleSaveSendgrid = async () => {
    if (!settings?.id) return;
    setSendgridSaving(true);
    try {
      await settingsApi.update(settings.id, sendgridForm);
      toast.success('SendGrid settings saved successfully');
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to save settings');
    } finally {
      setSendgridSaving(false);
    }
  };

  // Discard sendgrid changes
  const handleDiscardSendgridChanges = () => {
    if (settings) {
      setSendgridForm({
        sendgridEnabled: settings.sendgridEnabled ?? false,
        sendgridApiKey: settings.sendgridApiKey ?? '',
        sendgridFromEmail: settings.sendgridFromEmail ?? '',
        sendgridFromName: settings.sendgridFromName ?? '',
        sendgridInboundDomain: settings.sendgridInboundDomain ?? '',
        frontendUrl: settings.frontendUrl ?? '',
      });
    }
  };

  // Sync local widget form state when settings load
  useEffect(() => {
    if (settings) {
      setWidgetForm({
        chatWidgetEnabled: settings.chatWidgetEnabled ?? false,
        chatWidgetWelcomeMessage: settings.chatWidgetWelcomeMessage ?? '',
        chatWidgetVisibleToUsers: settings.chatWidgetVisibleToUsers ?? true,
        chatWidgetVisibleToAgents: settings.chatWidgetVisibleToAgents ?? false,
        chatWidgetEscalationThreshold: settings.chatWidgetEscalationThreshold ?? 3,
        chatWidgetSystemInstructions: settings.chatWidgetSystemInstructions ?? '',
        chatWidgetCompanyName: settings.chatWidgetCompanyName ?? '',
        chatWidgetTone: settings.chatWidgetTone ?? 'professional',
        chatWidgetFaqItems: (settings.chatWidgetFaqItems as Array<{ question: string; answer: string }>) ?? [],
      });
    }
  }, [settings]);

  // Check if widget form has unsaved changes
  const hasWidgetChanges = settings && (
    widgetForm.chatWidgetEnabled !== (settings.chatWidgetEnabled ?? false) ||
    widgetForm.chatWidgetWelcomeMessage !== (settings.chatWidgetWelcomeMessage ?? '') ||
    widgetForm.chatWidgetVisibleToUsers !== (settings.chatWidgetVisibleToUsers ?? true) ||
    widgetForm.chatWidgetVisibleToAgents !== (settings.chatWidgetVisibleToAgents ?? false) ||
    widgetForm.chatWidgetEscalationThreshold !== (settings.chatWidgetEscalationThreshold ?? 3) ||
    widgetForm.chatWidgetSystemInstructions !== (settings.chatWidgetSystemInstructions ?? '') ||
    widgetForm.chatWidgetCompanyName !== (settings.chatWidgetCompanyName ?? '') ||
    widgetForm.chatWidgetTone !== (settings.chatWidgetTone ?? 'professional') ||
    JSON.stringify(widgetForm.chatWidgetFaqItems) !== JSON.stringify((settings.chatWidgetFaqItems as Array<{ question: string; answer: string }>) ?? [])
  );

  // Handle widget form field changes
  const handleWidgetChange = <K extends keyof typeof widgetForm>(
    field: K,
    value: typeof widgetForm[K]
  ) => {
    setWidgetForm(prev => ({ ...prev, [field]: value }));
  };

  // Save widget settings
  const handleSaveWidget = async () => {
    if (!settings?.id) return;
    setWidgetSaving(true);
    try {
      await settingsApi.update(settings.id, widgetForm);
      toast.success('Widget settings saved successfully');
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to save widget settings');
    } finally {
      setWidgetSaving(false);
    }
  };

  // Discard widget changes
  const handleDiscardWidgetChanges = () => {
    if (settings) {
      setWidgetForm({
        chatWidgetEnabled: settings.chatWidgetEnabled ?? false,
        chatWidgetWelcomeMessage: settings.chatWidgetWelcomeMessage ?? '',
        chatWidgetVisibleToUsers: settings.chatWidgetVisibleToUsers ?? true,
        chatWidgetVisibleToAgents: settings.chatWidgetVisibleToAgents ?? false,
        chatWidgetEscalationThreshold: settings.chatWidgetEscalationThreshold ?? 3,
        chatWidgetSystemInstructions: settings.chatWidgetSystemInstructions ?? '',
        chatWidgetCompanyName: settings.chatWidgetCompanyName ?? '',
        chatWidgetTone: settings.chatWidgetTone ?? 'professional',
        chatWidgetFaqItems: (settings.chatWidgetFaqItems as Array<{ question: string; answer: string }>) ?? [],
      });
    }
  };

  // API Keys queries and mutations
  const { data: apiKeys, isLoading: isLoadingApiKeys } = useQuery({
    queryKey: ['apiKeys'],
    queryFn: async () => {
      const response = await apiKeyApi.getAll();
      return response.data as ApiKey[];
    },
    enabled: activeTab === 'api'
  });

  const { data: availableForms } = useQuery({
    queryKey: ['apiKeyForms'],
    queryFn: async () => {
      const response = await apiKeyApi.getForms();
      return response.data as FormOption[];
    },
    enabled: activeTab === 'api'
  });

  const createKeyMutation = useMutation({
    mutationFn: async (data: { name: string; description?: string; formId?: string }) => {
      const response = await apiKeyApi.create(data);
      return response.data;
    },
    onSuccess: (data) => {
      setCreatedKey(data);
      setShowCreateKeyModal(false);
      setNewKeyName('');
      setNewKeyDescription('');
      setNewKeyFormId('');
      queryClient.invalidateQueries({ queryKey: ['apiKeys'] });
      toast.success('API key created successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to create API key');
    }
  });

  const revokeKeyMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiKeyApi.revoke(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['apiKeys'] });
      toast.success('API key revoked successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to revoke API key');
    }
  });

  const deleteKeyMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiKeyApi.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['apiKeys'] });
      toast.success('API key deleted successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to delete API key');
    }
  });

  const handleCreateKey = () => {
    if (!newKeyName.trim()) {
      toast.error('Please enter a name for the API key');
      return;
    }
    createKeyMutation.mutate({
      name: newKeyName.trim(),
      description: newKeyDescription.trim() || undefined,
      formId: newKeyFormId || undefined
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
    toast.success('API key copied to clipboard');
  };

  const handleBackfillCountries = async () => {
    setBackfillLoading(true);
    setBackfillResult(null);
    try {
      const response = await analyticsApi.backfillCountries();
      setBackfillResult(response.data);
      if (response.data.updatedCount > 0) {
        toast.success(`Updated ${response.data.updatedCount} tickets with country data`);
      } else {
        toast.success('No tickets needed updating');
      }
    } catch (error) {
      console.error('Failed to backfill countries:', error);
      toast.error('Failed to backfill countries');
      setBackfillResult({
        message: 'Failed to backfill countries. Check console for details.',
        updatedCount: 0,
        countryBreakdown: {}
      });
    } finally {
      setBackfillLoading(false);
    }
  };

  const handleBackfillForms = async () => {
    setBackfillFormsLoading(true);
    setBackfillFormsResult(null);
    try {
      const response = await analyticsApi.backfillForms();
      setBackfillFormsResult(response.data);
      if (response.data.updatedCount > 0) {
        toast.success(`Updated ${response.data.updatedCount} tickets with form data`);
      } else {
        toast.success('No tickets needed updating');
      }
    } catch (error) {
      console.error('Failed to backfill forms:', error);
      toast.error('Failed to backfill forms');
      setBackfillFormsResult({
        message: 'Failed to backfill forms. Check console for details.',
        updatedCount: 0,
        formBreakdown: {},
        skippedNoMatch: 0,
        skippedMultipleForms: 0
      });
    } finally {
      setBackfillFormsLoading(false);
    }
  };

  const handleBackfillBacklog = async () => {
    setBackfillBacklogLoading(true);
    setBackfillBacklogResult(null);
    try {
      const response = await analyticsApi.backfillBacklog(90);
      setBackfillBacklogResult(response.data);
      toast.success(response.data.message);
    } catch (error) {
      console.error('Failed to backfill backlog:', error);
      toast.error('Failed to backfill backlog data');
      setBackfillBacklogResult({
        message: 'Failed to backfill backlog. Check console for details.',
        snapshots: []
      });
    } finally {
      setBackfillBacklogLoading(false);
    }
  };

  const handleRecalculateAgentPerformance = async () => {
    setBackfillAgentPerfLoading(true);
    setBackfillAgentPerfResult(null);
    try {
      const response = await adminAnalyticsApi.recalculateAgentPerformance();
      setBackfillAgentPerfResult(response.data);
      toast.success(response.data.message);
    } catch (error) {
      console.error('Failed to recalculate agent performance:', error);
      toast.error('Failed to recalculate agent performance');
      setBackfillAgentPerfResult({
        message: 'Failed to recalculate agent performance. Check console for details.',
        agentsProcessed: 0,
        performance: []
      });
    } finally {
      setBackfillAgentPerfLoading(false);
    }
  };

  const handleBackfillAiSummary = async () => {
    setBackfillAiSummaryLoading(true);
    setBackfillAiSummaryResult(null);
    try {
      const response = await aiAnalyticsApi.backfillSummaries();
      setBackfillAiSummaryResult(response.data);
      toast.success(response.data.message);
    } catch (error) {
      console.error('Failed to backfill AI summary analytics:', error);
      toast.error('Failed to backfill AI summary analytics');
      setBackfillAiSummaryResult({
        message: 'Failed to backfill AI summary analytics. Check console for details.',
        created: 0,
        skipped: 0
      });
    } finally {
      setBackfillAiSummaryLoading(false);
    }
  };

  const handleDbFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPendingDbFile(file);
      setShowDbImportConfirm(true);
    }
    // Reset the input
    if (databaseFileInputRef.current) {
      databaseFileInputRef.current.value = '';
    }
  };

  const handleDbImport = async () => {
    if (!pendingDbFile) return;

    setDbImportLoading(true);
    setDbImportResult(null);
    setShowDbImportConfirm(false);

    try {
      const response = await databaseApi.import(pendingDbFile, 'CONFIRM_DATABASE_IMPORT');
      setDbImportResult(response.data);
      toast.success(response.data.message);
    } catch (error: any) {
      console.error('Failed to import database:', error);
      const errorMsg = error.response?.data?.error || 'Failed to import database';
      toast.error(errorMsg);
      setDbImportResult({
        success: false,
        message: errorMsg,
        warnings: error.response?.data?.details
      });
    } finally {
      setDbImportLoading(false);
      setPendingDbFile(null);
    }
  };

  const handleDbExport = async (format: 'dump' | 'sql' = 'dump') => {
    setDbExportLoading(true);
    try {
      const response = await databaseApi.export(format);
      // Create download link
      const contentType = format === 'sql' ? 'text/plain' : 'application/octet-stream';
      const blob = new Blob([response.data], { type: contentType });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      // Get filename from Content-Disposition header or generate one
      const contentDisposition = response.headers['content-disposition'];
      const filenameMatch = contentDisposition?.match(/filename="([^"]+)"/);
      const extension = format === 'sql' ? '.sql' : '.dump';
      const filename = filenameMatch?.[1] || `database_export_${new Date().toISOString().replace(/[:.]/g, '-')}${extension}`;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success('Database exported successfully');
    } catch (error) {
      console.error('Failed to export database:', error);
      toast.error('Failed to export database');
    } finally {
      setDbExportLoading(false);
    }
  };

  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const csvText = event.target?.result as string;
        const lines = csvText.split('\n').filter(line => line.trim());

        if (lines.length < 2) {
          toast.error('CSV file is empty or has no data rows');
          return;
        }

        // Log first few lines for debugging
        console.log('[CSV Parser] Header:', lines[0]);
        console.log('[CSV Parser] First data row:', lines[1]);
        console.log('[CSV Parser] Total lines:', lines.length);

        // Parse CSV - expected format: "Status","Date","Tickets"
        const dataByDate: Record<string, { new: number; open: number; pending: number; hold: number }> = {};
        let parsedRows = 0;
        let skippedRows = 0;

        for (let i = 1; i < lines.length; i++) {
          const line = lines[i];
          // Parse CSV line - split by comma and strip quotes
          const parts = line.split(',').map(p => p.replace(/^"|"$/g, '').trim());
          if (parts.length < 3) {
            skippedRows++;
            continue;
          }

          const status = parts[0].toLowerCase();
          const dateStr = parts[1];
          const ticketsStr = parts[2];

          // Parse the count (handle empty as 0)
          const count = ticketsStr ? Math.round(parseFloat(ticketsStr)) : 0;

          // Parse date like "31 Dec 25" or "1 Jan 26" or "31 Dec 2025"
          let dateMatch = dateStr.match(/(\d{1,2})\s+(\w{3})\s+(\d{2,4})/);
          if (!dateMatch) {
            // Try alternate formats like "2025-12-31" or "12/31/25"
            const isoMatch = dateStr.match(/(\d{4})-(\d{2})-(\d{2})/);
            if (isoMatch) {
              const dateKey = `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
              if (!dataByDate[dateKey]) {
                dataByDate[dateKey] = { new: 0, open: 0, pending: 0, hold: 0 };
              }
              if (status === 'new') dataByDate[dateKey].new = count;
              else if (status === 'open') dataByDate[dateKey].open = count;
              else if (status === 'pending') dataByDate[dateKey].pending = count;
              else if (status === 'hold' || status === 'on-hold' || status === 'on hold') dataByDate[dateKey].hold = count;
              parsedRows++;
              continue;
            }
            console.log('[CSV Parser] Could not parse date:', dateStr, 'from line:', line);
            skippedRows++;
            continue;
          }

          const day = parseInt(dateMatch[1]);
          const monthStr = dateMatch[2];
          let year = parseInt(dateMatch[3]);
          if (year < 100) year = 2000 + year; // Handle 2-digit year

          const months: Record<string, number> = {
            'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
            'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
          };
          const month = months[monthStr];
          if (month === undefined) {
            console.log('[CSV Parser] Unknown month:', monthStr);
            skippedRows++;
            continue;
          }

          const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

          if (!dataByDate[dateKey]) {
            dataByDate[dateKey] = { new: 0, open: 0, pending: 0, hold: 0 };
          }

          // Handle various status names from Zendesk
          if (status === 'new') dataByDate[dateKey].new = count;
          else if (status === 'open') dataByDate[dateKey].open = count;
          else if (status === 'pending') dataByDate[dateKey].pending = count;
          else if (status === 'hold' || status === 'on-hold' || status === 'on hold') dataByDate[dateKey].hold = count;
          else {
            console.log('[CSV Parser] Unknown status:', status);
          }
          parsedRows++;
        }

        console.log('[CSV Parser] Parsed rows:', parsedRows, 'Skipped rows:', skippedRows);

        // Convert to array format
        const snapshots = Object.entries(dataByDate)
          .map(([date, counts]) => ({
            date,
            ...counts
          }))
          .sort((a, b) => a.date.localeCompare(b.date));

        if (snapshots.length === 0) {
          toast.error('No valid data found in CSV. Check browser console for details.');
          return;
        }

        // Automatically import after parsing
        console.log('[CSV Parser] Importing', snapshots.length, 'snapshots');
        setImportBacklogLoading(true);
        setImportBacklogResult(null);

        try {
          const response = await analyticsApi.importBacklog(snapshots);
          setImportBacklogResult(response.data);
          toast.success(response.data.message);
        } catch (importError: any) {
          console.error('Failed to import backlog:', importError);
          toast.error(importError.response?.data?.error || importError.message || 'Failed to import backlog data');
          setImportBacklogResult({
            message: 'Failed to import backlog. Check console for details.',
            results: []
          });
        } finally {
          setImportBacklogLoading(false);
        }
      } catch (error) {
        console.error('Failed to parse CSV:', error);
        toast.error('Failed to parse CSV file');
      }
    };
    reader.readAsText(file);

    // Reset file input so same file can be selected again
    if (backlogFileInputRef.current) {
      backlogFileInputRef.current.value = '';
    }
  };

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

  const handleRefreshKnowledgeCache = async () => {
    setIsRefreshingCache(true);
    try {
      const response = await settingsApi.refreshKnowledgeCache();
      if (response.data.success) {
        toast.success(`Knowledge cache refreshed (${response.data.cacheLength.toLocaleString()} characters)`);
        // Refetch settings to update the cache timestamp
        queryClient.invalidateQueries({ queryKey: ['settings'] });
      }
    } catch (error) {
      console.error('Error refreshing knowledge cache:', error);
      toast.error('Failed to refresh knowledge cache');
    } finally {
      setIsRefreshingCache(false);
    }
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
        const messages = [];
        if (result.imported > 0) messages.push(`${result.imported} imported`);
        if (result.updated > 0) messages.push(`${result.updated} updated`);
        toast.success(`Successfully processed tickets: ${messages.join(', ')}`);
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

  const handleMacroFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.json')) {
      toast.error('Please select a JSON file');
      return;
    }

    setIsImportingMacros(true);
    setMacroImportResult(null);

    try {
      const response = await macroApi.import(file);
      const result = response.data;

      setMacroImportResult(result);

      if (result.success) {
        toast.success(`Successfully imported ${result.imported} macros`);
        if (result.updated > 0) {
          toast.success(`Updated ${result.updated} existing macros`);
        }
        queryClient.invalidateQueries({ queryKey: ['macros'] });
      }
    } catch (error: any) {
      const errorMessage = typeof error.response?.data?.error === 'string'
        ? error.response.data.error
        : error.response?.data?.message || error.message || 'Failed to import macros';
      toast.error(errorMessage);
      setMacroImportResult({
        success: false,
        error: error.response?.data?.details || errorMessage
      });
    } finally {
      setIsImportingMacros(false);
      if (macroFileInputRef.current) {
        macroFileInputRef.current.value = '';
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
    { id: 'sendgrid' as TabType, label: 'SendGrid', icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
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
    )},
    { id: 'api' as TabType, label: 'API', icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
      </svg>
    )},
    { id: 'maintenance' as TabType, label: 'Maintenance', icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    )},
    { id: 'widget' as TabType, label: 'Widget', icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    )},
    { id: 'security' as TabType, label: 'Security', icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    )},
    { id: 'permissions' as TabType, label: 'Permissions', icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
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
                          value={automationForm.pendingTicketReminderHours}
                          onChange={(e) => handleAutomationChange('pendingTicketReminderHours', parseInt(e.target.value) || 1)}
                          disabled={!automationForm.sendPendingTicketReminder}
                          className="w-16 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                        />
                        <p className="text-sm text-gray-500 dark:text-gray-400">hours of our last reply</p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer ml-4">
                      <input
                        type="checkbox"
                        checked={automationForm.sendPendingTicketReminder}
                        onChange={(e) => handleAutomationChange('sendPendingTicketReminder', e.target.checked)}
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
                          value={automationForm.autoSolveHours}
                          onChange={(e) => handleAutomationChange('autoSolveHours', parseInt(e.target.value) || 1)}
                          disabled={!automationForm.autoSolveEnabled}
                          className="w-16 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                        />
                        <p className="text-sm text-gray-500 dark:text-gray-400">hours with no user reply</p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer ml-4">
                      <input
                        type="checkbox"
                        checked={automationForm.autoSolveEnabled}
                        onChange={(e) => handleAutomationChange('autoSolveEnabled', e.target.checked)}
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
                          value={automationForm.autoCloseHours}
                          onChange={(e) => handleAutomationChange('autoCloseHours', parseInt(e.target.value) || 1)}
                          disabled={!automationForm.autoCloseEnabled}
                          className="w-16 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                        />
                        <p className="text-sm text-gray-500 dark:text-gray-400">hours</p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer ml-4">
                      <input
                        type="checkbox"
                        checked={automationForm.autoCloseEnabled}
                        onChange={(e) => handleAutomationChange('autoCloseEnabled', e.target.checked)}
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
                          value={automationForm.autoDeleteAttachmentsDays}
                          onChange={(e) => handleAutomationChange('autoDeleteAttachmentsDays', parseInt(e.target.value) || 1)}
                          disabled={!automationForm.autoDeleteAttachmentsEnabled}
                          className="w-16 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                        />
                        <p className="text-sm text-gray-500 dark:text-gray-400">days to save disk space</p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer ml-4">
                      <input
                        type="checkbox"
                        checked={automationForm.autoDeleteAttachmentsEnabled}
                        onChange={(e) => handleAutomationChange('autoDeleteAttachmentsEnabled', e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 dark:peer-focus:ring-primary/40 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary"></div>
                    </label>
                  </div>
                </div>
              </div>

              {/* AI Features */}
              <div className="border-t border-gray-200 dark:border-gray-700 pt-8">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                  AI Features
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                  Configure AI-powered features for your support team
                </p>

                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <label className="text-sm font-medium text-gray-900 dark:text-white">
                        AI Ticket Summaries
                      </label>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Allow agents to generate AI-powered summaries for tickets
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer ml-4">
                      <input
                        type="checkbox"
                        checked={automationForm.aiSummaryEnabled}
                        onChange={(e) => handleAutomationChange('aiSummaryEnabled', e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 dark:peer-focus:ring-primary/40 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary"></div>
                    </label>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                      API Key for Ticket Summaries
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="password"
                        value={automationForm.anthropicApiKey}
                        onChange={(e) => handleAutomationChange('anthropicApiKey', e.target.value)}
                        placeholder="sk-ant-..."
                        className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                      />
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                      Used for generating AI summaries on ticket detail pages
                    </p>
                  </div>

                  <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex-1">
                        <label className="text-sm font-medium text-gray-900 dark:text-white">
                          AI Ticket Suggestions
                        </label>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                          Show AI-powered solution suggestions when users create tickets
                        </p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer ml-4">
                        <input
                          type="checkbox"
                          checked={automationForm.ticketSuggestionsEnabled}
                          onChange={(e) => handleAutomationChange('ticketSuggestionsEnabled', e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 dark:peer-focus:ring-primary/40 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary"></div>
                      </label>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                        API Key for Ticket Suggestions
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="password"
                          value={automationForm.ticketSuggestionsApiKey}
                          onChange={(e) => handleAutomationChange('ticketSuggestionsApiKey', e.target.value)}
                          placeholder="sk-ant-..."
                          className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                        />
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                        Used for generating solution suggestions when users create new tickets
                      </p>
                    </div>

                    <div className="mt-4">
                      <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                        AI Knowledge URLs
                      </label>
                      <textarea
                        value={automationForm.aiKnowledgeUrls}
                        onChange={(e) => handleAutomationChange('aiKnowledgeUrls', e.target.value)}
                        placeholder="https://example.com/faq&#10;https://example.com/help-article&#10;https://example.com/documentation"
                        rows={4}
                        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent font-mono"
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                        Add URLs (one per line) to help pages, FAQs, or documentation. The AI will fetch and use this content to provide better suggestions to users.
                      </p>

                      {/* Cache Settings */}
                      <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg space-y-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <label className="block text-sm font-medium text-gray-900 dark:text-white">
                              Cache Refresh Interval
                            </label>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              How often to re-fetch content from URLs
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min="1"
                              max="365"
                              value={automationForm.aiKnowledgeRefreshDays}
                              onChange={(e) => handleAutomationChange('aiKnowledgeRefreshDays', parseInt(e.target.value) || 7)}
                              className="w-20 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-center"
                            />
                            <span className="text-sm text-gray-600 dark:text-gray-400">days</span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-3 border-t border-gray-200 dark:border-gray-600">
                          <div>
                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                              Cache Status
                            </p>
                            {settings?.aiKnowledgeCacheUpdatedAt ? (
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                Last updated: {new Date(settings.aiKnowledgeCacheUpdatedAt).toLocaleString()}
                              </p>
                            ) : (
                              <p className="text-xs text-amber-600 dark:text-amber-400">
                                Cache not yet populated
                              </p>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={handleRefreshKnowledgeCache}
                            disabled={isRefreshingCache || !settings?.aiKnowledgeUrls}
                            className="inline-flex items-center px-3 py-2 text-sm font-medium text-white bg-primary hover:opacity-90 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {isRefreshingCache ? (
                              <>
                                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Refreshing...
                              </>
                            ) : (
                              <>
                                <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                                Refresh Now
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-gray-500 dark:text-gray-400 pt-4 border-t border-gray-200 dark:border-gray-700">
                    Get your API keys from{' '}
                    <a
                      href="https://console.anthropic.com/settings/keys"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      console.anthropic.com
                    </a>
                  </p>
                </div>
              </div>

              {/* Save Button */}
              <div className="border-t border-gray-200 dark:border-gray-700 pt-6 mt-8">
                <div className="flex items-center justify-between">
                  <div>
                    {hasAutomationChanges && (
                      <p className="text-sm text-amber-600 dark:text-amber-400 flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        You have unsaved changes
                      </p>
                    )}
                  </div>
                  <div className="flex gap-3">
                    {hasAutomationChanges && (
                      <button
                        type="button"
                        onClick={handleDiscardAutomationChanges}
                        className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
                      >
                        Discard Changes
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleSaveAutomation}
                      disabled={!hasAutomationChanges || automationSaving}
                      className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-primary hover:opacity-90 rounded-md disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
                    >
                      {automationSaving ? (
                        <>
                          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Saving...
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          Save Changes
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SendGrid Tab */}
          {activeTab === 'sendgrid' && (
            <div className="space-y-8">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                  SendGrid Email Configuration
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                  Configure SendGrid for sending and receiving emails. Enable email replies to tickets.
                </p>

                <div className="space-y-6">
                  {/* Enable SendGrid */}
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <label className="text-sm font-medium text-gray-900 dark:text-white">
                        Enable SendGrid
                      </label>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Enable email notifications and inbound email replies
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer ml-4">
                      <input
                        type="checkbox"
                        checked={sendgridForm.sendgridEnabled}
                        onChange={(e) => handleSendgridChange('sendgridEnabled', e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 dark:peer-focus:ring-primary/40 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary"></div>
                    </label>
                  </div>

                  {/* API Key */}
                  <div>
                    <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                      SendGrid API Key
                    </label>
                    <input
                      type="password"
                      value={sendgridForm.sendgridApiKey}
                      onChange={(e) => handleSendgridChange('sendgridApiKey', e.target.value)}
                      placeholder="SG.xxxxxxxxxx..."
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                      Get your API key from{' '}
                      <a
                        href="https://app.sendgrid.com/settings/api_keys"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        SendGrid API Keys
                      </a>
                    </p>
                  </div>

                  {/* From Email */}
                  <div>
                    <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                      From Email Address
                    </label>
                    <input
                      type="email"
                      value={sendgridForm.sendgridFromEmail}
                      onChange={(e) => handleSendgridChange('sendgridFromEmail', e.target.value)}
                      placeholder="support@yourdomain.com"
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                      The email address that will appear as the sender. Must be verified in SendGrid.
                    </p>
                  </div>

                  {/* From Name */}
                  <div>
                    <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                      From Name
                    </label>
                    <input
                      type="text"
                      value={sendgridForm.sendgridFromName}
                      onChange={(e) => handleSendgridChange('sendgridFromName', e.target.value)}
                      placeholder="Support Team"
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                      The display name shown to recipients
                    </p>
                  </div>

                  {/* Frontend URL */}
                  <div>
                    <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                      Frontend URL
                    </label>
                    <input
                      type="url"
                      value={sendgridForm.frontendUrl}
                      onChange={(e) => handleSendgridChange('frontendUrl', e.target.value)}
                      placeholder="https://support.yourdomain.com"
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                      The public URL of your support portal. Used for "View Ticket" links in emails. Leave empty to use the server's FRONTEND_URL environment variable.
                    </p>
                  </div>

                  {/* Inbound Domain */}
                  <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                    <h3 className="text-md font-medium text-gray-900 dark:text-white mb-4">
                      Inbound Email Configuration
                    </h3>
                    <div>
                      <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                        Inbound Domain
                      </label>
                      <input
                        type="text"
                        value={sendgridForm.sendgridInboundDomain}
                        onChange={(e) => handleSendgridChange('sendgridInboundDomain', e.target.value)}
                        placeholder="reply.yourdomain.com"
                        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                        Domain used for Reply-To addresses (e.g., reply+token@reply.yourdomain.com)
                      </p>
                    </div>

                    <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                      <h4 className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-2">
                        Setup Instructions
                      </h4>
                      <ol className="text-xs text-blue-700 dark:text-blue-400 space-y-1 list-decimal list-inside">
                        <li>Set up Inbound Parse in SendGrid for your inbound domain</li>
                        <li>Point the webhook URL to: <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">{window.location.origin.replace('localhost:5173', 'localhost:3000')}/webhooks/sendgrid/inbound</code></li>
                        <li>Add MX record: <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">reply.yourdomain.com MX 10 mx.sendgrid.net</code></li>
                      </ol>
                    </div>
                  </div>
                </div>
              </div>

              {/* Save Button */}
              <div className="border-t border-gray-200 dark:border-gray-700 pt-6 mt-8">
                <div className="flex items-center justify-between">
                  <div>
                    {hasSendgridChanges && (
                      <p className="text-sm text-amber-600 dark:text-amber-400 flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        You have unsaved changes
                      </p>
                    )}
                  </div>
                  <div className="flex gap-3">
                    {hasSendgridChanges && (
                      <button
                        type="button"
                        onClick={handleDiscardSendgridChanges}
                        className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
                      >
                        Discard Changes
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleSaveSendgrid}
                      disabled={!hasSendgridChanges || sendgridSaving}
                      className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-primary hover:opacity-90 rounded-md disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
                    >
                      {sendgridSaving ? (
                        <>
                          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Saving...
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          Save Changes
                        </>
                      )}
                    </button>
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
                        {ticketImportResult.updated > 0 && (
                          <p>Updated: {ticketImportResult.updated} tickets</p>
                        )}
                        {ticketImportResult.usersCreated > 0 && (
                          <p>Users created: {ticketImportResult.usersCreated}</p>
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

              {/* Macro Import Section */}
              <div className="border-b border-gray-200 dark:border-gray-700 pb-8">
                <h3 className="text-md font-medium text-gray-900 dark:text-white mb-2">
                  Import Macros
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Import macros from a Zendesk macro export JSON file. Macros with the same name will be updated.
                </p>

                <input
                  ref={macroFileInputRef}
                  type="file"
                  accept=".json"
                  onChange={handleMacroFileSelect}
                  disabled={isImportingMacros}
                  className="hidden"
                />

                <button
                  onClick={() => macroFileInputRef.current?.click()}
                  disabled={isImportingMacros}
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-primary-foreground bg-primary hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isImportingMacros ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Importing Macros...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                      </svg>
                      Import Macros JSON
                    </>
                  )}
                </button>

                {macroImportResult && (
                  <div className={`mt-4 p-4 rounded-md ${
                    macroImportResult.success
                      ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                      : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
                  }`}>
                    <h3 className={`text-sm font-medium ${
                      macroImportResult.success
                        ? 'text-green-800 dark:text-green-300'
                        : 'text-red-800 dark:text-red-300'
                    }`}>
                      {macroImportResult.success ? 'Macro Import Successful' : 'Macro Import Failed'}
                    </h3>
                    {macroImportResult.success && (
                      <div className="mt-2 text-sm text-green-700 dark:text-green-400">
                        <p>Imported: {macroImportResult.imported} macros</p>
                        {macroImportResult.updated > 0 && (
                          <p>Updated: {macroImportResult.updated} macros</p>
                        )}
                        {macroImportResult.skipped > 0 && (
                          <p>Skipped: {macroImportResult.skipped} macros</p>
                        )}
                        {macroImportResult.errors && macroImportResult.errors.length > 0 && (
                          <details className="mt-2">
                            <summary className="cursor-pointer">View errors</summary>
                            <ul className="list-disc list-inside mt-1 space-y-1">
                              {macroImportResult.errors.map((error: string, index: number) => (
                                <li key={index} className="text-xs">{error}</li>
                              ))}
                            </ul>
                          </details>
                        )}
                      </div>
                    )}
                    {!macroImportResult.success && (
                      <p className="mt-2 text-sm text-red-700 dark:text-red-400">
                        {macroImportResult.error}
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
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-primary-foreground bg-primary hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
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

              {/* Horizontal separator */}
              <hr className="border-gray-200 dark:border-gray-700" />

              {/* Import Historical Backlog Data */}
              <div className="pb-8">
                <h3 className="text-md font-medium text-gray-900 dark:text-white mb-2">
                  Import Historical Backlog Data
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Import historical backlog data from a Zendesk CSV export. The CSV should have columns: Status, Date, Tickets.
                </p>

                <input
                  ref={backlogFileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleCsvUpload}
                  disabled={importBacklogLoading}
                  className="hidden"
                />

                <button
                  onClick={() => backlogFileInputRef.current?.click()}
                  disabled={importBacklogLoading}
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-primary-foreground bg-primary hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {importBacklogLoading ? (
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
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                      Import Backlog CSV
                    </>
                  )}
                </button>

                {importBacklogResult && (
                  <div className={`mt-4 p-4 rounded-md ${
                    importBacklogResult.results.some(r => r.status === 'imported')
                      ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                      : 'bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600'
                  }`}>
                    <p className={`text-sm font-medium ${
                      importBacklogResult.results.some(r => r.status === 'imported')
                        ? 'text-green-800 dark:text-green-300'
                        : 'text-gray-700 dark:text-gray-300'
                    }`}>
                      {importBacklogResult.message}
                    </p>
                    {importBacklogResult.results.length > 0 && (
                      <div className="mt-3">
                        <p className="text-xs font-semibold text-green-700 dark:text-green-400 mb-2">Imported snapshots:</p>
                        <div className="overflow-x-auto max-h-48 overflow-y-auto">
                          <table className="min-w-full text-xs">
                            <thead className="sticky top-0 bg-green-50 dark:bg-green-900">
                              <tr className="text-left text-gray-600 dark:text-gray-400">
                                <th className="pr-4 py-1">Date</th>
                                <th className="pr-4 py-1">New</th>
                                <th className="pr-4 py-1">Open</th>
                                <th className="pr-4 py-1">Pending</th>
                                <th className="pr-4 py-1">Hold</th>
                                <th className="pr-4 py-1">Total</th>
                                <th className="py-1">Status</th>
                              </tr>
                            </thead>
                            <tbody className="text-gray-800 dark:text-gray-200">
                              {importBacklogResult.results.map((result) => (
                                <tr key={result.date}>
                                  <td className="pr-4 py-1">{result.date}</td>
                                  <td className="pr-4 py-1">{result.new}</td>
                                  <td className="pr-4 py-1">{result.open}</td>
                                  <td className="pr-4 py-1">{result.pending}</td>
                                  <td className="pr-4 py-1">{result.hold}</td>
                                  <td className="pr-4 py-1 font-medium">{result.total}</td>
                                  <td className="py-1">
                                    <span className={`px-1.5 py-0.5 rounded text-xs ${
                                      result.status === 'imported'
                                        ? 'bg-green-100 dark:bg-green-800 text-green-700 dark:text-green-300'
                                        : 'bg-yellow-100 dark:bg-yellow-800 text-yellow-700 dark:text-yellow-300'
                                    }`}>
                                      {result.status}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
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
                      <h3 className="text-md font-medium text-gray-900 dark:text-white">Full Database Backup</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Download complete database backup</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => handleDbExport('sql')}
                      disabled={dbExportLoading}
                      className="inline-flex justify-center items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {dbExportLoading ? (
                        <>
                          <svg className="animate-spin -ml-1 mr-2 h-5 w-5" fill="none" viewBox="0 0 24 24">
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
                          SQL Format
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => handleDbExport('dump')}
                      disabled={dbExportLoading}
                      className="inline-flex justify-center items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {dbExportLoading ? (
                        <>
                          <svg className="animate-spin -ml-1 mr-2 h-5 w-5" fill="none" viewBox="0 0 24 24">
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
                          Dump Format
                        </>
                      )}
                    </button>
                  </div>
                  <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                    <strong>SQL Format:</strong> Better cross-version compatibility (recommended for import to different PG versions)<br/>
                    <strong>Dump Format:</strong> Faster restore, includes indexes/constraints, same PG version recommended
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* API Tab */}
          {activeTab === 'api' && (
            <div className="space-y-8">
              {/* API Key Management */}
              <div>
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                      API Keys
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Manage API keys for external integrations and remote ticket submission
                    </p>
                  </div>
                  <button
                    onClick={() => setShowCreateKeyModal(true)}
                    className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-primary-foreground bg-primary hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
                  >
                    <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Create API Key
                  </button>
                </div>

                {/* Created Key Alert */}
                {createdKey && createdKey.fullKey && (
                  <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                    <div className="flex items-start gap-3">
                      <svg className="w-6 h-6 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <div className="flex-1">
                        <h3 className="text-sm font-medium text-green-800 dark:text-green-300">
                          API Key Created Successfully
                        </h3>
                        <p className="mt-1 text-sm text-green-700 dark:text-green-400">
                          Copy your API key now. You won't be able to see it again.
                        </p>
                        <div className="mt-3 flex items-center gap-2">
                          <code className="flex-1 px-3 py-2 bg-white dark:bg-gray-800 border border-green-300 dark:border-green-700 rounded text-sm font-mono text-gray-900 dark:text-white">
                            {createdKey.fullKey}
                          </code>
                          <button
                            onClick={() => copyToClipboard(createdKey.fullKey!)}
                            className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded text-sm font-medium"
                          >
                            {copiedKey ? 'Copied!' : 'Copy'}
                          </button>
                        </div>
                        <button
                          onClick={() => setCreatedKey(null)}
                          className="mt-2 text-sm text-green-600 dark:text-green-400 hover:underline"
                        >
                          Dismiss
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* API Keys List */}
                {isLoadingApiKeys ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : apiKeys && apiKeys.length > 0 ? (
                  <div className="overflow-hidden border border-gray-200 dark:border-gray-700 rounded-lg">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                      <thead className="bg-gray-50 dark:bg-gray-800">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Name</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Key</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Form Restriction</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Usage</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                        {apiKeys.map((key) => (
                          <tr key={key.id}>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div>
                                <div className="text-sm font-medium text-gray-900 dark:text-white">{key.name}</div>
                                {key.description && (
                                  <div className="text-sm text-gray-500 dark:text-gray-400">{key.description}</div>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <code className="text-sm font-mono text-gray-600 dark:text-gray-400">{key.keyDisplay}</code>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {key.form ? (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300">
                                  {key.form.name}
                                </span>
                              ) : (
                                <span className="text-sm text-gray-500 dark:text-gray-400">All forms</span>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                              {key.usageCount} requests
                              {key.lastUsedAt && (
                                <div className="text-xs">Last used: {new Date(key.lastUsedAt).toLocaleDateString()}</div>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {key.isActive ? (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300">
                                  Active
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300">
                                  Revoked
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                              {key.isActive && (
                                <button
                                  onClick={() => revokeKeyMutation.mutate(key.id)}
                                  className="text-yellow-600 hover:text-yellow-900 dark:text-yellow-400 dark:hover:text-yellow-300 mr-4"
                                >
                                  Revoke
                                </button>
                              )}
                              <button
                                onClick={() => deleteKeyMutation.mutate(key.id)}
                                className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-8 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
                    <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                    </svg>
                    <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No API keys</h3>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Create an API key to enable external integrations.</p>
                  </div>
                )}
              </div>

              {/* API Documentation */}
              <div className="border-t border-gray-200 dark:border-gray-700 pt-8">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                      API Documentation
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Use these endpoints to submit tickets from external applications
                    </p>
                  </div>
                  <a
                    href="/api-docs"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                    Public API Docs
                  </a>
                </div>

                <div className="space-y-6">
                  {/* Base URL */}
                  <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Base URL</h3>
                    <code className="text-sm font-mono text-primary">{window.location.origin}/api/v1</code>
                  </div>

                  {/* Authentication */}
                  <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Authentication</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                      Include your API key in the Authorization header:
                    </p>
                    <code className="block text-sm font-mono bg-gray-900 text-green-400 p-3 rounded">
                      Authorization: Bearer klv_your_api_key_here
                    </code>
                  </div>

                  {/* Endpoints */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-medium text-gray-900 dark:text-white">Available Endpoints</h3>

                    {/* GET /forms */}
                    <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="px-2 py-0.5 text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded">GET</span>
                        <code className="text-sm font-mono text-gray-900 dark:text-white">/forms</code>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        List all available forms. If your API key is restricted to a specific form, only that form will be returned.
                      </p>
                    </div>

                    {/* GET /forms/:formId/schema */}
                    <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="px-2 py-0.5 text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded">GET</span>
                        <code className="text-sm font-mono text-gray-900 dark:text-white">/forms/:formId/schema</code>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Get the form schema including all fields, their types, and validation rules.
                      </p>
                    </div>

                    {/* GET /fields */}
                    <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="px-2 py-0.5 text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded">GET</span>
                        <code className="text-sm font-mono text-gray-900 dark:text-white">/fields</code>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        List all fields from the field library with their types, options, and default values.
                      </p>
                    </div>

                    {/* GET /fields/:fieldId */}
                    <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="px-2 py-0.5 text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded">GET</span>
                        <code className="text-sm font-mono text-gray-900 dark:text-white">/fields/:fieldId</code>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Get a specific field by ID with its type, options, placeholder, and default value.
                      </p>
                    </div>

                    {/* POST /tickets */}
                    <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded">POST</span>
                        <code className="text-sm font-mono text-gray-900 dark:text-white">/tickets</code>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                        Create a new ticket. Requires email, subject, and description. Form and form responses are optional.
                      </p>
                      <details className="text-sm">
                        <summary className="cursor-pointer text-primary hover:underline">View request body example</summary>
                        <pre className="mt-2 p-3 bg-gray-900 text-green-400 rounded overflow-x-auto text-xs">
{`{
  "email": "user@example.com",        // Required
  "subject": "Issue with swap",       // Required
  "description": "Detailed desc...",  // Required
  "formId": "uuid-of-form",           // Optional
  "formResponses": [                  // Optional
    { "fieldId": "uuid", "value": "Value" }
  ],
  "priority": "NORMAL",               // Optional: LOW, NORMAL, HIGH, URGENT
  "country": "US",                    // Optional
  "userAgent": "MyApp/1.0"            // Optional
}`}
                        </pre>
                      </details>
                    </div>

                    {/* GET /tickets/:ticketNumber */}
                    <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="px-2 py-0.5 text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded">GET</span>
                        <code className="text-sm font-mono text-gray-900 dark:text-white">/tickets/:ticketNumber</code>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Get ticket status by ticket number. Returns current status, priority, and timestamps.
                      </p>
                    </div>
                  </div>

                  {/* Response Codes */}
                  <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">Response Codes</h3>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded">200</span>
                        <span className="text-gray-600 dark:text-gray-400">Success</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded">201</span>
                        <span className="text-gray-600 dark:text-gray-400">Created</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 text-xs font-medium bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 rounded">400</span>
                        <span className="text-gray-600 dark:text-gray-400">Bad Request</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 rounded">401</span>
                        <span className="text-gray-600 dark:text-gray-400">Unauthorized</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 rounded">403</span>
                        <span className="text-gray-600 dark:text-gray-400">Forbidden</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 rounded">404</span>
                        <span className="text-gray-600 dark:text-gray-400">Not Found</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Create API Key Modal */}
              {showCreateKeyModal && (
                <div className="fixed inset-0 z-50 overflow-y-auto">
                  <div className="flex min-h-full items-center justify-center p-4">
                    <div className="fixed inset-0 bg-black/50" onClick={() => setShowCreateKeyModal(false)} />
                    <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-6">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                        Create API Key
                      </h3>

                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Name <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={newKeyName}
                            onChange={(e) => setNewKeyName(e.target.value)}
                            placeholder="e.g., K5 Wallet Integration"
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Description
                          </label>
                          <textarea
                            value={newKeyDescription}
                            onChange={(e) => setNewKeyDescription(e.target.value)}
                            placeholder="What is this API key used for?"
                            rows={2}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Restrict to Form
                          </label>
                          <CustomSelect
                            value={newKeyFormId}
                            onChange={(v) => setNewKeyFormId(v)}
                            placeholder="All forms (no restriction)"
                            options={[
                              { value: '', label: 'All forms (no restriction)' },
                              ...(availableForms?.map((form) => ({
                                value: form.id,
                                label: form.name,
                              })) || []),
                            ]}
                          />
                          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            Optionally restrict this API key to only submit tickets for a specific form.
                          </p>
                        </div>
                      </div>

                      <div className="mt-6 flex justify-end gap-3">
                        <button
                          onClick={() => setShowCreateKeyModal(false)}
                          className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleCreateKey}
                          disabled={createKeyMutation.isPending}
                          className="px-4 py-2 text-sm font-medium text-primary-foreground bg-primary hover:opacity-90 rounded-md disabled:opacity-50"
                        >
                          {createKeyMutation.isPending ? 'Creating...' : 'Create Key'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Maintenance Tab */}
          {activeTab === 'maintenance' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                  Data Maintenance
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                  Tools for managing and updating ticket data
                </p>
              </div>

              {/* Backfill Ticket Countries */}
              <div className="p-6 border border-gray-200 dark:border-gray-700 rounded-lg">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                        <svg className="w-6 h-6 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <h3 className="text-md font-medium text-gray-900 dark:text-white">Backfill Ticket Countries</h3>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                      Update tickets without country data based on the requester's timezone setting.
                      This will map user timezones to their respective countries.
                    </p>
                  </div>
                  <button
                    onClick={handleBackfillCountries}
                    disabled={backfillLoading}
                    className="ml-4 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {backfillLoading ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Processing...
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Run Backfill
                      </>
                    )}
                  </button>
                </div>

                {backfillResult && (
                  <div className={`mt-4 p-4 rounded-md ${
                    backfillResult.updatedCount > 0
                      ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                      : 'bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600'
                  }`}>
                    <p className={`text-sm font-medium ${
                      backfillResult.updatedCount > 0
                        ? 'text-green-800 dark:text-green-300'
                        : 'text-gray-700 dark:text-gray-300'
                    }`}>
                      {backfillResult.message}
                    </p>
                    {backfillResult.updatedCount > 0 && Object.keys(backfillResult.countryBreakdown).length > 0 && (
                      <div className="mt-3">
                        <p className="text-xs font-semibold text-green-700 dark:text-green-400 mb-2">Countries updated:</p>
                        <div className="flex flex-wrap gap-2">
                          {Object.entries(backfillResult.countryBreakdown)
                            .sort(([, a], [, b]) => b - a)
                            .map(([country, count]) => (
                              <span key={country} className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-green-100 dark:bg-green-800/30 text-green-700 dark:text-green-300">
                                {country}: {count}
                              </span>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Backfill Ticket Forms */}
              <div className="p-6 border border-gray-200 dark:border-gray-700 rounded-lg">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                        <svg className="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <h3 className="text-md font-medium text-gray-900 dark:text-white">Backfill Ticket Forms</h3>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                      Analyze imported tickets and determine which form was used based on their form responses.
                      This will set the formId for tickets that have form responses but no form assigned.
                    </p>
                  </div>
                  <button
                    onClick={handleBackfillForms}
                    disabled={backfillFormsLoading}
                    className="ml-4 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {backfillFormsLoading ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Processing...
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Run Backfill
                      </>
                    )}
                  </button>
                </div>

                {backfillFormsResult && (
                  <div className={`mt-4 p-4 rounded-md ${
                    backfillFormsResult.updatedCount > 0
                      ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                      : 'bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600'
                  }`}>
                    <p className={`text-sm font-medium ${
                      backfillFormsResult.updatedCount > 0
                        ? 'text-green-800 dark:text-green-300'
                        : 'text-gray-700 dark:text-gray-300'
                    }`}>
                      {backfillFormsResult.message}
                    </p>
                    {backfillFormsResult.updatedCount > 0 && Object.keys(backfillFormsResult.formBreakdown).length > 0 && (
                      <div className="mt-3">
                        <p className="text-xs font-semibold text-green-700 dark:text-green-400 mb-2">Forms assigned:</p>
                        <div className="flex flex-wrap gap-2">
                          {Object.entries(backfillFormsResult.formBreakdown)
                            .sort(([, a], [, b]) => b - a)
                            .map(([form, count]) => (
                              <span key={form} className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-purple-100 dark:bg-purple-800/30 text-purple-700 dark:text-purple-300">
                                {form}: {count}
                              </span>
                            ))}
                        </div>
                      </div>
                    )}
                    {(backfillFormsResult.skippedNoMatch > 0 || backfillFormsResult.skippedMultipleForms > 0) && (
                      <div className="mt-3 text-xs text-gray-600 dark:text-gray-400">
                        {backfillFormsResult.skippedNoMatch > 0 && (
                          <p>Skipped (no matching form): {backfillFormsResult.skippedNoMatch}</p>
                        )}
                        {backfillFormsResult.skippedMultipleForms > 0 && (
                          <p>Skipped (ambiguous): {backfillFormsResult.skippedMultipleForms}</p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Backfill Backlog Snapshots */}
              <div className="p-6 border border-gray-200 dark:border-gray-700 rounded-lg">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                        <svg className="w-6 h-6 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                      </div>
                      <h3 className="text-md font-medium text-gray-900 dark:text-white">Backfill Backlog Snapshots</h3>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                      Generate historical backlog data for the analytics charts (90 days).
                      This creates daily snapshots of ticket counts by status.
                    </p>
                  </div>
                  <button
                    onClick={handleBackfillBacklog}
                    disabled={backfillBacklogLoading}
                    className="ml-4 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {backfillBacklogLoading ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Processing...
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Run Backfill
                      </>
                    )}
                  </button>
                </div>

                {backfillBacklogResult && (
                  <div className={`mt-4 p-4 rounded-md ${
                    backfillBacklogResult.snapshots.length > 0
                      ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                      : 'bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600'
                  }`}>
                    <p className={`text-sm font-medium ${
                      backfillBacklogResult.snapshots.length > 0
                        ? 'text-green-800 dark:text-green-300'
                        : 'text-gray-700 dark:text-gray-300'
                    }`}>
                      {backfillBacklogResult.message}
                    </p>
                    {backfillBacklogResult.snapshots.length > 0 && (
                      <div className="mt-3">
                        <p className="text-xs font-semibold text-green-700 dark:text-green-400 mb-2">Sample snapshots (first 10):</p>
                        <div className="overflow-x-auto">
                          <table className="min-w-full text-xs">
                            <thead>
                              <tr className="text-left text-gray-600 dark:text-gray-400">
                                <th className="pr-4 py-1">Date</th>
                                <th className="pr-4 py-1">New</th>
                                <th className="pr-4 py-1">Open</th>
                                <th className="pr-4 py-1">Pending</th>
                                <th className="pr-4 py-1">Hold</th>
                                <th className="py-1">Total</th>
                              </tr>
                            </thead>
                            <tbody className="text-gray-800 dark:text-gray-200">
                              {backfillBacklogResult.snapshots.map((snapshot) => (
                                <tr key={snapshot.date}>
                                  <td className="pr-4 py-1">{snapshot.date}</td>
                                  <td className="pr-4 py-1">{snapshot.new}</td>
                                  <td className="pr-4 py-1">{snapshot.open}</td>
                                  <td className="pr-4 py-1">{snapshot.pending}</td>
                                  <td className="pr-4 py-1">{snapshot.hold}</td>
                                  <td className="py-1 font-medium">{snapshot.total}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Recalculate Agent Performance */}
              <div className="p-6 border border-gray-200 dark:border-gray-700 rounded-lg">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                        <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      </div>
                      <h3 className="text-md font-medium text-gray-900 dark:text-white">Recalculate Agent Performance</h3>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                      Recalculate agent performance metrics based on all tickets and comments.
                      This updates session reply counts and refreshes contribution scores.
                    </p>
                  </div>
                  <button
                    onClick={handleRecalculateAgentPerformance}
                    disabled={backfillAgentPerfLoading}
                    className="ml-4 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {backfillAgentPerfLoading ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Processing...
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Recalculate
                      </>
                    )}
                  </button>
                </div>

                {backfillAgentPerfResult && (
                  <div className={`mt-4 p-4 rounded-md ${
                    backfillAgentPerfResult.agentsProcessed > 0
                      ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                      : 'bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600'
                  }`}>
                    <p className={`text-sm font-medium ${
                      backfillAgentPerfResult.agentsProcessed > 0
                        ? 'text-green-800 dark:text-green-300'
                        : 'text-gray-700 dark:text-gray-300'
                    }`}>
                      {backfillAgentPerfResult.message}
                    </p>
                    {backfillAgentPerfResult.performance.length > 0 && (
                      <div className="mt-3">
                        <p className="text-xs font-semibold text-green-700 dark:text-green-400 mb-2">Agent Performance Summary:</p>
                        <div className="overflow-x-auto">
                          <table className="min-w-full text-xs">
                            <thead>
                              <tr className="text-left text-gray-600 dark:text-gray-400">
                                <th className="pr-4 py-1">Agent</th>
                                <th className="pr-4 py-1">Tickets</th>
                                <th className="pr-4 py-1">Replies</th>
                                <th className="pr-4 py-1">Avg/Ticket</th>
                                <th className="py-1">Contribution</th>
                              </tr>
                            </thead>
                            <tbody className="text-gray-800 dark:text-gray-200">
                              {backfillAgentPerfResult.performance.map((item) => (
                                <tr key={item.agent.id}>
                                  <td className="pr-4 py-1">{item.agent.name || item.agent.email}</td>
                                  <td className="pr-4 py-1">{item.totalTickets}</td>
                                  <td className="pr-4 py-1">{item.totalReplies}</td>
                                  <td className="pr-4 py-1">{item.avgRepliesPerTicket}</td>
                                  <td className="py-1 font-medium">{item.contribution}%</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Backfill AI Summary Analytics */}
              <div className="p-6 border border-gray-200 dark:border-gray-700 rounded-lg">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
                        <svg className="w-6 h-6 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                      </div>
                      <h3 className="text-md font-medium text-gray-900 dark:text-white">Backfill AI Summary Analytics</h3>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                      Create analytics events for existing tickets that have AI summaries.
                      This will populate the AI Analytics dashboard with historical data.
                    </p>
                  </div>
                  <button
                    onClick={handleBackfillAiSummary}
                    disabled={backfillAiSummaryLoading}
                    className="ml-4 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {backfillAiSummaryLoading ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Processing...
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Run Backfill
                      </>
                    )}
                  </button>
                </div>

                {backfillAiSummaryResult && (
                  <div className={`mt-4 p-4 rounded-md ${
                    backfillAiSummaryResult.created > 0
                      ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                      : 'bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600'
                  }`}>
                    <p className={`text-sm font-medium ${
                      backfillAiSummaryResult.created > 0
                        ? 'text-green-800 dark:text-green-300'
                        : 'text-gray-700 dark:text-gray-300'
                    }`}>
                      {backfillAiSummaryResult.message}
                    </p>
                    {(backfillAiSummaryResult.created > 0 || backfillAiSummaryResult.skipped > 0) && (
                      <div className="mt-3 flex flex-wrap gap-4 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center px-2 py-1 rounded-md font-medium bg-green-100 dark:bg-green-800/30 text-green-700 dark:text-green-300">
                            Created: {backfillAiSummaryResult.created}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center px-2 py-1 rounded-md font-medium bg-gray-100 dark:bg-gray-600/30 text-gray-700 dark:text-gray-300">
                            Already tracked: {backfillAiSummaryResult.skipped}
                          </span>
                        </div>
                        {backfillAiSummaryResult.totalTicketsWithSummary !== undefined && (
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center px-2 py-1 rounded-md font-medium bg-indigo-100 dark:bg-indigo-800/30 text-indigo-700 dark:text-indigo-300">
                              Total with summaries: {backfillAiSummaryResult.totalTicketsWithSummary}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Database Import/Export */}
              <div className="p-6 border border-red-200 dark:border-red-700 rounded-lg bg-red-50/50 dark:bg-red-900/10">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                        <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                        </svg>
                      </div>
                      <h3 className="text-md font-medium text-gray-900 dark:text-white">Database Import/Export</h3>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                      Import or export the entire database. Useful for migrations and backups.
                    </p>
                    <p className="text-xs text-red-600 dark:text-red-400 font-medium">
                      Warning: Importing a database will REPLACE ALL existing data!
                    </p>
                  </div>
                  <div className="flex gap-2 ml-4">
                    <input
                      ref={databaseFileInputRef}
                      type="file"
                      accept=".dump,.sql,.backup"
                      onChange={handleDbFileSelect}
                      className="hidden"
                    />
                    <button
                      onClick={() => databaseFileInputRef.current?.click()}
                      disabled={dbImportLoading}
                      className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {dbImportLoading ? (
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
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                          </svg>
                          Import
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => handleDbExport('sql')}
                      disabled={dbExportLoading}
                      className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                      title="SQL format - better cross-version compatibility"
                    >
                      {dbExportLoading ? (
                        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      ) : (
                        <>
                          <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                          SQL
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => handleDbExport('dump')}
                      disabled={dbExportLoading}
                      className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Dump format - faster restore, same PG version recommended"
                    >
                      {dbExportLoading ? (
                        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      ) : (
                        <>
                          <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                          Dump
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {dbImportResult && (
                  <div className={`mt-4 p-4 rounded-md ${
                    dbImportResult.success
                      ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                      : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
                  }`}>
                    <p className={`text-sm font-medium ${
                      dbImportResult.success
                        ? 'text-green-800 dark:text-green-300'
                        : 'text-red-800 dark:text-red-300'
                    }`}>
                      {dbImportResult.message}
                    </p>
                    {dbImportResult.filename && (
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                        File: {dbImportResult.filename} ({dbImportResult.size ? (dbImportResult.size / 1024 / 1024).toFixed(2) + ' MB' : ''})
                      </p>
                    )}
                    {dbImportResult.warnings && (
                      <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                        Warnings: {dbImportResult.warnings}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Import Confirmation Modal */}
              {showDbImportConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-full">
                        <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        Confirm Database Import
                      </h3>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                      You are about to import: <strong>{pendingDbFile?.name}</strong>
                    </p>
                    <p className="text-sm text-red-600 dark:text-red-400 font-medium mb-6">
                      This action will PERMANENTLY REPLACE ALL DATA in the database. This cannot be undone!
                    </p>
                    <div className="flex gap-3 justify-end">
                      <button
                        onClick={() => {
                          setShowDbImportConfirm(false);
                          setPendingDbFile(null);
                        }}
                        className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleDbImport}
                        className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                      >
                        Yes, Replace Database
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Widget Tab */}
          {activeTab === 'widget' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                  Chat Widget
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                  Configure the AI-powered chat widget that helps users get quick answers
                </p>
              </div>

              {/* Widget Enable/Disable */}
              <div className="p-6 border border-gray-200 dark:border-gray-700 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <svg className="w-6 h-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-md font-medium text-gray-900 dark:text-white">Enable Chat Widget</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Show the floating chat button on all pages
                      </p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={widgetForm.chatWidgetEnabled}
                      onChange={(e) => handleWidgetChange('chatWidgetEnabled', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 dark:peer-focus:ring-primary/30 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary"></div>
                  </label>
                </div>
              </div>

              {/* Welcome Message */}
              <div className="p-6 border border-gray-200 dark:border-gray-700 rounded-lg">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                    <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-md font-medium text-gray-900 dark:text-white">Welcome Message</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      The initial message shown when users open the chat
                    </p>
                  </div>
                </div>
                <textarea
                  value={widgetForm.chatWidgetWelcomeMessage}
                  onChange={(e) => handleWidgetChange('chatWidgetWelcomeMessage', e.target.value)}
                  placeholder="Hi! How can I help you today?"
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>

              {/* Visibility Settings */}
              <div className="p-6 border border-gray-200 dark:border-gray-700 rounded-lg">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                    <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-md font-medium text-gray-900 dark:text-white">Visibility</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Control who can see the chat widget
                    </p>
                  </div>
                </div>
                <div className="space-y-4">
                  <label className="flex items-center justify-between">
                    <span className="text-sm text-gray-700 dark:text-gray-300">Show to Users</span>
                    <input
                      type="checkbox"
                      checked={widgetForm.chatWidgetVisibleToUsers}
                      onChange={(e) => handleWidgetChange('chatWidgetVisibleToUsers', e.target.checked)}
                      className="w-4 h-4 text-primary bg-gray-100 border-gray-300 rounded focus:ring-primary dark:focus:ring-primary dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                    />
                  </label>
                  <label className="flex items-center justify-between">
                    <span className="text-sm text-gray-700 dark:text-gray-300">Show to Agents</span>
                    <input
                      type="checkbox"
                      checked={widgetForm.chatWidgetVisibleToAgents}
                      onChange={(e) => handleWidgetChange('chatWidgetVisibleToAgents', e.target.checked)}
                      className="w-4 h-4 text-primary bg-gray-100 border-gray-300 rounded focus:ring-primary dark:focus:ring-primary dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                    />
                  </label>
                </div>
              </div>

              {/* Escalation Settings */}
              <div className="p-6 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                    <svg className="w-6 h-6 text-orange-600 dark:text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-md font-medium text-gray-900 dark:text-white">Escalation Settings</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Configure when to prompt users to create a support ticket
                    </p>
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Escalation Threshold (responses)
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="number"
                        min="1"
                        max="10"
                        value={widgetForm.chatWidgetEscalationThreshold}
                        onChange={(e) => handleWidgetChange('chatWidgetEscalationThreshold', parseInt(e.target.value) || 3)}
                        className="w-20 px-3 py-2 text-center border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                      />
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        AI responses before showing ticket creation prompt
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                      After this many AI responses, users will be prompted to create a support ticket if their issue isn't resolved.
                    </p>
                  </div>
                </div>
              </div>

              {/* Training Section */}
              <div className="p-6 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
                      <svg className="w-6 h-6 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-md font-medium text-gray-900 dark:text-white">Train Chatbot</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Customize the chatbot's personality, add FAQs, and configure custom instructions
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowTrainingModal(true)}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    Configure Training
                  </button>
                </div>
                {/* Training Summary */}
                <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                  <div className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Company Name</p>
                    <p className="font-medium text-gray-900 dark:text-white truncate">
                      {widgetForm.chatWidgetCompanyName || 'Not configured'}
                    </p>
                  </div>
                  <div className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Tone</p>
                    <p className="font-medium text-gray-900 dark:text-white capitalize">
                      {widgetForm.chatWidgetTone || 'Professional'}
                    </p>
                  </div>
                  <div className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">FAQ Items</p>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {widgetForm.chatWidgetFaqItems.length} configured
                    </p>
                  </div>
                  <div className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Custom Instructions</p>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {widgetForm.chatWidgetSystemInstructions ? 'Configured' : 'Not configured'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Knowledge Sources Info */}
              <div className="p-6 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                    <svg className="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-md font-medium text-gray-900 dark:text-white">Knowledge Sources</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      The chatbot learns from the following sources
                    </p>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                    <svg className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Solved tickets with agent responses</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                    <svg className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>AI Knowledge URLs (configured in Automation tab)</span>
                  </div>
                </div>
                <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">
                  The chatbot uses the same AI knowledge base as the ticket suggestions feature.
                  Configure knowledge URLs in the Automation tab.
                </p>
              </div>

              {/* Chat Sessions Link */}
              <div className="p-6 border border-gray-200 dark:border-gray-700 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                      <svg className="w-6 h-6 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-md font-medium text-gray-900 dark:text-white">Chat Sessions</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Review all chat conversations with users
                      </p>
                    </div>
                  </div>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    Coming soon
                  </span>
                </div>
              </div>

              {/* Save/Discard Buttons */}
              <div className="border-t border-gray-200 dark:border-gray-700 pt-6 mt-8">
                <div className="flex items-center justify-between">
                  <div>
                    {hasWidgetChanges && (
                      <p className="text-sm text-amber-600 dark:text-amber-400 flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        You have unsaved changes
                      </p>
                    )}
                  </div>
                  <div className="flex gap-3">
                    {hasWidgetChanges && (
                      <button
                        type="button"
                        onClick={handleDiscardWidgetChanges}
                        className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                      >
                        Discard Changes
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleSaveWidget}
                      disabled={!hasWidgetChanges || widgetSaving}
                      className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-primary hover:opacity-90 rounded-md disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
                    >
                      {widgetSaving ? (
                        <>
                          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Saving...
                        </>
                      ) : (
                        'Save Changes'
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Security Tab */}
          {activeTab === 'security' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                  Two-Factor Authentication Settings
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                  Configure 2FA requirements and manage grace periods for users
                </p>
              </div>

              {/* Global Enforcement Toggle */}
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h3 className="text-base font-medium text-gray-900 dark:text-white">
                      Enable 2FA Enforcement
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      Global kill switch for 2FA enforcement. When disabled, 2FA requirements are not enforced.
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer ml-4">
                    <input
                      type="checkbox"
                      checked={settings?.twoFactorEnforcementEnabled ?? false}
                      onChange={(e) => {
                        console.log('[2FA Settings] Toggling enforcement:', e.target.checked);
                        handleToggle('twoFactorEnforcementEnabled', e.target.checked);
                      }}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                  </label>
                </div>
              </div>

              {/* Role Requirements */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="text-base font-medium text-gray-900 dark:text-white">
                        Require 2FA for Admins
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Admins must enable 2FA to access the system
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer ml-4">
                      <input
                        type="checkbox"
                        checked={settings?.require2FAForAdmins ?? true}
                        onChange={(e) => {
                          console.log('[2FA Settings] Toggling admin requirement:', e.target.checked);
                          handleToggle('require2FAForAdmins', e.target.checked);
                        }}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                </div>

                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="text-base font-medium text-gray-900 dark:text-white">
                        Require 2FA for Agents
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Agents must enable 2FA to access the system
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer ml-4">
                      <input
                        type="checkbox"
                        checked={settings?.require2FAForAgents ?? true}
                        onChange={(e) => {
                          console.log('[2FA Settings] Toggling agent requirement:', e.target.checked);
                          handleToggle('require2FAForAgents', e.target.checked);
                        }}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                </div>
              </div>

              {/* Allow for Users */}
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h3 className="text-base font-medium text-gray-900 dark:text-white">
                      Allow 2FA for Users
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      Allow regular users to optionally enable 2FA (not required)
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer ml-4">
                    <input
                      type="checkbox"
                      checked={settings?.allow2FAForUsers ?? true}
                      onChange={(e) => {
                        console.log('[2FA Settings] Toggling user allowance:', e.target.checked);
                        handleToggle('allow2FAForUsers', e.target.checked);
                      }}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                  </label>
                </div>
              </div>

              {/* Grace Period Setting */}
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
                <div>
                  <h3 className="text-base font-medium text-gray-900 dark:text-white mb-1">
                    Grace Period
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                    Number of days users have to enable 2FA after enforcement is turned on
                  </p>
                  <div className="flex items-center space-x-4">
                    <input
                      type="number"
                      min="1"
                      max="90"
                      value={settings?.twoFactorGracePeriodDays ?? 7}
                      onChange={(e) => {
                        const days = parseInt(e.target.value);
                        console.log('[2FA Settings] Setting grace period days:', days);
                        if (days >= 1 && days <= 90) {
                          updateMutation.mutate({ twoFactorGracePeriodDays: days });
                        }
                      }}
                      className="block w-24 rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:text-white sm:text-sm"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">days</span>
                  </div>
                </div>
              </div>

              {/* Save Button */}
              <div className="flex justify-end">
                <button
                  onClick={() => {
                    console.log('[2FA Settings] Saving settings...');
                    updateMutation.mutate(settings);
                  }}
                  disabled={updateMutation.isPending}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {updateMutation.isPending ? 'Saving...' : 'Save Security Settings'}
                </button>
              </div>
            </div>
          )}

          {/* Permissions Tab */}
          {activeTab === 'permissions' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                  Agent Permissions
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                  Control which pages and features agents can access
                </p>
              </div>

              <div className="space-y-4">
                {/* Create Tickets Permission */}
                <div className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                  <div>
                    <label className="text-sm font-medium text-gray-900 dark:text-white">
                      Create Tickets
                    </label>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Allow agents to create new tickets on behalf of users
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings?.agentCanCreateTickets ?? true}
                      onChange={(e) => handleToggle('agentCanCreateTickets', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/25 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary"></div>
                  </label>
                </div>

                {/* Analytics Permission */}
                <div className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                  <div>
                    <label className="text-sm font-medium text-gray-900 dark:text-white">
                      Analytics
                    </label>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Allow agents to view analytics and reports
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings?.agentCanAccessAnalytics ?? true}
                      onChange={(e) => handleToggle('agentCanAccessAnalytics', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/25 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary"></div>
                  </label>
                </div>

                {/* Forms Permission */}
                <div className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                  <div>
                    <label className="text-sm font-medium text-gray-900 dark:text-white">
                      Forms
                    </label>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Allow agents to view and manage ticket forms
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings?.agentCanAccessForms ?? true}
                      onChange={(e) => handleToggle('agentCanAccessForms', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/25 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary"></div>
                  </label>
                </div>

                {/* Field Library Permission */}
                <div className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                  <div>
                    <label className="text-sm font-medium text-gray-900 dark:text-white">
                      Field Library
                    </label>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Allow agents to view and manage custom form fields
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings?.agentCanAccessFieldLibrary ?? true}
                      onChange={(e) => handleToggle('agentCanAccessFieldLibrary', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/25 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary"></div>
                  </label>
                </div>

                {/* Macros Permission */}
                <div className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                  <div>
                    <label className="text-sm font-medium text-gray-900 dark:text-white">
                      Macros
                    </label>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Allow agents to view and manage response macros
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings?.agentCanAccessMacros ?? true}
                      onChange={(e) => handleToggle('agentCanAccessMacros', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/25 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary"></div>
                  </label>
                </div>

                {/* Bug Reports Permission */}
                <div className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                  <div>
                    <label className="text-sm font-medium text-gray-900 dark:text-white">
                      Bug Reports
                    </label>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Allow agents to view and manage bug reports
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings?.agentCanAccessBugReports ?? true}
                      onChange={(e) => handleToggle('agentCanAccessBugReports', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/25 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary"></div>
                  </label>
                </div>

                {/* Email Templates Permission */}
                <div className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                  <div>
                    <label className="text-sm font-medium text-gray-900 dark:text-white">
                      Email Templates
                    </label>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Allow agents to view and manage email templates
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings?.agentCanAccessEmailTemplates ?? false}
                      onChange={(e) => handleToggle('agentCanAccessEmailTemplates', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/25 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary"></div>
                  </label>
                </div>

                {/* Users Permission */}
                <div className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                  <div>
                    <label className="text-sm font-medium text-gray-900 dark:text-white">
                      Users
                    </label>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Allow agents to view and manage users
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings?.agentCanAccessUsers ?? false}
                      onChange={(e) => handleToggle('agentCanAccessUsers', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/25 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary"></div>
                  </label>
                </div>
              </div>

              <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <div className="flex gap-3">
                  <svg className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="text-sm text-blue-700 dark:text-blue-300">
                    <p className="font-medium">Note</p>
                    <p className="mt-1">These settings control which menu items are visible to agents. Agents always have access to the Tickets page. Admins always have access to all pages regardless of these settings. New pages are disabled by default until enabled here.</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Training Modal */}
      {showTrainingModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
            <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={() => setShowTrainingModal(false)} />
            <div className="relative inline-block w-full max-w-2xl p-6 my-8 text-left align-middle transition-all transform bg-white dark:bg-gray-800 shadow-xl rounded-xl">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Train Chatbot</h3>
                <button
                  onClick={() => setShowTrainingModal(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-2">
                {/* Company Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Company Name
                  </label>
                  <input
                    type="text"
                    value={widgetForm.chatWidgetCompanyName}
                    onChange={(e) => handleWidgetChange('chatWidgetCompanyName', e.target.value)}
                    placeholder="Your Company"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-primary focus:border-primary dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  />
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Used in the chatbot's introduction (e.g., "Hi, I'm the support assistant for [Company Name]")
                  </p>
                </div>

                {/* Tone Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Communication Tone
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    {['professional', 'friendly', 'casual'].map((tone) => (
                      <button
                        key={tone}
                        onClick={() => handleWidgetChange('chatWidgetTone', tone)}
                        className={`p-3 rounded-lg border-2 transition-colors capitalize ${
                          widgetForm.chatWidgetTone === tone
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 text-gray-700 dark:text-gray-300'
                        }`}
                      >
                        {tone}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Custom Instructions */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Custom Instructions
                  </label>
                  <textarea
                    value={widgetForm.chatWidgetSystemInstructions}
                    onChange={(e) => handleWidgetChange('chatWidgetSystemInstructions', e.target.value)}
                    placeholder="Add any specific instructions for the chatbot...&#10;&#10;Example:&#10;- Always recommend checking our FAQ page first&#10;- If asked about pricing, direct users to /pricing&#10;- Never promise specific resolution times"
                    rows={5}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-primary focus:border-primary dark:bg-gray-700 dark:border-gray-600 dark:text-white resize-none"
                  />
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    These instructions guide the chatbot's behavior and responses
                  </p>
                </div>

                {/* FAQ Items */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      FAQ Items ({widgetForm.chatWidgetFaqItems.length})
                    </label>
                    <button
                      onClick={() => {
                        handleWidgetChange('chatWidgetFaqItems', [
                          ...widgetForm.chatWidgetFaqItems,
                          { question: '', answer: '' }
                        ]);
                      }}
                      className="text-sm text-primary hover:text-primary/80 font-medium"
                    >
                      + Add FAQ
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                    Add common questions and answers to improve chatbot accuracy
                  </p>
                  <div className="space-y-4">
                    {widgetForm.chatWidgetFaqItems.map((faq, index) => (
                      <div key={index} className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
                        <div className="flex items-start justify-between mb-3">
                          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">FAQ #{index + 1}</span>
                          <button
                            onClick={() => {
                              const newFaqs = widgetForm.chatWidgetFaqItems.filter((_, i) => i !== index);
                              handleWidgetChange('chatWidgetFaqItems', newFaqs);
                            }}
                            className="text-red-500 hover:text-red-700 text-xs"
                          >
                            Remove
                          </button>
                        </div>
                        <div className="space-y-3">
                          <div>
                            <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Question</label>
                            <input
                              type="text"
                              value={faq.question}
                              onChange={(e) => {
                                const newFaqs = [...widgetForm.chatWidgetFaqItems];
                                newFaqs[index] = { ...newFaqs[index], question: e.target.value };
                                handleWidgetChange('chatWidgetFaqItems', newFaqs);
                              }}
                              placeholder="What is your refund policy?"
                              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-primary focus:border-primary dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Answer</label>
                            <textarea
                              value={faq.answer}
                              onChange={(e) => {
                                const newFaqs = [...widgetForm.chatWidgetFaqItems];
                                newFaqs[index] = { ...newFaqs[index], answer: e.target.value };
                                handleWidgetChange('chatWidgetFaqItems', newFaqs);
                              }}
                              placeholder="We offer a 30-day money-back guarantee on all purchases..."
                              rows={2}
                              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-primary focus:border-primary dark:bg-gray-700 dark:border-gray-600 dark:text-white resize-none"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                    {widgetForm.chatWidgetFaqItems.length === 0 && (
                      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                        <svg className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <p className="text-sm">No FAQ items yet</p>
                        <p className="text-xs mt-1">Click "Add FAQ" to add common questions and answers</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
                <button
                  onClick={() => setShowTrainingModal(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    setShowTrainingModal(false);
                    // Changes will be saved when the main Save button is clicked
                  }}
                  className="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default AdminSettings;
