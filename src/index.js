import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import authRoutes from './routes/auth.js';
import paymentRoutes from './routes/payment.js';
import tokenRoutes from './routes/token.js';
import referralRoutes from './routes/referral.js';
import pkg from '@prisma/client';

const { PrismaClient } = pkg;

dotenv.config();
const app = express();
const prisma = new PrismaClient();


app.use(cors({
  origin: '*', // allows all origins
  methods: '*', // allows all HTTP methods
  allowedHeaders: ['Content-Type', 'Authorization'], // allows specific headers
}));


app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/token', tokenRoutes);
app.use('/api/referral', referralRoutes);

// Health check
app.get('/', (req, res) => res.send('API Running'));

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));