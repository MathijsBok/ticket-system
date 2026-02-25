/**
 * Clerk User Migration Script
 *
 * This script helps migrate users from Clerk development to production instance.
 *
 * Prerequisites:
 * - npm install @clerk/backend (if not already installed)
 *
 * Usage:
 * 1. Export users from development:
 *    CLERK_SECRET_KEY=sk_test_xxx npx ts-node scripts/clerk-migration.ts export
 *
 * 2. Import users to production:
 *    CLERK_SECRET_KEY=sk_live_xxx npx ts-node scripts/clerk-migration.ts import
 *
 * 3. Update database clerkId mappings after production import:
 *    DATABASE_URL=xxx npx ts-node scripts/clerk-migration.ts update-db
 */

import * as fs from 'fs';
import * as path from 'path';

const EXPORT_FILE = path.join(__dirname, 'clerk-users-export.json');
const MAPPING_FILE = path.join(__dirname, 'clerk-id-mapping.json');

interface ClerkUser {
  id: string;
  email_addresses: Array<{ email_address: string; id: string }>;
  first_name: string | null;
  last_name: string | null;
  created_at: number;
  updated_at: number;
  external_id: string | null;
  public_metadata: Record<string, unknown>;
  private_metadata: Record<string, unknown>;
}

interface ExportedUser {
  clerkId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  createdAt: string;
}

interface IdMapping {
  oldClerkId: string;
  newClerkId: string;
  email: string;
}

async function fetchClerkUsers(secretKey: string): Promise<ClerkUser[]> {
  const allUsers: ClerkUser[] = [];
  let offset = 0;
  const limit = 100;

  console.log('Fetching users from Clerk...');

  while (true) {
    const response = await fetch(
      `https://api.clerk.com/v1/users?limit=${limit}&offset=${offset}`,
      {
        headers: {
          'Authorization': `Bearer ${secretKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Clerk API error: ${response.status} ${response.statusText}`);
    }

    const users: ClerkUser[] = await response.json();

    if (users.length === 0) break;

    allUsers.push(...users);
    console.log(`  Fetched ${allUsers.length} users...`);

    if (users.length < limit) break;
    offset += limit;
  }

  return allUsers;
}

async function createClerkUser(secretKey: string, user: ExportedUser): Promise<string> {
  const response = await fetch('https://api.clerk.com/v1/users', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${secretKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email_address: [user.email],
      first_name: user.firstName,
      last_name: user.lastName,
      skip_password_requirement: true,
      skip_password_checks: true,
      // Users will need to use "Forgot Password" or magic link to set password
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create user ${user.email}: ${error}`);
  }

  const newUser: ClerkUser = await response.json();
  return newUser.id;
}

async function exportUsers() {
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) {
    console.error('Error: CLERK_SECRET_KEY environment variable is required');
    console.error('Usage: CLERK_SECRET_KEY=sk_test_xxx npx ts-node scripts/clerk-migration.ts export');
    process.exit(1);
  }

  if (!secretKey.startsWith('sk_test_')) {
    console.warn('Warning: Secret key does not start with sk_test_. Make sure you are exporting from development!');
  }

  try {
    const clerkUsers = await fetchClerkUsers(secretKey);

    const exportedUsers: ExportedUser[] = clerkUsers.map(user => ({
      clerkId: user.id,
      email: user.email_addresses[0]?.email_address || '',
      firstName: user.first_name,
      lastName: user.last_name,
      createdAt: new Date(user.created_at).toISOString(),
    }));

    fs.writeFileSync(EXPORT_FILE, JSON.stringify(exportedUsers, null, 2));

    console.log(`\nExported ${exportedUsers.length} users to ${EXPORT_FILE}`);
    console.log('\nNext steps:');
    console.log('1. Review the exported file');
    console.log('2. Run import with production key:');
    console.log('   CLERK_SECRET_KEY=sk_live_xxx npx ts-node scripts/clerk-migration.ts import');
  } catch (error) {
    console.error('Export failed:', error);
    process.exit(1);
  }
}

async function importUsers() {
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) {
    console.error('Error: CLERK_SECRET_KEY environment variable is required');
    console.error('Usage: CLERK_SECRET_KEY=sk_live_xxx npx ts-node scripts/clerk-migration.ts import');
    process.exit(1);
  }

  if (!secretKey.startsWith('sk_live_')) {
    console.warn('Warning: Secret key does not start with sk_live_. Make sure you are importing to production!');
  }

  if (!fs.existsSync(EXPORT_FILE)) {
    console.error(`Error: Export file not found: ${EXPORT_FILE}`);
    console.error('Run export first: CLERK_SECRET_KEY=sk_test_xxx npx ts-node scripts/clerk-migration.ts export');
    process.exit(1);
  }

  try {
    const exportedUsers: ExportedUser[] = JSON.parse(fs.readFileSync(EXPORT_FILE, 'utf-8'));
    const mappings: IdMapping[] = [];
    let successCount = 0;
    let errorCount = 0;

    console.log(`Importing ${exportedUsers.length} users to production Clerk...`);

    for (const user of exportedUsers) {
      try {
        const newClerkId = await createClerkUser(secretKey, user);
        mappings.push({
          oldClerkId: user.clerkId,
          newClerkId: newClerkId,
          email: user.email,
        });
        successCount++;
        console.log(`  ✓ ${user.email} (${user.clerkId} -> ${newClerkId})`);
      } catch (error: any) {
        // Check if user already exists
        if (error.message.includes('already exists')) {
          console.log(`  - ${user.email} (already exists, skipping)`);
        } else {
          console.error(`  ✗ ${user.email}: ${error.message}`);
          errorCount++;
        }
      }

      // Rate limiting - Clerk allows 20 requests per 10 seconds
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    fs.writeFileSync(MAPPING_FILE, JSON.stringify(mappings, null, 2));

    console.log(`\nImport complete:`);
    console.log(`  Success: ${successCount}`);
    console.log(`  Errors: ${errorCount}`);
    console.log(`\nID mappings saved to ${MAPPING_FILE}`);
    console.log('\nNext steps:');
    console.log('1. Update your database with new Clerk IDs:');
    console.log('   DATABASE_URL=xxx npx ts-node scripts/clerk-migration.ts update-db');
    console.log('2. Update your .env with production Clerk keys');
    console.log('3. Notify users to use "Forgot Password" to set their passwords');
  } catch (error) {
    console.error('Import failed:', error);
    process.exit(1);
  }
}

async function updateDatabase() {
  if (!fs.existsSync(MAPPING_FILE)) {
    console.error(`Error: Mapping file not found: ${MAPPING_FILE}`);
    console.error('Run import first to generate the mapping file.');
    process.exit(1);
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('Error: DATABASE_URL environment variable is required');
    process.exit(1);
  }

  // Dynamic import for prisma
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });

  try {
    const mappings: IdMapping[] = JSON.parse(fs.readFileSync(MAPPING_FILE, 'utf-8'));

    console.log(`Updating ${mappings.length} user clerkIds in database...`);

    let successCount = 0;
    let notFoundCount = 0;

    for (const mapping of mappings) {
      const result = await prisma.user.updateMany({
        where: { clerkId: mapping.oldClerkId },
        data: { clerkId: mapping.newClerkId },
      });

      if (result.count > 0) {
        successCount++;
        console.log(`  ✓ ${mapping.email}: ${mapping.oldClerkId} -> ${mapping.newClerkId}`);
      } else {
        notFoundCount++;
        console.log(`  - ${mapping.email}: not found in database (may be new user)`);
      }
    }

    console.log(`\nDatabase update complete:`);
    console.log(`  Updated: ${successCount}`);
    console.log(`  Not found: ${notFoundCount}`);
  } catch (error) {
    console.error('Database update failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

async function showHelp() {
  console.log(`
Clerk User Migration Script
============================

This script migrates users from Clerk development to production instance.

Commands:
  export     Export users from development Clerk instance
  import     Import users to production Clerk instance
  update-db  Update database with new Clerk IDs

Usage:
  1. Export users from development:
     CLERK_SECRET_KEY=sk_test_xxx npx ts-node scripts/clerk-migration.ts export

  2. Import users to production:
     CLERK_SECRET_KEY=sk_live_xxx npx ts-node scripts/clerk-migration.ts import

  3. Update database clerkId mappings:
     DATABASE_URL=xxx npx ts-node scripts/clerk-migration.ts update-db

Notes:
  - Users will need to use "Forgot Password" or magic link to set passwords
  - The script creates mapping files in the scripts/ folder
  - Review the exported data before importing
  - Make a database backup before running update-db
`);
}

// Main
const command = process.argv[2];

switch (command) {
  case 'export':
    exportUsers();
    break;
  case 'import':
    importUsers();
    break;
  case 'update-db':
    updateDatabase();
    break;
  default:
    showHelp();
}
