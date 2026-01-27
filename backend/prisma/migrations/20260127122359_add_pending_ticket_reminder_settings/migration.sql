-- AlterTable
ALTER TABLE "Settings" ADD COLUMN     "pendingTicketReminderHours" INTEGER NOT NULL DEFAULT 24,
ADD COLUMN     "sendPendingTicketReminder" BOOLEAN NOT NULL DEFAULT false;
