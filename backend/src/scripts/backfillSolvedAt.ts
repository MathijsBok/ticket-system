/**
 * Backfill script to set solvedAt timestamps for tickets that are SOLVED but don't have a timestamp
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function backfillSolvedAt() {
  try {
    console.log('Starting backfill of solvedAt timestamps...\n');

    // Find SOLVED tickets without solvedAt
    const solvedTickets = await prisma.ticket.findMany({
      where: {
        status: 'SOLVED',
        solvedAt: null
      },
      select: {
        id: true,
        ticketNumber: true,
        updatedAt: true,
        createdAt: true
      }
    });

    console.log(`Found ${solvedTickets.length} SOLVED tickets without solvedAt timestamp`);

    if (solvedTickets.length === 0) {
      console.log('No tickets to backfill. All done!');
      return;
    }

    // Update each ticket with solvedAt = updatedAt (most recent update)
    let updated = 0;
    for (const ticket of solvedTickets) {
      await prisma.ticket.update({
        where: { id: ticket.id },
        data: {
          solvedAt: ticket.updatedAt // Use updatedAt as a reasonable approximation
        }
      });
      console.log(`  ✓ Ticket #${ticket.ticketNumber}: Set solvedAt to ${ticket.updatedAt.toISOString()}`);
      updated++;
    }

    console.log(`\n✅ Successfully backfilled ${updated} tickets`);
    console.log('\nNow checking if any should be auto-closed based on settings...');

    // Check settings
    const settings = await prisma.settings.findFirst();
    if (!settings || !settings.autoCloseEnabled) {
      console.log('Auto-close is disabled in settings');
      return;
    }

    const cutoff = new Date();
    cutoff.setHours(cutoff.getHours() - settings.autoCloseHours);
    console.log(`Auto-close threshold: ${settings.autoCloseHours} hours (cutoff: ${cutoff.toISOString()})`);

    const toClose = solvedTickets.filter(t => new Date(t.updatedAt) <= cutoff);
    console.log(`\nTickets that should be closed: ${toClose.length}`);

    if (toClose.length > 0) {
      console.log('\nRun the ticket automation job to close these tickets automatically.');
    }

  } catch (error) {
    console.error('Error during backfill:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

backfillSolvedAt();
