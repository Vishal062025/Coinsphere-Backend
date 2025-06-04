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
    const { paymentId, transactionHash } = job.data;
    const status = await simulateStatusCheck(transactionHash);

    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
    });
    if (!payment) return console.error(`No payment found with ID ${paymentId}`);

    if (!["BNB", "USDT"].includes(payment.cryptoType)) {
      console.error(`❌ Invalid currency type in DB: ${payment.cryptoType}`);
      return;
    }

    console.log({ status });

    if (status === "confirmed") {
      const tx = await getTransactionDetails(transactionHash);
      const correctReceiver = process.env.CORRECT_RECEIVER?.toLowerCase();
      console.log({ correctReceiver });
      if (!tx || !tx.to || tx.to.toLowerCase() !== correctReceiver) {
        console.error("❌ Invalid or missing receiver address");
        return;
      }

      const amount = parseFloat(ethers.formatEther(tx.value));
      if (amount !== parseFloat(payment.amount.toString())) {
        console.error(
          `❌ Payment amount mismatch. Expected: ${payment.amount}, Actual: ${amount}`
        );
        return;
      }

      let tokenAmount = amount;
      if (payment.cryptoType === "BNB") {
        let price = await getBNBPriceInUSDT();
        if (!price) {
          console.error("❌ Failed to fetch BNB price");
          return;
        }
        tokenAmount = amount * price;
      }
      console.log({ tokenAmount });

      const cpsAmount =
        Number(tokenAmount) / Number(process.env.CURRENT_STAGE_PRICE);
      console.log({ cpsAmount });
      // ✅ Send CPS token to sender

      try {
        console.log("🚧 Starting Prisma transaction...");
        console.log({ cpsIcoTokenContract });
        const txHash = await cpsIcoTokenContract
          .distributeTokens(
            tx.from,
            ethers.parseUnits(cpsAmount.toFixed(18), 18),
            20
          )
          .then((res) => res)
          .catch((err) => {
            console.error("❌ Token transfer failed:", err.message);
            cpsAmount = 0;
          });
        if (cpsAmount) await txHash.wait();
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
              token: Number(cpsAmount), // ✅ FIXED HERE
              ercHash: txHash.hash,
              currentPrice: Number(process.env.CURRENT_STAGE_PRICE),
            },
          }),
        ]);

        console.log("✅ Prisma transaction completed");
      } catch (err) {
        console.error("❌ Prisma transaction failed:", err);
      }

      console.log(
        `✅ Payment ${paymentId} confirmed. Sent CPS tokens and saved data.`
      );
    } else if (status === "cancelled") {
      await prisma.payment.update({
        where: { id: paymentId },
        data: {
          isCompleted: false,
          isActive: false,
        },
      });
      console.log(`❌ Payment ${paymentId} was cancelled.`);
    } else {
      const attempt = job.data.attempt || 1;
      await paymentQueue.add(
        "verify",
        { paymentId, transactionHash, attempt: attempt + 1 },
        { delay: Math.pow(2, attempt) * 1000 }
      );
      console.log(`🔁 Retrying payment ${paymentId}, attempt ${attempt}`);
    }
  },
  { connection }
);
