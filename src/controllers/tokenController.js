
import { _handleTotalToken } from '../services/tokenService.js';

export const handleTotalToken = async (req, res) => {
  try {
    const { statusCode, data, message, error } = await _handleTotalToken(req?.user?.id);
    return res.status(statusCode).json({ data, message, error });
  } catch (err) {
    return res.status(500).json({ message: 'Server Error', error: err.message });
  }
};

