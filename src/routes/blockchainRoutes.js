import express from 'express';

import {assignTokens} from '../controllers/blockchainController.js'
import { authMiddleware,authorizeRoles } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/assign-token',assignTokens); // ,authMiddleware, authorizeRoles('ADMIN')

export default router;