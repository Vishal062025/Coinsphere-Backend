import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import authRoutes from './routes/auth.js';
import paymentRoutes from './routes/payment.js';
import tokenRoutes from './routes/token.js';
import adminRoutes from "./routes/admin.js"
import referralRoutes from './routes/referral.js';
import blockchainRoutes from './routes/blockchainRoutes.js'
import userRoutes from './routes/user.js'
import pkg from '@prisma/client';
import morgan from 'morgan';
 import { pollSQS } from './jobs/sqsClient.js';

const { PrismaClient } = pkg;

const verboseSQSLogs = false; 

dotenv.config();
const app = express();
const prisma = new PrismaClient();

console.log(app)
app.use(cors({
  origin: '*', // allows all origins
  methods: '*', // allows all HTTP methods
  allowedHeaders: ['Content-Type', 'Authorization'], // allows specific headers
}));


app.use(express.json());
app.use(morgan('dev'));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/token', tokenRoutes);
app.use('/api/referral', referralRoutes);
app.use('/api/blockchain', blockchainRoutes);
app.use('/api/admin',adminRoutes);
app.use('/api/user',userRoutes);


// Health check
app.get('/', (req, res) => res.send('API Running'));

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
pollSQS(verboseSQSLogs);
