import { v4 as uuidV4 } from 'uuid'; // Make sure this is imported at the top
import pkg from '@prisma/client';
const { PrismaClient } = pkg;
// import { paymentQueue } from '../jobs/verifyPaymentQueue.js';

const prisma = new PrismaClient();

/**
 * Create a new payment entry with a unique transaction hash.
 */
export const _createPaymentService = async (body, userId) => {
  const { amount, cryptoType } = body;

  try {
    const transactionHash = uuidV4(); // Generate unique transaction hash

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

    // Step 2: Check if paymentId is valid
    const paymentRecord = await prisma.payment.findUnique({
      where: { id: paymentId },
    });

    if (!paymentRecord) {
      return {
        statusCode: 400,
        data: null,
        message: "Invalid payment ID",
        error: true,
      };
    }

    if(paymentRecord?.isExecuted){
        return {
        statusCode: 400,
        data: null,
        message: "Payment is already in queue process or completed",
        error: true,
      };
    }
    // Step 3: Update isExecuted to true
    await prisma.payment.update({
      where: { id: paymentId },
      data: { isExecuted: true, transactionHash },
    });

    // Step 4: Fetch user data (e.g., referral)
    const userData = await prisma.user.findUnique({
      where: { id: userId },
      select: { referredById: true },
    });

    // Step 5: Add job to verification queue
    // await paymentQueue.add("verify", {
    //   paymentId,
    //   transactionHash,
    //   reward: {
    //     userId: userData?.referredById ?? null, // Person receiving the reward
    //     rewardById: userId,                     // Person who initiated the payment
    //   },
    // });

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
