/**
 * Check the status of Ticket #14 specifically
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkTicket() {
  try {
    // Find ticket #14
    const ticket14 = await prisma.ticket.findFirst({
      where: {
        ticketNumber: 14
      },
      select: {
        id: true,
        ticketNumber: true,
        subject: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        solvedAt: true,
        closedAt: true
      }
    });

    console.log('Ticket #14 Status:');
    console.log(JSON.stringify(ticket14, null, 2));

    // Also check all CLOSED tickets
    console.log('\n--- All CLOSED Tickets ---');
    const closedTickets = await prisma.ticket.findMany({
      where: {
        status: 'CLOSED'
      },
      select: {
        ticketNumber: true,
        subject: true,
        solvedAt: true,
        closedAt: true
      },
      orderBy: {
        ticketNumber: 'asc'
      }
    });

    console.log(`Total CLOSED tickets: ${closedTickets.length}`);
    if (closedTickets.length > 0) {
      closedTickets.forEach(ticket => {
        console.log(`  #${ticket.ticketNumber}: ${ticket.subject}`);
        console.log(`    Solved: ${ticket.solvedAt?.toISOString() || 'N/A'}`);
        console.log(`    Closed: ${ticket.closedAt?.toISOString() || 'N/A'}`);
      });
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkTicket();
