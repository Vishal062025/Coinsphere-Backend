import { Queue, Worker } from "bullmq";
import pkg from "@prisma/client";
const { PrismaClient } = pkg;

import IORedis from "ioredis";
import { ethers } from "ethers";
import axios from "axios";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";

dotenv.config();

const prisma = new PrismaClient();
const connection = new IORedis({
  host: "redis-14475.c263.us-east-1-2.ec2.redns.redis-cloud.com",
  port: 14475,
  username: "default",
  password: "C8Bu0IqQXAVcCHShsgaiKazWbJl42mKh",
  maxRetriesPerRequest: null,
});

export const paymentQueue = new Queue("payment-verification", { connection });

const provider = new ethers.JsonRpcProvider(process.env.BSC_RPC_URL);
const CORRECT_RECEIVER = process.env.CORRECT_RECEIVER.toLowerCase();
const usdtTokenAddress = process.env.USDT_CONTRACT_ADDRESS?.toLowerCase();
const CPS_ICO_TOKEN_ADDRESS = process.env.CPS_ICO_TOKEN_ADDRESS;
const DIVIDUNT = process.env.DIVIDUNT;
const CURRENT_STAGE_PRICE = parseFloat(
  process.env.CURRENT_STAGE_PRICE || "0.02"
);

const CPS_ICO_TOKEN_ABI = [
  "function distributeTokens(address buyer_, uint256 amount_, uint256 dividunt_) external",
];

const wallet = new ethers.Wallet(process.env.OWNER_PRIVATE_KEY, provider);
const cpsIcoTokenContract = new ethers.Contract(
  CPS_ICO_TOKEN_ADDRESS,
  CPS_ICO_TOKEN_ABI,
  wallet
);

const logToFile = (msg) => {
  const logPath = path.resolve("logs/payment_worker_errors.log");
  const logLine = `[${new Date().toISOString()}] ${msg}\n`;
  fs.appendFileSync(logPath, logLine);
};

const simulateStatusCheck = async (txHash) => {
  try {
    const txReceipt = await provider.getTransactionReceipt(txHash);
    if (!txReceipt) return "pending";
    return txReceipt.status === 1 ? "confirmed" : "cancelled";
  } catch (err) {
    logToFile(`Error checking status: ${err.message}`);
    return "pending";
  }
};

const getTransactionDetails = async (txHash) => {
  return await provider.getTransactionReceipt(txHash);
};

const getBNBPriceInUSDT = async () => {
  try {
    const res = await axios.get(
      "https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest",
      {
        headers: {
          "X-CMC_PRO_API_KEY": process.env.CMC_API_KEY,
        },
        params: {
          symbol: "BNB",
          convert: "USDT",
        },
      }
    );
    return res.data.data.BNB.quote.USDT.price;
  } catch (error) {
    logToFile(`Failed to fetch BNB price from CoinMarketCap: ${error.message}`);
    return null;
  }
};

new Worker(
  "payment-verification",
  async (job) => {
    const { paymentId, transactionHash } = job.data;
    try {
      const status = await simulateStatusCheck(transactionHash);

      const payment = await prisma.payment.findUnique({
        where: { id: paymentId },
      });
      if (!payment) throw `❌ No payment found with ID ${paymentId}`;

      if (!["BNB", "USDT"].includes(payment.cryptoType)) {
        throw `❌ Invalid currency type: ${payment.cryptoType}`;
      }

      if (status === "confirmed") {
        const tx = await getTransactionDetails(transactionHash);
        const sender = tx.from?.toLowerCase();
        if (!sender) throw "❌ Missing sender address";

        let tokenAmount = 0;
        let amountPaid = 0;

        if (payment.cryptoType === "BNB") {
          if (tx.to.toLowerCase() !== CORRECT_RECEIVER) {
            throw `❌ Address mismatch. Expected: ${CORRECT_RECEIVER}, Got: ${tx.to}`;
          }

          amountPaid = parseFloat(ethers.formatEther(tx.value));
          if (amountPaid !== parseFloat(payment.amount.toString())) {
            throw `❌ Amount mismatch. Expected: ${payment.amount}, Got: ${amountPaid}`;
          }

          const price = await getBNBPriceInUSDT();
          if (!price) throw "❌ Failed to fetch BNB price.";

          tokenAmount = amountPaid * price;
        }

        if (payment.cryptoType === "USDT") {
          const iface = new ethers.Interface([
            "event Transfer(address indexed from, address indexed to, uint256 value)",
          ]);
          let validTransfer = false;
          let usdtAmount = 0;

          for (const log of tx.logs || []) {
            if (log.address.toLowerCase() === usdtTokenAddress) {
              const parsed = iface.parseLog(log);
              const { to, value } = parsed.args;
              if (to.toLowerCase() === CORRECT_RECEIVER) {
                validTransfer = true;
                usdtAmount = parseFloat(ethers.formatUnits(value, 18));
                break;
              }
            }
          }

          if (!validTransfer) throw "❌ Valid USDT transfer not found.";
          amountPaid = usdtAmount;
          tokenAmount = usdtAmount;
        }

        const cpsAmount = tokenAmount / CURRENT_STAGE_PRICE;
        let tokenTx;
        try {
          tokenTx = await cpsIcoTokenContract.distributeTokens(
            sender,
            ethers.parseUnits(cpsAmount.toFixed(18), 18),
            BigInt(DIVIDUNT)
          );
          await tokenTx.wait();
        } catch (err) {
          throw `❌ Token distribution failed: ${err.message}`;
        }

        try {
          await prisma.$transaction([
            prisma.payment.update({
              where: { id: paymentId },
              data: {
                isCompleted: true,
                isActive: false,
                amount: amountPaid,
              },
            }),
            prisma.token.create({
              data: {
                paymentId,
                token: cpsAmount,
                ercHash: tokenTx?.hash,
                currentPrice: CURRENT_STAGE_PRICE,
              },
            }),
          ]);
          if (job.data.reward?.userId) {
            await prisma.reward.create({
              data: {
                userId: job.data.reward.userId, // Referrer receiving the reward
                rewardById: job.data.reward.rewardById, // User who made the purchase
                referralPurchaseCSP: cpsAmount, // Amount of CSP purchased
                rewardCSP: cpsAmount * 0.1, // Assuming 10% reward
                isTeamReward: false,
                isCompleted: true, // Mark as completed since tokens are distributed
              },
            });
          }

        } catch (err) {
          throw `❌ DB update failed: ${err.message}`;
        }
      } else if (status === "cancelled") {
        await prisma.payment.update({
          where: { id: paymentId },
          data: {
            isCompleted: false,
            isActive: false,
          },
        });
      } else {
        const attempt = job.data.attempt || 1;
        await paymentQueue.add(
          "payment-verification",
          { paymentId, transactionHash, attempt: attempt + 1 },
          { delay: 1000 * 2 ** attempt, attempts: 5 }
        );
      }
    } catch (err) {
      const error = `❌ Worker error: ${err}`;
      logToFile(error);
      console.error(error);
    }
  },
  { connection }
);
