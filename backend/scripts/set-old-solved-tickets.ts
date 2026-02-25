import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function setOldSolvedTickets() {
  console.log('Setting some solved tickets to be older than 48 hours...\n');

  try {
    // Get all solved tickets
    const solvedTickets = await prisma.ticket.findMany({
      where: { status: 'SOLVED' },
      take: 10 // Update first 10 solved tickets
    });

    if (solvedTickets.length === 0) {
      console.log('No solved tickets found.');
      return;
    }

    console.log(`Found ${solvedTickets.length} solved tickets. Updating solvedAt timestamps...\n`);

    let updated = 0;

    for (const ticket of solvedTickets) {
      // Set solvedAt to 72 hours ago (3 days)
      const threeDaysAgo = new Date();
      threeDaysAgo.setHours(threeDaysAgo.getHours() - 72);

      await prisma.ticket.update({
        where: { id: ticket.id },
        data: {
          solvedAt: threeDaysAgo
        }
      });

      updated++;
      console.log(`✓ Updated ticket #${ticket.ticketNumber} - solved 72 hours ago`);
    }

    console.log(`\n✅ Successfully updated ${updated} tickets to be solved 72 hours ago`);
    console.log('These tickets should now show as closed (no reply option for users)');

  } catch (error) {
    console.error('❌ Error updating tickets:', error);
  } finally {
    await prisma.$disconnect();
  }
}

setOldSolvedTickets();
