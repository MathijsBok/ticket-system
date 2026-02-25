-- AlterEnum
ALTER TYPE "TicketStatus" ADD VALUE 'CLOSED';

-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN     "closedAt" TIMESTAMP(3),
ADD COLUMN     "relatedTicketId" UUID;

-- CreateIndex
CREATE INDEX "idx_tickets_related" ON "Ticket"("relatedTicketId");

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_relatedTicketId_fkey" FOREIGN KEY ("relatedTicketId") REFERENCES "Ticket"("id") ON DELETE SET NULL ON UPDATE CASCADE;
