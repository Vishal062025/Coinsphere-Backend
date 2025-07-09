import express from 'express';

import {assignTokens} from '../controllers/blockchainController.js'
import { authMiddleware,authorizeRoles } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/assign-token', authMiddleware, authorizeRoles('ADMIN'), assignTokens); 

export default router;