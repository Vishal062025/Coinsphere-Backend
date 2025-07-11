import express from 'express';
import { getAllClaimRequests, getAllUsersForAdmin,getAllAssignedTokensList,adminCreateUser } from '../controllers/admin/adminController.js';
import { authMiddleware,authorizeRoles } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/users-list',authMiddleware, authorizeRoles('ADMIN'),getAllUsersForAdmin);
router.get('/referral-claim-list',authMiddleware, authorizeRoles('ADMIN'),getAllClaimRequests);
router.get('/assigned-token-history',authMiddleware, authorizeRoles('ADMIN'),getAllAssignedTokensList)
router.post('/create-user',authMiddleware, authorizeRoles('ADMIN'),adminCreateUser)

export default router;