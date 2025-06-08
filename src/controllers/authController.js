import { _registerUser, _loginUser } from '../services/authService.js';

export const signup = async (req, res) => {
  try {
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
