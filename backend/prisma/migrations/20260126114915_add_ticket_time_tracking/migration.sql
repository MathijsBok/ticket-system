-- CreateTable
CREATE TABLE "TicketTimeEntry" (
    "id" UUID NOT NULL,
    "ticketId" UUID NOT NULL,
    "agentId" UUID NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "duration" INTEGER,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TicketTimeEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TicketTimeEntry_ticketId_idx" ON "TicketTimeEntry"("ticketId");

-- CreateIndex
CREATE INDEX "TicketTimeEntry_agentId_idx" ON "TicketTimeEntry"("agentId");

-- CreateIndex
CREATE INDEX "TicketTimeEntry_startedAt_idx" ON "TicketTimeEntry"("startedAt");

-- AddForeignKey
ALTER TABLE "TicketTimeEntry" ADD CONSTRAINT "TicketTimeEntry_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketTimeEntry" ADD CONSTRAINT "TicketTimeEntry_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
