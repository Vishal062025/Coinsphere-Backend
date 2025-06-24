import { v4 as uuidV4 } from 'uuid';
import pkg from '@prisma/client';
import { sendMessageCommand } from '../jobs/sqsClient.js'; // This wraps AWS SDK

const { PrismaClient } = pkg;
const prisma = new PrismaClient();

/**
 * Create a new payment entry with a unique transaction hash.
 */
export const _createPaymentService = async (body, userId) => {
  const { amount, cryptoType } = body;

  try {
    const transactionHash = uuidV4();

    const payment = await prisma.payment.create({
      data: {
        amount,
        cryptoType,
        transactionHash,
        userId,
        isExecuted: false
      },
    });

    return {
      statusCode: 201,
      data: payment,
      message: "Payment created successfully. Please verify the transaction.",
      error: null,
    };
  } catch (err) {
    console.log(err);
    return {
      statusCode: 500,
      data: null,
      message: "Failed to create payment",
      error: err.message || String(err),
    };
  }
};

/**
 * Process a submitted payment by transaction hash and queue it for verification.
 */
export const _executePaymentService = async (body, userId) => {
  const { transactionHash, paymentId } = body;

  try {
    const exists = await prisma.payment.findUnique({ where: { transactionHash } });
    if (exists) {
      return {
        statusCode: 400,
        data: null,
        message: "Transaction hash already exists",
        error: true,
      };
    }

    const paymentRecord = await prisma.payment.findUnique({ where: { id: paymentId } });
    if (!paymentRecord) {
      return {
        statusCode: 400,
        data: null,
        message: "Invalid payment ID",
        error: true,
      };
    }

    if (paymentRecord?.isExecuted) {
      return {
        statusCode: 400,
        data: null,
        message: "Payment is already in queue process or completed",
        error: true,
      };
    }

    await prisma.payment.update({
      where: { id: paymentId },
      data: { isExecuted: true, transactionHash },
    });

    const userData = await prisma.user.findUnique({
      where: { id: userId },
      select: { referredById: true },
    });

    const sqsPayload = {
      paymentId,
      transactionHash,
      reward: {
        userId: userData?.referredById ?? null,
        rewardById: userId,
      },
    };

    await sendMessageCommand(sqsPayload);

    return {
      statusCode: 201,
      data: "Payment verification started",
      message: "Payment verification started",
      error: null,
    };
  } catch (err) {
    return {
      statusCode: 500,
      data: null,
      message: "Failed to execute payment",
      error: err.message || String(err),
    };
  }
};

/**
 * Get all transactions for a user
 */
export const _getUserTransactions = async (userId) => {
  try {
    const transactions = await prisma.payment.findMany({
      where: { userId },
      include: { token: true },
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
        id,
        userId,
      },
      include: { token: true },
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
