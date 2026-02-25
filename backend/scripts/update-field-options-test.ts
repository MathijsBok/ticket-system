import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testUpdateFieldOptions() {
  console.log('Testing field options update...\n');

  try {
    // Test with "Phone and OS Version" field
    const fieldName = 'Phone and OS Version';
    const newOptions = ['iOS', 'Android'];

    // Find the field
    const field = await prisma.formFieldLibrary.findFirst({
      where: { label: fieldName }
    });

    if (!field) {
      console.error(`❌ Field "${fieldName}" not found`);
      return;
    }

    console.log(`Found field: ${field.label}`);
    console.log(`Current options:`, field.options);

    // Update the options
    const updatedField = await prisma.formFieldLibrary.update({
      where: { id: field.id },
      data: {
        options: newOptions
      }
    });

    console.log(`\n✅ Successfully updated field: ${updatedField.label}`);
    console.log(`New options:`, updatedField.options);

  } catch (error) {
    console.error('❌ Error updating field:', error);
  }
}

testUpdateFieldOptions()
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
