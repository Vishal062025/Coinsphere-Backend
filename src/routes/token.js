import express from 'express';
import {
  handleTotalToken,
} from '../controllers/tokenController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/', handleTotalToken);
router.get('/user', authMiddleware, handleTotalToken);

export default router;
