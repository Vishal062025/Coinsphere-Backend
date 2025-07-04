// src/middleware/authMiddleware.js
import jwt from 'jsonwebtoken';

export const authMiddleware = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Ensure req.user object exists
    req.user = { id: decoded.userId };

    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid token' });
  }
};


export const adminMiddleware = async (req, res, next) => {
  try {
    // Verify user is admin
    const admin = await prisma.user.findUnique({
      where: { 
        id: req.user.id, 
        IsAdmin: true 
      },
      select: { id: true }
    });
    
    if (!admin) throw new Error('Admin access required');
    
    // Attach verified admin ID to request
    req.adminId = admin.id;
    next();
  } catch (error) {
    return res.status(403).json({ message: 'Admin privileges required' });
  }
};