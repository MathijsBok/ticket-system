import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanupEmptyForms() {
  console.log('Finding forms with 0 fields...\n');

  const forms = await prisma.form.findMany({
    include: {
      _count: {
        select: { formFields: true }
      }
    }
  });

  const emptyForms = forms.filter(f => f._count.formFields === 0);

  console.log(`Found ${emptyForms.length} empty forms to delete:\n`);

  for (const form of emptyForms) {
    console.log(`Deleting: ${form.name}`);
    await prisma.form.delete({
      where: { id: form.id }
    });
  }

  console.log(`\n✅ Deleted ${emptyForms.length} empty forms`);

  // Show remaining forms
  const remainingForms = await prisma.form.findMany({
    select: {
      name: true,
      _count: {
        select: { formFields: true }
      }
    },
    orderBy: { name: 'asc' }
  });

  console.log('\n=== Remaining Forms ===');
  remainingForms.forEach(f => {
    console.log(`✓ ${f.name} (${f._count.formFields} fields)`);
  });
  console.log(`\nTotal: ${remainingForms.length} forms`);
}

cleanupEmptyForms()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
