-- CreateTable
CREATE TABLE "TeamReward" (
    "id" TEXT NOT NULL,
    "rewardById" TEXT NOT NULL,
    "referralPurchaseCSP" DOUBLE PRECISION NOT NULL,
    "rewardCSP" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "TeamReward_pkey" PRIMARY KEY ("id")
);
