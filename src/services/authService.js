import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import pkg from '@prisma/client';
import { parse, isValid } from 'date-fns';

const { PrismaClient } = pkg;
const prisma = new PrismaClient();

export const _registerUser = async (data) => {
  try {
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
      referal // optional
    } = data;

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return {
        statusCode: 400,
        message: 'User already exists',
        data: null,
        error: 'User already exists',
      };
    }

    // Validate DOB format MM-DD-YYYY
    const parsedDob = parse(dob, 'MM-dd-yyyy', new Date());
    if (!isValid(parsedDob)) {
      return {
        statusCode: 400,
        message: 'Invalid DOB format. Use MM-DD-YYYY',
        data: null,
        error: 'DOB format error',
      };
    }

    let referredById = null;
    let rootReferralId = null;

    // Handle referral if present
    if (referal) {
      const refUser = await prisma.user.findUnique({ where: { id: referal } });
      if (!refUser) {
        return {
          statusCode: 400,
          message: 'Invalid referral ID',
          data: null,
          error: 'Referral user not found',
        };
      }

      referredById = refUser.id;
      rootReferralId = refUser.rootReferralId || refUser.id;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create the user
    const user = await prisma.user.create({
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
        referredById,
        rootReferralId,
      },
    });

    // === 📈 Update referral metrics and ReferralTree ===

    if (referredById) {
      // 1. Increment direct referral count of referredBy user
      await prisma.user.update({
        where: { id: referredById },
        data: { referralCount: { increment: 1 } },
      });

      // 2. Get all ancestors (rootId) from ReferralTree of referredById
      const ancestors = await prisma.referralTree.findMany({
        where: { childId: referredById },
      });

      // 3. Add ReferralTree entries for each ancestor (depth + 1)
      const newTreeEntries = ancestors.map((ancestor) => ({
        rootId: ancestor.rootId,
        childId: user.id,
        depth: ancestor.depth + 1,
        path: `${ancestor.path || ancestor.rootId}->${user.id}`,
      }));

      // 4. Add direct referral tree node (depth 1)
      newTreeEntries.push({
        rootId: referredById,
        childId: user.id,
        depth: 1,
        path: `${referredById}->${user.id}`,
      });

      await prisma.referralTree.createMany({ data: newTreeEntries });

      // 5. Update teamSize of each ancestor
      const uniqueRootIds = [...new Set(newTreeEntries.map((entry) => entry.rootId))];
      for (const rootId of uniqueRootIds) {
        await prisma.user.update({
          where: { id: rootId },
          data: { teamSize: { increment: 1 } },
        });
      }
    }

    // === ✅ Create JWT Token ===
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, {
      expiresIn: '1d',
    });

    return {
      statusCode: 201,
      message: 'User registered successfully',
      data: { token },
      error: null,
    };
  } catch (err) {
    return {
      statusCode: 500,
      message: 'Registration failed',
      data: null,
      error: err.message,
    };
  }
};


export const _loginUser = async ({ email, password }) => {
  if (!email || !password) {
    return {
      statusCode: 400,
      error: 'Email and password are required',
    };
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return {
      statusCode: 400,
      error: 'Invalid credentials',
    };
  }

  const isValid = await bcrypt.compare(password, user.password);
  if (!isValid) {
    return {
      statusCode: 400,
      error: 'Invalid credentials',
    };
  }

  const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '1d' });

  return {
    statusCode: 200,
    message: 'Login successful',
    data: { token },
  };
};
