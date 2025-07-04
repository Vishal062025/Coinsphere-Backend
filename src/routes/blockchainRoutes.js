import express from 'express';

import {assignTokens} from '../controllers/blockchainController'
import { adminMiddleware } from '../middleware/authMiddleware';

const router = express.Router();

router.post('/assign-token',adminMiddleware,assignTokens);

export default router;