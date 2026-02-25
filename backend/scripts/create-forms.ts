import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface FieldConfig {
  label: string;
  required: boolean;
}

interface FormDefinition {
  name: string;
  description?: string;
  fields: FieldConfig[];
}

const formsToCreate: FormDefinition[] = [
  {
    name: 'K5 Wallet - Installation',
    description: 'For installation and setup issues with K5 Wallet',
    fields: [
      { label: 'Topic Installation', required: true },
      { label: 'Subject', required: true },
      { label: 'Phone and OS Version', required: true },
      { label: 'App Version', required: false },
      { label: 'Connection type', required: true },
      { label: 'Wallet Address', required: true },
      { label: 'Description', required: true }
    ]
  },
  {
    name: 'K5 Wallet - Portfolio',
    description: 'For portfolio and token listing issues',
    fields: [
      { label: 'Topic Portfolio', required: true },
      { label: 'Subject', required: true },
      { label: 'Token name', required: true },
      { label: 'Token ticker', required: true },
      { label: 'Token contract address', required: true },
      { label: 'Token chain', required: true },
      { label: 'Project web address', required: true },
      { label: 'Description', required: true }
    ]
  },
  {
    name: 'K5 Wallet - Swap',
    description: 'For swap and exchange issues',
    fields: [
      { label: 'Topic Swap', required: true },
      { label: 'Subject', required: true },
      { label: 'Swap ID', required: true },
      { label: 'Hash', required: true },
      { label: 'Sending wallet address', required: true },
      { label: 'Receiving wallet address', required: true },
      { label: 'App Version', required: false },
      { label: 'Phone and OS Version', required: true },
      { label: 'Connection type', required: true },
      { label: 'Description', required: true }
    ]
  },
  {
    name: 'K5 Wallet - Staking (dApp)',
    description: 'For staking-related issues',
    fields: [
      { label: 'Topic Staking', required: true },
      { label: 'Subject', required: true },
      { label: 'Blockchain', required: true },
      { label: 'Wallet Address', required: true },
      { label: 'Phone and OS Version', required: true },
      { label: 'App Version', required: false },
      { label: 'Connection type', required: true },
      { label: 'Description', required: true }
    ]
  },
  {
    name: 'K5 Wallet - Send / Receive',
    description: 'For transaction and send/receive issues',
    fields: [
      { label: 'Topic Send / Receive', required: true },
      { label: 'Subject', required: true },
      { label: 'Phone and OS Version', required: true },
      { label: 'App Version', required: false },
      { label: 'Connection type', required: true },
      { label: 'Wallet Address', required: true },
      { label: 'Description', required: true }
    ]
  },
  {
    name: 'K5 Wallet - Browser',
    description: 'For browser and dApp issues',
    fields: [
      { label: 'Topic Browser', required: true },
      { label: 'Subject', required: true },
      { label: 'Phone and OS Version', required: true },
      { label: 'App Version', required: false },
      { label: 'Connection type', required: true },
      { label: 'Wallet Address', required: true },
      { label: 'Description', required: true }
    ]
  },
  {
    name: 'K5 Wallet - Buy Crypto',
    description: 'For buying crypto and payment issues',
    fields: [
      { label: 'Topic Buy Crypto', required: true },
      { label: 'Topic Buy Crypto provider', required: true },
      { label: 'Subject', required: true },
      { label: 'Phone and OS Version', required: true },
      { label: 'App Version', required: false },
      { label: 'Connection type', required: true },
      { label: 'Wallet Address', required: true },
      { label: 'Description', required: true }
    ]
  },
  {
    name: 'K5 Wallet - Backup Keys',
    description: 'For backup and seed phrase issues',
    fields: [
      { label: 'Topic Backup Keys', required: true },
      { label: 'Subject', required: true },
      { label: 'Blockchain', required: true },
      { label: 'Wallet Address', required: true },
      { label: 'Phone and OS Version', required: true },
      { label: 'App Version', required: false },
      { label: 'Connection type', required: true },
      { label: 'Description', required: true }
    ]
  },
  {
    name: 'K5 Wallet - Report Bugs',
    description: 'For reporting bugs and technical issues',
    fields: [
      { label: 'Topic Report Bugs', required: true },
      { label: 'Subject', required: true },
      { label: 'Phone and OS Version', required: true },
      { label: 'App Version', required: false },
      { label: 'Connection type', required: true },
      { label: 'Wallet Address', required: true },
      { label: 'Description', required: true }
    ]
  },
  {
    name: 'K5 Wallet - Other Questions',
    description: 'For general questions and other issues',
    fields: [
      { label: 'Topic Other Questions', required: true },
      { label: 'Subject', required: true },
      { label: 'Phone and OS Version', required: true },
      { label: 'App Version', required: false },
      { label: 'Connection type', required: true },
      { label: 'Wallet Address', required: true },
      { label: 'Description', required: true }
    ]
  },
  {
    name: 'Extension - Portfolio',
    description: 'For portfolio issues on browser extension',
    fields: [
      { label: 'Topic Portfolio', required: true },
      { label: 'Subject', required: true },
      { label: 'Token name', required: true },
      { label: 'Token ticker', required: true },
      { label: 'Token contract address', required: true },
      { label: 'Token chain', required: true },
      { label: 'Project web address', required: true },
      { label: 'Description', required: true }
    ]
  },
  {
    name: 'Extension - Swap',
    description: 'For swap issues on browser extension',
    fields: [
      { label: 'Topic Swap', required: true },
      { label: 'Subject', required: true },
      { label: 'Swap ID', required: true },
      { label: 'Hash', required: true },
      { label: 'Sending wallet address', required: true },
      { label: 'Receiving wallet address', required: true },
      { label: 'App Version', required: false },
      { label: 'Phone and OS Version', required: true },
      { label: 'Connection type', required: true },
      { label: 'Description', required: true }
    ]
  },
  {
    name: 'Extension - Send / Receive',
    description: 'For send/receive issues on browser extension',
    fields: [
      { label: 'Topic Send / Receive', required: true },
      { label: 'Subject', required: true },
      { label: 'Phone and OS Version', required: true },
      { label: 'App Version', required: false },
      { label: 'Connection type', required: true },
      { label: 'Wallet Address', required: true },
      { label: 'Description', required: true }
    ]
  },
  {
    name: 'Extension - Other Questions',
    description: 'For general questions about browser extension',
    fields: [
      { label: 'Topic Other Questions', required: true },
      { label: 'Subject', required: true },
      { label: 'Phone and OS Version', required: true },
      { label: 'App Version', required: false },
      { label: 'Connection type', required: true },
      { label: 'Wallet Address', required: true },
      { label: 'Description', required: true }
    ]
  },
  {
    name: 'KleverSafe - General Questions',
    description: 'For KleverSafe hardware wallet issues',
    fields: [
      { label: 'Topic KleverSafe', required: true },
      { label: 'Subject', required: true },
      { label: 'App Version', required: false },
      { label: 'Phone and OS Version', required: true },
      { label: 'Connection type', required: true },
      { label: 'Wallet Address', required: true },
      { label: 'Description', required: true }
    ]
  },
  {
    name: 'Bitcoin.me - Google 2FA Issue',
    description: 'For Google 2FA reset requests',
    fields: [
      { label: 'Registered email address', required: true },
      { label: 'Subject', required: true },
      { label: 'ID and Selfie', required: true },
      { label: 'Description', required: true }
    ]
  },
  {
    name: 'Bitcoin.me - Register / Login',
    description: 'For registration and login issues',
    fields: [
      { label: 'Topic Bitcoin.me Login', required: true },
      { label: 'Registered email address', required: true },
      { label: 'Subject', required: true },
      { label: 'ResetExchangePassword', required: true },
      { label: 'Description', required: true }
    ]
  },
  {
    name: 'Bitcoin.me - Withdraw / Deposit',
    description: 'For deposit and withdrawal issues',
    fields: [
      { label: 'Topic Bitcoin.me Deposit / Withdraw', required: true },
      { label: 'Registered email address', required: true },
      { label: 'Exchange action', required: true },
      { label: 'Subject', required: true },
      { label: 'Hash', required: true },
      { label: 'Sending wallet address', required: true },
      { label: 'Receiving wallet address', required: true },
      { label: 'Description', required: true }
    ]
  },
  {
    name: 'Bitcoin.me - Other Questions',
    description: 'For general Bitcoin.me questions',
    fields: [
      { label: 'Topic Bitcoin.me General', required: true },
      { label: 'Registered email address', required: true },
      { label: 'Subject', required: true },
      { label: 'Description', required: true }
    ]
  },
  {
    name: 'Partnership/Work',
    description: 'For partnership and job opportunities',
    fields: [
      { label: 'Topic Partnership', required: true },
      { label: 'Subject', required: true },
      { label: 'Description', required: true }
    ]
  }
];

async function createForms() {
  console.log('Starting form creation...\n');

  // First, fetch all fields from the library to get their IDs
  const allFields = await prisma.formFieldLibrary.findMany({
    select: { id: true, label: true }
  });

  const fieldMap = new Map(allFields.map(f => [f.label, f.id]));

  let successCount = 0;
  let errorCount = 0;
  const missingFields: string[] = [];

  for (const formDef of formsToCreate) {
    try {
      console.log(`Creating form: ${formDef.name}`);

      // Check if all fields exist
      const fieldConfigs: Array<{ fieldId: string; required: boolean }> = [];
      let allFieldsFound = true;

      for (const fieldConfig of formDef.fields) {
        const fieldId = fieldMap.get(fieldConfig.label);
        if (!fieldId) {
          console.log(`  ❌ Field not found: ${fieldConfig.label}`);
          missingFields.push(`${formDef.name} -> ${fieldConfig.label}`);
          allFieldsFound = false;
        } else {
          fieldConfigs.push({
            fieldId,
            required: fieldConfig.required
          });
        }
      }

      if (!allFieldsFound) {
        errorCount++;
        continue;
      }

      // Create the form
      const form = await prisma.form.create({
        data: {
          name: formDef.name,
          description: formDef.description,
          isActive: true
        }
      });

      // Create field assignments
      await prisma.formField.createMany({
        data: fieldConfigs.map((config, index) => ({
          formId: form.id,
          fieldId: config.fieldId,
          order: index,
          required: config.required
        }))
      });

      console.log(`  ✅ Created with ${fieldConfigs.length} fields`);
      successCount++;
    } catch (error) {
      console.log(`  ❌ Error: ${error}`);
      errorCount++;
    }
  }

  console.log('\n=== Creation Summary ===');
  console.log(`✅ Successfully created: ${successCount}`);
  console.log(`❌ Errors: ${errorCount}`);
  console.log(`📊 Total forms: ${formsToCreate.length}`);

  if (missingFields.length > 0) {
    console.log('\n=== Missing Fields ===');
    missingFields.forEach(mf => console.log(`  - ${mf}`));
  }
}

createForms()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
