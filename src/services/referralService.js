import { PrismaClient } from "@prisma/client";
import { ethers } from "ethers";
import { getContractInstance } from '../utils/contractUtils.js';
const prisma = new PrismaClient();


const provider = new ethers.JsonRpcProvider(process.env.BSC_RPC_URL);
const ownerSigner = new ethers.Wallet(process.env.OWNER_PRIVATE_KEY, provider);

const usdtContract = new ethers.Contract(
  process.env.USDT_CONTRACT_ADDRESS,
  ['function transfer(address to, uint256 amount) external returns (bool)'],
  ownerSigner
);

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


export const _approveClaimRewardRequest = async (claimId) => {

  const claim = await prisma.claimReward.findUnique({
    where: { id: claimId },
    include: {
      user: {
        include: {
          rewards: {
            where: {
              isCompleted: false
            }

          },
          rewardData: true,
        }
      }
    }
  });
  console.log('line no 201', claim.status)

  if (!claim) {
    return {
      statusCode: 404,
      message: "Claim request not found",
      data: null,
      error: "NotFound",
    };
  }

  if (claim.status !== "pending") {
    return {
      statusCode: 400,
      message: "Claim is not in pending status",
      data: null,
      error: "BadRequest",
    };
  }

  //  Calculate actual available balance
  const totalUnclaimedRewards = claim.user.rewards.reduce(
    (sum, reward) => sum + reward.rewardCSP, 0
  );
  const alreadyClaimed = claim.user.rewardData?.claimedCSP || 0;
  const availableBalance = totalUnclaimedRewards - alreadyClaimed;

  // 4. Validate sufficient balance
  if (availableBalance < claim.rewardCSP) {
    return {
      statusCode: 403,
      message: `Insufficient reward balance. Available: ${availableBalance}, Requested: ${claim.rewardCSP}`,
      data: { availableBalance, requestedAmount: claim.rewardCSP },
      error: "Forbidden",
    };
  }

  const usdtAmount = parseFloat((claim.rewardCSP * 0.5).toFixed(6));
  const cspAmount = parseFloat((claim.rewardCSP * 0.5).toFixed(6));
  const DIVIDUNT = parseFloat(process.env.DIVIDUNT || '25');

  let usdtTx, lockTx;
  try {
    usdtTx = await usdtContract.transfer(
      claim.userWalletAddress,
      ethers.parseUnits(usdtAmount.toString(), 6)
    );
    const usdtReceipt = await usdtTx.wait();

    const cpsIcoContract = getContractInstance();
    lockTx = await cpsIcoContract.distributeTokens(
      claim.userWalletAddress,
      ethers.parseUnits(cspAmount.toString(), 18),
      DIVIDUNT
    )

    const lockReceipt = await lockTx.wait();

    await prisma.$transaction([
      prisma.claimReward.update({
        where: { id: claimId },
        data: {
          status: "approved"
        }
      }),
      prisma.claimedTokenRewardHistory.create({
        data: {
          claimRewardId: claimId,
          usdtAmount,
          usdtTxHash: usdtTx.hash,
          cspAmount,
          cspTxHash: lockTx.hash,
        }
      }),

      prisma.rewardData.upsert({
        where: { userId: claim.userId },
        create: {
          userId: claim.userId,
          claimedCSP: claim.rewardCSP,

        },
        update: {
          claimedCSP: {
            increment: claim.rewardCSP
          }
        }
      }),
      prisma.reward.updateMany({
        where: {
          userId: claim.userId,
          isCompleted: false
        },
        data: {
          isCompleted: true,

        }
      })
    ]);
    return {
      statusCode: 200,
      message: "Claim reward request approved successfully",
      data: {
        claimId: claim.id,
        usdtAmount: usdtAmount,
        cspAmount: cspAmount,
        usdtTxHash: usdtReceipt.hash,
        cspTxHash: lockReceipt.hash,
        claimStatus: "approved",
        newClaimedTotal: alreadyClaimed + claim.rewardCSP,
      },
      error: null,
    }

  } catch (error) {
    console.error("Error processing claim reward:", error);
  }
}
// case when locking is failed and usdt transfer is successful

//optinal code need to discuss with team
//   if (usdtTx && usdtTx.status === 1 && (!lockTx || lockTx.status !== 1)) {
//     await prisma.claimReward.update({
//       where: { id: claimId },
//       data: { status: "failed" }
//     });
//     return {
//       statusCode: 500,
//       message: "Locking failed, but USDT transfer was successful. Claim request marked as failed.",
//       data: null,
//       error: "LockingFailed",
//     };
//   }
//   return {
//     statusCode: 500,
//     message: "Failed to process claim reward",
//     data: null,
//     error: error.message || String(error),
//   };






