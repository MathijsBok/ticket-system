import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Country to timezone mapping (same as geolocation.ts)
const countryToTimezone: Record<string, string> = {
  'Afghanistan': 'GMT+4.5',
  'Albania': 'GMT+1',
  'Algeria': 'GMT+1',
  'Argentina': 'GMT-3',
  'Australia': 'GMT+10',
  'Austria': 'GMT+1',
  'Bangladesh': 'GMT+6',
  'Belgium': 'GMT+1',
  'Brazil': 'GMT-3',
  'Bulgaria': 'GMT+2',
  'Canada': 'GMT-5',
  'Chile': 'GMT-3',
  'China': 'GMT+8',
  'Colombia': 'GMT-5',
  'Croatia': 'GMT+1',
  'Czech Republic': 'GMT+1',
  'Czechia': 'GMT+1',
  'Denmark': 'GMT+1',
  'Egypt': 'GMT+2',
  'Estonia': 'GMT+2',
  'Finland': 'GMT+2',
  'France': 'GMT+1',
  'Germany': 'GMT+1',
  'Greece': 'GMT+2',
  'Hong Kong': 'GMT+8',
  'Hungary': 'GMT+1',
  'India': 'GMT+5.5',
  'Indonesia': 'GMT+7',
  'Iran': 'GMT+3.5',
  'Iraq': 'GMT+3',
  'Ireland': 'GMT+0',
  'Israel': 'GMT+2',
  'Italy': 'GMT+1',
  'Japan': 'GMT+9',
  'Kenya': 'GMT+3',
  'Latvia': 'GMT+2',
  'Lithuania': 'GMT+2',
  'Malaysia': 'GMT+8',
  'Mexico': 'GMT-6',
  'Morocco': 'GMT+1',
  'Nepal': 'GMT+5.75',
  'Netherlands': 'GMT+1',
  'The Netherlands': 'GMT+1',
  'New Zealand': 'GMT+12',
  'Nigeria': 'GMT+1',
  'Norway': 'GMT+1',
  'Pakistan': 'GMT+5',
  'Peru': 'GMT-5',
  'Philippines': 'GMT+8',
  'Poland': 'GMT+1',
  'Portugal': 'GMT+0',
  'Romania': 'GMT+2',
  'Russia': 'GMT+3',
  'Saudi Arabia': 'GMT+3',
  'Serbia': 'GMT+1',
  'Singapore': 'GMT+8',
  'Slovakia': 'GMT+1',
  'Slovenia': 'GMT+1',
  'South Africa': 'GMT+2',
  'South Korea': 'GMT+9',
  'Spain': 'GMT+1',
  'Sweden': 'GMT+1',
  'Switzerland': 'GMT+1',
  'Taiwan': 'GMT+8',
  'Thailand': 'GMT+7',
  'Turkey': 'GMT+3',
  'Ukraine': 'GMT+2',
  'United Arab Emirates': 'GMT+4',
  'United Kingdom': 'GMT+0',
  'United States': 'GMT-5',
  'Venezuela': 'GMT-4',
  'Vietnam': 'GMT+7'
};

// Timezone to country mapping (same as geolocation.ts)
const timezoneToCountry: Record<string, string> = {
  'GMT-12': 'United States',
  'GMT-11': 'United States',
  'GMT-10': 'United States',
  'GMT-9': 'United States',
  'GMT-8': 'United States',
  'GMT-7': 'United States',
  'GMT-6': 'Mexico',
  'GMT-5': 'United States',
  'GMT-4': 'Venezuela',
  'GMT-3': 'Brazil',
  'GMT-2': 'Brazil',
  'GMT-1': 'Portugal',
  'GMT+0': 'United Kingdom',
  'GMT+1': 'Germany',
  'GMT+2': 'South Africa',
  'GMT+3': 'Russia',
  'GMT+3.5': 'Iran',
  'GMT+4': 'United Arab Emirates',
  'GMT+4.5': 'Afghanistan',
  'GMT+5': 'Pakistan',
  'GMT+5.5': 'India',
  'GMT+5.75': 'Nepal',
  'GMT+6': 'Bangladesh',
  'GMT+7': 'Thailand',
  'GMT+8': 'China',
  'GMT+9': 'Japan',
  'GMT+10': 'Australia',
  'GMT+11': 'Australia',
  'GMT+12': 'New Zealand'
};

async function backfillUserLocation() {
  console.log('Backfilling user location data...\n');

  // 1. Users with country but no timezone
  const usersWithCountryNoTimezone = await prisma.user.findMany({
    where: {
      country: { not: null },
      timezoneOffset: null
    }
  });

  console.log(`Found ${usersWithCountryNoTimezone.length} users with country but no timezone\n`);

  let timezoneUpdates = 0;
  for (const user of usersWithCountryNoTimezone) {
    const timezone = countryToTimezone[user.country!];
    if (timezone) {
      await prisma.user.update({
        where: { id: user.id },
        data: { timezoneOffset: timezone }
      });
      console.log(`✓ ${user.email}: ${user.country} → ${timezone}`);
      timezoneUpdates++;
    } else {
      console.log(`⚠ ${user.email}: No timezone mapping for "${user.country}"`);
    }
  }

  // 2. Users with timezone but no country
  const usersWithTimezoneNoCountry = await prisma.user.findMany({
    where: {
      timezoneOffset: { not: null },
      country: null
    }
  });

  console.log(`\nFound ${usersWithTimezoneNoCountry.length} users with timezone but no country\n`);

  let countryUpdates = 0;
  for (const user of usersWithTimezoneNoCountry) {
    const country = timezoneToCountry[user.timezoneOffset!];
    if (country) {
      await prisma.user.update({
        where: { id: user.id },
        data: { country }
      });
      console.log(`✓ ${user.email}: ${user.timezoneOffset} → ${country}`);
      countryUpdates++;
    } else {
      console.log(`⚠ ${user.email}: No country mapping for "${user.timezoneOffset}"`);
    }
  }

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('Summary:');
  console.log(`  Timezones derived from country: ${timezoneUpdates}`);
  console.log(`  Countries derived from timezone: ${countryUpdates}`);
  console.log('='.repeat(50));
}

backfillUserLocation()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
