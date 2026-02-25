import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function createAgentComments() {
  console.log('Starting agent comment creation...\n');

  try {
    // Get all agents
    const agents = await prisma.user.findMany({
      where: { role: 'AGENT' }
    });

    if (agents.length === 0) {
      console.log('No agents found.');
      return;
    }

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

    console.log(`Found ${agents.length} agents and ${tickets.length} assigned tickets.\n`);

    const agentResponses = [
      "Thank you for contacting support. I'm looking into this issue now.",
      "I've reviewed your request and I'm working on a solution.",
      "Could you please provide more details about when this issue started?",
      "I've escalated this to our technical team for further investigation.",
      "This issue has been resolved. Please let me know if you need anything else.",
      "I've updated your account settings as requested.",
      "The issue was caused by a temporary service disruption. Everything should be working now.",
      "I've sent you a follow-up email with the requested information.",
      "Thank you for your patience. The problem has been fixed.",
      "I'm currently testing a fix for this issue. I'll update you shortly.",
      "This is a known issue that our team is working on. I'll keep you informed.",
      "I've processed your request. You should see the changes reflected shortly.",
      "Please try clearing your cache and cookies, then let me know if the issue persists.",
      "I've checked the logs and identified the root cause. Working on a fix now.",
      "Your issue has been resolved. Is there anything else I can help you with?"
    ];

    let totalComments = 0;
    const commentsByAgent = new Map<string, number>();

    // Initialize counter for each agent
    agents.forEach(agent => commentsByAgent.set(agent.id, 0));

    // Add 1-4 comments from the assigned agent to each ticket
    for (const ticket of tickets) {
      if (!ticket.assignee) continue;

      const numComments = Math.floor(Math.random() * 4) + 1;

      for (let i = 0; i < numComments; i++) {
        const randomResponse = agentResponses[Math.floor(Math.random() * agentResponses.length)];

        // Comment date should be after ticket creation
        const commentDate = new Date(ticket.createdAt);
        commentDate.setHours(commentDate.getHours() + Math.floor(Math.random() * 48) + 1);

        await prisma.comment.create({
          data: {
            ticketId: ticket.id,
            authorId: ticket.assignee.id,
            body: randomResponse,
            bodyPlain: randomResponse,
            channel: 'WEB',
            isInternal: false,
            isSystem: false,
            createdAt: commentDate
          }
        });

        totalComments++;
        commentsByAgent.set(ticket.assignee.id, (commentsByAgent.get(ticket.assignee.id) || 0) + 1);
      }

      if (totalComments % 20 === 0) {
        console.log(`✓ Created ${totalComments} comments...`);
      }
    }

    console.log(`\n✅ Successfully created ${totalComments} agent comments\n`);

    // Show comment summary for each agent
    console.log('📋 Agent Comment Summary:');
    for (const agent of agents) {
      const commentCount = commentsByAgent.get(agent.id) || 0;
      console.log(`   ${agent.firstName} ${agent.lastName}: ${commentCount} replies`);
    }

  } catch (error) {
    console.error('❌ Error creating agent comments:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createAgentComments();
