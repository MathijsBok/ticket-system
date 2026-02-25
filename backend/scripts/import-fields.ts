import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Map Zendesk field types to our field types
const mapFieldType = (type: string): 'text' | 'textarea' | 'select' | 'checkbox' | 'radio' => {
  switch (type) {
    case 'Checkbox':
      return 'checkbox';
    case 'Drop-down':
      return 'select';
    case 'Multi-line':
      return 'textarea';
    case 'Text':
    case 'Numeric':
      return 'text';
    default:
      return 'text';
  }
};

const fieldsToImport = [
  { name: '30daysAccept', type: 'Checkbox' },
  { name: 'Account unbind 2FA', type: 'Checkbox' },
  { name: 'App Version', type: 'Numeric' },
  { name: 'Assignee', type: 'Drop-down' },
  { name: 'Blockchain', type: 'Drop-down' },
  { name: 'Connection type', type: 'Drop-down' },
  { name: 'Description', type: 'Multi-line' },
  { name: 'Exchange action', type: 'Drop-down' },
  { name: 'Group', type: 'Drop-down' },
  { name: 'Hash', type: 'Text' },
  { name: 'ID and Selfie', type: 'Checkbox' },
  { name: 'KLV address of Unstaked KLV', type: 'Text' },
  { name: 'Phone and OS Version', type: 'Drop-down' },
  { name: 'Priority', type: 'Drop-down' },
  { name: 'Project web address', type: 'Text' },
  { name: 'Receiving wallet address', type: 'Text' },
  { name: 'Registered email address', type: 'Text' },
  { name: 'ResetExchangePassword', type: 'Checkbox' },
  { name: 'Resolution type', type: 'Drop-down' },
  { name: 'Sending wallet address', type: 'Text' },
  { name: 'Staked amount KLV', type: 'Text' },
  { name: 'Subject', type: 'Text' },
  { name: 'Swap ID', type: 'Text' },
  { name: 'Swap Payment status', type: 'Drop-down' },
  { name: 'Ticket status', type: 'Drop-down' },
  { name: 'Token chain', type: 'Text' },
  { name: 'Token contract address', type: 'Text' },
  { name: 'Token name', type: 'Text' },
  { name: 'Token ticker', type: 'Text' },
  { name: 'Topic', type: 'Drop-down' },
  { name: 'Topic Backup Keys', type: 'Drop-down' },
  { name: 'Topic Bitcoin.me Deposit / Withdraw', type: 'Drop-down' },
  { name: 'Topic Bitcoin.me General', type: 'Drop-down' },
  { name: 'Topic Bitcoin.me Login', type: 'Drop-down' },
  { name: 'Topic Browser', type: 'Drop-down' },
  { name: 'Topic Buy Crypto', type: 'Drop-down' },
  { name: 'Topic Buy Crypto provider', type: 'Drop-down' },
  { name: 'Topic Installation', type: 'Drop-down' },
  { name: 'Topic KleverSafe', type: 'Drop-down' },
  { name: 'Topic Other Questions', type: 'Drop-down' },
  { name: 'Topic Partnership', type: 'Drop-down' },
  { name: 'Topic Portfolio', type: 'Drop-down' },
  { name: 'Topic Report Bugs', type: 'Drop-down' },
  { name: 'Topic Rewards Hub', type: 'Drop-down' },
  { name: 'Topic Send / Receive', type: 'Drop-down' },
  { name: 'Topic Staking', type: 'Drop-down' },
  { name: 'Topic Swap', type: 'Drop-down' },
  { name: 'Trello Card ID', type: 'Text' },
  { name: 'Type', type: 'Drop-down' },
  { name: 'Wallet Address', type: 'Text' }
];

async function importFields() {
  console.log('Starting field import...');
  let successCount = 0;
  let errorCount = 0;

  for (const fieldData of fieldsToImport) {
    try {
      const fieldType = mapFieldType(fieldData.type);

      // Add placeholder options for select and checkbox fields
      const options = ['select', 'checkbox'].includes(fieldType)
        ? ['Option 1', 'Option 2', 'Option 3']
        : undefined;

      const field = await prisma.formFieldLibrary.create({
        data: {
          label: fieldData.name,
          fieldType,
          required: false,
          options: options || undefined,
          placeholder: undefined,
          defaultValue: undefined
        }
      });

      console.log(`✓ Created field: ${field.label} (${field.fieldType})`);
      successCount++;
    } catch (error) {
      console.error(`✗ Failed to create field: ${fieldData.name}`, error);
      errorCount++;
    }
  }

  console.log('\n=== Import Summary ===');
  console.log(`Successfully created: ${successCount} fields`);
  console.log(`Failed: ${errorCount} fields`);
  console.log(`Total: ${fieldsToImport.length} fields`);
}

importFields()
  .catch((error) => {
    console.error('Import failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
