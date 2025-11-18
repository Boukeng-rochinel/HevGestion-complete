-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ASSISTANT', 'COMPTABLE', 'ADMIN');

-- CreateEnum
CREATE TYPE "CountrySelection" AS ENUM ('BJ', 'BF', 'CI', 'SN', 'CM', 'TG');

-- CreateEnum
CREATE TYPE "LegalForm" AS ENUM ('SARL', 'SA', 'SUARL', 'INDIVIDUAL', 'OTHER');

-- CreateEnum
CREATE TYPE "FolderStatus" AS ENUM ('DRAFT', 'PROCESSING_BALANCE', 'BALANCE_READY', 'DSF_GENERATED', 'DSF_VALIDATED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "AssignmentRole" AS ENUM ('VIEWER', 'EDITOR', 'MANAGER');

-- CreateEnum
CREATE TYPE "BalanceType" AS ENUM ('CURRENT_YEAR', 'PREVIOUS_YEAR');

-- CreateEnum
CREATE TYPE "BalanceStatus" AS ENUM ('PENDING', 'VALIDATING', 'VALID', 'INVALID', 'PROCESSING', 'PROCESSED');

-- CreateEnum
CREATE TYPE "IssueType" AS ENUM ('NON_COMPLIANT_ACCOUNT', 'WRONG_BALANCE_POSITION', 'MISSING_SPECIFICATION', 'EQUILIBRIUM_ERROR', 'FIXED_ASSET_ISSUE');

-- CreateEnum
CREATE TYPE "Severity" AS ENUM ('INFO', 'WARNING', 'ERROR', 'BLOCKING');

-- CreateEnum
CREATE TYPE "AssetMovementType" AS ENUM ('ACQUISITION', 'DISPOSAL', 'TRANSFER', 'REVALUATION');

-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('ORDINARY', 'EXTRAORDINARY');

-- CreateEnum
CREATE TYPE "DSFStatus" AS ENUM ('DRAFT', 'GENERATING', 'GENERATED', 'VALIDATING', 'VALID', 'EXPORTED');

-- CreateEnum
CREATE TYPE "TaxType" AS ENUM ('TVA', 'CNPS', 'IS', 'ACCOUNTING', 'DSF');

-- CreateEnum
CREATE TYPE "DeclarationStatus" AS ENUM ('PENDING', 'CONFIGURED', 'IN_PROGRESS', 'DECLARED', 'PAID', 'LATE');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "phoneCountryCode" TEXT,
    "phoneNumber" TEXT,
    "password" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "resetToken" TEXT,
    "resetTokenExpiry" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clients" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "legalForm" "LegalForm" NOT NULL,
    "taxNumber" TEXT,
    "address" TEXT,
    "city" TEXT,
    "phone" TEXT,
    "country" "CountrySelection" NOT NULL,
    "currency" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "folders" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "FolderStatus" NOT NULL DEFAULT 'DRAFT',
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "clientId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "fiscalYear" INTEGER NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "folders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "folder_assignments" (
    "id" TEXT NOT NULL,
    "folderId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "AssignmentRole" NOT NULL DEFAULT 'VIEWER',
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "folder_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "balances" (
    "id" TEXT NOT NULL,
    "type" "BalanceType" NOT NULL,
    "period" TEXT NOT NULL,
    "folderId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "filePath" TEXT,
    "originalData" JSONB,
    "status" "BalanceStatus" NOT NULL DEFAULT 'PENDING',
    "validationErrors" TEXT,
    "importedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "balances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "balance_equilibriums" (
    "id" TEXT NOT NULL,
    "balanceId" TEXT NOT NULL,
    "openingDebit" DOUBLE PRECISION NOT NULL,
    "openingCredit" DOUBLE PRECISION NOT NULL,
    "movementDebit" DOUBLE PRECISION NOT NULL,
    "movementCredit" DOUBLE PRECISION NOT NULL,
    "closingDebit" DOUBLE PRECISION NOT NULL,
    "closingCredit" DOUBLE PRECISION NOT NULL,
    "isBalanced" BOOLEAN NOT NULL,
    "anomalies" TEXT,

    CONSTRAINT "balance_equilibriums_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account_issues" (
    "id" TEXT NOT NULL,
    "balanceId" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "issueType" "IssueType" NOT NULL,
    "description" TEXT NOT NULL,
    "severity" "Severity" NOT NULL DEFAULT 'WARNING',
    "isResolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" TIMESTAMP(3),
    "resolution" TEXT,

    CONSTRAINT "account_issues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fixed_assets" (
    "id" TEXT NOT NULL,
    "balanceId" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "grossValue" DOUBLE PRECISION NOT NULL,
    "netValue" DOUBLE PRECISION,
    "depreciation" DOUBLE PRECISION,
    "movementType" "AssetMovementType",
    "activityType" "ActivityType",
    "specifications" JSONB,

    CONSTRAINT "fixed_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dsf" (
    "id" TEXT NOT NULL,
    "folderId" TEXT NOT NULL,
    "status" "DSFStatus" NOT NULL DEFAULT 'DRAFT',
    "balanceSheet" JSONB,
    "incomeStatement" JSONB,
    "taxTables" JSONB,
    "notes" JSONB,
    "signaletics" JSONB,
    "lastGeneratedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dsf_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coherence_controls" (
    "id" TEXT NOT NULL,
    "dsfId" TEXT NOT NULL,
    "performedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isCoherent" BOOLEAN NOT NULL,
    "issues" JSONB,
    "reportPath" TEXT,

    CONSTRAINT "coherence_controls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tax_declarations" (
    "id" TEXT NOT NULL,
    "folderId" TEXT NOT NULL,
    "type" "TaxType" NOT NULL,
    "period" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "status" "DeclarationStatus" NOT NULL DEFAULT 'PENDING',
    "niuNumber" TEXT,
    "apiPassword" TEXT,
    "dsfId" TEXT,
    "amountDue" DOUBLE PRECISION,
    "amountPaid" DOUBLE PRECISION,
    "filedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tax_declarations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_phoneNumber_key" ON "users"("phoneNumber");

-- CreateIndex
CREATE UNIQUE INDEX "folder_assignments_folderId_userId_key" ON "folder_assignments"("folderId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "balance_equilibriums_balanceId_key" ON "balance_equilibriums"("balanceId");

-- CreateIndex
CREATE UNIQUE INDEX "dsf_folderId_key" ON "dsf"("folderId");

-- CreateIndex
CREATE UNIQUE INDEX "coherence_controls_dsfId_key" ON "coherence_controls"("dsfId");

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "folders" ADD CONSTRAINT "folders_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "folders" ADD CONSTRAINT "folders_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "folder_assignments" ADD CONSTRAINT "folder_assignments_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "folders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "folder_assignments" ADD CONSTRAINT "folder_assignments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "balances" ADD CONSTRAINT "balances_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "folders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "balance_equilibriums" ADD CONSTRAINT "balance_equilibriums_balanceId_fkey" FOREIGN KEY ("balanceId") REFERENCES "balances"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_issues" ADD CONSTRAINT "account_issues_balanceId_fkey" FOREIGN KEY ("balanceId") REFERENCES "balances"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fixed_assets" ADD CONSTRAINT "fixed_assets_balanceId_fkey" FOREIGN KEY ("balanceId") REFERENCES "balances"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dsf" ADD CONSTRAINT "dsf_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "folders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coherence_controls" ADD CONSTRAINT "coherence_controls_dsfId_fkey" FOREIGN KEY ("dsfId") REFERENCES "dsf"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_declarations" ADD CONSTRAINT "tax_declarations_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "folders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

