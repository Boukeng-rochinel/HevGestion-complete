-- CreateEnum
CREATE TYPE "ClientType" AS ENUM ('NORMAL', 'ASSURANCE', 'SMT');

-- AlterTable
ALTER TABLE "clients" ADD COLUMN     "clientType" "ClientType" NOT NULL DEFAULT 'NORMAL';
