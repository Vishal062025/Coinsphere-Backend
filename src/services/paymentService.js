import pkg from '@prisma/client';
const { PrismaClient } = pkg;
import { paymentQueue } from '../jobs/verifyPaymentQueue.js';

const prisma = new PrismaClient();

export const createPaymentService = async (body, userId) => {
  const { amount, cryptoType, transactionHash } = body;

  // Check if transactionHash already exists
  const exists = await prisma.payment.findUnique({ where: { transactionHash } });
  if (exists) {
    return {
      statusCode: 400,
      data: null,
      message: 'Transaction hash already exists',
      error: true
    };
  }

  // Create payment
  const payment = await prisma.payment.create({
    data: {
      amount,
      cryptoType,
      transactionHash,
      userId
    }
  });

  // Add to queue
  await paymentQueue.add('verify', {
    paymentId: payment.id,
    transactionHash
  });

  return {
    statusCode: 201,
    data: payment,
    message: 'Payment created and verification started',
    error: null
  };
};

/**
 * Get all transactions for a user
 */
export const getUserTransactions = async (userId) => {
  try {
    const transactions = await prisma.payment.findMany({
      where: { userId },
        include: {
        token: true
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      statusCode: 200,
      data: transactions,
      message: 'Transactions fetched successfully',
      error: null
    };
  } catch (err) {
    return {
      statusCode: 500,
      data: null,
      message: 'Failed to fetch transactions',
      error: err.message
    };
  }
};

/**
 * Get a single transaction by ID
 */
export const getTransactionDetail = async (userId, id) => {
  try {
    const transaction = await prisma.payment.findFirst({
      where: {
        id: Number(id),
        userId: userId
      },
      include: {
        token: true
      }
    });


    if (!transaction || transaction.userId !== userId) {
      return {
        statusCode: 404,
        data: null,
        message: 'Transaction not found or unauthorized',
        error: 'Not found or unauthorized'
      };
    }

    return {
      statusCode: 200,
      data: transaction,
      message: 'Transaction detail fetched successfully',
      error: null
    };
  } catch (err) {
    return {
      statusCode: 500,
      data: null,
      message: 'Failed to fetch transaction detail',
      error: err.message
    };
  }
};
