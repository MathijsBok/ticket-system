import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function createTimeEntries() {
  console.log('Starting time entry creation...\n');

  try {
    // Get all tickets assigned to agents
    const tickets = await prisma.ticket.findMany({
      where: {
        assigneeId: { not: null }
      },
      include: {
        assignee: true
      }
    });

    if (tickets.length === 0) {
      console.log('No assigned tickets found.');
      return;
    }

    console.log(`Found ${tickets.length} assigned tickets. Creating time entries...\n`);

    let totalEntries = 0;
    const timeByAgent = new Map<string, number>();

    for (const ticket of tickets) {
      if (!ticket.assignee) continue;

      // Create 1-3 time entries per ticket
      const numEntries = Math.floor(Math.random() * 3) + 1;

      for (let i = 0; i < numEntries; i++) {
        // Start time should be after ticket creation
        const startedAt = new Date(ticket.createdAt);
        startedAt.setHours(startedAt.getHours() + Math.floor(Math.random() * 48) + 1);

        // Duration between 15 minutes to 3 hours
        const durationSeconds = Math.floor(Math.random() * (3 * 3600 - 900)) + 900;

        const endedAt = new Date(startedAt);
        endedAt.setSeconds(endedAt.getSeconds() + durationSeconds);

        const descriptions = [
          'Investigated the reported issue',
          'Implemented fix and tested solution',
          'Researched documentation',
          'Communicated with customer',
          'Troubleshooting and diagnostics',
          'Applied configuration changes',
          'Reviewed logs and error messages',
          'Testing and verification',
          'Follow-up and monitoring'
        ];

        const description = descriptions[Math.floor(Math.random() * descriptions.length)];

        await prisma.ticketTimeEntry.create({
          data: {
            ticketId: ticket.id,
            agentId: ticket.assignee.id,
            startedAt: startedAt,
            endedAt: endedAt,
            duration: durationSeconds,
            description: description
          }
        });

        totalEntries++;
        const currentTime = timeByAgent.get(ticket.assignee.id) || 0;
        timeByAgent.set(ticket.assignee.id, currentTime + durationSeconds);
      }

      if (totalEntries % 20 === 0) {
        console.log(`✓ Created ${totalEntries} time entries...`);
      }
    }

    console.log(`\n✅ Successfully created ${totalEntries} time entries\n`);

    // Show summary for each agent
    const agents = await prisma.user.findMany({
      where: { role: 'AGENT' }
    });

    console.log('📋 Time Tracking Summary:');
    for (const agent of agents) {
      const totalSeconds = timeByAgent.get(agent.id) || 0;
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);

      const ticketCount = await prisma.ticket.count({
        where: { assigneeId: agent.id }
      });

      const avgSeconds = ticketCount > 0 ? totalSeconds / ticketCount : 0;
      const avgHours = Math.floor(avgSeconds / 3600);
      const avgMinutes = Math.floor((avgSeconds % 3600) / 60);

      console.log(`   ${agent.firstName} ${agent.lastName}: ${hours}h ${minutes}m total (avg ${avgHours}h ${avgMinutes}m per ticket)`);
    }

  } catch (error) {
    console.error('❌ Error creating time entries:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createTimeEntries();
