import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface FieldUpdate {
  label: string;
  options: string[];
}

const fieldUpdates: FieldUpdate[] = [
  {
    label: 'Phone and OS Version',
    options: ['iOS', 'Android']
  },
  {
    label: 'Connection type',
    options: ['WiFi', 'Mobile data', 'VPN']
  },
  {
    label: 'Exchange action',
    options: [
      'Deposit',
      'Withdraw',
      'Google 2FA reset',
      'Receive no email code',
      'Close my account'
    ]
  },
  {
    label: 'Swap Payment status',
    options: ['In review', 'Listed for payment', 'Paid']
  },
  {
    label: 'Topic Backup Keys',
    options: [
      'Cannot create backup (seed)',
      'Lost my backup (seed)',
      'Restore backup (seed) not working',
      'General question'
    ]
  },
  {
    label: 'Topic Bitcoin.me Deposit / Withdraw',
    options: [
      'Deposit not received',
      'Withdraw not received',
      'Deposit/Withdraw processing time',
      'Cancel pending transaction',
      'General question'
    ]
  },
  {
    label: 'Topic Bitcoin.me General',
    options: ['Bug report', 'General question']
  },
  {
    label: 'Topic Bitcoin.me Login',
    options: [
      'Cannot login',
      'Lost my 2FA code',
      'Did not receive email code',
      'General question'
    ]
  },
  {
    label: 'Topic Browser',
    options: [
      'Cannot open dApp',
      'dApp not working properly',
      'Browser is slow',
      'General question'
    ]
  },
  {
    label: 'Topic Buy Crypto',
    options: [
      'Payment not processed',
      'Crypto not received',
      'Payment failed',
      'Refund request',
      'KYC/Verification issue',
      'General question'
    ]
  },
  {
    label: 'Topic Buy Crypto provider',
    options: ['Mercuryo', 'Moonpay', 'Simplex', 'Banxa', 'Paybis', 'General']
  },
  {
    label: 'Topic Installation',
    options: [
      'Cannot install the app',
      'App crashes on startup',
      'Update issue',
      'General question'
    ]
  },
  {
    label: 'Topic KleverSafe',
    options: [
      'Bug report',
      'dApps connect',
      'Send or receive issue',
      'Firmware update problem',
      'General question'
    ]
  },
  {
    label: 'Topic Other Questions',
    options: [
      'Wallet Campaigns',
      '3rd Party Dapps',
      'Feature Suggestion',
      'I have been scammed',
      'Other'
    ]
  },
  {
    label: 'Topic Partnership',
    options: ['Job application', 'Partnerships']
  },
  {
    label: 'Topic Portfolio',
    options: [
      'Balance not showing correctly',
      'Cannot see my assets',
      'Price not updating',
      'General question'
    ]
  },
  {
    label: 'Topic Report Bugs',
    options: ['Report Bug(s)', 'Other']
  },
  {
    label: 'Topic Rewards Hub',
    options: [
      'Cannot claim rewards',
      'Rewards not showing',
      'Mission not tracking',
      'General question'
    ]
  },
  {
    label: 'Topic Send / Receive',
    options: [
      'Transaction not received',
      'Transaction pending too long',
      'Wrong amount sent/received',
      'Cannot send transaction',
      'High fees',
      'General question'
    ]
  },
  {
    label: 'Topic Staking',
    options: [
      'Cannot stake',
      'Cannot unstake',
      'Rewards not received',
      'Staking balance incorrect',
      'General question'
    ]
  },
  {
    label: 'Topic Swap',
    options: [
      'Swap failed',
      'Swap pending too long',
      'Wrong amount received',
      'High slippage',
      'Cannot find token',
      'General question'
    ]
  }
];

async function updateAllFieldOptions() {
  console.log('Starting field options update...\n');

  let successCount = 0;
  let notFoundCount = 0;
  let errorCount = 0;

  for (const fieldUpdate of fieldUpdates) {
    try {
      console.log(`Processing: ${fieldUpdate.label}`);

      // Find field by label
      const field = await prisma.formFieldLibrary.findFirst({
        where: { label: fieldUpdate.label }
      });

      if (!field) {
        console.log(`  ❌ Not found in database`);
        notFoundCount++;
        continue;
      }

      // Update options
      await prisma.formFieldLibrary.update({
        where: { id: field.id },
        data: { options: fieldUpdate.options }
      });

      console.log(`  ✅ Updated with ${fieldUpdate.options.length} options`);
      successCount++;
    } catch (error) {
      console.log(`  ❌ Error: ${error}`);
      errorCount++;
    }
  }

  console.log('\n=== Update Summary ===');
  console.log(`✅ Successfully updated: ${successCount}`);
  console.log(`❌ Not found: ${notFoundCount}`);
  console.log(`❌ Errors: ${errorCount}`);
  console.log(`📊 Total processed: ${fieldUpdates.length}`);
}

updateAllFieldOptions()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
