/*
  Warnings:

  - You are about to drop the column `totalCSP` on the `RewardData` table. All the data in the column will be lost.
  - You are about to drop the column `totalClaimedCSP` on the `RewardData` table. All the data in the column will be lost.
  - Made the column `rewardById` on table `Reward` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `claimedCSP` to the `RewardData` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Reward" ALTER COLUMN "rewardById" SET NOT NULL;

-- AlterTable
ALTER TABLE "RewardData" DROP COLUMN "totalCSP",
DROP COLUMN "totalClaimedCSP",
ADD COLUMN     "claimedCSP" DOUBLE PRECISION NOT NULL;
