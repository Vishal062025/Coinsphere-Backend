import { validateSignupInput } from "../middleware/validator.js";
import {
  _registerUser,
  _loginUser,
  _forgotPassword,
  _resetPassword
} from "../services/authService.js";

export const signup = async (req, res) => {
  try {
    const valid = validateSignupInput(req.body);
    if (!valid.valid) {
      return res.status(400).json({ error: valid.error });
    }
    const { statusCode, data, message, error } = await _registerUser(req.body);
    res.status(statusCode).json({ data, message, error });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const login = async (req, res) => {
  try {
    const { statusCode, data, message, error } = await _loginUser(req.body);
    res.status(statusCode).json({ data, message, error });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const forgotPassword = async (req, res) => {
  try {
    const { statusCode, data, message, error } = await _forgotPassword(req);
    res.status(statusCode).json({ data, message, error });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const resetPassword = async (req, res) => {
  try {
    const { statusCode, data, message, error } = await _resetPassword(req);
    res.status(statusCode).json({ data, message, error });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
