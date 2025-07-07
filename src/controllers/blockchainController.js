
import { assignTokenByAdmin } from '../services/blockchainService.js';

export const assignTokens = async (req, res) => {
  try {
    // Get adminId from middleware-authenticated request
    const result = await assignTokenByAdmin(req.adminId, req.body);
    res.status(200).json(result);
  } catch (error) {
    res.status(400).json({ 
      success: false,
      error: error.message 
    });
  }
};