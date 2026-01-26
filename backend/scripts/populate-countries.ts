import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Sample countries for testing
const countries = [
  'United States', 'Netherlands', 'Germany', 'United Kingdom', 'France',
  'Spain', 'Italy', 'Canada', 'Australia', 'Brazil',
  'India', 'Japan', 'South Korea', 'Mexico', 'Argentina'
];

async function populateCountries() {
  console.log('Populating country data for existing tickets...\n');

  const tickets = await prisma.ticket.findMany({
    where: { country: null }
  });

  console.log(`Found ${tickets.length} tickets without country data\n`);

  for (const ticket of tickets) {
    // Randomly assign a country (weighted towards top countries)
    const random = Math.random();
    let country: string;

    if (random < 0.3) country = 'United States';
    else if (random < 0.5) country = 'Netherlands';
    else if (random < 0.65) country = 'Germany';
    else if (random < 0.75) country = 'United Kingdom';
    else country = countries[Math.floor(Math.random() * countries.length)];

    await prisma.ticket.update({
      where: { id: ticket.id },
      data: {
        country,
        ipAddress: `${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`
      }
    });

    console.log(`✓ Ticket #${ticket.ticketNumber}: ${country}`);
  }

  console.log(`\n✅ Updated ${tickets.length} tickets with country data`);
}

populateCountries()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
