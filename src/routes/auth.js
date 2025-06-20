import express from 'express';
import { signup, login } from '../controllers/authController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/signup', signup);
router.post('/login', login);

// Protected route to verify token
router.get('/check-auth', authMiddleware, (req, res) => {
  return res.status(200).json({ message: 'Token is valid' });
});


export default router;
