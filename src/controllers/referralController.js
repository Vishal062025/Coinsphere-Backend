
import { _handleReferral } from '../services/referralService.js';

export const handleReferral = async (req, res) => {
  try {
    const { statusCode, data, message, error } = await _handleReferral(req?.user?.id);
    return res.status(statusCode).json({ data, message, error });
  } catch (err) {
    return res.status(500).json({ message: 'Server Error', error: err.message });
  }
};

