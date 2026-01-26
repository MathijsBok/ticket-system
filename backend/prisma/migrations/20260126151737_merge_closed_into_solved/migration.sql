-- First, update all CLOSED tickets to SOLVED
UPDATE "Ticket" SET status = 'SOLVED' WHERE status = 'CLOSED';

-- Set solvedAt for tickets that were CLOSED but don't have solvedAt
UPDATE "Ticket" SET "solvedAt" = "closedAt" WHERE "solvedAt" IS NULL AND "closedAt" IS NOT NULL;

-- Drop the closedAt column first
ALTER TABLE "Ticket" DROP COLUMN "closedAt";

-- Now it's safe to alter the enum (remove CLOSED value)
-- First, drop the default
ALTER TABLE "Ticket" ALTER COLUMN status DROP DEFAULT;

-- Rename old enum and create new one
ALTER TYPE "TicketStatus" RENAME TO "TicketStatus_old";
CREATE TYPE "TicketStatus" AS ENUM ('NEW', 'OPEN', 'PENDING', 'ON_HOLD', 'SOLVED');

-- Update the column to use the new enum
ALTER TABLE "Ticket" ALTER COLUMN status TYPE "TicketStatus" USING status::text::"TicketStatus";

-- Restore the default
ALTER TABLE "Ticket" ALTER COLUMN status SET DEFAULT 'NEW'::"TicketStatus";

-- Drop the old enum
DROP TYPE "TicketStatus_old";
