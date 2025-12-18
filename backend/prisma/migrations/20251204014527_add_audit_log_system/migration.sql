-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('USER_LOGIN', 'USER_LOGOUT', 'USER_CREATED', 'USER_UPDATED', 'USER_DELETED', 'CLIENT_CREATED', 'CLIENT_UPDATED', 'CLIENT_DELETED', 'FOLDER_CREATED', 'FOLDER_UPDATED', 'FOLDER_DELETED', 'FOLDER_ASSIGNED', 'FOLDER_UNASSIGNED', 'BALANCE_UPLOADED', 'BALANCE_PROCESSED', 'BALANCE_VALIDATED', 'BALANCE_CORRECTED', 'DSF_GENERATED', 'DSF_VALIDATED', 'DSF_EXPORTED', 'DSF_UPDATED', 'DSF_CONFIG_CREATED', 'DSF_CONFIG_UPDATED', 'DSF_CONFIG_DELETED', 'DSF_CONFIG_IMPORTED', 'DSF_CONFIG_EXPORTED', 'EXCEL_CELL_UPDATED', 'EXCEL_RANGE_UPDATED', 'EXCEL_FORMULA_CHANGED', 'EXCEL_SHEET_ADDED', 'EXCEL_SHEET_DELETED', 'TAX_DECLARATION_SUBMITTED', 'TAX_DECLARATION_UPDATED', 'TAX_DECLARATION_CANCELLED', 'DGI_CONFIG_UPDATED', 'SYSTEM_BACKUP', 'SYSTEM_RESTORE', 'DATA_EXPORT', 'DATA_IMPORT');

-- CreateEnum
CREATE TYPE "EntityType" AS ENUM ('USER', 'CLIENT', 'FOLDER', 'BALANCE', 'DSF', 'DSF_CONFIG', 'TAX_DECLARATION', 'DGI_CONFIG', 'EXCEL_CELL', 'EXCEL_SHEET', 'SYSTEM');

-- CreateEnum
CREATE TYPE "ChangeType" AS ENUM ('CREATED', 'UPDATED', 'DELETED', 'IMPORTED', 'EXPORTED', 'PROCESSED', 'VALIDATED', 'SUBMITTED');

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "action" "AuditAction" NOT NULL,
    "entityType" "EntityType" NOT NULL,
    "entityId" TEXT,
    "folderId" TEXT,
    "clientId" TEXT,
    "description" TEXT NOT NULL,
    "oldValue" JSONB,
    "newValue" JSONB,
    "metadata" JSONB,
    "cellAddress" TEXT,
    "worksheet" TEXT,
    "fieldName" TEXT,
    "changeType" "ChangeType",

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "audit_logs_userId_idx" ON "audit_logs"("userId");

-- CreateIndex
CREATE INDEX "audit_logs_entityType_idx" ON "audit_logs"("entityType");

-- CreateIndex
CREATE INDEX "audit_logs_entityId_idx" ON "audit_logs"("entityId");

-- CreateIndex
CREATE INDEX "audit_logs_folderId_idx" ON "audit_logs"("folderId");

-- CreateIndex
CREATE INDEX "audit_logs_timestamp_idx" ON "audit_logs"("timestamp");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "folders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;
