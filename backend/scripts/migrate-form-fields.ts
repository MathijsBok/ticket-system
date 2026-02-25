/**
 * Data Migration Script: Migrate Form Fields to Field Library
 *
 * This script migrates existing form fields from JSON storage to the new
 * FormFieldLibrary and FormField relational structure.
 *
 * Usage: npx ts-node scripts/migrate-form-fields.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface OldFormField {
  id: string;
  label: string;
  type: string;
  required: boolean;
  options?: string[];
  placeholder?: string;
  defaultValue?: string;
}

async function migrateFormFields() {
  console.log('🚀 Starting form fields migration...\n');

  try {
    // Fetch all forms
    const forms = await prisma.form.findMany();
    console.log(`📋 Found ${forms.length} form(s) to process\n`);

    if (forms.length === 0) {
      console.log('✅ No forms to migrate. Migration complete!');
      return;
    }

    let totalFieldsMigrated = 0;
    let formsProcessed = 0;

    for (const form of forms) {
      const oldFields = form.fields as any;

      // Skip if no fields or fields is not an array
      if (!oldFields || !Array.isArray(oldFields) || oldFields.length === 0) {
        console.log(`⏭️  Skipping form "${form.name}" - no fields to migrate`);
        continue;
      }

      console.log(`📝 Processing form: "${form.name}" (${oldFields.length} fields)`);

      let order = 0;

      for (const oldField of oldFields as OldFormField[]) {
        try {
          // Create field in library
          const newField = await prisma.formFieldLibrary.create({
            data: {
              label: oldField.label,
              fieldType: oldField.type,
              required: oldField.required || false,
              options: oldField.options ? JSON.parse(JSON.stringify(oldField.options)) : null,
              placeholder: oldField.placeholder || null,
              defaultValue: oldField.defaultValue || null
            }
          });

          // Link field to form
          await prisma.formField.create({
            data: {
              formId: form.id,
              fieldId: newField.id,
              order: order++
            }
          });

          totalFieldsMigrated++;
        } catch (error) {
          console.error(`   ❌ Error migrating field "${oldField.label}":`, error);
          throw error; // Stop on error
        }
      }

      formsProcessed++;
      console.log(`   ✅ Migrated ${oldFields.length} field(s)\n`);
    }

    console.log('━'.repeat(50));
    console.log(`✅ Migration complete!`);
    console.log(`   - Forms processed: ${formsProcessed}/${forms.length}`);
    console.log(`   - Total fields migrated: ${totalFieldsMigrated}`);
    console.log('━'.repeat(50));

    // Verify migration
    console.log('\n🔍 Verifying migration...');
    const allForms = await prisma.form.findMany({
      include: {
        formFields: true
      }
    });

    const formsWithoutFields = allForms.filter(f =>
      f.fields !== null && (!f.formFields || f.formFields.length === 0)
    );

    if (formsWithoutFields.length > 0) {
      console.log(`⚠️  Warning: ${formsWithoutFields.length} form(s) still have JSON fields but no migrated fields:`);
      formsWithoutFields.forEach(f => console.log(`   - ${f.name}`));
      console.log('\n❌ Migration verification failed!');
    } else {
      console.log('✅ All forms successfully migrated!\n');
    }

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run migration
migrateFormFields()
  .then(() => {
    console.log('\n✨ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Fatal error:', error);
    process.exit(1);
  });
