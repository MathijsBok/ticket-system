import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function generateSampleFormData() {
  console.log('Starting sample form data generation...\n');

  try {
    // Get all forms and fields
    const forms = await prisma.form.findMany({
      include: {
        formFields: {
          include: {
            field: true
          },
          orderBy: {
            order: 'asc'
          }
        }
      }
    });

    // Get all users to assign as ticket creators
    const users = await prisma.user.findMany();

    if (users.length === 0) {
      console.error('❌ No users found. Please create users first.');
      return;
    }

    console.log(`Found ${forms.length} forms and ${users.length} users\n`);

    // Sample data for form fields
    const sampleFieldValues: Record<string, string[]> = {
      'email': [
        'user@example.com',
        'support@klever.io',
        'contact@test.com',
        'info@sample.org'
      ],
      'text': [
        'Sample text input',
        'Example value',
        'Test data',
        'User response'
      ],
      'textarea': [
        'This is a detailed description of the issue I am experiencing with the application.',
        'I would like to report a problem that occurred when I tried to access my account.',
        'Here is some additional information about my request for assistance.',
        'Detailed explanation of the situation and what I need help with.'
      ],
      'select': [
        'Option 1',
        'Option 2',
        'Option 3'
      ],
      'checkbox': [
        'Yes',
        'No',
        'true',
        'false'
      ],
      'radio': [
        'Option A',
        'Option B',
        'Option C'
      ]
    };

    const priorities = ['LOW', 'NORMAL', 'HIGH', 'URGENT'];
    const statuses = ['NEW', 'OPEN', 'PENDING', 'ON_HOLD', 'SOLVED'];
    const channels = ['EMAIL', 'WEB', 'API', 'SLACK', 'INTERNAL'];
    const ticketsToCreate = 75;

    console.log(`Creating ${ticketsToCreate} sample tickets with form data...\n`);

    for (let i = 0; i < ticketsToCreate; i++) {
      // Randomly decide if this ticket will have a form (80% chance)
      const shouldHaveForm = Math.random() > 0.2;

      if (!shouldHaveForm || forms.length === 0) {
        // Create ticket without form
        const randomUser = users[Math.floor(Math.random() * users.length)];
        const randomChannel = channels[Math.floor(Math.random() * channels.length)];

        const ticket = await prisma.ticket.create({
          data: {
            subject: `Sample Ticket ${i + 1} - No Form`,
            priority: priorities[Math.floor(Math.random() * priorities.length)] as any,
            status: statuses[Math.floor(Math.random() * statuses.length)] as any,
            channel: randomChannel as any,
            requesterId: randomUser.id
          }
        });

        // Create initial comment as description
        await prisma.comment.create({
          data: {
            ticketId: ticket.id,
            authorId: randomUser.id,
            body: 'This is a sample ticket created without a form selection.',
            bodyPlain: 'This is a sample ticket created without a form selection.',
            channel: 'WEB',
            isInternal: false,
            isSystem: false
          }
        });

        continue;
      }

      // Select a random form (with some forms being more likely)
      const weightedFormIndex = Math.floor(Math.pow(Math.random(), 1.5) * forms.length);
      const selectedForm = forms[weightedFormIndex];

      const randomUser = users[Math.floor(Math.random() * users.length)];
      const randomPriority = priorities[Math.floor(Math.random() * priorities.length)];
      const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
      const randomChannel = channels[Math.floor(Math.random() * channels.length)];

      // Create ticket with form
      const ticket = await prisma.ticket.create({
        data: {
          subject: `${selectedForm.name} - Issue ${i + 1}`,
          priority: randomPriority as any,
          status: randomStatus as any,
          channel: randomChannel as any,
          requesterId: randomUser.id,
          formId: selectedForm.id
        }
      });

      // Create initial comment as description
      await prisma.comment.create({
        data: {
          ticketId: ticket.id,
          authorId: randomUser.id,
          body: `This is a sample ticket created with the "${selectedForm.name}" form.`,
          bodyPlain: `This is a sample ticket created with the "${selectedForm.name}" form.`,
          channel: 'WEB',
          isInternal: false,
          isSystem: false
        }
      });

      // Create form responses for each field in the form
      const formResponses = [];
      for (const formField of selectedForm.formFields) {
        const field = formField.field;

        // Get appropriate sample value based on field type
        let value: string;
        const fieldType = field.fieldType.toLowerCase();

        if (fieldType.includes('email')) {
          value = sampleFieldValues['email'][Math.floor(Math.random() * sampleFieldValues['email'].length)];
        } else if (fieldType === 'textarea') {
          value = sampleFieldValues['textarea'][Math.floor(Math.random() * sampleFieldValues['textarea'].length)];
        } else if (fieldType === 'select') {
          // Try to use actual options from field if available
          const options = field.options as any;
          if (options && Array.isArray(options) && options.length > 0) {
            value = options[Math.floor(Math.random() * options.length)];
          } else {
            value = sampleFieldValues['select'][Math.floor(Math.random() * sampleFieldValues['select'].length)];
          }
        } else if (fieldType === 'checkbox') {
          value = sampleFieldValues['checkbox'][Math.floor(Math.random() * sampleFieldValues['checkbox'].length)];
        } else if (fieldType === 'radio') {
          const options = field.options as any;
          if (options && Array.isArray(options) && options.length > 0) {
            value = options[Math.floor(Math.random() * options.length)];
          } else {
            value = sampleFieldValues['radio'][Math.floor(Math.random() * sampleFieldValues['radio'].length)];
          }
        } else {
          // Default to text
          value = sampleFieldValues['text'][Math.floor(Math.random() * sampleFieldValues['text'].length)];
        }

        formResponses.push({
          ticketId: ticket.id,
          fieldId: field.id,
          value: value
        });
      }

      // Bulk create form responses
      if (formResponses.length > 0) {
        await prisma.formResponse.createMany({
          data: formResponses
        });
      }

      // Progress indicator
      if ((i + 1) % 10 === 0) {
        console.log(`✓ Created ${i + 1}/${ticketsToCreate} tickets`);
      }
    }

    console.log(`\n✅ Successfully created ${ticketsToCreate} sample tickets with form data!`);

    // Show statistics
    const totalFormResponses = await prisma.formResponse.count();
    const ticketsWithForms = await prisma.ticket.count({
      where: {
        formId: {
          not: null
        }
      }
    });

    console.log('\n📊 Statistics:');
    console.log(`   Total tickets: ${ticketsToCreate}`);
    console.log(`   Tickets with forms: ${ticketsWithForms}`);
    console.log(`   Total form responses: ${totalFormResponses}`);

    // Show form usage breakdown
    const formUsage = await prisma.ticket.groupBy({
      by: ['formId'],
      where: {
        formId: {
          not: null
        }
      },
      _count: true
    });

    console.log('\n📋 Form Usage:');
    for (const usage of formUsage) {
      const form = forms.find(f => f.id === usage.formId);
      if (form) {
        console.log(`   ${form.name}: ${usage._count} tickets`);
      }
    }

  } catch (error) {
    console.error('❌ Error generating sample data:', error);
  } finally {
    await prisma.$disconnect();
  }
}

generateSampleFormData();
