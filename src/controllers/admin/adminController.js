import { _getAllUsersForAdmin,_getAllClaimRequests, _getAllAssignedTokens,_adminCreateUser } from "../../services/admin/adminService.js";

export const getAllUsersForAdmin = async (req, res) => {
  try {
    const { statusCode, data, message, error } = await _getAllUsersForAdmin();
    res.status(statusCode).json({ data, message, error });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getAllClaimRequests = async (req, res) => {
  try {
    const { statusCode, data, message, error } = await _getAllClaimRequests();
    res.status(statusCode).json({ data, message, error });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


export const getAllAssignedTokensList = async (req, res) => {
  try {
    const { statusCode, data, message, error } = await _getAllAssignedTokens();
    res.status(statusCode).json({ data, message, error });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const adminCreateUser = async (req, res) => {
  try {
    const { statusCode, data, message, error } = await _adminCreateUser(req,res);
    res.status(statusCode).json({ data, message, error });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};