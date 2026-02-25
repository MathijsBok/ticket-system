import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function setInitialFormOrder() {
  console.log('Setting initial order for forms...\n');

  // Get all forms sorted by name
  const forms = await prisma.form.findMany({
    orderBy: { name: 'asc' }
  });

  console.log(`Found ${forms.length} forms\n`);

  // Update each form with its order
  for (let i = 0; i < forms.length; i++) {
    await prisma.form.update({
      where: { id: forms[i].id },
      data: { order: i }
    });
    console.log(`${i + 1}. ${forms[i].name} -> order: ${i}`);
  }

  console.log(`\n✅ Updated ${forms.length} forms with order values`);
}

setInitialFormOrder()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
