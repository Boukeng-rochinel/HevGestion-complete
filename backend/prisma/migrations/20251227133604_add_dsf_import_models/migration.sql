-- CreateTable
CREATE TABLE "dsf_imports" (
    "id" TEXT NOT NULL,
    "folderId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "exerciseYear" INTEGER NOT NULL,
    "importedBy" TEXT NOT NULL,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'processing',
    "totalSheets" INTEGER NOT NULL DEFAULT 0,
    "processedSheets" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "dsf_imports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dsf_sheets" (
    "id" TEXT NOT NULL,
    "importId" TEXT NOT NULL,
    "sheetName" TEXT NOT NULL,
    "sheetType" TEXT,
    "detectedType" TEXT,
    "matchConfidence" DOUBLE PRECISION,
    "rowCount" INTEGER NOT NULL DEFAULT 0,
    "processed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "dsf_sheets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dsf_entries" (
    "id" TEXT NOT NULL,
    "importId" TEXT NOT NULL,
    "sheetId" TEXT NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "columnLetter" TEXT,
    "cellReference" TEXT,
    "accountNumber" TEXT,
    "libelle" TEXT NOT NULL,
    "libelleNormalized" TEXT,
    "valueN" DECIMAL(15,2),
    "valueN1" DECIMAL(15,2),
    "valueN2" DECIMAL(15,2),
    "matchedNoteType" TEXT,
    "matchedFieldId" TEXT,
    "matchConfidence" DOUBLE PRECISION,
    "isManualMatch" BOOLEAN NOT NULL DEFAULT false,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "section" TEXT,
    "isHeader" BOOLEAN NOT NULL DEFAULT false,
    "isSubtotal" BOOLEAN NOT NULL DEFAULT false,
    "isTotal" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "dsf_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dsf_entry_corrections" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "originalMatch" TEXT,
    "correctedMatch" TEXT NOT NULL,
    "correctedBy" TEXT NOT NULL,
    "correctedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT,

    CONSTRAINT "dsf_entry_corrections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dsf_mapping_configs" (
    "id" TEXT NOT NULL,
    "noteType" TEXT NOT NULL,
    "sheetNamePatterns" TEXT[],

    CONSTRAINT "dsf_mapping_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dsf_field_mappings" (
    "id" TEXT NOT NULL,
    "configId" TEXT NOT NULL,
    "fieldId" TEXT NOT NULL,
    "fieldName" TEXT NOT NULL,
    "libellePatterns" TEXT[],
    "accountPatterns" TEXT[],
    "sectionName" TEXT,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "dataType" TEXT NOT NULL DEFAULT 'number',

    CONSTRAINT "dsf_field_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "dsf_imports_folderId_idx" ON "dsf_imports"("folderId");

-- CreateIndex
CREATE INDEX "dsf_imports_exerciseYear_idx" ON "dsf_imports"("exerciseYear");

-- CreateIndex
CREATE INDEX "dsf_sheets_importId_idx" ON "dsf_sheets"("importId");

-- CreateIndex
CREATE INDEX "dsf_sheets_sheetType_idx" ON "dsf_sheets"("sheetType");

-- CreateIndex
CREATE INDEX "dsf_entries_importId_idx" ON "dsf_entries"("importId");

-- CreateIndex
CREATE INDEX "dsf_entries_sheetId_idx" ON "dsf_entries"("sheetId");

-- CreateIndex
CREATE INDEX "dsf_entries_accountNumber_idx" ON "dsf_entries"("accountNumber");

-- CreateIndex
CREATE INDEX "dsf_entries_matchedNoteType_idx" ON "dsf_entries"("matchedNoteType");

-- CreateIndex
CREATE INDEX "dsf_entries_libelleNormalized_idx" ON "dsf_entries"("libelleNormalized");

-- CreateIndex
CREATE INDEX "dsf_entry_corrections_entryId_idx" ON "dsf_entry_corrections"("entryId");

-- CreateIndex
CREATE UNIQUE INDEX "dsf_mapping_configs_noteType_key" ON "dsf_mapping_configs"("noteType");

-- CreateIndex
CREATE INDEX "dsf_mapping_configs_noteType_idx" ON "dsf_mapping_configs"("noteType");

-- CreateIndex
CREATE INDEX "dsf_field_mappings_configId_idx" ON "dsf_field_mappings"("configId");

-- CreateIndex
CREATE INDEX "dsf_field_mappings_fieldId_idx" ON "dsf_field_mappings"("fieldId");

-- AddForeignKey
ALTER TABLE "dsf_imports" ADD CONSTRAINT "dsf_imports_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "folders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dsf_sheets" ADD CONSTRAINT "dsf_sheets_importId_fkey" FOREIGN KEY ("importId") REFERENCES "dsf_imports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dsf_entries" ADD CONSTRAINT "dsf_entries_importId_fkey" FOREIGN KEY ("importId") REFERENCES "dsf_imports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dsf_entries" ADD CONSTRAINT "dsf_entries_sheetId_fkey" FOREIGN KEY ("sheetId") REFERENCES "dsf_sheets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dsf_entry_corrections" ADD CONSTRAINT "dsf_entry_corrections_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "dsf_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dsf_field_mappings" ADD CONSTRAINT "dsf_field_mappings_configId_fkey" FOREIGN KEY ("configId") REFERENCES "dsf_mapping_configs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
