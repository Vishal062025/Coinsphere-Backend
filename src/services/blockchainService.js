import pkg from '@prisma/client';
import { getContractInstance } from '../utils/contractUtils.js';
const { PrismaClient, PointType, PaymentMethod } = pkg;
const prisma = new PrismaClient();
import { ethers } from 'ethers';
    
export const assignTokenByAdmin = async (req) => {

  const { userEmail, tokenAmount, userWalletAddress } = req.body;
  if (!userEmail || !tokenAmount || tokenAmount <= 0) {
    throw new Error('Invalid parameters: Provide valid email and positive token amount');
  }

  const CURRENT_STAGE_PRICE = parseFloat(process.env.CURRENT_STAGE_PRICE || '0.05');
  const DIVIDUNT = parseFloat(process.env.DIVIDUNT || '25');
  const usdtEquivalent = tokenAmount * CURRENT_STAGE_PRICE;

  const recipient = await prisma.user.findUnique({
    where: { email: userEmail },
    select: { id: true }
  });

  if (!recipient) throw new Error('Recipient user not found');

  const walletAddress = userWalletAddress
  if (!walletAddress) {
    throw new Error('No wallet address provided or associated with user');
  }

  const generateTempHash = () => {
    return '0x' + [...Array(64)]
      .map(() => Math.floor(Math.random() * 16).toString(16))
      .join('');
  };

  const payment = await prisma.payment.create({
    data: {
      userId: recipient.id,
      amount: usdtEquivalent,
      cryptoType: "USDT",
      userWalletAddress: walletAddress,
      isExecuted: false,
      isActive: true,
      transactionHash: generateTempHash(),
      token: {
        create: {
          token: tokenAmount,
          currentPrice: CURRENT_STAGE_PRICE,
          ercHash: generateTempHash(),
        }
      }
    },
    include: {
      token: true
    }
  });

  try {

    const contract = getContractInstance();
    const tx = await contract.distributeTokens(
      walletAddress,
      ethers.parseUnits(tokenAmount.toString(), 18),
      DIVIDUNT
    );
    const receipt = await tx.wait();
    console.log('Transaction receipt:', receipt);


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
        where: { id: payment.token.id },
        data: {
          ercHash: tx.hash,
        }
      })
    ]);

    return {
      success: receipt.status === 1, 
      data: {
        tokenAmount,
        txHash: tx.hash,
        usdtEquivalent,
        walletAddress
      }
    };

  } catch (error) {
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        isActive: false,
        isCompleted: false,
        isExecuted: true
      }
    });

    throw new Error(`Token assignment failed: ${error.message}`);
  }
};