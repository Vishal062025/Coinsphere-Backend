/*
  Warnings:

  - You are about to drop the column `isReferalReward` on the `Payment` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Payment" DROP COLUMN "isReferalReward",
ADD COLUMN     "isReferralReward" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "Reward" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rewardById" TEXT,
    "referralPurchaseCSP" DOUBLE PRECISION NOT NULL,
    "rewardCSP" DOUBLE PRECISION NOT NULL,
    "isTeamReward" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Reward_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RewardData" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "totalCSP" DOUBLE PRECISION NOT NULL,
    "totalClaimedCSP" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "RewardData_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RewardData_userId_key" ON "RewardData"("userId");

-- AddForeignKey
ALTER TABLE "Reward" ADD CONSTRAINT "Reward_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardData" ADD CONSTRAINT "RewardData_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
