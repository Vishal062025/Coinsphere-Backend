import express from 'express';
import { authMiddleware, authorizeRoles } from '../middleware/authMiddleware.js';
import {
  approveClaimRewardRequest,
  createClaimRewardRequest,
  handleReferral,
} from '../controllers/referralController.js';

const router = express.Router();

router.get('/', authMiddleware, handleReferral);
router.post('/claim', authMiddleware, createClaimRewardRequest); // authMiddleware,
router.post('/approve-claim/:claimId',  approveClaimRewardRequest); // authMiddleware, authorizeRoles('ADMIN', 'SUPER_ADMIN'),


export default router;
