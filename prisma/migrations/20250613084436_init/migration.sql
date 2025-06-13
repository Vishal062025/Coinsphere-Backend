-- AlterTable
ALTER TABLE "Reward" ADD COLUMN     "isCompleted" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "referralCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "teamSize" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "ReferralTree" (
    "id" TEXT NOT NULL,
    "rootId" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "depth" INTEGER NOT NULL,
    "path" TEXT NOT NULL,

    CONSTRAINT "ReferralTree_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ReferralTree" ADD CONSTRAINT "ReferralTree_rootId_fkey" FOREIGN KEY ("rootId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralTree" ADD CONSTRAINT "ReferralTree_childId_fkey" FOREIGN KEY ("childId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
