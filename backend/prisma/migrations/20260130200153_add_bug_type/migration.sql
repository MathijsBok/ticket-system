-- CreateEnum
CREATE TYPE "BugType" AS ENUM ('TECHNICAL', 'VISUAL');

-- AlterTable
ALTER TABLE "Bug" ADD COLUMN "type" "BugType" NOT NULL DEFAULT 'TECHNICAL';

-- CreateIndex
CREATE INDEX "Bug_type_idx" ON "Bug"("type");
