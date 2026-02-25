import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function createAgentSessions() {
  console.log('Starting agent session creation...\n');

  try {
    // Get all agents
    const agents = await prisma.user.findMany({
      where: { role: 'AGENT' }
    });

    if (agents.length === 0) {
      console.log('No agents found.');
      return;
    }

    console.log(`Found ${agents.length} agents. Creating sessions...\n`);

    let totalSessions = 0;
    let totalReplies = 0;

    for (const agent of agents) {
      // Create 5-15 sessions per agent
      const sessionCount = Math.floor(Math.random() * 11) + 5;

      for (let i = 0; i < sessionCount; i++) {
        // Random date in the last 30 days
        const daysAgo = Math.floor(Math.random() * 30);
        const loginAt = new Date();
        loginAt.setDate(loginAt.getDate() - daysAgo);
        loginAt.setHours(Math.floor(Math.random() * 12) + 8); // 8 AM - 8 PM

        // Random session duration between 30 minutes to 6 hours
        const durationSeconds = Math.floor(Math.random() * (6 * 3600 - 1800)) + 1800;

        const logoutAt = new Date(loginAt);
        logoutAt.setSeconds(logoutAt.getSeconds() + durationSeconds);

        // Random replies between 5 and 50
        const replyCount = Math.floor(Math.random() * 46) + 5;

        await prisma.agentSession.create({
          data: {
            agentId: agent.id,
            loginAt: loginAt,
            logoutAt: logoutAt,
            duration: durationSeconds,
            ipAddress: `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
            replyCount: replyCount
          }
        });

        totalSessions++;
        totalReplies += replyCount;
      }

      console.log(`✓ Created ${sessionCount} sessions for ${agent.firstName} ${agent.lastName}`);
    }

    // Create one active session for a random agent (simulate someone being online)
    const randomAgent = agents[Math.floor(Math.random() * agents.length)];
    const activeLoginAt = new Date();
    activeLoginAt.setMinutes(activeLoginAt.getMinutes() - 45); // Logged in 45 minutes ago

    await prisma.agentSession.create({
      data: {
        agentId: randomAgent.id,
        loginAt: activeLoginAt,
        logoutAt: null, // Still logged in
        duration: null,
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
        replyCount: 12
      }
    });

    totalSessions++;
    totalReplies += 12;

    console.log(`\n✅ Created ${totalSessions} total sessions`);
    console.log(`📊 Total replies across all sessions: ${totalReplies}`);
    console.log(`🟢 ${randomAgent.firstName} ${randomAgent.lastName} is currently online\n`);

    // Show summary for each agent
    console.log('📋 Agent Session Summary:');
    for (const agent of agents) {
      const sessions = await prisma.agentSession.findMany({
        where: { agentId: agent.id }
      });

      const totalDuration = sessions
        .filter(s => s.duration !== null)
        .reduce((sum, s) => sum + (s.duration || 0), 0);

      const avgDuration = sessions.length > 0 ? totalDuration / sessions.length : 0;
      const totalRepliesForAgent = sessions.reduce((sum, s) => sum + s.replyCount, 0);
      const isOnline = sessions.some(s => s.logoutAt === null);

      const hours = Math.floor(avgDuration / 3600);
      const minutes = Math.floor((avgDuration % 3600) / 60);

      console.log(`   ${agent.firstName} ${agent.lastName}: ${sessions.length} sessions, ${totalRepliesForAgent} replies, avg ${hours}h ${minutes}m${isOnline ? ' 🟢 ONLINE' : ''}`);
    }

  } catch (error) {
    console.error('❌ Error creating agent sessions:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createAgentSessions();
