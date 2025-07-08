import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
import dayjs from "dayjs";
export const _getAllUsersForAdmin = async () => {
  const users = await prisma.user.findMany({
    include: {
      payments: {
        include: {
          token: true,
        },
      },
      rewards: true,
    },
  });

  const userList = users.map((user) => {
    const totalTokens = user.payments
      .filter((p) => p.token)
      .reduce((acc, p) => acc + p.token.token, 0);

    // Total Value in USD
    const totalValueUSD = user.payments
      .filter((p) => p.token)
      .reduce((acc, p) => acc + p.token.token * p.token.currentPrice, 0);

    // Total Rewards
    const totalRewards = user.rewards.reduce((acc, r) => acc + r.rewardCSP, 0);

    // Total Team Earning
    const totalTeamEarning = user.rewards
      .filter((r) => r.isTeamReward)
      .reduce((acc, r) => acc + r.rewardCSP, 0);

   
    let userTag = "Early Investor";
    if (totalTokens > 25000 && totalTokens < 50000) {
      userTag = "Core Investor";
    } else if (totalTokens >= 50000) {
      userTag = "Ambassador";
    }

    return {
      email: user.email,
      totalTokens: parseFloat(totalTokens.toFixed(2)),
      totalValueUSD: parseFloat(totalValueUSD.toFixed(2)),
      referralId: user.referredById || null, 
      userTag, 
      directReferralCount: user.referralCount,
      totalTeamSize: user.teamSize,
      totalTeamEarning: parseFloat(totalTeamEarning.toFixed(2)),
      totalRewards: parseFloat(totalRewards.toFixed(2)),
    };
  });

  return {
    statusCode: 200,
    message: "User list fetched successfully",
    data: userList,
    error: null,
  };
};




export const _getAllClaimRequests = async () => {
 
    const claims = await prisma.claimReward.findMany({
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const formattedList = claims.map((claim) => ({
      claimId: claim.id,
      userId: claim.user.id,
      userName: `${claim.user.firstName} ${claim.user.lastName}`.trim(),
      walletAddress: claim.userWalletAddress,
      status: claim.status,
      rewardCSP: parseFloat(claim.rewardCSP.toFixed(2)),
      requestDate: dayjs(claim.createdAt).format("DD MMM YYYY"), 
    }));

    return {
      statusCode: 200,
      message: "Claim reward requests fetched successfully",
      data: formattedList,
      error: null,
    };

};
