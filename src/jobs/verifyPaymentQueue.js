import { Queue, Worker } from "bullmq";

import pkg from '@prisma/client';
const { PrismaClient } = pkg;

import IORedis from "ioredis";
import { ethers } from "ethers";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const prisma = new PrismaClient();
const connection = new IORedis({
  host: "redis-16449.c241.us-east-1-4.ec2.redns.redis-cloud.com",
  port: 16449,
  username: "default",
  password: "wSxMZ1JG9YNirweE3fuGsd7lrYqiiGua",
  maxRetriesPerRequest: null,
});

export const paymentQueue = new Queue("payment-verification", { connection });

const provider = new ethers.JsonRpcProvider(process.env.BSC_RPC_URL);
// const CPS_TOKEN_ADDRESS = process.env.CPS_TOKEN_ADDRESS;
const CPS_ICO_TOKEN_ADDRESS = process.env.CPS_ICO_TOKEN_ADDRESS;
const DIVIDUNT = process.env.DIVIDUNT;
const CPS_ICO_TOKEN_ABI = [
  // Minimal ABI for transfer
  "function distributeTokens(address buyer_, uint256 amount_, uint256 dividunt_) external",
];
const wallet = new ethers.Wallet(process.env.OWNER_PRIVATE_KEY, provider);
const cpsIcoTokenContract = new ethers.Contract(
  CPS_ICO_TOKEN_ADDRESS,
  CPS_ICO_TOKEN_ABI,
  wallet
);
// 🔄 Simulate actual status check using ethers
const simulateStatusCheck = async (txHash) => {
  try {
    const txReceipt = await provider.getTransactionReceipt(txHash);
    if (!txReceipt) return "pending";
    if (txReceipt.status === 1) return "confirmed";
    return "cancelled";
  } catch (err) {
    console.error("Error checking status:", err);
    return "pending";
  }
};

const getTransactionDetails = async (txHash) => {
  const tx = await provider.getTransaction(txHash);
  return tx;
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
    console.error(
      "Failed to fetch BNB price from CoinMarketCap:",
      error.message
    );
    return null;
  }
};
new Worker(
  "payment-verification",
  async (job) => {
    // console.log("👷 Worker started for job:", job.id);

    const { paymentId, transactionHash } = job.data;
    // console.log("📄 Job data:", { paymentId, transactionHash });

    const status = await simulateStatusCheck(transactionHash);
    // console.log("🔍 Simulated transaction status:", status);

    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
    });
    // console.log("💳 Fetched payment from DB:", payment);

    if (!payment) {
      // console.error(`❌ No payment found with ID ${paymentId}`);
      return;
    }

    if (!["BNB", "USDT"].includes(payment.cryptoType)) {
      // console.error(`❌ Invalid currency type in DB: ${payment.cryptoType}`);
      return;
    }

    if (status === "confirmed") {
      // console.log("✅ Payment status confirmed");

      const tx = await getTransactionDetails(transactionHash);
      // console.log("🔗 Fetched transaction details:", tx);

      const correctReceiver = process.env.CORRECT_RECEIVER?.toLowerCase();
      // console.log("📬 Correct receiver from ENV:", correctReceiver);

      if (!tx || !tx.to || tx.to.toLowerCase() !== correctReceiver) {
        // console.error("❌ Invalid or missing receiver address");
        return;
      }

      const amount = parseFloat(ethers.formatEther(tx.value));
      // console.log("💰 Converted transaction amount (ETH):", amount);

      if (amount !== parseFloat(payment.amount.toString())) {
        // console.error(
          // `❌ Payment amount mismatch. Expected: ${payment.amount}, Actual: ${amount}`
        // );
        return;
      }

      let tokenAmount = amount;
      if (payment.cryptoType === "BNB") {
        // console.log("🔄 Converting BNB to USDT...");
        const price = await getBNBPriceInUSDT();
        // console.log("📈 Current BNB price in USDT:", price);

        if (!price) {
          // console.error("❌ Failed to fetch BNB price");
          return;
        }

        tokenAmount = amount * price;
      }
      // console.log("🎯 Final tokenAmount (USDT value):", tokenAmount);

      let cpsAmount =
        Number(tokenAmount) / Number(process.env.CURRENT_STAGE_PRICE);
      // console.log("📦 Calculated CPS tokens to distribute:", cpsAmount);

      try {
        // console.log("🚧 Starting Prisma transaction...");
        // console.log("🚀 Distributing tokens via CPS contract");

        const txHash = await cpsIcoTokenContract
          .distributeTokens(
            tx.from,
            ethers.parseUnits(cpsAmount.toFixed(18), 18),
            DIVIDUNT
          )
          .then((res) => {
            // console.log("✅ Token transaction sent:", res.hash);
            return res;
          })
          .catch((err) => {
            // console.error("❌ Token transfer failed:", err.message);
            cpsAmount = 0;
          });

        if (cpsAmount) {
          // console.log("⏳ Waiting for CPS transaction to confirm...");
          await txHash.wait();
          // console.log("✅ CPS transaction confirmed");
        }

        await prisma.$transaction([
          prisma.payment.update({
            where: { id: Number(paymentId) },
            data: {
              isCompleted: true,
              isActive: false,
              amount,
            },
          }),
          prisma.token.create({
            data: {
              paymentId: Number(paymentId),
              token: Number(cpsAmount),
              ercHash: txHash.hash,
              currentPrice: Number(process.env.CURRENT_STAGE_PRICE),
            },
          }),
        ]);
        // console.log("✅ Prisma transaction completed");
      } catch (err) {
        console.error("❌ Prisma transaction failed:", err);
      }

      // console.log(
      //   `✅ Payment ${paymentId} confirmed. Sent CPS tokens and saved data.`
      // );
    } else if (status === "cancelled") {
      // console.log("❌ Transaction status: cancelled");
      await prisma.payment.update({
        where: { id: paymentId },
        data: {
          isCompleted: false,
          isActive: false,
        },
      });
      // console.log(`🗑️ Payment ${paymentId} marked as cancelled.`);
    } else {
      const attempt = job.data.attempt || 1;
      // console.log(`🔁 Retrying... Attempt #${attempt}`);

      await paymentQueue.add(
        "verify",
        { paymentId, transactionHash, attempt: attempt + 1 },
        { delay: Math.pow(2, attempt) * 1000 }
      );
      // console.log(`🕒 Scheduled retry for payment ${paymentId}`);
    }

    // console.log("✅ Job completed for:", paymentId);
  },
  { connection }
);
