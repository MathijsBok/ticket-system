/**
 * Test script to manually trigger automation and verify it works
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testAutomation() {
  try {
    console.log('Testing Ticket Automation...\n');

    // Get settings
    const settings = await prisma.settings.findFirst();
    console.log('Settings:', {
      autoCloseEnabled: settings?.autoCloseEnabled,
      autoCloseHours: settings?.autoCloseHours,
      autoSolveEnabled: settings?.autoSolveEnabled,
      autoSolveHours: settings?.autoSolveHours
    });

    if (!settings || !settings.autoCloseEnabled) {
      console.log('\n❌ Auto-close is disabled');
      return;
    }

    const hoursThreshold = settings.autoCloseHours;
    const cutoffDate = new Date();
    cutoffDate.setHours(cutoffDate.getHours() - hoursThreshold);

    console.log(`\nChecking for SOLVED tickets older than ${hoursThreshold} hours`);
    console.log(`Cutoff date: ${cutoffDate.toISOString()}\n`);

    // Find tickets that should be closed
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
        status: true,
        solvedAt: true,
        createdAt: true
      },
      orderBy: {
        solvedAt: 'asc'
      }
    });

    console.log(`Found ${ticketsToClose.length} tickets eligible for auto-close:\n`);

    if (ticketsToClose.length > 0) {
      ticketsToClose.forEach(ticket => {
        const hoursSinceSolved = ticket.solvedAt
          ? Math.floor((Date.now() - new Date(ticket.solvedAt).getTime()) / (1000 * 60 * 60))
          : 0;
        console.log(`  Ticket #${ticket.ticketNumber}:`);
        console.log(`    Subject: ${ticket.subject}`);
        console.log(`    Solved at: ${ticket.solvedAt?.toISOString()}`);
        console.log(`    Hours since solved: ${hoursSinceSolved}`);
        console.log('');
      });

      console.log('\n✅ Automation would close these tickets on next run');
    } else {
      console.log('  (none)');
      console.log('\n❌ No tickets to close');
    }

    // Also check current SOLVED tickets with solvedAt
    console.log('\n--- All SOLVED Tickets Status ---');
    const allSolvedTickets = await prisma.ticket.findMany({
      where: {
        status: 'SOLVED'
      },
      select: {
        ticketNumber: true,
        subject: true,
        solvedAt: true
      },
      orderBy: {
        ticketNumber: 'asc'
      }
    });

    console.log(`Total SOLVED tickets: ${allSolvedTickets.length}`);
    allSolvedTickets.forEach(ticket => {
      console.log(`  #${ticket.ticketNumber}: solvedAt = ${ticket.solvedAt?.toISOString() || 'NULL'}`);
    });

  } catch (error) {
    console.error('Error during test:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

testAutomation();
