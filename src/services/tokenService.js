import pkg from '@prisma/client';
const { PrismaClient } = pkg;

const prisma = new PrismaClient();

/**
 * Get total tokens and payout (USD) globally or per user
 * @param {string|null} userId - Optional user ID (UUID)
 * @returns {object} - Response with total tokens and USD payout
 */
export const _handleTotalToken = async (userId = null) => {
  try {
    let tokens = 0;
    let usd = 0;

    let tokensData;

    if (userId) {
      // Get tokens linked to payments made by this user (UUID)
      tokensData = await prisma.token.findMany({
        where: {
          payment: {
            userId: userId,
            isCompleted: true,
            isActive: false
          }
        },
        include: {
          payment: true
        },
      });
    } else {
      // Get all active and completed token transactions globally
      tokensData = await prisma.token.findMany({
        where: {
          payment: {
            isCompleted: true,
            isActive: false
          }
        },
        include: {
          payment: true
        },
      });
    }

    // Aggregate token & USD values
    for (const t of tokensData) {
      tokens += t.token;
      usd += t.token * t.currentPrice;
    }

    return {
      statusCode: 200,
      data: {
        totalTokens: tokens.toFixed(2),
        totalPayoutUSD: usd.toFixed(2)
      },
      message: 'Token totals fetched successfully',
      error: null
    };

  } catch (err) {
    return {
      statusCode: 500,
      data: null,
      message: 'Failed to fetch token totals',
      error: err.message
    };
  }
};
