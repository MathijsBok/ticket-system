import { PrismaClient, UserRole } from '@prisma/client';
import readline from 'readline';

const prisma = new PrismaClient();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query: string): Promise<string> {
  return new Promise(resolve => rl.question(query, resolve));
}

async function createUser() {
  console.log('\n📝 Manual User Creation for Local Development\n');

  const clerkId = await question('Enter Clerk User ID (from Clerk dashboard): ');
  const email = await question('Enter email: ');
  const firstName = await question('Enter first name: ');
  const lastName = await question('Enter last name: ');
  const roleInput = await question('Enter role (USER/AGENT/ADMIN) [default: USER]: ');

  const role = roleInput.toUpperCase() || 'USER';

  if (!['USER', 'AGENT', 'ADMIN'].includes(role)) {
    console.error('❌ Invalid role. Must be USER, AGENT, or ADMIN');
    rl.close();
    return;
  }

  try {
    const user = await prisma.user.create({
      data: {
        clerkId,
        email,
        firstName: firstName || null,
        lastName: lastName || null,
        role: role as UserRole
      }
    });

    console.log('\n✅ User created successfully!');
    console.log(user);
  } catch (error) {
    console.error('\n❌ Error creating user:', error);
  } finally {
    rl.close();
    await prisma.$disconnect();
  }
}

createUser();
