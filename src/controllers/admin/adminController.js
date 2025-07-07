import { _getAllUsersForAdmin } from "../../services/admin/adminService.js";

export const getAllUsersForAdmin = async (req, res) => {
  try {
    const { statusCode, data, message, error } = await _getAllUsersForAdmin(req);
    res.status(statusCode).json({ data, message, error });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};