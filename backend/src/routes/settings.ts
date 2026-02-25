import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAuth, requireAdmin, requireAgent, AuthRequest } from '../middleware/auth';
import { refreshKnowledgeCache } from '../services/aiService';

const router = Router();
const prisma = new PrismaClient();

// Get settings (create default if doesn't exist)
router.get('/', requireAuth, requireAdmin, async (_req: AuthRequest, res: Response) => {
  try {
    let settings = await prisma.settings.findFirst();

    // If no settings exist, create default settings
    if (!settings) {
      settings = await prisma.settings.create({
        data: {}
      });
    }

    return res.json(settings);
  } catch (error) {
    console.error('Error fetching settings:', error);
    return res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// Get AI settings status (for agents)
router.get('/ai-status', requireAuth, requireAgent, async (_req: AuthRequest, res: Response) => {
  try {
    const settings = await prisma.settings.findFirst();
    return res.json({
      enabled: settings?.aiSummaryEnabled ?? false,
      configured: !!(settings?.anthropicApiKey)
    });
  } catch (error) {
    console.error('Error fetching AI settings:', error);
    return res.status(500).json({ error: 'Failed to fetch AI settings' });
  }
});

// Get agent page permissions (for agents to know which pages they can access)
// NOTE: When adding new admin pages, add them here with default false
router.get('/agent-permissions', requireAuth, async (_req: AuthRequest, res: Response) => {
  try {
    const settings = await prisma.settings.findFirst();
    return res.json({
      canAccessAnalytics: settings?.agentCanAccessAnalytics ?? true,
      canAccessForms: settings?.agentCanAccessForms ?? true,
      canAccessFieldLibrary: settings?.agentCanAccessFieldLibrary ?? true,
      canAccessMacros: settings?.agentCanAccessMacros ?? true,
      canAccessBugReports: settings?.agentCanAccessBugReports ?? true,
      canAccessEmailTemplates: settings?.agentCanAccessEmailTemplates ?? false,
      canAccessUsers: settings?.agentCanAccessUsers ?? false,
      canCreateTickets: settings?.agentCanCreateTickets ?? true
    });
  } catch (error) {
    console.error('Error fetching agent permissions:', error);
    return res.status(500).json({ error: 'Failed to fetch agent permissions' });
  }
});

// Update settings
router.patch('/:id', requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Whitelist of allowed settings fields to prevent mass assignment
    const ALLOWED_FIELDS = [
      // Email Settings
      'sendTicketCreatedEmail', 'sendTicketAssignedEmail', 'sendTicketResolvedEmail',
      'sendPendingTicketReminder', 'pendingTicketReminderHours',
      // Auto-close / Auto-solve
      'autoCloseEnabled', 'autoCloseHours', 'autoSolveEnabled', 'autoSolveHours',
      // General
      'defaultTicketPriority', 'allowCustomerReopenClosed',
      // Attachment Cleanup
      'autoDeleteAttachmentsEnabled', 'autoDeleteAttachmentsDays',
      // AI Settings
      'aiSummaryEnabled', 'anthropicApiKey', 'ticketSuggestionsEnabled', 'ticketSuggestionsApiKey',
      'aiKnowledgeUrls', 'aiKnowledgeRefreshDays',
      // Chat Widget
      'chatWidgetEnabled', 'chatWidgetWelcomeMessage', 'chatWidgetVisibleToUsers',
      'chatWidgetVisibleToAgents', 'chatWidgetEscalationThreshold',
      'chatWidgetSystemInstructions', 'chatWidgetCompanyName', 'chatWidgetTone', 'chatWidgetFaqItems',
      // SendGrid
      'sendgridEnabled', 'sendgridApiKey', 'sendgridFromEmail', 'sendgridFromName', 'sendgridInboundDomain',
      // Frontend URL (for email links)
      'frontendUrl',
      // Agent Permissions
      'agentCanAccessAnalytics', 'agentCanAccessForms', 'agentCanAccessFieldLibrary',
      'agentCanAccessMacros', 'agentCanAccessBugReports', 'agentCanAccessEmailTemplates',
      'agentCanAccessUsers', 'agentCanCreateTickets',
      // 2FA Settings
      'require2FAForAgents', 'require2FAForAdmins', 'twoFactorGracePeriodDays', 'twoFactorEnforcementEnabled'
    ];

    const updateData: Record<string, any> = {};
    for (const key of Object.keys(req.body)) {
      if (ALLOWED_FIELDS.includes(key)) {
        updateData[key] = req.body[key];
      }
    }

    // Validate numeric fields
    if (updateData.pendingTicketReminderHours !== undefined && updateData.pendingTicketReminderHours < 1) {
      return res.status(400).json({ error: 'Pending ticket reminder hours must be at least 1' });
    }

    if (updateData.autoCloseHours !== undefined && updateData.autoCloseHours < 1) {
      return res.status(400).json({ error: 'Auto-close hours must be at least 1' });
    }

    if (updateData.autoSolveHours !== undefined && updateData.autoSolveHours < 1) {
      return res.status(400).json({ error: 'Auto-solve hours must be at least 1' });
    }

    // Validate 2FA settings
    if (updateData.twoFactorGracePeriodDays !== undefined) {
      if (updateData.twoFactorGracePeriodDays < 1 || updateData.twoFactorGracePeriodDays > 90) {
        return res.status(400).json({ error: 'Grace period days must be between 1 and 90' });
      }

      // If grace period days are being changed, recalculate existing grace periods
      const currentSettings = await prisma.settings.findUnique({ where: { id } });
      if (currentSettings && currentSettings.twoFactorEnforcementEnabled) {
        const newGracePeriodEnd = new Date();
        newGracePeriodEnd.setDate(newGracePeriodEnd.getDate() + updateData.twoFactorGracePeriodDays);

        console.log('[2FA Settings] Recalculating grace periods for new duration:', updateData.twoFactorGracePeriodDays, 'days');

        // Recalculate grace period for admins without 2FA
        if (currentSettings.require2FAForAdmins) {
          const adminsUpdated = await prisma.user.updateMany({
            where: {
              role: 'ADMIN',
              has2FAEnabled: false,
              twoFactorGracePeriodEnd: { not: null }
            },
            data: { twoFactorGracePeriodEnd: newGracePeriodEnd }
          });
          console.log('[2FA Settings] Updated grace period for', adminsUpdated.count, 'admins');
        }

        // Recalculate grace period for agents without 2FA
        if (currentSettings.require2FAForAgents) {
          const agentsUpdated = await prisma.user.updateMany({
            where: {
              role: 'AGENT',
              has2FAEnabled: false,
              twoFactorGracePeriodEnd: { not: null }
            },
            data: { twoFactorGracePeriodEnd: newGracePeriodEnd }
          });
          console.log('[2FA Settings] Updated grace period for', agentsUpdated.count, 'agents');
        }
      }
    }

    // If enforcement is being enabled, set grace periods for users without 2FA
    if (updateData.twoFactorEnforcementEnabled === true) {
      const currentSettings = await prisma.settings.findUnique({ where: { id } });

      if (currentSettings && !currentSettings.twoFactorEnforcementEnabled) {
        // Enforcement is being turned on for the first time
        const gracePeriodDays = updateData.twoFactorGracePeriodDays || currentSettings.twoFactorGracePeriodDays || 7;
        const gracePeriodEnd = new Date();
        gracePeriodEnd.setDate(gracePeriodEnd.getDate() + gracePeriodDays);

        // Set grace period for admins without 2FA (if required)
        if (currentSettings.require2FAForAdmins || updateData.require2FAForAdmins) {
          await prisma.user.updateMany({
            where: {
              role: 'ADMIN',
              has2FAEnabled: false,
              twoFactorGracePeriodEnd: null
            },
            data: { twoFactorGracePeriodEnd: gracePeriodEnd }
          });
        }

        // Set grace period for agents without 2FA (if required)
        if (currentSettings.require2FAForAgents || updateData.require2FAForAgents) {
          await prisma.user.updateMany({
            where: {
              role: 'AGENT',
              has2FAEnabled: false,
              twoFactorGracePeriodEnd: null
            },
            data: { twoFactorGracePeriodEnd: gracePeriodEnd }
          });
        }
      }
    }

    const settings = await prisma.settings.update({
      where: { id },
      data: updateData
    });

    return res.json(settings);
  } catch (error) {
    console.error('Error updating settings:', error);
    return res.status(500).json({ error: 'Failed to update settings' });
  }
});

// Refresh AI knowledge cache
router.post('/refresh-knowledge-cache', requireAuth, requireAdmin, async (_req: AuthRequest, res: Response) => {
  try {
    const settings = await prisma.settings.findFirst();

    if (!settings) {
      return res.status(404).json({ error: 'Settings not found' });
    }

    if (!settings.aiKnowledgeUrls) {
      return res.status(400).json({ error: 'No knowledge URLs configured' });
    }

    const content = await refreshKnowledgeCache(settings.id, settings.aiKnowledgeUrls);

    return res.json({
      success: true,
      cacheLength: content?.length ?? 0,
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error refreshing knowledge cache:', error);
    return res.status(500).json({ error: 'Failed to refresh knowledge cache' });
  }
});

export default router;
