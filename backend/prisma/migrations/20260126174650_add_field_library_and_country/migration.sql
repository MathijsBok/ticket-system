-- AlterTable
ALTER TABLE "FormField" ADD COLUMN     "required" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "FormFieldLibrary" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "FormResponse" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN     "country" VARCHAR(100),
ADD COLUMN     "ipAddress" VARCHAR(50);
