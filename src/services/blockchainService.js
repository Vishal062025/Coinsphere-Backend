import pkg from '@prisma/client';
import { getContractInstance } from '../utils/contractUtils.js';
const { PrismaClient, PointType, PaymentMethod } = pkg;
const prisma = new PrismaClient();

export const assignTokenByAdmin = async (adminId, payload) => {
  const { userEmail, tokenAmount, userWalletAddress } = payload;

  // Validate inputs
  if (!userEmail || !tokenAmount || tokenAmount <= 0) {
    throw new Error('Invalid parameters: Provide valid email and positive token amount');
  }

  // Get environment variables
  const CURRENT_STAGE_PRICE = parseFloat(process.env.CURRENT_STAGE_PRICE || '0.05');
  const DIVIDUNT = parseFloat(process.env.DIVIDUNT || '25');
  const usdtEquivalent = tokenAmount * CURRENT_STAGE_PRICE;

  // Verify admin exists (extra safety check)
  const admin = await prisma.user.findUnique({
    where: { id: adminId,
      role: {in: ['ADMIN', 'SUPERADMIN']}
    }, 
  });
  if (!admin) throw new Error('Admin authorization failed');

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
      userWalletAddress: walletAddress,
      isExecuted: false,
      isActive: true,
      token: {
        create: {
          token: tokenAmount,
          currentPrice: CURRENT_STAGE_PRICE,
          ercHash: 'pending',
        }
      },
      include: {
        token: true
      }
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
    const receipt = await tx.wait();

    // Update records
    await prisma.$transaction([
      prisma.payment.update({
        where: { id: payment.id },
        data: { 
          transactionHash: tx.hash,
          isCompleted: receipt.status === 1,
          isExecuted: true,
          isActive: receipt.status === 1,
        }
      }),
      prisma.token.update({
        where: { id: payment.id },
        data: {
          ercHash: tx.hash,
        }
      })
    ]);

    return {
      success: receipt.status === 1,
      txHash: tx.hash,
      data: {
        tokenAmount,
        usdtEquivalent,
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
        isExecuted: true
      }
    });
    
    console.error('Blockchain assignment failed:', error);
    throw new Error(`Token assignment failed: ${error.message}`);
  }
};