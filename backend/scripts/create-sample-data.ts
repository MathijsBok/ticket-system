import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const countries = [
  'United States', 'Netherlands', 'Germany', 'United Kingdom', 'France',
  'Spain', 'Italy', 'Canada', 'Australia', 'Brazil',
  'India', 'Japan', 'South Korea', 'Mexico', 'Argentina'
];

const statuses = ['NEW', 'OPEN', 'PENDING', 'ON_HOLD', 'SOLVED'];
const priorities = ['LOW', 'NORMAL', 'HIGH', 'URGENT'];
const channels = ['WEB', 'EMAIL', 'API'];

async function createSampleData() {
  console.log('Creating sample data...\n');

  // Get or create a user
  const users = await prisma.user.findMany({ take: 1 });
  if (users.length === 0) {
    console.error('No users found. Please create a user first.');
    return;
  }

  const user = users[0];
  console.log(`Using user: ${user.email}\n`);

  // Get forms
  const forms = await prisma.form.findMany();
  console.log(`Found ${forms.length} forms\n`);

  // Create 50 sample tickets
  for (let i = 0; i < 50; i++) {
    // Random selections
    const random = Math.random();
    let country: string;
    if (random < 0.25) country = 'United States';
    else if (random < 0.45) country = 'Netherlands';
    else if (random < 0.6) country = 'Germany';
    else if (random < 0.7) country = 'United Kingdom';
    else country = countries[Math.floor(Math.random() * countries.length)];

    const status = statuses[Math.floor(Math.random() * statuses.length)] as 'NEW' | 'OPEN' | 'PENDING' | 'ON_HOLD' | 'SOLVED';
    const priority = priorities[Math.floor(Math.random() * priorities.length)] as 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
    const channel = channels[Math.floor(Math.random() * channels.length)] as 'WEB' | 'EMAIL' | 'API';
    const formId = forms.length > 0 && Math.random() > 0.3 ? forms[Math.floor(Math.random() * forms.length)].id : null;

    // Random date in last 30 days
    const daysAgo = Math.floor(Math.random() * 30);
    const createdAt = new Date();
    createdAt.setDate(createdAt.getDate() - daysAgo);

    const ticket = await prisma.ticket.create({
      data: {
        subject: `Sample Ticket ${i + 1}: Issue with ${['Wallet', 'Exchange', 'Browser', 'Portfolio', 'Staking'][Math.floor(Math.random() * 5)]}`,
        status,
        priority,
        channel,
        country,
        ipAddress: `${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
        requesterId: user.id,
        formId,
        createdAt,
        updatedAt: createdAt,
        comments: {
          create: {
            authorId: user.id,
            body: `This is a sample ticket description for testing purposes. Ticket number ${i + 1}.`,
            bodyPlain: `This is a sample ticket description for testing purposes. Ticket number ${i + 1}.`,
            channel: 'WEB',
            isSystem: false,
            createdAt
          }
        },
        activities: {
          create: {
            userId: user.id,
            action: 'ticket_created',
            details: { subject: `Sample Ticket ${i + 1}`, channel },
            createdAt
          }
        }
      }
    });

    console.log(`✓ Created ticket #${ticket.ticketNumber} - ${country} - ${status}`);
  }

  console.log(`\n✅ Created 50 sample tickets`);
}

createSampleData()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
