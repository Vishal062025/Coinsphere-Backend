import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

export const _handleReferral = async (userId) => {
  try {
    // Step 1: Fetch all team members (including nested) from ReferralTree
    const referralTree = await prisma.referralTree.findMany({
      where: { rootId: userId },
      select: {
        childId: true,
        child: {
          select: {
            id: true,
            email: true,
            payments: {
              where: { isCompleted: true },
              include: {
                token: true,
              },
            },
          },
        },
      },
    });

    // Step 2: Build team structure & calculate each member's total purchase
    const teamMap = new Map();

    for (const node of referralTree) {
      const child = node.child;
      if (!child) continue;

      let totalPurchase = 0;
      for (const payment of child.payments) {
        if (payment.token?.token && payment.token?.currentPrice) {
          totalPurchase += payment.token.token * payment.token.currentPrice;
        }
      }

      if (!teamMap.has(child.id)) {
        teamMap.set(child.id, {
          id: child.id,
          email: child.email,
          totalPurchase,
        });
      } else {
        teamMap.get(child.id).totalPurchase += totalPurchase;
      }
    }

    const teamMembers = Array.from(teamMap.values());

    const teamTotalPurchase = teamMembers.reduce(
      (sum, m) => sum + m.totalPurchase,
      0
    );

    // Step 3: Direct reward (from own referred purchases)
    const myDirectReward = await prisma.reward.aggregate({
      where: {
        userId,
        isTeamReward: false,
        isCompleted: true,
      },
      _sum: {
        rewardCSP: true,
      },
    });
    const myTotalReward = Number(myDirectReward._sum.rewardCSP || 0);

    // Step 4: All rewards including team reward
    const totalRewardAggregate = await prisma.reward.aggregate({
      where: { userId, isCompleted: true },
      _sum: {
        rewardCSP: true,
      },
    });
    const totalRewardCSP = Number(totalRewardAggregate._sum.rewardCSP || 0);

    // Step 5: Claimed CSP
    const claimed = await prisma.rewardData.findUnique({
      where: { userId },
    });
    const totalClaimedCSP = Number(claimed?.claimedCSP || 0);

    // Step 6: Unclaimed
    const totalAvailableToClaim = totalRewardCSP - totalClaimedCSP;

    // Step 7: Count direct referrals
    const totalDirectReferrals = await prisma.user.count({
      where: { referredById: userId },
    });

    // ✅ Step 8: Total team members (from ReferralTree)
    const totalTeamMembers = await prisma.referralTree.count({
      where: { rootId: userId },
    });

    // Final Response
    return {
      statusCode: 200,
      data: {
        referralId: userId,
        myReward: myTotalReward,
        mydirectReferral: totalDirectReferrals,
        totalAvailableToClaim,
        totalTeamMembers,
        teamTotalPurchase: `$ ${teamTotalPurchase.toFixed(2)}`,
      },
      message: "User referral data",
      error: null,
    };
  } catch (err) {
    return {
      statusCode: 500,
      data: null,
      message: "Failed to fetch referral data",
      error: err.message,
    };
  }
};

// create claim Request
export const _createClaimRewardRequest = async (req) => {
  const userId = req.user.id;
  const { rewardCSP, userWalletAddress } = req.body;
  if (!userId || !rewardCSP || !userWalletAddress) {
    return {
      statusCode: 400,
      message:
        "Missing required fields: userId, rewardCSP, or userWalletAddress",
      data: null,
      error: "BadRequest",
    };
  }

  const userExists = await prisma.user.findUnique({ where: { id: userId } });
  if (!userExists) {
    return {
      statusCode: 404,
      message: "User not found",
      data: null,
      error: "NotFound",
    };
  }
console.log(userExists)
  // Create a new ClaimReward Request
  const claim = await prisma.claimReward.create({
    data: {
      userId,
      rewardCSP,
      userWalletAddress,
      status: "pending",
    },
  });

  return {
    statusCode: 201,
    message: "Claim reward request submitted successfully",
    data: {
      claimId: claim.id,
      userId: claim.userId,
      rewardCSP: claim.rewardCSP,
      wallet: claim.userWalletAddress,
      status: claim.status,
    },
    error: null,
  };
};
