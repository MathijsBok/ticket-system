import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create categories
  console.log('Creating categories...');
  await prisma.category.create({
    data: {
      name: 'Technical Support',
      description: 'Technical issues and bugs'
    }
  });

  await prisma.category.create({
    data: {
      name: 'Billing',
      description: 'Billing and payment issues'
    }
  });

  await prisma.category.create({
    data: {
      name: 'General Inquiry',
      description: 'General questions and feedback'
    }
  });

  console.log('✅ Categories created');

  // Create a sample form
  console.log('Creating sample form...');
  await prisma.form.create({
    data: {
      name: 'Technical Support Request',
      description: 'Use this form for technical issues',
      isActive: true,
      fields: [
        {
          id: 'field_1',
          label: 'What product are you having issues with?',
          type: 'select',
          required: true,
          options: ['Web App', 'Mobile App', 'API', 'Other']
        },
        {
          id: 'field_2',
          label: 'What browser are you using?',
          type: 'text',
          required: false
        },
        {
          id: 'field_3',
          label: 'Can you reproduce the issue?',
          type: 'checkbox',
          required: false
        }
      ]
    }
  });

  console.log('✅ Form created');

  console.log('');
  console.log('✨ Database seeded successfully!');
  console.log('');
  console.log('Created:');
  console.log(`- ${3} categories`);
  console.log(`- ${1} form template`);
  console.log('');
  console.log('⚠️  Note: You still need to create users through Clerk signup');
  console.log('   and set their roles in Clerk dashboard public metadata.');
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
