-- CreateTable
CREATE TABLE "FormFieldLibrary" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "label" VARCHAR(255) NOT NULL,
    "fieldType" VARCHAR(50) NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "options" JSONB,
    "placeholder" VARCHAR(255),
    "defaultValue" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FormFieldLibrary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormField" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "formId" UUID NOT NULL,
    "fieldId" UUID NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "FormField_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormResponse" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "ticketId" UUID NOT NULL,
    "fieldId" UUID NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FormResponse_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FormFieldLibrary_fieldType_idx" ON "FormFieldLibrary"("fieldType");

-- CreateIndex
CREATE INDEX "FormField_formId_idx" ON "FormField"("formId");

-- CreateIndex
CREATE INDEX "FormField_fieldId_idx" ON "FormField"("fieldId");

-- CreateIndex
CREATE UNIQUE INDEX "FormField_formId_fieldId_key" ON "FormField"("formId", "fieldId");

-- CreateIndex
CREATE INDEX "FormResponse_ticketId_idx" ON "FormResponse"("ticketId");

-- CreateIndex
CREATE INDEX "FormResponse_fieldId_idx" ON "FormResponse"("fieldId");

-- AddForeignKey
ALTER TABLE "FormField" ADD CONSTRAINT "FormField_formId_fkey" FOREIGN KEY ("formId") REFERENCES "Form"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormField" ADD CONSTRAINT "FormField_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "FormFieldLibrary"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormResponse" ADD CONSTRAINT "FormResponse_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormResponse" ADD CONSTRAINT "FormResponse_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "FormFieldLibrary"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable (make fields nullable for migration period)
ALTER TABLE "Form" ALTER COLUMN "fields" DROP NOT NULL;
