import { _getAllUsersForAdmin,_getAllClaimRequests } from "../../services/admin/adminService.js";

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