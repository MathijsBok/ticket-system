// Enable BigInt JSON serialization globally
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { clerkMiddleware } from '@clerk/express';

// Import routes
import ticketRoutes from './routes/tickets';
import commentRoutes from './routes/comments';
import attachmentRoutes from './routes/attachments';
import formRoutes from './routes/forms';
import fieldLibraryRoutes from './routes/fieldLibrary';
import analyticsRoutes from './routes/analytics';
import adminAnalyticsRoutes from './routes/adminAnalytics';
import sessionRoutes from './routes/sessions';
import timeTrackingRoutes from './routes/timeTracking';
import webhookRoutes from './routes/webhooks';
import sendgridWebhookRoutes from './routes/sendgridWebhook';
import userRoutes from './routes/users';
import settingsRoutes from './routes/settings';
import zendeskImportRoutes from './routes/zendesk-import';
import macroRoutes from './routes/macros';
import emailTemplateRoutes from './routes/emailTemplates';
import notificationRoutes from './routes/notifications';
import bugRoutes from './routes/bugs';
import exportRoutes from './routes/export';
import apiKeyRoutes from './routes/apiKeys';
import externalApiRoutes from './routes/externalApi';
import aiSummaryAnalyticsRoutes from './routes/aiSummaryAnalytics';
import chatRoutes from './routes/chat';
import databaseRoutes from './routes/database';
import feedbackRoutes from './routes/feedback';
import securityRoutes from './routes/security';

// Import automation jobs
import { initializeTicketAutomation } from './jobs/ticketAutomation';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(morgan('dev'));

// Rate limiting - general API limit
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // limit each IP to 500 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' }
});
app.use('/api/', apiLimiter);

// Stricter rate limit for public/unauthenticated endpoints
const publicLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30, // 30 requests per 15 minutes for public endpoints
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' }
});
app.use('/api/feedback', publicLimiter);

// Webhook routes (before JSON parsing and Clerk middleware)
app.use('/webhooks', webhookRoutes);
app.use('/webhooks/sendgrid', sendgridWebhookRoutes);

app.use(express.json({ limit: '250mb' }));
app.use(express.urlencoded({ extended: true, limit: '250mb' }));

// External API routes (uses API key auth, before Clerk middleware)
app.use('/api/v1', externalApiRoutes);

// Clerk authentication middleware
app.use(clerkMiddleware());

// Routes
app.use('/api/tickets', ticketRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/attachments', attachmentRoutes);
app.use('/api/forms', formRoutes);
app.use('/api/fields', fieldLibraryRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/admin-analytics', adminAnalyticsRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/time-tracking', timeTrackingRoutes);
app.use('/api/users', userRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/zendesk', zendeskImportRoutes);
app.use('/api/macros', macroRoutes);
app.use('/api/email-templates', emailTemplateRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/bugs', bugRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/api-keys', apiKeyRoutes);
app.use('/api/ai-summary-analytics', aiSummaryAnalyticsRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/database', databaseRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/security', securityRoutes);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: {
      message: err.message || 'Internal server error',
      status: err.status || 500
    }
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);

  // Initialize ticket automation jobs
  initializeTicketAutomation();
});

export default app;
