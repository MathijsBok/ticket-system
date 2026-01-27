import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
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
import userRoutes from './routes/users';
import settingsRoutes from './routes/settings';
import zendeskImportRoutes from './routes/zendesk-import';
import macroRoutes from './routes/macros';
import emailTemplateRoutes from './routes/emailTemplates';

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

// Webhook routes (before JSON parsing and Clerk middleware)
app.use('/webhooks', webhookRoutes);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
