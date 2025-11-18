-- AlterTable
ALTER TABLE "users" ADD COLUMN     "phoneCountryCode" TEXT,
ADD COLUMN     "phoneNumber" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "users_phoneNumber_key" ON "users"("phoneNumber");

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "email" DROP NOT NULL;