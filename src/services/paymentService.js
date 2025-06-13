import pkg from "@prisma/client";
const { PrismaClient } = pkg;
import { paymentQueue } from "../jobs/verifyPaymentQueue.js";

const prisma = new PrismaClient();

export const _createPaymentService = async (body, userId) => {
  const { amount, cryptoType, transactionHash } = body;

  try {
    // Step 1: Check if transactionHash already exists
    const exists = await prisma.payment.findUnique({
      where: { transactionHash },
    });

    if (exists) {
      return {
        statusCode: 400,
        data: null,
        message: "Transaction hash already exists",
        error: true,
      };
    }

    // Step 2: Fetch user data (to get referredById)
    const userData = await prisma.user.findUnique({
      where: { id: userId },
      select: { referredById: true },
    });

    // Step 3: Create payment
    const payment = await prisma.payment.create({
      data: {
        amount,
        cryptoType,
        transactionHash,
        userId,
      },
    });

    // Step 5: Add to queue
    await paymentQueue.add("verify", {
      paymentId: payment.id,
      transactionHash,
      reward: {
        userId: userData.referredById ?? null, // person receiving the reward
        rewardById: userId,
      },
    });

    return {
      statusCode: 201,
      data: "Payment created and verification started",
      message: "Payment created and verification started",
      error: null,
    };
  } catch (err) {
    return {
      statusCode: 500,
      data: null,
      message: "Failed to create payment",
      error: err.message || err.toString(),
    };
  }
};

/**
 * Get all transactions for a user
 */
export const _getUserTransactions = async (userId) => {
  try {
    const transactions = await prisma.payment.findMany({
      where: { userId }, // userId is UUID string
      include: {
        token: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return {
      statusCode: 200,
      data: transactions,
      message: "Transactions fetched successfully",
      error: null,
    };
  } catch (err) {
    return {
      statusCode: 500,
      data: null,
      message: "Failed to fetch transactions",
      error: err.message,
    };
  }
};

/**
 * Get a single transaction by ID
 */
export const _getTransactionDetail = async (userId, id) => {
  try {
    const transaction = await prisma.payment.findFirst({
      where: {
        id: id, // id is UUID string
        userId: userId,
      },
      include: {
        token: true,
      },
    });

    if (!transaction || transaction.userId !== userId) {
      return {
        statusCode: 404,
        data: null,
        message: "Transaction not found or unauthorized",
        error: "Not found or unauthorized",
      };
    }

    return {
      statusCode: 200,
      data: transaction,
      message: "Transaction detail fetched successfully",
      error: null,
    };
  } catch (err) {
    return {
      statusCode: 500,
      data: null,
      message: "Failed to fetch transaction detail",
      error: err.message,
    };
  }
};
