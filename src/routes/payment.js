import express from 'express';
import { validatePayment } from '../middleware/validator.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import {
  handleCreatePayment,
  listTransactions,
  transactionDetail
} from '../controllers/paymentController.js';

const router = express.Router();

router.post('/create-payment', authMiddleware, validatePayment, handleCreatePayment);
router.get('/transactions', authMiddleware, listTransactions);
router.get('/transaction/:id', authMiddleware, transactionDetail);

export default router;
