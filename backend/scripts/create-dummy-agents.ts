import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function createDummyAgents() {
  console.log('Starting dummy agent creation...\n');

  try {
    // Agent data
    const agents = [
      {
        clerkId: `clerk_agent_1_${Date.now()}`,
        email: 'sarah.johnson@kleversupport.io',
        firstName: 'Sarah',
        lastName: 'Johnson',
        role: 'AGENT'
      },
      {
        clerkId: `clerk_agent_2_${Date.now()}`,
        email: 'mike.rodriguez@kleversupport.io',
        firstName: 'Mike',
        lastName: 'Rodriguez',
        role: 'AGENT'
      },
      {
        clerkId: `clerk_agent_3_${Date.now()}`,
        email: 'emma.chen@kleversupport.io',
        firstName: 'Emma',
        lastName: 'Chen',
        role: 'AGENT'
      },
      {
        clerkId: `clerk_agent_4_${Date.now()}`,
        email: 'david.kumar@kleversupport.io',
        firstName: 'David',
        lastName: 'Kumar',
        role: 'AGENT'
      },
      {
        clerkId: `clerk_agent_5_${Date.now()}`,
        email: 'lisa.martinez@kleversupport.io',
        firstName: 'Lisa',
        lastName: 'Martinez',
        role: 'AGENT'
      }
    ];

    // Create agents
    const createdAgents = [];
    for (const agentData of agents) {
      const agent = await prisma.user.create({
        data: agentData as any
      });
      createdAgents.push(agent);
      console.log(`✓ Created agent: ${agent.firstName} ${agent.lastName} (${agent.email})`);
    }

    console.log(`\n✅ Successfully created ${createdAgents.length} agents\n`);

    // Get all tickets
    const tickets = await prisma.ticket.findMany({
      select: { id: true, ticketNumber: true, subject: true, status: true }
    });

    if (tickets.length === 0) {
      console.log('No tickets found to assign agents to.');
      return;
    }

    console.log(`Found ${tickets.length} tickets. Assigning agents...\n`);

    // Assign agents to tickets (distribute evenly)
    let assignedCount = 0;
    let solvedCount = 0;

    for (let i = 0; i < tickets.length; i++) {
      const ticket = tickets[i];

      // Assign about 70% of tickets to agents
      if (Math.random() > 0.3) {
        const randomAgent = createdAgents[i % createdAgents.length];

        // Mark some tickets as solved (about 60% of assigned tickets)
        const shouldSolve = Math.random() > 0.4;
        const newStatus = shouldSolve ? 'SOLVED' : ticket.status;
        const solvedAt = shouldSolve ? new Date() : null;

        await prisma.ticket.update({
          where: { id: ticket.id },
          data: {
            assigneeId: randomAgent.id,
            status: newStatus as any,
            solvedAt: solvedAt
          }
        });

        assignedCount++;
        if (shouldSolve) solvedCount++;

        if (assignedCount % 10 === 0) {
          console.log(`✓ Assigned ${assignedCount} tickets...`);
        }
      }
    }

    console.log(`\n✅ Successfully assigned ${assignedCount} tickets to agents`);
    console.log(`📊 Marked ${solvedCount} tickets as solved\n`);

    // Show agent assignment summary
    console.log('📋 Agent Assignment Summary:');
    for (const agent of createdAgents) {
      const assignedTickets = await prisma.ticket.count({
        where: { assigneeId: agent.id }
      });
      const solvedTickets = await prisma.ticket.count({
        where: { assigneeId: agent.id, status: 'SOLVED' }
      });
      const solveRate = assignedTickets > 0 ? ((solvedTickets / assignedTickets) * 100).toFixed(1) : '0.0';

      console.log(`   ${agent.firstName} ${agent.lastName}: ${assignedTickets} assigned, ${solvedTickets} solved (${solveRate}% solve rate)`);
    }

  } catch (error) {
    console.error('❌ Error creating dummy agents:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createDummyAgents();
