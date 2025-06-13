import express from 'express';
import { authMiddleware } from '../middleware/authMiddleware.js';
import {
  handleReferral,
} from '../controllers/referralController.js';

const router = express.Router();

router.get('/', authMiddleware, handleReferral);

export default router;
