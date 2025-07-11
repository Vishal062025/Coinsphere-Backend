import express from 'express';
import { authMiddleware, authorizeRoles } from '../middleware/authMiddleware.js';
import {
  approveClaimRewardRequest,
  handleReferral,
} from '../controllers/referralController.js';

const router = express.Router();

router.get('/', authMiddleware, handleReferral);
router.post('/approve-claim', authMiddleware, authorizeRoles('ADMIN'),  approveClaimRewardRequest); 


export default router;
