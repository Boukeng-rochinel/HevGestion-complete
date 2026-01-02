/*
  Warnings:

  - You are about to drop the `dsf_balance_sheets` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `dsf_income_statements` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `dsf_notes` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `dsf_signaletics` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `dsf_tax_tables` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "dsf_balance_sheets" DROP CONSTRAINT "dsf_balance_sheets_dsfId_fkey";

-- DropForeignKey
ALTER TABLE "dsf_income_statements" DROP CONSTRAINT "dsf_income_statements_dsfId_fkey";

-- DropForeignKey
ALTER TABLE "dsf_notes" DROP CONSTRAINT "dsf_notes_dsfId_fkey";

-- DropForeignKey
ALTER TABLE "dsf_signaletics" DROP CONSTRAINT "dsf_signaletics_dsfId_fkey";

-- DropForeignKey
ALTER TABLE "dsf_tax_tables" DROP CONSTRAINT "dsf_tax_tables_dsfId_fkey";

-- AlterTable
ALTER TABLE "dsf" ADD COLUMN     "reports" JSONB;

-- DropTable
DROP TABLE "dsf_balance_sheets";

-- DropTable
DROP TABLE "dsf_income_statements";

-- DropTable
DROP TABLE "dsf_notes";

-- DropTable
DROP TABLE "dsf_signaletics";

-- DropTable
DROP TABLE "dsf_tax_tables";

-- DropEnum
DROP TYPE "DSFFicheType";

-- DropEnum
DROP TYPE "DSFNoteType";

-- DropEnum
DROP TYPE "DSFTaxTableType";
