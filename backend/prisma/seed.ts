import { PrismaClient, UserRole, TicketStatus, TicketPriority, TicketChannel, CommentChannel } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seed...');

  // Clear existing data
  console.log('🗑️  Clearing existing data...');
  await prisma.ticketTimeEntry.deleteMany();
  await prisma.ticketActivity.deleteMany();
  await prisma.agentSession.deleteMany();
  await prisma.attachment.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.ticket.deleteMany();
  await prisma.form.deleteMany();
  await prisma.category.deleteMany();
  await prisma.user.deleteMany();
  await prisma.organization.deleteMany();

  // Create organization
  console.log('🏢 Creating organization...');
  const organization = await prisma.organization.create({
    data: {
      name: 'K5 Wallet Support'
    }
  });

  // Create admin users
  console.log('👤 Creating admin users...');
  const admin = await prisma.user.create({
    data: {
      clerkId: 'clerk_admin_001',
      email: 'admin@k5wallet.com',
      firstName: 'Admin',
      lastName: 'User',
      role: UserRole.ADMIN,
      organizationId: organization.id
    }
  });

  // Create agent users (assignees from the screenshot)
  console.log('👥 Creating agent users...');
  const agents = await Promise.all([
    prisma.user.create({
      data: {
        clerkId: 'clerk_agent_001',
        email: 'harish.kumar@k5wallet.com',
        firstName: 'Harish',
        lastName: 'Kumar',
        role: UserRole.AGENT,
        organizationId: organization.id
      }
    }),
    prisma.user.create({
      data: {
        clerkId: 'clerk_agent_002',
        email: 'mario@k5wallet.com',
        firstName: 'Mario',
        lastName: 'Rossi',
        role: UserRole.AGENT,
        organizationId: organization.id
      }
    }),
    prisma.user.create({
      data: {
        clerkId: 'clerk_agent_003',
        email: 'jose.luis@k5wallet.com',
        firstName: 'Jose',
        lastName: 'Luis',
        role: UserRole.AGENT,
        organizationId: organization.id
      }
    }),
    prisma.user.create({
      data: {
        clerkId: 'clerk_agent_004',
        email: 'alen.pirnat@k5wallet.com',
        firstName: 'Alen',
        lastName: 'Pirnat',
        role: UserRole.AGENT,
        organizationId: organization.id
      }
    }),
    prisma.user.create({
      data: {
        clerkId: 'clerk_agent_005',
        email: 'sarah.johnson@k5wallet.com',
        firstName: 'Sarah',
        lastName: 'Johnson',
        role: UserRole.AGENT,
        organizationId: organization.id
      }
    })
  ]);

  // Create regular users (requesters)
  console.log('👤 Creating customer users...');
  const customers = await Promise.all([
    prisma.user.create({
      data: {
        clerkId: 'clerk_user_001',
        email: 'eline336@example.com',
        firstName: 'Eline',
        lastName: 'Anderson',
        role: UserRole.USER,
        organizationId: organization.id
      }
    }),
    prisma.user.create({
      data: {
        clerkId: 'clerk_user_002',
        email: 'juancho.ludoviko@example.com',
        firstName: 'Juancho',
        lastName: 'Ludoviko',
        role: UserRole.USER,
        organizationId: organization.id
      }
    }),
    prisma.user.create({
      data: {
        clerkId: 'clerk_user_003',
        email: 'zodiac.media@example.com',
        firstName: 'Zodiac',
        lastName: 'Media LLC',
        role: UserRole.USER,
        organizationId: organization.id
      }
    }),
    prisma.user.create({
      data: {
        clerkId: 'clerk_user_004',
        email: 'north.services@example.com',
        firstName: 'North',
        lastName: 'Services LLC',
        role: UserRole.USER,
        organizationId: organization.id
      }
    }),
    prisma.user.create({
      data: {
        clerkId: 'clerk_user_005',
        email: 'doris.becerra@example.com',
        firstName: 'Doris',
        lastName: 'Becerra',
        role: UserRole.USER,
        organizationId: organization.id
      }
    }),
    prisma.user.create({
      data: {
        clerkId: 'clerk_user_006',
        email: 'tony.tiwari@example.com',
        firstName: 'Tony',
        lastName: 'Tiwari',
        role: UserRole.USER,
        organizationId: organization.id
      }
    }),
    prisma.user.create({
      data: {
        clerkId: 'clerk_user_007',
        email: 'yasmine.dean@example.com',
        firstName: 'Yasmine',
        lastName: 'Dean',
        role: UserRole.USER,
        organizationId: organization.id
      }
    }),
    prisma.user.create({
      data: {
        clerkId: 'clerk_user_008',
        email: 'evgenii@example.com',
        firstName: 'Evgenii',
        lastName: 'Petrov',
        role: UserRole.USER,
        organizationId: organization.id
      }
    }),
    prisma.user.create({
      data: {
        clerkId: 'clerk_user_009',
        email: 'moses.kim@example.com',
        firstName: 'Moses',
        lastName: 'Kim',
        role: UserRole.USER,
        organizationId: organization.id
      }
    }),
    prisma.user.create({
      data: {
        clerkId: 'clerk_user_010',
        email: 'andrew.small@example.com',
        firstName: 'Andrew',
        lastName: 'Small',
        role: UserRole.USER,
        organizationId: organization.id
      }
    }),
    prisma.user.create({
      data: {
        clerkId: 'clerk_user_011',
        email: 'paul.clark@example.com',
        firstName: 'Paul',
        lastName: 'Clark',
        role: UserRole.USER,
        organizationId: organization.id
      }
    }),
    prisma.user.create({
      data: {
        clerkId: 'clerk_user_012',
        email: 'loonloon0320@example.com',
        firstName: 'Loon',
        lastName: 'Lee',
        role: UserRole.USER,
        organizationId: organization.id
      }
    }),
    prisma.user.create({
      data: {
        clerkId: 'clerk_user_013',
        email: 'beverly.johnson@example.com',
        firstName: 'Beverly',
        lastName: 'Johnson',
        role: UserRole.USER,
        organizationId: organization.id
      }
    }),
    prisma.user.create({
      data: {
        clerkId: 'clerk_user_014',
        email: 'fhe@example.com',
        firstName: 'Fhe',
        lastName: 'Wong',
        role: UserRole.USER,
        organizationId: organization.id
      }
    }),
    prisma.user.create({
      data: {
        clerkId: 'clerk_user_015',
        email: 'ojifunmi@example.com',
        firstName: 'Ojifunmi',
        lastName: 'Adeola',
        role: UserRole.USER,
        organizationId: organization.id
      }
    }),
    prisma.user.create({
      data: {
        clerkId: 'clerk_user_016',
        email: 'office@example.com',
        firstName: 'Office',
        lastName: 'Manager',
        role: UserRole.USER,
        organizationId: organization.id
      }
    }),
    prisma.user.create({
      data: {
        clerkId: 'clerk_user_017',
        email: 'kaktusic@example.com',
        firstName: 'Kaktusic',
        lastName: 'Marko',
        role: UserRole.USER,
        organizationId: organization.id
      }
    }),
    prisma.user.create({
      data: {
        clerkId: 'clerk_user_018',
        email: 'jennifer.martinez@example.com',
        firstName: 'Jennifer',
        lastName: 'Martinez',
        role: UserRole.USER,
        organizationId: organization.id
      }
    }),
    prisma.user.create({
      data: {
        clerkId: 'clerk_user_019',
        email: 'robert.chen@example.com',
        firstName: 'Robert',
        lastName: 'Chen',
        role: UserRole.USER,
        organizationId: organization.id
      }
    }),
    prisma.user.create({
      data: {
        clerkId: 'clerk_user_020',
        email: 'maria.garcia@example.com',
        firstName: 'Maria',
        lastName: 'Garcia',
        role: UserRole.USER,
        organizationId: organization.id
      }
    })
  ]);

  // Create categories
  console.log('📁 Creating categories...');
  const categories = await Promise.all([
    prisma.category.create({
      data: {
        name: 'Wallet Issues',
        description: 'Problems related to wallet functionality'
      }
    }),
    prisma.category.create({
      data: {
        name: 'Transactions',
        description: 'Send, receive, swap transactions'
      }
    }),
    prisma.category.create({
      data: {
        name: 'Security',
        description: 'Security and authentication issues'
      }
    }),
    prisma.category.create({
      data: {
        name: 'Account',
        description: 'Account management and settings'
      }
    }),
    prisma.category.create({
      data: {
        name: 'Technical',
        description: 'Technical bugs and errors'
      }
    })
  ]);

  // Create forms (matching Klever support forms)
  console.log('📝 Creating forms...');
  const forms = await Promise.all([
    // K5 Wallet Forms
    prisma.form.create({
      data: {
        name: 'K5 Wallet - Installation',
        description: 'Installation and setup issues',
        isActive: true,
        fields: []
      }
    }),
    prisma.form.create({
      data: {
        name: 'K5 Wallet - Portfolio',
        description: 'Portfolio view and tracking issues',
        isActive: true,
        fields: []
      }
    }),
    prisma.form.create({
      data: {
        name: 'K5 Wallet - Swap',
        description: 'Issues with swapping cryptocurrencies',
        isActive: true,
        fields: []
      }
    }),
    prisma.form.create({
      data: {
        name: 'K5 Wallet - Staking (dApp)',
        description: 'Staking and dApp related issues',
        isActive: true,
        fields: []
      }
    }),
    prisma.form.create({
      data: {
        name: 'K5 Wallet - Send / Receive',
        description: 'Issues with sending or receiving crypto',
        isActive: true,
        fields: []
      }
    }),
    prisma.form.create({
      data: {
        name: 'K5 Wallet - Browser',
        description: 'Browser integration issues',
        isActive: true,
        fields: []
      }
    }),
    prisma.form.create({
      data: {
        name: 'K5 Wallet - Buy Crypto',
        description: 'Issues purchasing cryptocurrency',
        isActive: true,
        fields: []
      }
    }),
    prisma.form.create({
      data: {
        name: 'K5 Wallet - Backup keys',
        description: 'Backup and key management issues',
        isActive: true,
        fields: []
      }
    }),
    prisma.form.create({
      data: {
        name: 'K5 Wallet - Other Questions',
        description: 'General questions about K5 Wallet',
        isActive: true,
        fields: []
      }
    }),
    // Extension Forms
    prisma.form.create({
      data: {
        name: 'Extension - Portfolio',
        description: 'Browser extension portfolio issues',
        isActive: true,
        fields: []
      }
    }),
    prisma.form.create({
      data: {
        name: 'Extension - Swap',
        description: 'Browser extension swap issues',
        isActive: true,
        fields: []
      }
    }),
    prisma.form.create({
      data: {
        name: 'Extension - Send / Receive',
        description: 'Browser extension send/receive issues',
        isActive: true,
        fields: []
      }
    }),
    prisma.form.create({
      data: {
        name: 'Extension - Other Questions',
        description: 'General browser extension questions',
        isActive: true,
        fields: []
      }
    }),
    // KleverSafe Forms
    prisma.form.create({
      data: {
        name: 'KleverSafe - General Questions',
        description: 'General questions about KleverSafe',
        isActive: true,
        fields: []
      }
    }),
    // Bitcoin.me Forms
    prisma.form.create({
      data: {
        name: 'Bitcoin.me - Google 2FA issue',
        description: 'Google 2FA authentication issues',
        isActive: true,
        fields: []
      }
    }),
    prisma.form.create({
      data: {
        name: 'Bitcoin.me - Register / Login',
        description: 'Registration and login issues',
        isActive: true,
        fields: []
      }
    }),
    prisma.form.create({
      data: {
        name: 'Bitcoin.me - Withdraw / Deposit',
        description: 'Withdrawal and deposit issues',
        isActive: true,
        fields: []
      }
    }),
    prisma.form.create({
      data: {
        name: 'Bitcoin.me - Other Questions',
        description: 'General Bitcoin.me questions',
        isActive: true,
        fields: []
      }
    }),
    // Partnership/Work Form
    prisma.form.create({
      data: {
        name: 'Partnership/Work',
        description: 'Partnership and work opportunities',
        isActive: true,
        fields: []
      }
    })
  ]);

  // Helper function to get random item from array
  const getRandomItem = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

  // Helper function to get random date within last 30 days
  const getRandomDate = (daysAgo: number) => {
    const date = new Date();
    date.setDate(date.getDate() - Math.floor(Math.random() * daysAgo));
    date.setHours(Math.floor(Math.random() * 24));
    date.setMinutes(Math.floor(Math.random() * 60));
    return date;
  };

  // Create tickets with various statuses and priorities
  console.log('🎫 Creating tickets...');

  const ticketSubjects = [
    'обмениваю валюты (ltx за USDT), пишет что нехватает на оплату...',
    'Me enviaron usdt a la cadena de aptos y no llego al monto',
    'Automated investing',
    'Connect app to vox and automation',
    'No me deja hacer swap las monedas de sun bloktopia y Btt',
    'Klever Wallet: Crypto,BTC,ETH',
    'Pin and biometrics not working',
    'not confirmed',
    'Los token están en cuentas diferentes,si puede ayudarme gracias',
    'Buy Crypto Issue',
    'Swap stuck',
    'Klever',
    'Withdraw',
    'I need help with withdrawal from my klever wallet',
    'Using imported wallet to send klv to main wallet',
    'Sent usdt from safepal to klever ethereuem',
    "Didn't receive the USDT",
    'Usdt',
    'Unable to swap TRX to USDT',
    'Missing funds after transfer',
    'Transaction pending for 24 hours',
    'Cannot connect to DApp',
    'Staking rewards not showing',
    'NFT not visible in wallet',
    'Gas fees too high',
    'Failed to import wallet from seed phrase',
    'Portfolio balance incorrect',
    'Unable to add custom token',
    'App crashes on startup',
    'QR code scanner not working',
    'Cannot change network',
    'Transaction history missing',
    'Fingerprint authentication failed',
    '2FA setup issues',
    'Recovery phrase backup problem',
    'Unable to update app',
    'Push notifications not working',
    'Dark mode display bug',
    'Exchange rate incorrect',
    'Fiat currency conversion error'
  ];

  const statuses: TicketStatus[] = [
    TicketStatus.NEW,
    TicketStatus.OPEN,
    TicketStatus.PENDING,
    TicketStatus.ON_HOLD,
    TicketStatus.SOLVED,
    TicketStatus.CLOSED
  ];

  const priorities: TicketPriority[] = [
    TicketPriority.LOW,
    TicketPriority.NORMAL,
    TicketPriority.HIGH,
    TicketPriority.URGENT
  ];

  const channels: TicketChannel[] = [
    TicketChannel.EMAIL,
    TicketChannel.WEB,
    TicketChannel.API,
    TicketChannel.SLACK
  ];

  const tickets = [];

  for (let i = 0; i < 40; i++) {
    const status = getRandomItem(statuses);
    const createdAt = getRandomDate(30);
    const updatedAt = new Date(createdAt.getTime() + Math.random() * 7 * 24 * 60 * 60 * 1000); // Up to 7 days after creation

    let solvedAt = null;
    let closedAt = null;
    let firstResponseAt = null;

    // Add realistic timestamps based on status
    if (status === TicketStatus.SOLVED || status === TicketStatus.CLOSED) {
      firstResponseAt = new Date(createdAt.getTime() + Math.random() * 2 * 60 * 60 * 1000); // Within 2 hours
      solvedAt = new Date(createdAt.getTime() + Math.random() * 5 * 24 * 60 * 60 * 1000); // Within 5 days
    }

    if (status === TicketStatus.CLOSED) {
      closedAt = new Date(solvedAt!.getTime() + Math.random() * 24 * 60 * 60 * 1000); // Within 24 hours after solved
    }

    if (status === TicketStatus.OPEN || status === TicketStatus.PENDING) {
      firstResponseAt = new Date(createdAt.getTime() + Math.random() * 4 * 60 * 60 * 1000); // Within 4 hours
    }

    const ticket = await prisma.ticket.create({
      data: {
        subject: getRandomItem(ticketSubjects),
        status,
        priority: getRandomItem(priorities),
        channel: getRandomItem(channels),
        requesterId: getRandomItem(customers).id,
        assigneeId: Math.random() > 0.2 ? getRandomItem(agents).id : null, // 80% assigned
        organizationId: organization.id,
        formId: getRandomItem(forms).id,
        categoryId: getRandomItem(categories).id,
        createdAt,
        updatedAt,
        firstResponseAt,
        solvedAt,
        closedAt
      }
    });

    tickets.push(ticket);
  }

  console.log(`✅ Created ${tickets.length} tickets`);

  // Create comments for some tickets
  console.log('💬 Creating comments...');

  const commentTexts = [
    'Thank you for contacting support. I will look into this issue right away.',
    'Could you please provide more details about when this issue started?',
    'I have escalated this to our technical team for further investigation.',
    'This issue has been resolved. Please check and let us know if you need any further assistance.',
    'We are currently working on a fix for this problem.',
    'Can you please try clearing your cache and attempting again?',
    'I understand this is frustrating. We are prioritizing this issue.',
    'This appears to be a known issue. A fix is scheduled for the next release.',
    'Please update to the latest version and try again.',
    'I have processed your request. The changes should reflect within 24 hours.'
  ];

  let commentCount = 0;
  for (const ticket of tickets.slice(0, 25)) { // Add comments to first 25 tickets
    const numComments = Math.floor(Math.random() * 4) + 1; // 1-4 comments per ticket

    for (let i = 0; i < numComments; i++) {
      const isAgentComment = i % 2 === 0; // Alternate between agent and customer
      const author = isAgentComment ? getRandomItem(agents) : customers.find(c => c.id === ticket.requesterId)!;
      const commentDate = new Date(ticket.createdAt.getTime() + (i + 1) * 2 * 60 * 60 * 1000); // 2 hours apart

      await prisma.comment.create({
        data: {
          ticketId: ticket.id,
          authorId: author.id,
          body: `<p>${getRandomItem(commentTexts)}</p>`,
          bodyPlain: getRandomItem(commentTexts),
          isInternal: isAgentComment && Math.random() > 0.7, // 30% internal notes from agents
          isSystem: false,
          channel: CommentChannel.WEB,
          createdAt: commentDate,
          updatedAt: commentDate
        }
      });

      commentCount++;
    }
  }

  console.log(`✅ Created ${commentCount} comments`);

  // Create time entries for some tickets
  console.log('⏱️  Creating time entries...');

  let timeEntryCount = 0;
  for (const ticket of tickets.filter(t => t.assigneeId)) {
    if (Math.random() > 0.5) { // 50% chance of having time entries
      const numEntries = Math.floor(Math.random() * 3) + 1; // 1-3 time entries

      for (let i = 0; i < numEntries; i++) {
        const startedAt = new Date(ticket.createdAt.getTime() + i * 24 * 60 * 60 * 1000);
        const duration = Math.floor(Math.random() * 3600) + 300; // 5 minutes to 1 hour
        const endedAt = new Date(startedAt.getTime() + duration * 1000);

        await prisma.ticketTimeEntry.create({
          data: {
            ticketId: ticket.id,
            agentId: ticket.assigneeId!,
            startedAt,
            endedAt,
            duration,
            description: `Worked on ${ticket.subject.substring(0, 50)}`,
            createdAt: startedAt,
            updatedAt: endedAt
          }
        });

        timeEntryCount++;
      }
    }
  }

  console.log(`✅ Created ${timeEntryCount} time entries`);

  // Create agent sessions
  console.log('🔐 Creating agent sessions...');

  let sessionCount = 0;
  for (const agent of agents) {
    const numSessions = Math.floor(Math.random() * 5) + 3; // 3-7 sessions per agent

    for (let i = 0; i < numSessions; i++) {
      const loginAt = getRandomDate(30);
      const duration = Math.floor(Math.random() * 28800) + 1800; // 30 minutes to 8 hours
      const logoutAt = new Date(loginAt.getTime() + duration * 1000);
      const replyCount = Math.floor(Math.random() * 20);

      await prisma.agentSession.create({
        data: {
          agentId: agent.id,
          loginAt,
          logoutAt,
          duration,
          replyCount,
          ipAddress: `192.168.1.${Math.floor(Math.random() * 255)}`,
          userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'
        }
      });

      sessionCount++;
    }
  }

  console.log(`✅ Created ${sessionCount} agent sessions`);

  // Create ticket activities
  console.log('📊 Creating ticket activities...');

  let activityCount = 0;
  for (const ticket of tickets) {
    // Status change activity
    await prisma.ticketActivity.create({
      data: {
        ticketId: ticket.id,
        userId: ticket.assigneeId || admin.id,
        action: 'status_changed',
        details: {
          oldStatus: 'NEW',
          newStatus: ticket.status
        },
        createdAt: ticket.updatedAt
      }
    });
    activityCount++;

    // Assignment activity if assigned
    if (ticket.assigneeId) {
      await prisma.ticketActivity.create({
        data: {
          ticketId: ticket.id,
          userId: admin.id,
          action: 'assigned',
          details: {
            assigneeId: ticket.assigneeId
          },
          createdAt: ticket.createdAt
        }
      });
      activityCount++;
    }
  }

  console.log(`✅ Created ${activityCount} ticket activities`);

  console.log('');
  console.log('🎉 Seed completed successfully!');
  console.log('');
  console.log('📊 Summary:');
  console.log(`  - 1 organization`);
  console.log(`  - 1 admin user`);
  console.log(`  - ${agents.length} agent users`);
  console.log(`  - ${customers.length} customer users`);
  console.log(`  - ${categories.length} categories`);
  console.log(`  - ${forms.length} forms`);
  console.log(`  - ${tickets.length} tickets`);
  console.log(`  - ${commentCount} comments`);
  console.log(`  - ${timeEntryCount} time entries`);
  console.log(`  - ${sessionCount} agent sessions`);
  console.log(`  - ${activityCount} ticket activities`);
  console.log('');
  console.log('📧 Login credentials:');
  console.log('  Admin: admin@k5wallet.com');
  console.log('  Agents:');
  console.log('    - harish.kumar@k5wallet.com');
  console.log('    - mario@k5wallet.com');
  console.log('    - jose.luis@k5wallet.com');
  console.log('    - alen.pirnat@k5wallet.com');
  console.log('    - sarah.johnson@k5wallet.com');
  console.log('');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:');
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
