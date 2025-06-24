// ✅ AWS SQS + Prisma + ethers-based Payment Worker (SQS version)
import { ReceiveMessageCommand, DeleteMessageCommand, SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import pkg from "@prisma/client";
import { ethers } from "ethers";
import axios from "axios";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
dotenv.config();

console.log("✅ SQS, Prisma, ethers, and environment configured");

const { PrismaClient } = pkg;
const prisma = new PrismaClient();
const QUEUE_URL = process.env.SQS_QUEUE_URL;
const extractedRegion = new URL(QUEUE_URL).host.split(".")[1]; // e.g., 'ap-south-1'

const sqs = new SQSClient({
  region: extractedRegion,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
  endpoint: `https://sqs.${extractedRegion}.amazonaws.com`,
});
const provider = new ethers.JsonRpcProvider(process.env.BSC_RPC_URL);
const CORRECT_RECEIVER = process.env.CORRECT_RECEIVER.toLowerCase();
const usdtTokenAddress = process.env.USDT_CONTRACT_ADDRESS?.toLowerCase();
const CPS_ICO_TOKEN_ADDRESS = process.env.CPS_ICO_TOKEN_ADDRESS;
const DIVIDUNT = process.env.DIVIDUNT;
const CURRENT_STAGE_PRICE = parseFloat(process.env.CURRENT_STAGE_PRICE || "0.02");
const CPS_ICO_TOKEN_ABI = [
  "function distributeTokens(address buyer_, uint256 amount_, uint256 dividunt_) external",
];
const wallet = new ethers.Wallet(process.env.OWNER_PRIVATE_KEY, provider);
const cpsIcoTokenContract = new ethers.Contract(CPS_ICO_TOKEN_ADDRESS, CPS_ICO_TOKEN_ABI, wallet);

const logToFile = (msg) => {
  const logDir = path.resolve("logs");
  const logPath = path.join(logDir, "payment_worker_errors.log");

  // Create the directory if it doesn't exist
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true }); // ensure nested dirs are created
  }

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

const getBNBPriceInUSDT = async () => {
  try {
    const res = await axios.get("https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest", {
      headers: { "X-CMC_PRO_API_KEY": process.env.CMC_API_KEY },
      params: { symbol: "BNB", convert: "USDT" },
    });
    return res.data.data.BNB.quote.USDT.price;
  } catch (error) {
    logToFile(`Failed to fetch BNB price: ${error.message}`);
    return null;
  }
};

export const pollSQS = async () => {
  const command = new ReceiveMessageCommand({
    QueueUrl: QUEUE_URL,
    MaxNumberOfMessages: 1,
    WaitTimeSeconds: 20,
  });

  console.log("🔁 Polling SQS for new messages...");

  try {
    const response = await sqs.send(command);
    const messages = response.Messages || [];
    console.log(`📨 ${messages.length} message(s) received`);

    for (const msg of messages) {
      const data = JSON.parse(msg.Body);
      const { paymentId, transactionHash, reward, attempt = 1 } = data;
      console.log(`🚀 Processing paymentId: ${paymentId} | Attempt: ${attempt}`);
      console.log(`🔍 Checking transactionHash: ${transactionHash}`);

      try {
        const status = await simulateStatusCheck(transactionHash);
        console.log(`📦 Transaction status: ${status}`);

        const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
        console.log(`🔎 Payment record: ${payment ? "found" : "not found"}`);
        if (!payment) throw `❌ Payment not found`;

        let tokenAmount = 0;
        let amountPaid = 0;

        if (status === "confirmed") {
          console.log("✅ Transaction confirmed");

          const txReceipt = await provider.getTransactionReceipt(transactionHash);
          const tx = await provider.getTransaction(transactionHash);
          const sender = tx.from?.toLowerCase();
          console.log(`📤 Sender address: ${sender}`);
          if (!sender) throw "❌ Missing sender address";

          if (payment.cryptoType === "BNB") {
            console.log("💰 Payment type: BNB");
            if (tx.to.toLowerCase() !== CORRECT_RECEIVER) throw "❌ Receiver mismatch";
            console.log({tx});
            amountPaid = parseFloat(ethers.formatEther(tx.value));
            console.log(`💸 Amount paid in BNB: ${amountPaid}`);

            const price = await getBNBPriceInUSDT();
            console.log(`📈 BNB price in USDT: ${price}`);
            if (!price) throw "❌ BNB price unavailable";

            tokenAmount = amountPaid * price;
            console.log(`🎯 Token amount in USDT: ${tokenAmount}`);
          }
          if (payment.cryptoType === "USDT") {
            console.log("💰 Payment type: USDT");
            const iface = new ethers.Interface(["event Transfer(address indexed from, address indexed to, uint256 value)"]);
            for (const log of txReceipt.logs || []) {
              if (log.address.toLowerCase() === usdtTokenAddress) {
                const parsed = iface.parseLog(log);
                const { to, value } = parsed.args;
                if (to.toLowerCase() === CORRECT_RECEIVER) {
                  amountPaid = parseFloat(ethers.formatUnits(value, 18));
                  tokenAmount = amountPaid;
                  console.log(`💸 Amount paid in USDT: ${amountPaid}`);
                  break;
                }
              }
            }
          }

          const cpsAmount = tokenAmount / CURRENT_STAGE_PRICE;
          console.log(`🧮 Calculated CPS tokens: ${cpsAmount}`);

          if (!cpsAmount || isNaN(cpsAmount) || cpsAmount <= 0) {
            throw `❌ Invalid CPS amount: ${cpsAmount}`;
          }

          console.log("🚚 Distributing tokens...");
          const tokenTx = await cpsIcoTokenContract.distributeTokens(
            sender,
            ethers.parseUnits(cpsAmount.toFixed(18), 18),
            BigInt(DIVIDUNT)
          );
          await tokenTx.wait();
          console.log(`✅ Tokens distributed: txHash=${tokenTx.hash}`);

          await prisma.$transaction([
            prisma.payment.update({
              where: { id: paymentId },
              data: { isCompleted: true, isActive: false, amount: amountPaid },
            }),
            prisma.token.create({
              data: {
                paymentId,
                token: cpsAmount,
                ercHash: tokenTx.hash,
                currentPrice: CURRENT_STAGE_PRICE,
              },
            }),
          ]);
          console.log("🗂️ Payment and token records updated");

          if (reward?.userId) {
            console.log("🎁 Creating referral reward...");
            await prisma.reward.create({
              data: {
                userId: reward.userId,
                rewardById: reward.rewardById,
                referralPurchaseCSP: cpsAmount,
                rewardCSP: cpsAmount * 0.1,
                isTeamReward: false,
                isCompleted: true,
              },
            });
            console.log("✅ Referral reward created");
          }

        } else if (status === "cancelled") {
          console.log("⚠️ Transaction cancelled");
          await prisma.payment.update({
            where: { id: paymentId },
            data: { isCompleted: false, isActive: false },
          });
        } else {
          console.log("⏳ Transaction still pending");
          if (attempt < 5) {
            console.log("🔁 Retrying message later...");
            const retryCmd = new SendMessageCommand({
              QueueUrl: QUEUE_URL,
              MessageBody: JSON.stringify({ ...data, attempt: attempt + 1 }),
              DelaySeconds: 3 ** attempt,
            });
            await sqs.send(retryCmd);
            console.log("📤 Message requeued for retry");
          }
        }

        // ✅ Delete the message after successful processing
        await sqs.send(new DeleteMessageCommand({
          QueueUrl: QUEUE_URL,
          ReceiptHandle: msg.ReceiptHandle,
        }));
        console.log(`🧹 Message deleted from queue for paymentId: ${paymentId}`);

      } catch (err) {
        const errMsg = `❌ Job failed for paymentId: ${paymentId} - ${err}`;
        console.error(errMsg);
        logToFile(errMsg);

        // ✅ Always delete failed messages to avoid retry loop
        await sqs.send(new DeleteMessageCommand({
          QueueUrl: QUEUE_URL,
          ReceiptHandle: msg.ReceiptHandle,
        }));
        console.log(`🧹 Message deleted from queue due to error in paymentId: ${paymentId}`);
      }
    }
  } catch (err) {
    console.error("❌ Polling error:", err.message);
    logToFile(`Polling error: ${err.message}`);
  }

  console.log("⏲️ Waiting 5s before next poll...");
  setTimeout(pollSQS, 5000);
};


export const sendMessageCommand = async (payload) => {
  const command = new SendMessageCommand({
    QueueUrl: process.env.SQS_QUEUE_URL,
    MessageBody: JSON.stringify(payload),
  });
  await sqs.send(command);
};

