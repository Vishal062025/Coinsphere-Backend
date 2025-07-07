import express from 'express';
import { getAllUsersForAdmin } from '../controllers/admin/adminController.js';
import { authMiddleware,authorizeRoles } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/users-list',authMiddleware, authorizeRoles('ADMIN'),getAllUsersForAdmin);


export default router;