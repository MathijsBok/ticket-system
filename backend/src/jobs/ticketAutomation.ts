import cron from 'node-cron';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Automatically close solved tickets based on settings
 */
async function autoCloseTickets() {
  try {
    // Get settings
    const settings = await prisma.settings.findFirst();

    if (!settings || !settings.autoCloseEnabled) {
      console.log('[Auto-Close] Auto-close is disabled');
      return;
    }

    const hoursThreshold = settings.autoCloseHours;
    const cutoffDate = new Date();
    cutoffDate.setHours(cutoffDate.getHours() - hoursThreshold);

    console.log(`[Auto-Close] Checking for tickets solved before ${cutoffDate.toISOString()}`);

    // Find tickets that are SOLVED and have been solved for longer than threshold
    const ticketsToClose = await prisma.ticket.findMany({
      where: {
        status: 'SOLVED',
        solvedAt: {
          lte: cutoffDate
        }
      },
      select: {
        id: true,
        ticketNumber: true,
        subject: true,
        solvedAt: true
      }
    });

    if (ticketsToClose.length === 0) {
      console.log('[Auto-Close] No tickets to close');
      return;
    }

    console.log(`[Auto-Close] Found ${ticketsToClose.length} tickets to close`);

    // Update tickets to CLOSED status
    const result = await prisma.ticket.updateMany({
      where: {
        id: {
          in: ticketsToClose.map(t => t.id)
        }
      },
      data: {
        status: 'CLOSED',
        closedAt: new Date()
      }
    });

    console.log(`[Auto-Close] Successfully closed ${result.count} tickets`);

    // Log activity for each closed ticket
    for (const ticket of ticketsToClose) {
      await prisma.ticketActivity.create({
        data: {
          ticketId: ticket.id,
          action: 'ticket_auto_closed',
          details: {
            reason: 'auto_close',
            hoursAfterSolved: hoursThreshold,
            closedAt: new Date().toISOString()
          }
        }
      });
    }

  } catch (error) {
    console.error('[Auto-Close] Error auto-closing tickets:', error);
  }
}

/**
 * Automatically mark pending tickets as solved based on settings
 */
async function autoSolvePendingTickets() {
  try {
    // Get settings
    const settings = await prisma.settings.findFirst();

    if (!settings || !settings.autoSolveEnabled) {
      console.log('[Auto-Solve] Auto-solve is disabled');
      return;
    }

    const hoursThreshold = settings.autoSolveHours;
    const cutoffDate = new Date();
    cutoffDate.setHours(cutoffDate.getHours() - hoursThreshold);

    console.log(`[Auto-Solve] Checking for pending tickets with no user reply since ${cutoffDate.toISOString()}`);

    // Find pending tickets where the last comment was from an agent (not the user)
    // and it's been longer than the threshold
    const pendingTickets = await prisma.ticket.findMany({
      where: {
        status: 'PENDING'
      },
      include: {
        comments: {
          orderBy: {
            createdAt: 'desc'
          },
          take: 1,
          include: {
            author: {
              select: {
                id: true,
                role: true
              }
            }
          }
        },
        requester: {
          select: {
            id: true
          }
        }
      }
    });

    const ticketsToSolve = pendingTickets.filter(ticket => {
      if (ticket.comments.length === 0) return false;

      const lastComment = ticket.comments[0];
      const lastCommentDate = new Date(lastComment.createdAt);

      // Check if last comment is older than threshold
      if (lastCommentDate > cutoffDate) return false;

      // Check if last comment was from an agent (not the requester)
      const isFromAgent = lastComment.author.role === 'AGENT' || lastComment.author.role === 'ADMIN';
      const isFromRequester = lastComment.author.id === ticket.requester.id;

      return isFromAgent && !isFromRequester;
    });

    if (ticketsToSolve.length === 0) {
      console.log('[Auto-Solve] No tickets to solve');
      return;
    }

    console.log(`[Auto-Solve] Found ${ticketsToSolve.length} tickets to mark as solved`);

    // Update tickets to SOLVED status
    for (const ticket of ticketsToSolve) {
      await prisma.ticket.update({
        where: { id: ticket.id },
        data: {
          status: 'SOLVED',
          solvedAt: new Date()
        }
      });

      // Log activity
      await prisma.ticketActivity.create({
        data: {
          ticketId: ticket.id,
          action: 'ticket_auto_solved',
          details: {
            reason: 'auto_solve',
            hoursWithoutUserReply: hoursThreshold,
            solvedAt: new Date().toISOString()
          }
        }
      });
    }

    console.log(`[Auto-Solve] Successfully marked ${ticketsToSolve.length} tickets as solved`);

  } catch (error) {
    console.error('[Auto-Solve] Error auto-solving tickets:', error);
  }
}

/**
 * Capture daily backlog snapshot for historical tracking
 */
async function captureBacklogSnapshot() {
  try {
    // Use UTC date to avoid timezone issues
    const now = new Date();
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

    // Check if we already have a snapshot for today
    const existingSnapshot = await prisma.backlogSnapshot.findUnique({
      where: { date: today }
    });

    if (existingSnapshot) {
      console.log('[Backlog Snapshot] Snapshot already exists for today, updating...');
    }

    // Get current counts by status
    const statusCounts = await prisma.ticket.groupBy({
      by: ['status'],
      _count: true,
      where: {
        status: {
          in: ['NEW', 'OPEN', 'PENDING', 'ON_HOLD']
        }
      }
    });

    const newCount = statusCounts.find(s => s.status === 'NEW')?._count || 0;
    const openCount = statusCounts.find(s => s.status === 'OPEN')?._count || 0;
    const pendingCount = statusCounts.find(s => s.status === 'PENDING')?._count || 0;
    const holdCount = statusCounts.find(s => s.status === 'ON_HOLD')?._count || 0;
    const totalCount = newCount + openCount + pendingCount + holdCount;

    // Upsert the snapshot
    await prisma.backlogSnapshot.upsert({
      where: { date: today },
      create: {
        date: today,
        newCount,
        openCount,
        pendingCount,
        holdCount,
        totalCount
      },
      update: {
        newCount,
        openCount,
        pendingCount,
        holdCount,
        totalCount
      }
    });

    console.log(`[Backlog Snapshot] Captured for ${today.toISOString().split('T')[0]}: New=${newCount}, Open=${openCount}, Pending=${pendingCount}, Hold=${holdCount}, Total=${totalCount}`);

  } catch (error) {
    console.error('[Backlog Snapshot] Error capturing snapshot:', error);
  }
}

/**
 * Clean up old read notifications (older than 5 days)
 */
async function cleanupOldNotifications() {
  try {
    const daysThreshold = 5;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysThreshold);

    console.log(`[Notification Cleanup] Deleting read notifications older than ${cutoffDate.toISOString()}`);

    const result = await prisma.notification.deleteMany({
      where: {
        isRead: true,
        readAt: {
          lte: cutoffDate
        }
      }
    });

    if (result.count > 0) {
      console.log(`[Notification Cleanup] Deleted ${result.count} old read notifications`);
    } else {
      console.log('[Notification Cleanup] No old notifications to delete');
    }

  } catch (error) {
    console.error('[Notification Cleanup] Error cleaning up notifications:', error);
  }
}

/**
 * Run all automation tasks
 */
async function runTicketAutomation() {
  console.log(`[Ticket Automation] Running at ${new Date().toISOString()}`);
  await autoSolvePendingTickets();
  await autoCloseTickets();
  await cleanupOldNotifications();
  console.log('[Ticket Automation] Completed');
}

/**
 * Initialize scheduled jobs
 */
export function initializeTicketAutomation() {
  console.log('[Ticket Automation] Initializing scheduled jobs');

  // Run every hour at minute 0
  cron.schedule('0 * * * *', async () => {
    await runTicketAutomation();
  });

  // Capture backlog snapshot daily at midnight
  cron.schedule('0 0 * * *', async () => {
    console.log('[Backlog Snapshot] Running daily snapshot capture');
    await captureBacklogSnapshot();
  });

  // Run once on startup after a short delay
  setTimeout(async () => {
    console.log('[Ticket Automation] Running initial automation check');
    await runTicketAutomation();
    // Also capture a snapshot on startup if none exists for today
    await captureBacklogSnapshot();
  }, 10000); // Wait 10 seconds after startup

  console.log('[Ticket Automation] Scheduled jobs initialized (runs every hour, backlog snapshot daily at midnight)');
}
