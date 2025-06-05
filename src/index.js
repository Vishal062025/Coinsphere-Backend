import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import authRoutes from './routes/auth.js';
import paymentRoutes from './routes/payment.js';
import pkg from '@prisma/client';
const { PrismaClient } = pkg;

dotenv.config();
const app = express();
const prisma = new PrismaClient();

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/payment', paymentRoutes);



app.listen(5000, () => console.log('Server running on port 5000'));


app.get('/', (req, res) => res.send('API Running'));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on ${PORT}`));
