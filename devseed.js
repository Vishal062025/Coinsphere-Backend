
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function seedRewardsForDevashish() {
  const devashishEmail = 'kdevashish0924@gmail.com';

  const user = await prisma.user.findUnique({
    where: { email: devashishEmail },
  });

  if (!user) {
    console.error("❌ User not found. Make sure 'kdevashish0924@gmail.com' exists in the database.");
    return;
  }

  
  await prisma.reward.createMany({
    data: [
      {
        userId: user.id,
        rewardById: 'system',
        referralPurchaseCSP: 1500,
        rewardCSP:12000,
        isTeamReward: false,
        isCompleted: false,
      },
      {
        userId: user.id,
        rewardById: 'system',
        referralPurchaseCSP: 1200,
        rewardCSP: 120000,
        isTeamReward: true,
        isCompleted: false,
      },
    ],
  });
  console.log("✅ New rewards seeded for Devashish");

  // ✅ Optionally reset claimedCSP (e.g., to 0)
  // await prisma.rewardData.upsert({
  //   where: { userId: user.id },
  //   create: {
  //     userId: user.id,
  //     claimedCSP: 0,
  //   },
  //   update: {
  //     claimedCSP: 0, // Resetting claimedCSP for testing
  //   },
  // });

  console.log("✅ RewardData reset/seeded for Devashish");
}

seedRewardsForDevashish()
  .catch((e) => console.error(e))
  .finally(async () => await prisma.$disconnect());
