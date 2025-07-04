import pkg from '@prisma/client';
import { getContractInstance } from '../utils/contractUtils.js';
const { PrismaClient, PointType, PaymentMethod } = pkg;
const prisma = new PrismaClient();







export const assignTokenByAdmin = async (adminId, payload) => {
  const { userEmail, tokenAmount, userWalletAddress } = payload;

  // Validate inputs
  if (!userEmail || !tokenAmount || tokenAmount <= 0) {
    throw new Error('Invalid input parameters');
  }

  // Get environment variables
  const CURRENT_STAGE_PRICE = parseFloat(process.env.CURRENT_STAGE_PRICE);
  const DIVIDUNT = parseFloat(process.env.DIVIDUNT);
  const usdtEquivalent = tokenAmount * CURRENT_STAGE_PRICE;

  // Verify admin exists (extra safety check)
  const admin = await prisma.user.findUnique({
    where: { id: adminId, IsAdmin: true },
    select: { id: true }
  });
  if (!admin) throw new Error('Admin privileges required');

  // Find recipient user
  const recipient = await prisma.user.findUnique({ 
    where: { email: userEmail },
    select: { id: true, userWalletAddress: true }
  });
  if (!recipient) throw new Error('Recipient user not found');

  // Determine wallet address to use
  const walletAddress = userWalletAddress || recipient.userWalletAddress;
  if (!walletAddress) {
    throw new Error('No wallet address provided or associated with user');
  }

  // Create payment record
  const payment = await prisma.payment.create({
    data: {
      userId: recipient.id,
      amount: usdtEquivalent,
      cryptoType: "USDT",
      isAdminPayment: true,
      adminId: adminId,
      CSPTokenAmount: tokenAmount,
      dividunt: DIVIDUNT,
      currentStagePrice: CURRENT_STAGE_PRICE,
      userWalletAddress: walletAddress,
      isExecuted: false
    }
  });

  try {
    // Call smart contract
    const contract = getContractInstance();
    const tx = await contract.distributeTokens(
      walletAddress,
      ethers.parseUnits(tokenAmount.toString(), 18),
      DIVIDUNT
    );
    await tx.wait();

    // Update records
    await prisma.$transaction([
      prisma.payment.update({
        where: { id: payment.id },
        data: { 
          transactionHash: tx.hash,
          isCompleted: true,
          isExecuted: true
        }
      }),
      prisma.token.create({
        data: {
          paymentId: payment.id,
          token: tokenAmount,
          ercHash: tx.hash,
          currentPrice: CURRENT_STAGE_PRICE
        }
      })
    ]);

    return {
      success: true,
      txHash: tx.hash,
      data: {
        tokenAmount,
        usdtEquivalent,
        dividunt: DIVIDUNT,
        currentStagePrice: CURRENT_STAGE_PRICE,
        walletAddress
      }
    };

  } catch (error) {
    // Clean up failed payment record
    await prisma.payment.update({
      where: { id: payment.id },
      data: { 
        isActive: false, 
        isCompleted: false,
        isExecuted: false
      }
    });
    
    console.error('Token assignment failed:', error);
    throw new Error(`Blockchain operation failed: ${error.message}`);
  }
};