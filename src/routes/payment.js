import express from 'express';
import { validateExecutePayment, validatePayment } from '../middleware/validator.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import {
  handleCreatePayment,
  handleExecutePayment,
  listTransactions,
  transactionDetail
} from '../controllers/paymentController.js';

const router = express.Router();

router.post('/create-payment', authMiddleware, validatePayment, handleCreatePayment);
router.post('/execute-payment', authMiddleware, validateExecutePayment, handleExecutePayment);
router.get('/transactions', authMiddleware, listTransactions);
router.get('/transaction/:id', authMiddleware, transactionDetail);

export default router;
