import express from 'express';
import { signup, login, forgotPassword, resetPassword, verifyUser } from '../controllers/authController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/signup', signup);
router.post('/login', login);
router.post('/forgot-password',forgotPassword);
router.post('/reset-password',resetPassword);
router.post('/verify-email',verifyUser)
// Protected route to verify token
router.get('/check-auth', authMiddleware, (req, res) => {
  return res.status(200).json({ message: 'Token is valid' });
});


export default router;
