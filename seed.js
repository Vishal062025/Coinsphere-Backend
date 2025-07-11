import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';
const prisma = new PrismaClient();

async function main() {
  // Clear existing data
//   await prisma.$transaction([
//     prisma.claimedTokenRewardHistory.deleteMany(),
//     prisma.claimReward.deleteMany(),
//     prisma.rewardData.deleteMany(),
//     prisma.reward.deleteMany(),
//     prisma.assignTokenHistory.deleteMany(),
//     prisma.token.deleteMany(),
//     prisma.payment.deleteMany(),
//     prisma.referralTree.deleteMany(),
//     prisma.user.deleteMany(),
//   ]);

  // Create admin user
  const admin = await prisma.user.create({
    data: {
      email: 'admin@chainsphere.com',
      password: await hash('admin123', 12),
      firstName: 'Admin',
      lastName: 'User',
      role: 'ADMIN',
      dob: '1990-01-01',
      address: '123 Admin St',
      city: 'Metropolis',
      state: 'Tech',
      zipCode: '10001',
      country: 'Blockchain'
    }
  });

  // Create regular users
  const [user1, user2] = await Promise.all([
    prisma.user.create({
      data: {
        email: 'user1@chainsphere.com',
        password: await hash('user1123', 12),
        firstName: 'John',
        lastName: 'Doe',
        role: 'USER',
        dob: '1995-05-15',
        address: '456 User Ave',
        city: 'Cryptoville',
        state: 'Digital',
        zipCode: '20002',
        country: 'Crypto'
      }
    }),
    prisma.user.create({
      data: {
        email: 'user2@chainsphere.com',
        password: await hash('user2123', 12),
        firstName: 'Jane',
        lastName: 'Smith',
        role: 'USER',
        dob: '1992-08-20',
        address: '789 Blockchain Rd',
        city: 'Tokenville',
        state: 'Decentral',
        zipCode: '30003',
        country: 'DeFi'
      }
    })
  ]);

  // Setup referral relationships
  await prisma.referralTree.createMany({
    data: [
      {
        rootId: user1.id,
        childId: user2.id,
        depth: 1,
        path: `${user1.id}->${user2.id}`
      }
    ]
  });

  // Create rewards for users
  await prisma.reward.createMany({
    data: [
      {
        userId: user1.id,
        rewardById: 'system',
        referralPurchaseCSP: 500,
        rewardCSP: 50,
        isTeamReward: false,
        isCompleted: false
      },
      {
        userId: user1.id,
        rewardById: user2.id,
        referralPurchaseCSP: 300,
        rewardCSP: 30,
        isTeamReward: true,
        isCompleted: false
      }
    ]
  });

  // Initialize reward data
  await prisma.rewardData.create({
    data: {
      userId: user1.id,
      claimedCSP: 0
    }
  });

  // ✅ Step: Seed for Devashish Biswas
const devashish = await prisma.user.findUnique({
  where: {
    email: "kdevashish0924@gmail.com",
  },
});

if (devashish) {
  // Create rewards for Devashish
  await prisma.reward.createMany({
    data: [
      {
        userId: devashish.id,
        rewardById: 'system',
        referralPurchaseCSP: 400,
        rewardCSP: 40,
        isTeamReward: false,
        isCompleted: false
      },
      {
        userId: devashish.id,
        rewardById: 'system',
        referralPurchaseCSP: 250,
        rewardCSP: 25,
        isTeamReward: true,
        isCompleted: false
      }
    ]
  });

  // Create rewardData entry
  await prisma.rewardData.upsert({
    where: { userId: devashish.id },
    update: {
      claimedCSP: 0,
    },
    create: {
      userId: devashish.id,
      claimedCSP: 0,
    },
  });

  console.log('✅ Reward data seeded for Devashish Biswas');
} else {
  console.warn('⚠️ Devashish user not found. Please register the user before running the seed script.');
}


  console.log('Database seeded successfully!');
  console.log('Admin credentials:', { email: 'admin@chainsphere.com', password: 'admin123' });
  console.log('User credentials:', { email: 'user1@chainsphere.com', password: 'user1123' });
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());