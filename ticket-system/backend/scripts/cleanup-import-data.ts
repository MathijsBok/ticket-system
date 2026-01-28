import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanupImportData() {
  console.log('Starting cleanup of imported data...\n');

  try {
    // Delete in order of dependencies

    // 1. Delete FormResponses
    const formResponses = await prisma.formResponse.deleteMany({});
    console.log(`Deleted ${formResponses.count} form responses`);

    // 2. Delete TicketActivity
    const activities = await prisma.ticketActivity.deleteMany({});
    console.log(`Deleted ${activities.count} ticket activities`);

    // 3. Delete TicketTimeEntry
    const timeEntries = await prisma.ticketTimeEntry.deleteMany({});
    console.log(`Deleted ${timeEntries.count} time entries`);

    // 4. Delete Attachments
    const attachments = await prisma.attachment.deleteMany({});
    console.log(`Deleted ${attachments.count} attachments`);

    // 5. Delete Comments
    const comments = await prisma.comment.deleteMany({});
    console.log(`Deleted ${comments.count} comments`);

    // 6. Delete Tickets
    const tickets = await prisma.ticket.deleteMany({});
    console.log(`Deleted ${tickets.count} tickets`);

    // 7. Delete AgentSessions for USER role users
    const userIds = await prisma.user.findMany({
      where: { role: 'USER' },
      select: { id: true }
    });
    const userIdList = userIds.map(u => u.id);

    if (userIdList.length > 0) {
      const sessions = await prisma.agentSession.deleteMany({
        where: { agentId: { in: userIdList } }
      });
      console.log(`Deleted ${sessions.count} agent sessions`);
    }

    // 8. Delete Users with USER role
    const users = await prisma.user.deleteMany({
      where: { role: 'USER' }
    });
    console.log(`Deleted ${users.count} users (USER role)`);

    // 9. Delete Zendesk-imported FormFieldLibrary entries
    const fields = await prisma.formFieldLibrary.deleteMany({
      where: { label: { startsWith: 'Zendesk Field' } }
    });
    console.log(`Deleted ${fields.count} Zendesk form fields`);

    console.log('\n=== Cleanup Complete ===');

  } catch (error) {
    console.error('Cleanup failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

cleanupImportData();
