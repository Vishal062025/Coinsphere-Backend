import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import pkg from "@prisma/client";
import { parse, isValid } from "date-fns";
import url from "url";
import { sendResetEmail, sendSignUpEmail } from "./email.service.js";
import { error } from "console";
const { PrismaClient } = pkg;
const prisma = new PrismaClient();
const tempUserStore = new Map();

export const _registerUser = async (req) => {
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
    referal,
  } = req.body;

  // 1. Check if already exists
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return {
      statusCode: 400,
      message: "User already exists",
      data: null,
      error: "User already exists",
    };
  }

  // 2. Validate DOB
  const parsedDob = parse(dob, "MM-dd-yyyy", new Date());
  if (!isValid(parsedDob)) {
    return {
      statusCode: 400,
      message: "Invalid DOB format. Use MM-DD-YYYY",
      data: null,
      error: "DOB format error",
    };
  }

  // 3. Hash password
  const hashedPassword = await bcrypt.hash(password, 10);

  // 4. Generate token
  const token = jwt.sign({ email }, process.env.JWT_SECRET, {
    expiresIn: "1d",
  });

  // 5. Save to Map
  tempUserStore.set(token, {
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
    referal,
  });

  // 6. Send verification email
  const origin = req.get?.("Origin") || process.env.FRONTEND_URL;
  const verifyUrl = `${origin}/verifyEmail/?token=${token}`;
  const emailTransport = await sendSignUpEmail(
    email,
    firstName || "User",
    verifyUrl
  );

  if (emailTransport.success) {
    console.log("User added to temp store:", tempUserStore);

    return {
      statusCode: 200,
      message:
        "You're almost there! We've sent a verification link to your email.",
      data: email,
      error: null,
    };
  } else {
    return {
      statusCode: 500,
      message: "Failed to send email verification link",
      data: null,
      error: "Email service error",
    };
  }
};

// === Verify and Create User from Map ===
export const _verifyAndCreateUser = async (req) => {
  const { token } = req.body;
  if (!token) {
    return {
      statusCode: 400,
      message: "Missing or invalid verification token",
      data: null,
      error: "Token not provided",
    };
  }

  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  console.log(decoded, 254);
  const userData = tempUserStore.get(token);
  console.log(userData);
  if (!userData || userData.email !== decoded.email) {
    return {
      statusCode: 400,
      message: "Invalid or expired verification link",
      data: null,
      error: null,
    };
  }

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
    referal,
  } = userData;

  let referredById = null;
  let rootReferralId = null;

  if (referal) {
    const refUser = await prisma.user.findUnique({ where: { id: referal } });
    if (refUser) {
      referredById = refUser.id;
      rootReferralId = refUser.rootReferralId || refUser.id;
    }
  }

  // Create actual user
  const user = await prisma.user.create({
    data: {
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
      referredById,
      rootReferralId,
    },
  });

  // Update referral info
  if (referredById) {
    await prisma.user.update({
      where: { id: referredById },
      data: { referralCount: { increment: 1 } },
    });

    const ancestors = await prisma.referralTree.findMany({
      where: { childId: referredById },
    });

    const treeData = ancestors.map((a) => ({
      rootId: a.rootId,
      childId: user.id,
      depth: a.depth + 1,
      path: `${a.path || a.rootId}->${user.id}`,
    }));

    treeData.push({
      rootId: referredById,
      childId: user.id,
      depth: 1,
      path: `${referredById}->${user.id}`,
    });

    await prisma.referralTree.createMany({ data: treeData });

    const uniqueRoots = [...new Set(treeData.map((e) => e.rootId))];
    for (const rootId of uniqueRoots) {
      await prisma.user.update({
        where: { id: rootId },
        data: { teamSize: { increment: 1 } },
      });
    }
  }

  // Clean up memory store
  tempUserStore.delete(token);

  return {
    statusCode: 201,
    message: "Email verified and user created successfully",
    data: null,
    error: null,
  };
};
export const _loginUser = async ({ email, password }) => {
  if (!email || !password) {
    return {
      statusCode: 400,
      error: "Email and password are required",
    };
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return {
      statusCode: 400,
      error: "Invalid credentials",
    };
  }

  const isValid = await bcrypt.compare(password, user.password);
  if (!isValid) {
    return {
      statusCode: 400,
      error: "Invalid credentials",
    };
  }

  const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, {
    expiresIn: "1d",
  });

  return {
    statusCode: 200,
    message: "Login successful",
    data: { token },
  };
};

export const _forgotPassword = async (req) => {
  const { email } = req.body || req;

  if (!email) {
    return {
      statusCode: 400,
      message: "Email is required",
      data: null,
      error: "Missing email",
    };
  }

  const normalizedEmail = email.toLowerCase();

  const userExist = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (!userExist) {
    return {
      statusCode: 404,
      message: "This email does not exist in our records",
      data: null,
      error: "User not found",
    };
  }

  const origin =
    req.get?.("Origin") || req.get?.("Referer") || process.env.FRONTEND_URL;

  const token = jwt.sign({ userId: userExist.id }, process.env.JWT_SECRET, {
    expiresIn: "1d",
  });

  const domain = `${origin}/resetPassword/?token=${token}`;

  const emailTransport = await sendResetEmail(
    userExist.email,
    userExist.firstName || "there",
    domain
  );
  console.log(emailTransport, 229);
  if (emailTransport.success) {
    return {
      statusCode: 200,
      message: "Password reset link sent successfully",
      data: normalizedEmail,
      error: null,
    };
  } else {
    return {
      statusCode: 500,
      message: "Failed to send reset email",
      data: null,
      error: "Email service error",
    };
  }
};

export const _resetPassword = async (req) => {
  const { token, newPassword } = req.body || req;

  if (!token || !newPassword) {
    return {
      statusCode: 400,
      message: "Token and new password are required",
      data: null,
      error: "Missing input",
    };
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return {
      statusCode: 401,
      message: "Invalid or expired token",
      data: null,
      error: "Token verification failed",
    };
  }

  const user = await prisma.user.findUnique({
    where: { id: decoded.userId },
  });

  if (!user) {
    return {
      statusCode: 404,
      message: "User not found",
      data: null,
      error: "No user for token email",
    };
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10);

  await prisma.user.update({
    where: { id: decoded.userId },
    data: { password: hashedPassword },
  });

  return {
    statusCode: 200,
    message: "Password changed successfully",
    data: user.email,
    error: null,
  };
};