
import { _handleReferral,_createClaimRewardRequest } from '../services/referralService.js';

export const handleReferral = async (req, res) => {
  try {
    const { statusCode, data, message, error } = await _handleReferral(req?.user?.id);
    return res.status(statusCode).json({ data, message, error });
  } catch (err) {
    return res.status(500).json({ message: 'Server Error', error: err.message });
  }
};

export const createClaimRewardRequest  = async (req, res) => {
  try {
    const { statusCode, data, message, error } = await _createClaimRewardRequest (req);
    res.status(statusCode).json({ data, message, error });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
