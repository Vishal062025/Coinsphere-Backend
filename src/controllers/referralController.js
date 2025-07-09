
import { _handleReferral, _createClaimRewardRequest, _approveClaimRewardRequest } from '../services/referralService.js';

export const handleReferral = async (req, res) => {
  try {
    const { statusCode, data, message, error } = await _handleReferral(req?.user?.id);
    return res.status(statusCode).json({ data, message, error });
  } catch (err) {
    return res.status(500).json({ message: 'Server Error', error: err.message });
  }
};

export const createClaimRewardRequest = async (req, res) => {
  try {
    const { statusCode, data, message, error } = await _createClaimRewardRequest(req);
    res.status(statusCode).json({ data, message, error });
  } catch (err) {
    console.error('Error creating claim reward request:', err);
    res.status(500).json({ error: err.message });
  }
};




export const approveClaimRewardRequest = async (req, res) => {
  try {
    const { claimId } = req.params;
    const result = await _approveClaimRewardRequest(claimId);

    if (!result || typeof result.statusCode !== 'number') {
      return res.status(500).json({
        error: "Internal Server Error",
        message: "Invalid response from service layer",
        data: null
      });
    }

    return res.status(result.statusCode).json({
      message: result.message,
      data: result.data,
      error: result.error
    });
  } catch (error) {
    console.error("Error approving claim reward request:", error);
    return res.status(500).json({
      message: "Something went wrong while approving reward",
      error: error.message || "Internal server error",
      data: null
    });
  }
};
