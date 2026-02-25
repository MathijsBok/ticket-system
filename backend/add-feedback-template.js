const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Adding FEEDBACK_REQUEST email template...\n');

  // Check if template already exists
  const existing = await prisma.emailTemplate.findFirst({
    where: { type: 'FEEDBACK_REQUEST' }
  });

  const templateData = {
    type: 'FEEDBACK_REQUEST',
    name: 'Request Feedback',
    subject: 'How was your support experience? - Ticket #{{ticketNumber}}',
    bodyHtml: `<h2>We'd Love Your Feedback</h2>
<p>Help us improve our support</p>

<p>Hello <strong>{{userName}}</strong>,</p>

<p>Your support ticket has been resolved. We hope we were able to help you!</p>

<p><strong>Ticket Number:</strong> #{{ticketNumber}}<br>
<strong>Subject:</strong> {{ticketSubject}}</p>

<p>How satisfied were you with the support you received? Please click one of the options below:</p>

<div style="text-align: center; margin: 30px 0;">
  <div style="display: inline-block; margin: 0 10px;">
    <a href="{{feedbackUrl}}&rating=VERY_DISSATISFIED" style="text-decoration: none; display: block;">
      <div style="font-size: 48px; margin-bottom: 8px;">😞</div>
      <div style="font-size: 12px; color: #666;">Very Dissatisfied</div>
    </a>
  </div>
  <div style="display: inline-block; margin: 0 10px;">
    <a href="{{feedbackUrl}}&rating=DISSATISFIED" style="text-decoration: none; display: block;">
      <div style="font-size: 48px; margin-bottom: 8px;">😕</div>
      <div style="font-size: 12px; color: #666;">Dissatisfied</div>
    </a>
  </div>
  <div style="display: inline-block; margin: 0 10px;">
    <a href="{{feedbackUrl}}&rating=NEUTRAL" style="text-decoration: none; display: block;">
      <div style="font-size: 48px; margin-bottom: 8px;">😐</div>
      <div style="font-size: 12px; color: #666;">Neutral</div>
    </a>
  </div>
  <div style="display: inline-block; margin: 0 10px;">
    <a href="{{feedbackUrl}}&rating=SATISFIED" style="text-decoration: none; display: block;">
      <div style="font-size: 48px; margin-bottom: 8px;">😊</div>
      <div style="font-size: 12px; color: #666;">Satisfied</div>
    </a>
  </div>
  <div style="display: inline-block; margin: 0 10px;">
    <a href="{{feedbackUrl}}&rating=VERY_SATISFIED" style="text-decoration: none; display: block;">
      <div style="font-size: 48px; margin-bottom: 8px;">🤩</div>
      <div style="font-size: 12px; color: #666;">Very Satisfied</div>
    </a>
  </div>
</div>

<p>Your feedback helps us improve our service. Thank you for taking the time to share your experience!</p>`,
    bodyPlain: `Hello {{userName}},

Your support ticket has been resolved. We hope we were able to help you!

Ticket Number: #{{ticketNumber}}
Subject: {{ticketSubject}}

How satisfied were you with the support you received? Please visit one of the links below to rate your experience:

😞 Very Dissatisfied: {{feedbackUrl}}&rating=VERY_DISSATISFIED
😕 Dissatisfied: {{feedbackUrl}}&rating=DISSATISFIED
😐 Neutral: {{feedbackUrl}}&rating=NEUTRAL
😊 Satisfied: {{feedbackUrl}}&rating=SATISFIED
🤩 Very Satisfied: {{feedbackUrl}}&rating=VERY_SATISFIED

Your feedback helps us improve our service. Thank you for taking the time to share your experience!`,
    isActive: true
  };

  if (existing) {
    await prisma.emailTemplate.update({
      where: { id: existing.id },
      data: templateData
    });
    console.log('✓ Updated FEEDBACK_REQUEST template');
  } else {
    await prisma.emailTemplate.create({
      data: templateData
    });
    console.log('✓ Created FEEDBACK_REQUEST template');
  }

  console.log('\n✓ Feedback template ready!');
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});
