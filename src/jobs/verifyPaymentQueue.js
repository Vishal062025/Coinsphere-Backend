import { Queue, Worker } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import IORedis from 'ioredis';

const prisma = new PrismaClient();
const connection = new IORedis({
  host: 'redis-16449.c241.us-east-1-4.ec2.redns.redis-cloud.com',
  port: 16449,
  username: 'default',
  password: 'wSxMZ1JG9YNirweE3fuGsd7lrYqiiGua',
  maxRetriesPerRequest: null
});

export const paymentQueue = new Queue('payment-verification', { connection });

// Simulate blockchain status check
const simulateStatusCheck = async (txHash) => {
  // Replace this with actual logic using web3.js or ethers.js
  const statusOptions = ['pending', 'cancelled', 'confirmed'];
  return statusOptions[Math.floor(Math.random() * statusOptions.length)];
};

// Worker
new Worker(
  'payment-verification',
  async job => {
    const { paymentId, transactionHash } = job.data;

    const status = await simulateStatusCheck(transactionHash);

  if (status === 'confirmed') {
  await prisma.payment.update({
    where: { id: paymentId },
    data: {
      isCompleted: true,
      isActive: false
    }
  });
  console.log(`✅ Payment ${paymentId} confirmed`);
} else if (status === 'cancelled') {
  await prisma.payment.update({
    where: { id: paymentId },
    data: {
      isCompleted: false,
      isActive: false
    }
  });
  console.log(`❌ Payment ${paymentId} was cancelled`);
} else {
  const attempt = job.data.attempt || 1;
    await paymentQueue.add(
      'verify',
      { paymentId, transactionHash, attempt: attempt + 1 },
      { delay: Math.pow(2, attempt) * 1000 }
    );
    console.log(`🔁 Retrying payment ${paymentId}, attempt ${attempt}`);
}

  },
  { connection }
);
