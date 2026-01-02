-- CreateEnum
CREATE TYPE "DSFNoteType" AS ENUM ('NOTE1', 'NOTE2', 'NOTE3', 'NOTE4', 'NOTE5', 'NOTE6', 'NOTE7', 'NOTE8', 'NOTE9', 'NOTE10');

-- CreateEnum
CREATE TYPE "DSFFicheType" AS ENUM ('R1', 'R2', 'R3', 'R4', 'R4BIS');

-- CreateEnum
CREATE TYPE "DSFTaxTableType" AS ENUM ('TVA', 'IS', 'IRPP', 'TAXES_DIVERSES');

-- CreateEnum
CREATE TYPE "BalanceSource" AS ENUM ('OC', 'OD', 'MC', 'MD', 'SD', 'SC', 'MCD', 'SCD');

-- AlterTable
ALTER TABLE "dsf" ADD COLUMN     "userId" TEXT;

-- CreateTable
CREATE TABLE "dsf_notes" (
    "id" TEXT NOT NULL,
    "dsfId" TEXT NOT NULL,
    "noteType" "DSFNoteType" NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "headerInfo" JSONB,
    "debts" JSONB,
    "commitments" JSONB,
    "comment" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT NOT NULL,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dsf_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dsf_signaletics" (
    "id" TEXT NOT NULL,
    "dsfId" TEXT NOT NULL,
    "ficheType" "DSFFicheType" NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "data" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT NOT NULL,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dsf_signaletics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dsf_balance_sheets" (
    "id" TEXT NOT NULL,
    "dsfId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "assets" JSONB,
    "liabilities" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT NOT NULL,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dsf_balance_sheets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dsf_income_statements" (
    "id" TEXT NOT NULL,
    "dsfId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "revenues" JSONB,
    "expenses" JSONB,
    "result" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT NOT NULL,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dsf_income_statements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dsf_tax_tables" (
    "id" TEXT NOT NULL,
    "dsfId" TEXT NOT NULL,
    "tableType" "DSFTaxTableType" NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "data" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT NOT NULL,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dsf_tax_tables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dsf_account_mappings" (
    "id" TEXT NOT NULL,
    "configId" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "source" "BalanceSource" NOT NULL,
    "destination" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT NOT NULL,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dsf_account_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "dsf_notes_dsfId_noteType_idx" ON "dsf_notes"("dsfId", "noteType");

-- CreateIndex
CREATE UNIQUE INDEX "dsf_notes_dsfId_noteType_version_key" ON "dsf_notes"("dsfId", "noteType", "version");

-- CreateIndex
CREATE INDEX "dsf_signaletics_dsfId_ficheType_idx" ON "dsf_signaletics"("dsfId", "ficheType");

-- CreateIndex
CREATE UNIQUE INDEX "dsf_signaletics_dsfId_ficheType_version_key" ON "dsf_signaletics"("dsfId", "ficheType", "version");

-- CreateIndex
CREATE INDEX "dsf_balance_sheets_dsfId_idx" ON "dsf_balance_sheets"("dsfId");

-- CreateIndex
CREATE UNIQUE INDEX "dsf_balance_sheets_dsfId_version_key" ON "dsf_balance_sheets"("dsfId", "version");

-- CreateIndex
CREATE INDEX "dsf_income_statements_dsfId_idx" ON "dsf_income_statements"("dsfId");

-- CreateIndex
CREATE UNIQUE INDEX "dsf_income_statements_dsfId_version_key" ON "dsf_income_statements"("dsfId", "version");

-- CreateIndex
CREATE INDEX "dsf_tax_tables_dsfId_tableType_idx" ON "dsf_tax_tables"("dsfId", "tableType");

-- CreateIndex
CREATE UNIQUE INDEX "dsf_tax_tables_dsfId_tableType_version_key" ON "dsf_tax_tables"("dsfId", "tableType", "version");

-- CreateIndex
CREATE INDEX "dsf_account_mappings_configId_idx" ON "dsf_account_mappings"("configId");

-- CreateIndex
CREATE UNIQUE INDEX "dsf_account_mappings_configId_accountNumber_source_key" ON "dsf_account_mappings"("configId", "accountNumber", "source");

-- AddForeignKey
ALTER TABLE "dsf" ADD CONSTRAINT "dsf_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dsf_notes" ADD CONSTRAINT "dsf_notes_dsfId_fkey" FOREIGN KEY ("dsfId") REFERENCES "dsf"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dsf_signaletics" ADD CONSTRAINT "dsf_signaletics_dsfId_fkey" FOREIGN KEY ("dsfId") REFERENCES "dsf"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dsf_balance_sheets" ADD CONSTRAINT "dsf_balance_sheets_dsfId_fkey" FOREIGN KEY ("dsfId") REFERENCES "dsf"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dsf_income_statements" ADD CONSTRAINT "dsf_income_statements_dsfId_fkey" FOREIGN KEY ("dsfId") REFERENCES "dsf"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dsf_tax_tables" ADD CONSTRAINT "dsf_tax_tables_dsfId_fkey" FOREIGN KEY ("dsfId") REFERENCES "dsf"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dsf_account_mappings" ADD CONSTRAINT "dsf_account_mappings_configId_fkey" FOREIGN KEY ("configId") REFERENCES "dsf_configs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
