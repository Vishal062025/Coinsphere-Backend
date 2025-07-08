import express from 'express';
import { authMiddleware,authorizeRoles } from '../middleware/authMiddleware.js';
import {
  createClaimRewardRequest,
} from '../controllers/referralController.js';

const router = express.Router();

router.post('/claim-reward', authMiddleware, authorizeRoles('USER'), createClaimRewardRequest);


export default router;
