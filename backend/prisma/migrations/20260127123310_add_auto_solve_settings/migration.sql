-- AlterTable
ALTER TABLE "Settings" ADD COLUMN     "autoSolveEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "autoSolveHours" INTEGER NOT NULL DEFAULT 48;
