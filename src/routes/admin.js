import express from 'express';
import { getAllClaimRequests, getAllUsersForAdmin } from '../controllers/admin/adminController.js';
import { authMiddleware,authorizeRoles } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/users-list',authMiddleware, authorizeRoles('ADMIN'),getAllUsersForAdmin);
router.get('/referral-claim-list',authMiddleware, authorizeRoles('ADMIN'),getAllClaimRequests);

export default router;