import { PrismaClient } from "@prisma/client";
import { parse, isValid,getYear } from "date-fns";
import bcrypt from 'bcrypt'
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

export const _getAllAssignedTokens = async () => {
  const records = await prisma.assignTokenHistory.findMany({
    include: {
      admin: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
      recipient: {
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

  const formattedList = records.map((item) => ({
    id: item.id,
    adminName: `${item.admin.firstName} ${item.admin.lastName}`.trim(),
    userName: `${item.recipient.firstName} ${item.recipient.lastName}`.trim(),
    tokenAmount: parseFloat(item.tokenAmount.toFixed(2)),
    status: item.status,
    date: dayjs(item.createdAt).format("DD MMM YYYY"),
  }));

  return {
    statusCode: 200,
    message: "Token assignment history fetched successfully",
    data: formattedList,
    error: null,
  };
};

export const _adminCreateUser = async (req, res) => {
  const {
    email,
    password,
    firstName,
    lastName,
    dob,
    address,
    city,
    state,
    zipCode,
    country,
  } = req.body;
console.log(req.body)
  // 1. Required field check
  if (
    !email ||
    !firstName ||
    !lastName ||
    !dob ||
    !address ||
    !city ||
    !state ||
    !zipCode ||
    !country
  ) {
    return {
      statusCode: 400,
      message: "All fields are required",
      data: null,
      error: "Missing required fields",
    };
  }

  // 2. Validate DOB format (MM-DD-YYYY)
  const parsedDob = parse(dob, "MM-dd-yyyy", new Date());
  if (!isValid(parsedDob)) {
    return {
      statusCode: 400,
      message: "Invalid DOB format. Use MM-DD-YYYY",
      data: null,
      error: "DOB format error",
    };
  }

  // 3. Check for existing user
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    return {
      statusCode: 400,
      message: "User already exists",
      data: null,
      error: "Duplicate user",
    };
  }

  // 4. Generate password = firstName@YYYY
  const birthYear = getYear(parsedDob);
  const rawPassword = `${firstName}@${birthYear}`;
  const hashedPassword = await bcrypt.hash(rawPassword, 10);

  // 5. Create user in DB
  const newUser = await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      firstName,
      lastName,
      dob,
      address,
      city,
      state,
      zipCode,
      country,
    },
  });

  return {
    statusCode: 201,
    message: "User created successfully",
    data: {
      id: newUser.id,
      email: newUser.email,
    },
    error: null,
  };
};
