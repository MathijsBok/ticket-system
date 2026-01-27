-- CreateTable
CREATE TABLE "Settings" (
    "id" UUID NOT NULL,
    "sendReminderEmails" BOOLEAN NOT NULL DEFAULT false,
    "reminderEmailHours" INTEGER NOT NULL DEFAULT 24,
    "sendTicketCreatedEmail" BOOLEAN NOT NULL DEFAULT true,
    "sendTicketAssignedEmail" BOOLEAN NOT NULL DEFAULT true,
    "sendTicketResolvedEmail" BOOLEAN NOT NULL DEFAULT true,
    "autoCloseEnabled" BOOLEAN NOT NULL DEFAULT false,
    "autoCloseHours" INTEGER NOT NULL DEFAULT 48,
    "defaultTicketPriority" TEXT NOT NULL DEFAULT 'NORMAL',
    "allowCustomerReopenClosed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Settings_pkey" PRIMARY KEY ("id")
);
